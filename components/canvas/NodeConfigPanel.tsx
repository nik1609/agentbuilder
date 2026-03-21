'use client'
import { useState, useEffect } from 'react'
import { X, Brain, Wrench, GitBranch, UserCheck, ChevronDown } from 'lucide-react'
import { NodeData } from '@/types/agent'
import { useRegistry } from '@/lib/hooks/useRegistry'

interface Tool { id: string; name: string; description: string; type: string; created_at: string }
interface Prompt { id: string; name: string; content: string; created_at: string }
interface ModelConfig { id: string; name: string; model_id: string; provider: string; temperature: number; max_tokens: number; created_at: string }

interface NodeConfigPanelProps {
  nodeId: string
  nodeData: NodeData
  onUpdate: (data: Partial<NodeData>) => void
  onClose: () => void
}

const FALLBACK_MODELS = [
  'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash',
]

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
  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
  fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'none', cursor: 'pointer',
}

export default function NodeConfigPanel({ nodeId, nodeData, onUpdate, onClose }: NodeConfigPanelProps) {
  const { items: tools } = useRegistry<Tool>('/api/tools')
  const { items: prompts } = useRegistry<Prompt>('/api/prompts')
  const { items: modelConfigs } = useRegistry<ModelConfig>('/api/models')

  const [label, setLabel] = useState(nodeData.label)
  const [model, setModel] = useState(nodeData.model ?? 'gemini-2.5-flash')
  const [temperature, setTemperature] = useState(String(nodeData.temperature ?? 0.7))
  const [systemPrompt, setSystemPrompt] = useState(nodeData.systemPrompt ?? '')
  const [selectedPromptId, setSelectedPromptId] = useState('')
  const [toolName, setToolName] = useState(nodeData.toolName ?? '')
  const [condition, setCondition] = useState(nodeData.condition ?? '')
  const [question, setQuestion] = useState(nodeData.question ?? '')

  const save = () => {
    const updates: Partial<NodeData> = { label }
    if (nodeData.nodeType === 'llm') {
      updates.model = model
      updates.temperature = parseFloat(temperature)
      updates.systemPrompt = systemPrompt
    }
    if (nodeData.nodeType === 'tool') updates.toolName = toolName
    if (nodeData.nodeType === 'condition') updates.condition = condition
    if (nodeData.nodeType === 'hitl') updates.question = question
    onUpdate(updates)
  }

  useEffect(() => { save() }, [label, model, temperature, systemPrompt, toolName, condition, question])

  const meta = NODE_META[nodeData.nodeType ?? ''] ?? NODE_META.llm
  const Icon = meta.icon

  return (
    <div style={{
      width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--surface)', borderLeft: `2px solid ${meta.color}`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: meta.bg, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} style={{ color: meta.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{meta.label}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{nodeId.slice(0, 12)}…</div>
        </div>
        <button onClick={onClose} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: 6,
          border: '1px solid var(--border)', background: 'var(--surface2)',
          color: 'var(--text3)', cursor: 'pointer', flexShrink: 0,
        }}>
          <X size={12} />
        </button>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Label */}
        <Field label="Label">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            style={inputStyle}
            placeholder="Node label"
          />
        </Field>

        {/* LLM config */}
        {nodeData.nodeType === 'llm' && (<>
          <Field label="Model Config">
            <div style={{ position: 'relative' }}>
              <select value={model} onChange={e => setModel(e.target.value)} style={selectStyle}>
                {modelConfigs.length > 0
                  ? modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name} · {m.model_id} ({m.provider})</option>)
                  : FALLBACK_MODELS.map(m => <option key={m}>{m}</option>)
                }
              </select>
              <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            </div>
            {modelConfigs.length === 0 && (
              <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5, lineHeight: 1.4 }}>
                No model configs saved. Go to <strong style={{ color: 'var(--blue)' }}>Models</strong> tab to add one.
              </p>
            )}
          </Field>

          <Field label="Temperature">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                value={temperature}
                onChange={e => setTemperature(e.target.value)}
                type="range" min="0" max="2" step="0.1"
                style={{ flex: 1, accentColor: meta.color }}
              />
              <span style={{
                fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                color: meta.color, width: 28, textAlign: 'center',
                padding: '3px 6px', borderRadius: 5,
                background: meta.bg,
              }}>{parseFloat(temperature).toFixed(1)}</span>
            </div>
          </Field>

          <Field label="System Prompt">
            {prompts.length > 0 && (
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <select
                  value={selectedPromptId}
                  onChange={e => {
                    setSelectedPromptId(e.target.value)
                    const p = prompts.find(x => x.id === e.target.value)
                    if (p) setSystemPrompt(p.content)
                  }}
                  style={{ ...selectStyle, fontSize: 11, color: 'var(--text3)' }}
                >
                  <option value="">— pick from registry —</option>
                  {prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            )}
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={6}
              placeholder="You are a helpful assistant..."
              style={{
                ...inputStyle, resize: 'vertical', fontFamily: 'monospace',
                fontSize: 11, lineHeight: 1.6, minHeight: 96,
              }}
            />
          </Field>
        </>)}

        {/* Tool config */}
        {nodeData.nodeType === 'tool' && (
          <Field label="Tool">
            {tools.length > 0 ? (
              <div style={{ position: 'relative' }}>
                <select value={toolName} onChange={e => setToolName(e.target.value)} style={selectStyle}>
                  <option value="">— select tool —</option>
                  {tools.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            ) : (
              <div style={{ ...inputStyle, color: 'var(--text3)', fontSize: 11 }}>
                No tools in registry. Add in Tools tab.
              </div>
            )}
            {toolName && (
              <div style={{
                marginTop: 8, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
                background: 'rgba(34,215,154,0.08)', border: '1px solid rgba(34,215,154,0.25)', color: '#22d79a',
              }}>
                tool:{toolName}
              </div>
            )}
          </Field>
        )}

        {/* Condition config */}
        {nodeData.nodeType === 'condition' && (<>
          <Field label="Condition Expression">
            <textarea
              value={condition}
              onChange={e => setCondition(e.target.value)}
              rows={4}
              placeholder="e.g. the response mentions an error"
              style={{ ...inputStyle, resize: 'vertical', fontSize: 11, lineHeight: 1.6 }}
            />
          </Field>
          <div style={{
            padding: '8px 10px', borderRadius: 7, fontSize: 10,
            background: 'rgba(245,160,32,0.08)', border: '1px solid rgba(245,160,32,0.2)',
            color: 'var(--text3)', lineHeight: 1.5,
          }}>
            Evaluated by LLM. <span style={{ color: '#22d79a', fontWeight: 700 }}>True</span> → top handle · <span style={{ color: 'var(--red)', fontWeight: 700 }}>False</span> → bottom handle
          </div>
        </>)}

        {/* HITL config */}
        {nodeData.nodeType === 'hitl' && (<>
          <Field label="Checkpoint Question">
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={4}
              placeholder="What should the reviewer check before approving?"
              style={{ ...inputStyle, resize: 'vertical', fontSize: 11, lineHeight: 1.6 }}
            />
          </Field>
          <div style={{
            padding: '8px 10px', borderRadius: 7, fontSize: 10,
            background: 'rgba(176,128,248,0.08)', border: '1px solid rgba(176,128,248,0.2)',
            color: 'var(--text3)', lineHeight: 1.5,
          }}>
            Pipeline pauses here. Resume via dashboard or API.
          </div>
        </>)}
      </div>
    </div>
  )
}
