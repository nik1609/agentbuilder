/**
 * POST /api/runs/:runId/clarify
 * Body: { answer: string }
 * Submits the user's clarifying answer and resumes execution.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth'
import { executeAgent } from '@/lib/executor/dag-executor'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { runId } = await params
  const db = createAdminClient()

  const { data: run, error: runError } = await db
    .from('agent_runs').select('*').eq('id', runId).eq('user_id', userId).single()
  if (runError || !run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status !== 'waiting_clarify') {
    return NextResponse.json({ error: `Run is not waiting for clarification (status: ${run.status})` }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const answer: string = (body.answer as string)?.trim() || ''
  if (!answer) return NextResponse.json({ error: 'answer is required' }, { status: 400 })

  // Load agent
  const { data: agent } = await db.from('agents').select('*').eq('id', run.agent_id).single()
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  // Load model configs
  const modelConfigs: Record<string, { provider: 'google' | 'openai-compatible' | 'anthropic' | 'ollama'; modelId: string; apiKey?: string; baseUrl?: string }> = {}
  if (agent.user_id) {
    const { data: rows } = await db.from('models').select('*').eq('user_id', agent.user_id)
    for (const m of (rows ?? [])) modelConfigs[m.name] = { provider: m.provider ?? 'google', modelId: m.model_id ?? m.name, apiKey: m.api_key, baseUrl: m.base_url }
  }

  // Inject tools
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
          node.data.toolConfig = {
            endpoint: t.endpoint ?? '', method: t.method ?? 'POST', headers: t.headers ?? {},
            timeout: t.timeout ?? 5000, type: t.type ?? inline?.type ?? 'http',
            input_schema: { ...((inline?.input_schema as Record<string, unknown>) ?? {}), ...((t.input_schema as Record<string, unknown>) ?? {}) },
          }
        }
      }
    }
  }

  // Datatable
  const datatableImportData: Record<string, unknown[]> = {}
  if (agent.user_id && schema?.nodes) {
    for (const node of schema.nodes) {
      if (node.data.nodeType === 'tool') {
        const cfg = node.data.toolConfig as Record<string, unknown> | undefined
        const sch = cfg?.input_schema as Record<string, unknown> | undefined
        if (cfg?.type === 'datatable' && sch?.mode === 'import' && sch.datatable_id) {
          const dtId = sch.datatable_id as string
          if (!datatableImportData[dtId]) {
            const { data: rows } = await db.from('datatable_rows').select('data').eq('datatable_id', dtId)
            datatableImportData[dtId] = (rows ?? []).map(r => r.data as unknown)
          }
        }
      }
    }
  }
  const datatableWriter = async (datatableId: string, row: Record<string, unknown>) => {
    const { error } = await db.from('datatable_rows').insert({ id: uuidv4(), datatable_id: datatableId, user_id: agent.user_id ?? '', data: row, created_at: new Date().toISOString() })
    if (error) throw new Error(`Datatable insert failed: ${error.message}`)
  }

  const savedOutput = run.output as { question?: string; checkpoint?: string; partial?: unknown } | null
  const checkpointNodeId = savedOutput?.checkpoint
  if (!checkpointNodeId) return NextResponse.json({ error: 'No checkpoint in run output' }, { status: 400 })

  // Append clarify answer event to trace
  const trace = (run.trace ?? []) as unknown[]
  trace.push({ type: 'clarify_message', ts: Date.now(), message: answer, data: { role: 'human', content: answer } })

  const result = await executeAgent(
    schema as never, run.input as Record<string, unknown>,
    run.agent_id, runId, undefined,
    { checkpointNodeId, partialOutput: savedOutput?.partial, clarifyAnswer: answer },
    modelConfigs, undefined, undefined, datatableImportData, datatableWriter
  )

  await db.from('agent_runs').update({
    output: result.output as object ?? null, status: result.status,
    tokens: (run.tokens ?? 0) + result.tokens,
    latency_ms: (run.latency_ms ?? 0) + result.latencyMs,
    error: result.error ?? null,
    trace: [...trace, ...result.trace],
  }).eq('id', runId)

  return NextResponse.json({ runId, agentId: run.agent_id, output: result.output, status: result.status, tokens: (run.tokens ?? 0) + result.tokens, error: result.error ?? null })
}
