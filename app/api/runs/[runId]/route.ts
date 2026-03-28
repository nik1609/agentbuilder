import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { runId } = await params
  const db = createAdminClient()

  let { data, error } = await db
    .from('agent_runs')
    .select('id, agent_id, agent_name, status, tokens, latency_ms, cost_usd, error, trace, input, output, created_at, api_key_prefix')
    .eq('id', runId)
    .eq('user_id', userId)
    .single()

  if (error?.code === '42703' || error?.message?.includes('cost_usd')) {
    ;({ data, error } = await db
      .from('agent_runs')
      .select('id, agent_id, agent_name, status, tokens, latency_ms, error, trace, input, output, created_at, api_key_prefix')
      .eq('id', runId)
      .eq('user_id', userId)
      .single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { runId } = await params
  const db = createAdminClient()
  const { error } = await db.from('agent_runs').delete().eq('id', runId).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
