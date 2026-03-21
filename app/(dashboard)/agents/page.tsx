'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, Plus, Trash2, ExternalLink, Copy, CheckCircle, Zap, Download } from 'lucide-react'

interface Agent {
  id: string; name: string; description: string; version: number
  run_count: number; updated_at: string; created_at: string
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(d => {
      setAgents(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const copyEndpoint = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/api/agents/${id}/run`)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const downloadPostman = (agent: Agent) => {
    const baseUrl = window.location.origin
    const collection = {
      info: {
        _postman_id: agent.id,
        name: agent.name,
        description: `AgentHub — ${agent.name}\n\n${agent.description || ''}\n\nEndpoint: POST ${baseUrl}/api/agents/${agent.id}/run`,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      variable: [
        { key: 'baseUrl', value: baseUrl,   type: 'string' },
        { key: 'agentId', value: agent.id,  type: 'string' },
        { key: 'apiKey',  value: 'test',    type: 'string', description: 'Use "test" for local testing, or replace with a real key from the API Keys page' },
        { key: 'runId',   value: '',        type: 'string', description: 'Paste the runId from the Run Agent response here (needed for HITL resume)' },
      ],
      item: [
        {
          name: '1. Run Agent',
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type',   value: 'application/json' },
              { key: 'X-AgentHub-Key', value: '{{apiKey}}' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ message: 'Hello! What can you help me with?' }, null, 2),
              options: { raw: { language: 'json' } },
            },
            url: {
              raw: '{{baseUrl}}/api/agents/{{agentId}}/run',
              host: ['{{baseUrl}}'],
              path: ['api', 'agents', '{{agentId}}', 'run'],
            },
            description: 'Runs the agent. If status is "waiting_hitl", use request #2 or #3 to resume.',
          },
        },
        {
          name: '2. Resume HITL (Approve)',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'X-AgentHub-Key', value: '{{apiKey}}' }],
            body: { mode: 'raw', raw: JSON.stringify({ feedback: '' }, null, 2), options: { raw: { language: 'json' } } },
            url: { raw: '{{baseUrl}}/api/runs/{{runId}}/resume', host: ['{{baseUrl}}'], path: ['api', 'runs', '{{runId}}', 'resume'] },
            description: 'Approves a paused HITL step. Set {{runId}} from the Run Agent response.',
          },
        },
        {
          name: '3. Resume HITL (With Feedback)',
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'X-AgentHub-Key', value: '{{apiKey}}' }],
            body: { mode: 'raw', raw: JSON.stringify({ feedback: 'Please make the response more concise' }, null, 2), options: { raw: { language: 'json' } } },
            url: { raw: '{{baseUrl}}/api/runs/{{runId}}/resume', host: ['{{baseUrl}}'], path: ['api', 'runs', '{{runId}}', 'resume'] },
            description: 'Resumes with reviewer notes — the agent revises based on your feedback.',
          },
        },
        {
          name: '4. Stream Run (SSE)',
          request: {
            method: 'GET',
            header: [{ key: 'X-AgentHub-Key', value: '{{apiKey}}' }],
            url: {
              raw: `{{baseUrl}}/api/agents/{{agentId}}/run?message=Hello`,
              host: ['{{baseUrl}}'], path: ['api', 'agents', '{{agentId}}', 'run'],
              query: [{ key: 'message', value: 'Hello' }],
            },
            description: 'Real-time SSE stream. Events: start → trace (per node) → done.',
          },
        },
      ],
    }
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${agent.name.replace(/[^a-z0-9]/gi, '_')}_postman.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const deleteAgent = async (id: string) => {
    if (!confirm('Delete this agent? This cannot be undone.')) return
    await fetch(`/api/agents/${id}`, { method: 'DELETE' })
    setAgents(a => a.filter(x => x.id !== id))
  }

  return (
    <div style={{ padding: '48px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 48 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>Agents</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>
            {loading ? 'Loading…' : `${agents.length} agent${agents.length !== 1 ? 's' : ''} · each deployed as a live API endpoint`}
          </p>
        </div>
        <Link href="/agents/new" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 20px', borderRadius: 12,
          background: 'var(--blue)', color: '#fff',
          fontSize: 14, fontWeight: 600, textDecoration: 'none',
        }}>
          <Plus size={15} /> New Agent
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text3)', fontSize: 14 }}>Loading agents…</div>
      ) : agents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(124,111,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Bot size={28} color="var(--blue)" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>No agents yet</h3>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 28, lineHeight: 1.6 }}>
            Build your first agent visually and it will<br />be instantly deployed as a REST API.
          </p>
          <Link href="/agents/new" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', borderRadius: 12,
            background: 'var(--blue)', color: '#fff',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            <Plus size={15} /> Build your first agent
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {agents.map(agent => (
            <div key={agent.id} style={{ padding: '24px 28px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 20 }}>
              {/* Icon */}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(124,111,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={20} color="var(--blue)" />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{agent.name}</span>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                    v{agent.version}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                  {agent.description || 'No description'}
                </p>
                {/* Endpoint */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => copyEndpoint(agent.id)}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', fontFamily: 'monospace' }}>POST</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)' }}>
                    /api/agents/{agent.id.slice(0, 8)}…/run
                  </span>
                  {copied === agent.id ? <CheckCircle size={11} color="var(--green)" /> : <Copy size={11} color="var(--text3)" />}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: 'var(--surface2)' }}>
                  <Zap size={11} color="var(--text3)" />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{agent.run_count}</span>
                </div>
                <button
                  onClick={() => downloadPostman(agent)}
                  title="Download Postman collection"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--surface2)',
                    color: 'var(--text2)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}>
                  <Download size={12} /> Postman
                </button>
                <Link href={`/builder/${agent.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--surface2)',
                  color: 'var(--text2)', fontSize: 12, fontWeight: 500, textDecoration: 'none',
                }}>
                  <ExternalLink size={12} /> Open Builder
                </Link>
                <button onClick={() => deleteAgent(agent.id)} style={{
                  width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--red)',
                }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
