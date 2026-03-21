'use client'
import { useState } from 'react'
import { Plus, Trash2, Wrench, Pencil } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'
import { Field, FormButtons, FormHeading } from './_shared'

interface Tool { id: string; name: string; description: string; type: string; endpoint?: string; method?: string; timeout?: number; created_at: string }

type FormState = { name: string; description: string; type: string; endpoint: string; timeout: string }
const emptyForm = (): FormState => ({ name: '', description: '', type: 'http', endpoint: '', timeout: '5000' })

export default function ToolsTab() {
  const { items: tools, loading, saving, create, update, remove } = useRegistry<Tool>('/api/tools')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())

  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  const startEdit = (tool: Tool) => {
    setEditingId(tool.id)
    setShowForm(false)
    setForm({ name: tool.name, description: tool.description ?? '', type: tool.type, endpoint: tool.endpoint ?? '', timeout: String(tool.timeout ?? 5000) })
    setError('')
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm()); setError('') }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setError('')
    const body = { name: form.name.trim(), description: form.description, type: form.type, endpoint: form.endpoint, timeout: parseInt(form.timeout) || 5000 }
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
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Tools Registry</p>
          <button onClick={() => { setShowForm(s => !s); setEditingId(null); setForm(emptyForm()); setError('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 6,
              background: 'var(--blue)', color: '#080810', border: 'none', cursor: 'pointer',
            }}>
            <Plus size={11} /> New
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>HTTP endpoints or functions that LLM nodes can call</p>
      </div>

      {formOpen && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
          <FormHeading editing={!!editingId} noun="Tool" />
          <Field label="Name"><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="web_search" /></Field>
          <Field label="Description">
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              placeholder="What does this tool do?"
              style={{ width: '100%', padding: '7px 12px', borderRadius: 7, fontSize: 12, outline: 'none', resize: 'none', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="http">HTTP Endpoint</option>
              <option value="function">Inline Function (JS)</option>
            </select>
          </Field>
          {form.type === 'http' && (
            <>
              <Field label="Endpoint URL">
                <input value={form.endpoint} onChange={e => set('endpoint', e.target.value)} placeholder="https://..." />
              </Field>
              <Field label="Timeout (ms)"><input value={form.timeout} onChange={e => set('timeout', e.target.value)} /></Field>
            </>
          )}
          {form.type === 'function' && (
            <>
              <Field label="Function Body (JS)">
                <textarea
                  value={form.endpoint}
                  onChange={e => set('endpoint', e.target.value)}
                  rows={7}
                  placeholder={`// input = the previous node's output\n// Return any value — it becomes the next node's input\nconst result = input.toUpperCase()\nreturn result`}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 7, fontSize: 11, fontFamily: 'monospace', lineHeight: 1.6, outline: 'none', resize: 'vertical', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </Field>
              <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5, padding: '6px 10px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border2)' }}>
                Runs server-side in Node.js. <code style={{ fontFamily: 'monospace' }}>input</code> = previous node output. Use <code style={{ fontFamily: 'monospace' }}>return</code> to pass output to the next node.
              </p>
            </>
          )}
          {error && <p style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{error}</p>}
          <FormButtons saving={saving} onSave={handleSave} onCancel={() => { cancelEdit(); setShowForm(false) }} saveLabel={editingId ? 'Update Tool' : 'Save Tool'} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-[10px]" style={{ color: 'var(--text3)' }}>Loading...</div>
        ) : tools.length === 0 ? (
          <div className="p-6 text-center">
            <Wrench size={24} className="mx-auto mb-2" style={{ color: 'var(--text3)' }} />
            <p className="text-[10px]" style={{ color: 'var(--text3)' }}>No tools yet. Create one above.</p>
          </div>
        ) : tools.map(tool => (
          <div key={tool.id}
            className="flex items-start gap-3 cursor-pointer"
            style={{ padding: '12px 16px', borderBottom: '1px solid var(--border2)', background: editingId === tool.id ? 'var(--surface2)' : undefined }}
            onClick={() => editingId === tool.id ? cancelEdit() : startEdit(tool)}>
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(74,222,128,0.1)' }}>
              <Wrench size={11} color="var(--green)" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{tool.name}</div>
              <div className="text-[10px] font-mono" style={{ color: 'var(--text3)' }}>{tool.type}{tool.endpoint ? ` · ${tool.endpoint.slice(0, 30)}…` : ''}</div>
              {tool.description && (
                <div className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'var(--text3)' }}>{tool.description}</div>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="p-1 rounded" style={{ color: 'var(--blue)' }}><Pencil size={11} /></span>
              <button onClick={e => { e.stopPropagation(); setDeleteId(tool.id) }} className="p-1 rounded" style={{ color: 'var(--red)' }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId) }}
        title="Delete Tool" message="Remove this tool from the registry? Agents that reference it may break." danger
      />
    </div>
  )
}

