/**
 * POST /api/runs/:runId/hitl/message
 * Body: { content: string; role?: 'human' | 'agent' }
 * Appends a chat message to the HITL session trace.
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
    .from('agent_runs')
    .select('id, status, trace')
    .eq('id', runId)
    .eq('user_id', userId)
    .single()

  if (error || !run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status !== 'waiting_hitl') {
    return NextResponse.json({ error: 'Run is not in HITL waiting state' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const content = (body.content as string)?.trim()
  const role = (body.role as string) ?? 'human'

  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 })

  const trace = (run.trace ?? []) as unknown[]
  const newEvent = {
    type: 'hitl_message',
    ts: Date.now(),
    message: content,
    data: { role, content },
  }
  trace.push(newEvent)

  await db.from('agent_runs').update({ trace }).eq('id', runId)

  return NextResponse.json({ ok: true, message: newEvent })
}
