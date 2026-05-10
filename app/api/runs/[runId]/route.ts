import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { runId } = await params
  const db = createAdminClient()

  const SELECT_FULL = 'id, agent_id, agent_name, status, tokens, latency_ms, cost_usd, error, trace, input, output, created_at, api_key_prefix'
  const SELECT_NO_COST = 'id, agent_id, agent_name, status, tokens, latency_ms, error, trace, input, output, created_at, api_key_prefix'

  async function fetchRun(select: string, extraFilter?: { field: string; value: string }) {
    let q = db.from('agent_runs').select(select).eq('id', runId)
    if (extraFilter) q = q.eq(extraFilter.field, extraFilter.value)
    return q.single()
  }

  // Primary: find by run ID + user_id
  let { data, error } = await fetchRun(SELECT_FULL, { field: 'user_id', value: userId })
  if (error?.code === '42703' || error?.message?.includes('cost_usd')) {
    ;({ data, error } = await fetchRun(SELECT_NO_COST, { field: 'user_id', value: userId }))
  }

  // Fallback: run may have been created with null user_id (terminal/API key runs, legacy).
  // Allow access if the user owns the agent the run belongs to.
  if (!data) {
    const { data: runMeta } = await db.from('agent_runs').select('agent_id').eq('id', runId).single()
    if (runMeta?.agent_id) {
      const { data: ownedAgent } = await db.from('agents').select('id').eq('id', runMeta.agent_id).eq('user_id', userId).single()
      if (ownedAgent) {
        ;({ data, error } = await fetchRun(SELECT_FULL))
        if (error?.code === '42703' || error?.message?.includes('cost_usd')) {
          ;({ data, error } = await fetchRun(SELECT_NO_COST))
        }
      }
    }
  }

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
