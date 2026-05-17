'use client'
import { useState } from 'react'
import { Plus, Trash2, FileText, Pencil, X, Check, Search, AlertCircle, Bot, Brain, Wrench, Database, Shield, Table2, KeyRound } from 'lucide-react'
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

interface Prompt { id: string; name: string; content: string; variables: string[]; created_at: string }
type FormState = { name: string; content: string }
const emptyForm = (): FormState => ({ name: '', content: '' })

const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 11px', borderRadius: 8, fontSize: 13,
  outline: 'none', background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box',
}

function PromptModal({ editingPrompt, onClose, onSave, saving, error }: {
  editingPrompt: Prompt | null; onClose: () => void
  onSave: (form: FormState) => void; saving: boolean; error: string
}) {
  const [form, setForm] = useState<FormState>(() =>
    editingPrompt
      ? { name: editingPrompt.name, content: editingPrompt.content }
      : emptyForm()
  )
  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))
  const isEditing = !!editingPrompt

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 560, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-xl)', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={14} color="#7C3AED" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
            {isEditing ? `Edit "${editingPrompt!.name}"` : 'New Prompt'}
          </span>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ padding: '20px 22px' }}>
          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Name</div>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. researcher-base, email-writer" autoFocus style={inputStyle} />
          </div>

          {/* Prompt content */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Prompt Text</div>
            <textarea value={form.content} onChange={e => set('content', e.target.value)} rows={10}
              placeholder="You are a helpful assistant. Your job is to..."
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }} />
            <div style={{ marginTop: 7, padding: '8px 11px', borderRadius: 7, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
              Template variables are replaced at runtime:
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {[
                  { token: '{{last_output}}', desc: 'previous node output' },
                  { token: '{{input}}',       desc: 'original pipeline input' },
                  { token: '{{node.NODE_ID}}',desc: 'any upstream node by ID' },
                  { token: '{{state.key}}',   desc: 'named pipeline state' },
                ].map(({ token, desc }) => (
                  <span key={token} title={desc} style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 4, background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'default' }}>
                    {token}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'var(--error-bg)', border: '1px solid var(--error-border)', color: 'var(--error)', fontSize: 12, marginBottom: 14 }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onSave(form)} disabled={saving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              <Check size={13} /> {saving ? 'Saving…' : isEditing ? 'Update' : 'Save Prompt'}
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

export default function PromptsPage() {
  const { items: prompts, loading, saving, create, update, remove } = useRegistry<Prompt>('/api/prompts')
  const [modalOpen, setModalOpen]     = useState(false)
  const [editingPrompt, setEditing]   = useState<Prompt | null>(null)
  const [deleteId, setDeleteId]       = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [error, setError]             = useState('')

  function openAdd() { setEditing(null); setError(''); setModalOpen(true) }
  function openEdit(p: Prompt) { setEditing(p); setError(''); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null); setError('') }

  async function handleSave(form: FormState) {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.content.trim()) { setError('Prompt content is required'); return }
    setError('')
    try {
      if (editingPrompt) {
        await update(editingPrompt.id, { name: form.name.trim(), content: form.content.trim(), variables: [] } as never)
      } else {
        await create({ name: form.name.trim(), content: form.content.trim(), variables: [] } as never)
      }
      closeModal()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
  }

  const filtered = prompts.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.content.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <SectionLayout nav={NAV}>
      {modalOpen && <PromptModal editingPrompt={editingPrompt} onClose={closeModal} onSave={handleSave} saving={saving} error={error} />}

      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 36px 20px' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 3 }}>Prompts</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>Reusable system prompts you can assign to any LLM node.</p>
          </div>
          <button onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={13} strokeWidth={2.5} /> New Prompt
          </button>
        </div>

        {/* Search */}
        <div style={{ flexShrink: 0, position: 'relative', marginBottom: 12 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prompts…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Table header */}
        {!loading && prompts.length > 0 && (
          <div style={{ flexShrink: 0, padding: '7px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px 10px 0 0', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Prompt</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', width: 72, textAlign: 'center' }}>Actions</span>
          </div>
        )}

        {/* List — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, borderRadius: !loading && prompts.length > 0 ? '0 0 12px 12px' : 12, border: '1px solid var(--border)', borderTop: !loading && prompts.length > 0 ? 'none' : '1px solid var(--border)', background: 'var(--card-bg)' }}>
          {loading ? (
            [0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--border2)', opacity: 1 - i * 0.15 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0, animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 12, width: `${25 + i * 10}%`, borderRadius: 4, background: 'var(--surface2)' }} />
                  <div style={{ height: 10, width: `${55 + i * 6}%`, borderRadius: 4, background: 'var(--surface2)' }} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                {search ? <Search size={18} color="var(--text3)" /> : <FileText size={18} color="var(--text3)" />}
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                {search ? 'No prompts match' : 'No prompts yet'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: search ? 0 : 18 }}>
                {search ? `Nothing found for "${search}"` : 'Create reusable system prompts to use in your LLM nodes.'}
              </p>
              {!search && (
                <button onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={13} /> Create your first prompt
                </button>
              )}
            </div>
          ) : (
            filtered.map((p, idx) => {
              const isLast = idx === filtered.length - 1
              return (
                <div key={p.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border2)' }}>
                  {/* Row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                    transition: 'background 0.1s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Icon */}
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={14} color="#7C3AED" />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.content}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => openEdit(p)} title="Edit" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
                        <Pencil size={11} />
                      </button>
                      <button onClick={() => setDeleteId(p.id)} title="Delete" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5, transition: 'opacity 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                        <Trash2 size={11} />
                      </button>
                    </div>
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
        title="Delete prompt?" message="This prompt will be removed from the registry. Agents using it won't be affected." danger
      />
      <style>{`@keyframes dash-shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </SectionLayout>
  )
}
