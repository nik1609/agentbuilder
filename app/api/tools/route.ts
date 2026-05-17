import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

const SENSITIVE_HEADER_KEYS = /api[_-]?key|apikey|authorization|auth|token|secret|password|credential|bearer/i
const SENSITIVE_SCHEMA_KEYS = /api[_-]?key|apikey|secret|password|credential|token/i

function maskValue(val: string): string {
  if (!val || val.length <= 6) return '••••••••'
  return val.slice(0, 4) + '••••••••' + val.slice(-3)
}

/** Mask sensitive values in headers object */
function maskHeaders(headers: Record<string, string> | null | undefined): Record<string, string> {
  if (!headers) return {}
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) =>
      SENSITIVE_HEADER_KEYS.test(k) ? [k, maskValue(v)] : [k, v]
    )
  )
}

/** Mask sensitive values in input_schema */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maskInputSchema(schema: Record<string, any> | null | undefined): Record<string, any> {
  if (!schema) return {}
  return Object.fromEntries(
    Object.entries(schema).map(([k, v]) =>
      SENSITIVE_SCHEMA_KEYS.test(k) && typeof v === 'string' && v
        ? [k, maskValue(v)]
        : [k, v]
    )
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeTool(row: any) {
  return {
    ...row,
    headers: maskHeaders(row.headers),
    input_schema: maskInputSchema(row.input_schema),
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { data, error } = await db.from('tools').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(sanitizeTool))
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const body = await req.json()
  const { data, error } = await db.from('tools').insert({
    id: uuidv4(),
    user_id: userId,
    name: body.name,
    description: body.description ?? '',
    type: body.type ?? 'http',
    endpoint: body.endpoint ?? null,
    method: body.method ?? 'POST',
    headers: body.headers ?? {},
    input_schema: body.inputSchema ?? {},
    timeout: body.timeout ?? 5000,
    created_at: new Date().toISOString(),
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(sanitizeTool(data), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Don't re-save masked values back to DB — skip fields containing masking chars
  const cleanHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries((fields.headers ?? {}) as Record<string, string>)) {
    if (typeof v === 'string' && !v.includes('••••')) cleanHeaders[k] = v
    else if (typeof v === 'string' && v.includes('••••')) {
      // Masked value sent back — fetch original from DB to keep unchanged
      const { data: existing } = await db.from('tools').select('headers').eq('id', id).eq('user_id', userId).single()
      if (existing?.headers?.[k]) cleanHeaders[k] = existing.headers[k]
    }
  }

  const cleanSchema: Record<string, unknown> = {}
  for (const [k, v] of Object.entries((fields.inputSchema ?? {}) as Record<string, unknown>)) {
    if (typeof v === 'string' && v.includes('••••')) {
      const { data: existing } = await db.from('tools').select('input_schema').eq('id', id).eq('user_id', userId).single()
      if (existing?.input_schema?.[k]) cleanSchema[k] = existing.input_schema[k]
    } else {
      cleanSchema[k] = v
    }
  }

  const { data, error } = await db.from('tools').update({
    name: fields.name,
    description: fields.description,
    type: fields.type,
    endpoint: fields.endpoint ?? null,
    method: fields.method ?? 'POST',
    headers: cleanHeaders,
    input_schema: cleanSchema,
    timeout: fields.timeout ?? 5000,
  }).eq('id', id).eq('user_id', userId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(sanitizeTool(data))
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { id } = await req.json()
  const { error } = await db.from('tools').delete().eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
