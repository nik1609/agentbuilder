'use client'
import { useState } from 'react'
import { Plus, Trash2, Brain, Pencil, Check, X, ChevronDown } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'

interface ModelConfig {
  id: string; name: string; provider: string; model_id: string
  temperature: number; max_tokens: number; api_key?: string; base_url?: string; created_at: string
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google (Gemini)',
  anthropic: 'Anthropic (Claude)',
  'openai-compatible': 'OpenAI / Compatible API',
  ollama: 'Ollama (Local)',
}

const PROVIDER_MODELS: Record<string, string[]> = {
  google: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  'openai-compatible': ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it', 'mixtral-8x7b-32768'],
  ollama: ['gemma3:4b', 'gemma3:12b', 'llama3.2', 'llama3.1', 'mistral', 'mixtral', 'codellama', 'phi3', 'gemma2', 'qwen2.5'],
}

const PROVIDER_META: Record<string, { color: string; bg: string; apiKeyLabel: string; apiKeyPlaceholder: string; baseUrlDefault: string; note: string }> = {
  google:             { color: '#4285f4', bg: 'rgba(66,133,244,0.1)',   apiKeyLabel: 'Gemini API Key',      apiKeyPlaceholder: 'AIza... (leave blank to use GEMINI_API_KEY env var)', baseUrlDefault: '', note: 'Leave blank to use the GEMINI_API_KEY environment variable. Or paste your key from aistudio.google.com directly here — it stays in your account only.' },
  anthropic:          { color: '#d97706', bg: 'rgba(217,119,6,0.1)',    apiKeyLabel: 'Anthropic API Key',   apiKeyPlaceholder: 'sk-ant-...',      baseUrlDefault: '', note: 'Get your key from console.anthropic.com. Leave blank to use ANTHROPIC_API_KEY env var.' },
  'openai-compatible':{ color: '#10a37f', bg: 'rgba(16,163,127,0.1)',   apiKeyLabel: 'API Key',             apiKeyPlaceholder: 'sk-...',          baseUrlDefault: 'https://api.openai.com/v1', note: 'Works with OpenAI, Groq, Together AI, Mistral, or any OpenAI-compatible endpoint. Set Base URL accordingly.' },
  ollama:             { color: '#7c6ff0', bg: 'rgba(124,111,240,0.1)',  apiKeyLabel: 'API Key (any value)', apiKeyPlaceholder: 'ollama',          baseUrlDefault: 'http://localhost:11434/v1',  note: 'Ollama must be running locally. Any non-empty string works as the API key.' },
}

type FormState = { name: string; provider: string; modelId: string; temperature: string; maxTokens: string; apiKey: string; baseUrl: string }
const emptyForm = (): FormState => ({ name: '', provider: 'google', modelId: 'gemini-2.5-flash', temperature: '0.7', maxTokens: '4096', apiKey: '', baseUrl: '' })

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px', borderRadius: 8, fontSize: 13, outline: 'none',
  background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
  fontFamily: 'inherit', boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', cursor: 'pointer' }

export default function ModelsPage() {
  const { items: models, loading, saving, create, update, remove } = useRegistry<ModelConfig>('/api/models')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  const startEdit = (m: ModelConfig) => {
    setEditingId(m.id)
    setForm({ name: m.name, provider: m.provider, modelId: m.model_id, temperature: String(m.temperature), maxTokens: String(m.max_tokens), apiKey: m.api_key ?? '', baseUrl: m.base_url ?? '' })
    setError('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm()); setError(''); setShowForm(false) }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Config name is required'); return }
    if (!form.modelId.trim()) { setError('Model ID is required'); return }
    setError('')
    const body = {
      name: form.name.trim(), provider: form.provider, modelId: form.modelId.trim(),
      temperature: parseFloat(form.temperature), maxTokens: parseInt(form.maxTokens),
      apiKey: form.apiKey || undefined, baseUrl: form.baseUrl || undefined,
    }
    try {
      if (editingId) { await update(editingId, body as never); setEditingId(null) }
      else { await create(body as never) }
      setForm(emptyForm()); setShowForm(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
  }

  const meta = PROVIDER_META[form.provider] ?? PROVIDER_META.google

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>Models & Providers</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
            Add your LLM providers and models here. Each saved config can be selected in any LLM node when building agents.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(s => !s); setEditingId(null); setForm(emptyForm()); setError('') }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, flexShrink: 0,
            background: 'var(--blue)', color: '#fff', border: 'none', cursor: 'pointer',
          }}>
          <Plus size={14} /> Add Model
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', padding: 24, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: editingId ? 'rgba(124,111,240,0.12)' : 'rgba(34,215,154,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {editingId ? '✎' : '+'}
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{editingId ? 'Edit Model Config' : 'New Model Config'}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Config Name">
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Gemma3 Local, GPT-4 Production"
                  style={inputStyle} />
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
                  This name is how you&apos;ll select this model in the agent builder.
                </p>
              </Field>
            </div>

            <Field label="Provider">
              <div style={{ position: 'relative' }}>
                <select value={form.provider} onChange={e => {
                  const p = e.target.value
                  set('provider', p)
                  set('modelId', PROVIDER_MODELS[p]?.[0] ?? '')
                  set('baseUrl', PROVIDER_META[p]?.baseUrlDefault ?? '')
                  set('apiKey', '')
                }} style={selectStyle}>
                  {Object.keys(PROVIDER_MODELS).map(p => (
                    <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                  ))}
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            </Field>

            <Field label="Model ID">
              {(form.provider === 'ollama' || form.provider === 'openai-compatible') ? (
                <>
                  <input value={form.modelId} onChange={e => set('modelId', e.target.value)}
                    placeholder={form.provider === 'ollama' ? 'gemma3:4b' : 'llama-3.3-70b-versatile'}
                    list="page-custom-models"
                    style={inputStyle} />
                  <datalist id="page-custom-models">
                    {PROVIDER_MODELS[form.provider].map(m => <option key={m} value={m} />)}
                  </datalist>
                </>
              ) : (
                <div style={{ position: 'relative' }}>
                  <select value={form.modelId} onChange={e => set('modelId', e.target.value)} style={selectStyle}>
                    {(PROVIDER_MODELS[form.provider] ?? []).map(m => <option key={m}>{m}</option>)}
                  </select>
                  <ChevronDown size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                </div>
              )}
            </Field>

            <Field label={meta.apiKeyLabel}>
              <input value={form.apiKey} onChange={e => set('apiKey', e.target.value)}
                type={form.provider === 'ollama' ? 'text' : 'password'}
                placeholder={meta.apiKeyPlaceholder}
                style={inputStyle} />
            </Field>

            {(form.provider === 'openai-compatible' || form.provider === 'ollama') && (
              <Field label="Base URL">
                <input value={form.baseUrl} onChange={e => set('baseUrl', e.target.value)}
                  placeholder={meta.baseUrlDefault || 'https://...'}
                  style={inputStyle} />
              </Field>
            )}

            <Field label="Temperature">
              <input value={form.temperature} onChange={e => set('temperature', e.target.value)}
                type="number" min="0" max="2" step="0.1" style={inputStyle} />
            </Field>

            <Field label="Max Tokens">
              <input value={form.maxTokens} onChange={e => set('maxTokens', e.target.value)}
                style={inputStyle} />
            </Field>
          </div>

          {meta.note && (
            <div style={{ marginTop: 4, padding: '10px 14px', borderRadius: 8, fontSize: 12, background: 'rgba(124,111,240,0.06)', border: '1px solid rgba(124,111,240,0.2)', color: 'var(--text3)', lineHeight: 1.6 }}>
              {meta.note}
            </div>
          )}

          {error && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={handleSave} disabled={saving} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8,
              background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>
              <Check size={13} /> {saving ? 'Saving…' : editingId ? 'Update Config' : 'Save Config'}
            </button>
            <button onClick={cancelEdit} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8,
              background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Models list */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
      ) : models.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Brain size={32} style={{ color: 'var(--text3)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 6 }}>No model configs yet</p>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>Add a model above. Each config becomes selectable in any LLM node in the agent builder.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {models.map(m => {
            const pm = PROVIDER_META[m.provider] ?? PROVIDER_META.google
            return (
              <div key={m.id} style={{ borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: pm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Brain size={16} color={pm.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{m.name}</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: pm.color }}>{m.model_id}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => startEdit(m)} style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--blue)', cursor: 'pointer', display: 'flex' }}>
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => setDeleteId(m.id)} style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--red)', cursor: 'pointer', display: 'flex' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div style={{ padding: '12px 18px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: pm.bg, color: pm.color, border: `1px solid ${pm.color}30` }}>
                    {PROVIDER_LABELS[m.provider] ?? m.provider}
                  </span>
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                    temp: {m.temperature}
                  </span>
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                    {m.max_tokens} tokens
                  </span>
                  {m.api_key && (
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(34,215,154,0.08)', color: 'var(--green)', border: '1px solid rgba(34,215,154,0.25)' }}>
                      API key ✓
                    </span>
                  )}
                  {m.base_url && (
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)', fontFamily: 'monospace', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.base_url}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId) }}
        title="Delete Model Config" message="Remove this model config? Any agent nodes using it will fall back to defaults." danger
      />
    </div>
  )
}
