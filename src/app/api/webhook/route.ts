import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { processFinanceMessage } from '@/lib/claude'
import { sendTextMessage } from '@/lib/zapi'

// Estrutura da mensagem Z-API
interface ZAPIMessage {
  phone: string
  fromMe: boolean
  momentsAgo: boolean
  keyId: string
  senderName: string
  text?: {
    message: string
  }
  type: string
  chatName: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ZAPIMessage = await request.json()

    // Ignorar mensagens enviadas pelo próprio bot
    if (body.fromMe) {
      return NextResponse.json({ status: 'ignored' })
    }

    // Apenas processar mensagens de texto
    if (body.type !== 'ReceivedCallback' || !body.text?.message) {
      return NextResponse.json({ status: 'ignored' })
    }

    const phone = body.phone
    const message = body.text.message
    const senderName = body.senderName

    // Buscar histórico recente da conversa (últimas 10 mensagens)
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(10)

    const chatHistory = (history ?? [])
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // Processar com Claude
    const result = await processFinanceMessage(message, chatHistory)

    // Salvar mensagem do usuário
    await supabase.from('messages').insert({
      phone,
      sender_name: senderName,
      role: 'user',
      content: message,
      raw_message: body,
    })

    // Salvar resposta do assistente
    await supabase.from('messages').insert({
      phone,
      sender_name: 'assistant',
      role: 'assistant',
      content: result.resposta,
    })

    // Se for um gasto ou receita, salvar na tabela de transações
    if ((result.tipo === 'gasto' || result.tipo === 'receita') && result.valor) {
      await supabase.from('transactions').insert({
        phone,
        sender_name: senderName,
        tipo: result.tipo,
        valor: result.valor,
        categoria: result.categoria,
        descricao: result.descricao,
        data: result.data ?? new Date().toISOString().split('T')[0],
      })
    }

    // Enviar resposta de volta pelo WhatsApp
    await sendTextMessage(phone, result.resposta)

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 })
  }
}

// Z-API também faz GET para validar o webhook
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'couple-finance webhook' })
}
