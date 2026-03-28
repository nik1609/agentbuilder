/**
 * DAG Executor v2 — named state, cycle support, Loop/Fork/Join/Switch/Retry/Agentic
 * - Named state dict: ctx.variables[nodeId] per node, ctx.variables.__last_output for compat
 * - Cycle-aware: DFS back-edge detection lets Loop nodes re-enter without breaking topo sort
 * - Parallel branches: Fork/Join via Promise.all
 * - Agentic mode: LLM + tool-call loop
 * - Per-node retry with exponential backoff
 */
import { AgentSchema, AgentNode, AgentEdge, TraceEvent, MemorySource } from '@/types/agent'
import { callLLM } from '@/lib/llm'
import { ExecutionContext, ExecutionResult, ModelRunConfig, NodeResult, GuardrailData, AgentRunsHistory } from './types'

// ─── DFS cycle detection → execution order ───────────────────────────────────
function buildExecutionOrder(
  nodes: AgentNode[],
  edges: AgentEdge[]
): { order: AgentNode[]; backEdgeSources: Map<string, string> } {
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>(nodes.map(n => [n.id, WHITE]))
  const backEdgeSources = new Map<string, string>() // bodyEnd → loopNodeId

  function dfs(nodeId: string) {
    color.set(nodeId, GRAY)
    for (const edge of edges.filter(e => e.source === nodeId)) {
      if (color.get(edge.target) === GRAY) {
        // Back-edge found: this is the end of a loop body
        backEdgeSources.set(edge.source, edge.target)
      } else if (color.get(edge.target) === WHITE) {
        dfs(edge.target)
      }
    }
    color.set(nodeId, BLACK)
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) dfs(node.id)
  }

  // Kahn's topo sort on forward edges only
  const forwardEdges = edges.filter(e => backEdgeSources.get(e.source) !== e.target)
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  nodes.forEach(n => { inDegree.set(n.id, 0); adj.set(n.id, []) })
  forwardEdges.forEach(e => {
    adj.get(e.source)!.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  })
  const queue = nodes.filter(n => inDegree.get(n.id) === 0)
  const order: AgentNode[] = []
  while (queue.length) {
    const node = queue.shift()!
    order.push(node)
    for (const neighborId of adj.get(node.id) ?? []) {
      const deg = (inDegree.get(neighborId) ?? 1) - 1
      inDegree.set(neighborId, deg)
      if (deg === 0) {
        const n = nodes.find(x => x.id === neighborId)
        if (n) queue.push(n)
      }
    }
  }
  return { order, backEdgeSources }
}

// ─── Collect all nodes in a branch from startId up to (not incl.) stopId ─────
function collectBranchNodes(
  startId: string,
  stopId: string,
  nodes: AgentNode[],
  edges: AgentEdge[]
): Set<string> {
  const visited = new Set<string>()
  const queue = [startId]
  while (queue.length) {
    const id = queue.shift()!
    if (id === stopId || visited.has(id)) continue
    visited.add(id)
    edges.filter(e => e.source === id).forEach(e => queue.push(e.target))
  }
  return visited
}

// ─── Find convergence node (first node reachable from all branch starts) ──────
function findConvergenceNode(
  branchStarts: string[],
  edges: AgentEdge[],
  nodes: AgentNode[],
  order: AgentNode[]
): string | undefined {
  const reachable = new Map<string, Set<number>>()
  branchStarts.forEach((start, idx) => {
    const seen = new Set<string>()
    const q = [start]
    while (q.length) {
      const id = q.shift()!
      if (seen.has(id)) continue
      seen.add(id)
      if (!reachable.has(id)) reachable.set(id, new Set())
      reachable.get(id)!.add(idx)
      edges.filter(e => e.source === id).forEach(e => q.push(e.target))
    }
  })
  // Return first node in execution order reachable from all branches
  for (const n of order) {
    if (reachable.get(n.id)?.size === branchStarts.length) return n.id
  }
  return undefined
}

// ─── Template variable substitution ──────────────────────────────────────────
// {{input}} {{input.field}} {{last_output}} {{node.ID}} {{ID}} {{state.key}}
function resolveVars(template: string, ctx: ExecutionContext): string {
  const inputStr = typeof ctx.input === 'object' && ctx.input !== null
    ? (String(Object.values(ctx.input)[0] ?? JSON.stringify(ctx.input)))
    : String(ctx.input ?? '')
  let result = template
  result = result.split('{{input}}').join(inputStr)
  result = result.split('{{last_output}}').join(String(ctx.variables.__last_output ?? inputStr))
  result = result.replace(/\{\{input\.([\w-]+)\}\}/g, (m, k) => {
    const v = ctx.input?.[k]; return v !== undefined ? String(v) : m
  })
  result = result.replace(/\{\{node\.([\w-]+)\}\}/g, (m, id) => {
    const v = ctx.nodeOutputs?.[id]; return v !== undefined ? String(v) : m
  })
  result = result.replace(/\{\{state\.([\w-]+)\}\}/g, (m, k) => {
    const v = ctx.variables[k]; return v !== undefined ? String(v) : m
  })
  // Bare node-ID shorthand: {{nodeId}} — resolves if nodeOutputs has a matching entry
  result = result.replace(/\{\{([\w-]+)\}\}/g, (m, id) => {
    const v = ctx.nodeOutputs?.[id]; return v !== undefined ? String(v) : m
  })
  return result
}

// ─── Dot-notation path extraction ────────────────────────────────────────────
function extractPath(data: unknown, path: string): unknown {
  if (!path.trim()) return data
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return acc
    if (Array.isArray(acc)) return acc[parseInt(key)]
    return (acc as Record<string, unknown>)[key]
  }, data)
}

// ─── Memory context builder ───────────────────────────────────────────────────
function buildMemoryContext(memorySources: MemorySource[], ctx: ExecutionContext): string {
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
        parts.push(`[${label} Output]\n${typeof output === 'string' ? output : JSON.stringify(output)}`)
      }
    }
  }
  return parts.length ? `=== Memory Context ===\n${parts.join('\n\n')}\n=== Current Input ===\n` : ''
}

// ─── Guardrail check ──────────────────────────────────────────────────────────
function checkRules(rules: { text: string }[], text: string): string | null {
  const lower = text.toLowerCase()
  for (const rule of rules) {
    const kw = rule.text.toLowerCase()
    if (kw && lower.includes(kw)) return rule.text
  }
  return null
}

// ─── Web search (tavily / serper / duckduckgo) ────────────────────────────────
async function executeWebSearch(rawQuery: string, cfg: Record<string, unknown>): Promise<string> {
  // Strip surrounding quotes that LLMs sometimes add (e.g. "my query" → my query)
  const query = rawQuery.trim().replace(/^["']|["']$/g, '').trim()
  const provider = (cfg.provider as string) ?? 'duckduckgo'
  const apiKey = (cfg.api_key as string) ?? ''
  const maxResults = (cfg.max_results as number) ?? 5

  if (provider === 'tavily') {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, api_key: apiKey, search_depth: 'basic', max_results: maxResults }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json() as { results?: { title: string; url: string; content: string }[] }
    return data.results?.map(r => `${r.title}\n${r.url}\n${r.content}`).join('\n\n') ?? 'No results'
  }

  if (provider === 'serper') {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ q: query, num: maxResults }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json() as { organic?: { title: string; link: string; snippet: string }[] }
    return data.organic?.slice(0, maxResults).map(r => `${r.title}\n${r.link}\n${r.snippet}`).join('\n\n') ?? 'No results'
  }

  // DuckDuckGo HTML scraper — try two endpoints for resilience
  const decodeHtml = (s: string) => s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ')
    .trim()

  // Try html.duckduckgo.com endpoint
  for (const ddgUrl of [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`,
    `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`,
  ]) {
    try {
      const ddgRes = await fetch(ddgUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(9000),
      })
      if (!ddgRes.ok) continue
      const html = await ddgRes.text()

      const results: string[] = []
      let m: RegExpExecArray | null

      // Pattern 1: modern DDG HTML — result__a title + result__snippet
      const blockRe = /class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,600}?class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|span|div)>/g
      while ((m = blockRe.exec(html)) !== null && results.length < maxResults) {
        const url = m[1].startsWith('//') ? 'https:' + m[1] : m[1]
        const title = decodeHtml(m[2])
        const snippet = decodeHtml(m[3])
        if (title || snippet) results.push([title, url, snippet].filter(Boolean).join('\n'))
      }

      // Pattern 2: result links without snippet pairing
      if (results.length === 0) {
        const linkRe = /href="(https?:\/\/[^"]+)"[^>]*>([\s\S]{5,200}?)<\/a>/g
        while ((m = linkRe.exec(html)) !== null && results.length < maxResults) {
          const url = m[1]
          if (url.includes('duckduckgo.com')) continue
          const title = decodeHtml(m[2])
          if (title.length > 5) results.push([title, url].join('\n'))
        }
      }

      // Pattern 3: grab any snippet text
      if (results.length === 0) {
        const snippetRe = /result__snippet[^>]*>([\s\S]*?)<\/(?:a|span|div)>/g
        while ((m = snippetRe.exec(html)) !== null && results.length < maxResults) {
          const text = decodeHtml(m[1])
          if (text.length > 10) results.push(text)
        }
      }

      if (results.length > 0) return results.join('\n\n---\n\n')
    } catch { /* try next endpoint */ }
  }

  // Fallback: DuckDuckGo instant-answers API (entity/knowledge-graph queries)
  try {
    const params = new URLSearchParams({ q: query, format: 'json', no_html: '1', skip_disambig: '1' })
    const res = await fetch(`https://api.duckduckgo.com/?${params}`, { signal: AbortSignal.timeout(6000) })
    const text = await res.text()
    if (!text.trim()) throw new Error('Empty response')
    const data = JSON.parse(text) as { AbstractText?: string; AbstractURL?: string; RelatedTopics?: { Text?: string; FirstURL?: string }[] }
    const abstract = data.AbstractText ? `${data.AbstractText}\n${data.AbstractURL ?? ''}` : ''
    const related = (data.RelatedTopics ?? []).slice(0, maxResults)
      .map(t => [t.Text, t.FirstURL].filter(Boolean).join('\n')).filter(Boolean).join('\n\n')
    return [abstract, related].filter(Boolean).join('\n\n') || `No results found for: "${query}". For reliable web search, configure a Tavily or Serper API key in the tool settings.`
  } catch {
    return `No results found for: "${query}". Search failed or returned invalid data. For reliable web search, configure a Tavily or Serper API key in the tool settings.`
  }
}

// ─── Recursive output compression ─────────────────────────────────────────────
async function compressLargeOutput(
  output: string, ctx: ExecutionContext, nodeId: string,
  modelKey: string | undefined, depth = 0
): Promise<string> {
  const THRESHOLD = 1500, CHUNK_SIZE = 2000, MAX_DEPTH = 4
  if (output.length <= THRESHOLD || depth >= MAX_DEPTH) return output
  const cfg = (modelKey && ctx.modelConfigs?.[modelKey]) || (ctx.modelConfigs ? Object.values(ctx.modelConfigs)[0] : undefined)
  if (!cfg) return output.slice(0, THRESHOLD) + '\n…(truncated — no model configured for compression)'

  const chunks: string[] = []
  for (let i = 0; i < output.length; i += CHUNK_SIZE) chunks.push(output.slice(i, i + CHUNK_SIZE))

  const emitC = (ev: Omit<TraceEvent, 'ts'>) => {
    const t = { ...ev, ts: Date.now() - ctx.startTime }; ctx.trace.push(t); ctx.onTrace?.(t)
  }
  emitC({ type: 'compress_start', nodeId, message: `Compressing: ${chunks.length} chunks (depth ${depth + 1}, ${output.length} chars)`, data: { depth: depth + 1, chunks: chunks.length, inputLen: output.length } })

  let summaries: string[]
  try {
    summaries = await Promise.all(chunks.map(async chunk => {
      const { text } = await Promise.race([
        callLLM({
          provider: cfg.provider as ModelRunConfig['provider'], model: cfg.modelId,
          apiKey: cfg.apiKey, baseUrl: cfg.baseUrl,
          systemPrompt: 'Extract and compress the most important facts from the data. Be concise.',
          userMessage: `Compress this chunk:\n\n${chunk}`, maxTokens: 400, timeout: 15000,
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
      ])
      return text.trim()
    }))
  } catch {
    const t = output.slice(0, THRESHOLD) + '\n…(compression failed)'
    emitC({ type: 'compress_done', nodeId, message: `Compression failed`, data: { failed: true } })
    return t
  }
  const combined = summaries.join('\n\n')
  emitC({ type: 'compress_done', nodeId, message: `Compressed ${output.length} → ${combined.length} chars`, data: { depth: depth + 1, inputLen: output.length, outputLen: combined.length } })
  return compressLargeOutput(combined, ctx, nodeId, modelKey, depth + 1)
}

// ─── Tool node executor ───────────────────────────────────────────────────────
async function executeToolNode(node: AgentNode, ctx: ExecutionContext): Promise<NodeResult> {
  const toolCfg = node.data.toolConfig as Record<string, unknown> | undefined
  const toolType = (toolCfg?.type as string) ?? 'http'
  const inputSchema = (toolCfg?.input_schema as Record<string, unknown>) ?? {}

  if (toolType === 'web_search') {
    const query = String(ctx.variables.__last_output ?? ctx.input)
    return { output: await executeWebSearch(query, inputSchema) }
  }

  if (toolType === 'web_scrape') {
    const url = String(ctx.variables.__last_output ?? ctx.input)
    const headers: Record<string, string> = { 'Accept': 'text/plain' }
    const apiKey = inputSchema.api_key as string | undefined
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
    const res = await fetch(`https://r.jina.ai/${url}`, { headers, signal: AbortSignal.timeout(15000) })
    return { output: await res.text() }
  }

  if (toolType === 'code_exec') {
    const provider = (inputSchema.provider as string) ?? 'wandbox'
    const language = (inputSchema.language as string) ?? 'python'
    const codeTemplate = (inputSchema.code_template as string) ?? 'import sys\nprint(sys.stdin.read())'
    const code = resolveVars(codeTemplate, ctx)
    const rawStdin = String(ctx.variables.__last_output ?? ctx.input ?? '')
    const stdin = rawStdin ? (rawStdin.endsWith('\n') ? rawStdin : rawStdin + '\n') : ''

    if (provider === 'wandbox') {
      const COMPILERS: Record<string, string> = {
        python: 'cpython-3.12.7', javascript: 'nodejs-20.17.0', typescript: 'nodejs-20.17.0',
        bash: 'bash', ruby: 'ruby-3.4.1', go: 'go-1.23.2', rust: 'rust-1.82.0',
      }
      const res = await fetch('https://wandbox.org/api/compile.json', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compiler: COMPILERS[language] ?? 'cpython-3.12.7', code, stdin }),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) throw new Error(`Wandbox error: ${res.status}`)
      const data = await res.json() as { status: string; compiler_error?: string; program_output?: string; program_error?: string }
      if (data.compiler_error?.trim()) throw new Error(`Compile error: ${data.compiler_error.trim()}`)
      const out = data.program_output?.trim() || data.program_error?.trim() || '(no output)'
      if (data.status !== '0') throw new Error(`Code error: ${out}`)
      return { output: out }
    }

    if (provider === 'piston') {
      const pistonBase = ((inputSchema.piston_url as string) ?? '').replace(/\/$/, '')
      if (!pistonBase) throw new Error('Piston base URL not configured. Public API requires whitelist since Feb 2026.')
      const res = await fetch(`${pistonBase}/api/v2/piston/execute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, version: '*', files: [{ content: code }], stdin }),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) throw new Error(await res.text().catch(() => `Piston API error: ${res.status}`))
      const data = await res.json() as { compile?: { stderr: string }; run: { stdout: string; stderr: string; code: number } }
      if (data.compile?.stderr?.trim()) throw new Error(`Compile error: ${data.compile.stderr.trim()}`)
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
        body: JSON.stringify({ code, language }), signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) throw new Error(`E2B API error: ${res.status}`)
      const data = await res.json() as { stdout?: string; stderr?: string; output?: string }
      return { output: data.stdout?.trim() || data.output?.trim() || data.stderr?.trim() || '(no output)' }
    }

    throw new Error(`Unknown code_exec provider: ${provider}`)
  }

  if (toolType === 'function') {
    const code = toolCfg?.endpoint as string | undefined
    if (!code) return { output: `[Function tool ${node.data.toolName} has no code]` }
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('input', `"use strict";\n${code}`)
      return { output: await fn(ctx.variables.__last_output ?? ctx.input) }
    } catch (e) {
      throw new Error(`Function tool ${node.data.toolName} error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (toolType === 'datatable') {
    let mode = inputSchema.mode as 'import' | 'export' | undefined
    if (!mode) {
      const lo = ctx.variables.__last_output
      const lStr = typeof lo === 'string' ? lo.trim() : ''
      mode = (typeof lo === 'object' || lStr.startsWith('{') || lStr.startsWith('[')) ? 'export' : 'import'
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
        if (rows.length === 0) return { output: `[Datatable: ${datatableName}]\nNo row found where ${pkCol.name} = "${resolvedFilter}".` }
      } else if (rows.length === 0) {
        return { output: `[Datatable: ${datatableName}]\nNo rows found.` }
      }
      const colHeader = columnDefs.map(c => `${c.name} (${c.type}${c.isPrimaryKey ? ', PK' : ''})`).join(', ')
      const header = `| ${columnDefs.map(c => c.name).join(' | ')} |`
      const divider = `| ${columnDefs.map(() => '---').join(' | ')} |`
      const rowLines = rows.map(row => `| ${columnDefs.map(c => String(row[c.name] ?? '')).join(' | ')} |`)
      return { output: `[Datatable: ${datatableName}]\nColumns: ${colHeader}\n\n${[header, divider, ...rowLines].join('\n')}` }
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
      if (pkCol && !parsed[pkCol.name]) throw new Error(`Datatable export failed: primary key column "${pkCol.name}" is missing`)
      if (!ctx.datatableWriter) throw new Error('Datatable export failed: datatableWriter not available')
      await ctx.datatableWriter(datatableId, parsed)
      const preview = Object.entries(parsed).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')
      return { output: `✓ Row saved to "${datatableName}" — ${preview}` }
    }

    throw new Error(`Datatable tool misconfigured: unsupported mode "${mode}"`)
  }

  // HTTP tool
  const rawEndpoint = toolCfg?.endpoint as string | undefined
  if (!rawEndpoint?.trim()) return { output: `[Tool ${node.data.toolName} skipped — no endpoint configured]` }

  const method = ((toolCfg?.method as string) ?? 'POST').toUpperCase()
  const timeout = (toolCfg?.timeout as number) ?? 5000
  const resolvedUrl = resolveVars(rawEndpoint, ctx)
  const baseHeaders = (toolCfg?.headers as Record<string, string>) ?? {}
  const resolvedHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(baseHeaders)) resolvedHeaders[k] = resolveVars(v, ctx)

  const fetchInit: RequestInit = { method, headers: resolvedHeaders, signal: AbortSignal.timeout(timeout) }
  if (!['GET', 'HEAD', 'DELETE'].includes(method)) {
    const bodyTemplate = inputSchema.body_template as string | undefined
    if (bodyTemplate?.trim()) {
      resolvedHeaders['Content-Type'] = resolvedHeaders['Content-Type'] ?? 'application/json'
      fetchInit.body = resolveVars(bodyTemplate, ctx)
    } else {
      resolvedHeaders['Content-Type'] = 'application/json'
      fetchInit.body = JSON.stringify({ input: String(ctx.variables.__last_output ?? ctx.input ?? '') })
    }
  }

  const res = await fetch(resolvedUrl, fetchInit)
  const rawText = await res.text()
  if (!res.ok) throw new Error(`Tool ${node.data.toolName} returned ${res.status}: ${rawText.slice(0, 200)}`)

  let parsed: unknown = rawText
  try { parsed = JSON.parse(rawText) } catch { /* keep as text */ }

  // Auto-parse RSS/XML
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

  const responsePath = (inputSchema.response_path as string) ?? ''
  let output = responsePath ? extractPath(parsed, responsePath) ?? parsed : parsed

  if (node.data.compressOutput) {
    const str = typeof output === 'string' ? output : JSON.stringify(output)
    output = await compressLargeOutput(str, ctx, node.id, node.data.compressModel as string | undefined)
  }

  return { output }
}

// ─── LLM node executor ────────────────────────────────────────────────────────
async function executeLLMNode(node: AgentNode, ctx: ExecutionContext, userMessage: string): Promise<NodeResult> {
  const modelKey = node.data.model as string | undefined
  const cfg = modelKey ? ctx.modelConfigs?.[modelKey] : undefined
  const { text, tokens } = await callLLM({
    provider: cfg?.provider ?? 'google',
    model: cfg?.modelId ?? modelKey ?? 'gemini-2.5-flash',
    apiKey: cfg?.apiKey, baseUrl: cfg?.baseUrl,
    systemPrompt: node.data.systemPrompt as string | undefined,
    userMessage,
    temperature: cfg?.temperature ?? (node.data.temperature as number | undefined) ?? 0.7,
    maxTokens: cfg?.maxTokens ?? (node.data.maxTokens as number | undefined) ?? 4096,
    onToken: ctx.onToken ? (chunk) => ctx.onToken!(node.id, chunk) : undefined,
  })
  return { output: text, tokens }
}

// ─── Agentic LLM: TOOL_CALL loop until final answer ──────────────────────────
async function executeAgenticLLMNode(
  node: AgentNode,
  ctx: ExecutionContext,
  userMessage: string,
  emit: (e: Omit<TraceEvent, 'ts'>) => void
): Promise<NodeResult> {
  const modelKey = node.data.model as string | undefined
  const cfg = modelKey ? ctx.modelConfigs?.[modelKey] : undefined
  const maxIter = (node.data.maxToolIterations as number | undefined) ?? 10
  const boundTools = (node.data.boundTools as string[] | undefined) ?? []

  const toolsCtx = boundTools.length
    ? `\n\nAvailable tools: ${boundTools.join(', ')}\n\nTo call a tool respond with exactly:\nTOOL_CALL: <tool_name>\nINPUT: <input value>\n\nOtherwise respond normally.`
    : ''

  const history: string[] = [userMessage + toolsCtx]
  let totalTokens = 0

  for (let iter = 0; iter < maxIter; iter++) {
    const { text, tokens } = await callLLM({
      provider: cfg?.provider ?? 'google',
      model: cfg?.modelId ?? modelKey ?? 'gemini-2.5-flash',
      apiKey: cfg?.apiKey, baseUrl: cfg?.baseUrl,
      systemPrompt: node.data.systemPrompt as string | undefined,
      userMessage: history.join('\n\n---\n\n'),
      temperature: cfg?.temperature ?? 0.7,
      maxTokens: cfg?.maxTokens ?? 4096,
    })
    totalTokens += tokens ?? 0

    const match = text.match(/TOOL_CALL:\s*(\S+)\s*\nINPUT:\s*([\s\S]+?)(?:\n---|\n\nTOOL_CALL:|$)/)
    if (!match) return { output: text, tokens: totalTokens }

    const toolName = match[1].trim()
    const toolInput = match[2].trim()
    emit({ type: 'agentic_tool_call', nodeId: node.id, message: `Tool call: ${toolName}`, data: { tool: toolName, input: toolInput } })

    let toolResult = `[Tool ${toolName} not available in agentic context]`
    // Attempt to execute if it's a web_search tool
    if (toolName === 'web_search' || toolName.includes('search')) {
      try { toolResult = await executeWebSearch(toolInput, {}) } catch (e) {
        toolResult = `Search error: ${e instanceof Error ? e.message : String(e)}`
      }
    } else if (toolName === 'web_scrape' || toolName.includes('scrape')) {
      try {
        const r = await fetch(`https://r.jina.ai/${toolInput}`, { headers: { Accept: 'text/plain' }, signal: AbortSignal.timeout(15000) })
        toolResult = await r.text()
      } catch (e) { toolResult = `Scrape error: ${e instanceof Error ? e.message : String(e)}` }
    }

    emit({ type: 'agentic_tool_result', nodeId: node.id, message: `Tool result: ${toolName}`, data: { tool: toolName, result: String(toolResult).slice(0, 500) } })
    history.push(text)
    history.push(`TOOL_RESULT: ${toolName}\n${toolResult}`)
  }

  return { output: history[history.length - 1], tokens: totalTokens }
}

// ─── Switch node ──────────────────────────────────────────────────────────────
async function executeSwitchNode(
  node: AgentNode,
  ctx: ExecutionContext,
  edges: AgentEdge[]
): Promise<{ output: unknown; nextNodeId?: string }> {
  const switchType = (node.data.switchType as string) ?? 'value_match'
  const outEdges = edges.filter(e => e.source === node.id)
  const currentOutput = ctx.variables.__last_output
  const cases = (node.data.cases as { label: string; match: string }[]) ?? []
  const defaultCase = node.data.defaultCase as string | undefined

  const findEdge = (label: string) =>
    outEdges.find(e => e.label === label || e.sourceHandle === label)

  if (switchType === 'value_match') {
    const inputKey = node.data.inputKey as string | undefined
    const value = inputKey
      ? String(ctx.input?.[inputKey] ?? ctx.variables[inputKey] ?? currentOutput)
      : String(currentOutput ?? '')
    for (const c of cases) {
      if (value === c.match || value.toLowerCase() === c.match.toLowerCase() || new RegExp(`\\b${c.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(value)) {
        const edge = findEdge(c.label)
        if (edge) return { output: currentOutput, nextNodeId: edge.target }
      }
    }
  } else if (switchType === 'expression') {
    for (const c of cases) {
      try {
        const expr = resolveVars(c.match, ctx)
        // eslint-disable-next-line no-new-func
        const fn = new Function('value', 'input', 'state', `"use strict"; return (${expr})`)
        if (fn(String(currentOutput ?? ''), ctx.input, ctx.variables)) {
          const edge = findEdge(c.label)
          if (edge) return { output: currentOutput, nextNodeId: edge.target }
        }
      } catch { /* skip invalid expression */ }
    }
  } else if (switchType === 'llm_classify') {
    const modelKey = node.data.model as string | undefined
    const cfg = modelKey ? ctx.modelConfigs?.[modelKey] : Object.values(ctx.modelConfigs ?? {})[0]
    const labels = cases.map(c => c.label).join(', ')
    const { text } = await callLLM({
      provider: (cfg?.provider ?? 'google') as Parameters<typeof callLLM>[0]['provider'],
      model: cfg?.modelId, apiKey: cfg?.apiKey, baseUrl: cfg?.baseUrl,
      systemPrompt: `Classify the input into one of: ${labels}. Reply with ONLY the category name.`,
      userMessage: String(currentOutput ?? ''), temperature: 0, maxTokens: 20,
    })
    const classified = text.trim()
    const edge = outEdges.find(e =>
      e.label === classified ||
      cases.some(c => c.label === (e.label ?? e.sourceHandle) && classified.toLowerCase().includes(c.label.toLowerCase()))
    )
    if (edge) return { output: currentOutput, nextNodeId: edge.target }
  }

  // Default
  const defaultEdge = (defaultCase ? findEdge(defaultCase) : undefined) ?? outEdges.find(e => e.label === 'default') ?? outEdges[0]
  return { output: currentOutput, nextNodeId: defaultEdge?.target }
}

// ─── Loop exit condition check ─────────────────────────────────────────────────
async function shouldExitLoop(node: AgentNode, ctx: ExecutionContext): Promise<boolean> {
  const maxIter = (node.data.maxIterations as number | undefined) ?? 10
  const count = ctx.loopCounters?.[node.id] ?? 0
  if (count >= maxIter) {
    if ((node.data.onMaxReached as string) === 'error')
      throw new Error(`Loop "${node.data.label}" exceeded max iterations (${maxIter})`)
    return true
  }
  const exitCond = (node.data.exitCondition as string | undefined)?.trim()
  if (!exitCond) return false

  if ((node.data.exitConditionType as string) === 'llm') {
    const modelKey = node.data.model as string | undefined
    const cfg = (modelKey ? ctx.modelConfigs?.[modelKey] : undefined) ?? Object.values(ctx.modelConfigs ?? {})[0]
    const { text } = await callLLM({
      provider: (cfg?.provider ?? 'google') as Parameters<typeof callLLM>[0]['provider'],
      model: cfg?.modelId, apiKey: cfg?.apiKey, baseUrl: cfg?.baseUrl,
      systemPrompt: 'Evaluate a loop exit condition. Reply ONLY with "exit" or "continue".',
      userMessage: `Condition: "${exitCond}"\nCurrent output: ${JSON.stringify(ctx.variables.__last_output)}\nIteration: ${count}`,
      temperature: 0, maxTokens: 10,
    })
    return /\bexit\b/i.test(text.trim())
  }

  // expression (default)
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('output', 'input', 'state', 'iteration', `"use strict"; return (${exitCond})`)
    return Boolean(fn(ctx.variables.__last_output, ctx.input, ctx.variables, count))
  } catch { return false }
}

// ─── Per-node retry wrapper ───────────────────────────────────────────────────
async function withRetry(
  execute: () => Promise<NodeResult>,
  node: AgentNode,
  emit: (e: Omit<TraceEvent, 'ts'>) => void
): Promise<NodeResult> {
  const r = node.data.retry as { enabled?: boolean; maxAttempts?: number; backoffMs?: number; retryOn?: string } | undefined
  if (!r?.enabled) return execute()
  const maxAttempts = r.maxAttempts ?? 3
  const backoffMs = r.backoffMs ?? 500
  let lastErr: Error | undefined
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await execute()
      if (r.retryOn === 'empty_output' && (result.output === null || result.output === undefined || result.output === '') && attempt < maxAttempts) {
        emit({ type: 'retry', nodeId: node.id, message: `Retry ${attempt}/${maxAttempts}: empty output`, data: { attempt } })
        await new Promise(res => setTimeout(res, backoffMs * 2 ** (attempt - 1)))
        continue
      }
      return result
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (attempt < maxAttempts) {
        emit({ type: 'retry', nodeId: node.id, message: `Retry ${attempt}/${maxAttempts}: ${lastErr.message}`, data: { attempt, error: lastErr.message } })
        await new Promise(res => setTimeout(res, backoffMs * 2 ** (attempt - 1)))
      }
    }
  }
  throw lastErr ?? new Error('Max retries exceeded')
}

// ─── Execute a branch sub-graph (for Fork) ────────────────────────────────────
async function executeBranchGraph(
  branchNodes: AgentNode[],
  edges: AgentEdge[],
  ctx: ExecutionContext,
  branchInput: unknown,
  emit: (e: Omit<TraceEvent, 'ts'>) => void
): Promise<unknown> {
  // Mini execution context inheriting from parent
  const branchCtx: ExecutionContext = {
    ...ctx,
    variables: { ...ctx.variables, __last_output: branchInput },
    nodeOutputs: { ...ctx.nodeOutputs },
  }

  for (const node of branchNodes) {
    emit({ type: 'node_start', nodeId: node.id, message: `[branch] ${node.data.label} started` })
    let result: NodeResult

    switch (node.data.nodeType) {
      case 'llm': {
        const raw = typeof branchCtx.variables.__last_output === 'string'
          ? branchCtx.variables.__last_output
          : JSON.stringify(branchCtx.variables.__last_output ?? branchCtx.input)
        const mem = buildMemoryContext((node.data.memorySources as MemorySource[] | undefined) ?? [], branchCtx)
        result = await withRetry(() => executeLLMNode(node, branchCtx, mem + raw), node, emit)
        break
      }
      case 'tool':
        result = await withRetry(() => executeToolNode(node, branchCtx), node, emit)
        break
      case 'passthrough': {
        const tmpl = (node.data.template as string | undefined) ?? ''
        result = { output: tmpl.trim() ? resolveVars(tmpl, branchCtx) : String(branchCtx.variables.__last_output ?? '') }
        break
      }
      default:
        result = { output: branchCtx.variables.__last_output }
    }

    branchCtx.variables.__last_output = result.output
    branchCtx.variables[node.id] = result.output
    if (branchCtx.nodeOutputs) branchCtx.nodeOutputs[node.id] = result.output
    emit({ type: 'node_done', nodeId: node.id, message: `[branch] ${node.data.label} completed` })
  }

  return branchCtx.variables.__last_output
}

// ─── Main export types ────────────────────────────────────────────────────────
export interface ResumeOptions {
  checkpointNodeId: string
  partialOutput: unknown
  feedback?: string
  clarifyAnswer?: string
}

// ─── Main executor ────────────────────────────────────────────────────────────
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
  datatableWriter?: (datatableId: string, row: Record<string, unknown>) => Promise<void>,
  onToken?: (nodeId: string, token: string) => void
): Promise<ExecutionResult> {
  const startTime = Date.now()
  const trace: TraceEvent[] = []
  let totalTokens = 0

  const inputNode = schema?.nodes?.find(n => n.data.nodeType === 'input')
  const inputField = (inputNode?.data?.inputField as string) || 'message'
  const inputDefault = inputNode?.data?.inputDefault as string | undefined
  const rawInputValue = input[inputField] ?? inputDefault ?? input.message ?? input

  const seedOutput = resume
    ? (resume.clarifyAnswer
      ? `User answered: "${resume.clarifyAnswer}"\n\nPrevious context:\n${JSON.stringify(resume.partialOutput)}`
      : resume.feedback
      ? `Reviewer approved with notes: "${resume.feedback}"\n\nPrevious context:\n${JSON.stringify(resume.partialOutput)}`
      : resume.partialOutput)
    : rawInputValue

  const ctx: ExecutionContext = {
    agentId, runId, input,
    variables: { __last_output: seedOutput },
    trace, tokens: 0, startTime, onTrace,
    onToken,
    modelConfigs, guardrailMap,
    // Pre-populate input node so {{nodeId}} templates resolve correctly
    nodeOutputs: { ...(inputNode ? { [inputNode.id]: rawInputValue } : {}) },
    agentRunsHistory, datatableImportData, datatableWriter,
    loopCounters: {}, branchResults: {},
  }

  const emit = (event: Omit<TraceEvent, 'ts'>) => {
    const t: TraceEvent = { ...event, ts: Date.now() - startTime }
    trace.push(t); onTrace?.(t)
  }

  // ── Orchestrator pre-check ───────────────────────────────────────────────────
  // Runs once before any workflow node on fresh runs (never on resumes).
  // Makes a single fast LLM call to classify the user's intent and route accordingly.
  //
  // Decision rules:
  //  CONTINUE  → message is the intended workflow input; run workflow normally
  //  ANSWER    → message is a domain question (e.g. "what visa do I need?" to a trip planner);
  //              answer it directly and STOP — workflow does not run
  //  JUMP:<n>  → user wants to start from a specific named step; run from there
  //  RESPOND   → message is off-topic / conversational; reply directly and STOP
  //
  // ANSWER and RESPOND both short-circuit the workflow. The distinction is only
  // for the LLM's classification accuracy (domain-related vs. unrelated).
  type SchemaWithOrch = AgentSchema & {
    orchestratorConfig?: { enabled?: boolean; model?: string }
    _agentName?: string
    _agentDescription?: string
  }
  const schemaExt = schema as SchemaWithOrch
  const orchCfg = schemaExt.orchestratorConfig
  const orchAgentName = schemaExt._agentName ?? 'this agent'
  const orchAgentDesc = schemaExt._agentDescription ?? ''
  // Conversation history injected by the SSE/POST route for multi-turn context
  const orchConvHistory = (input._conversationHistory as string | undefined) ?? ''

  if (orchCfg?.enabled && !resume) {
    const orchModelKey = orchCfg.model
    const orchCfgResolved = orchModelKey ? ctx.modelConfigs?.[orchModelKey] : undefined
    const userMsg = typeof rawInputValue === 'string' ? rawInputValue : JSON.stringify(rawInputValue)

    const workflowSteps = schema.nodes
      .filter(n => n.data.nodeType !== 'input' && n.data.nodeType !== 'output')
      .map((n, i) => `${i + 1}. ${n.data.label}`)
      .join('\n')

    // What the workflow's input node expects (label + optional description)
    const inputNode = schema.nodes.find(n => n.data.nodeType === 'input')
    const expectedInput = [
      inputNode?.data?.label && inputNode.data.label !== 'Input' ? inputNode.data.label : null,
      (inputNode?.data?.description as string | undefined) ?? null,
    ].filter(Boolean).join(' — ') || 'the main task input'

    // First LLM call: classify the intent (cheap, temperature=0)
    // Include agent identity, expected input, and conversation history so the classifier is context-aware.
    const classifyPrompt = `You are a routing controller for an AI agent.

Agent: ${orchAgentName}${orchAgentDesc ? `\nPurpose: ${orchAgentDesc}` : ''}
Workflow expects: ${expectedInput}

Workflow steps:
${workflowSteps}
${orchConvHistory ? `\nRecent conversation:\n${orchConvHistory}\n` : ''}
User message: "${userMsg}"

Classify this message. Reply with EXACTLY one of these (no other text, no explanation):

CONTINUE
ANSWER
JUMP: <exact step name from the list above>
RESPOND

Rules:
- CONTINUE only if the message IS the actual task input the workflow needs (contains ${expectedInput}). A vague "ok", "sure", "go ahead" alone is NOT enough unless the conversation makes the input obvious.
- ANSWER if the user is asking a question about this agent's domain, capabilities, or how it works — but is NOT providing the actual task input
- JUMP if the user explicitly names a specific workflow step they want to start at
- RESPOND if the message is casual chat, a greeting, a meta-question about something else, or completely unrelated`

    try {
      emit({ type: 'node_start', nodeId: '__orchestrator__', message: 'Orchestrator routing…', data: { nodeType: 'orchestrator', label: 'Orchestrator' } })
      const { text: classifyRaw, tokens: classifyTokens } = await callLLM({
        provider: (orchCfgResolved?.provider ?? 'google') as Parameters<typeof callLLM>[0]['provider'],
        model: orchCfgResolved?.modelId ?? orchModelKey,
        apiKey: orchCfgResolved?.apiKey, baseUrl: orchCfgResolved?.baseUrl,
        userMessage: classifyPrompt,
        temperature: 0,
        maxTokens: 60,
      })
      totalTokens += classifyTokens

      const classification = classifyRaw.trim().toUpperCase()

      // CONTINUE → fall through to normal workflow execution
      if (classification === 'CONTINUE') {
        emit({ type: 'node_done', nodeId: '__orchestrator__', message: 'Orchestrator → CONTINUE', data: { nodeType: 'orchestrator', label: 'Orchestrator', output: 'CONTINUE' } })
        // fall through
      }

      // ANSWER or RESPOND → second LLM call to generate reply, then short-circuit (no workflow)
      else if (classification.startsWith('ANSWER') || classification.startsWith('RESPOND')) {
        // Reply prompts are grounded in this specific agent's identity — no more generic responses.
        const replyPrompt = classification.startsWith('ANSWER')
          ? `You are ${orchAgentName}.${orchAgentDesc ? ` ${orchAgentDesc}` : ''}

The user asked a question related to your domain. Answer it helpfully and concisely in character as this agent.

IMPORTANT: Only answer based on real knowledge. Do NOT invent statistics, vendor counts, or any specific data you don't actually have. If you genuinely don't know, say so honestly and explain what you CAN help with instead (e.g., "I don't maintain a pre-built vendor list, but give me a vendor name and I'll research it for you").

User message: "${userMsg}"`
          : `You are ${orchAgentName}.${orchAgentDesc ? ` ${orchAgentDesc}` : ''} The user sent a casual or off-topic message. Respond naturally and briefly. If appropriate, gently remind them what you can help with (${expectedInput}).

User message: "${userMsg}"`

        const { text: reply, tokens: replyTokens } = await callLLM({
          provider: (orchCfgResolved?.provider ?? 'google') as Parameters<typeof callLLM>[0]['provider'],
          model: orchCfgResolved?.modelId ?? orchModelKey,
          apiKey: orchCfgResolved?.apiKey, baseUrl: orchCfgResolved?.baseUrl,
          userMessage: replyPrompt,
          temperature: 0.7,
          maxTokens: 400,
          onToken: onToken ? (chunk) => onToken('__orchestrator__', chunk) : undefined,
        })
        totalTokens += replyTokens

        emit({ type: 'node_done', nodeId: '__orchestrator__', message: `Orchestrator → ${classification.slice(0, 6)} (short-circuit)`, data: { nodeType: 'orchestrator', label: 'Orchestrator', output: reply } })
        // Short-circuit: return reply directly, workflow does NOT run
        return { output: reply, tokens: totalTokens, latencyMs: Date.now() - startTime, trace, status: 'completed' }
      }

      // JUMP:<node> → find target node and set jump, then run workflow from there
      else if (classification.startsWith('JUMP:')) {
        const targetLabel = classifyRaw.trim().replace(/^JUMP:\s*/i, '').trim()
        const targetNode = schema.nodes.find(n =>
          n.data.label.toLowerCase() === targetLabel.toLowerCase() &&
          n.data.nodeType !== 'input' && n.data.nodeType !== 'output'
        )
        if (targetNode) {
          ctx.variables.__jumpToNodeId = targetNode.id
          emit({ type: 'node_done', nodeId: '__orchestrator__', message: `Orchestrator → JUMP to "${targetNode.data.label}"`, data: { nodeType: 'orchestrator', label: 'Orchestrator', output: `JUMP: ${targetNode.data.label}` } })
        } else {
          // Target not found — continue normally
          emit({ type: 'node_done', nodeId: '__orchestrator__', message: `Orchestrator → JUMP target not found, continuing`, data: { nodeType: 'orchestrator', label: 'Orchestrator', output: classification } })
        }
        // fall through to workflow execution (from the jump target)
      }

      else {
        // Unknown classification — safe fallback: continue normally
        emit({ type: 'node_done', nodeId: '__orchestrator__', message: 'Orchestrator → unknown, continuing normally', data: { nodeType: 'orchestrator', label: 'Orchestrator', output: classification } })
      }

    } catch (_orchErr) {
      // Orchestrator failure is non-fatal — always fall through to workflow
      emit({ type: 'node_done', nodeId: '__orchestrator__', message: 'Orchestrator failed — continuing normally', data: { nodeType: 'orchestrator', label: 'Orchestrator' } })
    }
  }

  // Helper to commit a node result to state
  const commitResult = (node: AgentNode, result: NodeResult) => {
    const outputKey = (node.data.outputKey as string | undefined) ?? node.id
    ctx.variables[outputKey] = result.output
    ctx.variables.__last_output = result.output
    if (ctx.nodeOutputs) ctx.nodeOutputs[node.id] = result.output
    totalTokens += result.tokens ?? 0
  }

  try {
    const { nodes, edges } = schema
    const { order: sorted, backEdgeSources } = buildExecutionOrder(nodes, edges)

    const executableNodes = sorted.filter(
      n => n.data.nodeType !== 'input' && n.data.nodeType !== 'output'
    )

    // Map loopNode id → index in executableNodes (populated as we encounter loops)
    const loopIndices = new Map<string, number>()
    // Nodes executed by Fork/Join sub-graphs (skip in main loop)
    const visitedNodes = new Set<string>()

    let skipUntilAfter: string | null = resume?.checkpointNodeId ?? null
    // For condition/switch routing: skip all nodes until this nodeId is reached
    let routeToNodeId: string | null = null
    // Orchestrator JUMP: skip directly to a specific node
    if (ctx.variables.__jumpToNodeId) {
      routeToNodeId = ctx.variables.__jumpToNodeId as string
      delete ctx.variables.__jumpToNodeId
    }
    // IDs to skip (non-selected branches)
    const skipNodes = new Set<string>()

    let i = 0
    while (i < executableNodes.length) {
      const node = executableNodes[i]

      // Resume after HITL checkpoint
      if (skipUntilAfter) {
        if (node.id === skipUntilAfter) skipUntilAfter = null
        i++; continue
      }

      // Skip nodes in non-selected condition/switch branches
      if (skipNodes.has(node.id)) { i++; continue }

      // Skip nodes already executed by Fork branches
      if (visitedNodes.has(node.id)) { i++; continue }

      // Condition/Switch routing: skip until target is reached
      if (routeToNodeId !== null) {
        if (node.id === routeToNodeId) routeToNodeId = null
        else { i++; continue }
      }

      const nodeInput = ctx.variables.__last_output
      emit({ type: 'node_start', nodeId: node.id, message: `${node.data.label} started`,
        data: { nodeType: node.data.nodeType, label: node.data.label,
          input: typeof nodeInput === 'string' && nodeInput.length > 2000 ? nodeInput.slice(0, 2000) + '…' : nodeInput } })
      let result: NodeResult = { output: ctx.variables.__last_output }

      switch (node.data.nodeType) {
        // ── Loop ─────────────────────────────────────────────────────────────
        case 'loop': {
          if (!ctx.loopCounters) ctx.loopCounters = {}
          ctx.loopCounters[node.id] = (ctx.loopCounters[node.id] ?? 0) + 1
          loopIndices.set(node.id, i)
          const iterCount = ctx.loopCounters[node.id]
          emit({ type: 'loop_iteration', nodeId: node.id, message: `Loop "${node.data.label}" iteration ${iterCount}`, data: { iteration: iterCount, max: node.data.maxIterations ?? 10 } })
          // Loop node passes through current output
          result = { output: ctx.variables.__last_output }
          break
        }

        // ── Fork ─────────────────────────────────────────────────────────────
        case 'fork': {
          emit({ type: 'fork_start', nodeId: node.id, message: `Fork "${node.data.label}" starting branches`, data: { branches: node.data.branches } })

          const forkOutEdges = edges.filter(e => e.source === node.id)
          const branchStarts = forkOutEdges.map(e => e.target)

          // Find Join node (convergence point)
          const joinNodeId = findConvergenceNode(branchStarts, edges, nodes, sorted)
          if (!joinNodeId) throw new Error(`Fork "${node.data.label}" has no matching Join node`)

          const inputMode = (node.data.inputMode as string) ?? 'broadcast'
          const lastOutput = ctx.variables.__last_output
          let splitInputs: unknown[] = []
          if (inputMode === 'split' && Array.isArray(lastOutput)) {
            splitInputs = lastOutput
          }

          // Execute branches in parallel
          const branchResults = await Promise.all(
            forkOutEdges.map(async (edge, idx) => {
              const branchId = edge.sourceHandle ?? edge.id
              const branchNodeSet = collectBranchNodes(edge.target, joinNodeId, nodes, edges)
              const branchNodeList = sorted.filter(n => branchNodeSet.has(n.id))
              const branchInput = inputMode === 'split' ? (splitInputs[idx] ?? lastOutput) : lastOutput

              const branchOutput = await executeBranchGraph(branchNodeList, edges, ctx, branchInput, emit)
              return { branchId, output: branchOutput }
            })
          )

          // Store results for Join to consume
          if (!ctx.branchResults) ctx.branchResults = {}
          for (const { branchId, output } of branchResults) {
            ctx.branchResults[branchId] = output
          }

          // Mark all branch nodes as visited
          for (const edge of forkOutEdges) {
            const branchNodeSet = collectBranchNodes(edge.target, joinNodeId, nodes, edges)
            branchNodeSet.forEach(id => visitedNodes.add(id))
          }

          emit({ type: 'fork_done', nodeId: node.id, message: `Fork "${node.data.label}" completed`, data: { branches: branchResults.length } })
          result = { output: ctx.variables.__last_output } // Join will update this
          break
        }

        // ── Join ─────────────────────────────────────────────────────────────
        case 'join': {
          emit({ type: 'join_wait', nodeId: node.id, message: `Join "${node.data.label}" merging results` })

          const branchValues = Object.values(ctx.branchResults ?? {})
          const mergeFormat = (node.data.mergeFormat as string) ?? 'array'
          const mergeAs = node.data.mergeAs as string | undefined

          let merged: unknown
          if (mergeFormat === 'concatenated') {
            merged = branchValues.map(v => (typeof v === 'string' ? v : JSON.stringify(v))).join('\n\n')
          } else if (mergeFormat === 'object') {
            const forkNode = nodes.find(n => n.data.nodeType === 'fork')
            const branchDefs = (forkNode?.data?.branches as { id: string; label: string }[]) ?? []
            const obj: Record<string, unknown> = {}
            const branchIds = Object.keys(ctx.branchResults ?? {})
            branchIds.forEach((id, idx) => {
              const label = branchDefs[idx]?.label ?? id
              obj[label] = (ctx.branchResults ?? {})[id]
            })
            merged = obj
          } else {
            merged = branchValues // array (default)
          }

          if (mergeAs) ctx.variables[mergeAs] = merged
          // Clear branch results after consuming
          ctx.branchResults = {}

          emit({ type: 'join_done', nodeId: node.id, message: `Join "${node.data.label}" merged ${branchValues.length} branches`, data: { format: mergeFormat, count: branchValues.length } })
          result = { output: merged }
          break
        }

        // ── Switch ───────────────────────────────────────────────────────────
        case 'switch': {
          const switchResult = await executeSwitchNode(node, ctx, edges)
          if (switchResult.nextNodeId) {
            routeToNodeId = switchResult.nextNodeId
            // Mark all other branch starts as skipped (to avoid executing non-selected branches)
            const switchOutEdges = edges.filter(e => e.source === node.id)
            for (const e of switchOutEdges) {
              if (e.target !== switchResult.nextNodeId) {
                collectBranchNodes(e.target, switchResult.nextNodeId, nodes, edges).forEach(id => skipNodes.add(id))
              }
            }
          }
          result = { output: switchResult.output }
          break
        }

        // ── LLM ──────────────────────────────────────────────────────────────
        case 'llm': {
          const rawIn = typeof ctx.variables.__last_output === 'string'
            ? ctx.variables.__last_output
            : JSON.stringify(ctx.variables.__last_output ?? ctx.input)

          const memorySources = (node.data.memorySources as MemorySource[] | undefined) ?? []
          const memPrefix = buildMemoryContext(memorySources, ctx)
          const userMessage = memPrefix + rawIn

          const modelKey = node.data.model as string | undefined
          const cfg = modelKey ? ctx.modelConfigs?.[modelKey] : undefined

          // Guardrail input check
          const guardrailId = node.data.guardrailId as string | undefined
          const guardrail = guardrailId ? ctx.guardrailMap?.[guardrailId] : undefined
          if (guardrail) {
            const violated = checkRules(guardrail.inputRules, userMessage)
            if (violated) {
              emit({ type: 'guardrail_block', nodeId: node.id, message: `Guardrail blocked: "${violated}"`, data: { rule: violated } })
              throw new Error(`Guardrail blocked input: rule "${violated}" was violated.`)
            }
          }

          emit({ type: 'llm_call', nodeId: node.id, message: `Calling ${cfg?.modelId ?? modelKey ?? 'gemini-2.5-flash'}`, data: { model: cfg?.modelId ?? modelKey ?? 'gemini-2.5-flash', systemPrompt: node.data.systemPrompt, input: userMessage.slice(0, 300) } })

          if (node.data.agenticMode) {
            result = await withRetry(
              () => executeAgenticLLMNode(node, ctx, userMessage, emit),
              node, emit
            )
          } else {
            result = await withRetry(() => executeLLMNode(node, ctx, userMessage), node, emit)
          }

          emit({ type: 'llm_response', nodeId: node.id, message: `LLM response (${result.tokens ?? 0} tokens)`, data: { output: result.output, tokens: result.tokens } })

          // Guardrail output check — block if violated
          if (guardrail && result.output) {
            const outputText = typeof result.output === 'string' ? result.output : JSON.stringify(result.output)
            const violated = checkRules(guardrail.outputRules, outputText)
            if (violated) {
              emit({ type: 'guardrail_block', nodeId: node.id, message: `Guardrail blocked output: matched "${violated}"`, data: { rule: violated } })
              result = { output: `[Output blocked by guardrail: "${violated}"]` }
            }
          }
          break
        }

        // ── Passthrough ──────────────────────────────────────────────────────
        case 'passthrough': {
          const tmpl = (node.data.template as string | undefined) ?? ''
          const resolved = tmpl.trim() ? resolveVars(tmpl, ctx) : String(ctx.variables.__last_output ?? ctx.input ?? '')
          emit({ type: 'node_output', nodeId: node.id, message: `Passthrough`, data: { output: resolved } })
          result = { output: resolved }
          break
        }

        // ── Tool ─────────────────────────────────────────────────────────────
        case 'tool': {
          emit({ type: 'tool_call', nodeId: node.id, message: `Tool: ${node.data.toolName}`, data: { tool: node.data.toolName, input: ctx.variables.__last_output } })
          result = await withRetry(() => executeToolNode(node, ctx), node, emit)
          emit({ type: 'tool_result', nodeId: node.id, message: `Tool: ${node.data.toolName} returned`, data: { output: result.output } })
          break
        }

        // ── Condition ────────────────────────────────────────────────────────
        case 'condition': {
          const condition = node.data.condition ?? 'true'
          const modelKey = node.data.model as string | undefined
          const cfg = (modelKey ? ctx.modelConfigs?.[modelKey] : undefined) ?? Object.values(ctx.modelConfigs ?? {})[0]
          const { text } = await callLLM({
            provider: (cfg?.provider ?? 'google') as Parameters<typeof callLLM>[0]['provider'],
            model: cfg?.modelId, apiKey: cfg?.apiKey, baseUrl: cfg?.baseUrl,
            systemPrompt: 'You evaluate conditions. Reply with ONLY "true" or "false".',
            userMessage: `Condition: "${condition}"\nContext: ${JSON.stringify(ctx.variables.__last_output)}\n\nIs the condition true?`,
            temperature: 0, maxTokens: 10,
          })
          const isTrue = text.trim().toLowerCase().includes('true')
          const outEdges = edges.filter(e => e.source === node.id)
          const trueEdge = outEdges.find(e => e.label === 'true' || e.label === 'yes' || e.sourceHandle === 'true' || e.sourceHandle === 'yes')
            ?? (outEdges.every(e => !e.label && !e.sourceHandle) ? outEdges[0] : undefined)
          const falseEdge = outEdges.find(e => e.label === 'false' || e.label === 'no' || e.sourceHandle === 'false' || e.sourceHandle === 'no')
            ?? (outEdges.every(e => !e.label && !e.sourceHandle) ? outEdges[1] : undefined)
          const selectedEdge = isTrue ? trueEdge : falseEdge
          const rejectedEdge = isTrue ? falseEdge : trueEdge

          if (selectedEdge) routeToNodeId = selectedEdge.target
          // Skip rejected branch — only collect if convergence is found
          if (rejectedEdge) {
            const convergence = findConvergenceNode(
              outEdges.map(e => e.target), edges, nodes, sorted
            )
            if (convergence) {
              collectBranchNodes(rejectedEdge.target, convergence, nodes, edges)
                .forEach(id => skipNodes.add(id))
            } else {
              // No convergence — skip everything reachable from the rejected branch
              collectBranchNodes(rejectedEdge.target, '__never__', nodes, edges)
                .forEach(id => skipNodes.add(id))
            }
          }
          result = { output: ctx.variables.__last_output }
          break
        }

        // ── Clarify ───────────────────────────────────────────────────────────
        case 'clarify': {
          const modelKey = node.data.model as string | undefined
          const cfg = (modelKey ? ctx.modelConfigs?.[modelKey] : undefined) ?? Object.values(ctx.modelConfigs ?? {})[0]
          const sysPrompt = (node.data.clarifySystemPrompt as string | undefined)?.trim()
            || 'You are a helpful assistant. Based on the context provided, ask ONE concise clarifying question to better understand what the user needs. Reply with only the question.'
          const { text: question, tokens: clarifyTokens } = await callLLM({
            provider: (cfg?.provider ?? 'google') as Parameters<typeof callLLM>[0]['provider'],
            model: cfg?.modelId, apiKey: cfg?.apiKey, baseUrl: cfg?.baseUrl,
            systemPrompt: sysPrompt,
            userMessage: `Current context:\n${JSON.stringify(ctx.variables.__last_output)}`,
            temperature: 0.7, maxTokens: 200,
          })
          totalTokens += clarifyTokens ?? 0
          emit({ type: 'clarify_pause', nodeId: node.id, message: `Clarify checkpoint — waiting for user answer` })
          return {
            output: { question: question.trim(), checkpoint: node.id, partial: ctx.variables.__last_output },
            tokens: totalTokens, latencyMs: Date.now() - startTime, trace, status: 'waiting_clarify',
          }
        }

        // ── HITL ─────────────────────────────────────────────────────────────
        case 'hitl': {
          emit({ type: 'hitl_pause', nodeId: node.id, message: `HITL checkpoint — waiting for human` })
          return {
            output: { message: 'Waiting for human', checkpoint: node.id, partial: ctx.variables.__last_output },
            tokens: totalTokens, latencyMs: Date.now() - startTime, trace, status: 'waiting_hitl',
          }
        }

        default:
          result = { output: ctx.variables.__last_output }
      }

      if (result.error) throw new Error(result.error)
      commitResult(node, result)
      const nodeOutput = result.output
      emit({ type: 'node_done', nodeId: node.id, message: `${node.data.label} completed`,
        data: { nodeType: node.data.nodeType, label: node.data.label, tokens: result.tokens,
          output: typeof nodeOutput === 'string' && nodeOutput.length > 2000 ? nodeOutput.slice(0, 2000) + '…' : nodeOutput } })

      // Check loop back-edge: if this node ends a loop body, evaluate exit condition
      if (backEdgeSources.has(node.id)) {
        const loopNodeId = backEdgeSources.get(node.id)!
        const loopNode = nodes.find(n => n.id === loopNodeId)
        if (loopNode) {
          const exit = await shouldExitLoop(loopNode, ctx)
          if (!exit) {
            const loopIdx = loopIndices.get(loopNodeId)
            if (loopIdx !== undefined) {
              i = loopIdx // will re-execute loop node (which increments counter)
              continue
            }
          } else {
            if (ctx.loopCounters) ctx.loopCounters[loopNodeId] = 0
          }
        }
      }

      i++
    }

    // ── Post-workflow nudge (orchestrator only, when conversation history exists) ──
    // After the workflow finishes, check if the user mentioned any other unaddressed
    // tasks/requests during the conversation and gently remind them.
    let nudge: string | undefined
    if (orchCfg?.enabled && orchConvHistory && !resume) {
      try {
        const orchModelKey = orchCfg.model
        const orchCfgResolved = orchModelKey ? ctx.modelConfigs?.[orchModelKey] : undefined
        const userMsg = typeof rawInputValue === 'string' ? rawInputValue : JSON.stringify(rawInputValue)
        const nudgePrompt = `You are ${orchAgentName}.${orchAgentDesc ? ` ${orchAgentDesc}` : ''}

Review this conversation carefully.

Recent conversation:
${orchConvHistory}

Just completed: "${userMsg}"

Rules:
- Only nudge if there is a CLEAR, SPECIFIC unaddressed request from the user (e.g. they asked to do X but it was never done).
- Do NOT nudge about casual messages, greetings, emotional statements, or things that were already responded to.
- Do NOT nudge if the user already acknowledged or moved on from something.
- Do NOT nudge about the current just-completed task.

If there is a clear unaddressed task: write one friendly sentence, e.g. "By the way, you also asked about X — want me to help with that?"
If nothing specific is unaddressed: reply with exactly: null`

        const { text: nudgeRaw } = await callLLM({
          provider: (orchCfgResolved?.provider ?? 'google') as Parameters<typeof callLLM>[0]['provider'],
          model: orchCfgResolved?.modelId ?? orchModelKey,
          apiKey: orchCfgResolved?.apiKey, baseUrl: orchCfgResolved?.baseUrl,
          userMessage: nudgePrompt,
          temperature: 0.5,
          maxTokens: 80,
        })
        const nudgeText = nudgeRaw.trim()
        if (nudgeText && !/^null$/i.test(nudgeText) && !/^none$/i.test(nudgeText)) nudge = nudgeText
      } catch { /* nudge failure is non-fatal */ }
    }

    return {
      output: ctx.variables.__last_output,
      tokens: totalTokens,
      latencyMs: Date.now() - startTime,
      trace,
      status: 'completed',
      ...(nudge ? { nudge } : {}),
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    emit({ type: 'error', message: msg })
    return { output: null, tokens: totalTokens, latencyMs: Date.now() - startTime, trace, status: 'failed', error: msg }
  }
}
