import Anthropic from '@anthropic-ai/sdk'

const getAnthropic = () => new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const FINANCE_SYSTEM_PROMPT = `Você é o Finn, assistente financeiro de casais no WhatsApp. Você é direto, simpático e usa emojis com moderação.

AÇÕES DE PERFIL — detecte a intenção do usuário e use o tipo correto:
• Se quiser VER o perfil (ex: "me mostra meu perfil", "quais meus dados") → tipo: "ver_perfil"
• Se quiser EDITAR um campo (ex: "quero mudar minha renda", "editar perfil") → tipo: "editar_perfil"
• Se quiser RESETAR/REFAZER do zero (ex: "quero recomeçar", "zera meu perfil", "refazer cadastro") → tipo: "resetar_perfil"


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
  "tipo": "gasto" | "receita" | "consulta" | "ver_perfil" | "editar_perfil" | "resetar_perfil" | "outro",
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

const ONBOARDING_NEXT_QUESTIONS_INDIVIDUAL: Record<number, string> = {
  1: 'qual é a renda mensal aproximada — explique brevemente que a info é segura e serve para personalizar a experiência; mencione que se a renda for variável, pode compartilhar mês a mês; peça só o número (ex: 5000)',
  2: 'qual dia do mês costuma receber o salário ou pagamento (ex: 5, 10, 25)',
  3: 'se recebe algum bônus ou 13º anual (peça para responder: sim ou não)',
  4: 'qual é a maior meta financeira pessoal agora (ex: reserva de emergência, viagem, casa própria)',
  5: 'qual o valor aproximado dessa meta (peça só o número, ex: 10000)',
}

const ONBOARDING_NEXT_QUESTIONS_CASAL: Record<number, string> = {
  1: 'qual é a renda mensal aproximada — reforce que cada um informa a própria renda separado e que os dados são seguros; mencione renda variável; peça só o número (ex: 5000)',
  2: 'qual dia do mês costuma receber o salário ou pagamento (ex: 5, 10, 25)',
  3: 'se recebe algum bônus ou 13º anual (peça para responder: sim ou não)',
  4: 'qual é a maior meta financeira do casal agora (ex: viagem dos sonhos, casa própria, reserva de emergência)',
  5: 'qual o valor aproximado dessa meta do casal (peça só o número, ex: 50000)',
}

export async function generateOnboardingMessage(
  nextStep: number,
  context: {
    userName: string
    justAnswered: string
    savedLabel: string
    isCouple?: boolean
  }
): Promise<string> {
  const questions = context.isCouple
    ? ONBOARDING_NEXT_QUESTIONS_CASAL
    : ONBOARDING_NEXT_QUESTIONS_INDIVIDUAL
  const nextQuestion = questions[nextStep]
  if (!nextQuestion) return ''

  const modeContext = context.isCouple
    ? 'O usuário faz parte de um casal que se cadastrou junto. As perguntas devem ser contextualizadas para o casal.'
    : 'O usuário usa o Finn de forma individual.'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await getAnthropic().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: `Você é o Finn, assistente financeiro no WhatsApp.
${modeContext}
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

export async function interpretOnboardingAnswer(
  step: number,
  message: string
): Promise<{ value: string | number | boolean | null; display: string; valid: boolean }> {
  // Texto livre — sem Claude
  if (step === 0) {
    const v = message.trim()
    return { value: v, display: v, valid: v.length >= 1 }
  }
  if (step === 4) {
    const v = message.trim()
    return { value: v, display: v, valid: v.length >= 2 }
  }

  const stepContext: Record<number, { context: string; schema: string }> = {
    1: {
      context: 'O usuário informou sua renda mensal. Pode ser em linguagem natural (ex: "uns 5 mil", "ganho 3500 por mês", "em torno de 8k"). Extraia o valor numérico em reais.',
      schema: '{"value": <número ou null se não entendeu>, "display": "R$ X.XXX", "valid": <true se extraiu valor>}',
    },
    2: {
      context: 'O usuário informou o dia do mês que recebe salário/pagamento. Pode dizer "dia 5", "todo dia 10", "recebo no 15", "final do mês" (→ 30). Extraia apenas o número do dia (1-31).',
      schema: '{"value": <número 1-31 ou null>, "display": "dia X", "valid": <true se extraiu dia>}',
    },
    3: {
      context: 'O usuário respondeu se tem bônus ou 13º anual. Interprete qualquer forma de sim/não, ex: "tenho sim", "não tenho", "recebo PLR", "nada disso", "às vezes".',
      schema: '{"value": <true ou false>, "display": <"sim" ou "não">, "valid": true}',
    },
    5: {
      context: 'O usuário informou o valor da meta financeira. Pode ser "uns 20 mil", "50k", "cem mil", "100.000". Extraia o valor numérico em reais.',
      schema: '{"value": <número ou null se não entendeu>, "display": "R$ XX.XXX", "valid": <true se extraiu valor>}',
    },
  }

  const cfg = stepContext[step]
  if (!cfg) return { value: null, display: '', valid: false }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await getAnthropic().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        system: `${cfg.context}\nResponda APENAS JSON válido: ${cfg.schema}`,
        messages: [{ role: 'user', content: message }],
      },
      { signal: controller.signal }
    )

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return {
        value: parsed.value ?? null,
        display: parsed.display ?? String(parsed.value ?? ''),
        valid: parsed.valid ?? parsed.value !== null,
      }
    }
  } catch { /* fallback */ } finally {
    clearTimeout(timeout)
  }

  return { value: null, display: '', valid: false }
}

export async function interpretCoupleChoice(message: string): Promise<'sozinho' | 'casal'> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const response = await getAnthropic().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        system: 'O usuário responde se quer fazer o cadastro sozinho ou junto com o parceiro(a). Responda APENAS "sozinho" ou "casal".',
        messages: [{ role: 'user', content: message }],
      },
      { signal: controller.signal }
    )
    const text = response.content[0].type === 'text' ? response.content[0].text.trim().toLowerCase() : ''
    return text.includes('casal') ? 'casal' : 'sozinho'
  } catch {
    // Fallback: keywords
    const lower = message.trim().toLowerCase()
    const coupleWords = ['casal', 'junto', 'juntos', 'esposa', 'esposo', 'marido', 'mulher', 'namorad', 'companheiro', 'companheira', 'parceiro', 'parceira', 'dois', 'nós']
    return coupleWords.some(k => lower.includes(k)) ? 'casal' : 'sozinho'
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
