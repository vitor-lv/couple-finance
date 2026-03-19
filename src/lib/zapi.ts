// Validação de variáveis de ambiente no startup (baixo)
if (!process.env.ZAPI_INSTANCE_ID) throw new Error('ZAPI_INSTANCE_ID não configurado')
if (!process.env.ZAPI_TOKEN) throw new Error('ZAPI_TOKEN não configurado')

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

export async function sendTextMessage(phone: string, message: string) {
  // AbortController com timeout de 10s (médio)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(`${BASE_URL}/send-text`, {
      method: 'POST',
      headers: ZAPI_HEADERS,
      body: JSON.stringify({ phone, message }),
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
