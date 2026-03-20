import { supabase } from './supabase'
import { sendTextMessage, createGroup } from './zapi'
import { generateOnboardingMessage, interpretEditValue, interpretCoupleChoice, interpretOnboardingAnswer } from './claude'

interface User {
  id: string
  phone: string
  name: string | null
  nickname: string | null
  couple_id: string | null
  chat_mode: string | null
  group_id: string | null
  onboarding_step: number
  onboarding_completed: boolean
  editing_field: string | null
  monthly_income: number | null
  payment_day: number | null
  employment_type: string | null
  has_bonus: boolean | null
  goal_description: string | null
  goal_amount: number | null
  fixed_expenses: number | null
}

interface Couple {
  id: string
  chat_mode: string | null
  group_id: string | null
}

export function getOnboardingMessage(step: number, userName: string, isCouple = false): string {
  const name = userName || 'você'

  // ── Fluxo individual (sem couple_id) ──────────────────────────────────────
  if (!isCouple) {
    switch (step) {
      case -1:
        return `Olá ${name}! 👋 Eu sou o Finn, seu assistente financeiro para casais.\n\nQuer fazer o cadastro sozinho agora e compartilhar meu contato depois, ou prefere chamar seu parceiro(a) para fazermos juntos?\n\n(responda: *sozinho* ou *casal*)`
      case -2:
        return `Ótimo! 💑 Qual é o número do WhatsApp do seu parceiro(a)?\n(só os números, ex: 11999999999)`
      case 0:
        return `Oi ${name}! 👋 Eu sou o Finn, seu assistente financeiro pessoal.\n\nComo você quer que eu te chame?`
      case 1:
        return `Antes de continuar, quero ser transparente: vou te fazer algumas perguntas sobre sua renda. 🔒 Essas informações ficam seguras e são usadas só para personalizar sua experiência — quanto mais você compartilhar, mais o Finn consegue te ajudar com estimativas, metas e alertas certeiros.\n\nSe sua renda for variável, sem problema — você pode me contar quanto ganhou a cada mês que passar.\n\nQual é sua renda mensal aproximada? (só o número, ex: 5000)`
      case 2:
        return `Qual dia do mês você costuma receber? (ex: 5, 10, 25)`
      case 3:
        return `Você recebe algum bônus ou 13º anual?\n(responda: sim ou não)`
      case 4:
        return `Qual sua maior meta financeira agora?\n(ex: reserva de emergência, viagem, casa própria)`
      case 5:
        return `Qual o valor aproximado dessa meta?\n(ex: 10000)`
      default:
        return `Tudo certo! Onboarding completo. 🎉`
    }
  }

  // ── Fluxo casal (com couple_id) ───────────────────────────────────────────
  switch (step) {
    case 0:
      return `Oi ${name}! 👋 Eu sou o Finn, o assistente financeiro do casal de vocês.\n\nVou fazer algumas perguntinhas para cada um separadamente — leva menos de 2 minutos. Pode ser?\n\nComo você quer que eu te chame?`
    case 1:
      return `Agora vou te pedir algumas informações sobre sua renda. 🔒 Fique tranquilo(a): cada um do casal informa a própria renda separadamente e os dados ficam seguros.\n\nSe sua renda for variável, sem problema — você pode atualizar mês a mês.\n\nQual é a sua renda mensal aproximada? (só o número, ex: 5000)`
    case 2:
      return `Qual dia do mês você costuma receber? (ex: 5, 10, 25)`
    case 3:
      return `Você recebe algum bônus ou 13º anual?\n(responda: sim ou não)`
    case 4:
      return `Qual a maior meta financeira de vocês como casal?\n(ex: viagem dos sonhos, casa própria, reserva de emergência)`
    case 5:
      return `Qual o valor aproximado dessa meta?\n(ex: 50000)`
    default:
      return `Tudo certo! 🎉`
  }
}

export async function processOnboardingStep(
  phone: string,
  message: string,
  user: User
): Promise<string> {
  const step = user.onboarding_step
  const msg = message.trim().toLowerCase()

  const updates: Record<string, unknown> = {}
  let nextStep = step + 1

  switch (step) {
    case -1: {
      const choice = await interpretCoupleChoice(message)
      if (choice === 'casal') {
        updates.onboarding_step = -2
        nextStep = -2
      } else {
        updates.onboarding_step = 0
        nextStep = 0
      }
      await supabase.from('users').update(updates).eq('phone', phone)
      return getOnboardingMessage(nextStep, user.name ?? '')
    }

    case -2: {
      const partnerPhone = message.replace(/\D/g, '')
      if (partnerPhone.length < 10 || partnerPhone.length > 13) {
        return `Por favor, me informe um número válido com DDD.\n(ex: 11999999999)`
      }

      const { data: couple, error: coupleError } = await supabase
        .from('couples')
        .insert({ chat_mode: 'group' })
        .select()
        .single()

      if (coupleError || !couple) {
        return `Ops, tive um problema ao criar o grupo. Tente novamente.`
      }

      const groupId = await createGroup('Finn 💑', [phone, partnerPhone])

      if (groupId) {
        await supabase.from('couples').update({ group_id: groupId }).eq('id', couple.id)
      }

      await supabase.from('users').update({
        couple_id: couple.id,
        chat_mode: 'group',
        group_id: groupId,
        onboarding_step: 0,
      }).eq('phone', phone)

      const { data: partnerUser } = await supabase
        .from('users')
        .select('*')
        .eq('phone', partnerPhone)
        .maybeSingle()

      if (partnerUser) {
        await supabase.from('users').update({
          couple_id: couple.id,
          chat_mode: 'group',
          group_id: groupId,
        }).eq('phone', partnerPhone)
      } else {
        await supabase.from('users').insert({
          phone: partnerPhone,
          couple_id: couple.id,
          chat_mode: 'group',
          group_id: groupId,
          onboarding_step: 0,
          onboarding_completed: false,
        })
      }

      if (groupId) {
        const groupWelcome =
          `Oi! 💑 Criei esse grupo para fazermos o cadastro de vocês dois juntos.\n\n` +
          `Vou fazer algumas perguntas para cada um. Pode ser?\n\n` +
          `Vou começar com ${user.name ?? 'você'}: ${getOnboardingMessage(0, user.name ?? '')}`
        await sendTextMessage(groupId, groupWelcome)
        return `Grupo criado! Continue o cadastro por lá 👆`
      }

      return getOnboardingMessage(0, user.name ?? '')
    }

    // Steps 0-5: Claude interpreta linguagem natural
    default: {
      const interpreted = await interpretOnboardingAnswer(step, message)

      if (!interpreted.valid) {
        // Claude gera mensagem de pedido de esclarecimento
        const clarifications: Record<number, string> = {
          0: `Não entendi seu nome. Como você quer que eu te chame?`,
          1: `Não consegui identificar o valor. Pode me dizer sua renda mensal? Ex: 5000`,
          2: `Não entendi o dia. Qual dia do mês você costuma receber? Ex: 5, 10, 25`,
          3: `Não entendi. Você recebe bônus ou 13º anual? Responde sim ou não 😊`,
          4: `Pode descrever um pouco mais sua meta?`,
          5: `Não entendi o valor. Qual o valor aproximado da meta? Ex: 10000`,
        }
        return clarifications[step] ?? `Não entendi. Pode repetir?`
      }

      switch (step) {
        case 0: updates.nickname = interpreted.value as string; break
        case 1: updates.monthly_income = interpreted.value as number; break
        case 2: updates.payment_day = interpreted.value as number; break
        case 3: updates.has_bonus = interpreted.value as boolean; break
        case 4: updates.goal_description = interpreted.value as string; break
        case 5:
          updates.goal_amount = interpreted.value as number
          updates.onboarding_completed = true
          nextStep = 6
          break
      }
      break
    }
  }

  updates.onboarding_step = nextStep
  await supabase.from('users').update(updates).eq('phone', phone)

  const isCouple = !!user.couple_id

  if (updates.onboarding_completed) {
    if (isCouple) {
      // Busca nome do parceiro para personalizar mensagem de espera
      const { data: partner } = await supabase
        .from('users')
        .select('nickname, name')
        .eq('couple_id', user.couple_id!)
        .neq('phone', phone)
        .maybeSingle()
      const partnerName = partner?.nickname ?? partner?.name ?? 'seu parceiro(a)'
      return `Perfeito! Seu perfil está completo. 🎉\n\nAgora é só aguardar *${partnerName}* terminar o cadastro dele(a) — assim que os dois estiverem prontos, o Finn ativa tudo para vocês! 💑`
    }
    // Fluxo individual — comemoração imediata com dicas
    const nick = (updates.nickname as string) ?? user.nickname ?? user.name ?? 'você'
    return (
      `Perfeito, ${nick}! Tudo pronto. 🎉\n\n` +
      `Agora é só usar o Finn aqui mesmo:\n\n` +
      `• _"gastei 80 reais no mercado"_ → registra o gasto\n` +
      `• _"recebi meu salário"_ → registra a receita\n` +
      `• _"total de gastos do mês"_ → ver resumo\n\n` +
      `Pode mandar sua primeira mensagem quando quiser! 🚀`
    )
  }

  const displayName = (updates.nickname as string) ?? user.nickname ?? user.name ?? ''

  // Monta o label do que foi salvo para dar contexto ao Claude
  const savedLabels: Record<number, string> = {
    0: `apelido "${updates.nickname}"`,
    1: `renda mensal R$${updates.monthly_income}`,
    2: `dia de recebimento: ${updates.payment_day}`,
    3: `bônus anual: ${updates.has_bonus ? 'sim' : 'não'}`,
    4: `meta: "${updates.goal_description}"`,
  }

  const claudeMsg = await generateOnboardingMessage(nextStep, {
    userName: displayName,
    justAnswered: message.trim(),
    savedLabel: savedLabels[step] ?? '',
    isCouple,
  })

  return claudeMsg || getOnboardingMessage(nextStep, displayName, isCouple)
}

export async function checkCoupleComplete(coupleId: string): Promise<{
  complete: boolean
  users?: User[]
  couple?: Couple
}> {
  const [{ data: users }, { data: couple }] = await Promise.all([
    supabase.from('users').select('*').eq('couple_id', coupleId),
    supabase.from('couples').select('id, chat_mode, group_id').eq('id', coupleId).maybeSingle(),
  ])

  if (!users || users.length < 2 || !couple) return { complete: false }

  const allComplete = users.every((u: User) => u.onboarding_completed === true)
  if (!allComplete) return { complete: false }

  return { complete: true, users: users as User[], couple: couple as Couple }
}

// ─── EDIÇÃO DE PERFIL ────────────────────────────────────────────────────────

const EDIT_FIELDS: Record<string, { column: string; label: string; question: string }> = {
  '1': { column: 'nickname',         label: 'Nome (apelido)',        question: 'Qual é o seu novo apelido?' },
  '2': { column: 'monthly_income',   label: 'Renda mensal',          question: 'Qual é a sua nova renda mensal? (ex: 6000)' },
  '3': { column: 'payment_day',      label: 'Dia do pagamento',      question: 'Qual dia do mês você recebe? (ex: 5, 10, 25)' },
  '4': { column: 'has_bonus',        label: 'Bônus/13º',             question: 'Você recebe bônus ou 13º anual? (sim ou não)' },
  '5': { column: 'goal_description', label: 'Meta financeira',       question: 'Qual é a sua nova meta financeira? (ex: reserva de emergência, viagem)' },
  '6': { column: 'goal_amount',      label: 'Valor da meta',         question: 'Qual é o novo valor da meta? (ex: 15000)' },
  '7': { column: 'fixed_expenses',   label: 'Gastos fixos mensais',  question: 'Qual é o total dos seus gastos fixos mensais? (ex: 2500)' },
}

export function getEditMenu(): string {
  return (
    `O que você quer atualizar? ✏️\n\n` +
    `1️⃣ Nome (apelido)\n` +
    `2️⃣ Renda mensal\n` +
    `3️⃣ Dia do pagamento\n` +
    `4️⃣ Bônus/13º\n` +
    `5️⃣ Meta financeira\n` +
    `6️⃣ Valor da meta\n` +
    `7️⃣ Gastos fixos\n\n` +
    `Responda com o número do campo que quer editar.`
  )
}

export async function processEditChoice(phone: string, choice: string): Promise<string | null> {
  const field = EDIT_FIELDS[choice.trim()]
  if (!field) return null
  await supabase.from('users').update({ editing_field: field.column }).eq('phone', phone)
  return field.question
}

export async function processEditValue(phone: string, rawValue: string, editingField: string): Promise<string> {
  const fieldConfig = Object.values(EDIT_FIELDS).find(f => f.column === editingField)
  if (!fieldConfig) {
    await supabase.from('users').update({ editing_field: null }).eq('phone', phone)
    return 'Campo inválido. Tente !editar perfil novamente.'
  }

  const { value, display } = await interpretEditValue(editingField, rawValue)

  if (value === null) {
    return `Não entendi o valor. ${fieldConfig.question}`
  }

  await supabase.from('users').update({ [editingField]: value, editing_field: null }).eq('phone', phone)
  return `✅ ${fieldConfig.label} atualizado para *${display}*!`
}

export function formatUserProfile(user: User): string {
  const bool = (v: boolean | null) => v === true ? 'sim' : v === false ? 'não' : 'não informado'
  const money = (v: number | null) => v ? `R$ ${v.toLocaleString('pt-BR')}` : 'não informado'
  const lines = [
    `👤 *Seu perfil no Finn*\n`,
    `Nome: ${user.nickname ?? user.name ?? 'não informado'}`,
    `Renda mensal: ${money(user.monthly_income)}`,
    `Dia do pagamento: ${user.payment_day ? `dia ${user.payment_day}` : 'não informado'}`,
    `Bônus/13º: ${bool(user.has_bonus)}`,
    `Meta: ${user.goal_description ?? 'não informada'}`,
    `Valor da meta: ${money(user.goal_amount)}`,
    `\nPara editar: *!editar perfil*`,
  ]
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────

export async function handleCoupleComplete(users: User[], couple: Couple) {
  const totalIncome = users.reduce((sum, u) => sum + (u.monthly_income ?? 0), 0)
  const goalUser = users.find(u => u.goal_description) ?? users[0]

  const names = users.map(u => u.nickname ?? u.name ?? 'vocês').join(' e ')
  const celebrationMsg =
    `🎊 *${names}, o Finn está pronto para o casal!*\n\n` +
    `💰 Renda combinada: R$ ${totalIncome.toLocaleString('pt-BR')}\n` +
    `🎯 Meta: ${goalUser.goal_description ?? 'não definida'} (R$ ${(goalUser.goal_amount ?? 0).toLocaleString('pt-BR')})\n\n` +
    `Agora é só usar:\n` +
    `• _"gastei 80 reais no mercado"_ → registrar gasto\n` +
    `• _"recebi meu salário"_ → registrar receita\n` +
    `• _"total de gastos do mês"_ → ver resumo do casal\n\n` +
    `Qualquer um dos dois pode mandar mensagem aqui. Vamos lá! 💑`

  if (couple.chat_mode === 'group') {
    const phones = users.map(u => u.phone).filter(Boolean)
    const groupId = await createGroup('Finn 💑', phones)

    if (groupId) {
      await supabase.from('couples').update({ group_id: groupId }).eq('id', couple.id)
      await sendTextMessage(groupId, celebrationMsg)
    } else {
      // Fallback: individual se criação do grupo falhar
      for (const u of users) {
        if (u.phone) await sendTextMessage(u.phone, celebrationMsg)
      }
    }
  } else {
    for (const u of users) {
      if (u.phone) await sendTextMessage(u.phone, celebrationMsg)
    }
  }
}
