'use client'
import { useState } from 'react'
import { Plus, Trash2, Database, Pencil, X, Check, AlertCircle, Bot, Brain, Wrench, FileText, Shield, Table2, KeyRound, Search } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'
import SectionLayout from '@/components/ui/SectionLayout'

const NAV = [
  { href: '/agents',     label: 'Agents',     icon: Bot,      match: (p: string) => p === '/agents' || p.startsWith('/agents/') || p.startsWith('/builder/') },
  { href: '/models',     label: 'Models',     icon: Brain,    match: (p: string) => p.startsWith('/models') },
  { href: '/tools',      label: 'Tools',      icon: Wrench,   match: (p: string) => p.startsWith('/tools') },
  { href: '/prompts',    label: 'Prompts',    icon: FileText, match: (p: string) => p.startsWith('/prompts') },
  { href: '/memory',     label: 'Memory',     icon: Database, match: (p: string) => p.startsWith('/memory') },
  { href: '/guardrails', label: 'Guardrails', icon: Shield,   match: (p: string) => p.startsWith('/guardrails') },
  { href: '/datatables', label: 'Datatables', icon: Table2,   match: (p: string) => p.startsWith('/datatables') },
  { href: '/api-keys',   label: 'API Keys',   icon: KeyRound, match: (p: string) => p.startsWith('/api-keys') },
]

interface MemoryConfig { id: string; name: string; type: string; window_size: number; ttl_hours: number; scope: string; created_at: string }
type FormState = { name: string; type: string; windowSize: string; ttl: string; scope: string }
const emptyForm = (): FormState => ({ name: '', type: 'sliding', windowSize: '10', ttl: '24', scope: 'session' })

const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 11px', borderRadius: 8, fontSize: 13,
  outline: 'none', background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', cursor: 'pointer' }

const TYPE_INFO: Record<string, { label: string; desc: string; color: string }> = {
  sliding: { label: 'Sliding Window', desc: 'Keeps the last N messages, drops older ones', color: '#2563EB' },
  full:    { label: 'Full History',   desc: 'Keeps the entire conversation history',         color: '#16A34A' },
  summary: { label: 'Summary',        desc: 'AI summarises old messages to save tokens',     color: '#D97706' },
}
const SCOPE_INFO: Record<string, { desc: string }> = {
  session: { desc: 'Resets when the session ends' },
  user:    { desc: 'Persists across sessions per user' },
  run:     { desc: 'Isolated to a single pipeline run' },
}

function MemoryModal({ editingConfig, onClose, onSave, saving, error }: {
  editingConfig: MemoryConfig | null; onClose: () => void
  onSave: (form: FormState) => void; saving: boolean; error: string
}) {
  const [form, setForm] = useState<FormState>(() =>
    editingConfig
      ? { name: editingConfig.name, type: editingConfig.type, windowSize: String(editingConfig.window_size), ttl: String(editingConfig.ttl_hours), scope: editingConfig.scope }
      : emptyForm()
  )
  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))
  const typeInfo = TYPE_INFO[form.type] ?? TYPE_INFO.sliding

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 500, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-xl)', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(217,119,6,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={14} color="#D97706" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
            {editingConfig ? `Edit "${editingConfig.name}"` : 'New Memory Config'}
          </span>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ padding: '20px 22px' }}>
          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Config Name</div>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. chat-memory, session-10" autoFocus style={inputStyle} />
          </div>

          {/* Type */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Memory Type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {Object.entries(TYPE_INFO).map(([val, info]) => (
                <button key={val} onClick={() => set('type', val)} style={{
                  padding: '10px 10px', borderRadius: 9, cursor: 'pointer', textAlign: 'left',
                  border: `1px solid ${form.type === val ? info.color : 'var(--border)'}`,
                  background: form.type === val ? `${info.color}10` : 'var(--surface2)',
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: form.type === val ? info.color : 'var(--text)', marginBottom: 3 }}>{info.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 }}>{info.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Window + TTL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Window Size</div>
              <input value={form.windowSize} onChange={e => set('windowSize', e.target.value)} type="number" min="1" max="200" style={inputStyle} />
              <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>Messages to keep in context</p>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>TTL (hours)</div>
              <input value={form.ttl} onChange={e => set('ttl', e.target.value)} type="number" min="1" style={inputStyle} />
              <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>How long memory persists</p>
            </div>
          </div>

          {/* Scope */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Scope</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['session', 'user', 'run'].map(s => (
                <button key={s} onClick={() => set('scope', s)} style={{
                  flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                  border: `1px solid ${form.scope === s ? 'var(--accent)' : 'var(--border)'}`,
                  background: form.scope === s ? 'var(--accent-light)' : 'var(--surface2)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: form.scope === s ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>{s.charAt(0).toUpperCase() + s.slice(1)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.3 }}>{SCOPE_INFO[s]?.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div style={{ marginBottom: 18, padding: '10px 13px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, color: 'var(--text2)', marginBottom: 5, fontSize: 11 }}>How memory works</div>
            Each LLM node can be assigned a memory config. When the agent runs, previous messages within the window are injected into the system prompt automatically so the model has context. The <span style={{ fontFamily: 'monospace', background: 'var(--card-bg)', padding: '0 4px', borderRadius: 3 }}>scope</span> controls when memory resets: per session, per user, or per run.
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'var(--error-bg)', border: '1px solid var(--error-border)', color: 'var(--error)', fontSize: 12, marginBottom: 14 }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onSave(form)} disabled={saving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              <Check size={13} /> {saving ? 'Saving…' : editingConfig ? 'Update' : 'Save Config'}
            </button>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MemoryPage() {
  const { items, loading, saving, create, update, remove } = useRegistry<MemoryConfig>('/api/memory')
  const [modalOpen, setModalOpen]   = useState(false)
  const [editingConfig, setEditing] = useState<MemoryConfig | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [error, setError]           = useState('')

  function openAdd() { setEditing(null); setError(''); setModalOpen(true) }
  function openEdit(m: MemoryConfig) { setEditing(m); setError(''); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null); setError('') }

  async function handleSave(form: FormState) {
    if (!form.name.trim()) { setError('Name is required'); return }
    setError('')
    const body = { name: form.name.trim(), type: form.type, windowSize: parseInt(form.windowSize), ttlHours: parseInt(form.ttl), scope: form.scope }
    try {
      if (editingConfig) await update(editingConfig.id, body as never)
      else await create(body as never)
      closeModal()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
  }

  const filtered = items.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.type.includes(search.toLowerCase())
  )

  return (
    <SectionLayout nav={NAV}>
      {modalOpen && <MemoryModal editingConfig={editingConfig} onClose={closeModal} onSave={handleSave} saving={saving} error={error} />}

      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 36px 20px' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 3 }}>Memory</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>Reusable memory configs you can assign to LLM nodes to retain context across runs.</p>
          </div>
          <button onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={13} strokeWidth={2.5} /> New Config
          </button>
        </div>

        {/* Search */}
        <div style={{ flexShrink: 0, position: 'relative', marginBottom: 12 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search memory configs…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Table header */}
        {!loading && items.length > 0 && (
          <div style={{ flexShrink: 0, padding: '7px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px 10px 0 0', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Config</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', width: 72, textAlign: 'center' }}>Actions</span>
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, borderRadius: !loading && items.length > 0 ? '0 0 12px 12px' : 12, border: '1px solid var(--border)', borderTop: !loading && items.length > 0 ? 'none' : '1px solid var(--border)', background: 'var(--card-bg)' }}>
          {loading ? (
            [0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--border2)', opacity: 1 - i * 0.2 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 12, width: '30%', borderRadius: 4, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                  <div style={{ height: 10, width: '55%', borderRadius: 4, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Database size={18} color="var(--text3)" />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                {search ? 'No configs match' : 'No memory configs yet'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: search ? 0 : 18 }}>
                {search ? `Nothing found for "${search}"` : 'Create a memory config to give your agents conversation history.'}
              </p>
              {!search && (
                <button onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={13} /> Create your first config
                </button>
              )}
            </div>
          ) : (
            filtered.map((m, idx) => {
              const typeInfo = TYPE_INFO[m.type] ?? TYPE_INFO.sliding
              const isLast = idx === filtered.length - 1
              return (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                  borderBottom: isLast ? 'none' : '1px solid var(--border2)',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Icon */}
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${typeInfo.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Database size={14} color={typeInfo.color} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: `${typeInfo.color}18`, color: typeInfo.color, flexShrink: 0 }}>
                        {typeInfo.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>
                      {m.window_size} msgs · {m.ttl_hours}h TTL · {m.scope}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => openEdit(m)} title="Edit" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => setDeleteId(m.id)} title="Delete" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId) }}
        title="Delete memory config?" message="This config will be removed. Agents using it will fall back to no memory." danger
      />
      <style>{`@keyframes dash-shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </SectionLayout>
  )
}
