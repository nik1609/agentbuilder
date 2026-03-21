import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateApiKey, hashApiKey, getUserId } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('api_keys')
    .select('id, name, key_prefix, is_active, total_calls, last_used, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  let body: { name?: string }
  try { body = await req.json() } catch { body = {} }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Key name is required' }, { status: 400 })
  }

  const key = generateApiKey()
  const keyHash = hashApiKey(key)
  const keyPrefix = key.slice(0, 12)
  const id = uuidv4()

  const { error } = await db.from('api_keys').insert({
    id,
    user_id: userId,
    name: body.name.trim(),
    key_prefix: keyPrefix,
    key_hash: keyHash,
    is_active: true,
    total_calls: 0,
    created_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return full key ONCE — never stored in DB
  return NextResponse.json({
    id, name: body.name.trim(), key,
    key_prefix: keyPrefix, is_active: true, total_calls: 0,
  }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  let body: { id?: string }
  try { body = await req.json() } catch { body = {} }
  if (!body.id) return NextResponse.json({ error: 'Key ID required' }, { status: 400 })

  const { data, error } = await db
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', body.id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Key not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
