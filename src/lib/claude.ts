import Anthropic from '@anthropic-ai/sdk'

const getAnthropic = () => new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const FINANCE_SYSTEM_PROMPT = `Você é o Finn, assistente financeiro de casais no WhatsApp. Você é direto, simpático e usa emojis com moderação.

COMANDOS ESPECIAIS (informe o usuário quando relevante):
• !meu perfil → ver seu perfil completo
• !editar perfil → editar um campo do perfil
• !resetar perfil → refazer o perfil do zero
Se o usuário perguntar como refazer ou resetar o perfil, instrua-o a enviar: !resetar perfil


CAPACIDADES ESPECIAIS:
- Você consegue ler e interpretar imagens enviadas pelo usuário
- Quando receber uma imagem, analise automaticamente e extraia: valor, estabelecimento, data e categoria
- Nunca diga que não consegue ler imagens — você sempre consegue
- Se a imagem tiver múltiplas transações (ex: extrato, fatura), registre todas de uma vez
- Confirme cada transação extraída de forma clara

CATEGORIAS: alimentação, transporte, moradia, saúde, lazer, educação, vestuário, assinaturas, outros

REGRAS:
- Seja breve nas confirmações de gasto (máx 2 linhas)
- Para consultas, seja mais detalhado e use formatação com emojis
- Sempre confirme o valor e categoria registrados
- Se o valor ou descrição não estiver claro, peça confirmação

Responda APENAS em JSON válido, sem markdown:
{
  "tipo": "gasto" | "receita" | "consulta" | "outro",
  "valor": number | null,
  "categoria": string | null,
  "descricao": string,
  "data": string | null,
  "resposta": string
}`

function parseFinanceResponse(text: string, fallbackContent: string) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
  } catch {
    // fallback
  }
  return {
    tipo: 'outro',
    valor: null,
    categoria: null,
    descricao: fallbackContent,
    data: null,
    resposta: text,
  }
}

export async function processFinanceMessage(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  context?: {
    senderName?: string
    coupleGoal?: string
    coupleGoalAmount?: number
    financialScore?: number
  }
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await getAnthropic().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `${FINANCE_SYSTEM_PROMPT}

CONTEXTO DO CASAL:
- Quem está falando: ${context?.senderName || 'usuário'}
- Meta atual: ${context?.coupleGoal || 'não definida'} (R$ ${context?.coupleGoalAmount || 0})
- Score financeiro: ${context?.financialScore || 0}/100

COMANDOS:
- Mensagens começando com "g" = registrar gasto (ex: "g 50 mercado" = gasto de R$50 no mercado)
- Mensagens começando com "r" = registrar receita (ex: "r 3000 salário")
- Mensagens começando com "?" = consulta (ex: "? resumo da semana", "? quanto gastamos esse mês")
- Outros = conversa normal sobre finanças`,
        messages: [
          ...history,
          { role: 'user', content: message },
        ],
      },
      { signal: controller.signal }
    )

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return parseFinanceResponse(text, message)
  } finally {
    clearTimeout(timeout)
  }
}

const ONBOARDING_NEXT_QUESTIONS: Record<number, string> = {
  1: 'qual é a renda mensal aproximada — explique brevemente que a info é segura e serve para personalizar a experiência; mencione que se a renda for variável, pode compartilhar mês a mês; peça só o número (ex: 5000)',
  2: 'qual dia do mês costuma receber o salário ou pagamento (ex: 5, 10, 25) — explique que isso ajuda a calcular estimativas e projeções',
  3: 'se recebe algum bônus ou 13º anual (peça para responder: sim ou não)',
  4: 'qual é a maior meta financeira agora (ex: reserva de emergência, viagem, casa própria)',
  5: 'qual o valor aproximado dessa meta (peça só o número, ex: 10000)',
}

export async function generateOnboardingMessage(
  nextStep: number,
  context: {
    userName: string
    justAnswered: string
    savedLabel: string
  }
): Promise<string> {
  const nextQuestion = ONBOARDING_NEXT_QUESTIONS[nextStep]
  if (!nextQuestion) return ''

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await getAnthropic().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: `Você é o Finn, assistente financeiro de casais no WhatsApp.
Você está fazendo o onboarding de um novo usuário.
Seja caloroso, casual e direto. Máximo 2 linhas.
Use emojis com moderação (máx 1).
Responda APENAS com a mensagem, sem markdown, sem explicações extras.`,
        messages: [
          {
            role: 'user',
            content: `O usuário se chama ${context.userName} e acabou de responder: "${context.justAnswered}" (salvei como: ${context.savedLabel}).
Agora pergunte de forma natural: ${nextQuestion}.`,
          },
        ],
      },
      { signal: controller.signal }
    )

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    return text || ''
  } catch {
    return ''
  } finally {
    clearTimeout(timeout)
  }
}

export async function interpretEditValue(
  field: string,
  rawValue: string
): Promise<{ value: unknown; display: string }> {
  // Campos simples — sem Claude
  if (field === 'nickname' || field === 'goal_description') {
    const v = rawValue.trim()
    return { value: v, display: v }
  }
  if (field === 'has_bonus') {
    const lower = rawValue.trim().toLowerCase()
    const yes = ['sim', 's', 'yes', 'y'].includes(lower)
    return { value: yes, display: yes ? 'sim' : 'não' }
  }
  if (field === 'payment_day') {
    const day = parseInt(rawValue.replace(/\D/g, ''), 10)
    if (!isNaN(day) && day >= 1 && day <= 31) return { value: day, display: `dia ${day}` }
    return { value: null, display: '' }
  }

  // Campos numéricos (monthly_income, goal_amount, fixed_expenses) — Claude interpreta linguagem natural
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await getAnthropic().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        system: 'Extraia um valor numérico da mensagem. Responda APENAS JSON válido: {"value": number, "display": "string formatada em reais"}',
        messages: [{ role: 'user', content: rawValue }],
      },
      { signal: controller.signal }
    )
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (parsed.value) return { value: parsed.value, display: parsed.display ?? `R$ ${parsed.value}` }
    }
  } catch { /* fallback */ } finally {
    clearTimeout(timeout)
  }

  const num = parseFloat(rawValue.replace(/[^\d.,]/g, '').replace(',', '.'))
  if (!isNaN(num)) return { value: num, display: `R$ ${num.toLocaleString('pt-BR')}` }
  return { value: null, display: '' }
}

export async function processFinanceImage(imageBase64: string, caption?: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await getAnthropic().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `${FINANCE_SYSTEM_PROMPT}

Você está analisando uma imagem enviada pelo usuário (comprovante, nota fiscal, recibo, extrato, fatura, etc).
Extraia SEMPRE os dados financeiros visíveis: valor total, estabelecimento/descrição, categoria e data.
Se houver legenda (caption) do usuário, use como contexto adicional.
Se a imagem contiver múltiplas transações, liste todas no campo "resposta" e registre o valor total no campo "valor".
Nunca diga que não consegue ler a imagem — extraia o máximo de informação possível.`,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: caption
                  ? `Legenda do usuário: "${caption}". Extraia os dados financeiros desta imagem.`
                  : 'Extraia os dados financeiros desta imagem (comprovante, nota fiscal, recibo, etc).',
              },
            ],
          },
        ],
      },
      { signal: controller.signal }
    )

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return parseFinanceResponse(text, caption || '[imagem]')
  } finally {
    clearTimeout(timeout)
  }
}
