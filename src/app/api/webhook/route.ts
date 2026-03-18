import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { processFinanceMessage, processFinanceImage } from '@/lib/claude'
import { sendTextMessage, sendTyping } from '@/lib/zapi'
import {
  getOnboardingMessage,
  processOnboardingStep,
  checkCoupleComplete,
  handleCoupleComplete,
  getEditMenu,
  processEditChoice,
  processEditValue,
  formatUserProfile,
} from '@/lib/onboarding'

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
  image?: {
    imageUrl: string
    caption?: string
  }
  type: string
  chatName: string
}

async function saveAndReply(
  phone: string,
  senderName: string,
  userContent: string,
  rawMessage: object,
  result: {
    tipo: string
    valor?: number | null
    categoria?: string | null
    descricao?: string
    data?: string | null
    resposta: string
  }
) {
  await supabase.from('messages').insert({
    phone,
    sender_name: senderName,
    role: 'user',
    content: userContent,
    raw_message: rawMessage,
  })

  await supabase.from('messages').insert({
    phone,
    sender_name: 'assistant',
    role: 'assistant',
    content: result.resposta,
  })

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

  await sendTextMessage(phone, result.resposta)
}

export async function POST(request: NextRequest) {
  try {
    // Validação do token Z-API (crítico)
    const zapiToken = request.headers.get('z-api-token')
    if (zapiToken !== process.env.ZAPI_TOKEN) {
      return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
    }

    const body: ZAPIMessage = await request.json()

    // Ignorar mensagens enviadas pelo próprio bot
    if (body.fromMe) {
      return NextResponse.json({ status: 'ignored' })
    }

    const phone = body.phone
    const senderName = body.senderName
    const rawMessage = { phone: body.phone, type: body.type, keyId: body.keyId }

    // Rate limiting: máx 20 mensagens por minuto por número
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('phone', phone)
      .eq('role', 'user')
      .gte('created_at', oneMinuteAgo)

    if ((count ?? 0) >= 20) {
      console.error(`Rate limit atingido para ${phone}: ${count} msgs/min`)
      return NextResponse.json({ status: 'rate_limited' })
    }

    // Feedback visual de digitando
    await sendTyping(phone)

    // Processar imagem
    if (body.type === 'ReceivedCallback' && body.image?.imageUrl) {
      await sendTextMessage(phone, '🔍 Analisando sua imagem...')

      const imageResponse = await fetch(body.image.imageUrl)
      if (!imageResponse.ok) {
        return NextResponse.json({ status: 'error', message: 'Failed to fetch image' }, { status: 500 })
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const imageBase64 = Buffer.from(imageBuffer).toString('base64')

      const result = await processFinanceImage(imageBase64, body.image.caption)
      await saveAndReply(phone, senderName, body.image.caption || '[imagem]', rawMessage, result)

      return NextResponse.json({ status: 'ok' })
    }

    // Processar texto
    if (body.type !== 'ReceivedCallback' || !body.text?.message) {
      return NextResponse.json({ status: 'ignored' })
    }

    const message = body.text.message

    // Limite de tamanho da mensagem
    if (message.length > 1000) {
      return NextResponse.json({ status: 'ignored' })
    }

    // Busca o user pelo phone
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle()

    const cmd = message.trim().toLowerCase()

    // --- 1. COMANDOS ESPECIAIS ---
    if (cmd === '!editar perfil') {
      const menu = getEditMenu()
      await supabase.from('messages').insert([
        { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
        { phone, sender_name: 'assistant', role: 'assistant', content: menu },
      ])
      await sendTextMessage(phone, menu)
      return NextResponse.json({ status: 'ok' })
    }

    if (cmd === '!meu perfil' && user) {
      const profile = formatUserProfile(user)
      await supabase.from('messages').insert([
        { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
        { phone, sender_name: 'assistant', role: 'assistant', content: profile },
      ])
      await sendTextMessage(phone, profile)
      return NextResponse.json({ status: 'ok' })
    }

    if ((cmd === '!resetar perfil' || cmd === '!refazer perfil' || cmd === '!reset perfil') && user) {
      await supabase.from('users').update({
        onboarding_completed: false,
        onboarding_step: 0,
        editing_field: null,
        nickname: null,
        monthly_income: null,
        payment_day: null,
        has_bonus: null,
        goal_description: null,
        goal_amount: null,
        fixed_expenses: null,
      }).eq('phone', phone)
      const resetMsg = `Perfil resetado! Vamos começar do zero. 🔄\n\n` + getOnboardingMessage(0, user.name ?? '')
      await supabase.from('messages').insert([
        { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
        { phone, sender_name: 'assistant', role: 'assistant', content: resetMsg },
      ])
      await sendTextMessage(phone, resetMsg)
      return NextResponse.json({ status: 'ok' })
    }

    // --- 2. MODO DE EDIÇÃO ---
    if (user?.editing_field) {
      // Se for número de 1-7, o usuário pode estar escolhendo outro campo
      const editChoice = await processEditChoice(phone, message.trim())
      if (editChoice) {
        await supabase.from('messages').insert([
          { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
          { phone, sender_name: 'assistant', role: 'assistant', content: editChoice },
        ])
        await sendTextMessage(phone, editChoice)
        return NextResponse.json({ status: 'ok' })
      }

      const confirmation = await processEditValue(phone, message, user.editing_field)
      await supabase.from('messages').insert([
        { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
        { phone, sender_name: 'assistant', role: 'assistant', content: confirmation },
      ])
      await sendTextMessage(phone, confirmation)
      return NextResponse.json({ status: 'ok' })
    }

    // --- 3. ONBOARDING ---
    if (user && user.onboarding_completed === false) {
      // Se step 0 e ainda não enviamos nenhuma mensagem → manda boas-vindas sem processar a msg atual
      if (user.onboarding_step === 0) {
        const { count: msgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('phone', phone)
          .eq('role', 'assistant')

        if ((msgCount ?? 0) === 0) {
          const welcomeMsg = getOnboardingMessage(0, user.name ?? '')
          await supabase.from('messages').insert([
            { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
            { phone, sender_name: 'assistant', role: 'assistant', content: welcomeMsg },
          ])
          await sendTextMessage(phone, welcomeMsg)
          return NextResponse.json({ status: 'ok' })
        }
      }

      // Processa a resposta do step atual e retorna próxima pergunta
      const nextMessage = await processOnboardingStep(phone, message, user)

      await supabase.from('messages').insert([
        { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
        { phone, sender_name: 'assistant', role: 'assistant', content: nextMessage },
      ])
      await sendTextMessage(phone, nextMessage)

      // Verifica se o casal inteiro completou o onboarding
      if (user.couple_id) {
        const { complete, users: coupleUsers, couple } = await checkCoupleComplete(user.couple_id)
        if (complete && coupleUsers && couple) {
          await handleCoupleComplete(coupleUsers, couple)
        }
      }

      return NextResponse.json({ status: 'ok' })
    }

    // --- FLUXO NORMAL (onboarding completo ou user não encontrado) ---

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

    const result = await processFinanceMessage(message, chatHistory)
    await saveAndReply(phone, senderName, message, rawMessage, result)

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Webhook error:', message)
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 })
  }
}

// Z-API também faz GET para validar o webhook
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'couple-finance webhook' })
}
