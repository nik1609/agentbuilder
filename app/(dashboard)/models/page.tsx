'use client'
import { useState } from 'react'
import { Plus, Trash2, Brain, Pencil, Check, X, ChevronDown, Bot, Wrench, Table2, KeyRound, FileText, Database, Shield, AlertCircle, KeySquare, Thermometer, Hash, Search } from 'lucide-react'
import SectionLayout from '@/components/ui/SectionLayout'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'

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

interface ModelConfig {
  id: string; name: string; provider: string; model_id: string
  temperature: number; max_tokens: number
  has_api_key?: boolean; api_key_hint?: string; base_url?: string; created_at: string
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google (Gemini)',
  anthropic: 'Anthropic (Claude)',
  'openai-compatible': 'OpenAI / Compatible',
  ollama: 'Ollama (Local)',
}
const PROVIDER_COLORS: Record<string, { color: string; bg: string }> = {
  google:             { color: '#4285F4', bg: 'rgba(66,133,244,0.1)'  },
  anthropic:          { color: '#D97706', bg: 'rgba(217,119,6,0.1)'   },
  'openai-compatible':{ color: '#10A37F', bg: 'rgba(16,163,127,0.1)'  },
  ollama:             { color: '#7C3AED', bg: 'rgba(124,58,237,0.1)'  },
}
const PROVIDER_MODELS: Record<string, string[]> = {
  google: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  'openai-compatible': ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  ollama: ['gemma3:4b', 'gemma3:12b', 'llama3.2', 'llama3.1', 'mistral', 'codellama'],
}
const PROVIDER_META: Record<string, { apiKeyLabel: string; apiKeyPlaceholder: string; baseUrlDefault: string; note: string }> = {
  google:             { apiKeyLabel: 'Gemini API Key',      apiKeyPlaceholder: 'AIza... (leave blank to use env var)', baseUrlDefault: '', note: 'Leave blank to use GEMINI_API_KEY env var. Get a key from aistudio.google.com.' },
  anthropic:          { apiKeyLabel: 'Anthropic API Key',   apiKeyPlaceholder: 'sk-ant-...', baseUrlDefault: '', note: 'Get your key from console.anthropic.com. Leave blank to use ANTHROPIC_API_KEY env var.' },
  'openai-compatible':{ apiKeyLabel: 'API Key',             apiKeyPlaceholder: 'sk-...', baseUrlDefault: 'https://api.openai.com/v1', note: 'Works with OpenAI, Groq, Together AI, Mistral, or any OpenAI-compatible endpoint.' },
  ollama:             { apiKeyLabel: 'API Key',              apiKeyPlaceholder: 'ollama', baseUrlDefault: 'http://localhost:11434/v1', note: 'Ollama must be running locally. Any non-empty string works as the API key.' },
}
const OPENAI_PRESETS = [
  { label: 'OpenAI',      url: 'https://api.openai.com/v1' },
  { label: 'Groq',        url: 'https://api.groq.com/openai/v1' },
  { label: 'Together AI', url: 'https://api.together.xyz/v1' },
  { label: 'Mistral',     url: 'https://api.mistral.ai/v1' },
  { label: 'Ollama',      url: 'http://localhost:11434/v1' },
]

type FormState = { name: string; provider: string; modelId: string; temperature: string; maxTokens: string; apiKey: string; baseUrl: string }
const emptyForm = (): FormState => ({ name: '', provider: 'google', modelId: 'gemini-2.5-flash', temperature: '0.7', maxTokens: '4096', apiKey: '', baseUrl: '' })

const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 11px', borderRadius: 8, fontSize: 13, outline: 'none',
  background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
  fontFamily: 'inherit', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', cursor: 'pointer' }

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      {children}
      {hint && <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{hint}</p>}
    </div>
  )
}

// ── Model form modal ─────────────────────────────────────────────────────────
function ModelModal({ editingModel, onClose, onSave, saving, error }: {
  editingModel: ModelConfig | null
  onClose: () => void
  onSave: (form: FormState) => void
  saving: boolean
  error: string
}) {
  const [form, setForm] = useState<FormState>(() =>
    editingModel
      ? { name: editingModel.name, provider: editingModel.provider, modelId: editingModel.model_id, temperature: String(editingModel.temperature), maxTokens: String(editingModel.max_tokens), apiKey: '', baseUrl: editingModel.base_url ?? '' }
      : emptyForm()
  )
  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))
  const meta = PROVIDER_META[form.provider] ?? PROVIDER_META.google
  const pc   = PROVIDER_COLORS[form.provider] ?? PROVIDER_COLORS.google
  const isEditing = !!editingModel

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 520,
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 16, boxShadow: 'var(--shadow-xl)',
        maxHeight: 'calc(100vh - 48px)', overflow: 'auto',
      }}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: pc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={14} color={pc.color} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              {isEditing ? `Edit "${editingModel!.name}"` : 'Add Model Config'}
            </span>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ padding: '20px 22px' }}>
          {/* Name */}
          <Field label="Config Name" hint="This name appears in the model dropdown inside every LLM node.">
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Gemini Flash, GPT-4 Production"
              autoFocus style={inputStyle} />
          </Field>

          {/* Provider + Model ID side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Provider</div>
              <div style={{ position: 'relative' }}>
                <select value={form.provider} onChange={e => {
                  const p = e.target.value
                  set('provider', p)
                  set('modelId', PROVIDER_MODELS[p]?.[0] ?? '')
                  set('baseUrl', PROVIDER_META[p]?.baseUrlDefault ?? '')
                  set('apiKey', '')
                }} style={selectStyle}>
                  {Object.keys(PROVIDER_MODELS).map(p => <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>)}
                </select>
                <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Model ID</div>
              {(form.provider === 'ollama' || form.provider === 'openai-compatible') ? (
                <>
                  <input value={form.modelId} onChange={e => set('modelId', e.target.value)}
                    placeholder={form.provider === 'ollama' ? 'gemma3:4b' : 'llama-3.3-70b-versatile'}
                    list="modal-custom-models" style={inputStyle} />
                  <datalist id="modal-custom-models">
                    {PROVIDER_MODELS[form.provider].map(m => <option key={m} value={m} />)}
                  </datalist>
                </>
              ) : (
                <div style={{ position: 'relative' }}>
                  <select value={form.modelId} onChange={e => set('modelId', e.target.value)} style={selectStyle}>
                    {(PROVIDER_MODELS[form.provider] ?? []).map(m => <option key={m}>{m}</option>)}
                  </select>
                  <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                </div>
              )}
            </div>
          </div>

          {/* API Key */}
          <Field
            label={meta.apiKeyLabel}
            hint={
              isEditing && editingModel?.has_api_key
                ? 'Leave blank to keep the existing key.'
                : (form.provider === 'google' ? 'Leave blank to use the GEMINI_API_KEY environment variable.'
                  : form.provider === 'anthropic' ? 'Leave blank to use the ANTHROPIC_API_KEY environment variable.'
                  : undefined)
            }
          >
            <input value={form.apiKey} onChange={e => set('apiKey', e.target.value)}
              type={form.provider === 'ollama' ? 'text' : 'password'}
              placeholder={isEditing && editingModel?.has_api_key ? '••••••• (leave blank to keep existing)' : meta.apiKeyPlaceholder}
              style={inputStyle} />
          </Field>

          {/* Base URL — only for compatible/ollama */}
          {(form.provider === 'openai-compatible' || form.provider === 'ollama') && (
            <Field label="Base URL">
              {form.provider === 'openai-compatible' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
                  {OPENAI_PRESETS.map(p => (
                    <button key={p.label} type="button" onClick={() => set('baseUrl', p.url)} style={{
                      padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      border: '1px solid var(--border)',
                      background: form.baseUrl === p.url ? 'var(--primary)' : 'var(--surface2)',
                      color: form.baseUrl === p.url ? 'var(--primary-fg)' : 'var(--text3)',
                    }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
              <input value={form.baseUrl} onChange={e => set('baseUrl', e.target.value)}
                placeholder={meta.baseUrlDefault || 'https://...'} style={inputStyle} />
            </Field>
          )}

          {/* Temp + Tokens side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Temperature</div>
              <input value={form.temperature} onChange={e => set('temperature', e.target.value)}
                type="number" min="0" max="2" step="0.1" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Max Tokens</div>
              <input value={form.maxTokens} onChange={e => set('maxTokens', e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Provider note */}
          {meta.note && (
            <div style={{ padding: '9px 12px', borderRadius: 8, fontSize: 11, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)', lineHeight: 1.55, marginBottom: 18 }}>
              {meta.note}
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'var(--error-bg)', border: '1px solid var(--error-border)', color: 'var(--error)', fontSize: 12, marginBottom: 14 }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onSave(form)} disabled={saving} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px', borderRadius: 8, border: 'none',
              background: 'var(--primary)', color: 'var(--primary-fg)',
              fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>
              <Check size={13} /> {saving ? 'Saving…' : isEditing ? 'Update' : 'Save'}
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
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ModelsPage() {
  const { items: models, loading, saving, fetchError, create, update, remove, reload } = useRegistry<ModelConfig>('/api/models')
  const [modalOpen, setModalOpen]     = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null)
  const [deleteId, setDeleteId]         = useState<string | null>(null)
  const [error, setError]               = useState('')

  function openAdd() { setEditingModel(null); setError(''); setModalOpen(true) }
  function openEdit(m: ModelConfig) { setEditingModel(m); setError(''); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditingModel(null); setError('') }

  async function handleSave(form: FormState) {
    if (!form.name.trim()) { setError('Config name is required'); return }
    if (!form.modelId.trim()) { setError('Model ID is required'); return }
    setError('')
    const body = {
      name: form.name.trim(), provider: form.provider, modelId: form.modelId.trim(),
      temperature: parseFloat(form.temperature), maxTokens: parseInt(form.maxTokens),
      apiKey: form.apiKey || undefined, baseUrl: form.baseUrl || undefined,
    }
    try {
      if (editingModel) await update(editingModel.id, body as never)
      else await create(body as never)
      closeModal()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
  }

  return (
    <SectionLayout nav={AGENTS_NAV}>
      {modalOpen && (
        <ModelModal
          editingModel={editingModel} onClose={closeModal}
          onSave={handleSave} saving={saving} error={error}
        />
      )}

      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 36px 20px' }}>
        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 3 }}>Models</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>Each config is selectable in any LLM node when building agents.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {fetchError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', fontSize: 11, color: 'var(--warning)' }}>
                Connection issue.
                <button onClick={reload} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11, fontWeight: 600, padding: 0 }}>Retry</button>
              </div>
            )}
            <button onClick={openAdd} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: 'var(--primary)', color: 'var(--primary-fg)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              <Plus size={13} strokeWidth={2.5} /> Add Model
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ flexShrink: 0, position: 'relative', marginBottom: 14 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input value={modelSearch} onChange={e => setModelSearch(e.target.value)} placeholder="Search models…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Grid — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', overflow: 'hidden', opacity: 1 - i * 0.15 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface2)', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ height: 12, width: '55%', borderRadius: 4, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                      <div style={{ height: 10, width: '70%', borderRadius: 4, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                    </div>
                  </div>
                  <div style={{ padding: '10px 16px', display: 'flex', gap: 6 }}>
                    <div style={{ height: 20, width: 80, borderRadius: 5, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                    <div style={{ height: 20, width: 56, borderRadius: 5, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : models.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center', borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Brain size={20} color="var(--text3)" />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No models yet</p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>Add a model config to use it in your agent LLM nodes.</p>
              <button onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={13} /> Add your first model
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, paddingBottom: 8 }}>
              {models.filter(m =>
                !modelSearch ||
                m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                m.model_id?.toLowerCase().includes(modelSearch.toLowerCase()) ||
                m.provider?.toLowerCase().includes(modelSearch.toLowerCase())
              ).map(m => {
                const pc = PROVIDER_COLORS[m.provider] ?? PROVIDER_COLORS.google
                const tempPct = Math.round((m.temperature / 2) * 100)
                const creativityLabel = m.temperature <= 0.3 ? 'Precise' : m.temperature <= 0.7 ? 'Balanced' : m.temperature <= 1.2 ? 'Creative' : 'Wild'
                const creativityColor = m.temperature <= 0.3 ? 'var(--accent)' : m.temperature <= 0.7 ? 'var(--success)' : m.temperature <= 1.2 ? 'var(--warning)' : 'var(--error)'
                const maxK = m.max_tokens >= 1000 ? `${(m.max_tokens/1000).toFixed(0)}k` : String(m.max_tokens)
                // Token capacity relative bar (8k = 50%, 32k = ~full, cap at 64k)
                const tokenPct = Math.min(100, Math.round((m.max_tokens / 64000) * 100))

                return (
                  <div key={m.id} style={{
                    borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)',
                    overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
                    transition: 'box-shadow 0.15s',
                  }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)')}
                  >
                    {/* Provider accent bar */}
                    <div style={{ height: 3, background: pc.color, opacity: 0.7 }} />

                    {/* Card header */}
                    <div style={{ padding: '14px 16px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: pc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Brain size={14} color={pc.color} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                            <div style={{ fontSize: 10, fontFamily: 'monospace', color: pc.color, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.model_id}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                          <button onClick={() => openEdit(m)} title="Edit" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
                            <Pencil size={10} />
                          </button>
                          <button onClick={() => setDeleteId(m.id)} title="Delete" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>

                      {/* Provider badge + key status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: pc.bg, color: pc.color, border: `1px solid ${pc.color}30` }}>
                          {PROVIDER_LABELS[m.provider] ?? m.provider}
                        </span>
                        {m.has_api_key ? (
                          <span style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 5, background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' }}>
                            <KeySquare size={9} /> Key set
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 5, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                            <KeySquare size={9} /> Env var
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, background: 'var(--border)' }} />

                    {/* Stats section */}
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {/* Temperature */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Thermometer size={9} /> Temperature
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{m.temperature}</span>
                            <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4, color: creativityColor, background: `color-mix(in srgb, ${creativityColor} 10%, transparent)` }}>
                              {creativityLabel}
                            </span>
                          </span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                          <div style={{ width: `${tempPct}%`, height: '100%', background: creativityColor, borderRadius: 2, opacity: 0.8 }} />
                        </div>
                      </div>

                      {/* Max tokens */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Hash size={9} /> Context window
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{maxK}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                          <div style={{ width: `${tokenPct}%`, height: '100%', background: pc.color, borderRadius: 2, opacity: 0.5 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId) }}
        title="Delete model config?"
        message="Agent nodes using this config will fall back to defaults."
        danger
      />
      <style>{`@keyframes dash-shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </SectionLayout>
  )
}
