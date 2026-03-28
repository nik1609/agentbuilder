'use client'
import Link from 'next/link'
import { ExternalLink, Copy, CheckCircle, ArrowLeft, Save } from 'lucide-react'
import { useState, useEffect } from 'react'

interface AgentInfoTabProps {
  agentId: string
  agentName: string
}

export default function AgentInfoTab({ agentId, agentName }: AgentInfoTabProps) {
  const [copied, setCopied] = useState(false)
  const [name, setName] = useState(agentName || '')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (!agentId) return
    fetch(`/api/agents/${agentId}`)
      .then(r => r.json())
      .then(d => {
        if (d.name) setName(d.name)
        if (d.description) setDescription(d.description)
      })
      .catch(() => {})
  }, [agentId])

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    setSaveStatus('idle')
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const endpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/agents/${agentId}/run`
    : `/api/agents/${agentId}/run`

  const copyEndpoint = () => {
    navigator.clipboard.writeText(endpoint)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text)', fontSize: 12, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Name */}
      <div>
        <div style={labelStyle}>Agent Name</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Untitled Agent"
          style={inputStyle}
        />
      </div>

      {/* Description */}
      <div>
        <div style={labelStyle}>Description</div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What does this agent do? This is used by the orchestrator to personalize responses and the welcome message."
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
          Used by the orchestrator for context-aware routing and welcome messages.
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={save}
        disabled={saving || !name.trim()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          background: saveStatus === 'saved' ? 'rgba(34,197,94,0.15)' : saveStatus === 'error' ? 'rgba(232,85,85,0.15)' : 'var(--blue)',
          color: saveStatus === 'saved' ? 'var(--green)' : saveStatus === 'error' ? '#e85555' : '#fff',
          fontSize: 12, fontWeight: 600, opacity: saving ? 0.6 : 1,
          transition: 'all 0.15s',
        }}
      >
        {saveStatus === 'saved' ? <CheckCircle size={12} /> : <Save size={12} />}
        {saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Save failed' : saving ? 'Saving…' : 'Save'}
      </button>

      {/* ID */}
      <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)', padding: '6px 10px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        ID: {agentId}
      </div>

      {/* Endpoint */}
      {agentId && (
        <div>
          <div style={labelStyle}>REST Endpoint</div>
          <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 10, fontFamily: 'monospace', color: 'var(--text2)', lineHeight: 1.6, wordBreak: 'break-all' }}>
            POST {endpoint}
          </div>
          <button
            onClick={copyEndpoint}
            style={{
              marginTop: 6, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 7,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              fontSize: 11, color: copied ? 'var(--green)' : 'var(--blue)', cursor: 'pointer', fontWeight: 600,
            }}
          >
            {copied ? <CheckCircle size={11} /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy endpoint'}
          </button>
        </div>
      )}

      {/* Nav links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Link href="/agents" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--surface2)',
          fontSize: 11, color: 'var(--text2)', textDecoration: 'none', fontWeight: 500,
        }}>
          <ArrowLeft size={11} /> All agents
        </Link>
        <a
          href={`/api/agents/${agentId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface2)',
            fontSize: 11, color: 'var(--text2)', textDecoration: 'none', fontWeight: 500,
          }}
        >
          <ExternalLink size={11} /> View agent JSON
        </a>
      </div>
    </div>
  )
}
