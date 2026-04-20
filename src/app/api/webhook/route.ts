import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { processFinanceMessage, processFinanceImage, transcribeAudio } from '@/lib/claude'
import { sendTextMessage, sendTyping } from '@/lib/zapi'
import {
  getWelcomeMessage,
  processOnboardingStep,
  getEditMenu,
  processEditChoice,
  processEditValue,
  formatUserProfile,
} from '@/lib/onboarding'

interface ZAPIMessage {
  phone: string
  fromMe: boolean
  momentsAgo: boolean
  keyId: string
  senderName: string
  isGroup?: boolean
  participantPhone?: string
  text?: { message: string }
  image?: { imageUrl: string; caption?: string }
  audio?: { audioUrl: string; seconds?: number }
  type: string
  chatName: string
}

async function saveAndReply(
  userPhone: string,
  replyTo: string,
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
    phone: userPhone,
    sender_name: senderName,
    role: 'user',
    content: userContent,
    raw_message: rawMessage,
  })

  await supabase.from('messages').insert({
    phone: userPhone,
    sender_name: 'assistant',
    role: 'assistant',
    content: result.resposta,
  })

  if ((result.tipo === 'gasto' || result.tipo === 'receita') && result.valor) {
    const { error: txError } = await supabase.from('transactions').insert({
      phone:       userPhone,
      sender_name: senderName,
      tipo:        result.tipo,
      valor:       result.valor,
      categoria:   result.categoria,
      descricao:   result.descricao,
      data:        result.data ?? new Date().toISOString().split('T')[0],
      amount:      result.valor,
      category:    result.categoria,
      description: result.descricao,
    })
    if (txError) {
      console.error('❌ Erro ao salvar transaction:', JSON.stringify(txError))
    } else {
      console.log(`✅ Transaction salva: ${result.tipo} R$${result.valor} (${userPhone})`)
    }
  }

  await sendTextMessage(replyTo, result.resposta)
}

export async function POST(request: NextRequest) {
  try {
    const zapiToken = request.headers.get('z-api-token')
    if (zapiToken !== process.env.ZAPI_TOKEN) {
      return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
    }

    const body: ZAPIMessage = await request.json()

    if (body.fromMe) {
      return NextResponse.json({ status: 'ignored' })
    }

    const isGroup = body.isGroup === true
    const groupId = isGroup ? body.phone : null
    const userPhone = isGroup ? (body.participantPhone ?? body.phone) : body.phone
    const replyTo = body.phone // sempre responde para o chat (grupo ou individual)
    const senderName = body.senderName
    const rawMessage = { phone: userPhone, type: body.type, keyId: body.keyId }

    // Rate limiting por número individual
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('phone', userPhone)
      .eq('role', 'user')
      .gte('created_at', oneMinuteAgo)

    if ((count ?? 0) >= 20) {
      return NextResponse.json({ status: 'rate_limited' })
    }

    await sendTyping(replyTo)

    // ── Processar imagem ──────────────────────────────────────────────────────
    if (body.type === 'ReceivedCallback' && body.image?.imageUrl) {
      await sendTextMessage(replyTo, '🔍 Analisando sua imagem...')
      const imageResponse = await fetch(body.image.imageUrl)
      if (!imageResponse.ok) {
        return NextResponse.json({ status: 'error' }, { status: 500 })
      }
      const imageBase64 = Buffer.from(await imageResponse.arrayBuffer()).toString('base64')
      const result = await processFinanceImage(imageBase64, body.image.caption)
      await saveAndReply(userPhone, replyTo, senderName, body.image.caption || '[imagem]', rawMessage, result)
      return NextResponse.json({ status: 'ok' })
    }

    // ── Processar áudio ───────────────────────────────────────────────────────
    if (body.type === 'ReceivedCallback' && body.audio?.audioUrl) {
      const transcribed = await transcribeAudio(body.audio.audioUrl)
      if (!transcribed) {
        await sendTextMessage(replyTo, '🎙️ Não consegui entender o áudio. Pode digitar sua mensagem?')
        return NextResponse.json({ status: 'ok' })
      }
      body.text = { message: transcribed }
    }

    if (body.type !== 'ReceivedCallback' || !body.text?.message) {
      return NextResponse.json({ status: 'ignored' })
    }

    const message = body.text.message
    if (message.length > 1000) {
      return NextResponse.json({ status: 'ignored' })
    }

    // ── Busca usuário ─────────────────────────────────────────────────────────
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone', userPhone)
      .maybeSingle()

    // ── Usuário não cadastrado ────────────────────────────────────────────────
    if (!user) {
      if (isGroup && groupId) {
        // Parceiro entra no grupo sem cadastro
        const { data: coupleData } = await supabase
          .from('couples')
          .select('*')
          .eq('group_id', groupId)
          .maybeSingle()

        if (coupleData) {
          const { data: existingPartner } = await supabase
            .from('users')
            .select('nickname, name')
            .eq('couple_id', coupleData.id)
            .neq('phone', userPhone)
            .maybeSingle()

          await supabase.from('users').insert({
            phone: userPhone,
            name: senderName,
            couple_id: coupleData.id,
            chat_mode: 'group',
            group_id: groupId,
            onboarding_step: -1,
            onboarding_completed: false,
          })

          const { data: newUser } = await supabase.from('users').select('*').eq('phone', userPhone).maybeSingle()
          user = newUser

          const partnerName = existingPartner?.nickname ?? existingPartner?.name ?? 'seu parceiro(a)'
          const welcomeMsg =
            `Oi ${senderName}! 👋 Vejo que você está no grupo com *${partnerName}*.\n\n` +
            getWelcomeMessage(senderName, true)

          await supabase.from('users').update({ onboarding_step: 0 }).eq('phone', userPhone)
          await supabase.from('messages').insert([
            { phone: userPhone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
            { phone: userPhone, sender_name: 'assistant', role: 'assistant', content: welcomeMsg },
          ])
          await sendTextMessage(replyTo, welcomeMsg)
          return NextResponse.json({ status: 'ok' })
        }
        return NextResponse.json({ status: 'ignored' })
      } else {
        // Usuário novo, mensagem individual
        await supabase.from('users').insert({
          phone: userPhone,
          name: senderName,
          onboarding_step: -1,
          onboarding_completed: false,
          chat_mode: 'individual',
        })
        const { data: newUser } = await supabase.from('users').select('*').eq('phone', userPhone).maybeSingle()
        user = newUser
      }
    }

    if (!user) return NextResponse.json({ status: 'error' })

    const phone = userPhone

    // ════════════════════════════════════════════════════════════════════════
    // ORDEM: 1. Edição | 2. Onboarding | 3. Fluxo normal
    // ════════════════════════════════════════════════════════════════════════

    // ── 1. MODO DE EDIÇÃO ─────────────────────────────────────────────────────
    if (user.editing_field) {
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

    // ── 2. ONBOARDING ─────────────────────────────────────────────────────────
    if (user.onboarding_completed === false) {
      // Step -1: primeira vez → envia boas-vindas + pergunta de apelido
      if (user.onboarding_step === -1) {
        const welcomeMsg = getWelcomeMessage(user.name ?? senderName, !!user.couple_id)
        await supabase.from('users').update({ onboarding_step: 0 }).eq('phone', phone)
        await supabase.from('messages').insert([
          { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
          { phone, sender_name: 'assistant', role: 'assistant', content: welcomeMsg },
        ])
        await sendTextMessage(replyTo, welcomeMsg)
        return NextResponse.json({ status: 'ok' })
      }

      // Steps 0-3: processa resposta do usuário
      const nextMessage = await processOnboardingStep(phone, message, user)

      await supabase.from('messages').insert([
        { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
        { phone, sender_name: 'assistant', role: 'assistant', content: nextMessage },
      ])

      const onboardingReplyTo = user.group_id ?? replyTo
      await sendTextMessage(onboardingReplyTo, nextMessage)
      return NextResponse.json({ status: 'ok' })
    }

    // ── 3. FLUXO NORMAL ───────────────────────────────────────────────────────
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(10)

    const chatHistory = (history ?? [])
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const { data: monthTransactions } = await supabase
      .from('transactions')
      .select('valor')
      .eq('phone', phone)
      .eq('tipo', 'gasto')
      .gte('created_at', startOfMonth)

    const totalGastoMes = (monthTransactions ?? []).reduce((sum, t) => sum + (t.valor ?? 0), 0)

    const result = await processFinanceMessage(message, chatHistory, {
      senderName,
      coupleGoal: user.goal_description ?? undefined,
      coupleGoalAmount: user.goal_amount ?? undefined,
      monthlyIncome: user.monthly_income ?? undefined,
      monthlySavingsGoal: user.monthly_savings_goal ?? undefined,
      totalGastoMes,
    })

    // Ações de perfil detectadas pelo Claude
    if (result.tipo === 'ver_perfil') {
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

    if (result.tipo === 'resetar_perfil') {
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
        employment_type: null,
        fixed_expenses: null,
      }).eq('phone', phone)

      const welcomeMsg = getWelcomeMessage(user.name ?? senderName, !!user.couple_id)
      const fullMsg = `Perfil zerado! 🔄\n\n${welcomeMsg}`
      await supabase.from('messages').insert([
        { phone, sender_name: senderName, role: 'user', content: message, raw_message: rawMessage },
        { phone, sender_name: 'assistant', role: 'assistant', content: fullMsg },
      ])
      await sendTextMessage(replyTo, fullMsg)
      return NextResponse.json({ status: 'ok' })
    }

    if (result.tipo === 'salvar_renda' && result.valor) {
      await supabase.from('users').update({ monthly_income: result.valor }).eq('phone', phone)
    }

    await saveAndReply(phone, replyTo, senderName, message, rawMessage, result)
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Webhook error:', message)
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'couple-finance webhook' })
}
