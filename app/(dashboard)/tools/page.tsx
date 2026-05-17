'use client'
import { useState } from 'react'
import { Plus, Trash2, Wrench, Globe, Search, Sparkles, CheckCircle, Loader2, ExternalLink, ChevronDown, X, Info, Pencil, Code, BookOpen, Calculator, Newspaper, Cloud, Rss, Database, Zap, ArrowLeft, AlertCircle, Check } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'
import SectionLayout from '@/components/ui/SectionLayout'
import { Bot, Brain, Table2, KeyRound, FileText, Shield } from 'lucide-react'

const AGENTS_NAV = [
  { href: '/agents',     label: 'Agents',     icon: Bot,      match: (p: string) => p === '/agents' || p.startsWith('/agents/') || p.startsWith('/builder/') },
  { href: '/models',     label: 'Models',     icon: Brain,    match: (p: string) => p.startsWith('/models') },
  { href: '/tools',      label: 'Tools',      icon: Wrench,   match: (p: string) => p.startsWith('/tools') },
  { href: '/prompts',    label: 'Prompts',    icon: FileText, match: (p: string) => p.startsWith('/prompts') },
  { href: '/memory',     label: 'Memory',     icon: Database, match: (p: string) => p.startsWith('/memory') },
  { href: '/guardrails', label: 'Guardrails', icon: Shield,   match: (p: string) => p.startsWith('/guardrails') },
  { href: '/datatables', label: 'Datatables', icon: Table2,   match: (p: string) => p.startsWith('/datatables') },
  { href: '/api-keys',   label: 'API Keys',   icon: KeyRound, match: (p: string) => p.startsWith('/api-keys') },
]

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
  { value: 'wandbox', label: 'Wandbox', note: 'Free, no key. Python/JS/Bash/Go/Rust…' },
  { value: 'piston',  label: 'Piston',  note: 'Self-hosted only. Public API closed Feb 2026' },
  { value: 'e2b',     label: 'E2B',     note: 'Full sandbox, installs packages' },
]
const CODE_LANGUAGES = ['python', 'javascript', 'typescript', 'bash', 'ruby', 'go', 'rust']

const SEARCH_PROVIDERS = [
  { value: 'duckduckgo', label: 'DuckDuckGo',    free: true,  note: 'Instant Answers, free, no key needed' },
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
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6, padding: '7px 9px', borderRadius: 6, background: 'var(--accent-light)', border: '1px solid var(--accent-border)' }}>
      <Info size={11} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.5 }}>
        Use <code style={{ background: 'var(--surface2)', padding: '0 3px', borderRadius: 3 }}>{'{{last_output}}'}</code> for prev node output, <code style={{ background: 'var(--surface2)', padding: '0 3px', borderRadius: 3 }}>{'{{input}}'}</code> for original pipeline input, <code style={{ background: 'var(--surface2)', padding: '0 3px', borderRadius: 3 }}>{'{{node.NODE_ID}}'}</code> for any upstream node.
      </span>
    </div>
  )
}

// Type-specific icon + color
function typeIconEl(t: string, size = 13) {
  if (t === 'web_search') return <Search size={size} color="#2563EB" />
  if (t === 'web_scrape') return <Globe size={size} color="#0891B2" />
  if (t === 'code_exec')  return <Code size={size} color="#7C3AED" />
  if (t === 'datatable')  return <Database size={size} color="#9333EA" />
  if (t === 'function')   return <Zap size={size} color="#D97706" />
  return <Wrench size={size} color="#6B7280" />
}
function typeBgColor(t: string): string {
  if (t === 'web_search') return 'rgba(37,99,235,0.10)'
  if (t === 'web_scrape') return 'rgba(8,145,178,0.10)'
  if (t === 'code_exec')  return 'rgba(124,58,237,0.10)'
  if (t === 'datatable')  return 'rgba(147,51,234,0.10)'
  if (t === 'function')   return 'rgba(217,119,6,0.10)'
  return 'rgba(107,114,128,0.10)'
}

// ── Template definitions ──────────────────────────────────────────────────────
type TemplateItem = {
  key: string; label: string; icon: React.ElementType; color: string
  desc: string; badge: string; needsKey: boolean
  instant?: Record<string, unknown>          // add immediately, no form
  preset?: { type: string; form: Record<string, unknown> }  // open configure pre-filled
}

const TEMPLATE_GROUPS: { group: string; items: TemplateItem[] }[] = [
  {
    group: 'Web Search',
    items: [
      { key: 'duckduckgo', label: 'DuckDuckGo', icon: Search,   color: '#2563EB', desc: 'Instant Answers. Free, no key needed.', badge: 'Free · No key', needsKey: false,
        instant: { name:'DuckDuckGo Search', description:'Search the web via DuckDuckGo', type:'web_search', method:'GET', endpoint:'', headers:{}, timeout:10000, inputSchema:{ provider:'duckduckgo', api_key:'', max_results:5 } } },
      { key: 'tavily', label: 'Tavily', icon: Sparkles, color: '#7C3AED', desc: '1000 searches/month free. Best for AI agents.', badge: 'Needs API key', needsKey: true,
        preset: { type:'web_search', form:{ name:'Tavily Search', description:'AI-optimized web search', provider:'tavily', api_key:'', max_results:'5' } } },
      { key: 'serper', label: 'Serper', icon: Search, color: '#D97706', desc: '2500 queries/month free. Real Google results.', badge: 'Needs API key', needsKey: true,
        preset: { type:'web_search', form:{ name:'Serper Search', description:'Google search via Serper API', provider:'serper', api_key:'', max_results:'5' } } },
    ],
  },
  {
    group: 'Data & Knowledge',
    items: [
      { key: 'wiki',    label: 'Wikipedia',    icon: BookOpen,   color: '#3B82F6', desc: 'Get Wikipedia summary for any topic.',         badge: 'Free · No key', needsKey: false,
        instant: { name:'Wikipedia Summary', description:'Get Wikipedia summary for a topic', type:'http', method:'GET', endpoint:'https://en.wikipedia.org/api/rest_v1/page/summary/{{last_output}}', headers:{}, timeout:8000, inputSchema:{ response_path:'extract' } } },
      { key: 'hn',      label: 'Hacker News',  icon: Newspaper,  color: '#F97316', desc: 'Search HN stories and comments via Algolia.',  badge: 'Free · No key', needsKey: false,
        instant: { name:'Hacker News Search', description:'Search HN stories via Algolia', type:'http', method:'GET', endpoint:'https://hn.algolia.com/api/v1/search?query={{last_output}}&hitsPerPage=5', headers:{}, timeout:8000, inputSchema:{ response_path:'hits' } } },
      { key: 'calc',    label: 'Calculator',   icon: Calculator, color: '#10B981', desc: 'Evaluate math expressions via mathjs.',         badge: 'Free · No key', needsKey: false,
        instant: { name:'Math Calculator', description:'Evaluate math expressions', type:'http', method:'GET', endpoint:'https://api.mathjs.org/v4/?expr={{last_output}}', headers:{}, timeout:5000, inputSchema:{ response_path:'' } } },
      { key: 'weather', label: 'Weather',      icon: Cloud,      color: '#38BDF8', desc: 'Current weather for any city (wttr.in).',      badge: 'Free · No key', needsKey: false,
        instant: { name:'Weather', description:'Get current weather for a city', type:'http', method:'GET', endpoint:'https://wttr.in/{{last_output}}?format=3', headers:{'Accept':'text/plain'}, timeout:8000, inputSchema:{ response_path:'' } } },
      { key: 'rss',     label: 'RSS News',     icon: Rss,        color: '#F97316', desc: 'Search Google News RSS by keyword.',           badge: 'Free · No key', needsKey: false,
        instant: { name:'RSS News Search', description:'Search Google News RSS', type:'http', method:'GET', endpoint:'https://news.google.com/rss/search?q={{last_output}}&hl=en', headers:{}, timeout:8000, inputSchema:{ response_path:'' } } },
    ],
  },
  {
    group: 'Scrape & Execute',
    items: [
      { key: 'jina',   label: 'Web Scraper',      icon: Globe, color: '#0891B2', desc: 'Scrape any URL and get clean markdown text.',  badge: 'Free · No key', needsKey: false,
        instant: { name:'Jina Web Scraper', description:'Scrape any URL and get clean text', type:'web_scrape', method:'GET', endpoint:'', headers:{}, timeout:15000, inputSchema:{ api_key:'' } } },
      { key: 'python', label: 'Python Executor',  icon: Code,  color: '#7C3AED', desc: 'Run Python code on previous node output.',     badge: 'Free · No key', needsKey: false,
        instant: { name:'Python Executor', description:'Run Python code on previous node output', type:'code_exec', method:'POST', endpoint:'', headers:{}, timeout:30000, inputSchema:{ provider:'wandbox', language:'python', api_key:'', piston_url:'', code_template:'import sys\ndata = sys.stdin.read()\n# process data\nprint(data)' } } },
    ],
  },
]

const CUSTOM_TYPES = [
  { value: 'http',       label: 'HTTP Request',   icon: Wrench,   color: '#6B7280', desc: 'Call any REST API endpoint' },
  { value: 'web_search', label: 'Web Search',      icon: Search,   color: '#2563EB', desc: 'DuckDuckGo / Tavily / Serper' },
  { value: 'web_scrape', label: 'Web Scrape',      icon: Globe,    color: '#0891B2', desc: 'Extract text from any URL' },
  { value: 'code_exec',  label: 'Code Execution',  icon: Code,     color: '#7C3AED', desc: 'Python / JS / Bash sandbox' },
  { value: 'datatable',  label: 'Datatable',       icon: Database, color: '#9333EA', desc: 'Import rows or export LLM output' },
]

// ── Tool form modal ───────────────────────────────────────────────────────────
interface ToolModalProps {
  editingId: string | null
  formType: string
  setFormType: (t: string) => void
  httpForm: ReturnType<typeof emptyHttp>
  setHttpForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyHttp>>>
  searchForm: ReturnType<typeof emptySearch>
  setSearchForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptySearch>>>
  scrapeForm: ReturnType<typeof emptyScrape>
  setScrapeForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyScrape>>>
  codeForm: ReturnType<typeof emptyCode>
  setCodeForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyCode>>>
  dtForm: ReturnType<typeof emptyDatatable>
  setDtForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyDatatable>>>
  datatables: Datatable[]
  error: string
  saving: boolean
  onSave: () => void
  onInstantAdd: (payload: Record<string, unknown>) => void
  onClose: () => void
}

function ToolModal({
  editingId, formType, setFormType,
  httpForm, setHttpForm,
  searchForm, setSearchForm,
  scrapeForm, setScrapeForm,
  codeForm, setCodeForm,
  dtForm, setDtForm,
  datatables, error, saving, onSave, onInstantAdd, onClose,
}: ToolModalProps) {

  // Start at 'pick' for new tools, 'configure' when editing
  const [step, setStep] = useState<'pick' | 'configure'>(editingId ? 'configure' : 'pick')
  const [adding, setAdding] = useState<string | null>(null)
  const [addError, setAddError] = useState('')

  const setHeader = (i: number, field: 'key' | 'value', val: string) => {
    setHttpForm(f => {
      const rows = [...f.headers]
      rows[i] = { ...rows[i], [field]: val }
      if (i === rows.length - 1 && (rows[i].key || rows[i].value)) rows.push({ key: '', value: '' })
      return { ...f, headers: rows }
    })
  }
  const removeHeader = (i: number) => setHttpForm(f => ({ ...f, headers: f.headers.filter((_, idx) => idx !== i) }))

  const handleTemplateClick = async (t: TemplateItem) => {
    if (t.instant) {
      setAdding(t.key)
      setAddError('')
      try {
        await onInstantAdd(t.instant)
      } catch (e) {
        setAddError(e instanceof Error ? e.message : 'Failed to add tool. Check your connection.')
      } finally {
        setAdding(null)
      }
      return
    }
    if (t.preset) {
      setFormType(t.preset.type)
      const pf = t.preset.form as Record<string, unknown>
      if (t.preset.type === 'web_search') {
        setSearchForm({ name: pf.name as string, description: pf.description as string, provider: pf.provider as string, api_key: pf.api_key as string, max_results: pf.max_results as string })
      }
      setStep('configure')
    }
  }

  const handleCustomType = (type: string) => {
    setFormType(type)
    setStep('configure')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 680,
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 16, boxShadow: 'var(--shadow-xl)',
        maxHeight: 'calc(100vh - 48px)', overflow: 'auto',
      }}>
        {/* Sticky header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1,
        }}>
          {step === 'configure' && !editingId && (
            <button onClick={() => setStep('pick')} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', flexShrink: 0 }}>
              <ArrowLeft size={13} />
            </button>
          )}
          {step === 'pick' && (
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(107,114,128,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Wrench size={14} color="#6B7280" />
            </div>
          )}
          {step === 'configure' && (() => {
            const ct = CUSTOM_TYPES.find(t => t.value === formType)
            const Icon = ct?.icon ?? Wrench
            const color = ct?.color ?? '#6B7280'
            return (
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={14} color={color} />
              </div>
            )
          })()}
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
            {editingId ? 'Edit Tool' : step === 'pick' ? 'Add Tool' : `Configure · ${CUSTOM_TYPES.find(t => t.value === formType)?.label ?? formType}`}
          </span>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
            <X size={13} />
          </button>
        </div>

        {/* ── STEP 1: Template picker ── */}
        {step === 'pick' && (
          <div style={{ padding: '18px 20px' }}>
            {addError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', borderRadius: 8, background: 'var(--error-bg)', border: '1px solid var(--error-border)', color: 'var(--error)', fontSize: 12, marginBottom: 14 }}>
                <AlertCircle size={13} />
                <span>{addError}</span>
                <button onClick={() => setAddError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', display: 'flex' }}><X size={12} /></button>
              </div>
            )}
            {TEMPLATE_GROUPS.map(({ group, items }) => (
              <div key={group} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{group}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {items.map(t => {
                    const Icon = t.icon
                    const isAdding = adding === t.key
                    return (
                      <button key={t.key} onClick={() => handleTemplateClick(t)} disabled={isAdding} style={{
                        display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px',
                        borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card-bg)',
                        cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s',
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = t.color; (e.currentTarget as HTMLElement).style.background = `${t.color}08` }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--card-bg)' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: `${t.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isAdding ? <Loader2 size={13} color={t.color} style={{ animation: 'spin 1s linear infinite' }} /> : <Icon size={13} color={t.color} />}
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: t.needsKey ? 'var(--warning-bg)' : 'var(--success-bg)', color: t.needsKey ? 'var(--warning)' : 'var(--success)', border: `1px solid ${t.needsKey ? 'var(--warning-border)' : 'var(--success-border)'}` }}>
                            {t.needsKey ? 'Needs key' : 'Free'}
                          </span>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{t.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.45 }}>{t.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Custom tool types */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Build from scratch</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {CUSTOM_TYPES.map(t => {
                  const Icon = t.icon
                  return (
                    <button key={t.value} onClick={() => handleCustomType(t.value)} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px',
                      borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card-bg)',
                      cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s, background 0.15s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = t.color; (e.currentTarget as HTMLElement).style.background = `${t.color}08` }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--card-bg)' }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${t.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={13} color={t.color} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{t.label}</div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', lineHeight: 1.3 }}>{t.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Configure form ── */}
        {step === 'configure' && (
        <div style={{ padding: '20px 22px' }}>
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
                  {SEARCH_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label} · {p.note}</option>)}
                </select>
                <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            </div>
            {searchForm.provider !== 'duckduckgo' && (
              <div style={{ marginBottom: 14 }}>
                <Label>API Key {SEARCH_PROVIDERS.find(p => p.value === searchForm.provider)?.link && (
                  <a href={SEARCH_PROVIDERS.find(p => p.value === searchForm.provider)?.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 400, marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Get free key <ExternalLink size={9} /></a>
                )}</Label>
                <input type="password" value={searchForm.api_key} onChange={e => setSearchForm(f => ({ ...f, api_key: e.target.value }))} style={inputStyle} placeholder={searchForm.provider === 'tavily' ? 'tvly-...' : 'your-serper-key'} />
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
              <Label>Jina API Key (optional, higher rate limit)</Label>
              <input type="password" value={scrapeForm.api_key} onChange={e => setScrapeForm(f => ({ ...f, api_key: e.target.value }))} style={inputStyle} placeholder="jina_..." />
              <a href="https://jina.ai/reader" target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--accent)', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
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
                  {CODE_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label} · {p.note}</option>)}
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
                <Label>E2B API Key <a href="https://e2b.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 400, marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Get key <ExternalLink size={9} /></a></Label>
                <input type="password" value={codeForm.api_key} onChange={e => setCodeForm(f => ({ ...f, api_key: e.target.value }))} style={inputStyle} placeholder="e2b_..." />
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
                  <option value="">Select a datatable</option>
                  {datatables.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
              {datatables.length === 0 && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>No datatables yet. Create one in the Datatables page first.</div>}
            </div>
            <div style={{ marginBottom: 14 }}>
              <Label>Mode</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['import', 'export'] as const).map(m => (
                  <button key={m} onClick={() => setDtForm(f => ({ ...f, mode: m }))} style={{
                    flex: 1, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    border: `1px solid ${dtForm.mode === m ? '#7C3AED' : 'var(--border)'}`,
                    background: dtForm.mode === m ? 'rgba(124,58,237,0.08)' : 'var(--surface2)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: dtForm.mode === m ? '#7C3AED' : 'var(--text)', marginBottom: 2 }}>
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
                      <span key={c.name} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: c.isPrimaryKey ? 'rgba(124,58,237,0.12)' : 'var(--card-bg)', border: `1px solid ${c.isPrimaryKey ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`, color: c.isPrimaryKey ? '#7C3AED' : 'var(--text2)' }}>
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

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--error-bg)', border: '1px solid var(--error-border)', color: 'var(--error)', fontSize: 12 }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={onSave} disabled={saving} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px', borderRadius: 8, border: 'none',
              background: 'var(--primary)', color: 'var(--primary-fg)',
              fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Tool'}
            </button>
            <button onClick={onClose} style={{
              padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--card-bg)', color: 'var(--text2)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        </div>
        )} {/* end configure step */}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ToolsPage() {
  const { items: tools, loading, saving, create, update, remove } = useRegistry<Tool>('/api/tools')
  const { items: datatables } = useRegistry<Datatable>('/api/datatables')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toolSearch, setToolSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
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

  const resetForm = () => {
    setHttpForm(emptyHttp()); setSearchForm(emptySearch()); setScrapeForm(emptyScrape()); setCodeForm(emptyCode()); setDtForm(emptyDatatable())
    setError(''); setShowModal(false); setEditingId(null)
  }

  const openAdd = () => {
    setHttpForm(emptyHttp()); setSearchForm(emptySearch()); setScrapeForm(emptyScrape()); setCodeForm(emptyCode()); setDtForm(emptyDatatable())
    setFormType('http'); setError(''); setEditingId(null); setShowModal(true)
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
    setError('')
    setShowModal(true)
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

  return (
    <SectionLayout nav={AGENTS_NAV}>
      {/* Tool form modal */}
      {showModal && (
        <ToolModal
          editingId={editingId}
          formType={formType} setFormType={setFormType}
          httpForm={httpForm} setHttpForm={setHttpForm}
          searchForm={searchForm} setSearchForm={setSearchForm}
          scrapeForm={scrapeForm} setScrapeForm={setScrapeForm}
          codeForm={codeForm} setCodeForm={setCodeForm}
          dtForm={dtForm} setDtForm={setDtForm}
          datatables={datatables}
          error={error} saving={saving}
          onSave={saveForm}
          onInstantAdd={async (payload) => { await create(payload); resetForm() }}
          onClose={resetForm}
        />
      )}

      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 36px 20px' }}>
        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 3 }}>Tools</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>Add tool nodes to your agents. Inputs from the previous node are passed automatically using template variables.</p>
          </div>
          <button onClick={openAdd} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: 'var(--primary)', color: 'var(--primary-fg)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus size={13} strokeWidth={2.5} /> Add Tool
          </button>
        </div>


        {/* Search */}
        <div style={{ flexShrink: 0, position: 'relative', marginBottom: 12 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input value={toolSearch} onChange={e => setToolSearch(e.target.value)} placeholder="Search tools…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Tools list — scrollable */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Table header — fixed, does not scroll */}
          {!loading && tools.length > 0 && (
            <div style={{ flexShrink: 0, padding: '7px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px 10px 0 0', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tool</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', width: 90, textAlign: 'center' }}>Actions</span>
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border2)', opacity: 1 - i * 0.15 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0, animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 11, width: `${30 + i * 10}%`, borderRadius: 4, background: 'var(--surface2)' }} />
                    <div style={{ height: 9, width: `${45 + i * 8}%`, borderRadius: 4, background: 'var(--surface2)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <div style={{ width: 46, height: 26, borderRadius: 6, background: 'var(--surface2)' }} />
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface2)' }} />
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface2)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : tools.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', borderRadius: 12, border: '1px dashed var(--border)', background: 'var(--card-bg)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Wrench size={18} color="var(--text3)" />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No tools yet</p>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>Click Add Tool to get started.</p>
            </div>
          ) : tools.filter(t => !toolSearch || t.name.toLowerCase().includes(toolSearch.toLowerCase()) || t.description?.toLowerCase().includes(toolSearch.toLowerCase()) || t.type.toLowerCase().includes(toolSearch.toLowerCase())).length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card-bg)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                <Search size={16} color="var(--text3)" />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>No tools match</p>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>Nothing found for &quot;{toolSearch}&quot;</p>
            </div>
          ) : (
            <>
            <div style={{ borderRadius: tools.length > 0 ? '0 0 12px 12px' : 12, background: 'var(--card-bg)', border: '1px solid var(--border)', borderTop: tools.length > 0 ? 'none' : '1px solid var(--border)', overflow: 'hidden' }}>
              {tools.filter(t =>
                !toolSearch ||
                t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
                t.description?.toLowerCase().includes(toolSearch.toLowerCase()) ||
                t.type.toLowerCase().includes(toolSearch.toLowerCase())
              ).map((tool, idx, arr) => {
                const schema = tool.input_schema ?? {}
                // Rich detail line per type
                const detail = (() => {
                  if (tool.type === 'web_search') {
                    const p = (schema as Record<string,unknown>).provider as string ?? 'duckduckgo'
                    return { text: p.charAt(0).toUpperCase() + p.slice(1), mono: true }
                  }
                  if (tool.type === 'web_scrape') return { text: 'jina.ai reader', mono: true }
                  if (tool.type === 'http') return { text: `${tool.method ?? 'POST'} ${tool.endpoint ?? ''}`, mono: true }
                  if (tool.type === 'code_exec') {
                    const lang = (schema as Record<string,unknown>).language as string ?? 'python'
                    const prov = (schema as Record<string,unknown>).provider as string ?? 'wandbox'
                    return { text: `${lang} · ${prov}`, mono: true }
                  }
                  if (tool.type === 'datatable') {
                    const mode = (schema as Record<string,unknown>).mode as string ?? 'export'
                    const name = (schema as Record<string,unknown>).datatable_name as string ?? ''
                    return { text: `${mode} · ${name || 'no table selected'}`, mono: false }
                  }
                  if (tool.type === 'function') return { text: 'JS function', mono: true }
                  return null
                })()
                // Colored type badge per type
                const typeColor = (() => {
                  const m: Record<string,string> = { web_search:'#2563EB', web_scrape:'#0891B2', code_exec:'#7C3AED', datatable:'#9333EA', function:'#D97706' }
                  return m[tool.type] ?? '#6B7280'
                })()
                const isTesting = testingId === tool.id
                const isLast = idx === arr.length - 1
                return (
                  <div key={tool.id}>
                    {/* Tool row */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
                      borderBottom: isLast && !isTesting ? 'none' : '1px solid var(--border2)',
                      background: isTesting ? 'var(--surface2)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => { if (!isTesting) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
                      onMouseLeave={e => { if (!isTesting) (e.currentTarget as HTMLElement).style.background = isTesting ? 'var(--surface2)' : 'transparent' }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: `${typeColor}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {typeIconEl(tool.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tool.name}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `${typeColor}18`, color: typeColor, flexShrink: 0 }}>
                            {tool.type.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tool.description || ''}
                          {tool.description && detail ? <span style={{ color: 'var(--border)' }}> · </span> : null}
                          {detail ? <span style={{ fontFamily: detail.mono ? 'monospace' : 'inherit', color: 'var(--text3)' }}>{detail.text}</span> : null}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button
                          onClick={() => { setTestingId(isTesting ? null : tool.id); setTestResult(null); setTestInput('') }}
                          style={{
                            height: 26, padding: '0 9px', borderRadius: 6,
                            border: `1px solid ${isTesting ? 'var(--accent)' : 'var(--border)'}`,
                            background: isTesting ? 'var(--accent-light)' : 'var(--surface2)',
                            color: isTesting ? 'var(--accent)' : 'var(--text3)',
                            cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          }}
                        >
                          Test
                        </button>
                        <button
                          onClick={() => openEdit(tool)}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={() => setDeleteId(tool.id)}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Test panel */}
                    {isTesting && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'var(--card-bg)', borderBottom: isLast ? 'none' : '1px solid var(--border2)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Test Input</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                          <input
                            value={testInput}
                            onChange={e => setTestInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && runTest(tool)}
                            placeholder={tool.type === 'web_search' ? 'e.g. latest AI news' : tool.type === 'web_scrape' ? 'e.g. https://example.com' : tool.type === 'code_exec' ? 'stdin input for your code' : 'value for {{last_output}}'}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <button onClick={() => runTest(tool)} disabled={testRunning} style={{ padding: '0 16px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {testRunning ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                            {testRunning ? 'Running…' : 'Run'}
                          </button>
                        </div>
                        {testResult && (
                          <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${testResult.ok ? 'rgba(34,215,154,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                            <div style={{ padding: '6px 10px', background: testResult.ok ? 'rgba(34,215,154,0.08)' : 'rgba(248,113,113,0.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {testResult.ok ? <CheckCircle size={11} color="var(--success)" /> : <X size={11} color="var(--error)" />}
                              <span style={{ fontSize: 10, fontWeight: 700, color: testResult.ok ? 'var(--success)' : 'var(--error)' }}>{testResult.ok ? 'Success' : 'Failed'}</span>
                              {testResult.status && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>HTTP {testResult.status}</span>}
                            </div>
                            <pre style={{ margin: 0, padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 240, overflowY: 'auto', background: 'var(--card-bg)' }}>
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
            </>
          )}
          </div>{/* end inner scroll */}
        </div>
      </div>

      <ConfirmModal
        open={!!deleteId}
        title="Delete tool?"
        message="Agents using this tool will stop working until you reassign them."
        danger
        onConfirm={() => { if (deleteId) remove(deleteId) }}
        onClose={() => setDeleteId(null)}
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes dash-shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>
    </SectionLayout>
  )
}
