'use client'
import { useState } from 'react'
import { Plus, Trash2, Brain, Pencil } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'
import { Field, FormButtons, FormHeading } from './_shared'

interface ModelConfig { id: string; name: string; provider: string; model_id: string; temperature: number; max_tokens: number; api_key?: string; base_url?: string; created_at: string }

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google (Gemini)',
  anthropic: 'Anthropic (Claude)',
  'openai-compatible': 'OpenAI / Compatible API',
  ollama: 'Ollama (Local)',
}

const PROVIDER_MODELS: Record<string, string[]> = {
  google: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  'openai-compatible': ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  ollama: ['gemma3:4b', 'gemma3:12b', 'llama3.2', 'llama3.1', 'mistral', 'mixtral', 'codellama', 'phi3', 'gemma2', 'qwen2.5'],
}

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; apiKeyPlaceholder: string; note: string }> = {
  ollama: { baseUrl: 'http://localhost:11434/v1', apiKeyPlaceholder: 'ollama', note: 'Run Ollama locally first. API key can be any value.' },
  'openai-compatible': { baseUrl: 'https://api.openai.com/v1', apiKeyPlaceholder: 'sk-...', note: '' },
  google: { baseUrl: '', apiKeyPlaceholder: 'AIza...', note: '' },
  anthropic: { baseUrl: '', apiKeyPlaceholder: 'sk-ant-...', note: '' },
}

type FormState = { name: string; provider: string; modelId: string; temperature: string; maxTokens: string; apiKey: string; baseUrl: string }
const emptyForm = (): FormState => ({ name: '', provider: 'google', modelId: 'gemini-2.5-flash', temperature: '0.7', maxTokens: '4096', apiKey: '', baseUrl: '' })

export default function ModelsTab() {
  const { items: models, loading, saving, create, update, remove } = useRegistry<ModelConfig>('/api/models')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  const startEdit = (m: ModelConfig) => {
    setEditingId(m.id)
    setShowForm(false)
    setForm({ name: m.name, provider: m.provider, modelId: m.model_id, temperature: String(m.temperature), maxTokens: String(m.max_tokens), apiKey: m.api_key ?? '', baseUrl: m.base_url ?? '' })
    setError('')
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm()); setError('') }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setError('')
    const body = { name: form.name.trim(), provider: form.provider, modelId: form.modelId, temperature: parseFloat(form.temperature), maxTokens: parseInt(form.maxTokens), apiKey: form.apiKey || undefined, baseUrl: form.baseUrl || undefined }
    try {
      if (editingId) {
        await update(editingId, body as never)
        setEditingId(null)
      } else {
        await create(body as never)
        setShowForm(false)
      }
      setForm(emptyForm())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
  }

  const formOpen = showForm || !!editingId

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Models Registry</p>
          <button onClick={() => { setShowForm(s => !s); setEditingId(null); setForm(emptyForm()); setError('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 6,
              background: 'var(--blue)', color: '#080810', border: 'none', cursor: 'pointer',
            }}>
            <Plus size={11} /> New
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>Reusable LLM configs — pin provider, model, and parameters once</p>
      </div>

      {formOpen && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
          <FormHeading editing={!!editingId} noun="Model Config" />
          <Field label="Config Name"><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="gemini-precise" /></Field>
          <Field label="Provider">
            <select value={form.provider} onChange={e => {
              const p = e.target.value
              set('provider', p)
              set('modelId', PROVIDER_MODELS[p]?.[0] ?? '')
              set('baseUrl', PROVIDER_DEFAULTS[p]?.baseUrl ?? '')
              set('apiKey', '')
            }}>
              {Object.keys(PROVIDER_MODELS).map(p => <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>)}
            </select>
          </Field>
          <Field label="Model ID">
            {form.provider === 'ollama' ? (
              <input
                value={form.modelId}
                onChange={e => set('modelId', e.target.value)}
                placeholder="gemma3:4b, llama3.2, mistral…"
                list="ollama-models"
              />
            ) : (
              <select value={form.modelId} onChange={e => set('modelId', e.target.value)}>
                {(PROVIDER_MODELS[form.provider] ?? []).map(m => <option key={m}>{m}</option>)}
              </select>
            )}
            <datalist id="ollama-models">
              {PROVIDER_MODELS.ollama.map(m => <option key={m} value={m} />)}
            </datalist>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Temperature"><input value={form.temperature} onChange={e => set('temperature', e.target.value)} type="number" min="0" max="2" step="0.1" /></Field>
            <Field label="Max Tokens"><input value={form.maxTokens} onChange={e => set('maxTokens', e.target.value)} /></Field>
          </div>
          <Field label={form.provider === 'ollama' ? 'API Key (any value)' : 'API Key'}>
            <input value={form.apiKey} onChange={e => set('apiKey', e.target.value)}
              type={form.provider === 'ollama' ? 'text' : 'password'}
              placeholder={PROVIDER_DEFAULTS[form.provider]?.apiKeyPlaceholder ?? 'sk-...'} />
          </Field>
          {(form.provider === 'openai-compatible' || form.provider === 'ollama') && (
            <Field label="Base URL">
              <input value={form.baseUrl} onChange={e => set('baseUrl', e.target.value)}
                placeholder={PROVIDER_DEFAULTS[form.provider]?.baseUrl || 'https://...'} />
            </Field>
          )}
          {PROVIDER_DEFAULTS[form.provider]?.note && (
            <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5, padding: '6px 10px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border2)' }}>
              {PROVIDER_DEFAULTS[form.provider].note}
            </p>
          )}
          {error && <p style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{error}</p>}
          <FormButtons saving={saving} onSave={handleSave} onCancel={() => { cancelEdit(); setShowForm(false) }} saveLabel={editingId ? 'Update Model' : 'Save Model Config'} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-[10px]" style={{ color: 'var(--text3)' }}>Loading...</div>
        ) : models.length === 0 ? (
          <div className="p-6 text-center">
            <Brain size={24} className="mx-auto mb-2" style={{ color: 'var(--text3)' }} />
            <p className="text-[10px]" style={{ color: 'var(--text3)' }}>No model configs yet.</p>
          </div>
        ) : models.map(m => (
          <div key={m.id}
            className="flex items-start gap-3 cursor-pointer"
            style={{ padding: '12px 16px', borderBottom: '1px solid var(--border2)', background: editingId === m.id ? 'var(--surface2)' : undefined }}
            onClick={() => editingId === m.id ? cancelEdit() : startEdit(m)}>
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(96,165,250,0.1)' }}>
              <Brain size={11} color="var(--blue)" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{m.name}</div>
              <div className="text-[10px] font-mono" style={{ color: 'var(--blue)' }}>{m.model_id}</div>
              <div className="text-[10px]" style={{ color: 'var(--text3)' }}>temp: {m.temperature} · max: {m.max_tokens} · {m.provider}</div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="p-1 rounded" style={{ color: 'var(--blue)' }}><Pencil size={11} /></span>
              <button onClick={e => { e.stopPropagation(); setDeleteId(m.id) }} className="p-1 rounded" style={{ color: 'var(--red)' }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId) }}
        title="Delete Model Config" message="Remove this model config from the registry?" danger
      />
    </div>
  )
}
