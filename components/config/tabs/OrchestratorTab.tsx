'use client'
import { useState, useEffect } from 'react'
import { Brain, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'

interface ModelRow { id: string; name: string; provider: string; model_id: string }
interface OrchestratorConfig { enabled: boolean; model: string }

interface Props { agentId: string }

export default function OrchestratorTab({ agentId }: Props) {
  const [models, setModels] = useState<ModelRow[]>([])
  const [config, setConfig] = useState<OrchestratorConfig>({ enabled: false, model: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/models').then(r => r.json()).catch(() => []),
      fetch(`/api/agents/${agentId}`).then(r => r.json()).catch(() => null),
    ]).then(([modelRes, agentRes]) => {
      setModels(Array.isArray(modelRes) ? modelRes : [])
      const orch = agentRes?.schema?.orchestratorConfig
      if (orch) setConfig({ enabled: !!orch.enabled, model: orch.model ?? '' })
      setLoading(false)
    })
  }, [agentId])

  const save = async (next: OrchestratorConfig) => {
    setSaving(true)
    try {
      const agentRes = await fetch(`/api/agents/${agentId}`).then(r => r.json())
      const newSchema = { ...(agentRes?.schema ?? {}), orchestratorConfig: next }
      await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: newSchema }),
      })
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const toggle = () => {
    const next = { ...config, enabled: !config.enabled }
    setConfig(next)
    save(next)
  }

  const setModel = (model: string) => {
    const next = { ...config, model }
    setConfig(next)
    save(next)
  }

  if (loading) return (
    <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 8, color: '#9B9B9B', fontSize: 13 }}>
      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
    </div>
  )

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Info box */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 10, background: '#F7F7F8', border: '1px solid #E5E5E5' }}>
        <Brain size={15} color="#2563EB" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', marginBottom: 3 }}>Orchestrator</div>
          <div style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.55 }}>Routes user messages intelligently. Answers questions mid-flow, jumps to relevant steps, or handles off-topic chat.</div>
        </div>
      </div>

      {/* Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, border: '1px solid #E5E5E5', background: '#fff' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', marginBottom: 2 }}>Enable orchestrator</div>
          <div style={{ fontSize: 12, color: '#9B9B9B' }}>Adds one LLM call before each run</div>
        </div>
        <button onClick={toggle} disabled={saving}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: config.enabled ? '#2563EB' : '#C2C2C2', opacity: saving ? 0.5 : 1, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}>
          {config.enabled ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
        </button>
      </div>

      {/* Model selector */}
      {config.enabled && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Orchestrator Model</div>
          {models.length === 0 ? (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 12, color: '#D97706' }}>
              No models configured yet. Add one in the Models page.
            </div>
          ) : (
            <select value={config.model} onChange={e => setModel(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E5E5E5', background: '#fff', color: config.model ? '#0D0D0D' : '#9B9B9B', fontSize: 13, outline: 'none', cursor: 'pointer', appearance: 'none' }}>
              <option value="">Select a model</option>
              {models.map(m => (
                <option key={m.id} value={m.name}>{m.name} ({m.provider})</option>
              ))}
            </select>
          )}
          <div style={{ marginTop: 6, fontSize: 11, color: '#9B9B9B', lineHeight: 1.55 }}>
            Use a fast, cheap model (e.g. Gemini Flash). It only classifies intent, not generate responses.
          </div>
        </div>
      )}

      {/* Behavior table */}
      {config.enabled && (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: '#F7F7F8', border: '1px solid #E5E5E5' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Routing decisions</div>
          {[
            { label: 'CONTINUE', desc: 'Message fits the workflow, runs normally' },
            { label: 'ANSWER', desc: 'Answers a domain question inline, then continues' },
            { label: 'JUMP', desc: 'Jumps directly to a named workflow step' },
            { label: 'RESPOND', desc: 'Off-topic chat, responds without running workflow' },
          ].map(({ label, desc }) => (
            <div key={label} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: '#2563EB', flexShrink: 0, width: 64 }}>{label}</span>
              <span style={{ fontSize: 11, color: '#6B6B6B', lineHeight: 1.5 }}>{desc}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
