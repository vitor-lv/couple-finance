import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function processFinanceMessage(message: string, history: { role: 'user' | 'assistant'; content: string }[] = []) {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: `Você é um assistente financeiro para casais. Ajuda a registrar e acompanhar gastos, receitas e metas financeiras do casal.

Quando o usuário enviar uma mensagem sobre finanças, extraia as informações e responda em JSON com o formato:
{
  "tipo": "gasto" | "receita" | "consulta" | "outro",
  "valor": number | null,
  "categoria": string | null,
  "descricao": string,
  "data": string | null,
  "resposta": string (mensagem amigável para o usuário)
}

Categorias comuns: alimentação, transporte, moradia, saúde, lazer, educação, vestuário, outros.`,
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
    // fallback se não conseguir parsear
  }

  return { tipo: 'outro', valor: null, categoria: null, descricao: message, data: null, resposta: text }
}
