'use client'
import { useState } from 'react'
import { Plus, Trash2, FileText, Pencil } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'
import { Field, FormButtons, FormHeading } from './_shared'

interface Prompt { id: string; name: string; content: string; variables: string[]; created_at: string }

type FormState = { name: string; content: string; varInput: string }
const emptyForm = (): FormState => ({ name: '', content: '', varInput: '' })

export default function PromptsTab() {
  const { items: prompts, loading, saving, create, update, remove } = useRegistry<Prompt>('/api/prompts')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  const startEdit = (p: Prompt) => {
    setEditingId(p.id)
    setExpandedId(null)
    setShowForm(false)
    setForm({ name: p.name, content: p.content, varInput: (p.variables ?? []).join(', ') })
    setError('')
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm()); setError('') }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.content.trim()) { setError('Prompt content is required'); return }
    const vars = form.varInput.split(',').map(v => v.trim()).filter(Boolean)
    setError('')
    try {
      if (editingId) {
        await update(editingId, { name: form.name.trim(), content: form.content.trim(), variables: vars } as never)
        setEditingId(null)
      } else {
        await create({ name: form.name.trim(), content: form.content.trim(), variables: vars } as never)
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
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Prompts Registry</p>
          <button onClick={() => { setShowForm(s => !s); setEditingId(null); setForm(emptyForm()); setError('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 6,
              background: 'var(--blue)', color: '#080810', border: 'none', cursor: 'pointer',
            }}>
            <Plus size={11} /> New
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>Reusable system prompts for LLM nodes</p>
      </div>

      {formOpen && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
          <FormHeading editing={!!editingId} noun="Prompt" />
          <Field label="Prompt Name"><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="researcher-base" /></Field>
          <Field label="Prompt Text">
            <textarea value={form.content} onChange={e => set('content', e.target.value)} rows={7}
              placeholder="You are a helpful assistant..."
              style={{ width: '100%', padding: '7px 12px', borderRadius: 7, fontSize: 12, outline: 'none', resize: 'none', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </Field>
          <Field label="Variables (comma-separated)">
            <input value={form.varInput} onChange={e => set('varInput', e.target.value)} placeholder="user_name, today_date" />
          </Field>
          {error && <p style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{error}</p>}
          <FormButtons saving={saving} onSave={handleSave} onCancel={() => { cancelEdit(); setShowForm(false) }} saveLabel={editingId ? 'Update Prompt' : 'Save Prompt'} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-[10px]" style={{ color: 'var(--text3)' }}>Loading...</div>
        ) : prompts.length === 0 ? (
          <div className="p-6 text-center">
            <FileText size={24} className="mx-auto mb-2" style={{ color: 'var(--text3)' }} />
            <p className="text-[10px]" style={{ color: 'var(--text3)' }}>No prompts yet.</p>
          </div>
        ) : prompts.map(p => (
          <div key={p.id} style={{ borderBottom: '1px solid var(--border2)', background: editingId === p.id ? 'var(--surface2)' : undefined }}>
            <div className="flex items-start gap-3 cursor-pointer" style={{ padding: '12px 16px' }}
              onClick={() => {
                if (editingId === p.id) { cancelEdit(); return }
                if (!editingId) setExpandedId(expandedId === p.id ? null : p.id)
              }}>
              <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(167,139,250,0.1)' }}>
                <FileText size={11} color="var(--purple)" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{p.name}</div>
                <div className="text-[10px] line-clamp-1" style={{ color: 'var(--text3)' }}>{p.content}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={e => { e.stopPropagation(); startEdit(p) }} className="p-1 rounded" style={{ color: 'var(--blue)' }}>
                  <Pencil size={11} />
                </button>
                <button onClick={e => { e.stopPropagation(); setDeleteId(p.id) }} className="p-1 rounded" style={{ color: 'var(--red)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            {expandedId === p.id && !editingId && (
              <div className="text-[10px] font-mono whitespace-pre-wrap"
                style={{ margin: '0 16px 12px', padding: '10px 12px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text2)', lineHeight: 1.7 }}>
                {p.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId) }}
        title="Delete Prompt" message="Remove this prompt from the registry?" danger
      />
    </div>
  )
}
