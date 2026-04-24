import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendTextMessage } from '@/lib/zapi'
import { processFinanceMessage } from '@/lib/claude'
import {
  User,
  getWelcomeMessage,
  processOnboardingStep,
  getEditMenu,
  processEditChoice,
  processEditValue,
  formatUserProfile,
  calculateFinancialScore,
} from '@/lib/onboarding'
import { insertUserMessage, insertAssistantMessage, saveAndSend, saveAndReply } from './messages'
import { TIPO } from '@/lib/constants'

// ── New User ──────────────────────────────────────────────────────────────────

interface NewUserContext {
  userPhone: string
  senderName: string
  message: string
  rawMessage: object
  replyTo: string
  isGroup: boolean
  groupId: string | null
}

export async function handleNewUser({
  userPhone, senderName, message, rawMessage, replyTo, isGroup, groupId,
}: NewUserContext): Promise<{ user: User | null; response: NextResponse | null }> {
  if (isGroup && groupId) {
    const { data: coupleData } = await supabase
      .from('couples')
      .select('*')
      .eq('group_id', groupId)
      .maybeSingle()

    if (!coupleData) {
      return { user: null, response: NextResponse.json({ status: 'ignored' }) }
    }

    const { data: existingPartner } = await supabase
      .from('users')
      .select('nickname, name')
      .eq('couple_id', coupleData.id)
      .neq('phone', userPhone)
      .maybeSingle()

    await supabase.from('users').insert({
      phone: userPhone,
      name: senderName,
      couple_id: coupleData.id,
      chat_mode: 'group',
      group_id: groupId,
      onboarding_step: 0,
      onboarding_completed: false,
    })

    const { data: newUser } = await supabase.from('users').select('*').eq('phone', userPhone).maybeSingle()

    const partnerName = existingPartner?.nickname ?? existingPartner?.name ?? 'seu parceiro(a)'
    const welcomeMsg =
      `Oi ${senderName}! 👋 Vejo que você está no grupo com *${partnerName}*.\n\n` +
      getWelcomeMessage(senderName, true)

    const response = await saveAndSend(
      userPhone, senderName, message, rawMessage, replyTo, welcomeMsg, 'boas-vindas'
    )
    return { user: newUser as User, response }
  }

  await supabase.from('users').insert({
    phone: userPhone,
    name: senderName,
    onboarding_step: -1,
    onboarding_completed: false,
    chat_mode: 'individual',
  })
  const { data: newUser } = await supabase.from('users').select('*').eq('phone', userPhone).maybeSingle()
  return { user: newUser as User, response: null }
}

// ── Editing ───────────────────────────────────────────────────────────────────

interface EditingContext {
  phone: string
  senderName: string
  message: string
  rawMessage: object
  replyTo: string
  editingField: string
}

export async function handleEditing({
  phone, senderName, message, rawMessage, replyTo, editingField,
}: EditingContext): Promise<NextResponse> {
  const editChoice = await processEditChoice(phone, message.trim())
  if (editChoice) {
    return saveAndSend(phone, senderName, message, rawMessage, replyTo, editChoice, 'resposta de edição')
  }

  const confirmation = await processEditValue(phone, message, editingField)
  return saveAndSend(phone, senderName, message, rawMessage, replyTo, confirmation, 'confirmação de edição')
}

// ── Onboarding ────────────────────────────────────────────────────────────────

interface OnboardingContext {
  phone: string
  senderName: string
  message: string
  rawMessage: object
  replyTo: string
  user: User
}

export async function handleOnboarding({
  phone, senderName, message, rawMessage, replyTo, user,
}: OnboardingContext): Promise<NextResponse> {
  if (user.onboarding_step === -1) {
    const welcomeMsg = getWelcomeMessage(user.name ?? senderName, !!user.couple_id)
    await supabase.from('users').update({ onboarding_step: 0 }).eq('phone', phone)
    return saveAndSend(phone, senderName, message, rawMessage, replyTo, welcomeMsg, 'mensagem de onboarding')
  }

  const nextMessage = await processOnboardingStep(phone, message, user)
  const inserted = await insertUserMessage(phone, senderName, message, rawMessage)
  if (!inserted) return NextResponse.json({ status: 'ignored_duplicate' })
  await insertAssistantMessage(phone, nextMessage, 'resposta de onboarding')

  const onboardingReplyTo = user.group_id ?? replyTo
  await sendTextMessage(onboardingReplyTo, nextMessage)
  return NextResponse.json({ status: 'ok' })
}

// ── Finance ───────────────────────────────────────────────────────────────────

interface FinanceContext {
  phone: string
  senderName: string
  message: string
  rawMessage: object
  replyTo: string
  user: User
}

export async function handleFinance({
  phone, senderName, message, rawMessage, replyTo, user,
}: FinanceContext): Promise<NextResponse> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [{ data: monthTransactions }, { data: history }] = await Promise.all([
    supabase
      .from('transactions')
      .select('valor')
      .eq('phone', phone)
      .eq('tipo', 'gasto')
      .gte('created_at', startOfMonth),
    supabase
      .from('messages')
      .select('role, content')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const totalGastoMes = (monthTransactions ?? []).reduce(
    (sum: number, t: { valor?: number }) => sum + (t.valor ?? 0),
    0
  )

  const chatHistory = (history ?? [])
    .reverse()
    .map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  const result = await processFinanceMessage(message, chatHistory, {
    senderName,
    coupleGoal: user.goal_description ?? undefined,
    coupleGoalAmount: user.goal_amount ?? undefined,
    monthlyIncome: user.monthly_income ?? undefined,
    monthlySavingsGoal: user.monthly_savings_goal ?? undefined,
    fixedExpenses: user.fixed_expenses ?? undefined,
    totalGastoMes,
    financialScore: user.financial_score ?? 50,
  })

  if (result.tipo === TIPO.VER_PERFIL) {
    const profile = formatUserProfile(user)
    return saveAndSend(phone, senderName, message, rawMessage, replyTo, profile, 'perfil formatado')
  }

  if (result.tipo === TIPO.EDITAR_PERFIL) {
    const menu = getEditMenu()
    return saveAndSend(phone, senderName, message, rawMessage, replyTo, menu, 'menu de edição')
  }

  if (result.tipo === TIPO.RESETAR_PERFIL) {
    await supabase.from('users').update({
      onboarding_completed: false,
      onboarding_step: 0,
      editing_field: null,
      nickname: null,
      monthly_income: null,
      monthly_savings_goal: null,
      financial_score: null,
      payment_day: null,
      has_bonus: null,
      goal_description: null,
      goal_amount: null,
      goal_category: null,
      fixed_expenses: null,
    }).eq('phone', phone)

    const welcomeMsg = getWelcomeMessage(user.name ?? senderName, !!user.couple_id)
    const fullMsg = `Perfil zerado! 🔄\n\n${welcomeMsg}`
    return saveAndSend(phone, senderName, message, rawMessage, replyTo, fullMsg, 'resposta de reset')
  }

  if (result.tipo === TIPO.SALVAR_RENDA && result.valor) {
    await supabase.from('users').update({ monthly_income: result.valor }).eq('phone', phone)
  }

  const saved = await saveAndReply(phone, replyTo, senderName, message, rawMessage, result)
  if (!saved) return NextResponse.json({ status: 'ignored_duplicate' })

  if (result.tipo === TIPO.GASTO && result.valor) {
    const newTotal = totalGastoMes + result.valor
    const newScore = calculateFinancialScore(user.monthly_income, user.monthly_savings_goal, newTotal)
    await supabase.from('users').update({ financial_score: newScore }).eq('phone', phone)
  }

  return NextResponse.json({ status: 'ok' })
}
