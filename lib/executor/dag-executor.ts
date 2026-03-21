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

async function executeWebSearch(query: string, cfg: Record<string, unknown>): Promise<string> {
  const provider = (cfg.provider as string) ?? 'duckduckgo'
  const apiKey = (cfg.api_key as string) ?? ''
  const maxResults = (cfg.max_results as number) ?? 5

  if (provider === 'tavily') {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, api_key: apiKey, search_depth: 'basic', max_results: maxResults }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json() as { results?: { title: string; url: string; content: string }[] }
    return data.results?.map(r => `${r.title}\n${r.url}\n${r.content}`).join('\n\n') ?? 'No results'
  }

  if (provider === 'serper') {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ q: query, num: maxResults }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json() as { organic?: { title: string; link: string; snippet: string }[] }
    return data.organic?.slice(0, maxResults).map(r => `${r.title}\n${r.link}\n${r.snippet}`).join('\n\n') ?? 'No results'
  }

  // DuckDuckGo Instant Answer (default — free, no key)
  const params = new URLSearchParams({ q: query, format: 'json', no_html: '1', skip_disambig: '1' })
  const res = await fetch(`https://api.duckduckgo.com/?${params}`, { signal: AbortSignal.timeout(6000) })
  const data = await res.json() as { AbstractText?: string; AbstractURL?: string; RelatedTopics?: { Text?: string; FirstURL?: string }[] }
  const abstract = data.AbstractText ? `${data.AbstractText}\n${data.AbstractURL ?? ''}` : ''
  const related = (data.RelatedTopics ?? []).slice(0, maxResults).map(t => [t.Text, t.FirstURL].filter(Boolean).join('\n')).filter(Boolean).join('\n\n')
  return [abstract, related].filter(Boolean).join('\n\n') || 'No results found for: ' + query
}

// ─── Template variable substitution ──────────────────────────────────────────
// Supports: {{input}}, {{last_output}}, {{node.NODE_ID}}
function resolveVars(template: string, ctx: ExecutionContext): string {
  return template
    .replace(/\{\{input\}\}/g, String(ctx.input ?? ''))
    .replace(/\{\{last_output\}\}/g, String(ctx.variables.__last_output ?? ctx.input ?? ''))
    .replace(/\{\{node\.([\w-]+)\}\}/g, (_, id) => String(ctx.nodeOutputs?.[id] ?? ''))
}

// ─── Dot-notation response extraction: "results.0.content" ──────────────────
function extractPath(data: unknown, path: string): unknown {
  if (!path.trim()) return data
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return acc
    if (Array.isArray(acc)) return acc[parseInt(key)]
    return (acc as Record<string, unknown>)[key]
  }, data)
}

// ─── Recursive output compression (inspired by Recursive LM paper) ────────────
// Chunks large outputs, summarizes each chunk, recurses until compact.
async function compressLargeOutput(
  output: string,
  ctx: ExecutionContext,
  nodeId: string,
  modelKey: string | undefined,
  depth = 0
): Promise<string> {
  const THRESHOLD = 1500   // chars — below this, pass through as-is
  const CHUNK_SIZE = 2000  // chars per chunk fed to LLM
  const MAX_DEPTH = 4      // recursion cap

  if (output.length <= THRESHOLD || depth >= MAX_DEPTH) return output

  // Use specified model, fall back to first available
  const cfg = (modelKey && ctx.modelConfigs?.[modelKey]) || (ctx.modelConfigs ? Object.values(ctx.modelConfigs)[0] : undefined)
  if (!cfg) return output.slice(0, THRESHOLD) + '\n…(truncated — no model configured for compression)'

  // Split into chunks
  const chunks: string[] = []
  for (let i = 0; i < output.length; i += CHUNK_SIZE) chunks.push(output.slice(i, i + CHUNK_SIZE))

  const emitCompress = (event: Omit<import('@/types/agent').TraceEvent, 'ts'>) => {
    const t = { ...event, ts: Date.now() - ctx.startTime }
    ctx.trace.push(t)
    ctx.onTrace?.(t)
  }

  emitCompress({ type: 'compress_start', nodeId, message: `Compressing output: ${chunks.length} chunk${chunks.length > 1 ? 's' : ''} (depth ${depth + 1}, ${output.length} chars)`, data: { depth: depth + 1, chunks: chunks.length, inputLen: output.length } })

  // Summarize each chunk in parallel, with per-chunk timeout
  let summaries: string[]
  try {
    summaries = await Promise.all(chunks.map(async (chunk) => {
      const { text } = await Promise.race([
        callLLM({
          provider: cfg.provider as ModelRunConfig['provider'],
          model: cfg.modelId,
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl,
          systemPrompt: 'You are a data extraction assistant. Extract and compress the most important facts, values, and information from the provided data. Be concise but preserve all key details.',
          userMessage: `Compress this API response chunk, keeping key facts:\n\n${chunk}`,
          maxTokens: 400,
          timeout: 15000,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('compression timeout')), 15000)),
      ])
      return text.trim()
    }))
  } catch {
    const truncated = output.slice(0, THRESHOLD) + '\n…(compression failed, truncated)'
    emitCompress({ type: 'compress_done', nodeId, message: `Compression failed — truncated to ${THRESHOLD} chars`, data: { depth: depth + 1, outputLen: truncated.length, failed: true } })
    return truncated
  }

  const combined = summaries.join('\n\n')
  emitCompress({ type: 'compress_done', nodeId, message: `Compressed ${output.length} → ${combined.length} chars (depth ${depth + 1})`, data: { depth: depth + 1, inputLen: output.length, outputLen: combined.length, chunks: chunks.length } })

  // Recurse if still too long
  return compressLargeOutput(combined, ctx, nodeId, modelKey, depth + 1)
}

async function executeToolNode(
  node: AgentNode,
  ctx: ExecutionContext
): Promise<NodeResult> {
  const toolCfg = node.data.toolConfig as Record<string, unknown> | undefined
  const toolType = (toolCfg?.type as string) ?? 'http'
  const inputSchema = (toolCfg?.input_schema as Record<string, unknown>) ?? {}

  // ── Built-in: Web Search ──────────────────────────────────────────────────
  if (toolType === 'web_search') {
    const query = String(ctx.variables.__last_output ?? ctx.input)
    const result = await executeWebSearch(query, inputSchema)
    return { output: result }
  }

  // ── Built-in: Web Scrape (Jina AI Reader) ─────────────────────────────────
  if (toolType === 'web_scrape') {
    const url = String(ctx.variables.__last_output ?? ctx.input)
    const headers: Record<string, string> = { 'Accept': 'text/plain' }
    const apiKey = inputSchema.api_key as string | undefined
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
    const res = await fetch(`https://r.jina.ai/${url}`, { headers, signal: AbortSignal.timeout(15000) })
    const text = await res.text()
    return { output: text }
  }

  // ── Built-in: Code Execution (Wandbox / Piston / E2B) ───────────────────
  if (toolType === 'code_exec') {
    const provider  = (inputSchema.provider  as string) ?? 'wandbox'
    const language  = (inputSchema.language  as string) ?? 'python'
    const codeTemplate = (inputSchema.code_template as string) ?? 'import sys\nprint(sys.stdin.read())'
    const code = resolveVars(codeTemplate, ctx)
    const rawStdin = String(ctx.variables.__last_output ?? ctx.input ?? '')
    const stdin = rawStdin ? (rawStdin.endsWith('\n') ? rawStdin : rawStdin + '\n') : ''

    if (provider === 'wandbox') {
      const WANDBOX_COMPILER: Record<string, string> = {
        python: 'cpython-3.12.7', javascript: 'nodejs-20.17.0', typescript: 'nodejs-20.17.0',
        bash: 'bash', ruby: 'ruby-3.4.1', go: 'go-1.23.2', rust: 'rust-1.82.0',
      }
      const compiler = WANDBOX_COMPILER[language] ?? 'cpython-3.12.7'
      const res = await fetch('https://wandbox.org/api/compile.json', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compiler, code, stdin }),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) throw new Error(`Wandbox error: ${res.status}`)
      const data = await res.json() as { status: string; compiler_error?: string; program_output?: string; program_error?: string }
      const compileErr = data.compiler_error?.trim() || ''
      if (compileErr) throw new Error(`Compile error: ${compileErr}`)
      const out = data.program_output?.trim() || data.program_error?.trim() || '(no output)'
      if (data.status !== '0') throw new Error(`Code error: ${out}`)
      return { output: out }
    }

    if (provider === 'piston') {
      const pistonBase = ((inputSchema.piston_url as string) ?? '').replace(/\/$/, '')
      if (!pistonBase) throw new Error('Piston base URL not configured. Public API requires whitelist since Feb 2026.')
      const res = await fetch(`${pistonBase}/api/v2/piston/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, version: '*', files: [{ content: code }], stdin }),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        throw new Error(errBody || `Piston API error: ${res.status}`)
      }
      const data = await res.json() as { compile?: { stdout: string; stderr: string }; run: { stdout: string; stderr: string; code: number } }
      const compileErr = data.compile?.stderr?.trim() || ''
      if (compileErr) throw new Error(`Compile error: ${compileErr}`)
      const out = data.run?.stdout?.trim() || data.run?.stderr?.trim() || '(no output)'
      if (data.run?.code !== 0) throw new Error(`Code error: ${out}`)
      return { output: out }
    }

    if (provider === 'e2b') {
      const apiKey = inputSchema.api_key as string | undefined
      if (!apiKey) throw new Error('E2B API key is required')
      const res = await fetch('https://api.e2b.dev/code/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ code, language }),
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) throw new Error(`E2B API error: ${res.status}`)
      const data = await res.json() as { stdout?: string; stderr?: string; output?: string }
      const out = data.stdout?.trim() || data.output?.trim() || data.stderr?.trim() || '(no output)'
      return { output: out }
    }

    throw new Error(`Unknown code_exec provider: ${provider}`)
  }

  // ── Function tool ─────────────────────────────────────────────────────────
  if (toolType === 'function') {
    const code = toolCfg?.endpoint as string | undefined
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

  // ── Datatable Import / Export ─────────────────────────────────────────────
  if (toolType === 'datatable') {
    // Fallback: if mode wasn't saved, infer from __last_output (JSON → export, otherwise → import)
    let mode = inputSchema.mode as 'import' | 'export' | undefined
    if (!mode) {
      const lo = ctx.variables.__last_output
      const lStr = typeof lo === 'string' ? lo.trim() : ''
      const looksLikeJson = typeof lo === 'object' || lStr.startsWith('{') || lStr.startsWith('[')
      mode = looksLikeJson ? 'export' : 'import'
    }
    const datatableId = inputSchema.datatable_id as string
    const datatableName = (inputSchema.datatable_name as string) ?? 'Datatable'
    const columnDefs = (inputSchema.columns as Array<{ name: string; type: string; isPrimaryKey?: boolean }>) ?? []

    if (mode === 'import') {
      const allRows = ctx.datatableImportData?.[datatableId] ?? []
      const pkFilter = inputSchema.pk_filter as string | undefined
      const pkCol = columnDefs.find(c => c.isPrimaryKey)
      let rows = allRows as Record<string, unknown>[]
      if (pkFilter && pkCol) {
        const resolvedFilter = resolveVars(pkFilter, ctx).trim()
        rows = rows.filter(r => String(r[pkCol.name] ?? '') === resolvedFilter)
        if (rows.length === 0) {
          return { output: `[Datatable: ${datatableName}]\nNo row found where ${pkCol.name} = "${resolvedFilter}".` }
        }
      } else if (rows.length === 0) {
        return { output: `[Datatable: ${datatableName}]\nNo rows found.` }
      }
      const colHeader = columnDefs.map(c => `${c.name} (${c.type}${c.isPrimaryKey ? ', PK' : ''})`).join(', ')
      const header = `| ${columnDefs.map(c => c.name).join(' | ')} |`
      const divider = `| ${columnDefs.map(() => '---').join(' | ')} |`
      const rowLines = rows.map(row =>
        `| ${columnDefs.map(c => String(row[c.name] ?? '')).join(' | ')} |`
      )
      const table = [header, divider, ...rowLines].join('\n')
      return { output: `[Datatable: ${datatableName}]\nColumns: ${colHeader}\n\n${table}` }
    }

    if (mode === 'export') {
      const raw = ctx.variables.__last_output
      let parsed: Record<string, unknown>
      try {
        if (typeof raw === 'object' && raw !== null) {
          parsed = raw as Record<string, unknown>
        } else {
          const str = String(raw ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
          parsed = JSON.parse(str)
        }
      } catch {
        throw new Error(`Datatable export failed: LLM output is not valid JSON. Output was: ${String(raw).slice(0, 200)}`)
      }
      const pkCol = columnDefs.find(c => c.isPrimaryKey)
      if (pkCol && !parsed[pkCol.name]) {
        throw new Error(`Datatable export failed: primary key column "${pkCol.name}" is missing from the JSON`)
      }
      if (!ctx.datatableWriter) throw new Error('Datatable export failed: datatableWriter not available in this execution context')
      await ctx.datatableWriter(datatableId, parsed)
      const preview = Object.entries(parsed).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')
      return { output: `✓ Row saved to "${datatableName}" — ${preview}` }
    }

    throw new Error(`Datatable tool misconfigured: unsupported mode "${mode}". Re-open the tool node, set mode to Import or Export, and click Save Tool Edits.`)
  }

  // ── HTTP tool (full-featured) ─────────────────────────────────────────────
  const rawEndpoint = toolCfg?.endpoint as string | undefined
  if (!rawEndpoint?.trim()) return { output: `[Tool ${node.data.toolName} skipped — no endpoint configured]` }

  const method = ((toolCfg?.method as string) ?? 'POST').toUpperCase()
  const timeout = (toolCfg?.timeout as number) ?? 5000

  // Resolve variables in URL
  const resolvedUrl = resolveVars(rawEndpoint, ctx)

  // Build headers — resolve vars in header values too
  const baseHeaders = toolCfg?.headers as Record<string, string> ?? {}
  const resolvedHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(baseHeaders)) resolvedHeaders[k] = resolveVars(v, ctx)

  const fetchInit: RequestInit = { method, headers: resolvedHeaders, signal: AbortSignal.timeout(timeout) }

  if (!['GET', 'HEAD', 'DELETE'].includes(method)) {
    const bodyTemplate = inputSchema.body_template as string | undefined

    if (bodyTemplate?.trim()) {
      // User-defined body template — substitute vars then send as-is
      const resolved = resolveVars(bodyTemplate, ctx)
      resolvedHeaders['Content-Type'] = resolvedHeaders['Content-Type'] ?? 'application/json'
      fetchInit.body = resolved
    } else {
      // Default: send last_output as { input: "..." }
      resolvedHeaders['Content-Type'] = 'application/json'
      fetchInit.body = JSON.stringify({ input: String(ctx.variables.__last_output ?? ctx.input ?? '') })
    }
  }

  const res = await fetch(resolvedUrl, fetchInit)
  const rawText = await res.text()

  if (!res.ok) throw new Error(`Tool ${node.data.toolName} returned ${res.status}: ${rawText.slice(0, 200)}`)

  // Parse response
  let parsed: unknown = rawText
  try { parsed = JSON.parse(rawText) } catch { /* keep as text */ }

  // Auto-parse RSS/XML → array of {title, link, description, pubDate}
  const contentType = res.headers.get('content-type') ?? ''
  const isXml = contentType.includes('xml') || (typeof parsed === 'string' && parsed.trimStart().startsWith('<?xml'))
  if (isXml && typeof parsed === 'string') {
    const extract = (xml: string, tag: string) => {
      const m = xml.match(new RegExp(`<${tag}(?:[^>]*)><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i'))
      return (m?.[1] ?? m?.[2] ?? '').trim()
    }
    const items: unknown[] = []
    for (const m of parsed.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const body = m[1]
      items.push({ title: extract(body, 'title'), link: extract(body, 'link'), description: extract(body, 'description').slice(0, 200), pubDate: extract(body, 'pubDate') })
    }
    if (items.length > 0) parsed = items
  }

  // Extract specific path if configured
  const responsePath = (inputSchema.response_path as string) ?? ''
  let output = responsePath ? extractPath(parsed, responsePath) ?? parsed : parsed

  // Recursive compression — if enabled and output is large, chunk + summarise
  if (node.data.compressOutput) {
    const str = typeof output === 'string' ? output : JSON.stringify(output)
    output = await compressLargeOutput(str, ctx, node.id, node.data.compressModel as string | undefined)
  }

  return { output }
}

async function executeConditionNode(
  node: AgentNode,
  ctx: ExecutionContext,
  edges: AgentEdge[]
): Promise<{ output: unknown; nextNodeId?: string }> {
  const condition = node.data.condition ?? 'true'
  const lastOutput = ctx.variables.__last_output

  // Use the model config assigned to this condition node, or fall back to the
  // first available model config in the agent, or finally default to google.
  const modelKey = node.data.model as string | undefined
  const cfg = modelKey ? ctx.modelConfigs?.[modelKey] : undefined
  const firstCfg = !cfg && ctx.modelConfigs ? Object.values(ctx.modelConfigs)[0] : undefined
  const activeCfg = cfg ?? firstCfg

  const { text } = await callLLM({
    provider: (activeCfg?.provider ?? 'google') as Parameters<typeof callLLM>[0]['provider'],
    model: activeCfg?.modelId,
    apiKey: activeCfg?.apiKey,
    baseUrl: activeCfg?.baseUrl,
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
  agentRunsHistory?: AgentRunsHistory,
  datatableImportData?: Record<string, unknown[]>,
  datatableWriter?: (datatableId: string, row: Record<string, unknown>) => Promise<void>
): Promise<ExecutionResult> {
  const startTime = Date.now()
  const trace: TraceEvent[] = []
  let totalTokens = 0

  // Determine seed value from input node config or fall back to message/input
  const inputNode = schema?.nodes?.find(n => n.data.nodeType === 'input')
  const inputField = (inputNode?.data?.inputField as string) || 'message'
  const inputDefault = (inputNode?.data?.inputDefault as string) || undefined
  const rawInputValue = input[inputField] ?? inputDefault ?? input.message ?? input

  const seedOutput = resume
    ? resume.feedback
      ? `Reviewer approved with notes: "${resume.feedback}"\n\nPrevious context:\n${JSON.stringify(resume.partialOutput)}`
      : resume.partialOutput
    : rawInputValue

  const ctx: ExecutionContext = {
    agentId, runId, input,
    variables: { __last_output: seedOutput },
    trace, tokens: 0, startTime, onTrace,
    modelConfigs,
    guardrailMap,
    nodeOutputs: {},
    agentRunsHistory,
    datatableImportData,
    datatableWriter,
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
        case 'passthrough': {
          const tmpl = (node.data.template as string | undefined) ?? ''
          const resolved = tmpl.trim() ? resolveVars(tmpl, ctx) : String(ctx.variables.__last_output ?? ctx.input ?? '')
          emit({ type: 'node_output', nodeId: node.id, message: `I/O: passthrough`, data: { output: resolved } })
          result = { output: resolved }
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
