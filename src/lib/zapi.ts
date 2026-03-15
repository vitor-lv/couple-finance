const INSTANCE_ID = process.env.ZAPI_INSTANCE_ID!
const TOKEN = process.env.ZAPI_TOKEN!
const BASE_URL = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${TOKEN}`

export async function sendTextMessage(phone: string, message: string) {
  const response = await fetch(`${BASE_URL}/send-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message }),
  })

  if (!response.ok) {
    throw new Error(`Z-API error: ${response.status} ${await response.text()}`)
  }

  return response.json()
}
