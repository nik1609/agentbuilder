/**
 * Agent Run Endpoint — the core feature
 *
 * POST /api/agents/:agentId/run
 * Headers: X-AgentHub-Key: ahk_...   (omit or use "test" for dashboard testing)
 * Body: { message: "...", conversationHistory?: [{role, content}][], ...any other input }
 *
 * Returns: { runId, output, tokens, latencyMs, status, trace }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { executeAgent } from '@/lib/executor/dag-executor'
import { getUserFromSession, getUserFromApiKey, hashApiKey } from '@/lib/auth'
import { GuardrailData, AgentRunsHistory } from '@/lib/executor/types'
import { MemorySource } from '@/types/agent'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const db = createAdminClient()
  const runId = uuidv4()
  const startTime = Date.now()

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const sessionUserId = await getUserFromSession()
  const apiKeyUserId = !sessionUserId ? await getUserFromApiKey(req) : null
  const resolvedUserId = sessionUserId ?? apiKeyUserId

  let keyRecord: { id: string; key_prefix: string; total_calls: number } | null = null
  const apiKeyHeader = req.headers.get('X-AgentHub-Key') || req.headers.get('x-agenthub-key')
  const isTestMode = !apiKeyHeader || apiKeyHeader === 'test'

  if (!resolvedUserId && !isTestMode) {
    return NextResponse.json({ error: 'Unauthorized. Pass X-AgentHub-Key header or sign in.' }, { status: 401 })
  }

  if (!isTestMode && apiKeyHeader) {
    const keyHash = hashApiKey(apiKeyHeader)
    const { data } = await db.from('api_keys').select('id, key_prefix, total_calls').eq('key_hash', keyHash).eq('is_active', true).single()
    if (!data) return NextResponse.json({ error: 'Invalid or revoked API key.' }, { status: 403 })
    keyRecord = data
  }

  // ── 2. Load Agent ─────────────────────────────────────────────────────────
  const agentQuery = db.from('agents').select('*').eq('id', agentId)
  if (resolvedUserId) agentQuery.eq('user_id', resolvedUserId)
  const { data: agent, error: agentError } = await agentQuery.single()
  if (agentError || !agent) return NextResponse.json({ error: `Agent ${agentId} not found.` }, { status: 404 })

  const effectiveUserId = resolvedUserId ?? agent.user_id
  const schema = agent.schema as { nodes: Array<{ data: Record<string, unknown> }>; edges: unknown[] }

  // ── 3. Load model configs ─────────────────────────────────────────────────
  const modelConfigs: Record<string, { provider: 'google' | 'openai-compatible' | 'anthropic' | 'ollama'; modelId: string; apiKey?: string; baseUrl?: string }> = {}
  if (effectiveUserId) {
    const { data: modelRows } = await db.from('models').select('*').eq('user_id', effectiveUserId)
    for (const m of (modelRows ?? [])) {
      modelConfigs[m.name] = {
        provider: (m.provider as 'google' | 'openai-compatible' | 'anthropic' | 'ollama') ?? 'google',
        modelId: m.model_id ?? m.name,
        apiKey: m.api_key ?? undefined,
        baseUrl: m.base_url ?? undefined,
      }
    }
  }

  // ── 4. Inject tool configs into schema nodes ──────────────────────────────
  if (effectiveUserId && schema?.nodes) {
    const { data: toolRows } = await db.from('tools').select('*').eq('user_id', effectiveUserId)
    const toolMap: Record<string, Record<string, unknown>> = {}
    for (const t of (toolRows ?? [])) toolMap[t.name] = t
    for (const node of schema.nodes) {
      if (node.data.nodeType === 'tool' && node.data.toolName) {
        const t = toolMap[node.data.toolName as string]
        if (t) {
          // DB record wins; but merge with inline toolConfig for fields the DB record may lack
          const inline = node.data.toolConfig as Record<string, unknown> | undefined
          const dbSchema = (t.input_schema as Record<string, unknown>) ?? {}
          const inlineSchema = (inline?.input_schema as Record<string, unknown>) ?? {}
          node.data.toolConfig = {
            endpoint: t.endpoint ?? '',
            method: t.method ?? 'POST',
            headers: t.headers ?? {},
            timeout: t.timeout ?? 5000,
            type: t.type ?? inline?.type ?? 'http',
            // Merge: inline provides fields DB might lack (e.g. mode saved before DB PATCH applied)
            input_schema: { ...inlineSchema, ...dbSchema },
          }
        }
        // If no DB match, keep existing inline toolConfig from node data (set by canvas save)
      }
    }
  }

  // ── 5. Load guardrails map ────────────────────────────────────────────────
  const guardrailMap: Record<string, GuardrailData> = {}
  if (effectiveUserId) {
    const { data: guardrailRows } = await db.from('guardrails').select('*').eq('user_id', effectiveUserId)
    for (const g of (guardrailRows ?? [])) {
      guardrailMap[g.id] = {
        inputRules: (g.input_rules ?? []) as { text: string }[],
        outputRules: (g.output_rules ?? []) as { text: string }[],
      }
    }
  }

  // ── 6. Load memory history for agent_runs sources ─────────────────────────
  const agentRunsHistory: AgentRunsHistory = {}
  if (effectiveUserId && schema?.nodes) {
    // Collect all unique memoryConfigIds used across LLM nodes
    const memoryConfigIds = new Set<string>()
    for (const node of schema.nodes) {
      if (node.data.nodeType === 'llm') {
        const sources = (node.data.memorySources as MemorySource[] | undefined) ?? []
        for (const src of sources) {
          if (src.type === 'agent_runs' && src.memoryConfigId) memoryConfigIds.add(src.memoryConfigId)
        }
      }
    }

    if (memoryConfigIds.size > 0) {
      const { data: memoryRows } = await db.from('memory_configs').select('*').in('id', [...memoryConfigIds])
      const memoryConfigMap: Record<string, { window_size: number; type: string }> = {}
      for (const m of (memoryRows ?? [])) memoryConfigMap[m.id] = m

      // For each config, load past runs
      for (const configId of memoryConfigIds) {
        const cfg = memoryConfigMap[configId]
        if (!cfg) continue
        const limit = cfg.type === 'full' ? 50 : (cfg.window_size ?? 5)
        const { data: pastRuns } = await db
          .from('agent_runs')
          .select('input, output, created_at')
          .eq('agent_id', agentId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(limit)

        if (pastRuns && pastRuns.length > 0) {
          const history = pastRuns
            .reverse()
            .map((r, i) => {
              const userMsg = typeof r.input === 'object' && r.input !== null ? (r.input as Record<string, unknown>).message ?? JSON.stringify(r.input) : String(r.input)
              const assistantMsg = typeof r.output === 'string' ? r.output : JSON.stringify(r.output)
              return `[Turn ${i + 1}] User: ${userMsg}\nAssistant: ${assistantMsg}`
            })
            .join('\n\n')
          agentRunsHistory[configId] = history
        }
      }
    }
  }

  // ── 6.5. Pre-fetch datatable import data + build writer callback ──────────
  const datatableImportData: Record<string, unknown[]> = {}
  if (effectiveUserId && schema?.nodes) {
    for (const node of schema.nodes) {
      if (node.data.nodeType === 'tool') {
        const cfg = node.data.toolConfig as Record<string, unknown> | undefined
        const sch = cfg?.input_schema as Record<string, unknown> | undefined
        if (cfg?.type === 'datatable' && sch?.mode === 'import') {
          const dtId = sch.datatable_id as string
          if (dtId && !datatableImportData[dtId]) {
            const { data: rows } = await db.from('datatable_rows').select('data').eq('datatable_id', dtId)
            datatableImportData[dtId] = (rows ?? []).map(r => r.data as unknown)
          }
        }
      }
    }
  }
  const datatableWriter = async (datatableId: string, row: Record<string, unknown>) => {
    if (!datatableId) throw new Error('Datatable export failed: no datatable_id configured on the tool node. Re-open the tool node, select a datatable, and click Save Tool Edits.')
    const { error, data: inserted } = await db.from('datatable_rows').insert({
      id: uuidv4(),
      datatable_id: datatableId,
      user_id: effectiveUserId ?? '',
      data: row,
      created_at: new Date().toISOString(),
    }).select('id').single()
    if (error) throw new Error(`Datatable insert failed [datatable_id=${datatableId}]: ${error.message}`)
    if (!inserted) throw new Error(`Datatable insert returned no data [datatable_id=${datatableId}] — row may not have been written`)
  }

  // ── 7. Parse input ────────────────────────────────────────────────────────
  let input: Record<string, unknown> = {}
  try { input = await req.json() } catch { input = {} }

  // ── 8. Apply conversation history (chat mode) to message ─────────────────
  const conversationHistory = input.conversationHistory as Array<{ role: string; content: string }> | undefined
  if (conversationHistory && conversationHistory.length > 0 && input.message) {
    const historyText = conversationHistory
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
    input = { ...input, message: `Previous conversation:\n${historyText}\n\nCurrent message: ${input.message}` }
  }

  // ── 9. Create run record ──────────────────────────────────────────────────
  const { error: insertError } = await db.from('agent_runs').insert({
    id: runId, agent_id: agentId, agent_name: agent.name,
    api_key_id: keyRecord?.id ?? null,
    api_key_prefix: keyRecord?.key_prefix ?? (isTestMode ? 'test' : null),
    input, status: 'running', trace: [], created_at: new Date().toISOString(),
    user_id: effectiveUserId ?? null,
  })
  if (insertError) {
    console.error('[run] Failed to insert agent_run:', insertError.message)
    return NextResponse.json({ error: `DB error: ${insertError.message}` }, { status: 500 })
  }

  // ── 10. Execute agent ─────────────────────────────────────────────────────
  let result
  try {
    result = await executeAgent(schema as never, input, agentId, runId, undefined, undefined, modelConfigs, guardrailMap, agentRunsHistory, datatableImportData, datatableWriter)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.from('agent_runs').update({ status: 'failed', error: msg, latency_ms: Date.now() - startTime, trace: [] }).eq('id', runId)
    return NextResponse.json({ runId, agentId, agentName: agent.name, status: 'failed', error: msg, output: null, tokens: 0, latencyMs: Date.now() - startTime }, { status: 500 })
  }

  // ── 11. Persist run ───────────────────────────────────────────────────────
  await db.from('agent_runs').update({
    output: result.output as object ?? null, status: result.status,
    tokens: result.tokens, latency_ms: result.latencyMs,
    error: result.error ?? null, trace: result.trace,
  }).eq('id', runId)

  if (keyRecord) {
    await db.from('api_keys').update({ total_calls: (keyRecord.total_calls ?? 0) + 1, last_used: new Date().toISOString() }).eq('id', keyRecord.id)
  }
  await db.from('agents').update({ run_count: (agent.run_count ?? 0) + 1 }).eq('id', agentId)

  return NextResponse.json({
    runId, agentId, agentName: agent.name,
    output: result.output, status: result.status,
    tokens: result.tokens, latencyMs: result.latencyMs,
    trace: result.trace, error: result.error ?? null,
  })
}

// ── SSE Streaming ─────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const db = createAdminClient()

  // Auth
  const sessionUserId = await getUserFromSession()
  const apiKeyHeader = req.headers.get('X-AgentHub-Key') || req.headers.get('x-agenthub-key')
  const isTestMode = !apiKeyHeader || apiKeyHeader === 'test'
  let apiKeyUserId: string | null = null

  if (!sessionUserId && !isTestMode && apiKeyHeader) {
    const keyHash = hashApiKey(apiKeyHeader)
    const { data } = await db.from('api_keys').select('id, user_id').eq('key_hash', keyHash).eq('is_active', true).single()
    if (!data) return NextResponse.json({ error: 'Invalid API key' }, { status: 403 })
    apiKeyUserId = (data as { id: string; user_id: string }).user_id ?? null
  }
  const resolvedUserId = sessionUserId ?? apiKeyUserId

  const agentQuery = db.from('agents').select('*').eq('id', agentId)
  if (resolvedUserId) agentQuery.eq('user_id', resolvedUserId)
  const { data: agent } = await agentQuery.single()
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const effectiveUserId = resolvedUserId ?? agent.user_id

  // Load model configs
  const modelConfigs: Record<string, { provider: 'google' | 'openai-compatible' | 'anthropic' | 'ollama'; modelId: string; apiKey?: string; baseUrl?: string }> = {}
  if (effectiveUserId) {
    const { data: modelRows } = await db.from('models').select('*').eq('user_id', effectiveUserId)
    for (const m of (modelRows ?? [])) {
      modelConfigs[m.name] = { provider: m.provider ?? 'google', modelId: m.model_id ?? m.name, apiKey: m.api_key ?? undefined, baseUrl: m.base_url ?? undefined }
    }
  }

  // Inject tool configs
  const schema = agent.schema as { nodes: Array<{ data: Record<string, unknown> }>; edges: unknown[] }
  if (effectiveUserId && schema?.nodes) {
    const { data: toolRows } = await db.from('tools').select('*').eq('user_id', effectiveUserId)
    const toolMap: Record<string, Record<string, unknown>> = {}
    for (const t of (toolRows ?? [])) toolMap[t.name] = t
    for (const node of schema.nodes) {
      if (node.data.nodeType === 'tool' && node.data.toolName) {
        const t = toolMap[node.data.toolName as string]
        if (t) {
          const inline = node.data.toolConfig as Record<string, unknown> | undefined
          const dbSchema = (t.input_schema as Record<string, unknown>) ?? {}
          const inlineSchema = (inline?.input_schema as Record<string, unknown>) ?? {}
          node.data.toolConfig = {
            endpoint: t.endpoint ?? '',
            method: t.method ?? 'POST',
            headers: t.headers ?? {},
            timeout: t.timeout ?? 5000,
            type: t.type ?? inline?.type ?? 'http',
            input_schema: { ...inlineSchema, ...dbSchema },
          }
        }
      }
    }
  }

  // Pre-fetch datatable import data for SSE
  const sseDatatableImportData: Record<string, unknown[]> = {}
  if (effectiveUserId && schema?.nodes) {
    for (const node of schema.nodes) {
      if (node.data.nodeType === 'tool') {
        const cfg = node.data.toolConfig as Record<string, unknown> | undefined
        const sch = cfg?.input_schema as Record<string, unknown> | undefined
        if (cfg?.type === 'datatable' && sch?.mode === 'import') {
          const dtId = sch.datatable_id as string
          if (dtId && !sseDatatableImportData[dtId]) {
            const { data: rows } = await db.from('datatable_rows').select('data').eq('datatable_id', dtId)
            sseDatatableImportData[dtId] = (rows ?? []).map(r => r.data as unknown)
          }
        }
      }
    }
  }
  const sseDatatableWriter = async (datatableId: string, row: Record<string, unknown>) => {
    if (!datatableId) throw new Error('Datatable export failed: no datatable_id configured on the tool node.')
    const { error, data: inserted } = await db.from('datatable_rows').insert({ id: uuidv4(), datatable_id: datatableId, user_id: effectiveUserId ?? '', data: row, created_at: new Date().toISOString() }).select('id').single()
    if (error) throw new Error(`Datatable insert failed [datatable_id=${datatableId}]: ${error.message}`)
    if (!inserted) throw new Error(`Datatable insert returned no data [datatable_id=${datatableId}]`)
  }

  const url = new URL(req.url)
  const message = url.searchParams.get('message') ?? ''
  const runId = uuidv4()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* client disconnected */ }
      }
      send({ type: 'start', runId, agentId, agentName: agent.name })

      // Create run record up front so resume can find it
      await db.from('agent_runs').insert({
        id: runId, agent_id: agentId, agent_name: agent.name,
        api_key_prefix: isTestMode ? 'test' : 'stream',
        input: { message }, status: 'running', trace: [],
        created_at: new Date().toISOString(),
        user_id: effectiveUserId ?? null,
      })

      try {
        const result = await executeAgent(schema as never, { message }, agentId, runId, (event) => send({ type: 'trace', event }), undefined, modelConfigs, undefined, undefined, sseDatatableImportData, sseDatatableWriter)

        await db.from('agent_runs').update({
          output: result.output as object ?? null, status: result.status,
          tokens: result.tokens, latency_ms: result.latencyMs,
          error: result.error ?? null, trace: result.trace,
        }).eq('id', runId)

        // For HITL: send a dedicated pause event so the client knows to call /resume
        if (result.status === 'waiting_hitl') {
          const hitlOutput = result.output as { checkpoint?: string; partial?: unknown } | null
          send({ type: 'hitl_pause', runId, checkpoint: hitlOutput?.checkpoint, partial: hitlOutput?.partial,
            message: 'Agent paused — POST to /api/runs/' + runId + '/resume to continue' })
        }

        send({ type: 'done', runId, output: result.output, tokens: result.tokens, latencyMs: result.latencyMs, status: result.status, error: result.error ?? null })
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
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
      'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*',
    },
  })
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-AgentHub-Key',
    },
  })
}
