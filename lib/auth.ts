import { createHash } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let key = 'ahk_'
  for (let i = 0; i < 40; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}

export async function getUserFromSession(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

export async function getUserFromApiKey(req: NextRequest): Promise<string | null> {
  const key = req.headers.get('x-agenthub-key') || req.headers.get('authorization')?.replace('Bearer ', '')
  if (!key || key === 'test') return null

  const { createAdminClient } = await import('@/lib/supabase/server')
  const db = createAdminClient()
  const hash = hashApiKey(key)

  const { data } = await db
    .from('api_keys')
    .select('user_id')
    .eq('key_hash', hash)
    .single()

  return data?.user_id ?? null
}

export async function getUserId(req: NextRequest): Promise<string | null> {
  // Try session first (dashboard calls), then API key (external calls)
  const fromSession = await getUserFromSession()
  if (fromSession) return fromSession
  return getUserFromApiKey(req)
}
