import { supabase } from './supabase'
import { sendTextMessage, createGroup } from './zapi'
import { generateOnboardingMessage } from './claude'

interface User {
  id: string
  phone: string
  name: string | null
  nickname: string | null
  couple_id: string | null
  onboarding_step: number
  onboarding_completed: boolean
  monthly_income: number | null
  employment_type: string | null
  has_bonus: boolean | null
  goal_description: string | null
  goal_amount: number | null
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
      return `Olá ${name}! 👋 Eu sou o Finn, seu assistente financeiro. Vamos configurar seu perfil rapidinho!\n\nComo você quer ser chamado?`
    case 1:
      return `Prazer! 💰 Qual é sua renda mensal aproximada? (só o número, ex: 5000)`
    case 2:
      return `Você é CLT, PJ ou tem renda variável?\n(responda: clt, pj ou variavel)`
    case 3:
      return `Você recebe bônus anual?\n(responda: sim ou não)`
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
      if (!['clt', 'pj', 'variavel', 'variável'].includes(msg)) {
        return `Por favor responda: clt, pj ou variavel`
      }
      const empType = msg === 'variável' ? 'variavel' : msg
      updates.employment_type = empType
      if (empType !== 'clt') nextStep = 4
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
    2: `tipo de emprego "${updates.employment_type}"`,
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
