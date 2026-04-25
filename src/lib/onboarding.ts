import { supabase } from './supabase'
import { interpretNickname, interpretGoal, interpretMoneyValue, interpretGoalConfirmation, interpretEditValue } from './claude'

export interface User {
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
  monthly_savings_goal: number | null
  financial_score: number | null
  payment_day: number | null
  goal_category: string | null
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

// ─── FINANCIAL SCORE ─────────────────────────────────────────────────────────

export function calculateFinancialScore(
  income: number | null,
  savingsGoal: number | null,
  totalSpent: number
): number {
  if (!income || income <= 0) return 50
  const available = Math.max(1, income - (savingsGoal ?? 0))
  const ratio = totalSpent / available
  if (ratio <= 1) return Math.round(50 + (1 - ratio) * 50)
  return Math.round(Math.max(0, 50 * (1 - (ratio - 1) * 2)))
}

// ─── MENSAGEM DE BOAS-VINDAS (step -1 → step 0) ──────────────────────────────

export function getWelcomeMessage(userName: string, isCouple: boolean): string {
  if (isCouple) {
    return (
      `Olá! 👋 Que bom ter você aqui!\n\n` +
      `Vou fazer algumas perguntinhas rápidas para configurar tudo. Pode ser?\n\n` +
      `${userName}, como você quer que eu te chame? 😊`
    )
  }
  return `Oi ${userName}! 👋 Eu sou o Finn, seu assistente financeiro pessoal.\nComo você prefere que eu te chame?`
}

// ─── HELPERS DO FLUXO SOLO ────────────────────────────────────────────────────

function extractNumberChoice(message: string, max: number): number | null {
  const trimmed = message.trim()
  const n = parseInt(trimmed)
  if (!isNaN(n) && n >= 1 && n <= max) return n
  const emojiMap: Record<string, number> = { '1️⃣': 1, '2️⃣': 2, '3️⃣': 3, '4️⃣': 4 }
  for (const [emoji, num] of Object.entries(emojiMap)) {
    if (trimmed.includes(emoji) && num <= max) return num
  }
  return null
}

function extractMissionChoice(message: string): number | null {
  const lower = message.toLowerCase()
  const choice = extractNumberChoice(message, 3)
  if (choice) return choice
  if (/controlar|gastos|dia.a.dia|registro/.test(lower)) return 1
  if (/guardar|poupar|economizar|poupan/.test(lower)) return 2
  if (/juntar|objetivo|meta|sonho/.test(lower)) return 3
  return null
}

function extractSavingsProfileChoice(message: string): number | null {
  const lower = message.toLowerCase()
  const choice = extractNumberChoice(message, 3)
  if (choice) return choice
  if (/^(nada|zero|nenhum|não sobra|nao sobra|nunca sobra)/.test(lower)) return 1
  if (/sobra|às vezes|as vezes|eventualm/.test(lower)) return 2
  if (/já guardo|ja guardo|guardo|poupo|estou guardando/.test(lower)) return 3
  return null
}

type SavingsProfile = 'nada' | 'sobra' | 'guarda'

function savingsOptionsMessage(income: number, profile: SavingsProfile): string {
  const percents = profile === 'nada' ? [1, 2, 5] : profile === 'sobra' ? [5, 8, 10] : [10, 15, 20]
  const opts = percents.map(p => Math.round(income * p / 100))
  return (
    `Pra começar leve, faz mais sentido pra você guardar:\n\n` +
    `1️⃣ R$ ${opts[0].toLocaleString('pt-BR')} por mês (${percents[0]}%)\n` +
    `2️⃣ R$ ${opts[1].toLocaleString('pt-BR')} por mês (${percents[1]}%)\n` +
    `3️⃣ R$ ${opts[2].toLocaleString('pt-BR')} por mês (${percents[2]}%)\n` +
    `4️⃣ Outro valor`
  )
}

function conclusionMessageSolo(nickname: string, value: number, profile: SavingsProfile): string {
  const valorFmt = value.toLocaleString('pt-BR')
  const projFmt = (value * 12).toLocaleString('pt-BR')

  const profileLine =
    profile === 'nada'
      ? `Pode parecer pouco, mas quem guarda R$ ${valorFmt} todo mês durante um ano termina com *R$ ${projFmt}*. A maioria das pessoas não chega nem perto disso. 💪`
      : profile === 'sobra'
      ? `Agora o dinheiro que sobrava vai ter um destino certo. Em um ano você vai ter *R$ ${projFmt}* guardados. 📈`
      : `Com um sistema, isso vira hábito automático. Em um ano: *R$ ${projFmt}* guardados. 📈`

  return (
    `Fechado, ${nickname}! 🎯 Sua meta é guardar *R$ ${valorFmt}* por mês.\n\n` +
    `${profileLine}\n\n` +
    `A partir de agora eu registro tudo. No fim do mês você já tem uma visão completa.\n\n` +
    `Bora começar? Me manda um gasto que você teve hoje — pode ser texto, áudio ou print. 📲`
  )
}

// ─── MENSAGEM DE CONCLUSÃO (casal) ────────────────────────────────────────────

function conclusionMessageCouple(nickname: string, goalDescription: string, goalAmount: number, isCouple: boolean): string {
  const formatted = goalAmount.toLocaleString('pt-BR')

  if (isCouple) {
    return (
      `🎊 O casal está pronto!\n\n` +
      `🎯 Meta do casal: ${goalDescription}\n` +
      `💰 Valor: R$ ${formatted}\n\n` +
      `Agora é só usar o Finn juntos:\n` +
      `• _"g 50 mercado"_ → registrar gasto\n` +
      `• _"? resumo"_ → ver gastos do casal\n` +
      `• _"? meta"_ → ver progresso da meta 💑`
    )
  }

  return (
    `Tudo certo, ${nickname}! 🎉\n\n` +
    `🎯 Meta: ${goalDescription}\n` +
    `💰 Valor: R$ ${formatted}\n\n` +
    `Agora é só usar o Finn no dia a dia:\n` +
    `• _"g 50 mercado"_ → registrar gasto\n` +
    `• _"g 200 restaurante"_ → registrar gasto\n` +
    `• _"? resumo"_ → ver seus gastos\n` +
    `• _"? meta"_ → ver progresso da meta`
  )
}

// ─── PROCESSAMENTO DO ONBOARDING ─────────────────────────────────────────────

export async function processOnboardingStep(phone: string, message: string, user: User): Promise<string> {
  const step = user.onboarding_step
  const isCouple = !!user.couple_id

  switch (step) {
    // ── Step 0: Nickname ──────────────────────────────────────────────────────
    case 0: {
      const nickname = await interpretNickname(message)
      if (!nickname) {
        return isCouple
          ? `Não entendi muito bem 😅 Como você quer que eu te chame?`
          : `Não entendi muito bem 😅 Como você prefere que eu te chame?`
      }

      await supabase.from('users').update({ nickname, onboarding_step: 1 }).eq('phone', phone)

      if (isCouple && user.couple_id) {
        const { data: partner } = await supabase
          .from('users')
          .select('nickname, name')
          .eq('couple_id', user.couple_id)
          .neq('phone', phone)
          .maybeSingle()

        if (partner && !partner.nickname) {
          const partnerName = partner.name ?? 'parceiro(a)'
          return `Legal, ${nickname}! 😊 E você ${partnerName}, como quer ser chamado(a)?`
        }

        const partnerNick = partner?.nickname ?? partner?.name ?? 'parceiro(a)'
        return (
          `Perfeito ${nickname} e ${partnerNick}! 😊\n\n` +
          `Qual é a maior meta financeira de vocês como casal?\n` +
          `(ex: reserva de emergência, viagem, casa própria, casamento)`
        )
      }

      // Solo: mostra opções de missão
      return (
        `Boa, ${nickname}! Qual é a sua principal missão hoje?\n\n` +
        `1️⃣ Controlar meus gastos no dia a dia\n` +
        `2️⃣ Começar a guardar dinheiro\n` +
        `3️⃣ Juntar dinheiro pra um objetivo`
      )
    }

    // ── Step 1: Casal → meta | Solo → escolha de missão ──────────────────────
    case 1: {
      if (isCouple && user.couple_id) {
        const { data: partner } = await supabase
          .from('users')
          .select('nickname, name')
          .eq('couple_id', user.couple_id)
          .neq('phone', phone)
          .maybeSingle()

        if (partner && !partner.nickname) {
          const partnerName = partner.name ?? 'parceiro(a)'
          return `Aguardando ${partnerName} informar o apelido antes de continuar 😊`
        }

        const goal = await interpretGoal(message)
        if (!goal) {
          return `Não entendi muito bem 😅 Pode reformular? Qual é a maior meta financeira de vocês como casal? (ex: viagem, reserva de emergência, casa própria)`
        }

        await supabase.from('users').update({ goal_description: goal.descricao, goal_category: goal.categoria }).eq('couple_id', user.couple_id)
        await supabase.from('users').update({ onboarding_step: 2 }).eq('phone', phone)

        if (goal.categoria === 'reserva_emergencia') {
          return `Ótima escolha! 💪 O ideal é ter 6 meses da renda combinada do casal guardados.\n\nQuanto vocês ganham juntos por mês? Vou calcular o valor ideal! (pode ser aproximado)`
        }
        return `Quanto vocês precisam juntar para realizar esse sonho? (ex: 30000)`
      }

      // Solo: aguardando confirmação após "coming soon"
      if (user.goal_category === 'redirect_pending') {
        const lower = message.toLowerCase()
        const isYes = ['sim', 'quero', 'pode', 'ok', 'claro', 'vamos', 's', 'yes', 'bora'].some(y => lower.includes(y))
        if (!isYes) {
          return `Sem problema! Quando quiser continuar, é só me chamar. 😊`
        }
        await supabase.from('users').update({ onboarding_step: 2, goal_category: null }).eq('phone', phone)
        return (
          `Boa escolha! 🙌 Vou te ajudar a começar a guardar dinheiro de forma simples.\n\n` +
          `Hoje, no fim do mês, você consegue guardar alguma coisa?\n\n` +
          `1️⃣ Nada\n2️⃣ Às vezes sobra\n3️⃣ Já guardo um pouco`
        )
      }

      // Solo: interpreta escolha de missão (1/2/3)
      const choice = extractMissionChoice(message)

      if (choice === 2) {
        await supabase.from('users').update({ onboarding_step: 2 }).eq('phone', phone)
        return (
          `Boa escolha! 🙌 Vou te ajudar a começar a guardar dinheiro de forma simples.\n\n` +
          `Hoje, no fim do mês, você consegue guardar alguma coisa?\n\n` +
          `1️⃣ Nada\n2️⃣ Às vezes sobra\n3️⃣ Já guardo um pouco`
        )
      }

      if (choice === 1 || choice === 3) {
        await supabase.from('users').update({ goal_category: 'redirect_pending' }).eq('phone', phone)
        return (
          `Essa funcionalidade está chegando em breve! 🚀\n\n` +
          `Por enquanto, posso te ajudar a começar a guardar dinheiro.\n` +
          `Quer seguir por esse caminho?`
        )
      }

      return (
        `Não entendi 😅 Qual é a sua principal missão?\n\n` +
        `1️⃣ Controlar meus gastos no dia a dia\n` +
        `2️⃣ Começar a guardar dinheiro\n` +
        `3️⃣ Juntar dinheiro pra um objetivo`
      )
    }

    // ── Step 2: Casal → valor da meta/renda | Solo → perfil de poupança ───────
    case 2: {
      if (isCouple && user.couple_id) {
        const value = await interpretMoneyValue(message)
        if (!value || value <= 0) {
          return `Não entendi muito bem 😅 Me diz o valor (ex: 15000)`
        }

        if (user.goal_category === 'reserva_emergencia') {
          const suggestedGoal = value * 6
          await supabase.from('users').update({ monthly_income: value }).eq('couple_id', user.couple_id)
          await supabase.from('users').update({ onboarding_step: 3 }).eq('phone', phone)
          const formatted = suggestedGoal.toLocaleString('pt-BR')
          return (
            `Baseado na renda de vocês, o valor ideal da reserva é *R$ ${formatted}*.\n\n` +
            `Quer usar esse valor ou prefere personalizar? (responda *usar* ou mande outro valor)`
          )
        }

        await supabase.from('users').update({ goal_amount: value }).eq('couple_id', user.couple_id)
        await supabase.from('users').update({ onboarding_step: 4 }).eq('phone', phone)
        return `Anotado! 💪 E quanto vocês querem guardar por mês para chegar nessa meta? (ex: 500)`
      }

      // Solo: interpreta perfil de poupança (1/2/3)
      const choice = extractSavingsProfileChoice(message)
      if (!choice) {
        return (
          `Não entendi 😅 Escolha uma opção:\n\n` +
          `1️⃣ Nada\n2️⃣ Às vezes sobra\n3️⃣ Já guardo um pouco`
        )
      }

      const profileMap: Record<number, SavingsProfile> = { 1: 'nada', 2: 'sobra', 3: 'guarda' }
      const profile = profileMap[choice]
      await supabase.from('users').update({ goal_category: profile, onboarding_step: 3 }).eq('phone', phone)

      const profileMessage =
        profile === 'nada'
          ? `Tudo bem, todo mundo começa do zero. Vamos dar o primeiro passo juntos 💪`
          : profile === 'sobra'
          ? `Isso significa que o dinheiro já existe — só precisa de um destino certo 🎯`
          : `Ótimo! Vamos organizar isso melhor e acelerar 🚀`

      return `${profileMessage}\n\nVocê ganha quanto por mês, mais ou menos? Prometo que não conto pra ninguém 🤫`
    }

    // ── Step 3: Casal → confirmação reserva | Solo → renda + opções ──────────
    case 3: {
      if (isCouple && user.couple_id) {
        const income = user.monthly_income ?? 0
        const suggestedGoal = income * 6
        const confirmation = await interpretGoalConfirmation(message, suggestedGoal)
        const finalGoal = confirmation.usarSugerido
          ? suggestedGoal
          : (confirmation.valorPersonalizado ?? suggestedGoal)

        await supabase.from('users').update({ goal_amount: finalGoal }).eq('couple_id', user.couple_id)
        await supabase.from('users').update({ onboarding_step: 4 }).eq('phone', phone)
        return `Perfeito! 💪 E quanto vocês querem guardar por mês para construir essa reserva? (ex: 500)`
      }

      // Solo: interpreta renda e exibe opções de poupança
      const value = await interpretMoneyValue(message)
      if (!value || value <= 0) {
        return `Não entendi 😅 Me diz sua renda mensal (ex: 3000)`
      }

      await supabase.from('users').update({ monthly_income: value, onboarding_step: 4 }).eq('phone', phone)

      const profile = (user.goal_category as SavingsProfile) ?? 'nada'
      return savingsOptionsMessage(value, profile)
    }

    // ── Step 4: Casal → poupança mensal | Solo → escolhe opção de poupança ───
    case 4: {
      if (isCouple && user.couple_id) {
        const value = await interpretMoneyValue(message)
        if (!value || value <= 0) {
          return `Não entendi 😅 Quanto vocês querem guardar por mês? (ex: 500)`
        }

        await supabase.from('users').update({ monthly_savings_goal: value, onboarding_completed: true }).eq('couple_id', user.couple_id)
        await supabase.from('users').update({ onboarding_step: 5 }).eq('phone', phone)

        const nick = user.nickname ?? user.name ?? 'você'
        const goalDesc = user.goal_description ?? 'sua meta'
        const goalAmount = user.goal_amount ?? value
        return conclusionMessageCouple(nick, goalDesc, goalAmount, true)
      }

      // Solo: interpreta escolha de poupança (1/2/3/4 ou valor direto)
      const income = user.monthly_income ?? 0
      const profile = (user.goal_category as SavingsProfile) ?? 'nada'
      const choice = extractNumberChoice(message, 4)

      if (choice === 4) {
        await supabase.from('users').update({ onboarding_step: 5 }).eq('phone', phone)
        return `Qual valor você quer guardar por mês?`
      }

      if (choice && choice >= 1 && choice <= 3) {
        const percents = profile === 'nada' ? [1, 2, 5] : profile === 'sobra' ? [5, 8, 10] : [10, 15, 20]
        const value = Math.round(income * percents[choice - 1] / 100)

        await supabase.from('users').update({
          monthly_savings_goal: value,
          onboarding_step: 5,
          onboarding_completed: true,
        }).eq('phone', phone)

        const nick = user.nickname ?? user.name ?? 'você'
        return conclusionMessageSolo(nick, value, profile)
      }

      // Nenhuma opção numérica: tenta interpretar como valor monetário direto
      const directValue = await interpretMoneyValue(message)
      if (directValue && directValue > 0) {
        await supabase.from('users').update({
          monthly_savings_goal: directValue,
          onboarding_step: 5,
          onboarding_completed: true,
        }).eq('phone', phone)
        const nick = user.nickname ?? user.name ?? 'você'
        return conclusionMessageSolo(nick, directValue, profile)
      }

      return savingsOptionsMessage(income, profile)
    }

    // ── Step 5: Solo → valor personalizado de poupança ───────────────────────
    case 5: {
      if (isCouple) return `Tudo certo! 🎉`

      const value = await interpretMoneyValue(message)
      if (!value || value <= 0) {
        return `Não entendi 😅 Me diz o valor que quer guardar por mês (ex: 300)`
      }

      await supabase.from('users').update({
        monthly_savings_goal: value,
        onboarding_completed: true,
      }).eq('phone', phone)

      const nick = user.nickname ?? user.name ?? 'você'
      const profile = (user.goal_category as SavingsProfile) ?? 'nada'
      return conclusionMessageSolo(nick, value, profile)
    }

    default:
      return `Tudo certo! 🎉`
  }
}

// ─── EDIÇÃO DE PERFIL ────────────────────────────────────────────────────────

const EDIT_FIELDS: Record<string, { column: string; label: string; question: string }> = {
  '1': { column: 'nickname',              label: 'Nome (apelido)',      question: 'Qual é o seu novo apelido?' },
  '2': { column: 'monthly_income',        label: 'Renda mensal',        question: 'Qual é a sua nova renda mensal? (ex: 6000)' },
  '3': { column: 'goal_description',      label: 'Meta financeira',     question: 'Qual é a sua nova meta financeira? (ex: viagem, reserva de emergência)' },
  '4': { column: 'goal_amount',           label: 'Valor da meta',       question: 'Qual é o novo valor da meta? (ex: 15000)' },
  '5': { column: 'fixed_expenses',        label: 'Gastos fixos',        question: 'Qual é o total dos seus gastos fixos mensais? (ex: 2500)' },
  '6': { column: 'monthly_savings_goal',  label: 'Poupança mensal',     question: 'Quanto você quer guardar por mês? (ex: 500)' },
}

export function getEditMenu(): string {
  return (
    `O que você quer atualizar? ✏️\n\n` +
    `1️⃣ Nome (apelido)\n` +
    `2️⃣ Renda mensal\n` +
    `3️⃣ Meta financeira\n` +
    `4️⃣ Valor da meta\n` +
    `5️⃣ Gastos fixos\n` +
    `6️⃣ Poupança mensal\n\n` +
    `Responda com o número do campo que quer editar.`
  )
}

export async function processEditChoice(phone: string, choice: string): Promise<string | null> {
  const lower = choice.trim().toLowerCase()
  if (/^(cancelar|sair|voltar|não|nao|nada|pronto|ok|tchau|exit)$/.test(lower)) {
    await supabase.from('users').update({ editing_field: null }).eq('phone', phone)
    return 'Tudo bem, cancelei a edição. 😊 O que mais posso fazer?'
  }
  const field = EDIT_FIELDS[choice.trim()]
  if (!field) return null
  await supabase.from('users').update({ editing_field: field.column }).eq('phone', phone)
  return field.question
}

export async function processEditValue(phone: string, rawValue: string, editingField: string): Promise<string> {
  const fieldConfig = Object.values(EDIT_FIELDS).find(f => f.column === editingField)
  if (!fieldConfig) {
    await supabase.from('users').update({ editing_field: null }).eq('phone', phone)
    return 'Campo inválido. Tente novamente.'
  }

  const { value, display } = await interpretEditValue(editingField, rawValue)

  if (value === null) {
    return `Não entendi o valor. ${fieldConfig.question}`
  }

  await supabase.from('users').update({ [editingField]: value, editing_field: null }).eq('phone', phone)
  return `✅ ${fieldConfig.label} atualizado para *${display}*!`
}

// ─── PERFIL ───────────────────────────────────────────────────────────────────

function scoreEmoji(score: number): string {
  if (score >= 80) return '🟢'
  if (score >= 60) return '🟡'
  if (score >= 40) return '🟠'
  return '🔴'
}

export function formatUserProfile(user: User): string {
  const money = (v: number | null) => v ? `R$ ${v.toLocaleString('pt-BR')}` : 'não informado'
  const score = user.financial_score ?? 50
  const lines = [
    `👤 *Seu perfil no Finn*\n`,
    `Nome: ${user.nickname ?? user.name ?? 'não informado'}`,
    `Renda mensal: ${money(user.monthly_income)}`,
    `Poupança mensal: ${money(user.monthly_savings_goal)}`,
    `Meta: ${user.goal_description ?? 'não informada'}`,
    `Valor da meta: ${money(user.goal_amount)}`,
    `\nScore financeiro: ${scoreEmoji(score)} *${score}/100*`,
    `\nPara editar, me diga o que quer atualizar.`,
  ]
  return lines.join('\n')
}

// ─── CASAL ────────────────────────────────────────────────────────────────────

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
