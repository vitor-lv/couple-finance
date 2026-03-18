import { supabase } from './supabase'
import { sendTextMessage, createGroup } from './zapi'
import { generateOnboardingMessage, interpretEditValue } from './claude'

interface User {
  id: string
  phone: string
  name: string | null
  nickname: string | null
  couple_id: string | null
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

export function getOnboardingMessage(step: number, userName: string): string {
  const name = userName || 'você'
  switch (step) {
    case 0:
      return `Olá ${name}! 👋 Eu sou o Finn, seu assistente financeiro pessoal.\n\nComo você quer que eu te chame?`
    case 1:
      return `Prazer! Antes de continuar, quero ser transparente: vou te fazer algumas perguntas sobre sua renda. 🔒 Essas informações ficam seguras e são usadas só para personalizar sua experiência — quanto mais você compartilhar, mais o Finn consegue te ajudar com estimativas, metas e alertas certeiros.\n\nSe sua renda for variável, sem problema — você pode me contar quanto ganhou a cada mês que passar.\n\nQual é sua renda mensal aproximada? (só o número, ex: 5000)`
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
    case 0: {
      updates.nickname = message.trim()
      break
    }
    case 1: {
      const income = parseFloat(msg.replace(/[^\d.,]/g, '').replace(',', '.'))
      if (isNaN(income) || income <= 0) {
        return `Por favor, me informe um valor numérico. Ex: 5000`
      }
      updates.monthly_income = income
      break
    }
    case 2: {
      const day = parseInt(msg.replace(/[^\d]/g, ''), 10)
      if (isNaN(day) || day < 1 || day > 31) {
        return `Por favor informe um dia válido entre 1 e 31. Ex: 5`
      }
      updates.payment_day = day
      break
    }
    case 3: {
      if (!['sim', 'não', 'nao', 's', 'n'].includes(msg)) {
        return `Por favor responda: sim ou não`
      }
      updates.has_bonus = ['sim', 's'].includes(msg)
      break
    }
    case 4: {
      if (message.trim().length < 3) {
        return `Por favor descreva sua meta com mais detalhes.`
      }
      updates.goal_description = message.trim()
      break
    }
    case 5: {
      const amount = parseFloat(msg.replace(/[^\d.,]/g, '').replace(',', '.'))
      if (isNaN(amount) || amount <= 0) {
        return `Por favor, me informe um valor numérico. Ex: 10000`
      }
      updates.goal_amount = amount
      updates.onboarding_completed = true
      nextStep = 6
      break
    }
  }

  updates.onboarding_step = nextStep
  await supabase.from('users').update(updates).eq('phone', phone)

  if (updates.onboarding_completed) {
    return `Perfeito! Seu perfil está completo. 🎉\n\nAguardando seu parceiro(a) terminar o cadastro...`
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
  })

  return claudeMsg || getOnboardingMessage(nextStep, displayName)
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

  const celebrationMsg =
    `🎊 Vocês dois estão prontos! O Finn agora conhece o casal.\n\n` +
    `Renda combinada: R$ ${totalIncome.toLocaleString('pt-BR')}\n` +
    `Meta: ${goalUser.goal_description} (R$ ${(goalUser.goal_amount ?? 0).toLocaleString('pt-BR')})\n\n` +
    `Agora é só usar:\n` +
    `• g 50 mercado → registrar gasto\n` +
    `• ? resumo → ver seus gastos\n` +
    `• ? meta → ver progresso da meta 💑`

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
