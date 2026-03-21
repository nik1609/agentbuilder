'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Brain, Wrench, GitBranch, UserCheck, ChevronDown, Plus, Trash2, Shield, Database } from 'lucide-react'
import { NodeData, MemorySource } from '@/types/agent'
import { useRegistry } from '@/lib/hooks/useRegistry'

interface Tool { id: string; name: string; description: string; type: string; created_at: string }
interface Prompt { id: string; name: string; content: string; created_at: string }
interface ModelConfig { id: string; name: string; model_id: string; provider: string; temperature: number; max_tokens: number; created_at: string }
interface Guardrail { id: string; name: string; created_at: string }
interface MemoryConfig { id: string; name: string; type: string; window_size: number; created_at: string }

interface NodeConfigPanelProps {
  nodeId: string
  nodeData: NodeData
  allNodes: { id: string; data: { label: string; nodeType: string } }[]
  onUpdate: (data: Partial<NodeData>) => void
  onClose: () => void
}


const NODE_META: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  llm:       { color: '#7c6ff0', bg: 'rgba(124,111,240,0.1)', icon: Brain,     label: 'LLM Node' },
  tool:      { color: '#22d79a', bg: 'rgba(34,215,154,0.1)',  icon: Wrench,    label: 'Tool Node' },
  condition: { color: '#f5a020', bg: 'rgba(245,160,32,0.1)',  icon: GitBranch, label: 'Condition Node' },
  hitl:      { color: '#b080f8', bg: 'rgba(176,128,248,0.1)', icon: UserCheck, label: 'HITL Node' },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 12, outline: 'none',
  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit',
}
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', cursor: 'pointer' }

export default function NodeConfigPanel({ nodeId, nodeData, allNodes, onUpdate, onClose }: NodeConfigPanelProps) {
  const { items: tools }        = useRegistry<Tool>('/api/tools')
  const { items: prompts }      = useRegistry<Prompt>('/api/prompts')
  const { items: modelConfigs } = useRegistry<ModelConfig>('/api/models')
  const { items: guardrails }   = useRegistry<Guardrail>('/api/guardrails')
  const { items: memoryConfigs} = useRegistry<MemoryConfig>('/api/memory')

  const [label, setLabel]               = useState(nodeData.label)
  const [model, setModel]               = useState(nodeData.model ?? '')
  const [temperature, setTemperature]   = useState(String(nodeData.temperature ?? 0.7))
  const [systemPrompt, setSystemPrompt] = useState(nodeData.systemPrompt ?? '')
  const [selectedPromptId, setSelectedPromptId] = useState('')
  const [guardrailId, setGuardrailId]   = useState((nodeData.guardrailId as string) ?? '')
  const [memorySources, setMemorySources] = useState<MemorySource[]>((nodeData.memorySources as MemorySource[]) ?? [])
  const [toolName, setToolName]         = useState(nodeData.toolName ?? '')
  const [condition, setCondition]       = useState(nodeData.condition ?? '')
  const [question, setQuestion]         = useState(nodeData.question ?? '')

  // Add memory source form state
  const [addingMemory, setAddingMemory] = useState(false)
  const [newMemType, setNewMemType]     = useState<'agent_runs' | 'node_output'>('agent_runs')
  const [newMemConfigId, setNewMemConfigId] = useState('')
  const [newMemNodeId, setNewMemNodeId] = useState('')

  const upstreamNodes = allNodes.filter(n => n.id !== nodeId && n.data.nodeType !== 'input' && n.data.nodeType !== 'output')

  // When model configs finish loading, auto-select the first config if no valid model is set
  const modelConfigsLoaded = useRef(false)
  useEffect(() => {
    if (modelConfigs.length === 0) return
    if (modelConfigsLoaded.current) return
    modelConfigsLoaded.current = true
    const valid = modelConfigs.some(m => m.name === model)
    if (!valid) {
      const first = modelConfigs[0].name
      setModel(first)
      onUpdate({ model: first })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelConfigs.length])

  const addMemorySource = () => {
    if (newMemType === 'agent_runs' && !newMemConfigId) return
    if (newMemType === 'node_output' && !newMemNodeId) return
    const node = upstreamNodes.find(n => n.id === newMemNodeId)
    const newSrc: MemorySource = {
      id: Date.now().toString(),
      type: newMemType,
      memoryConfigId: newMemType === 'agent_runs' ? newMemConfigId : undefined,
      nodeId: newMemType === 'node_output' ? newMemNodeId : undefined,
      nodeLabel: newMemType === 'node_output' ? (node?.data.label ?? newMemNodeId) : undefined,
    }
    const updated = [...memorySources, newSrc]
    setMemorySources(updated)
    onUpdate({ memorySources: updated })
    setAddingMemory(false)
    setNewMemConfigId('')
    setNewMemNodeId('')
  }

  const removeMemorySource = (id: string) => {
    const updated = memorySources.filter(s => s.id !== id)
    setMemorySources(updated)
    onUpdate({ memorySources: updated })
  }

  const meta = NODE_META[nodeData.nodeType ?? ''] ?? NODE_META.llm
  const Icon = meta.icon

  return (
    <div style={{
      width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--surface)', borderLeft: `2px solid ${meta.color}`, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: meta.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} style={{ color: meta.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{meta.label}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{nodeId.slice(0, 12)}…</div>
        </div>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text3)', cursor: 'pointer', flexShrink: 0 }}>
          <X size={12} />
        </button>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        <Field label="Label">
          <input value={label} onChange={e => { setLabel(e.target.value); onUpdate({ label: e.target.value }) }} style={inputStyle} placeholder="Node label" />
        </Field>

        {/* LLM config */}
        {nodeData.nodeType === 'llm' && (<>
          <Field label="Model Config">
            <div style={{ position: 'relative' }}>
              {modelConfigs.length === 0 ? (
                <select disabled style={{ ...selectStyle, color: 'var(--text3)' }}>
                  <option>{model || 'Loading models…'}</option>
                </select>
              ) : (
                <select value={model} onChange={e => { setModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                  {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name} · {m.model_id}</option>)}
                </select>
              )}
              <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            </div>
          </Field>

          <Field label="Temperature">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input value={temperature} onChange={e => { setTemperature(e.target.value); onUpdate({ temperature: parseFloat(e.target.value) }) }} type="range" min="0" max="2" step="0.1" style={{ flex: 1, accentColor: meta.color }} />
              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: meta.color, width: 28, textAlign: 'center', padding: '3px 6px', borderRadius: 5, background: meta.bg }}>
                {parseFloat(temperature).toFixed(1)}
              </span>
            </div>
          </Field>

          {/* Guardrail */}
          <Field label="Guardrail">
            <div style={{ position: 'relative' }}>
              <select value={guardrailId} onChange={e => { setGuardrailId(e.target.value); onUpdate({ guardrailId: e.target.value || undefined }) }} style={{ ...selectStyle, color: guardrailId ? 'var(--red)' : 'var(--text3)' }}>
                <option value="">— None —</option>
                {guardrails.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <Shield size={10} style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)', color: guardrailId ? 'var(--red)' : 'var(--text3)', pointerEvents: 'none' }} />
              <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            </div>
          </Field>

          {/* Memory Sources */}
          <Field label="Memory Sources">
            {memorySources.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                {memorySources.map(src => {
                  const label = src.type === 'agent_runs'
                    ? `Past runs · ${memoryConfigs.find(m => m.id === src.memoryConfigId)?.name ?? src.memoryConfigId}`
                    : `Node output · ${src.nodeLabel ?? src.nodeId}`
                  return (
                    <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, background: 'rgba(124,111,240,0.08)', border: '1px solid rgba(124,111,240,0.2)' }}>
                      <Database size={9} color="var(--blue)" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: 'var(--text2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                      <button onClick={() => removeMemorySource(src.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0, flexShrink: 0 }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {addingMemory ? (
              <div style={{ padding: '10px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <select value={newMemType} onChange={e => setNewMemType(e.target.value as 'agent_runs' | 'node_output')} style={{ ...selectStyle, fontSize: 11 }}>
                    <option value="agent_runs">Past agent runs (cross-session)</option>
                    <option value="node_output">Upstream node output</option>
                  </select>
                  <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                </div>

                {newMemType === 'agent_runs' && (
                  <div style={{ position: 'relative' }}>
                    <select value={newMemConfigId} onChange={e => setNewMemConfigId(e.target.value)} style={{ ...selectStyle, fontSize: 11 }}>
                      <option value="">— pick memory config —</option>
                      {memoryConfigs.map(m => <option key={m.id} value={m.id}>{m.name} ({m.type}, {m.window_size} turns)</option>)}
                    </select>
                    <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                  </div>
                )}

                {newMemType === 'node_output' && (
                  <div style={{ position: 'relative' }}>
                    <select value={newMemNodeId} onChange={e => setNewMemNodeId(e.target.value)} style={{ ...selectStyle, fontSize: 11 }}>
                      <option value="">— pick node —</option>
                      {upstreamNodes.map(n => <option key={n.id} value={n.id}>{n.data.label} ({n.data.nodeType})</option>)}
                    </select>
                    <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={addMemorySource} style={{ flex: 1, padding: '5px 0', borderRadius: 6, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                  <button onClick={() => { setAddingMemory(false); setNewMemConfigId(''); setNewMemNodeId('') }} style={{ flex: 1, padding: '5px 0', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingMemory(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 0', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>
                <Plus size={10} /> Add memory source
              </button>
            )}
          </Field>

          {/* System Prompt */}
          <Field label="System Prompt">
            {prompts.length > 0 && (
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <select value={selectedPromptId} onChange={e => { setSelectedPromptId(e.target.value); const p = prompts.find(x => x.id === e.target.value); if (p) { setSystemPrompt(p.content); onUpdate({ systemPrompt: p.content }) } }} style={{ ...selectStyle, fontSize: 11, color: 'var(--text3)' }}>
                  <option value="">— pick from registry —</option>
                  {prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            )}
            <textarea value={systemPrompt} onChange={e => { setSystemPrompt(e.target.value); onUpdate({ systemPrompt: e.target.value }) }} rows={6} placeholder="You are a helpful assistant..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, minHeight: 96 }} />
          </Field>
        </>)}

        {/* Tool config */}
        {nodeData.nodeType === 'tool' && (
          <Field label="Tool">
            {tools.length > 0 ? (
              <div style={{ position: 'relative' }}>
                <select value={toolName} onChange={e => { setToolName(e.target.value); onUpdate({ toolName: e.target.value }) }} style={selectStyle}>
                  <option value="">— select tool —</option>
                  {tools.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            ) : (
              <div style={{ ...inputStyle, color: 'var(--text3)', fontSize: 11 }}>No tools in registry. Add in Tools tab.</div>
            )}
            {toolName && (
              <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', background: 'rgba(34,215,154,0.08)', border: '1px solid rgba(34,215,154,0.25)', color: '#22d79a' }}>
                tool:{toolName}
              </div>
            )}
          </Field>
        )}

        {/* Condition config */}
        {nodeData.nodeType === 'condition' && (<>
          <Field label="Condition Expression">
            <textarea value={condition} onChange={e => { setCondition(e.target.value); onUpdate({ condition: e.target.value }) }} rows={4} placeholder="e.g. the response mentions an error" style={{ ...inputStyle, resize: 'vertical', fontSize: 11, lineHeight: 1.6 }} />
          </Field>
          <div style={{ padding: '8px 10px', borderRadius: 7, fontSize: 10, background: 'rgba(245,160,32,0.08)', border: '1px solid rgba(245,160,32,0.2)', color: 'var(--text3)', lineHeight: 1.5 }}>
            Evaluated by LLM. <span style={{ color: '#22d79a', fontWeight: 700 }}>True</span> → top handle · <span style={{ color: 'var(--red)', fontWeight: 700 }}>False</span> → bottom handle
          </div>
        </>)}

        {/* HITL config */}
        {nodeData.nodeType === 'hitl' && (<>
          <Field label="Checkpoint Question">
            <textarea value={question} onChange={e => { setQuestion(e.target.value); onUpdate({ question: e.target.value }) }} rows={4} placeholder="What should the reviewer check before approving?" style={{ ...inputStyle, resize: 'vertical', fontSize: 11, lineHeight: 1.6 }} />
          </Field>
          <div style={{ padding: '8px 10px', borderRadius: 7, fontSize: 10, background: 'rgba(176,128,248,0.08)', border: '1px solid rgba(176,128,248,0.2)', color: 'var(--text3)', lineHeight: 1.5 }}>
            Pipeline pauses here. Resume via dashboard or API.
          </div>
        </>)}
      </div>
    </div>
  )
}
