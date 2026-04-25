import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { toFile } from 'openai/uploads'
import { isAllowedExternalUrl } from '@/lib/url-validation'
import { stripJsonLikeEnvelopeForWhatsApp } from '@/lib/whatsapp-sanitize'

const getAnthropic = () => new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Groq é compatível com a SDK da OpenAI e oferece Whisper gratuitamente
const getGroq = () => new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

const MAX_AUDIO_BYTES = 20 * 1024 * 1024 // 20MB

async function fetchAudioBufferWithLimit(audioUrl: string, signal: AbortSignal): Promise<Buffer | null> {
  const audioResponse = await fetch(audioUrl, { signal })
  if (!audioResponse.ok || !audioResponse.body) return null

  const contentLength = audioResponse.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_AUDIO_BYTES) return null

  const reader = audioResponse.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    totalBytes += value.byteLength
    if (totalBytes > MAX_AUDIO_BYTES) return null
    chunks.push(value)
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
}

export async function transcribeAudio(audioUrl: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    if (!isAllowedExternalUrl(audioUrl)) return null

    const audioBuffer = await fetchAudioBufferWithLimit(audioUrl, controller.signal)
    if (!audioBuffer) return null

    const file = await toFile(audioBuffer, 'audio.ogg', { type: 'audio/ogg' })

    const transcription = await getGroq().audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      language: 'pt',
    })

    return transcription.text?.trim() || null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ─── INTERPRETAÇÃO DO ONBOARDING ─────────────────────────────────────────────

export async function interpretNickname(message: string): Promise<string | null> {
  const trimmed = message.trim()
  if (!trimmed) return null

  // Palavra única curta sem espaços = provavelmente já é o apelido (ex: "LV", "Vitor", "Ju")
  const GREETINGS = /^(oi|olá|ola|eai|e aí|eaí|e ai|sim|não|nao|ok|tudo|pode|hey|boa|bom)$/i
  if (!trimmed.includes(' ') && trimmed.length <= 20 && !GREETINGS.test(trimmed)) {
    return trimmed
  }

  // Mensagem longa = usa Claude pra extrair o nome ("pode me chamar de Vitor ok?")
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await getAnthropic().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        system: 'O usuário informou como quer ser chamado. Extrai apenas o apelido ou nome. Aceita qualquer forma: nomes, apelidos, iniciais (ex: LV, JC), nomes compostos. Retorna só o nome sem pontuação extra. Se não conseguir identificar nenhum nome, retorna a palavra null.',
        messages: [{ role: 'user', content: trimmed }],
      },
      { signal: controller.signal }
    )
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    if (!text || text.toLowerCase() === 'null') return null
    return text
  } catch {
    return trimmed.split(' ')[0] // fallback: primeira palavra
  } finally {
    clearTimeout(timeout)
  }
}

export async function interpretGoal(message: string): Promise<{ categoria: string; descricao: string } | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await getAnthropic().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: `O usuário informou sua meta financeira. Classifica em uma das categorias: reserva_emergencia, viagem, casa_propria, casamento, outro. Extrai uma descrição curta e amigável em português.
Retorna APENAS JSON válido: {"categoria": string, "descricao": string}`,
        messages: [{ role: 'user', content: message }],
      },
      { signal: controller.signal }
    )
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function interpretMoneyValue(message: string): Promise<number | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await getAnthropic().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 30,
        system: 'Extrai o valor numérico da mensagem. Exemplos: "uns 15 mil" → 15000, "R$ 8.500,00" → 8500, "5k" → 5000, "cem mil" → 100000. Retorna APENAS o número sem texto. Se não conseguir, retorna 0.',
        messages: [{ role: 'user', content: message }],
      },
      { signal: controller.signal }
    )
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '0'
    const num = parseFloat(text.replace(/[^0-9.]/g, ''))
    return isNaN(num) || num <= 0 ? null : num
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function interpretGoalConfirmation(
  message: string,
  suggestedValue: number
): Promise<{ usarSugerido: boolean; valorPersonalizado: number | null }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await getAnthropic().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        system: `O usuário respondeu sobre aceitar ou personalizar o valor sugerido de R$ ${suggestedValue}. Decide se ele quer usar o valor sugerido ou um valor personalizado. Se personalizado, extrai o valor numérico.
Retorna APENAS JSON válido: {"usar_sugerido": boolean, "valor_personalizado": number | null}`,
        messages: [{ role: 'user', content: message }],
      },
      { signal: controller.signal }
    )
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return { usarSugerido: parsed.usar_sugerido ?? true, valorPersonalizado: parsed.valor_personalizado ?? null }
    }
    return { usarSugerido: true, valorPersonalizado: null }
  } catch {
    return { usarSugerido: true, valorPersonalizado: null }
  } finally {
    clearTimeout(timeout)
  }
}

// ─── FLUXO FINANCEIRO NORMAL ──────────────────────────────────────────────────

const FINANCE_SYSTEM_PROMPT = `Você é o Finn, assistente financeiro pessoal no WhatsApp. Você é direto, simpático e usa emojis com moderação.

AÇÕES DE PERFIL — detecte a intenção do usuário e use o tipo correto:
• Se quiser VER o perfil (ex: "me mostra meu perfil", "quais meus dados") → tipo: "ver_perfil"
• Se quiser EDITAR um campo (ex: "quero mudar minha renda", "editar perfil") → tipo: "editar_perfil"
• Se quiser RESETAR/REFAZER do zero (ex: "quero recomeçar do zero", "zera meu perfil", "refazer meu cadastro", "deletar meu perfil") → tipo: "resetar_perfil"
  ATENÇÃO: "resetar_perfil" é destrutivo — use APENAS com intenção explícita e inequívoca de apagar tudo. Nunca inferir de respostas curtas como "todos", "tudo", "sim" em outro contexto de conversa.

COLETA ORGÂNICA DE RENDA:
• Quando precisar da renda para dar um insight (ex: calcular % de gastos, sugerir limite), pergunte naturalmente:
  "Pra calcular isso melhor, quanto você ganha por mês? Pode ser aproximado 😊"
• Quando o usuário informar a renda espontaneamente (ex: "ganho 5000", "meu salário é 8k"), use tipo: "salvar_renda" com o valor

CAPACIDADES ESPECIAIS:
- Você consegue ler e interpretar imagens enviadas pelo usuário
- Quando receber uma imagem, analise automaticamente e extraia: valor, estabelecimento, data e categoria
- Nunca diga que não consegue ler imagens — você sempre consegue
- Se a imagem tiver múltiplas transações (ex: extrato, fatura), registre todas de uma vez

EDIÇÃO E EXCLUSÃO DE GASTOS:
- Quando o usuário quiser corrigir um gasto (ex: "corrige o mercado de 150 para 120", "mudei a categoria do uber para transporte") → tipo: "editar_gasto"
  Inclua "busca" com os dados para encontrar a transação (descricao e/ou valor_antigo e/ou data em formato YYYY-MM-DD) e "atualizacao" com os campos a mudar (valor, categoria, descricao)
- Quando o usuário quiser remover/deletar um gasto (ex: "remove o gasto do mercado", "deleta aquele uber de ontem") → tipo: "deletar_gasto"
  Inclua "busca" com os dados para encontrar a transação (descricao e/ou valor e/ou data em formato YYYY-MM-DD)
- Para ambos: se o usuário for vago (ex: "quero editar um gasto"), pergunte qual gasto com tipo: "consulta"

MÚLTIPLAS TRANSAÇÕES:
- Quando o usuário confirmar ou registrar múltiplos gastos/receitas de uma vez (ex: "registra ambos", "confirma os dois", "registra como X e Y"), use tipo: "multiplos_gastos"
- Nesse caso, inclua uma lista "transacoes" com cada item e um campo "resposta" resumindo tudo
- Quando o usuário pedir ajuste depois (ex: mudar categoria de um ou de vários itens da imagem, corrigir um dos dois), use "multiplos_gastos" com "transacoes" atualizada e UMA "resposta" curta em português — nunca duas estruturas JSON em sequência

FORMATO DA RESPOSTA AO USUÁRIO (CRÍTICO):
- Só o campo "resposta" vira mensagem no WhatsApp: português natural, breve, sem markdown, sem bloco JSON, sem repetir o objeto inteiro
- Nunca coloque JSON bruto dentro de "resposta" nem envie dois JSONs concatenados
- O histórico pode mostrar respostas anteriores do assistente como texto simples; imite esse estilo, nunca replicar o formato interno JSON para o usuário

CATEGORIAS: alimentação, transporte, moradia, saúde, lazer, educação, vestuário, assinaturas, outros

REGRAS:
- Seja breve nas confirmações de gasto (máx 2 linhas)
- Para consultas, seja mais detalhado e use formatação com emojis
- Sempre confirme o valor e categoria registrados
- Se o valor ou descrição não estiver claro, peça confirmação
- Nunca invente valores — use apenas dados do contexto
- Após registrar um gasto, mostre a margem restante do mês de forma simples e motivadora
- Se a margem estiver positiva e confortável: confirma o gasto e mostra quanto ainda sobra
- Se a margem estiver apertada (menos de 20% da renda): confirma o gasto e dá um alerta leve, sem drama
- Se a margem estiver negativa: confirma o gasto e avisa com cuidado que o limite do mês foi ultrapassado
- Nunca mencione a meta de poupança como algo que o usuário "perdeu" — seja encorajador
- Só entre em detalhes sobre a meta se o usuário perguntar explicitamente

Responda APENAS em JSON válido, sem markdown:
{
  "tipo": "gasto" | "receita" | "consulta" | "ver_perfil" | "editar_perfil" | "resetar_perfil" | "salvar_renda" | "multiplos_gastos" | "editar_gasto" | "deletar_gasto" | "outro",
  "valor": number | null,
  "categoria": string | null,
  "descricao": string,
  "data": string | null,
  "resposta": string,
  "transacoes": [{"tipo": "gasto"|"receita", "valor": number, "categoria": string, "descricao": string, "data": string|null}] | null,
  "busca": {"descricao": string | null, "valor_antigo": number | null, "data": string | null} | null,
  "atualizacao": {"valor": number | null, "categoria": string | null, "descricao": string | null} | null
}`

type TransacaoItem = {
  tipo: string
  valor: number | null
  categoria: string | null
  descricao: string
  data: string | null
}

export type FinanceResult = {
  tipo: string
  valor?: number | null
  categoria?: string | null
  descricao?: string
  data?: string | null
  resposta: string
  transacoes?: TransacaoItem[] | null
  busca?: { descricao?: string | null; valor_antigo?: number | null; data?: string | null } | null
  atualizacao?: { valor?: number | null; categoria?: string | null; descricao?: string | null } | null
}

function extractFirstJson(text: string): FinanceResult | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)) } catch { return null }
      }
    }
  }
  return null
}

function parseFinanceResponse(text: string, fallbackContent: string): FinanceResult {
  const parsed = extractFirstJson(text)
  if (parsed) {
    const rawResposta = typeof parsed.resposta === 'string' ? parsed.resposta : ''
    return {
      ...parsed,
      resposta: stripJsonLikeEnvelopeForWhatsApp(rawResposta),
    }
  }
  return {
    tipo: 'outro',
    valor: null,
    categoria: null,
    descricao: fallbackContent,
    data: null,
    resposta: stripJsonLikeEnvelopeForWhatsApp(text),
    transacoes: null,
  }
}

/** Evita que JSON bruto salvo no histórico ensine o modelo a repetir JSON no WhatsApp. */
function sanitizeAssistantFinanceHistoryContent(content: string): string {
  return stripJsonLikeEnvelopeForWhatsApp(content)
}

function sanitizeFinanceChatHistory(
  history: { role: 'user' | 'assistant'; content: string }[]
): { role: 'user' | 'assistant'; content: string }[] {
  return history.map((m) =>
    m.role === 'assistant'
      ? { ...m, content: sanitizeAssistantFinanceHistoryContent(m.content) }
      : m
  )
}

export async function processFinanceMessage(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  context?: {
    senderName?: string
    coupleGoal?: string
    coupleGoalAmount?: number
    financialScore?: number
    monthlyIncome?: number
    monthlySavingsGoal?: number
    fixedExpenses?: number
    totalGastoMes?: number
  }
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const safeHistory = sanitizeFinanceChatHistory(history)

    const response = await getAnthropic().messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `${FINANCE_SYSTEM_PROMPT}

CONTEXTO:
- Quem está falando: ${context?.senderName || 'usuário'}
- Renda mensal: R$ ${context?.monthlyIncome || 0}
- Gastos fixos mensais: R$ ${context?.fixedExpenses || 0}
- Meta de poupança: R$ ${context?.monthlySavingsGoal || 0}/mês
- Gasto total esse mês: R$ ${context?.totalGastoMes || 0}
- Margem restante: R$ ${((context?.monthlyIncome || 0) - (context?.fixedExpenses || 0) - (context?.totalGastoMes || 0) - (context?.monthlySavingsGoal || 0)).toFixed(0)}
- Score financeiro atual: ${context?.financialScore ?? 50}/100
- Meta financeira: ${context?.coupleGoal || 'não definida'}
- Valor da meta: R$ ${context?.coupleGoalAmount || 0}`,
        messages: [
          ...safeHistory,
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

export async function interpretEditValue(
  field: string,
  rawValue: string
): Promise<{ value: unknown; display: string }> {
  if (field === 'nickname' || field === 'goal_description') {
    const v = rawValue.trim()
    return { value: v, display: v }
  }
  if (field === 'payment_day') {
    const day = parseInt(rawValue.replace(/\D/g, ''), 10)
    if (!isNaN(day) && day >= 1 && day <= 31) return { value: day, display: `dia ${day}` }
    return { value: null, display: '' }
  }

  // Campos numéricos — Claude interpreta linguagem natural
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
O campo "resposta" deve ser texto legível para WhatsApp, nunca JSON bruto nem dois objetos em sequência.
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
