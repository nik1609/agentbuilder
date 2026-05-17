import crypto from 'crypto'

/**
 * Fires a signed POST webhook with exponential backoff retry.
 * Fails silently — webhook delivery is best-effort, never blocks the pipeline.
 *
 * If secret is provided, every request includes:
 *   X-AgentHub-Timestamp: unix seconds
 *   X-AgentHub-Signature: sha256=HMAC(secret, timestamp + "." + body)
 *
 * Receiver verifies with:
 *   const expected = "sha256=" + createHmac("sha256", secret)
 *     .update(timestamp + "." + rawBody).digest("hex")
 *   if (expected !== req.headers["x-agenthub-signature"]) reject()
 */
export async function fireWebhook(
  url: string,
  payload: Record<string, unknown>,
  secret?: string
): Promise<void> {
  const MAX_ATTEMPTS = 3
  const BACKOFF_MS = 500
  const body = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
    headers['X-AgentHub-Timestamp'] = timestamp
    headers['X-AgentHub-Signature'] = `sha256=${sig}`
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) return
      if (attempt === MAX_ATTEMPTS) {
        console.warn(`[webhook] ${url} returned ${res.status} after ${MAX_ATTEMPTS} attempts`)
        return
      }
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.warn(`[webhook] ${url} failed: ${err instanceof Error ? err.message : String(err)}`)
        return
      }
    }
    await new Promise(r => setTimeout(r, BACKOFF_MS * 2 ** (attempt - 1)))
  }
}
