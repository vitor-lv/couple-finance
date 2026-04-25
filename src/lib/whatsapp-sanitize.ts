/**
 * Remove envelopes JSON (ex.: resposta interna do Finn) para o usuário nunca ver JSON no WhatsApp.
 * Aceita um ou mais objetos JSON concatenados; usa o campo "resposta" quando existir.
 */

function stripMarkdownJsonFences(text: string): string {
  return text.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (_, inner: string) => inner.trim())
}

function firstJsonObjectBounds(s: string): { start: number; end: number } | null {
  const start = s.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return { start, end: i }
    }
  }
  return null
}

function looksLikeFinanceEnvelope(obj: unknown): obj is { resposta?: unknown } {
  return typeof obj === 'object' && obj !== null && 'resposta' in obj
}

/** Remove camadas restantes tipo `{"resposta":"..."}` até sobrar texto humano. */
function peelJsonRespostaLayers(text: string, maxDepth: number): string {
  let out = text.trim()
  for (let d = 0; d < maxDepth && out.startsWith('{'); d++) {
    const bounds = firstJsonObjectBounds(out)
    if (!bounds) break
    const slice = out.slice(bounds.start, bounds.end + 1)
    let parsed: unknown
    try {
      parsed = JSON.parse(slice)
    } catch {
      break
    }
    if (!looksLikeFinanceEnvelope(parsed) || typeof parsed.resposta !== 'string') break
    const next = parsed.resposta.trim()
    if (!next || next === out) break
    out = next
  }
  return out.trim()
}

/**
 * Se o texto começa com JSON (ou vários em sequência), devolve só as partes humanas em "resposta".
 * Caso contrário devolve o texto original (trim).
 */
export function stripJsonLikeEnvelopeForWhatsApp(text: string): string {
  const normalized = stripMarkdownJsonFences(text).trim()
  if (!normalized) return ''

  let s = normalized
  const fragments: string[] = []
  let guard = 0

  while (s.startsWith('{') && guard++ < 12) {
    const bounds = firstJsonObjectBounds(s)
    if (!bounds) break

    const slice = s.slice(bounds.start, bounds.end + 1)
    let parsed: unknown
    try {
      parsed = JSON.parse(slice)
    } catch {
      break
    }

    if (looksLikeFinanceEnvelope(parsed)) {
      const r = parsed.resposta
      if (typeof r === 'string' && r.trim().length > 0) {
        fragments.push(stripJsonLikeEnvelopeForWhatsApp(r))
      }
    }

    s = s.slice(bounds.end + 1).trim()
  }

  let candidate =
    fragments.length > 0
      ? (fragments.join('\n\n').trim() || 'Pronto! ✅')
      : normalized

  candidate = peelJsonRespostaLayers(candidate, 10)

  if (candidate.trim().startsWith('{')) {
    try {
      JSON.parse(candidate)
      return 'Pronto! ✅'
    } catch {
      return candidate
    }
  }

  return candidate
}
