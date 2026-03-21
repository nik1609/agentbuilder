'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, Search, X, Bot, Trash2, Pencil } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'
import { FormButtons, FormHeading } from './_shared'

interface Tool { id: string; name: string; description: string; type: string; created_at: string }
interface Agent { id: string; name: string; description: string; run_count: number; updated_at: string; created_at: string }

interface AgentsTabProps {
  onSaved?: (agentId: string) => void
}

export default function AgentsTab({ onSaved }: AgentsTabProps) {
  const { items: tools } = useRegistry<Tool>('/api/tools')
  const { items: agents, loading, saving, create, update, remove, reload } = useRegistry<Agent>('/api/agents')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTools, setSelectedTools] = useState<Tool[]>([])
  const [toolSearch, setToolSearch] = useState('')
  const [toolPickerOpen, setToolPickerOpen] = useState(false)
  const [error, setError] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setToolPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredTools = tools.filter(t =>
    t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
    t.description.toLowerCase().includes(toolSearch.toLowerCase())
  )

  const toggleTool = (tool: Tool) => {
    setSelectedTools(prev =>
      prev.find(t => t.id === tool.id)
        ? prev.filter(t => t.id !== tool.id)
        : [...prev, tool]
    )
  }

  const cancelEdit = () => {
    setEditingId(null)
    setName(''); setDescription(''); setSelectedTools([]); setShowForm(false); setError('')
  }

  const startEdit = (agent: Agent) => {
    setEditingId(agent.id)
    setName(agent.name)
    setDescription(agent.description ?? '')
    setSelectedTools([])
    setError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Agent name is required'); return }
    setError('')
    try {
      if (editingId) {
        await update(editingId, {
          name: name.trim(),
          description,
          tools: selectedTools.map(t => t.name),
        } as never)
        cancelEdit()
      } else {
        const data = await create({
          name: name.trim(),
          description,
          schema: { nodes: [], edges: [] },
          tools: selectedTools.map(t => t.name),
        } as never)
        onSaved?.((data as Agent).id)
        setName(''); setDescription(''); setSelectedTools([]); setShowForm(false)
      }
      reload()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save') }
  }

  const formOpen = showForm || !!editingId

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Agents Registry</p>
          <button onClick={() => { setShowForm(s => !s); setEditingId(null); setName(''); setDescription(''); setSelectedTools([]); setError('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 6,
              background: 'var(--blue)', color: '#080810', border: 'none', cursor: 'pointer',
            }}>
            <Plus size={11} /> New
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
          Each agent is a reusable AI worker deployed as a REST API
        </p>
      </div>

      {/* Create / Edit form */}
      {formOpen && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
          <FormHeading editing={!!editingId} noun="Agent" />
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Agent Name</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="my-agent"
              style={{ width: '100%', padding: '7px 12px', borderRadius: 7, fontSize: 12, outline: 'none', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Description</div>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this agent do?"
              style={{ width: '100%', padding: '7px 12px', borderRadius: 7, fontSize: 12, outline: 'none', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          {/* Tool picker */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Tools</div>
            <div ref={pickerRef} className="relative">
              {/* Selected tools chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, minHeight: 24, marginBottom: 6 }}>
                {selectedTools.map(t => (
                  <span key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 6, fontSize: 10, fontFamily: 'monospace',
                    background: 'rgba(34,215,154,0.1)', border: '1px solid rgba(34,215,154,0.3)', color: 'var(--green)',
                  }}>
                    {t.name}
                    <button onClick={() => toggleTool(t)} style={{ display: 'flex', color: 'inherit', opacity: 0.7 }}><X size={9} /></button>
                  </span>
                ))}
              </div>

              {/* Search trigger */}
              <div style={{ position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input
                  value={toolSearch}
                  onChange={e => setToolSearch(e.target.value)}
                  onFocus={() => setToolPickerOpen(true)}
                  placeholder={tools.length === 0 ? 'No tools in registry yet' : 'Search tools...'}
                  disabled={tools.length === 0}
                  style={{ width: '100%', padding: '7px 12px 7px 28px', borderRadius: 7, fontSize: 11, outline: 'none', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>

              {/* Dropdown */}
              {toolPickerOpen && tools.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  borderRadius: 8, marginTop: 4,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                }}>
                  {filteredTools.length === 0 ? (
                    <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>No tools match</div>
                  ) : filteredTools.map((tool, i) => {
                    const isSelected = !!selectedTools.find(t => t.id === tool.id)
                    return (
                      <button key={tool.id} onClick={() => toggleTool(tool)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 12px', textAlign: 'left', border: 'none', cursor: 'pointer',
                          background: isSelected ? 'rgba(34,215,154,0.08)' : 'transparent',
                          borderBottom: i < filteredTools.length - 1 ? '1px solid var(--border2)' : 'none',
                        }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          background: isSelected ? 'rgba(34,215,154,0.15)' : 'var(--surface2)',
                          border: `1px solid ${isSelected ? 'rgba(34,215,154,0.4)' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, color: isSelected ? 'var(--green)' : 'var(--text3)', fontWeight: 700,
                        }}>
                          {isSelected ? '✓' : ''}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: isSelected ? 'var(--green)' : 'var(--text)', marginBottom: 1 }}>
                            {tool.name}
                          </div>
                          {tool.description && (
                            <div style={{ fontSize: 10, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tool.description}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--text3)', flexShrink: 0 }}>
                          {tool.type}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {tools.length === 0 && (
              <p className="text-[9px] mt-1" style={{ color: 'var(--text3)' }}>
                Go to Tools tab to add tools first
              </p>
            )}
          </div>

          {error && <p style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{error}</p>}

          {!editingId && (
            <div className="flex items-center justify-between px-2 py-1.5 rounded text-[10px] font-mono mb-3"
              style={{ background: 'var(--bg)', border: '1px solid var(--border2)' }}>
              <span style={{ color: 'var(--text3)' }}>Will save as</span>
              <span style={{ color: 'var(--blue)' }}>agent:{name || 'unnamed'}:v1</span>
            </div>
          )}

          <FormButtons saving={saving} onSave={handleSave} onCancel={cancelEdit} saveLabel={editingId ? 'Update Agent' : 'Save to Registry →'} />
        </div>
      )}

      {/* Agents list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-[10px]" style={{ color: 'var(--text3)' }}>Loading...</div>
        ) : agents.length === 0 ? (
          <div className="p-6 text-center">
            <Bot size={24} className="mx-auto mb-2" style={{ color: 'var(--text3)' }} />
            <p className="text-[10px]" style={{ color: 'var(--text3)' }}>No agents yet.</p>
          </div>
        ) : agents.map(agent => (
          <div key={agent.id} className="flex items-start gap-3"
            style={{ padding: '12px 16px', borderBottom: '1px solid var(--border2)', background: editingId === agent.id ? 'var(--surface2)' : undefined }}>
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: 'rgba(96,165,250,0.1)' }}>
              <Bot size={11} color="var(--blue)" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{agent.name}</div>
              <div className="text-[10px]" style={{ color: 'var(--text3)' }}>{agent.run_count} runs</div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => startEdit(agent)} className="p-1 rounded" style={{ color: 'var(--blue)' }}>
                <Pencil size={11} />
              </button>
              <button onClick={() => setDeleteId(agent.id)} className="p-1 rounded" style={{ color: 'var(--red)' }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) remove(deleteId) }}
        title="Delete Agent" message="Delete this agent? All run history will be preserved but the agent will be removed." danger
      />
    </div>
  )
}
