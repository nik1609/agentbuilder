'use client'
import { useState, useEffect } from 'react'
import { Brain, ToggleLeft, ToggleRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface ModelRow { id: string; name: string; provider: string; model_id: string }
interface OrchestratorConfig { enabled: boolean; model: string }

interface Props {
  agentId: string
}

export default function OrchestratorTab({ agentId }: Props) {
  const [models, setModels] = useState<ModelRow[]>([])
  const [config, setConfig] = useState<OrchestratorConfig>({ enabled: false, model: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

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
    setStatus('idle')
    try {
      // Fetch current agent schema first, then merge orchestratorConfig in
      const agentRes = await fetch(`/api/agents/${agentId}`).then(r => r.json())
      const currentSchema = agentRes?.schema ?? {}
      const newSchema = { ...currentSchema, orchestratorConfig: next }
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: newSchema }),
      })
      if (!res.ok) throw new Error('Save failed')
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
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
    <div style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 12 }}>
      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
    </div>
  )

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(124,111,240,0.06)', border: '1px solid rgba(124,111,240,0.15)' }}>
        <Brain size={14} color="var(--blue)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 1 }}>Orchestrator</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.5 }}>Routes user messages intelligently — answers questions mid-flow, jumps to relevant steps, or handles off-topic chat.</div>
        </div>
      </div>

      {/* Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 1 }}>Enable orchestrator</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>Adds one LLM call before each run</div>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: config.enabled ? 'var(--blue)' : 'var(--text3)', opacity: saving ? 0.5 : 1, display: 'flex', alignItems: 'center' }}
        >
          {config.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
        </button>
      </div>

      {/* Model selector — only shown when enabled */}
      {config.enabled && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Orchestrator Model
          </div>
          {models.length === 0 ? (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(245,160,32,0.08)', border: '1px solid rgba(245,160,32,0.25)', fontSize: 11, color: '#f5a020' }}>
              No models registered yet. Add a model in the Models tab first.
            </div>
          ) : (
            <select
              value={config.model}
              onChange={e => setModel(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
            >
              <option value="">— select a model —</option>
              {models.map(m => (
                <option key={m.id} value={m.name}>{m.name} ({m.provider})</option>
              ))}
            </select>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>
            Tip: Use a fast, cheap model (e.g. Gemini Flash) — it only needs to decide routing, not generate full responses.
          </div>
        </div>
      )}

      {/* Behavior explanation */}
      {config.enabled && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            What the orchestrator does
          </div>
          {[
            { label: 'CONTINUE', desc: 'User message fits the workflow — runs normally' },
            { label: 'ANSWER', desc: 'User asked a workflow-related question — answers it inline then continues' },
            { label: 'JUMP', desc: 'User wants a specific step — jumps directly to that node' },
            { label: 'CHITCHAT', desc: 'Completely off-topic — responds conversationally, workflow skipped' },
          ].map(({ label, desc }) => (
            <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: 'var(--blue)', flexShrink: 0, width: 60 }}>{label}</span>
              <span style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.5 }}>{desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* Save status */}
      {status !== 'idle' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: status === 'saved' ? 'var(--green)' : '#e85555' }}>
          {status === 'saved' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
          {status === 'saved' ? 'Saved' : 'Save failed'}
        </div>
      )}
    </div>
  )
}
