import crypto from 'crypto'

const SECRET = process.env.NEXTAUTH_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'agenthub-review'

export function generateReviewToken(runId: string): string {
  const hmac = crypto.createHmac('sha256', SECRET).update(runId).digest('base64url')
  return `${runId}.${hmac}`
}

export function verifyReviewToken(token: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const runId = token.slice(0, dot)
  if (!runId) return null
  const expected = Buffer.from(crypto.createHmac('sha256', SECRET).update(runId).digest('base64url'))
  const actual   = Buffer.from(token.slice(dot + 1))
  if (expected.length !== actual.length) return null
  try {
    if (!crypto.timingSafeEqual(expected, actual)) return null
  } catch { return null }
  return runId
}
