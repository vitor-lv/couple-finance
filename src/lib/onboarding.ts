import { supabase } from './supabase'
import { interpretNickname, interpretGoal, interpretMoneyValue, interpretGoalConfirmation, interpretEditValue } from './claude'

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
  monthly_savings_goal: number | null
  financial_score: number | null
  payment_day: number | null
  employment_type: string | null  // repurposed: stores goal_category
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
  return `Oi ${userName}! 👋 Eu sou o Finn, seu assistente financeiro pessoal.\n\nComo você quer que eu te chame? 😊`
}

// ─── MENSAGEM DE CONCLUSÃO ────────────────────────────────────────────────────

function conclusionMessage(nickname: string, goalDescription: string, goalAmount: number, isCouple: boolean): string {
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
        return `Não entendi muito bem 😅 Como você quer que eu te chame?`
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
          // Pede o apelido do parceiro
          const partnerName = partner.name ?? 'parceiro(a)'
          return `Legal, ${nickname}! 😊 E você ${partnerName}, como quer ser chamado(a)?`
        }

        // Ambos têm apelido — segue pra meta do casal
        const partnerNick = partner?.nickname ?? partner?.name ?? 'parceiro(a)'
        return (
          `Perfeito ${nickname} e ${partnerNick}! 😊\n\n` +
          `Qual é a maior meta financeira de vocês como casal?\n` +
          `(ex: reserva de emergência, viagem, casa própria, casamento)`
        )
      }

      return (
        `Legal, ${nickname}! 😊\n\n` +
        `Qual é a sua maior meta financeira agora? Pode ser uma viagem, reserva de emergência, casa própria, casamento... 🎯`
      )
    }

    // ── Step 1: Meta financeira ───────────────────────────────────────────────
    case 1: {
      // Casal: aguarda parceiro ter apelido antes de pedir a meta
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
      }

      const goal = await interpretGoal(message)
      if (!goal) {
        const hint = isCouple
          ? `Qual é a maior meta financeira de vocês como casal? (ex: viagem, reserva de emergência, casa própria)`
          : `Qual é a sua maior meta financeira? (ex: viagem, reserva de emergência, casa própria)`
        return `Não entendi muito bem 😅 Pode reformular? ${hint}`
      }

      const updates: Record<string, unknown> = {
        goal_description: goal.descricao,
        employment_type: goal.categoria, // goal_category
        onboarding_step: 2,
      }

      // Para o casal, salva a meta para os dois
      if (isCouple && user.couple_id) {
        await supabase.from('users').update(updates).eq('couple_id', user.couple_id)
      } else {
        await supabase.from('users').update(updates).eq('phone', phone)
      }

      if (goal.categoria === 'reserva_emergencia') {
        return isCouple
          ? `Ótima escolha! 💪 O ideal é ter 6 meses da renda combinada do casal guardados.\n\nQuanto vocês ganham juntos por mês? Vou calcular o valor ideal! (pode ser aproximado)`
          : `Ótima escolha! 💪 O ideal é ter 6 meses de renda guardados.\n\nQuanto você ganha por mês? Vou calcular o valor ideal pra você. (pode ser aproximado)`
      }

      return isCouple
        ? `Quanto vocês precisam juntar para realizar esse sonho? (ex: 30000)`
        : `Quanto você precisa juntar pra realizar esse sonho? (ex: 15000)`
    }

    // ── Step 2: Valor (renda ou meta) ─────────────────────────────────────────
    case 2: {
      const value = await interpretMoneyValue(message)
      if (!value || value <= 0) {
        return `Não entendi muito bem 😅 Me diz o valor (ex: 15000)`
      }

      const goalCategory = user.employment_type // repurposed as goal_category

      if (goalCategory === 'reserva_emergencia') {
        // Salva renda e calcula reserva sugerida
        const suggestedGoal = value * 6
        const updates: Record<string, unknown> = { monthly_income: value, onboarding_step: 3 }

        if (isCouple && user.couple_id) {
          await supabase.from('users').update(updates).eq('couple_id', user.couple_id)
        } else {
          await supabase.from('users').update(updates).eq('phone', phone)
        }

        const formatted = suggestedGoal.toLocaleString('pt-BR')
        const who = isCouple ? 'na renda de vocês' : 'na sua renda'
        return (
          `Baseado ${who}, o valor ideal da reserva é *R$ ${formatted}*.\n\n` +
          `Quer usar esse valor ou prefere personalizar? (responda *usar* ou mande outro valor)`
        )
      }

      // Meta não-emergência: salva goal_amount e vai para step 4 (poupança mensal)
      const updates: Record<string, unknown> = {
        goal_amount: value,
        onboarding_step: 4,
      }

      if (isCouple && user.couple_id) {
        await supabase.from('users').update(updates).eq('couple_id', user.couple_id)
      } else {
        await supabase.from('users').update(updates).eq('phone', phone)
      }

      return isCouple
        ? `Anotado! 💪 E quanto vocês querem guardar por mês para chegar nessa meta? (ex: 500)`
        : `Anotado! 💪 E quanto você quer guardar por mês para chegar nessa meta? (ex: 500)`
    }

    // ── Step 3: Confirmação do valor sugerido (só reserva de emergência) ──────
    case 3: {
      const income = user.monthly_income ?? 0
      const suggestedGoal = income * 6

      const confirmation = await interpretGoalConfirmation(message, suggestedGoal)
      const finalGoal = confirmation.usarSugerido
        ? suggestedGoal
        : (confirmation.valorPersonalizado ?? suggestedGoal)

      const updates: Record<string, unknown> = {
        goal_amount: finalGoal,
        onboarding_step: 4,
      }

      if (isCouple && user.couple_id) {
        await supabase.from('users').update(updates).eq('couple_id', user.couple_id)
      } else {
        await supabase.from('users').update(updates).eq('phone', phone)
      }

      return isCouple
        ? `Perfeito! 💪 E quanto vocês querem guardar por mês para construir essa reserva? (ex: 500)`
        : `Perfeito! 💪 E quanto você quer guardar por mês para construir essa reserva? (ex: 500)`
    }

    // ── Step 4: Meta de poupança mensal ──────────────────────────────────────
    case 4: {
      const value = await interpretMoneyValue(message)
      if (!value || value <= 0) {
        return isCouple
          ? `Não entendi 😅 Quanto vocês querem guardar por mês? (ex: 500)`
          : `Não entendi 😅 Quanto você quer guardar por mês? (ex: 500)`
      }

      const updates: Record<string, unknown> = {
        monthly_savings_goal: value,
        onboarding_step: 5,
        onboarding_completed: true,
      }

      if (isCouple && user.couple_id) {
        await supabase.from('users').update(updates).eq('couple_id', user.couple_id)
      } else {
        await supabase.from('users').update(updates).eq('phone', phone)
      }

      const nick = user.nickname ?? user.name ?? 'você'
      const goalDesc = user.goal_description ?? 'sua meta'
      const goalAmount = user.goal_amount ?? value
      return conclusionMessage(nick, goalDesc, goalAmount, isCouple)
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
