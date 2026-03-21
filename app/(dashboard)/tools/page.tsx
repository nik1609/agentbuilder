'use client'
import { useState } from 'react'
import { Plus, Trash2, Wrench, Globe, Search, Sparkles, CheckCircle, Loader2, ExternalLink, ChevronDown, X, Info } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'

interface Tool {
  id: string; name: string; description: string; type: string
  endpoint?: string; method: string; headers: Record<string, string>
  input_schema: Record<string, unknown>; timeout: number; created_at: string
}

const TOOL_TYPES = [
  { value: 'http',       label: 'HTTP Request',  desc: 'Call any REST API endpoint' },
  { value: 'web_search', label: 'Web Search',     desc: 'Built-in search (DuckDuckGo / Tavily / Serper)' },
  { value: 'web_scrape', label: 'Web Scrape',     desc: 'Extract text from any URL via Jina Reader' },
]

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
  const { items: tools, loading, saving, create, remove } = useRegistry<Tool>('/api/tools')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('http')
  const [httpForm, setHttpForm] = useState(emptyHttp())
  const [searchForm, setSearchForm] = useState(emptySearch())
  const [scrapeForm, setScrapeForm] = useState(emptyScrape())
  const [error, setError] = useState('')

  // Quick-add state for built-in templates
  const [adding, setAdding] = useState<Record<string, boolean>>({})
  const [justAdded, setJustAdded] = useState<Record<string, boolean>>({})

  const resetForm = () => {
    setHttpForm(emptyHttp()); setSearchForm(emptySearch()); setScrapeForm(emptyScrape())
    setError(''); setShowForm(false)
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
    } else {
      if (!scrapeForm.name.trim()) { setError('Name is required'); return }
      payload = {
        name: scrapeForm.name.trim(), description: scrapeForm.description.trim(),
        type: 'web_scrape', method: 'GET', endpoint: '', headers: {}, timeout: 15000,
        inputSchema: { api_key: scrapeForm.api_key.trim() },
      }
    }

    await create(payload)
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
      // Auto-add new empty row at end if last row has content
      if (i === rows.length - 1 && (rows[i].key || rows[i].value)) rows.push({ key: '', value: '' })
      return { ...f, headers: rows }
    })
  }
  const removeHeader = (i: number) => setHttpForm(f => ({ ...f, headers: f.headers.filter((_, idx) => idx !== i) }))

  const typeIcon = (t: string) => t === 'web_search' ? <Search size={13} color="var(--blue)" /> : t === 'web_scrape' ? <Globe size={13} color="var(--blue)" /> : <Wrench size={13} color="var(--text3)" />

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Tools</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Add tool nodes to your agents. Inputs from the previous node are passed automatically using template variables.</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> {showForm ? 'Cancel' : 'Add Tool'}
        </button>
      </div>

      {/* Add tool form */}
      {showForm && (
        <div style={{ padding: 22, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>New Tool</span>
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
              <input value={formType === 'http' ? httpForm.name : formType === 'web_search' ? searchForm.name : scrapeForm.name}
                onChange={e => formType === 'http' ? setHttpForm(f => ({ ...f, name: e.target.value })) : formType === 'web_search' ? setSearchForm(f => ({ ...f, name: e.target.value })) : setScrapeForm(f => ({ ...f, name: e.target.value }))}
                style={inputStyle} placeholder="My Tool" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <input value={formType === 'http' ? httpForm.description : formType === 'web_search' ? searchForm.description : scrapeForm.description}
                onChange={e => formType === 'http' ? setHttpForm(f => ({ ...f, description: e.target.value })) : formType === 'web_search' ? setSearchForm(f => ({ ...f, description: e.target.value })) : setScrapeForm(f => ({ ...f, description: e.target.value }))}
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

          {error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 12 }}>{error}</div>}

          <button onClick={saveForm} disabled={saving} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />} Save Tool
          </button>
        </div>
      )}

      {/* Quick-add templates */}
      {!showForm && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Quick Add</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { key: 'search_duckduckgo', label: 'DuckDuckGo Search', icon: Search, badge: 'Free · No key', color: '#22d79a', fn: () => quickAddSearch('duckduckgo') },
              { key: 'search_tavily',     label: 'Tavily Search',     icon: Sparkles, badge: 'Free tier', color: '#7c6ff0', fn: () => quickAddSearch('tavily') },
              { key: 'search_serper',     label: 'Serper Search',     icon: Search, badge: 'Free tier', color: '#f5a020', fn: () => quickAddSearch('serper') },
              { key: 'scrape_jina',       label: 'Jina Web Scraper',  icon: Globe,  badge: 'Free · No key', color: '#22d79a', fn: async () => {
                if (adding['scrape_jina']) return
                setAdding(a => ({ ...a, scrape_jina: true }))
                await create({ name: 'Jina Web Scraper', description: 'Scrape any URL and get clean text', type: 'web_scrape', method: 'GET', endpoint: '', headers: {}, timeout: 15000, inputSchema: { api_key: '' } })
                setAdding(a => ({ ...a, scrape_jina: false }))
                setJustAdded(a => ({ ...a, scrape_jina: true }))
                setTimeout(() => setJustAdded(a => ({ ...a, scrape_jina: false })), 3000)
              }},
            ].map(({ key, label, icon: Icon, badge, color, fn }) => {
              const done = justAdded[key]
              return (
                <button key={key} onClick={fn} disabled={adding[key] || done} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 9,
                  border: `1px solid ${done ? color + '40' : 'var(--border)'}`,
                  background: done ? `${color}0d` : 'var(--surface)', cursor: done ? 'default' : 'pointer',
                }}>
                  <Icon size={14} color={color} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${color}18`, color, fontWeight: 700 }}>{badge}</span>
                  {(adding[key]) && <Loader2 size={12} color="var(--text3)" style={{ animation: 'spin 1s linear infinite' }} />}
                  {done && <CheckCircle size={12} color={color} />}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
            Quick-add creates tools with default settings. For Tavily/Serper you&apos;ll need to add your API key — delete and re-add using the form above, or update the key in Supabase.
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
              return (
                <div key={tool.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {typeIcon(tool.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{tool.name}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--surface2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text3)' }}>{tool.type}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tool.description || meta}
                    </div>
                  </div>
                  <button onClick={() => setDeleteId(tool.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteId}
        title="Delete tool?"
        description="Agents using this tool will stop working until you reassign them."
        onConfirm={() => { if (deleteId) { remove(deleteId); setDeleteId(null) } }}
        onCancel={() => setDeleteId(null)}
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
