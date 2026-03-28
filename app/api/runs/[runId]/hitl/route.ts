/**
 * GET /api/runs/:runId/hitl
 * Returns the current HITL session state: question, context, chat messages.
 * Messages are stored as trace events of type 'hitl_pause' and custom 'hitl_message'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { runId } = await params
  const db = createAdminClient()

  const { data: run, error } = await db
    .from('agent_runs')
    .select('id, agent_id, status, output, trace, input, created_at')
    .eq('id', runId)
    .eq('user_id', userId)
    .single()

  if (error || !run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status !== 'waiting_hitl') {
    return NextResponse.json({ error: `Run is not waiting for HITL (status: ${run.status})` }, { status: 400 })
  }

  const trace = (run.trace ?? []) as Array<{ type: string; nodeId?: string; message: string; data?: unknown; ts: number }>
  const pauseEvent = trace.find(e => e.type === 'hitl_pause')
  const messages = trace.filter(e => e.type === 'hitl_message')
  const savedOutput = run.output as { checkpoint?: string; partial?: unknown; question?: string } | null

  return NextResponse.json({
    runId,
    agentId: run.agent_id,
    status: run.status,
    checkpoint: savedOutput?.checkpoint,
    partial: savedOutput?.partial,
    question: savedOutput?.question ?? pauseEvent?.message ?? 'Awaiting your review',
    messages: messages.map(e => {
      const d = e.data as { role?: string; content?: string } | undefined
      return { role: d?.role ?? 'agent', content: d?.content ?? e.message, ts: e.ts }
    }),
    createdAt: run.created_at,
  })
}
