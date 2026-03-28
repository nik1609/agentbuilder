import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const url = new URL(req.url)
  const agentId = url.searchParams.get('agentId')
  const status = url.searchParams.get('status')

  let query = db
    .from('agent_runs')
    .select('id, agent_id, agent_name, status, tokens, latency_ms, cost_usd, error, created_at, api_key_prefix, input, output')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (agentId) query = query.eq('agent_id', agentId)
  if (status) query = query.eq('status', status)

  let { data, error } = await query

  // If cost_usd column doesn't exist yet (migration pending), retry without it
  if (error?.code === '42703' || error?.message?.includes('cost_usd')) {
    let fallback = db
      .from('agent_runs')
      .select('id, agent_id, agent_name, status, tokens, latency_ms, error, created_at, api_key_prefix, input, output')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (agentId) fallback = fallback.eq('agent_id', agentId)
    if (status) fallback = fallback.eq('status', status)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;({ data: (data as any), error } = await fallback)
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const url = new URL(req.url)

  // ?ids=id1,id2,id3 — delete specific runs
  const ids = url.searchParams.get('ids')
  // ?olderThanDays=30 — delete runs older than N days
  const olderThanDays = url.searchParams.get('olderThanDays')
  // ?status=failed — delete by status
  const status = url.searchParams.get('status')
  // ?agentId=xxx — scope to agent
  const agentId = url.searchParams.get('agentId')

  let query = db.from('agent_runs').delete().eq('user_id', userId)

  if (ids) {
    query = query.in('id', ids.split(',').filter(Boolean))
  } else {
    if (olderThanDays) {
      const cutoff = new Date(Date.now() - parseInt(olderThanDays) * 24 * 60 * 60 * 1000).toISOString()
      query = query.lt('created_at', cutoff)
    }
    if (status) query = query.eq('status', status)
    if (agentId) query = query.eq('agent_id', agentId)
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
