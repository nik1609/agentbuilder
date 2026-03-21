'use client'
import Link from 'next/link'
import { ExternalLink, Copy, CheckCircle, ArrowLeft } from 'lucide-react'
import { useState } from 'react'

interface AgentInfoTabProps {
  agentId: string
  agentName: string
}

export default function AgentInfoTab({ agentId, agentName }: AgentInfoTabProps) {
  const [copied, setCopied] = useState(false)

  const endpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/agents/${agentId}/run`
    : `/api/agents/${agentId}/run`

  const copyEndpoint = () => {
    navigator.clipboard.writeText(endpoint)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Current agent */}
      <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Editing
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2, wordBreak: 'break-word' }}>
          {agentName || 'Untitled Agent'}
        </div>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)' }}>
          {agentId.slice(0, 8)}…
        </div>
      </div>

      {/* Endpoint */}
      {agentId && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            REST Endpoint
          </div>
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

      {/* Usage hint */}
      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(124,111,240,0.06)', border: '1px solid rgba(124,111,240,0.15)', fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
        Build the flow on the canvas. Add nodes by right-clicking or using the toolbar. Use the tabs below to manage tools, models, and prompts.
      </div>

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
