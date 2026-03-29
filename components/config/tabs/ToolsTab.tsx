'use client'
import { useState } from 'react'
import { Plus, Trash2, Wrench, Globe, Search, Code } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'
import { Field, FormButtons, FormHeading } from './_shared'

interface Tool {
  id: string; name: string; description: string; type: string
  endpoint?: string; method?: string; headers?: Record<string, string>
  input_schema?: Record<string, unknown>; timeout?: number; created_at: string
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const SEARCH_PROVIDERS = [
  { value: 'duckduckgo', label: 'DuckDuckGo — free, no key' },
  { value: 'tavily',     label: 'Tavily' },
  { value: 'serper',     label: 'Serper (Google)' },
]
const CODE_PROVIDERS = [
  { value: 'wandbox', label: 'Wandbox — free, no key (Python/JS/Bash/Go/Rust…)' },
  { value: 'piston',  label: 'Piston — self-hosted (URL required)' },
  { value: 'e2b',     label: 'E2B — full sandbox (API key required)' },
]
const CODE_LANGUAGES = ['python', 'javascript', 'typescript', 'bash', 'ruby', 'go', 'rust']

type HeaderRow = { key: string; value: string }

const emptyForm = () => ({
  name: '', description: '', type: 'http',
  method: 'POST', endpoint: '', bodyTemplate: '', responsePath: '', timeout: '10000',
  provider: 'duckduckgo', apiKey: '', maxResults: '5',
  headers: [{ key: '', value: '' }] as HeaderRow[],
  codeProvider: 'wandbox', codeLanguage: 'python', codeTemplate: 'import sys\ndata = sys.stdin.read()\nprint(data)', pistonUrl: '',
})

type FormState = ReturnType<typeof emptyForm>

function toolToForm(t: Tool): FormState {
  const s = t.input_schema ?? {}
  const headerRows: HeaderRow[] = Object.entries(t.headers ?? {}).map(([key, value]) => ({ key, value }))
  headerRows.push({ key: '', value: '' })
  return {
    name: t.name, description: t.description ?? '', type: t.type ?? 'http',
    method: t.method ?? 'POST', endpoint: t.endpoint ?? '',
    bodyTemplate: (s.body_template as string) ?? '',
    responsePath: (s.response_path as string) ?? '',
    timeout: String(t.timeout ?? 10000),
    provider: (s.provider as string) ?? 'duckduckgo',
    apiKey: (s.api_key as string) ?? '',
    maxResults: String((s.max_results as number) ?? 5),
    headers: headerRows.length ? headerRows : [{ key: '', value: '' }],
    codeProvider: (s.provider as string) ?? 'piston',
    codeLanguage: (s.language as string) ?? 'python',
    codeTemplate: (s.code_template as string) ?? 'import sys\ndata = sys.stdin.read()\nprint(data)',
    pistonUrl: (s.piston_url as string) ?? '',
  }
}

function formToPayload(f: FormState) {
  const headers: Record<string, string> = {}
  for (const { key, value } of f.headers) if (key.trim()) headers[key.trim()] = value
  return {
    name: f.name.trim(), description: f.description.trim(), type: f.type,
    method: f.type === 'http' ? f.method : 'GET',
    endpoint: f.type === 'http' ? f.endpoint.trim() : '',
    headers: f.type === 'http' ? headers : {},
    timeout: parseInt(f.timeout) || 10000,
    inputSchema: f.type === 'http'
      ? { body_template: f.bodyTemplate.trim(), response_path: f.responsePath.trim() }
      : f.type === 'web_search'
        ? { provider: f.provider, api_key: f.apiKey.trim(), max_results: parseInt(f.maxResults) || 5 }
        : f.type === 'code_exec'
          ? { provider: f.codeProvider, language: f.codeLanguage, api_key: f.apiKey.trim(), code_template: f.codeTemplate, piston_url: f.pistonUrl.trim() }
          : { api_key: f.apiKey.trim() },
  }
}

export default function ToolsTab() {
  const { items: tools, loading, saving, create, update, remove } = useRegistry<Tool>('/api/tools')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))

  const setHeader = (i: number, field: 'key' | 'value', val: string) => {
    setForm(f => {
      const rows = [...f.headers]
      rows[i] = { ...rows[i], [field]: val }
      if (i === rows.length - 1 && (rows[i].key || rows[i].value)) rows.push({ key: '', value: '' })
      return { ...f, headers: rows }
    })
  }
  const removeHeader = (i: number) => setForm(f => ({ ...f, headers: f.headers.filter((_, idx) => idx !== i) }))

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setError(''); setShowForm(true) }
  const openEdit = (tool: Tool) => { setEditingId(tool.id); setForm(toolToForm(tool)); setError(''); setShowForm(true) }
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm()); setError('') }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (form.type === 'http' && !form.endpoint.trim()) { setError('Endpoint URL is required'); return }
    if (form.type === 'web_search' && form.provider !== 'duckduckgo' && !form.apiKey.trim()) { setError('API key required for ' + form.provider); return }
    setError('')
    try {
      const payload = formToPayload(form)
      if (editingId) { await update(editingId, payload as never); }
      else { await create(payload as never) }
      closeForm()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
  }

  const typeIcon = (t: string) =>
    t === 'web_search' ? <Search size={11} color="var(--blue)" /> :
    t === 'web_scrape' ? <Globe size={11} color="var(--blue)" /> :
    t === 'code_exec'  ? <Code size={11} color="var(--purple)" /> :
    <Wrench size={11} color="var(--green)" />

  const typeMeta = (tool: Tool) => {
    const s = tool.input_schema ?? {}
    if (tool.type === 'web_search') return `${String(s.provider ?? 'duckduckgo')} search`
    if (tool.type === 'web_scrape') return 'jina.ai scraper'
    if (tool.type === 'code_exec') return `${String(s.provider ?? 'piston')} · ${String(s.language ?? 'python')}`
    return `${tool.method ?? 'POST'} ${(tool.endpoint ?? '').slice(0, 28)}${(tool.endpoint ?? '').length > 28 ? '…' : ''}`
  }

  const taStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 11, outline: 'none', resize: 'vertical', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'monospace', lineHeight: 1.5 }

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Tools Registry</p>
          <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 6, background: 'var(--blue)', color: '#080810', border: 'none', cursor: 'pointer' }}>
            <Plus size={11} /> New
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>HTTP, web search, or scraping tools for your agent nodes</p>
      </div>

      {showForm && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border2)', background: 'var(--surface2)', overflowY: 'auto', maxHeight: '70vh' }}>
          <FormHeading editing={!!editingId} noun="Tool" />

          <Field label="Name">
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="my_search_tool" />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              placeholder="What does this tool do?"
              style={{ width: '100%', padding: '7px 12px', borderRadius: 7, fontSize: 12, outline: 'none', resize: 'none', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </Field>

          {/* Tool type */}
          <Field label="Type">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[{ v: 'http', label: 'HTTP' }, { v: 'web_search', label: 'Search' }, { v: 'web_scrape', label: 'Scrape' }, { v: 'code_exec', label: 'Code' }].map(({ v, label }) => (
                <button key={v} onClick={() => set('type', v)} style={{ flex: 1, minWidth: 48, padding: '6px 4px', borderRadius: 6, border: `1px solid ${form.type === v ? 'var(--blue)' : 'var(--border)'}`, background: form.type === v ? 'rgba(124,111,240,0.1)' : 'var(--bg)', color: form.type === v ? 'var(--blue)' : 'var(--text3)', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {/* HTTP */}
          {form.type === 'http' && (<>
            <Field label="Method">
              <select value={form.method} onChange={e => set('method', e.target.value)}>
                {HTTP_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Endpoint URL">
              <input value={form.endpoint} onChange={e => set('endpoint', e.target.value)} placeholder="https://api.example.com/search?q={{last_output}}" />
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>
                Use <code style={{ background: 'var(--bg)', padding: '0 2px', borderRadius: 2 }}>{'{{last_output}}'}</code> · <code style={{ background: 'var(--bg)', padding: '0 2px', borderRadius: 2 }}>{'{{input}}'}</code> · <code style={{ background: 'var(--bg)', padding: '0 2px', borderRadius: 2 }}>{'{{node.ID}}'}</code>
              </div>
            </Field>

            <Field label="Headers">
              {form.headers.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 5 }}>
                  <input value={row.key} onChange={e => setHeader(i, 'key', e.target.value)} placeholder="Key" style={{ flex: 1, height: 30, padding: '0 8px', borderRadius: 6, fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
                  <input value={row.value} onChange={e => setHeader(i, 'value', e.target.value)} placeholder="Value" style={{ flex: 2, height: 30, padding: '0 8px', borderRadius: 6, fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
                  {form.headers.length > 1 && (
                    <button onClick={() => removeHeader(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>×</button>
                  )}
                </div>
              ))}
            </Field>

            {!['GET', 'DELETE', 'HEAD'].includes(form.method) && (
              <Field label="Request Body Template (JSON)">
                <textarea value={form.bodyTemplate} onChange={e => set('bodyTemplate', e.target.value)} rows={4}
                  placeholder={'{\n  "query": "{{last_output}}",\n  "limit": 5\n}'} style={taStyle} />
                <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>Leave empty → auto-sends {'{"input":"{{last_output}}"}'}</div>
              </Field>
            )}

            <Field label="Response Path (optional)">
              <input value={form.responsePath} onChange={e => set('responsePath', e.target.value)} placeholder="results.0.text" />
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>Dot notation to extract a field from JSON response</div>
            </Field>

            <Field label="Timeout (ms)">
              <input value={form.timeout} onChange={e => set('timeout', e.target.value)} type="number" />
            </Field>
          </>)}

          {/* Web Search */}
          {form.type === 'web_search' && (<>
            <Field label="Provider">
              <select value={form.provider} onChange={e => set('provider', e.target.value)}>
                {SEARCH_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            {form.provider !== 'duckduckgo' && (
              <Field label="API Key">
                <input type="password" value={form.apiKey} onChange={e => set('apiKey', e.target.value)} placeholder={form.provider === 'tavily' ? 'tvly-...' : 'your-serper-key'} />
              </Field>
            )}
            <Field label="Max Results">
              <input value={form.maxResults} onChange={e => set('maxResults', e.target.value)} type="number" min="1" max="20" style={{ width: 80 }} />
            </Field>
            <div style={{ fontSize: 10, color: 'var(--text3)', padding: '6px 8px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border2)', marginBottom: 10, lineHeight: 1.5 }}>
              Uses the previous node&apos;s output as the search query automatically.
            </div>
          </>)}

          {/* Web Scrape */}
          {form.type === 'web_scrape' && (<>
            <Field label="Jina API Key (optional — higher rate limit)">
              <input type="password" value={form.apiKey} onChange={e => set('apiKey', e.target.value)} placeholder="jina_..." />
            </Field>
            <div style={{ fontSize: 10, color: 'var(--text3)', padding: '6px 8px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border2)', marginBottom: 10, lineHeight: 1.5 }}>
              Uses the previous node&apos;s output as the URL to scrape via jina.ai/reader.
            </div>
          </>)}

          {/* Code Execution */}
          {form.type === 'code_exec' && (<>
            <Field label="Provider">
              <select value={form.codeProvider} onChange={e => set('codeProvider', e.target.value)}>
                {CODE_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            {form.codeProvider === 'piston' && (
              <Field label="Piston Base URL">
                <input value={form.pistonUrl} onChange={e => set('pistonUrl', e.target.value)} placeholder="http://localhost:2000" />
                <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>
                  Public API is whitelist-only since Feb 2026. Self-host with Docker or get whitelisted at emkc.org.
                </div>
              </Field>
            )}
            {form.codeProvider === 'e2b' && (
              <Field label="E2B API Key">
                <input type="password" value={form.apiKey} onChange={e => set('apiKey', e.target.value)} placeholder="e2b_..." />
              </Field>
            )}
            <Field label="Language">
              <select value={form.codeLanguage} onChange={e => set('codeLanguage', e.target.value)}>
                {CODE_LANGUAGES.map(l => <option key={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Code Template">
              <textarea value={form.codeTemplate} onChange={e => set('codeTemplate', e.target.value)} rows={6}
                style={taStyle}
                placeholder={'import sys\ndata = sys.stdin.read()\n# process data\nprint(data.upper())'} />
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>
                Previous node output is passed as <code style={{ background: 'var(--bg)', padding: '0 2px', borderRadius: 2 }}>stdin</code>.
                Use <code style={{ background: 'var(--bg)', padding: '0 2px', borderRadius: 2 }}>{'{{last_output}}'}</code> anywhere in code too.
              </div>
            </Field>
          </>)}

          {error && <p style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{error}</p>}
          <FormButtons saving={saving} onSave={handleSave} onCancel={closeForm} saveLabel={editingId ? 'Update Tool' : 'Save Tool'} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-[10px]" style={{ color: 'var(--text3)' }}>Loading...</div>
        ) : tools.length === 0 ? (
          <div className="p-6 text-center">
            <Wrench size={24} className="mx-auto mb-2" style={{ color: 'var(--text3)' }} />
            <p className="text-[10px]" style={{ color: 'var(--text3)' }}>No tools yet. Click New to add one.</p>
          </div>
        ) : tools.map(tool => (
          <div key={tool.id}
            className="flex items-start gap-3 cursor-pointer"
            style={{ padding: '11px 16px', borderBottom: '1px solid var(--border2)', background: editingId === tool.id ? 'var(--surface2)' : undefined }}
            onClick={() => editingId === tool.id ? closeForm() : openEdit(tool)}>
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(34,215,154,0.1)' }}>
              {typeIcon(tool.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{tool.name}</div>
              <div className="text-[10px] font-mono truncate" style={{ color: 'var(--text3)' }}>{typeMeta(tool)}</div>
              {tool.description && <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text3)' }}>{tool.description}</div>}
            </div>
            <button onClick={e => { e.stopPropagation(); setDeleteId(tool.id) }} className="p-1 rounded flex-shrink-0" style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId) }}
        title="Delete Tool" message="Remove this tool? Agents that reference it may break." danger
      />
    </div>
  )
}
