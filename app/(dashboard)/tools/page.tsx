'use client'
import { useState } from 'react'
import { Plus, Trash2, Wrench, Globe, Search, Sparkles, CheckCircle, Loader2, ExternalLink, ChevronDown, X, Info, Pencil, Code, BookOpen, Calculator, Newspaper, Cloud, Rss, Database } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'

interface Tool {
  id: string; name: string; description: string; type: string
  endpoint?: string; method: string; headers: Record<string, string>
  input_schema: Record<string, unknown>; timeout: number; created_at: string
}
interface DatatableCol { name: string; type: string; isPrimaryKey?: boolean }
interface Datatable { id: string; name: string; columns: DatatableCol[]; created_at: string }

const TOOL_TYPES = [
  { value: 'http',       label: 'HTTP Request',  desc: 'Call any REST API endpoint' },
  { value: 'web_search', label: 'Web Search',     desc: 'Built-in search (DuckDuckGo / Tavily / Serper)' },
  { value: 'web_scrape', label: 'Web Scrape',     desc: 'Extract text from any URL via Jina Reader' },
  { value: 'code_exec',  label: 'Code Execution', desc: 'Run Python/JS/Bash in a sandbox (self-hosted Piston / E2B)' },
  { value: 'datatable',  label: 'Datatable',      desc: 'Import rows as LLM context, or export LLM output as a row' },
]

const CODE_PROVIDERS = [
  { value: 'wandbox', label: 'Wandbox', note: 'Free, no key — Python/JS/Bash/Go/Rust…' },
  { value: 'piston',  label: 'Piston',  note: 'Self-hosted only — public API closed Feb 2026' },
  { value: 'e2b',     label: 'E2B',     note: 'Full sandbox, installs packages' },
]
const CODE_LANGUAGES = ['python', 'javascript', 'typescript', 'bash', 'ruby', 'go', 'rust']

const SEARCH_PROVIDERS = [
  { value: 'duckduckgo', label: 'DuckDuckGo',    free: true,  note: 'Instant Answers — free, no key needed' },
  { value: 'tavily',     label: 'Tavily',         free: false, note: '1000 searches/month free', link: 'https://tavily.com' },
  { value: 'serper',     label: 'Serper (Google)',free: false, note: '2500 queries/month free',  link: 'https://serper.dev' },
]

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

type HeaderRow = { key: string; value: string }

const emptyHttp = () => ({
  name: '', description: '', endpoint: '', method: 'POST',
  body_template: '', response_path: '', timeout: '10000',
  headers: [{ key: '', value: '' }] as HeaderRow[],
})
const emptySearch = () => ({
  name: '', description: '', provider: 'duckduckgo', api_key: '', max_results: '5',
})
const emptyScrape = () => ({
  name: '', description: '', api_key: '',
})
const emptyCode = () => ({
  name: '', description: '', code_provider: 'wandbox', code_language: 'python', api_key: '',
  code_template: 'import sys\ndata = sys.stdin.read()\n# process data\nprint(data)', piston_url: '',
})
const emptyDatatable = () => ({ name: '', description: '', datatable_id: '', datatable_name: '', mode: 'export' as 'import' | 'export' })

const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px', borderRadius: 7, fontSize: 12,
  outline: 'none', background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', cursor: 'pointer' }
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block',
}
const taStyle: React.CSSProperties = {
  ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical',
  fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6,
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={labelStyle}>{children}</span>
}

function VarHint() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6, padding: '7px 9px', borderRadius: 6, background: 'rgba(124,111,240,0.07)', border: '1px solid rgba(124,111,240,0.2)' }}>
      <Info size={11} color="var(--blue)" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.5 }}>
        Use <code style={{ background: 'var(--surface2)', padding: '0 3px', borderRadius: 3 }}>{'{{last_output}}'}</code> for prev node output, <code style={{ background: 'var(--surface2)', padding: '0 3px', borderRadius: 3 }}>{'{{input}}'}</code> for original pipeline input, <code style={{ background: 'var(--surface2)', padding: '0 3px', borderRadius: 3 }}>{'{{node.NODE_ID}}'}</code> for any upstream node.
      </span>
    </div>
  )
}

export default function ToolsPage() {
  const { items: tools, loading, saving, create, update, remove } = useRegistry<Tool>('/api/tools')
  const { items: datatables } = useRegistry<Datatable>('/api/datatables')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testInput, setTestInput] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; output?: unknown; error?: string; status?: number } | null>(null)
  const [testRunning, setTestRunning] = useState(false)
  const [formType, setFormType] = useState('http')
  const [httpForm, setHttpForm] = useState(emptyHttp())
  const [searchForm, setSearchForm] = useState(emptySearch())
  const [scrapeForm, setScrapeForm] = useState(emptyScrape())
  const [codeForm, setCodeForm]     = useState(emptyCode())
  const [dtForm, setDtForm]         = useState(emptyDatatable())
  const [error, setError] = useState('')

  // Quick-add state for built-in templates
  const [adding, setAdding] = useState<Record<string, boolean>>({})
  const [justAdded, setJustAdded] = useState<Record<string, boolean>>({})

  const resetForm = () => {
    setHttpForm(emptyHttp()); setSearchForm(emptySearch()); setScrapeForm(emptyScrape()); setCodeForm(emptyCode()); setDtForm(emptyDatatable())
    setError(''); setShowForm(false); setEditingId(null)
  }

  const openEdit = (tool: Tool) => {
    const schema = tool.input_schema ?? {}
    setFormType(tool.type ?? 'http')
    if (tool.type === 'web_search') {
      setSearchForm({
        name: tool.name ?? '',
        description: tool.description ?? '',
        provider: (schema.provider as string) ?? 'duckduckgo',
        api_key: (schema.api_key as string) ?? '',
        max_results: String((schema.max_results as number) ?? 5),
      })
    } else if (tool.type === 'web_scrape') {
      setScrapeForm({ name: tool.name ?? '', description: tool.description ?? '', api_key: (schema.api_key as string) ?? '' })
    } else if (tool.type === 'code_exec') {
      setCodeForm({
        name: tool.name ?? '', description: tool.description ?? '',
        code_provider: (schema.provider as string) ?? 'wandbox',
        code_language: (schema.language as string) ?? 'python',
        api_key: (schema.api_key as string) ?? '',
        code_template: (schema.code_template as string) ?? 'import sys\ndata = sys.stdin.read()\nprint(data)',
        piston_url: (schema.piston_url as string) ?? '',
      })
    } else if (tool.type === 'datatable') {
      setDtForm({
        name: tool.name ?? '', description: tool.description ?? '',
        datatable_id: (schema.datatable_id as string) ?? '',
        datatable_name: (schema.datatable_name as string) ?? '',
        mode: ((schema.mode as string) ?? 'export') as 'import' | 'export',
      })
    } else {
      // http
      const existingHeaders = tool.headers ?? {}
      const headerRows: HeaderRow[] = Object.entries(existingHeaders).map(([key, value]) => ({ key, value }))
      if (headerRows.length === 0) headerRows.push({ key: '', value: '' })
      else headerRows.push({ key: '', value: '' }) // trailing empty row
      setHttpForm({
        name: tool.name ?? '',
        description: tool.description ?? '',
        endpoint: tool.endpoint ?? '',
        method: tool.method ?? 'POST',
        body_template: (schema.body_template as string) ?? '',
        response_path: (schema.response_path as string) ?? '',
        timeout: String(tool.timeout ?? 10000),
        headers: headerRows,
      })
    }
    setEditingId(tool.id)
    setShowForm(true)
    setError('')
  }

  const saveForm = async () => {
    setError('')
    let payload: Record<string, unknown> = {}

    if (formType === 'http') {
      if (!httpForm.name.trim()) { setError('Name is required'); return }
      if (!httpForm.endpoint.trim()) { setError('Endpoint URL is required'); return }
      const headers: Record<string, string> = {}
      for (const { key, value } of httpForm.headers) if (key.trim()) headers[key.trim()] = value
      payload = {
        name: httpForm.name.trim(), description: httpForm.description.trim(),
        type: 'http', method: httpForm.method,
        endpoint: httpForm.endpoint.trim(),
        headers, timeout: parseInt(httpForm.timeout) || 10000,
        inputSchema: {
          body_template: httpForm.body_template.trim(),
          response_path: httpForm.response_path.trim(),
        },
      }
    } else if (formType === 'web_search') {
      if (!searchForm.name.trim()) { setError('Name is required'); return }
      if (searchForm.provider !== 'duckduckgo' && !searchForm.api_key.trim()) {
        setError('API key is required for ' + searchForm.provider); return
      }
      payload = {
        name: searchForm.name.trim(), description: searchForm.description.trim(),
        type: 'web_search', method: 'GET', endpoint: '', headers: {}, timeout: 10000,
        inputSchema: { provider: searchForm.provider, api_key: searchForm.api_key.trim(), max_results: parseInt(searchForm.max_results) || 5 },
      }
    } else if (formType === 'web_scrape') {
      if (!scrapeForm.name.trim()) { setError('Name is required'); return }
      payload = {
        name: scrapeForm.name.trim(), description: scrapeForm.description.trim(),
        type: 'web_scrape', method: 'GET', endpoint: '', headers: {}, timeout: 15000,
        inputSchema: { api_key: scrapeForm.api_key.trim() },
      }
    } else if (formType === 'datatable') {
      if (!dtForm.name.trim()) { setError('Name is required'); return }
      if (!dtForm.datatable_id) { setError('Select a datatable'); return }
      const dt = datatables.find(d => d.id === dtForm.datatable_id)
      payload = {
        name: dtForm.name.trim(), description: dtForm.description.trim(),
        type: 'datatable', method: 'GET', endpoint: '', headers: {}, timeout: 10000,
        inputSchema: { datatable_id: dtForm.datatable_id, datatable_name: dt?.name ?? '', mode: dtForm.mode, columns: dt?.columns ?? [] },
      }
    } else {
      // code_exec
      if (!codeForm.name.trim()) { setError('Name is required'); return }
      if (codeForm.code_provider === 'e2b' && !codeForm.api_key.trim()) { setError('E2B API key is required'); return }
      payload = {
        name: codeForm.name.trim(), description: codeForm.description.trim(),
        type: 'code_exec', method: 'POST', endpoint: '', headers: {}, timeout: 30000,
        inputSchema: { provider: codeForm.code_provider, language: codeForm.code_language, api_key: codeForm.api_key.trim(), code_template: codeForm.code_template, piston_url: codeForm.piston_url.trim() },
      }
    }

    if (editingId) {
      await update(editingId, payload)
    } else {
      await create(payload)
    }
    resetForm()
  }

  const quickAddSearch = async (provider: string) => {
    const key = `search_${provider}`
    if (adding[key]) return
    setAdding(a => ({ ...a, [key]: true }))
    const pInfo = SEARCH_PROVIDERS.find(p => p.value === provider)!
    await create({
      name: pInfo.label + ' Search',
      description: pInfo.note,
      type: 'web_search', method: 'GET', endpoint: '', headers: {}, timeout: 10000,
      inputSchema: { provider, api_key: '', max_results: 5 },
    })
    setAdding(a => ({ ...a, [key]: false }))
    setJustAdded(a => ({ ...a, [key]: true }))
    setTimeout(() => setJustAdded(a => ({ ...a, [key]: false })), 3000)
  }

  const setHeader = (i: number, field: 'key' | 'value', val: string) => {
    setHttpForm(f => {
      const rows = [...f.headers]
      rows[i] = { ...rows[i], [field]: val }
      if (i === rows.length - 1 && (rows[i].key || rows[i].value)) rows.push({ key: '', value: '' })
      return { ...f, headers: rows }
    })
  }
  const removeHeader = (i: number) => setHttpForm(f => ({ ...f, headers: f.headers.filter((_, idx) => idx !== i) }))

  const runTest = async (tool: Tool) => {
    setTestRunning(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/tools/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, input: testInput }),
      })
      const text = await res.text()
      const data = (() => { try { return JSON.parse(text) } catch { return { ok: false, error: `Server error ${res.status}` } } })()
      setTestResult(data)
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : 'Network error' })
    }
    setTestRunning(false)
  }

  const typeIcon = (t: string) =>
    t === 'web_search' ? <Search size={13} color="var(--blue)" /> :
    t === 'web_scrape' ? <Globe size={13} color="var(--blue)" /> :
    t === 'code_exec'  ? <Code size={13} color="var(--purple)" /> :
    t === 'datatable'  ? <Database size={13} color="#7c6ff0" /> :
    <Wrench size={13} color="var(--text3)" />

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Tools</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Add tool nodes to your agents. Inputs from the previous node are passed automatically using template variables.</p>
        </div>
        <button onClick={() => { if (showForm) { resetForm() } else { setShowForm(true); setEditingId(null) } }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> {showForm ? 'Cancel' : 'Add Tool'}
        </button>
      </div>

      {/* Add / Edit tool form */}
      {showForm && (
        <div style={{ padding: 22, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{editingId ? 'Edit Tool' : 'New Tool'}</span>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}><X size={14} /></button>
          </div>

          {/* Type selector */}
          <div style={{ marginBottom: 18 }}>
            <Label>Tool Type</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TOOL_TYPES.map(t => (
                <button key={t.value} onClick={() => setFormType(t.value)} style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${formType === t.value ? 'var(--blue)' : 'var(--border)'}`,
                  background: formType === t.value ? 'rgba(124,111,240,0.08)' : 'var(--surface2)',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: formType === t.value ? 'var(--blue)' : 'var(--text)', marginBottom: 2 }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.3 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name + description (all types) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <Label>Name</Label>
              <input
                value={formType === 'http' ? httpForm.name : formType === 'web_search' ? searchForm.name : formType === 'web_scrape' ? scrapeForm.name : formType === 'datatable' ? dtForm.name : codeForm.name}
                onChange={e => formType === 'http' ? setHttpForm(f => ({ ...f, name: e.target.value })) : formType === 'web_search' ? setSearchForm(f => ({ ...f, name: e.target.value })) : formType === 'web_scrape' ? setScrapeForm(f => ({ ...f, name: e.target.value })) : formType === 'datatable' ? setDtForm(f => ({ ...f, name: e.target.value })) : setCodeForm(f => ({ ...f, name: e.target.value }))}
                style={inputStyle} placeholder="My Tool" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <input
                value={formType === 'http' ? httpForm.description : formType === 'web_search' ? searchForm.description : formType === 'web_scrape' ? scrapeForm.description : formType === 'datatable' ? dtForm.description : codeForm.description}
                onChange={e => formType === 'http' ? setHttpForm(f => ({ ...f, description: e.target.value })) : formType === 'web_search' ? setSearchForm(f => ({ ...f, description: e.target.value })) : formType === 'web_scrape' ? setScrapeForm(f => ({ ...f, description: e.target.value })) : formType === 'datatable' ? setDtForm(f => ({ ...f, description: e.target.value })) : setCodeForm(f => ({ ...f, description: e.target.value }))}
                style={inputStyle} placeholder="What does this tool do?" />
            </div>
          </div>

          {/* HTTP fields */}
          {formType === 'http' && (<>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <Label>Method</Label>
                <div style={{ position: 'relative' }}>
                  <select value={httpForm.method} onChange={e => setHttpForm(f => ({ ...f, method: e.target.value }))} style={selectStyle}>
                    {HTTP_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                  <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                </div>
              </div>
              <div>
                <Label>Endpoint URL</Label>
                <input value={httpForm.endpoint} onChange={e => setHttpForm(f => ({ ...f, endpoint: e.target.value }))} style={inputStyle} placeholder="https://api.example.com/search?q={{last_output}}" />
              </div>
            </div>
            <VarHint />

            {/* Headers */}
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <Label>Headers</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {httpForm.headers.map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={row.key} onChange={e => setHeader(i, 'key', e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Header-Name" />
                    <input value={row.value} onChange={e => setHeader(i, 'value', e.target.value)} style={{ ...inputStyle, flex: 2 }} placeholder="value or {{last_output}}" />
                    {httpForm.headers.length > 1 && (
                      <button onClick={() => removeHeader(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', flexShrink: 0, display: 'flex' }}><X size={12} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Body template (POST/PUT/PATCH) */}
            {!['GET', 'DELETE', 'HEAD'].includes(httpForm.method) && (
              <div style={{ marginBottom: 14 }}>
                <Label>Request Body (JSON template)</Label>
                <textarea value={httpForm.body_template} onChange={e => setHttpForm(f => ({ ...f, body_template: e.target.value }))}
                  rows={5} style={taStyle}
                  placeholder={'{\n  "query": "{{last_output}}",\n  "api_key": "your-key",\n  "limit": 5\n}'} />
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Leave empty to auto-send <code style={{ background: 'var(--surface2)', padding: '0 3px', borderRadius: 3 }}>{'{"input":"{{last_output}}"}'}</code></div>
              </div>
            )}

            {/* Timeout + response path */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Response Path (optional)</Label>
                <input value={httpForm.response_path} onChange={e => setHttpForm(f => ({ ...f, response_path: e.target.value }))} style={inputStyle} placeholder="results.0.text" />
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Dot notation to extract from JSON response</div>
              </div>
              <div>
                <Label>Timeout (ms)</Label>
                <input value={httpForm.timeout} onChange={e => setHttpForm(f => ({ ...f, timeout: e.target.value }))} style={inputStyle} type="number" />
              </div>
            </div>
          </>)}

          {/* Web search fields */}
          {formType === 'web_search' && (<>
            <div style={{ marginBottom: 14 }}>
              <Label>Search Provider</Label>
              <div style={{ position: 'relative' }}>
                <select value={searchForm.provider} onChange={e => setSearchForm(f => ({ ...f, provider: e.target.value }))} style={selectStyle}>
                  {SEARCH_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label} — {p.note}</option>)}
                </select>
                <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            </div>
            {searchForm.provider !== 'duckduckgo' && (
              <div style={{ marginBottom: 14 }}>
                <Label>API Key {SEARCH_PROVIDERS.find(p => p.value === searchForm.provider)?.link && (
                  <a href={SEARCH_PROVIDERS.find(p => p.value === searchForm.provider)?.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontWeight: 400, marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Get free key <ExternalLink size={9} /></a>
                )}</Label>
                <input value={searchForm.api_key} onChange={e => setSearchForm(f => ({ ...f, api_key: e.target.value }))} style={inputStyle} placeholder={searchForm.provider === 'tavily' ? 'tvly-...' : 'your-serper-key'} />
              </div>
            )}
            <div>
              <Label>Max results</Label>
              <input value={searchForm.max_results} onChange={e => setSearchForm(f => ({ ...f, max_results: e.target.value }))} style={{ ...inputStyle, width: 120 }} type="number" min="1" max="20" />
            </div>
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 7, background: 'rgba(34,215,154,0.06)', border: '1px solid rgba(34,215,154,0.2)', fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
              The tool uses the <strong>previous node&apos;s output</strong> as the search query automatically. Connect an LLM or Input node before this tool node.
            </div>
          </>)}

          {/* Web scrape fields */}
          {formType === 'web_scrape' && (<>
            <div style={{ marginBottom: 14 }}>
              <Label>Jina API Key (optional — higher rate limit)</Label>
              <input value={scrapeForm.api_key} onChange={e => setScrapeForm(f => ({ ...f, api_key: e.target.value }))} style={inputStyle} placeholder="jina_..." />
              <a href="https://jina.ai/reader" target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--blue)', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                Get key at jina.ai/reader <ExternalLink size={9} />
              </a>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(34,215,154,0.06)', border: '1px solid rgba(34,215,154,0.2)', fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
              The tool scrapes the URL from the <strong>previous node&apos;s output</strong>. Pass a URL-producing LLM node or Input node before this.
            </div>
          </>)}

          {/* Code execution fields */}
          {formType === 'code_exec' && (<>
            <div style={{ marginBottom: 14 }}>
              <Label>Provider</Label>
              <div style={{ position: 'relative' }}>
                <select value={codeForm.code_provider} onChange={e => setCodeForm(f => ({ ...f, code_provider: e.target.value }))} style={selectStyle}>
                  {CODE_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label} — {p.note}</option>)}
                </select>
                <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            </div>
            {codeForm.code_provider === 'piston' && (
              <div style={{ marginBottom: 14 }}>
                <Label>Piston Base URL</Label>
                <input value={codeForm.piston_url} onChange={e => setCodeForm(f => ({ ...f, piston_url: e.target.value }))} style={inputStyle} placeholder="http://localhost:2000" />
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
                  Public API is whitelist-only since Feb 2026. Self-host with Docker: <code style={{ background: 'var(--surface2)', padding: '0 3px', borderRadius: 3 }}>docker run -p 2000:2000 ghcr.io/engineer-man/piston</code>
                </div>
              </div>
            )}
            {codeForm.code_provider === 'e2b' && (
              <div style={{ marginBottom: 14 }}>
                <Label>E2B API Key <a href="https://e2b.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontWeight: 400, marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Get key <ExternalLink size={9} /></a></Label>
                <input value={codeForm.api_key} onChange={e => setCodeForm(f => ({ ...f, api_key: e.target.value }))} style={inputStyle} placeholder="e2b_..." />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <Label>Language</Label>
              <div style={{ position: 'relative' }}>
                <select value={codeForm.code_language} onChange={e => setCodeForm(f => ({ ...f, code_language: e.target.value }))} style={selectStyle}>
                  {CODE_LANGUAGES.map(l => <option key={l}>{l}</option>)}
                </select>
                <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <Label>Code Template</Label>
              <textarea value={codeForm.code_template} onChange={e => setCodeForm(f => ({ ...f, code_template: e.target.value }))}
                rows={8} style={taStyle}
                placeholder={'import sys\ndata = sys.stdin.read()\n# process data\nprint(data.upper())'} />
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
                Previous node output arrives as <code style={{ background: 'var(--surface2)', padding: '0 3px', borderRadius: 3 }}>stdin</code>.
                Use <code style={{ background: 'var(--surface2)', padding: '0 3px', borderRadius: 3 }}>{'{{last_output}}'}</code> anywhere in the code too.
              </div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
              Runs in an isolated sandbox. stdout becomes the output to the next node.
            </div>
          </>)}

          {/* Datatable fields */}
          {formType === 'datatable' && (<>
            <div style={{ marginBottom: 14 }}>
              <Label>Datatable</Label>
              <div style={{ position: 'relative' }}>
                <select value={dtForm.datatable_id} onChange={e => setDtForm(f => ({ ...f, datatable_id: e.target.value }))} style={selectStyle}>
                  <option value="">— select a datatable —</option>
                  {datatables.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
              {datatables.length === 0 && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>No datatables yet — create one in the Datatables page first.</div>}
            </div>
            <div style={{ marginBottom: 14 }}>
              <Label>Mode</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['import', 'export'] as const).map(m => (
                  <button key={m} onClick={() => setDtForm(f => ({ ...f, mode: m }))} style={{
                    flex: 1, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    border: `1px solid ${dtForm.mode === m ? '#7c6ff0' : 'var(--border)'}`,
                    background: dtForm.mode === m ? 'rgba(124,111,240,0.08)' : 'var(--surface2)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: dtForm.mode === m ? '#7c6ff0' : 'var(--text)', marginBottom: 2 }}>
                      {m === 'import' ? '⬇ Import' : '⬆ Export'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.3 }}>
                      {m === 'import' ? 'Load all rows as context for the next LLM node' : 'Parse LLM JSON output and write as a new row'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {dtForm.datatable_id && (() => {
              const dt = datatables.find(d => d.id === dtForm.datatable_id)
              if (!dt?.columns?.length) return null
              return (
                <div style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--surface2)', border: '1px solid var(--border)', marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Columns</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {dt.columns.map(c => (
                      <span key={c.name} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: c.isPrimaryKey ? 'rgba(124,111,240,0.12)' : 'var(--surface)', border: `1px solid ${c.isPrimaryKey ? 'rgba(124,111,240,0.4)' : 'var(--border)'}`, color: c.isPrimaryKey ? '#7c6ff0' : 'var(--text2)' }}>
                        {c.name} <span style={{ opacity: 0.6 }}>({c.type})</span>{c.isPrimaryKey ? ' 🔑' : ''}
                      </span>
                    ))}
                  </div>
                  {dtForm.mode === 'export' && (
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
                      The LLM node before this tool must output a JSON object with matching column keys.
                    </div>
                  )}
                </div>
              )
            })()}
          </>)}

          {error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 12 }}>{error}</div>}

          <button onClick={saveForm} disabled={saving} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : editingId ? <Pencil size={13} /> : <Plus size={13} />}
            {editingId ? 'Save Changes' : 'Save Tool'}
          </button>
        </div>
      )}

      {/* Quick-add templates */}
      {!showForm && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Quick Add</div>

          {([
            {
              group: 'Web Search',
              items: [
                { key: 'search_duckduckgo', label: 'DuckDuckGo',  icon: Search,   badge: 'Free · No key', color: '#22d79a', fn: () => quickAddSearch('duckduckgo') },
                { key: 'search_tavily',     label: 'Tavily',       icon: Sparkles, badge: 'Free tier',     color: '#7c6ff0', fn: () => quickAddSearch('tavily') },
                { key: 'search_serper',     label: 'Serper',       icon: Search,   badge: 'Free tier',     color: '#f5a020', fn: () => quickAddSearch('serper') },
              ],
            },
            {
              group: 'Data & Knowledge',
              items: [
                { key: 'wiki',      label: 'Wikipedia',      icon: BookOpen,   badge: 'Free · No key', color: '#60a5fa',
                  fn: async () => { setAdding(a=>({...a,wiki:true})); await create({ name:'Wikipedia Summary', description:'Get Wikipedia summary for a topic', type:'http', method:'GET', endpoint:'https://en.wikipedia.org/api/rest_v1/page/summary/{{last_output}}', headers:{}, timeout:8000, inputSchema:{ response_path:'extract' } }); setAdding(a=>({...a,wiki:false})); setJustAdded(a=>({...a,wiki:true})); setTimeout(()=>setJustAdded(a=>({...a,wiki:false})),3000) } },
                { key: 'hn',        label: 'Hacker News',    icon: Newspaper,  badge: 'Free · No key', color: '#fb923c',
                  fn: async () => { setAdding(a=>({...a,hn:true})); await create({ name:'Hacker News Search', description:'Search HN stories via Algolia', type:'http', method:'GET', endpoint:'https://hn.algolia.com/api/v1/search?query={{last_output}}&hitsPerPage=5', headers:{}, timeout:8000, inputSchema:{ response_path:'hits' } }); setAdding(a=>({...a,hn:false})); setJustAdded(a=>({...a,hn:true})); setTimeout(()=>setJustAdded(a=>({...a,hn:false})),3000) } },
                { key: 'math',      label: 'Calculator',     icon: Calculator, badge: 'Free · No key', color: '#34d399',
                  fn: async () => { setAdding(a=>({...a,math:true})); await create({ name:'Math Calculator', description:'Evaluate math expressions via mathjs', type:'http', method:'GET', endpoint:'https://api.mathjs.org/v4/?expr={{last_output}}', headers:{}, timeout:5000, inputSchema:{ response_path:'' } }); setAdding(a=>({...a,math:false})); setJustAdded(a=>({...a,math:true})); setTimeout(()=>setJustAdded(a=>({...a,math:false})),3000) } },
                { key: 'weather',   label: 'Weather',        icon: Cloud,      badge: 'Free · No key', color: '#38bdf8',
                  fn: async () => { setAdding(a=>({...a,weather:true})); await create({ name:'Weather', description:'Get current weather for a city (wttr.in)', type:'http', method:'GET', endpoint:'https://wttr.in/{{last_output}}?format=3', headers:{'Accept':'text/plain'}, timeout:8000, inputSchema:{ response_path:'' } }); setAdding(a=>({...a,weather:false})); setJustAdded(a=>({...a,weather:true})); setTimeout(()=>setJustAdded(a=>({...a,weather:false})),3000) } },
                { key: 'rss',       label: 'RSS News',       icon: Rss,        badge: 'Free · No key', color: '#f97316',
                  fn: async () => { setAdding(a=>({...a,rss:true})); await create({ name:'RSS News Search', description:'Search Google News RSS by keyword', type:'http', method:'GET', endpoint:'https://news.google.com/rss/search?q={{last_output}}&hl=en&gl=US&ceid=US:en', headers:{}, timeout:8000, inputSchema:{ response_path:'' } }); setAdding(a=>({...a,rss:false})); setJustAdded(a=>({...a,rss:true})); setTimeout(()=>setJustAdded(a=>({...a,rss:false})),3000) } },
              ],
            },
            {
              group: 'Scrape & Execute',
              items: [
                { key: 'scrape_jina', label: 'Jina Scraper',    icon: Globe, badge: 'Free · No key', color: '#22d79a',
                  fn: async () => { setAdding(a=>({...a,scrape_jina:true})); await create({ name:'Jina Web Scraper', description:'Scrape any URL and get clean text', type:'web_scrape', method:'GET', endpoint:'', headers:{}, timeout:15000, inputSchema:{ api_key:'' } }); setAdding(a=>({...a,scrape_jina:false})); setJustAdded(a=>({...a,scrape_jina:true})); setTimeout(()=>setJustAdded(a=>({...a,scrape_jina:false})),3000) } },
                { key: 'code_piston', label: 'Python Executor', icon: Code,  badge: 'Free · No key', color: '#a78bfa',
                  fn: async () => { setAdding(a=>({...a,code_piston:true})); await create({ name:'Python Executor', description:'Run Python code on previous node output', type:'code_exec', method:'POST', endpoint:'', headers:{}, timeout:30000, inputSchema:{ provider:'wandbox', language:'python', api_key:'', piston_url:'', code_template:'import sys\ndata = sys.stdin.read()\n# process data\nprint(data)' } }); setAdding(a=>({...a,code_piston:false})); setJustAdded(a=>({...a,code_piston:true})); setTimeout(()=>setJustAdded(a=>({...a,code_piston:false})),3000) } },
              ],
            },
          ] as { group: string; items: { key: string; label: string; icon: React.ElementType; badge: string; color: string; fn: () => void }[] }[]).map(({ group, items }) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{group}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {items.map(({ key, label, icon: Icon, badge, color, fn }) => {
                  const done = justAdded[key]
                  return (
                    <button key={key} onClick={fn} disabled={adding[key] || done} style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 8,
                      border: `1px solid ${done ? color + '40' : 'var(--border)'}`,
                      background: done ? `${color}0d` : 'var(--surface)', cursor: done ? 'default' : 'pointer',
                    }}>
                      <Icon size={13} color={color} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${color}18`, color, fontWeight: 700 }}>{badge}</span>
                      {adding[key] && <Loader2 size={11} color="var(--text3)" style={{ animation: 'spin 1s linear infinite' }} />}
                      {done && <CheckCircle size={11} color={color} />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
            Tavily/Serper need an API key — edit the tool after adding. All others work with no key.
          </div>
        </div>
      )}

      {/* My tools */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>My Tools ({tools.length})</div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Loader2 size={20} style={{ color: 'var(--text3)', animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>
        ) : tools.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', borderRadius: 12, border: '1px dashed var(--border)' }}>
            <Wrench size={24} style={{ color: 'var(--text3)', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>No tools yet. Quick-add a template above or click Add Tool for a custom HTTP tool.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tools.map(tool => {
              const schema = tool.input_schema ?? {}
              const meta = (() => {
                if (tool.type === 'web_search') return `${(schema as Record<string, unknown>).provider ?? 'duckduckgo'} · uses prev node output as query`
                if (tool.type === 'web_scrape') return 'jina.ai · uses prev node output as URL'
                if (tool.type === 'http') return `${tool.method ?? 'POST'} ${tool.endpoint ?? '—'}`
                return tool.endpoint ?? '—'
              })()
              const isTesting = testingId === tool.id
              return (
                <div key={tool.id} style={{ borderRadius: 10, background: 'var(--surface)', border: `1px solid ${isTesting ? 'var(--blue)' : 'var(--border)'}`, overflow: 'hidden' }}>
                  {/* Tool row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {typeIcon(tool.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{tool.name}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--surface2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text3)' }}>{tool.type}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.description || meta}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => { setTestingId(isTesting ? null : tool.id); setTestResult(null); setTestInput('') }} style={{ height: 28, padding: '0 10px', borderRadius: 6, border: `1px solid ${isTesting ? 'var(--blue)' : 'var(--border)'}`, background: isTesting ? 'rgba(124,111,240,0.1)' : 'var(--surface2)', color: isTesting ? 'var(--blue)' : 'var(--text3)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                        Test
                      </button>
                      <button onClick={() => openEdit(tool)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Pencil size={11} />
                      </button>
                      <button onClick={() => setDeleteId(tool.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Test panel */}
                  {isTesting && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'var(--surface2)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Test Input</div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <input
                          value={testInput}
                          onChange={e => setTestInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && runTest(tool)}
                          placeholder={tool.type === 'web_search' ? 'e.g. latest AI news' : tool.type === 'web_scrape' ? 'e.g. https://example.com' : tool.type === 'code_exec' ? 'stdin input for your code' : 'value for {{last_output}}'}
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button onClick={() => runTest(tool)} disabled={testRunning} style={{ padding: '0 16px', borderRadius: 7, border: 'none', background: 'var(--blue)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {testRunning ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                          {testRunning ? 'Running…' : 'Run'}
                        </button>
                      </div>
                      {testResult && (
                        <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${testResult.ok ? 'rgba(34,215,154,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                          <div style={{ padding: '6px 10px', background: testResult.ok ? 'rgba(34,215,154,0.08)' : 'rgba(248,113,113,0.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {testResult.ok ? <CheckCircle size={11} color="#22d79a" /> : <X size={11} color="var(--red)" />}
                            <span style={{ fontSize: 10, fontWeight: 700, color: testResult.ok ? '#22d79a' : 'var(--red)' }}>{testResult.ok ? 'Success' : 'Failed'}</span>
                            {testResult.status && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>HTTP {testResult.status}</span>}
                          </div>
                          <pre style={{ margin: 0, padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 240, overflowY: 'auto', background: 'var(--bg)' }}>
                            {testResult.error ?? (typeof testResult.output === 'string' ? testResult.output : JSON.stringify(testResult.output, null, 2))}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteId}
        title="Delete tool?"
        message="Agents using this tool will stop working until you reassign them."
        danger
        onConfirm={() => { if (deleteId) remove(deleteId) }}
        onClose={() => setDeleteId(null)}
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
