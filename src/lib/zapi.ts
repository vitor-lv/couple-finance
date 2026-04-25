import { stripJsonLikeEnvelopeForWhatsApp } from '@/lib/whatsapp-sanitize'

// Validação de variáveis de ambiente no startup (baixo)
if (!process.env.ZAPI_INSTANCE_ID) throw new Error('ZAPI_INSTANCE_ID não configurado')
if (!process.env.ZAPI_TOKEN) throw new Error('ZAPI_TOKEN não configurado')

export interface OptionListRow {
  id: string
  title: string
  description?: string
}

export interface OptionList {
  title: string
  buttonLabel: string
  sections: Array<{ title: string; rows: OptionListRow[] }>
}

export interface ButtonItem {
  id: string
  label: string
}

const INSTANCE_ID = process.env.ZAPI_INSTANCE_ID
const TOKEN = process.env.ZAPI_TOKEN
const BASE_URL = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}`

const ZAPI_HEADERS = {
  'Content-Type': 'application/json',
  ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
}

export async function sendTyping(phone: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${BASE_URL}/typing`, {
      method: 'POST',
      headers: ZAPI_HEADERS,
      body: JSON.stringify({ phone, duration: 3000 }),
      signal: controller.signal,
    })
    if (!response.ok) {
      console.error('Typing error:', response.status, await response.text())
    }
  } catch (e) {
    console.error('Typing fetch error:', e instanceof Error ? e.message : e)
  } finally {
    clearTimeout(timeout)
  }
}

export async function createGroup(name: string, phones: string[]): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${BASE_URL}/create-group`, {
      method: 'POST',
      headers: ZAPI_HEADERS,
      body: JSON.stringify({ autoInvite: true, groupName: name, phones }),
      signal: controller.signal,
    })
    if (!response.ok) {
      console.error('Create group error:', response.status, await response.text())
      return null
    }
    const data = await response.json()
    // Z-API retorna o JID do grupo no campo "phone"
    return data.phone ?? null
  } catch (e) {
    console.error('Create group fetch error:', e instanceof Error ? e.message : e)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function addParticipant(groupId: string, phones: string[]): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(`${BASE_URL}/add-participant`, {
      method: 'POST',
      headers: ZAPI_HEADERS,
      body: JSON.stringify({ autoInvite: true, groupId, phones }),
      signal: controller.signal,
    })
    if (!response.ok) {
      console.error('Add participant error:', response.status, await response.text())
      return false
    }
    return true
  } catch (e) {
    console.error('Add participant error:', e instanceof Error ? e.message : e)
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendOptionList(phone: string, message: string, optionList: OptionList) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(`${BASE_URL}/send-option-list`, {
      method: 'POST',
      headers: ZAPI_HEADERS,
      body: JSON.stringify({ phone, message: stripJsonLikeEnvelopeForWhatsApp(message), optionList }),
      signal: controller.signal,
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`Z-API send-option-list error: ${response.status} ${text}`)
    let data: Record<string, unknown>
    try { data = JSON.parse(text) } catch { throw new Error(`Z-API send-option-list invalid JSON: ${text}`) }
    if (!data.messageId && !data.zaapId && !data.id) {
      throw new Error(`Z-API send-option-list sem messageId: ${text}`)
    }
    return data
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendButtonList(phone: string, message: string, buttons: ButtonItem[]) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(`${BASE_URL}/send-button-list`, {
      method: 'POST',
      headers: ZAPI_HEADERS,
      body: JSON.stringify({ phone, message: stripJsonLikeEnvelopeForWhatsApp(message), buttonList: { buttons } }),
      signal: controller.signal,
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`Z-API send-button-list error: ${response.status} ${text}`)
    let data: Record<string, unknown>
    try { data = JSON.parse(text) } catch { throw new Error(`Z-API send-button-list invalid JSON: ${text}`) }
    if (!data.messageId && !data.zaapId && !data.id) {
      throw new Error(`Z-API send-button-list sem messageId: ${text}`)
    }
    return data
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendTextMessage(phone: string, message: string) {
  // AbortController com timeout de 10s (médio)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const safeMessage = stripJsonLikeEnvelopeForWhatsApp(message)
    const response = await fetch(`${BASE_URL}/send-text`, {
      method: 'POST',
      headers: ZAPI_HEADERS,
      body: JSON.stringify({ phone, message: safeMessage }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Z-API error: ${response.status} ${await response.text()}`)
    }

    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}
