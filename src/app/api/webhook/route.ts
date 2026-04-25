import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { supabase } from '@/lib/supabase'
import { processFinanceImage, transcribeAudio } from '@/lib/claude'
import { sendTextMessage, sendTyping } from '@/lib/zapi'
import { isAllowedExternalUrl } from '@/lib/url-validation'
import { saveAndReply } from '@/lib/webhook/messages'
import { handleNewUser, handleEditing, handleOnboarding, handleFinance } from '@/lib/webhook/handlers'
import { User } from '@/lib/onboarding'

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
  listResponseMessage?: {
    title?: string
    singleSelectReply?: { selectedRowId?: string }
  }
  buttonsResponseMessage?: {
    selectedButtonId?: string
    selectedStableId?: string
    selectedDisplayText?: string
  }
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_TEXT_LENGTH = 1000
const WEBHOOK_RATE_LIMIT_PER_MINUTE = 20
const WEBHOOK_SIGNATURE_MAX_AGE_SECONDS = 300

async function fetchAsBufferWithLimit(url: string, maxBytes: number): Promise<Buffer | null> {
  const response = await fetch(url)
  if (!response.ok || !response.body) return null

  const contentLength = response.headers.get('content-length')
  if (contentLength && Number(contentLength) > maxBytes) return null

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) return null
    chunks.push(value)
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
}

function normalizeSignature(signature: string): string {
  return signature.trim().replace(/^sha256=/i, '')
}

function verifyWebhookSignature(
  payload: string,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  const timestampNumber = Number(timestamp)
  if (!Number.isFinite(timestampNumber)) return false

  const nowInSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowInSeconds - timestampNumber) > WEBHOOK_SIGNATURE_MAX_AGE_SECONDS) return false

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')

  const received = normalizeSignature(signature)
  // Normaliza ambos para 32 bytes via HMAC antes de comparar — evita timing leak no check de tamanho
  const normKey = Buffer.from('timing-safe-norm')
  const expectedNorm = createHmac('sha256', normKey).update(expected).digest()
  const receivedNorm = createHmac('sha256', normKey).update(received).digest()
  return timingSafeEqual(expectedNorm, receivedNorm)
}

export async function POST(request: NextRequest) {
  try {
    const zapiToken = request.headers.get('z-api-token')
    if (zapiToken !== process.env.ZAPI_TOKEN) {
      return NextResponse.json({ status: 'unauthorized' }, { status: 401 })
    }

    const rawBody = await request.text()
    const hmacSecret = process.env.WEBHOOK_HMAC_SECRET
    if (hmacSecret) {
      const signature = request.headers.get('x-webhook-signature')
      const timestamp = request.headers.get('x-webhook-timestamp')
      if (!signature || !timestamp) {
        return NextResponse.json({ status: 'unauthorized_signature' }, { status: 401 })
      }
      if (!verifyWebhookSignature(rawBody, timestamp, signature, hmacSecret)) {
        return NextResponse.json({ status: 'unauthorized_signature' }, { status: 401 })
      }
    }

    let body: ZAPIMessage
    try {
      body = JSON.parse(rawBody) as ZAPIMessage
    } catch {
      return NextResponse.json({ status: 'invalid_payload' }, { status: 400 })
    }

    if (body.fromMe) return NextResponse.json({ status: 'ignored' })

    // Normaliza respostas interativas (lista ou botão) como texto
    if (body.type === 'ListResponseMessage') {
      const id = body.listResponseMessage?.singleSelectReply?.selectedRowId
      const title = body.listResponseMessage?.title
      const selected = id ?? title
      if (!selected) return NextResponse.json({ status: 'ignored' })
      body.text = { message: selected }
      body.type = 'ReceivedCallback'
    }

    if (body.type === 'ButtonsResponseMessage') {
      const id = body.buttonsResponseMessage?.selectedButtonId ?? body.buttonsResponseMessage?.selectedStableId
      if (!id) return NextResponse.json({ status: 'ignored' })
      body.text = { message: id }
      body.type = 'ReceivedCallback'
    }

    const isGroup = body.isGroup === true
    const groupId = isGroup ? body.phone : null
    const userPhone = isGroup ? (body.participantPhone ?? body.phone) : body.phone
    const replyTo = body.phone
    const senderName = body.senderName
    const rawMessage = { phone: userPhone, type: body.type, keyId: body.keyId }

    const { data: isRateLimitAllowed, error: rateLimitError } = await supabase.rpc(
      'check_and_increment_webhook_rate_limit',
      { p_phone: userPhone, p_limit: WEBHOOK_RATE_LIMIT_PER_MINUTE }
    )
    if (rateLimitError) throw new Error(`Erro no rate limit atômico: ${rateLimitError.message}`)
    if (!isRateLimitAllowed) return NextResponse.json({ status: 'rate_limited' })

    // ── Image ─────────────────────────────────────────────────────────────────
    if (body.type === 'ReceivedCallback' && body.image?.imageUrl) {
      if (!isAllowedExternalUrl(body.image.imageUrl)) {
        return NextResponse.json({ status: 'ignored_invalid_media_url' })
      }
      await sendTyping(replyTo)
      await sendTextMessage(replyTo, '🔍 Analisando sua imagem...')
      const imageBuffer = await fetchAsBufferWithLimit(body.image.imageUrl, MAX_IMAGE_BYTES)
      if (!imageBuffer) return NextResponse.json({ status: 'error' }, { status: 500 })
      const result = await processFinanceImage(imageBuffer.toString('base64'), body.image.caption)
      const saved = await saveAndReply(
        userPhone, replyTo, senderName, body.image.caption || '[imagem]', rawMessage, result
      )
      return NextResponse.json({ status: saved ? 'ok' : 'ignored_duplicate' })
    }

    // ── Audio ─────────────────────────────────────────────────────────────────
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
    if (message.length > MAX_TEXT_LENGTH) return NextResponse.json({ status: 'ignored' })

    await sendTyping(replyTo)

    // ── User lookup ───────────────────────────────────────────────────────────
    let { data: user } = await supabase.from('users').select('*').eq('phone', userPhone).maybeSingle()

    if (!user) {
      if (!isGroup) {
        await sendTextMessage(replyTo, `Ooi! 👋 Sabe aquela conversa difícil no relacionamento sobre dinheiro?`)
        await sendTextMessage(replyTo, `O Finn resolve isso pra vocês. Dá uma olhada: https://couple-finance-nine.vercel.app/`)
        return NextResponse.json({ status: 'unregistered' })
      }
      const { user: newUser, response } = await handleNewUser({
        userPhone, senderName, message, rawMessage, replyTo, isGroup, groupId,
      })
      if (response) return response
      user = newUser
    }

    if (!user) return NextResponse.json({ status: 'error' })

    const phone = userPhone

    // ── 1. Editing ────────────────────────────────────────────────────────────
    if (user.editing_field) {
      return handleEditing({
        phone, senderName, message, rawMessage, replyTo, editingField: user.editing_field,
      })
    }

    // ── 2. Onboarding ─────────────────────────────────────────────────────────
    if (user.onboarding_completed === false) {
      return handleOnboarding({ phone, senderName, message, rawMessage, replyTo, user: user as User })
    }

    // ── 3. Finance ────────────────────────────────────────────────────────────
    return handleFinance({ phone, senderName, message, rawMessage, replyTo, user: user as User })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Webhook error:', message)
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'couple-finance webhook' })
}
