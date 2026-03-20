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
  isGroup?: boolean
  participantPhone?: string
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
      tipo:      result.tipo,
      valor:     result.valor,
      categoria: result.categoria,
      descricao: result.descricao,
      data:      result.data ?? new Date().toISOString().split('T')[0],
      // espelha nas colunas do schema original
      amount:      result.valor,
      category:    result.categoria,
      description: result.descricao,
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

    // Grupo: phone = groupId, participantPhone = quem enviou
    const isGroup = body.isGroup === true
    const groupId = isGroup ? body.phone : null
    const userPhone = isGroup ? (body.participantPhone ?? body.phone) : body.phone
    const replyTo = isGroup ? body.phone : body.phone // sempre reply para o "phone" do body
    const senderName = body.senderName
    const rawMessage = { phone: userPhone, type: body.type, keyId: body.keyId }

    // Rate limiting por número individual (não pelo grupo)
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('phone', userPhone)
      .eq('role', 'user')
      .gte('created_at', oneMinuteAgo)

    if ((count ?? 0) >= 20) {
      console.error(`Rate limit atingido para ${userPhone}: ${count} msgs/min`)
      return NextResponse.json({ status: 'rate_limited' })
    }

    // Feedback visual de digitando
    await sendTyping(replyTo)

    // Processar imagem
    if (body.type === 'ReceivedCallback' && body.image?.imageUrl) {
      await sendTextMessage(replyTo, '🔍 Analisando sua imagem...')

      const imageResponse = await fetch(body.image.imageUrl)
      if (!imageResponse.ok) {
        return NextResponse.json({ status: 'error', message: 'Failed to fetch image' }, { status: 500 })
      }

      const imageBuffer = await imageResponse.arrayBuffer()
      const imageBase64 = Buffer.from(imageBuffer).toString('base64')

      const result = await processFinanceImage(imageBase64, body.image.caption)
      await saveAndReply(replyTo, senderName, body.image.caption || '[imagem]', rawMessage, result)

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

    // Busca o user pelo telefone individual (não pelo groupId)
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone', userPhone)
      .maybeSingle()

    // ── USUÁRIO NÃO CADASTRADO ─────────────────────────────────────────────────
    if (!user) {
      if (isGroup && groupId) {
        // Fluxo C: parceiro entra no grupo sem cadastro
        const { data: coupleData } = await supabase
          .from('couples')
          .select('*')
          .eq('group_id', groupId)
          .maybeSingle()

        if (coupleData) {
          // Busca o outro membro do casal para saber o nome
          const { data: existingPartner } = await supabase
            .from('users')
            .select('nickname, name')
            .eq('couple_id', coupleData.id)
            .neq('phone', userPhone)
            .maybeSingle()

          // Cria o novo usuário vinculado ao casal
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
          user = newUser

          const partnerName = existingPartner?.nickname ?? existingPartner?.name ?? 'seu parceiro(a)'
          const welcomeMsg =
            `Oi ${senderName}! 👋 Vejo que você está no grupo com *${partnerName}*.\n\n` +
            getOnboardingMessage(0, senderName)

          await supabase.from('messages').insert([
            { phone: userPhone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
            { phone: userPhone, sender_name: 'assistant', role: 'assistant', content: welcomeMsg },
          ])
          await sendTextMessage(replyTo, welcomeMsg)
          return NextResponse.json({ status: 'ok' })
        }
        // Grupo desconhecido — ignora
        return NextResponse.json({ status: 'ignored' })
      } else {
        // Fluxo B: usuário novo, mensagem individual — inicia onboarding do zero
        await supabase.from('users').insert({
          phone: userPhone,
          name: senderName,
          onboarding_step: -1,
          onboarding_completed: false,
          chat_mode: 'individual',
        })

        const { data: newUser } = await supabase.from('users').select('*').eq('phone', userPhone).maybeSingle()
        user = newUser

        const welcomeMsg = getOnboardingMessage(-1, senderName)
        await supabase.from('messages').insert([
          { phone: userPhone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
          { phone: userPhone, sender_name: 'assistant', role: 'assistant', content: welcomeMsg },
        ])
        await sendTextMessage(replyTo, welcomeMsg)
        return NextResponse.json({ status: 'ok' })
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    // A partir daqui, user existe. Usa o userPhone para operações de DB
    const phone = userPhone

    // --- 1. MODO DE EDIÇÃO (checagem antes do Claude para não interferir) ---

    if (user?.editing_field) {
      // Se for número de 1-7, o usuário pode estar escolhendo outro campo
      const editChoice = await processEditChoice(phone, message.trim())
      if (editChoice) {
        await supabase.from('messages').insert([
          { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
          { phone, sender_name: 'assistant', role: 'assistant', content: editChoice },
        ])
        await sendTextMessage(replyTo, editChoice)
        return NextResponse.json({ status: 'ok' })
      }

      const confirmation = await processEditValue(phone, message, user.editing_field)
      await supabase.from('messages').insert([
        { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
        { phone, sender_name: 'assistant', role: 'assistant', content: confirmation },
      ])
      await sendTextMessage(replyTo, confirmation)
      return NextResponse.json({ status: 'ok' })
    }

    // --- 2. ONBOARDING ---
    if (user && user.onboarding_completed === false) {
      // Se está no step 0 e ainda não tem nickname → verifica se já enviamos a pergunta
      if (user.onboarding_step === 0 && !user.nickname) {
        const { count: assistantCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('phone', phone)
          .eq('role', 'assistant')

        if ((assistantCount ?? 0) === 0) {
          // Nenhuma mensagem enviada ainda (cadastro novo) → envia a pergunta do nome
          const welcomeMsg = getOnboardingMessage(0, user.name ?? '', !!user.couple_id)
          await supabase.from('messages').insert([
            { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
            { phone, sender_name: 'assistant', role: 'assistant', content: welcomeMsg },
          ])
          await sendTextMessage(replyTo, welcomeMsg)
          return NextResponse.json({ status: 'ok' })
        }
        // Já existe mensagem do assistente (pergunta já foi feita, ex: após reset) →
        // cai no processOnboardingStep abaixo para salvar o nickname
      }

      // Processa a resposta do step atual e retorna próxima pergunta
      const nextMessage = await processOnboardingStep(phone, message, user)

      await supabase.from('messages').insert([
        { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
        { phone, sender_name: 'assistant', role: 'assistant', content: nextMessage },
      ])
      // Se estiver em grupo, responde no grupo; senão, no individual
      const onboardingReplyTo = user.group_id ?? replyTo
      await sendTextMessage(onboardingReplyTo, nextMessage)

      // Verifica se o casal inteiro completou o onboarding
      if (user.couple_id) {
        const { complete, users: coupleUsers, couple } = await checkCoupleComplete(user.couple_id)
        if (complete && coupleUsers && couple) {
          await handleCoupleComplete(coupleUsers, couple)
        }
      }

      return NextResponse.json({ status: 'ok' })
    }

    // --- FLUXO NORMAL (onboarding completo) ---

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

    // Ações de perfil detectadas pelo Claude via contexto
    if (result.tipo === 'ver_perfil' && user) {
      const profile = formatUserProfile(user)
      await supabase.from('messages').insert([
        { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
        { phone, sender_name: 'assistant', role: 'assistant', content: profile },
      ])
      await sendTextMessage(replyTo, profile)
      return NextResponse.json({ status: 'ok' })
    }

    if (result.tipo === 'editar_perfil') {
      const menu = getEditMenu()
      await supabase.from('messages').insert([
        { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
        { phone, sender_name: 'assistant', role: 'assistant', content: menu },
      ])
      await sendTextMessage(replyTo, menu)
      return NextResponse.json({ status: 'ok' })
    }

    if (result.tipo === 'resetar_perfil' && user) {
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
      const resetMsg = result.resposta + '\n\n' + getOnboardingMessage(0, user.name ?? '')
      await supabase.from('messages').insert([
        { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
        { phone, sender_name: 'assistant', role: 'assistant', content: resetMsg },
      ])
      await sendTextMessage(replyTo, resetMsg)
      return NextResponse.json({ status: 'ok' })
    }

    await saveAndReply(replyTo, senderName, message, rawMessage, result)

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
