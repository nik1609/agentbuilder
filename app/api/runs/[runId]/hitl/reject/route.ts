/**
 * POST /api/runs/:runId/hitl/reject
 * Body: { reason?: string }
 * Rejects the HITL checkpoint and marks the run as failed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { runId } = await params
  const db = createAdminClient()

  const { data: run, error } = await db
    .from('agent_runs').select('id, status, trace').eq('id', runId).eq('user_id', userId).single()
  if (error || !run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status !== 'waiting_hitl') {
    return NextResponse.json({ error: `Run is not waiting for HITL (status: ${run.status})` }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const reason = (body.reason as string)?.trim() ?? 'Rejected by reviewer'

  const trace = (run.trace ?? []) as unknown[]
  trace.push({ type: 'hitl_message', ts: Date.now(), message: reason, data: { role: 'human', content: reason, action: 'reject' } })
  trace.push({ type: 'error', ts: Date.now(), message: `HITL rejected: ${reason}` })

  await db.from('agent_runs').update({
    status: 'failed', error: `HITL rejected: ${reason}`, trace,
  }).eq('id', runId)

  return NextResponse.json({ runId, status: 'failed', error: `HITL rejected: ${reason}` })
}
