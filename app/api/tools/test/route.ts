import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { tool, input } = await req.json() as {
      tool: {
        type: string; endpoint?: string; method?: string
        headers?: Record<string, string>; timeout?: number
        input_schema?: Record<string, unknown>
      }
      input: string
    }

    const type = tool.type ?? 'http'
    const schema = tool.input_schema ?? {}
    const resolvedInput = input ?? ''

    const resolveVars = (s: string) =>
      s.replace(/\{\{last_output\}\}/g, resolvedInput)
       .replace(/\{\{input\}\}/g, resolvedInput)

    // ── Web Search ──────────────────────────────────────────────────────────
    if (type === 'web_search') {
      const provider = (schema.provider as string) ?? 'duckduckgo'
      const apiKey   = (schema.api_key  as string) ?? ''
      const maxRes   = (schema.max_results as number) ?? 5
      const query    = resolvedInput

      if (provider === 'duckduckgo') {
        const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`, { signal: AbortSignal.timeout(8000) })
        const data = await res.json()
        return NextResponse.json({ ok: true, output: data.AbstractText || JSON.stringify(data.RelatedTopics?.slice(0, 3)) })
      }
      if (provider === 'tavily') {
        const res = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: apiKey, query, max_results: maxRes }), signal: AbortSignal.timeout(10000) })
        const data = await res.json()
        return NextResponse.json({ ok: res.ok, output: data })
      }
      if (provider === 'serper') {
        const res = await fetch('https://google.serper.dev/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey }, body: JSON.stringify({ q: query, num: maxRes }), signal: AbortSignal.timeout(10000) })
        const data = await res.json()
        return NextResponse.json({ ok: res.ok, output: data })
      }
    }

    // ── Web Scrape ───────────────────────────────────────────────────────────
    if (type === 'web_scrape') {
      const apiKey = (schema.api_key as string) ?? ''
      const headers: Record<string, string> = { 'Accept': 'text/plain' }
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
      const res = await fetch(`https://r.jina.ai/${resolvedInput}`, { headers, signal: AbortSignal.timeout(15000) })
      const text = await res.text()
      return NextResponse.json({ ok: res.ok, output: text.slice(0, 2000) + (text.length > 2000 ? '\n…(truncated)' : '') })
    }

    // ── Code Exec ────────────────────────────────────────────────────────────
    if (type === 'code_exec') {
      const provider = (schema.provider as string) ?? 'wandbox'
      const language = (schema.language as string) ?? 'python'
      const codeTemplate = (schema.code_template as string) ?? 'import sys\nprint(sys.stdin.read())'
      const code = resolveVars(codeTemplate)
      const stdin = resolvedInput ? (resolvedInput.endsWith('\n') ? resolvedInput : resolvedInput + '\n') : ''

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
        if (!res.ok) return NextResponse.json({ ok: false, output: `Wandbox error (HTTP ${res.status})` })
        const data = await res.json()
        const compileErr = (data.compiler_error ?? '').trim()
        if (compileErr) return NextResponse.json({ ok: false, output: `Compile error:\n${compileErr}` })
        const output = (data.program_output ?? '').trim() || (data.program_error ?? '').trim() || '(no output)'
        const ok = data.status === '0' && !data.program_error?.trim()
        return NextResponse.json({ ok, output })
      }

      if (provider === 'piston') {
        const pistonBase = ((schema.piston_url as string) ?? '').replace(/\/$/, '')
        if (!pistonBase) return NextResponse.json({ ok: false, output: 'Piston base URL not set. Public API requires whitelist since Feb 2026.' })
        const res = await fetch(`${pistonBase}/api/v2/piston/execute`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language, version: '*', files: [{ content: code }], stdin }),
          signal: AbortSignal.timeout(20000),
        })
        const data = await res.json()
        if (!res.ok || !data.run) return NextResponse.json({ ok: false, output: data.message ?? `Piston error (HTTP ${res.status})` })
        const compileErr = data.compile?.stderr?.trim() || ''
        const runOut = data.run?.stdout?.trim() || data.run?.stderr?.trim() || ''
        return NextResponse.json({ ok: !compileErr && data.run?.code === 0, output: runOut || compileErr || '(no output)' })
      }
    }

    // ── Datatable ────────────────────────────────────────────────────────────
    if (type === 'datatable') {
      const mode = (schema.mode as string) ?? 'import'
      const datatableId = schema.datatable_id as string | undefined
      const datatableName = (schema.datatable_name as string) ?? datatableId ?? '(unknown)'
      const columns = (schema.columns as Array<{ name: string; type: string; isPrimaryKey?: boolean }>) ?? []

      if (mode === 'import') {
        const colList = columns.map(c => `${c.name} (${c.type}${c.isPrimaryKey ? ', PK' : ''})`).join(', ')
        return NextResponse.json({ ok: true, output: `[Datatable Import Preview]\nTable: ${datatableName}\nColumns: ${colList || '(none configured)'}\n\nThis tool will fetch all rows from "${datatableName}" and pass them as context to the next LLM node.` })
      }

      if (mode === 'export') {
        // Try to parse input as JSON to validate
        let parsed: unknown = null
        try { parsed = JSON.parse(resolvedInput) } catch { /* not JSON */ }
        if (!resolvedInput.trim()) {
          return NextResponse.json({ ok: true, output: `[Datatable Export Preview]\nTable: ${datatableName}\n\nThis tool will parse the previous LLM node's JSON output and write it as a new row to "${datatableName}". Provide a JSON object in the test input to validate.` })
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return NextResponse.json({ ok: false, output: `Export validation failed: input must be a JSON object.\n\nReceived: ${resolvedInput.slice(0, 200)}` })
        }
        const pkCol = columns.find(c => c.isPrimaryKey)
        if (pkCol && !(pkCol.name in (parsed as Record<string, unknown>))) {
          return NextResponse.json({ ok: false, output: `Export validation failed: primary key column "${pkCol.name}" is missing from the JSON object.\n\nProvided keys: ${Object.keys(parsed as object).join(', ')}` })
        }
        return NextResponse.json({ ok: true, output: `Export validation passed.\nTable: ${datatableName}\nRow data: ${JSON.stringify(parsed, null, 2)}\n\n(This is a dry-run — no row was written. Run the agent to write real rows.)` })
      }

      return NextResponse.json({ ok: false, error: `Unknown datatable mode: ${mode}` })
    }

    // ── HTTP ─────────────────────────────────────────────────────────────────
    const rawUrl = tool.endpoint ?? ''
    if (!rawUrl.trim()) return NextResponse.json({ ok: false, error: 'No endpoint configured' })

    const url = resolveVars(rawUrl)
    const method = (tool.method ?? 'GET').toUpperCase()
    const timeout = tool.timeout ?? 10000
    const baseHeaders = tool.headers ?? {}
    const resolvedHeaders: Record<string, string> = {}
    for (const [k, v] of Object.entries(baseHeaders)) resolvedHeaders[k] = resolveVars(v)

    const init: RequestInit = { method, headers: resolvedHeaders, signal: AbortSignal.timeout(timeout) }

    if (!['GET', 'HEAD', 'DELETE'].includes(method)) {
      const bodyTemplate = schema.body_template as string | undefined
      resolvedHeaders['Content-Type'] = resolvedHeaders['Content-Type'] ?? 'application/json'
      init.body = bodyTemplate?.trim() ? resolveVars(bodyTemplate) : JSON.stringify({ input: resolvedInput })
    }

    const res = await fetch(url, init)
    const text = await res.text()
    let parsed: unknown = text
    try { parsed = JSON.parse(text) } catch { /* keep as text */ }

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

    const responsePath = (schema.response_path as string) ?? ''
    const raw = parsed
    if (responsePath) {
      parsed = responsePath.split('.').reduce((acc: unknown, key) => {
        if (acc == null) return acc
        if (Array.isArray(acc)) return acc[parseInt(key)]
        return (acc as Record<string, unknown>)[key]
      }, parsed)
    }

    // If response_path extraction yielded nothing, return the full response with a note
    if (responsePath && (parsed == null || parsed === undefined)) {
      return NextResponse.json({ ok: false, status: res.status, output: raw, error: `response_path "${responsePath}" not found in response` })
    }

    return NextResponse.json({ ok: res.ok, status: res.status, output: parsed })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Unknown error' })
  }
}
