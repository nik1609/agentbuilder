'use client'
import { useState } from 'react'
import { Plus, Trash2, Shield, X, Pencil, Check, AlertCircle, Bot, Brain, Wrench, FileText, Database, Table2, KeyRound, Search } from 'lucide-react'
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

interface GuardrailRule { id: string; text: string; type: string; color: string }
interface Guardrail { id: string; name: string; input_rules: GuardrailRule[]; output_rules: GuardrailRule[]; log_violations: boolean; created_at: string }

const makeRule = (type: string): GuardrailRule => ({
  id: Date.now().toString() + Math.random(),
  text: type === 'input' ? 'Block prompt injection attempts' : 'Redact PII from responses',
  type, color: type === 'input' ? '#D97706' : '#2563EB',
})

const inputStyle: React.CSSProperties = {
  flex: 1, height: 34, padding: '0 10px', borderRadius: 7, fontSize: 12, outline: 'none',
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box',
}

function RuleSection({ label, rules, setter, type, color }: {
  label: string; rules: GuardrailRule[]; setter: (r: GuardrailRule[]) => void; type: string; color: string
}) {
  const updateRule = (id: string, text: string) => setter(rules.map(r => r.id === id ? { ...r, text } : r))
  const removeRule = (id: string) => setter(rules.filter(r => r.id !== id))
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
        </div>
        <button onClick={() => setter([...rules, makeRule(type)])} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, cursor: 'pointer', background: 'transparent', color, border: `1px solid ${color}50` }}>
          + Add rule
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rules.map(rule => (
          <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <input value={rule.text} onChange={e => updateRule(rule.id, e.target.value)} style={inputStyle} placeholder="Describe the rule in plain English…" />
            <button onClick={() => removeRule(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 2, flexShrink: 0 }}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function GuardrailModal({ editingGuardrail, onClose, onSave, saving, error }: {
  editingGuardrail: Guardrail | null; onClose: () => void
  onSave: (name: string, ir: GuardrailRule[], or: GuardrailRule[], log: boolean) => void
  saving: boolean; error: string
}) {
  const [name, setName]           = useState(editingGuardrail?.name ?? '')
  const [inputRules, setInput]    = useState<GuardrailRule[]>(editingGuardrail?.input_rules?.length ? editingGuardrail.input_rules : [makeRule('input')])
  const [outputRules, setOutput]  = useState<GuardrailRule[]>(editingGuardrail?.output_rules?.length ? editingGuardrail.output_rules : [makeRule('output')])
  const [logViolations, setLog]   = useState(editingGuardrail?.log_violations ?? true)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 540, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-xl)', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={14} color="#DC2626" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
            {editingGuardrail ? `Edit "${editingGuardrail.name}"` : 'New Guardrail'}
          </span>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ padding: '20px 22px' }}>
          {/* How it works */}
          <div style={{ marginBottom: 18, padding: '10px 13px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>How guardrails work</div>
            <span style={{ color: '#D97706', fontWeight: 600 }}>Input rules</span> are checked before sending the prompt to the LLM. They block dangerous inputs.{' '}
            <span style={{ color: '#2563EB', fontWeight: 600 }}>Output rules</span> are checked on the LLM response before it flows to the next node. They redact or reject unsafe outputs. Rules use keyword and pattern matching.
          </div>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Guardrail Name</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. no-pii, safe-output" autoFocus
              style={{ width: '100%', height: 36, padding: '0 11px', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          <RuleSection label="Input Rules"  rules={inputRules}  setter={setInput}  type="input"  color="#D97706" />
          <RuleSection label="Output Rules" rules={outputRules} setter={setOutput} type="output" color="#2563EB" />

          {/* Log violations */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, padding: '10px 12px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Log violations</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Record when a rule fires to the run trace</div>
            </div>
            <button onClick={() => setLog(v => !v)} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s', background: logViolations ? 'var(--accent)' : 'var(--border)', padding: 0 }}>
              <span style={{ position: 'absolute', width: 15, height: 15, borderRadius: '50%', background: '#fff', top: 2.5, left: logViolations ? 18 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'var(--error-bg)', border: '1px solid var(--error-border)', color: 'var(--error)', fontSize: 12, marginBottom: 14 }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onSave(name, inputRules, outputRules, logViolations)} disabled={saving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              <Check size={13} /> {saving ? 'Saving…' : editingGuardrail ? 'Update' : 'Save Guardrail'}
            </button>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GuardrailsPage() {
  const { items, loading, saving, create, update, remove } = useRegistry<Guardrail>('/api/guardrails')
  const [modalOpen, setModalOpen]      = useState(false)
  const [editingGuardrail, setEditing] = useState<Guardrail | null>(null)
  const [deleteId, setDeleteId]        = useState<string | null>(null)
  const [search, setSearch]            = useState('')
  const [error, setError]              = useState('')

  function openAdd() { setEditing(null); setError(''); setModalOpen(true) }
  function openEdit(g: Guardrail) { setEditing(g); setError(''); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null); setError('') }

  async function handleSave(name: string, ir: GuardrailRule[], or: GuardrailRule[], log: boolean) {
    if (!name.trim()) { setError('Name is required'); return }
    setError('')
    try {
      if (editingGuardrail) await update(editingGuardrail.id, { name: name.trim(), inputRules: ir, outputRules: or, logViolations: log } as never)
      else await create({ name: name.trim(), inputRules: ir, outputRules: or, logViolations: log } as never)
      closeModal()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
  }

  const filtered = items.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <SectionLayout nav={NAV}>
      {modalOpen && <GuardrailModal editingGuardrail={editingGuardrail} onClose={closeModal} onSave={handleSave} saving={saving} error={error} />}

      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 36px 20px' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 3 }}>Guardrails</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>Input and output rules checked automatically on every LLM call.</p>
          </div>
          <button onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={13} strokeWidth={2.5} /> New Guardrail
          </button>
        </div>

        <div style={{ flexShrink: 0, position: 'relative', marginBottom: 12 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guardrails…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {!loading && items.length > 0 && (
          <div style={{ flexShrink: 0, padding: '7px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px 10px 0 0', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Guardrail</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', width: 72, textAlign: 'center' }}>Actions</span>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, borderRadius: !loading && items.length > 0 ? '0 0 12px 12px' : 12, border: '1px solid var(--border)', borderTop: !loading && items.length > 0 ? 'none' : '1px solid var(--border)', background: 'var(--card-bg)' }}>
          {loading ? (
            [0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--border2)', opacity: 1 - i * 0.2 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 12, width: '25%', borderRadius: 4, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                  <div style={{ height: 10, width: '45%', borderRadius: 4, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Shield size={18} color="var(--text3)" />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{search ? 'No guardrails match' : 'No guardrails yet'}</p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: search ? 0 : 18 }}>
                {search ? `Nothing found for "${search}"` : 'Create rules to block unsafe inputs and filter LLM outputs.'}
              </p>
              {!search && (
                <button onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={13} /> Create your first guardrail
                </button>
              )}
            </div>
          ) : filtered.map((g, idx) => {
            const inCount = g.input_rules?.length ?? 0
            const outCount = g.output_rules?.length ?? 0
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border2)' : 'none', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Shield size={14} color="#DC2626" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{g.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(217,119,6,0.1)', color: '#D97706' }}>{inCount} input {inCount === 1 ? 'rule' : 'rules'}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(37,99,235,0.1)', color: '#2563EB' }}>{outCount} output {outCount === 1 ? 'rule' : 'rules'}</span>
                    {g.log_violations && <span style={{ fontSize: 10, color: 'var(--text3)' }}>· logs on</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openEdit(g)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}>
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => setDeleteId(g.id)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { if (deleteId) remove(deleteId) }}
        title="Delete guardrail?" message="Agents using it will run without protection." danger />
      <style>{`@keyframes dash-shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </SectionLayout>
  )
}
