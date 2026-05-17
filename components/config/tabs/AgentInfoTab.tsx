'use client'
import Link from 'next/link'
import { ExternalLink, Copy, CheckCircle, Save } from 'lucide-react'
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
    fontSize: 10, fontWeight: 700, color: '#9B9B9B',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid #E5E5E5', background: '#fff',
    color: '#0D0D0D', fontSize: 13, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5,
  }

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Name */}
      <div>
        <div style={labelStyle}>Agent Name</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Untitled Agent" style={inputStyle} />
      </div>

      {/* Description */}
      <div>
        <div style={labelStyle}>Description</div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What does this agent do? Used by the orchestrator for routing and welcome messages."
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        <div style={{ fontSize: 11, color: '#9B9B9B', marginTop: 5, lineHeight: 1.5 }}>
          Used by the orchestrator for context-aware routing and welcome messages.
        </div>
      </div>

      {/* REST Endpoint */}
      <div>
        <div style={labelStyle}>REST Endpoint</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, padding: '9px 12px', borderRadius: 8, background: '#F7F7F8', border: '1px solid #E5E5E5', fontSize: 11, fontFamily: 'monospace', color: '#6B6B6B', wordBreak: 'break-all', lineHeight: 1.5 }}>
            POST {endpoint}
          </div>
          <button onClick={copyEndpoint} title={copied ? 'Copied!' : 'Copy endpoint'}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E5E5E5', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.1s', color: copied ? '#16A34A' : '#6B6B6B' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F7F7F8'; e.currentTarget.style.borderColor = '#0D0D0D' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E5E5E5' }}>
            {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
          </button>
          <a href={`/api/agents/${agentId}`} target="_blank" rel="noopener noreferrer"
            title="View agent JSON"
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E5E5E5', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none', color: '#6B6B6B', transition: 'all 0.1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F7F7F8'; (e.currentTarget as HTMLElement).style.borderColor = '#0D0D0D' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = '#E5E5E5' }}>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Save button — at bottom */}
      <button
        onClick={save}
        disabled={saving || !name.trim()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '10px 0', borderRadius: 8, border: 'none',
          cursor: (saving || !name.trim()) ? 'not-allowed' : 'pointer',
          background: saveStatus === 'saved' ? '#16A34A' : saveStatus === 'error' ? '#DC2626' : '#000',
          color: '#fff',
          fontSize: 13, fontWeight: 600,
          opacity: (saving || !name.trim()) ? 0.5 : 1,
          transition: 'all 0.15s', marginTop: 4,
        }}
        onMouseEnter={e => { if (!saving && name.trim() && saveStatus === 'idle') e.currentTarget.style.background = '#1A1A1A' }}
        onMouseLeave={e => { if (saveStatus === 'idle') e.currentTarget.style.background = '#000' }}
      >
        {saveStatus === 'saved' ? <CheckCircle size={13} /> : <Save size={13} />}
        {saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Save failed' : saving ? 'Saving...' : 'Save'}
      </button>

    </div>
  )
}
