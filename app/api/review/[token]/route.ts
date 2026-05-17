import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyReviewToken } from '@/lib/review-token'
import { executeAgent } from '@/lib/executor/dag-executor'
import { fireWebhook } from '@/lib/webhook'
import { v4 as uuidv4 } from 'uuid'

async function resolveRun(token: string) {
  const runId = verifyReviewToken(token)
  if (!runId) return { error: 'Invalid or expired review link.', status: 401 }
  const db = createAdminClient()
  const { data: run } = await db.from('agent_runs').select('*').eq('id', runId).single()
  if (!run) return { error: 'Run not found.', status: 404 }
  if (run.status !== 'waiting_hitl') return { error: `This review has already been completed (status: ${run.status}).`, status: 409 }
  return { run, db }
}

// GET /api/review/:token — fetch run context for the review page (no auth)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const result = await resolveRun(token)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { run } = result
  const out = run.output as { question?: string; partial?: unknown } | null
  return NextResponse.json({
    runId: run.id,
    agentName: run.agent_name,
    question: out?.question ?? 'Please review the output before the pipeline continues.',
    partial: out?.partial ?? null,
    createdAt: run.created_at,
  })
}

// POST /api/review/:token — submit approve / revise / reject (no auth)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const resolved = await resolveRun(token)
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  const { run, db } = resolved

  const body = await req.json().catch(() => ({}))
  const action   = (body.action   as string)  ?? 'approve'   // 'approve' | 'revise' | 'reject'
  const feedback = (body.feedback as string)?.trim() ?? undefined

  // Reject — mark run completed, no resume
  if (action === 'reject') {
    const msg = feedback ? `Rejected by reviewer: ${feedback}` : 'Rejected by reviewer.'
    const savedOut = run.output as { checkpoint?: string } | null
    const checkpointId = savedOut?.checkpoint
    const rejectEvent = checkpointId
      ? [{ type: 'node_done', nodeId: checkpointId, message: 'Review rejected', ts: Date.now(), data: { output: 'rejected' } }]
      : []
    await db.from('agent_runs').update({ status: 'completed', output: { rejected: true, message: msg }, error: null, trace: [...(run.trace ?? []), ...rejectEvent] }).eq('id', run.id)
    const runInput = run.input as Record<string, unknown> | null
    const cbUrl = runInput?._callbackUrl; const cbSecret = runInput?._webhookSecret
    if (typeof cbUrl === 'string' && cbUrl) {
      void fireWebhook(cbUrl, { runId: run.id, agentId: run.agent_id, agentName: run.agent_name, status: 'completed', output: { rejected: true, message: msg } }, typeof cbSecret === 'string' ? cbSecret : undefined)
    }
    return NextResponse.json({ status: 'rejected', message: msg })
  }

  // Load agent + configs (needed for resume)
  const { data: agent } = await db.from('agents').select('*').eq('id', run.agent_id).single()
  if (!agent) return NextResponse.json({ error: 'Agent not found.' }, { status: 404 })

  const modelConfigs: Record<string, { provider: 'google' | 'openai-compatible' | 'anthropic' | 'ollama'; modelId: string; apiKey?: string; baseUrl?: string }> = {}
  if (agent.user_id) {
    const { data: rows } = await db.from('models').select('*').eq('user_id', agent.user_id)
    for (const m of (rows ?? [])) modelConfigs[m.name] = { provider: m.provider ?? 'google', modelId: m.model_id ?? m.name, apiKey: m.api_key, baseUrl: m.base_url }
  }

  const schema = agent.schema as { nodes: Array<{ data: Record<string, unknown> }>; edges: unknown[] }
  if (agent.user_id && schema?.nodes) {
    const { data: toolRows } = await db.from('tools').select('*').eq('user_id', agent.user_id)
    const toolMap: Record<string, Record<string, unknown>> = {}
    for (const t of (toolRows ?? [])) toolMap[t.name] = t
    for (const node of schema.nodes) {
      if (node.data.nodeType === 'tool' && node.data.toolName) {
        const t = toolMap[node.data.toolName as string]
        if (t) {
          const inline = node.data.toolConfig as Record<string, unknown> | undefined
          node.data.toolConfig = { endpoint: t.endpoint ?? '', method: t.method ?? 'POST', headers: t.headers ?? {}, timeout: t.timeout ?? 5000, type: t.type ?? inline?.type ?? 'http', input_schema: { ...((inline?.input_schema as Record<string, unknown>) ?? {}), ...((t.input_schema as Record<string, unknown>) ?? {}) } }
        }
      }
    }
  }

  const savedOutput = run.output as { checkpoint?: string; partial?: unknown } | null
  const checkpointNodeId = savedOutput?.checkpoint
  if (!checkpointNodeId) return NextResponse.json({ error: 'No checkpoint in run.' }, { status: 400 })

  // Revise — re-run node before HITL with feedback
  let resumeCheckpoint = checkpointNodeId
  const resumeAction = action === 'revise' ? 'revise' : 'approve'
  if (action === 'revise') {
    const edges = (schema as { nodes: unknown[]; edges: Array<{ source: string; target: string }> }).edges
    const incomingEdge = edges.find(e => e.target === checkpointNodeId)
    if (incomingEdge) resumeCheckpoint = incomingEdge.source
  }

  const datatableImportData: Record<string, unknown[]> = {}
  const datatableWriter = async (datatableId: string, row: Record<string, unknown>) => {
    await db.from('datatable_rows').insert({ id: uuidv4(), datatable_id: datatableId, user_id: agent.user_id ?? '', data: row, created_at: new Date().toISOString() })
  }

  const result = await executeAgent(
    schema as never, run.input as Record<string, unknown>,
    run.agent_id, run.id, undefined,
    { checkpointNodeId: resumeCheckpoint, partialOutput: savedOutput?.partial, feedback, action: resumeAction },
    modelConfigs, undefined, undefined, datatableImportData, datatableWriter
  )

  await db.from('agent_runs').update({
    output: result.output as object ?? null, status: result.status,
    tokens: (run.tokens ?? 0) + result.tokens, latency_ms: (run.latency_ms ?? 0) + result.latencyMs,
    error: result.error ?? null, trace: [...(run.trace ?? []), ...result.trace],
  }).eq('id', run.id)

  const runInput = run.input as Record<string, unknown> | null
  const cbUrl = runInput?._callbackUrl; const cbSecret = runInput?._webhookSecret
  if (typeof cbUrl === 'string' && cbUrl && result.status !== 'waiting_hitl') {
    void fireWebhook(cbUrl, { runId: run.id, agentId: run.agent_id, agentName: run.agent_name, output: result.output, status: result.status, tokens: (run.tokens ?? 0) + result.tokens }, typeof cbSecret === 'string' ? cbSecret : undefined)
  }

  return NextResponse.json({ status: result.status, output: result.output, error: result.error ?? null })
}
