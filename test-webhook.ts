import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

async function processFinanceMessage(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  context?: {
    senderName?: string
    coupleGoal?: string
    coupleGoalAmount?: number
    financialScore?: number
  }
) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `Você é o Finn, assistente financeiro de casais no WhatsApp. Você é direto, simpático e usa emojis com moderação.

CONTEXTO DO CASAL:
- Quem está falando: ${context?.senderName || 'usuário'}
- Meta atual: ${context?.coupleGoal || 'não definida'} (R$ ${context?.coupleGoalAmount || 0})
- Score financeiro: ${context?.financialScore || 0}/100

COMANDOS:
- Mensagens começando com "g" = registrar gasto (ex: "g 50 mercado" = gasto de R$50 no mercado)
- Mensagens começando com "r" = registrar receita (ex: "r 3000 salário")
- Mensagens começando com "?" = consulta (ex: "? resumo da semana", "? quanto gastamos esse mês")
- Outros = conversa normal sobre finanças

CATEGORIAS: alimentação, transporte, moradia, saúde, lazer, educação, vestuário, assinaturas, outros

REGRAS:
- Seja breve nas confirmações de gasto (máx 2 linhas)
- Para consultas, seja mais detalhado e use formatação com emojis
- Sempre confirme o valor e categoria registrados
- Se o valor ou descrição não estiver claro, peça confirmação
- Use o nome da pessoa quando souber

Responda APENAS em JSON válido, sem markdown:
{
  "tipo": "gasto" | "receita" | "consulta" | "outro",
  "valor": number | null,
  "categoria": string | null,
  "descricao": string,
  "data": string | null,
  "resposta": string
}`,
    messages: [
      ...history,
      { role: 'user', content: message },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {
    // fallback
  }

  return {
    tipo: 'outro',
    valor: null,
    categoria: null,
    descricao: message,
    data: null,
    resposta: text,
  }
}

const messages = [
  'g 50 mercado',
  'g 120 restaurante',
  '? resumo',
]

async function runTests() {
  console.log('🧪 Testando processFinanceMessage...\n')

  for (const msg of messages) {
    console.log(`📨 Mensagem: "${msg}"`)
    const result = await processFinanceMessage(msg, [], { senderName: 'Vitor' })
    console.log('📦 Resultado:', JSON.stringify(result, null, 2))
    console.log('💬 Resposta:', result.resposta)
    console.log('─'.repeat(50))
  }
}

runTests().catch(console.error)
