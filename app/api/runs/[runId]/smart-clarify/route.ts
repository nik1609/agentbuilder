/**
 * POST /api/runs/:runId/smart-clarify
 * Body: { answer: string, pendingQuestion: string }
 *
 * When the agent has orchestrator enabled, this intercepts the clarify answer:
 *   CONTINUE  → user answered the question → forward to normal /clarify
 *   ANSWER    → user asked a domain question → reply inline, keep run paused
 *   RESPOND   → off-topic / stop → reply inline, keep run paused (or cancel if "stop/cancel")
 *
 * When orchestrator is disabled, behaves identically to /clarify.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth'
import { callLLM } from '@/lib/llm'
import { executeAgent } from '@/lib/executor/dag-executor'
import { fireWebhook } from '@/lib/webhook'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { runId } = await params
  const db = createAdminClient()

  const { data: run } = await db.from('agent_runs').select('*').eq('id', runId).eq('user_id', userId).single()
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status !== 'waiting_clarify') return NextResponse.json({ error: `Not waiting for clarification (${run.status})` }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const answer: string = (body.answer as string)?.trim() || ''
  const pendingQuestion: string = (body.pendingQuestion as string) || ''
  if (!answer) return NextResponse.json({ error: 'answer is required' }, { status: 400 })

  // Load agent
  const { data: agent } = await db.from('agents').select('*').eq('id', run.agent_id).single()
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const schema = agent.schema as { nodes: Array<{ data: Record<string, unknown> }>; edges: unknown[]; orchestratorConfig?: { enabled?: boolean; model?: string } }
  const orchCfg = schema.orchestratorConfig

  // ── Skip orchestrator if not enabled ────────────────────────────────────────
  if (!orchCfg?.enabled) {
    return forwardToClarify(run, agent, answer, runId, db)
  }

  // ── Orchestrator classification ──────────────────────────────────────────────
  const modelConfigs: Record<string, { provider: string; modelId: string; apiKey?: string; baseUrl?: string }> = {}
  const { data: modelRows } = await db.from('models').select('*').eq('user_id', userId)
  for (const m of (modelRows ?? [])) {
    modelConfigs[m.name] = { provider: m.provider ?? 'google', modelId: m.model_id ?? m.name, apiKey: m.api_key, baseUrl: m.base_url }
  }

  const orchModelKey = orchCfg.model
  const orchModel = orchModelKey ? modelConfigs[orchModelKey] : Object.values(modelConfigs)[0]

  const agentName: string = agent.name ?? 'this agent'
  const agentDesc: string = (agent as Record<string, unknown>).description as string ?? ''

  const classifyPrompt = `You are a routing controller for an AI agent in a conversation.

Agent: ${agentName}${agentDesc ? `\nPurpose: ${agentDesc}` : ''}

The agent is currently PAUSED, waiting for the user to answer this question:
"${pendingQuestion || 'Please provide the required information.'}"

The user just sent: "${answer}"

Classify the user's message. Reply with EXACTLY one of these (no other text):

CONTINUE
ANSWER
RESPOND
CANCEL

Rules:
- CONTINUE if the message is actually answering the pending question (even partially)
- ANSWER if the user is asking a question about this agent or its domain instead of answering
- RESPOND if the message is casual chat, greeting, or off-topic
- CANCEL if the user says "stop", "cancel", "quit", "abort", "never mind" or similar`

  let classification = 'CONTINUE'
  try {
    const { text } = await callLLM({
      provider: (orchModel?.provider ?? 'google') as Parameters<typeof callLLM>[0]['provider'],
      model: orchModel?.modelId,
      apiKey: orchModel?.apiKey,
      baseUrl: orchModel?.baseUrl,
      userMessage: classifyPrompt,
      temperature: 0,
      maxTokens: 10,
    })
    classification = text.trim().toUpperCase().split('\n')[0].split(' ')[0]
  } catch {
    // Orchestrator failed — fall through to normal clarify
    return forwardToClarify(run, agent, answer, runId, db)
  }

  // ── CANCEL — user wants to stop ──────────────────────────────────────────────
  if (classification === 'CANCEL') {
    const cancelMsg = 'Okay, I\'ve cancelled this. Feel free to start over whenever you\'re ready.'
    await db.from('agent_runs').update({ status: 'completed', output: { cancelled: true, message: cancelMsg } }).eq('id', runId)
    return NextResponse.json({ action: 'cancel', reply: cancelMsg, runId, status: 'completed' })
  }

  // ── ANSWER or RESPOND — reply inline, keep run paused ───────────────────────
  if (classification === 'ANSWER' || classification === 'RESPOND') {
    const replyPrompt = classification === 'ANSWER'
      ? `You are ${agentName}.${agentDesc ? ` ${agentDesc}` : ''}

The user asked a question while the agent is paused waiting for: "${pendingQuestion}"

Answer their question helpfully and briefly, then remind them that the agent is still waiting for their answer.

User's question: "${answer}"`
      : `You are ${agentName}.${agentDesc ? ` ${agentDesc}` : ''} The user sent a casual message while the agent is paused.

Respond naturally and briefly, then remind them that the agent is still waiting for: "${pendingQuestion}"

User's message: "${answer}"`

    let reply = `I'll need your answer to continue: "${pendingQuestion}"`
    try {
      const { text } = await callLLM({
        provider: (orchModel?.provider ?? 'google') as Parameters<typeof callLLM>[0]['provider'],
        model: orchModel?.modelId,
        apiKey: orchModel?.apiKey,
        baseUrl: orchModel?.baseUrl,
        userMessage: replyPrompt,
        temperature: 0.7,
        maxTokens: 200,
      })
      reply = text.trim()
    } catch (err) { console.error('[smart-clarify] reply generation failed:', err) }

    // Run stays paused — return inline reply
    return NextResponse.json({ action: 'reply', reply, runId, status: 'waiting_clarify' })
  }

  // ── CONTINUE — forward to normal clarify flow ────────────────────────────────
  return forwardToClarify(run, agent, answer, runId, db)
}

async function forwardToClarify(
  run: Record<string, unknown>,
  agent: Record<string, unknown>,
  answer: string,
  runId: string,
  db: ReturnType<typeof import('@/lib/supabase/server').createAdminClient>
): Promise<NextResponse> {
  const modelConfigs: Record<string, { provider: 'google' | 'openai-compatible' | 'anthropic' | 'ollama'; modelId: string; apiKey?: string; baseUrl?: string }> = {}
  const userId = agent.user_id as string
  if (userId) {
    const { data: rows } = await db.from('models').select('*').eq('user_id', userId)
    for (const m of (rows ?? [])) modelConfigs[m.name] = { provider: m.provider ?? 'google', modelId: m.model_id ?? m.name, apiKey: m.api_key, baseUrl: m.base_url }
  }

  const schema = agent.schema as { nodes: Array<{ data: Record<string, unknown> }>; edges: unknown[] }
  if (userId && schema?.nodes) {
    const { data: toolRows } = await db.from('tools').select('*').eq('user_id', userId)
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
  if (!checkpointNodeId) return NextResponse.json({ error: 'No checkpoint' }, { status: 400 })

  const datatableImportData: Record<string, unknown[]> = {}
  const datatableWriter = async (datatableId: string, row: Record<string, unknown>) => {
    await db.from('datatable_rows').insert({ id: uuidv4(), datatable_id: datatableId, user_id: userId ?? '', data: row, created_at: new Date().toISOString() })
  }

  const trace = (run.trace ?? []) as unknown[]
  trace.push({ type: 'clarify_message', ts: Date.now(), message: answer, data: { role: 'human', content: answer } })

  const result = await executeAgent(
    schema as never, run.input as Record<string, unknown>,
    run.agent_id as string, runId, undefined,
    { checkpointNodeId, partialOutput: savedOutput?.partial, clarifyAnswer: answer },
    modelConfigs, undefined, undefined, datatableImportData, datatableWriter
  )

  await db.from('agent_runs').update({
    output: result.output as object ?? null, status: result.status,
    tokens: ((run.tokens as number) ?? 0) + result.tokens,
    latency_ms: ((run.latency_ms as number) ?? 0) + result.latencyMs,
    error: result.error ?? null,
    trace: [...trace, ...result.trace],
  }).eq('id', runId)

  const responseBody = { runId, agentId: run.agent_id, output: result.output, status: result.status, tokens: ((run.tokens as number) ?? 0) + result.tokens, error: result.error ?? null }

  const runInput = run.input as Record<string, unknown> | null
  const cbUrl = runInput?._callbackUrl; const cbSecret = runInput?._webhookSecret
  if (typeof cbUrl === 'string' && cbUrl && result.status !== 'waiting_clarify' && result.status !== 'waiting_hitl') {
    void fireWebhook(cbUrl, responseBody, typeof cbSecret === 'string' ? cbSecret : undefined)
  }

  return NextResponse.json(responseBody)
}
