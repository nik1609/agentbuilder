/**
 * GET /api/sessions/:sessionId/stream
 * SSE stream for a session created via POST /api/agents/:agentId/sessions.
 * Executes the agent and streams trace events + final result.
 *
 * The session run record was pre-created by the sessions POST handler.
 * This handler finds it via the __sessionId marker in output, then executes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { executeAgent } from '@/lib/executor/dag-executor'
import { GuardrailData, AgentRunsHistory } from '@/lib/executor/types'
import { MemorySource } from '@/types/agent'
import { v4 as uuidv4 } from 'uuid'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const db = createAdminClient()

  // Find the run by sessionId marker
  const { data: run, error: runError } = await db
    .from('agent_runs')
    .select('*')
    .filter('output->>__sessionId', 'eq', sessionId)
    .single()

  if (runError || !run) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (run.status !== 'running') {
    // Session already executed — return final state as single SSE
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const send = (d: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`))
        send({ type: 'done', runId: run.id, output: run.output, status: run.status, tokens: run.tokens, error: run.error })
        controller.close()
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' } })
  }

  const runId = run.id
  const agentId = run.agent_id

  // Load agent
  const { data: agent } = await db.from('agents').select('*').eq('id', agentId).single()
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const effectiveUserId = run.user_id ?? agent.user_id
  const schema = agent.schema as { nodes: Array<{ data: Record<string, unknown> }>; edges: unknown[] }

  // Load model configs
  const modelConfigs: Record<string, { provider: 'google' | 'openai-compatible' | 'anthropic' | 'ollama'; modelId: string; apiKey?: string; baseUrl?: string }> = {}
  if (effectiveUserId) {
    const { data: rows } = await db.from('models').select('*').eq('user_id', effectiveUserId)
    for (const m of (rows ?? [])) modelConfigs[m.name] = { provider: m.provider ?? 'google', modelId: m.model_id ?? m.name, apiKey: m.api_key, baseUrl: m.base_url }
  }

  // Inject tool configs
  if (effectiveUserId && schema?.nodes) {
    const { data: toolRows } = await db.from('tools').select('*').eq('user_id', effectiveUserId)
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

  // Load guardrails
  const guardrailMap: Record<string, GuardrailData> = {}
  if (effectiveUserId) {
    const { data: rows } = await db.from('guardrails').select('*').eq('user_id', effectiveUserId)
    for (const g of (rows ?? [])) guardrailMap[g.id] = { inputRules: g.input_rules ?? [], outputRules: g.output_rules ?? [] }
  }

  // Load memory history
  const agentRunsHistory: AgentRunsHistory = {}
  if (effectiveUserId && schema?.nodes) {
    const memoryConfigIds = new Set<string>()
    for (const node of schema.nodes) {
      if (node.data.nodeType === 'llm') {
        for (const src of ((node.data.memorySources as MemorySource[] | undefined) ?? [])) {
          if (src.type === 'agent_runs' && src.memoryConfigId) memoryConfigIds.add(src.memoryConfigId)
        }
      }
    }
    if (memoryConfigIds.size > 0) {
      const { data: memRows } = await db.from('memory_configs').select('*').in('id', [...memoryConfigIds])
      for (const cfg of (memRows ?? [])) {
        const limit = cfg.type === 'full' ? 50 : (cfg.window_size ?? 5)
        const { data: pastRuns } = await db.from('agent_runs').select('input, output, created_at').eq('agent_id', agentId).eq('status', 'completed').order('created_at', { ascending: false }).limit(limit)
        if (pastRuns?.length) {
          agentRunsHistory[cfg.id] = pastRuns.reverse().map((r, i) => {
            const userMsg = typeof r.input === 'object' ? (r.input as Record<string, unknown>).message ?? JSON.stringify(r.input) : String(r.input)
            const assistantMsg = typeof r.output === 'string' ? r.output : JSON.stringify(r.output)
            return `[Turn ${i + 1}] User: ${userMsg}\nAssistant: ${assistantMsg}`
          }).join('\n\n')
        }
      }
    }
  }

  // Datatable
  const datatableImportData: Record<string, unknown[]> = {}
  if (effectiveUserId && schema?.nodes) {
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
    const { error } = await db.from('datatable_rows').insert({ id: uuidv4(), datatable_id: datatableId, user_id: effectiveUserId ?? '', data: row, created_at: new Date().toISOString() })
    if (error) throw new Error(`Datatable insert failed: ${error.message}`)
  }

  const input = run.input as Record<string, unknown>
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* disconnected */ }
      }

      send({ type: 'start', sessionId, runId, agentId, agentName: agent.name })

      try {
        const result = await executeAgent(
          schema as never, input, agentId, runId,
          (event) => send({ type: 'trace', event }),
          undefined, modelConfigs, guardrailMap, agentRunsHistory, datatableImportData, datatableWriter,
          (nodeId, token) => send({ type: 'token', nodeId, token })
        )

        await db.from('agent_runs').update({
          output: result.output as object ?? null,
          status: result.status,
          tokens: result.tokens,
          latency_ms: result.latencyMs,
          error: result.error ?? null,
          trace: result.trace,
        }).eq('id', runId)

        if (result.status === 'waiting_hitl') {
          const hitlOut = result.output as { checkpoint?: string; partial?: unknown } | null
          send({
            type: 'hitl_pause', sessionId, runId,
            checkpoint: hitlOut?.checkpoint, partial: hitlOut?.partial,
            approveUrl: `/api/runs/${runId}/hitl/approve`,
            rejectUrl: `/api/runs/${runId}/hitl/reject`,
            messagesUrl: `/api/runs/${runId}/hitl`,
          })
        }

        send({ type: 'done', sessionId, runId, output: result.output, tokens: result.tokens, latencyMs: result.latencyMs, status: result.status, error: result.error ?? null })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await db.from('agent_runs').update({ status: 'failed', error: msg }).eq('id', runId)
        send({ type: 'error', message: msg })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-AgentHub-Key',
    },
  })
}
