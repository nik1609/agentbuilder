'use client'
import { useState } from 'react'
import { Plus, Trash2, Shield, X, Pencil } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'
import { Field, FormButtons, FormHeading } from './_shared'

interface GuardrailRule { id: string; text: string; type: string; color: string }
interface Guardrail { id: string; name: string; input_rules: GuardrailRule[]; output_rules: GuardrailRule[]; log_violations: boolean; created_at: string }

const makeRule = (type: string): GuardrailRule => ({
  id: Date.now().toString() + Math.random(),
  text: type === 'input' ? 'Block prompt injection attempts' : 'Redact PII from responses',
  type,
  color: type === 'input' ? 'var(--orange)' : 'var(--blue)',
})

export default function GuardrailsTab() {
  const { items, loading, saving, create, update, remove } = useRegistry<Guardrail>('/api/guardrails')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [inputRules, setInputRules] = useState<GuardrailRule[]>([makeRule('input')])
  const [outputRules, setOutputRules] = useState<GuardrailRule[]>([makeRule('output')])
  const [logViolations, setLogViolations] = useState(true)

  const startEdit = (g: Guardrail) => {
    setEditingId(g.id)
    setExpandedId(null)
    setShowForm(false)
    setName(g.name)
    setInputRules(g.input_rules?.length ? g.input_rules : [makeRule('input')])
    setOutputRules(g.output_rules?.length ? g.output_rules : [makeRule('output')])
    setLogViolations(g.log_violations ?? true)
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setName(''); setInputRules([makeRule('input')]); setOutputRules([makeRule('output')]); setLogViolations(true)
    setError('')
  }

  const updateRule = (rules: GuardrailRule[], setter: (r: GuardrailRule[]) => void, id: string, text: string) =>
    setter(rules.map(r => r.id === id ? { ...r, text } : r))

  const removeRule = (rules: GuardrailRule[], setter: (r: GuardrailRule[]) => void, id: string) =>
    setter(rules.filter(r => r.id !== id))

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setError('')
    const body = { name: name.trim(), inputRules, outputRules, logViolations }
    try {
      if (editingId) {
        await update(editingId, body as never)
        setEditingId(null)
      } else {
        await create(body as never)
        setShowForm(false)
      }
      setName(''); setInputRules([makeRule('input')]); setOutputRules([makeRule('output')])
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
  }

  const formOpen = showForm || !!editingId

  const RuleList = ({ rules, setter, type }: { rules: GuardrailRule[]; setter: React.Dispatch<React.SetStateAction<GuardrailRule[]>>; type: string }) => (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>{type} Rules</span>
        <button onClick={() => setter(r => [...r, makeRule(type)])}
          className="text-[9px] px-1.5 py-0.5 rounded"
          style={{ color: type === 'input' ? 'var(--orange)' : 'var(--blue)', border: `1px solid ${type === 'input' ? 'var(--orange)' : 'var(--blue)'}` }}>
          + Add
        </button>
      </div>
      {rules.map(rule => (
        <div key={rule.id} className="flex items-center gap-2 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: rule.color }} />
          <input value={rule.text} onChange={e => updateRule(rules, setter, rule.id, e.target.value)}
            className="flex-1 px-2 py-1 rounded text-[10px] outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <button onClick={() => removeRule(rules, setter, rule.id)} className="p-0.5" style={{ color: 'var(--text3)' }}>
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Guardrails Registry</p>
          <button onClick={() => { setShowForm(s => !s); setEditingId(null); cancelEdit(); setError('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 6,
              background: 'var(--blue)', color: '#080810', border: 'none', cursor: 'pointer',
            }}>
            <Plus size={11} /> New
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>Input/output rules — checked automatically on every LLM call</p>
      </div>

      {formOpen && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
          <FormHeading editing={!!editingId} noun="Guardrail" />
          <Field label="Guardrail Name"><input value={name} onChange={e => setName(e.target.value)} placeholder="no-pii" /></Field>
          <RuleList rules={inputRules} setter={setInputRules} type="input" />
          <RuleList rules={outputRules} setter={setOutputRules} type="output" />
          <div className="flex items-center justify-between mt-3 px-2 py-2 rounded-md"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <span className="text-[10px]" style={{ color: 'var(--text2)' }}>Log violations</span>
            <button onClick={() => setLogViolations(v => !v)}
              className="w-8 h-4 rounded-full relative transition-colors"
              style={{ background: logViolations ? 'var(--blue)' : 'var(--border)' }}>
              <span className="absolute w-3 h-3 rounded-full bg-white top-0.5 transition-all"
                style={{ left: logViolations ? '17px' : '2px' }} />
            </button>
          </div>
          {error && <p style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{error}</p>}
          <FormButtons saving={saving} onSave={handleSave} onCancel={() => { cancelEdit(); setShowForm(false) }} saveLabel={editingId ? 'Update Guardrail' : 'Save Guardrail'} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-[10px]" style={{ color: 'var(--text3)' }}>Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center">
            <Shield size={24} className="mx-auto mb-2" style={{ color: 'var(--text3)' }} />
            <p className="text-[10px]" style={{ color: 'var(--text3)' }}>No guardrails yet.</p>
          </div>
        ) : items.map(g => (
          <div key={g.id} style={{ borderBottom: '1px solid var(--border2)', background: editingId === g.id ? 'var(--surface2)' : undefined }}>
            <div className="flex items-start gap-3 cursor-pointer" style={{ padding: '12px 16px' }}
              onClick={() => {
                if (editingId === g.id) { cancelEdit(); return }
                if (!editingId) setExpandedId(expandedId === g.id ? null : g.id)
              }}>
              <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(248,113,113,0.1)' }}>
                <Shield size={11} color="var(--red)" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{g.name}</div>
                <div className="text-[10px]" style={{ color: 'var(--text3)' }}>
                  {(g.input_rules?.length ?? 0)} input · {(g.output_rules?.length ?? 0)} output rules
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={e => { e.stopPropagation(); startEdit(g) }} className="p-1 rounded" style={{ color: 'var(--blue)' }}>
                  <Pencil size={11} />
                </button>
                <button onClick={e => { e.stopPropagation(); setDeleteId(g.id) }} className="p-1 rounded" style={{ color: 'var(--red)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            {expandedId === g.id && !editingId && (
              <div style={{ margin: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...(g.input_rules ?? []), ...(g.output_rules ?? [])].map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color || 'var(--text3)' }} />
                    <span style={{ color: 'var(--text2)' }}>{r.text}</span>
                    <span className="ml-auto text-[8px] px-1 rounded" style={{ color: r.color || 'var(--text3)', border: `1px solid ${r.color || 'var(--border)'}` }}>
                      {r.type?.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId) }}
        title="Delete Guardrail" message="Remove this guardrail from the registry?" danger
      />
    </div>
  )
}
