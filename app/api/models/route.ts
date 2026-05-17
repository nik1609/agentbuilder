import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

/** Mask a key for display — never expose full key to client */
function maskKey(key: string | null | undefined): string | null {
  if (!key) return null
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 6) + '••••••••' + key.slice(-4)
}

/** Strip sensitive fields before sending to client */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeModel(row: any) {
  const { api_key, ...safe } = row
  return {
    ...safe,
    has_api_key: !!api_key,
    api_key_hint: maskKey(api_key),   // "gsk_fx••••••••2iEW" — enough to identify which key
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data, error } = await db.from('models').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(sanitizeModel))
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const body = await req.json()
  const { data, error } = await db.from('models').insert({
    id: uuidv4(),
    user_id: userId,
    name: body.name,
    provider: body.provider ?? 'google',
    model_id: body.modelId ?? 'gemini-2.5-flash',
    temperature: body.temperature ?? 0.7,
    max_tokens: body.maxTokens ?? 4096,
    top_p: body.topP ?? 1.0,
    stream: body.stream ?? true,
    api_key: body.apiKey ?? null,
    base_url: body.baseUrl ?? null,
    created_at: new Date().toISOString(),
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(sanitizeModel(data), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Only update api_key if client sent a real new value.
  // Sending nothing (undefined) = keep existing. Sending null = clear key.
  const updatePayload: Record<string, unknown> = {
    name: fields.name,
    provider: fields.provider,
    model_id: fields.modelId,
    temperature: fields.temperature,
    max_tokens: fields.maxTokens,
    base_url: fields.baseUrl ?? null,
  }
  if ('apiKey' in fields) {
    // null = clear key, string = new key, absent = unchanged
    updatePayload.api_key = fields.apiKey ?? null
  }

  const { data, error } = await db.from('models').update(updatePayload).eq('id', id).eq('user_id', userId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(sanitizeModel(data))
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { id } = await req.json()
  const { error } = await db.from('models').delete().eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
