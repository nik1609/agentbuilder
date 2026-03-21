/**
 * DAG Executor — traverses the agent's node graph and executes each node.
 * Supports: LLM nodes, Tool nodes, Condition nodes, HITL nodes.
 * Guardrails: per LLM node, checked before (block) and after (warn) each LLM call.
 * Memory: per LLM node, multiple sources (agent_runs history + upstream node outputs).
 */
import { AgentSchema, AgentNode, AgentEdge, TraceEvent, MemorySource } from '@/types/agent'
import { callLLM } from '@/lib/llm'
import { ExecutionContext, ExecutionResult, ModelRunConfig, NodeResult, GuardrailData, AgentRunsHistory } from './types'

// ─── Topological sort ────────────────────────────────────────────────────────
function topologicalSort(nodes: AgentNode[], edges: AgentEdge[]): AgentNode[] {
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  nodes.forEach((n) => { inDegree.set(n.id, 0); adj.set(n.id, []) })
  edges.forEach((e) => {
    adj.get(e.source)!.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  })

  const queue = nodes.filter((n) => inDegree.get(n.id) === 0)
  const result: AgentNode[] = []

  while (queue.length) {
    const node = queue.shift()!
    result.push(node)
    for (const neighborId of adj.get(node.id) ?? []) {
      const deg = (inDegree.get(neighborId) ?? 1) - 1
      inDegree.set(neighborId, deg)
      if (deg === 0) {
        const n = nodes.find((x) => x.id === neighborId)
        if (n) queue.push(n)
      }
    }
  }
  return result
}

// ─── Build memory context string for an LLM node ─────────────────────────────
function buildMemoryContext(
  memorySources: MemorySource[],
  ctx: ExecutionContext
): string {
  if (!memorySources.length) return ''
  const parts: string[] = []

  for (const src of memorySources) {
    if (src.type === 'agent_runs' && src.memoryConfigId) {
      const history = ctx.agentRunsHistory?.[src.memoryConfigId]
      if (history) parts.push(`[Past Conversations]\n${history}`)
    } else if (src.type === 'node_output' && src.nodeId) {
      const output = ctx.nodeOutputs?.[src.nodeId]
      if (output !== undefined) {
        const label = src.nodeLabel ?? src.nodeId
        const text = typeof output === 'string' ? output : JSON.stringify(output)
        parts.push(`[${label} Output]\n${text}`)
      }
    }
  }

  return parts.length ? `=== Memory Context ===\n${parts.join('\n\n')}\n=== Current Input ===\n` : ''
}

// ─── Check guardrail rules ────────────────────────────────────────────────────
function checkRules(rules: { text: string }[], text: string): string | null {
  const lower = text.toLowerCase()
  for (const rule of rules) {
    const keyword = rule.text.toLowerCase()
    if (keyword && lower.includes(keyword)) return rule.text
  }
  return null
}

// ─── Individual node executors ───────────────────────────────────────────────
async function executeLLMNode(
  node: AgentNode,
  ctx: ExecutionContext,
  userMessage: string
): Promise<NodeResult> {
  const modelKey = node.data.model as string | undefined
  const cfg = modelKey ? ctx.modelConfigs?.[modelKey] : undefined

  const { text, tokens } = await callLLM({
    provider: cfg?.provider ?? 'google',
    model: cfg?.modelId ?? modelKey ?? 'gemini-2.5-flash',
    apiKey: cfg?.apiKey,
    baseUrl: cfg?.baseUrl,
    systemPrompt: node.data.systemPrompt as string | undefined,
    userMessage,
    temperature: cfg?.temperature ?? (node.data.temperature as number | undefined) ?? 0.7,
    maxTokens: cfg?.maxTokens ?? (node.data.maxTokens as number | undefined) ?? 4096,
  })

  return { output: text, tokens }
}

async function executeToolNode(
  node: AgentNode,
  ctx: ExecutionContext
): Promise<NodeResult> {
  const toolCfg = node.data.toolConfig as Record<string, unknown> | undefined
  const endpoint = toolCfg?.endpoint as string | undefined
  const toolType = (toolCfg?.type as string) ?? 'http'

  if (toolType === 'function') {
    const code = endpoint
    if (!code) return { output: `[Function tool ${node.data.toolName} has no code]` }
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('input', `"use strict";\n${code}`)
      const result = await fn(ctx.variables.__last_output ?? ctx.input)
      return { output: result }
    } catch (e) {
      throw new Error(`Function tool ${node.data.toolName} error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (!endpoint) return { output: `[Tool ${node.data.toolName} skipped — no endpoint configured]` }

  const body = {
    input: ctx.variables.__last_output ?? ctx.input,
    ...(toolCfg?.payload as object ?? {}),
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(toolCfg?.headers as Record<string, string> ?? {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout((toolCfg?.timeout as number) ?? 5000),
  })

  if (!res.ok) throw new Error(`Tool ${node.data.toolName} returned ${res.status}`)
  const data = await res.json()
  return { output: data }
}

async function executeConditionNode(
  node: AgentNode,
  ctx: ExecutionContext,
  edges: AgentEdge[]
): Promise<{ output: unknown; nextNodeId?: string }> {
  const condition = node.data.condition ?? 'true'
  const lastOutput = ctx.variables.__last_output

  const { text } = await callLLM({
    provider: 'google',
    systemPrompt: 'You evaluate conditions. Reply with ONLY "true" or "false".',
    userMessage: `Condition: "${condition}"\nContext: ${JSON.stringify(lastOutput)}\n\nIs the condition true?`,
    temperature: 0,
    maxTokens: 10,
  })

  const isTrue = text.trim().toLowerCase().includes('true')
  const outEdges = edges.filter((e) => e.source === node.id)
  const trueEdge = outEdges.find((e) => e.label === 'true' || e.label === 'yes')
  const falseEdge = outEdges.find((e) => e.label === 'false' || e.label === 'no')
  const nextNodeId = isTrue ? trueEdge?.target : falseEdge?.target ?? outEdges[0]?.target

  return { output: lastOutput, nextNodeId }
}

// ─── Main executor ────────────────────────────────────────────────────────────
export interface ResumeOptions {
  checkpointNodeId: string
  partialOutput: unknown
  feedback?: string
}

export async function executeAgent(
  schema: AgentSchema,
  input: Record<string, unknown>,
  agentId: string,
  runId: string,
  onTrace?: (e: TraceEvent) => void,
  resume?: ResumeOptions,
  modelConfigs?: Record<string, ModelRunConfig>,
  guardrailMap?: Record<string, GuardrailData>,
  agentRunsHistory?: AgentRunsHistory
): Promise<ExecutionResult> {
  const startTime = Date.now()
  const trace: TraceEvent[] = []
  let totalTokens = 0

  const seedOutput = resume
    ? resume.feedback
      ? `Reviewer approved with notes: "${resume.feedback}"\n\nPrevious context:\n${JSON.stringify(resume.partialOutput)}`
      : resume.partialOutput
    : (input.message ?? input)

  const ctx: ExecutionContext = {
    agentId, runId, input,
    variables: { __last_output: seedOutput },
    trace, tokens: 0, startTime, onTrace,
    modelConfigs,
    guardrailMap,
    nodeOutputs: {},
    agentRunsHistory,
  }

  const emit = (event: Omit<TraceEvent, 'ts'>) => {
    const t: TraceEvent = { ...event, ts: Date.now() - startTime }
    trace.push(t)
    onTrace?.(t)
  }

  try {
    const { nodes, edges } = schema
    const sorted = topologicalSort(nodes, edges)
    const executableNodes = sorted.filter(
      (n) => n.data.nodeType !== 'input' && n.data.nodeType !== 'output'
    )

    let skipUntilAfter: string | null = resume?.checkpointNodeId ?? null
    let conditionSkipTo: string | null = null

    for (const node of executableNodes) {
      if (skipUntilAfter) {
        if (node.id === skipUntilAfter) { skipUntilAfter = null }
        continue
      }

      if (conditionSkipTo && node.id !== conditionSkipTo) continue
      if (conditionSkipTo === node.id) conditionSkipTo = null

      emit({ type: 'node_start', nodeId: node.id, message: `${node.data.label} started` })

      let result: NodeResult

      switch (node.data.nodeType) {
        case 'llm': {
          const rawInput = typeof ctx.variables.__last_output === 'string'
            ? ctx.variables.__last_output
            : JSON.stringify(ctx.variables.__last_output ?? ctx.input)

          // Build memory context
          const memorySources = (node.data.memorySources as MemorySource[] | undefined) ?? []
          const memoryPrefix = buildMemoryContext(memorySources, ctx)
          const userMessage = memoryPrefix + rawInput

          const modelKey2 = node.data.model as string | undefined
          const cfg2 = modelKey2 ? ctx.modelConfigs?.[modelKey2] : undefined

          // Check guardrail input rules
          const guardrailId = node.data.guardrailId as string | undefined
          const guardrail = guardrailId ? ctx.guardrailMap?.[guardrailId] : undefined
          if (guardrail) {
            const violated = checkRules(guardrail.inputRules, userMessage)
            if (violated) {
              emit({ type: 'guardrail_block', nodeId: node.id, message: `Guardrail blocked: "${violated}"`, data: { rule: violated, input: userMessage.slice(0, 200) } })
              throw new Error(`Guardrail blocked input: rule "${violated}" was violated.`)
            }
          }

          emit({ type: 'llm_call', nodeId: node.id, message: `Calling ${cfg2?.modelId ?? modelKey2 ?? 'gemini-2.5-flash'}`, data: { input: userMessage, model: cfg2?.modelId ?? modelKey2 ?? 'gemini-2.5-flash', systemPrompt: node.data.systemPrompt } })
          result = await executeLLMNode(node, ctx, userMessage)
          emit({ type: 'llm_response', nodeId: node.id, message: `LLM response (${result.tokens ?? 0} tokens)`, data: { output: result.output, tokens: result.tokens } })

          // Check guardrail output rules
          if (guardrail && result.output) {
            const outputText = typeof result.output === 'string' ? result.output : JSON.stringify(result.output)
            const violated = checkRules(guardrail.outputRules, outputText)
            if (violated) {
              emit({ type: 'guardrail_warn', nodeId: node.id, message: `Guardrail warning: output matched "${violated}"`, data: { rule: violated, output: outputText.slice(0, 200) } })
            }
          }
          break
        }
        case 'tool': {
          const toolInput = ctx.variables.__last_output ?? ctx.input
          emit({ type: 'tool_call', nodeId: node.id, message: `Tool: ${node.data.toolName}`, data: { input: toolInput, tool: node.data.toolName } })
          result = await executeToolNode(node, ctx)
          emit({ type: 'tool_result', nodeId: node.id, message: `Tool: ${node.data.toolName} returned`, data: { output: result.output } })
          break
        }
        case 'condition': {
          const condResult = await executeConditionNode(node, ctx, edges)
          if (condResult.nextNodeId) conditionSkipTo = condResult.nextNodeId
          result = { output: condResult.output }
          break
        }
        case 'hitl': {
          emit({ type: 'hitl_pause', nodeId: node.id, message: `HITL checkpoint — waiting for human approval` })
          return {
            output: { message: 'Waiting for human approval', checkpoint: node.id, partial: ctx.variables.__last_output },
            tokens: totalTokens,
            latencyMs: Date.now() - startTime,
            trace,
            status: 'waiting_hitl',
          }
        }
        default:
          result = { output: ctx.variables.__last_output }
      }

      if (result.error) throw new Error(result.error)

      ctx.variables.__last_output = result.output
      // Track output for memory sources
      if (ctx.nodeOutputs) ctx.nodeOutputs[node.id] = result.output
      totalTokens += result.tokens ?? 0

      emit({ type: 'node_done', nodeId: node.id, message: `${node.data.label} completed` })
    }

    return {
      output: ctx.variables.__last_output,
      tokens: totalTokens,
      latencyMs: Date.now() - startTime,
      trace,
      status: 'completed',
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    emit({ type: 'error', message: msg })
    return {
      output: null,
      tokens: totalTokens,
      latencyMs: Date.now() - startTime,
      trace,
      status: 'failed',
      error: msg,
    }
  }
}
