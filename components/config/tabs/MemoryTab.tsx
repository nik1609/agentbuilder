'use client'
import { useState } from 'react'
import { Plus, Trash2, Database, Pencil } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'
import { Field, FormButtons, FormHeading } from './_shared'

interface MemoryConfig { id: string; name: string; type: string; window_size: number; ttl_hours: number; scope: string; created_at: string }

type FormState = { name: string; type: string; windowSize: string; ttl: string; scope: string }
const emptyForm = (): FormState => ({ name: '', type: 'sliding', windowSize: '10', ttl: '24', scope: 'session' })

export default function MemoryTab() {
  const { items, loading, saving, create, update, remove } = useRegistry<MemoryConfig>('/api/memory')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  const startEdit = (m: MemoryConfig) => {
    setEditingId(m.id)
    setShowForm(false)
    setForm({ name: m.name, type: m.type, windowSize: String(m.window_size), ttl: String(m.ttl_hours), scope: m.scope })
    setError('')
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm()); setError('') }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setError('')
    const body = { name: form.name.trim(), type: form.type, windowSize: parseInt(form.windowSize), ttlHours: parseInt(form.ttl), scope: form.scope }
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
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Memory Configs</p>
          <button onClick={() => { setShowForm(s => !s); setEditingId(null); setForm(emptyForm()); setError('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 6,
              background: 'var(--blue)', color: '#080810', border: 'none', cursor: 'pointer',
            }}>
            <Plus size={11} /> New
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>How agents remember conversation history across turns</p>
      </div>

      {formOpen && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
          <FormHeading editing={!!editingId} noun="Memory Config" />
          <Field label="Name"><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="sliding-10" /></Field>
          <Field label="Type">
            <select value={form.type} onChange={e => set('type', e.target.value)}>
              {['sliding', 'full', 'summary'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Window Size"><input value={form.windowSize} onChange={e => set('windowSize', e.target.value)} /></Field>
            <Field label="TTL (hours)"><input value={form.ttl} onChange={e => set('ttl', e.target.value)} /></Field>
          </div>
          <Field label="Scope">
            <select value={form.scope} onChange={e => set('scope', e.target.value)}>
              {['session', 'user', 'run'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          {error && <p style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{error}</p>}
          <FormButtons saving={saving} onSave={handleSave} onCancel={() => { cancelEdit(); setShowForm(false) }} saveLabel={editingId ? 'Update Config' : 'Save Config'} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-[10px]" style={{ color: 'var(--text3)' }}>Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center">
            <Database size={24} className="mx-auto mb-2" style={{ color: 'var(--text3)' }} />
            <p className="text-[10px]" style={{ color: 'var(--text3)' }}>No memory configs yet.</p>
          </div>
        ) : items.map(m => (
          <div key={m.id}
            className="flex items-start gap-3 cursor-pointer"
            style={{ padding: '12px 16px', borderBottom: '1px solid var(--border2)', background: editingId === m.id ? 'var(--surface2)' : undefined }}
            onClick={() => editingId === m.id ? cancelEdit() : startEdit(m)}>
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(251,146,60,0.1)' }}>
              <Database size={11} color="var(--orange)" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{m.name}</div>
              <div className="text-[10px] font-mono" style={{ color: 'var(--text3)' }}>
                {m.type} · {m.window_size} msgs · {m.ttl_hours}h TTL · {m.scope}
              </div>
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
        title="Delete Memory Config" message="Remove this memory config?" danger
      />
    </div>
  )
}
