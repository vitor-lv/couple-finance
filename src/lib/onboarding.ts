import { supabase } from './supabase'

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
      // Salva nickname como veio (preserva capitalização original)
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
      // CLT avança para step 3 (bônus), PJ/variável pula para step 4
      if (empType !== 'clt') {
        nextStep = 4
      }
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
    return `Perfeito! Seu perfil está completo. 🎉\n\nAguardando seu parceiro(a) terminar o cadastro também...`
  }

  // Retorna a próxima pergunta, usando nickname se já foi salvo
  const displayName = (updates.nickname as string) ?? user.nickname ?? user.name ?? ''
  return getOnboardingMessage(nextStep, displayName)
}

export async function checkCoupleComplete(coupleId: string): Promise<{
  complete: boolean
  users?: User[]
}> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('couple_id', coupleId)

  if (!data || data.length < 2) return { complete: false }

  const allComplete = data.every((u: User) => u.onboarding_completed === true)
  if (!allComplete) return { complete: false }

  return { complete: true, users: data as User[] }
}
