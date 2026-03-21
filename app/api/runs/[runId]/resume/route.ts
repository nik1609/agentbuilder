import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { executeAgent } from '@/lib/executor/dag-executor'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const db = createAdminClient()
  const startTime = Date.now()

  // ── 1. Load the paused run ────────────────────────────────────────────────
  const { data: run, error: runError } = await db
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .single()

  if (runError || !run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }
  if (run.status !== 'waiting_hitl') {
    return NextResponse.json({ error: `Run is not waiting for HITL (status: ${run.status})` }, { status: 400 })
  }

  // ── 2. Parse resume body ──────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  const feedback: string | undefined = body.feedback?.trim() || undefined

  // ── 3. Load agent schema ──────────────────────────────────────────────────
  const { data: agent, error: agentError } = await db
    .from('agents')
    .select('*')
    .eq('id', run.agent_id)
    .single()

  if (agentError || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  // ── 4. Load model configs for this agent's owner ──────────────────────────
  const modelConfigs: Record<string, { provider: 'google' | 'openai-compatible' | 'anthropic' | 'ollama'; modelId: string; apiKey?: string; baseUrl?: string; temperature?: number; maxTokens?: number }> = {}
  if (agent.user_id) {
    const { data: modelRows } = await db.from('models').select('*').eq('user_id', agent.user_id)
    for (const m of (modelRows ?? [])) {
      modelConfigs[m.name] = {
        provider: (m.provider as 'google' | 'openai-compatible' | 'anthropic' | 'ollama') ?? 'google',
        modelId: m.model_id ?? m.name,
        apiKey: m.api_key ?? undefined,
        baseUrl: m.base_url ?? undefined,
        temperature: m.temperature ?? undefined,
        maxTokens: m.max_tokens ?? undefined,
      }
    }
  }

  // ── 5. Inject tool configs into schema nodes ──────────────────────────────
  const schema = agent.schema as { nodes: Array<{ data: Record<string, unknown> }>; edges: unknown[] }
  if (agent.user_id && schema?.nodes) {
    const { data: toolRows } = await db.from('tools').select('*').eq('user_id', agent.user_id)
    const toolMap: Record<string, Record<string, unknown>> = {}
    for (const t of (toolRows ?? [])) toolMap[t.name] = t
    for (const node of schema.nodes) {
      if (node.data.nodeType === 'tool' && node.data.toolName) {
        const t = toolMap[node.data.toolName as string]
        if (t) {
          node.data.toolConfig = {
            endpoint: t.endpoint ?? '',
            method: t.method ?? 'POST',
            headers: t.headers ?? {},
            timeout: t.timeout ?? 5000,
            type: t.type ?? 'http',
          }
        }
      }
    }
  }

  // ── 6. Extract checkpoint info from saved run output ──────────────────────
  const savedOutput = run.output as { checkpoint?: string; partial?: unknown } | null
  const checkpointNodeId = savedOutput?.checkpoint
  const partialOutput = savedOutput?.partial ?? run.input

  if (!checkpointNodeId) {
    return NextResponse.json({ error: 'No checkpoint found in run output' }, { status: 400 })
  }

  // ── 7. Resume execution ───────────────────────────────────────────────────
  const result = await executeAgent(
    schema as never,
    run.input as Record<string, unknown>,
    run.agent_id,
    runId,
    undefined,
    { checkpointNodeId, partialOutput, feedback },
    modelConfigs
  )

  // ── 8. Update run record ──────────────────────────────────────────────────
  await db.from('agent_runs').update({
    output: result.output as object ?? null,
    status: result.status,
    tokens: (run.tokens ?? 0) + result.tokens,
    latency_ms: (run.latency_ms ?? 0) + result.latencyMs,
    error: result.error ?? null,
    trace: [...(run.trace ?? []), ...result.trace],
  }).eq('id', runId)

  return NextResponse.json({
    runId,
    agentId: run.agent_id,
    agentName: run.agent_name,
    output: result.output,
    status: result.status,
    tokens: (run.tokens ?? 0) + result.tokens,
    latencyMs: (run.latency_ms ?? 0) + result.latencyMs,
    trace: result.trace,
    error: result.error ?? null,
  })
}
