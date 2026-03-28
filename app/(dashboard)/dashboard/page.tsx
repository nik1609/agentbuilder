'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, Zap, BarChart3, KeyRound, Plus, ArrowRight, CheckCircle, XCircle, Clock, Sparkles, Loader2, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react'

interface Run {
  id: string; agent_name: string; status: string; tokens: number; latency_ms: number; created_at: string
}
interface Agent {
  id: string; name: string; run_count: number; updated_at: string; description: string
}
interface HitlRun {
  id: string; agent_name: string; created_at: string; approving?: boolean; rejecting?: boolean
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [hitlRuns, setHitlRuns] = useState<HitlRun[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [seedDone, setSeedDone] = useState(false)
  const [seedError, setSeedError] = useState('')

  const safeJson = (r: Response) => r.text().then(t => { try { return JSON.parse(t) } catch { return [] } })
  const loadData = () => Promise.all([
    fetch('/api/agents').then(safeJson),
    fetch('/api/runs').then(safeJson),
    fetch('/api/runs?status=waiting_hitl').then(safeJson),
  ]).then(([a, r, h]) => {
    setAgents(Array.isArray(a) ? a : [])
    setRuns(Array.isArray(r) ? r : [])
    setHitlRuns((Array.isArray(h) ? h : []).filter((x: Run) => x.status === 'waiting_hitl'))
    setLoading(false)
  })

  useEffect(() => { loadData() }, [])

  const hitlAction = async (runId: string, action: 'approve' | 'reject') => {
    setHitlRuns(prev => prev.map(r => r.id === runId ? { ...r, [action === 'approve' ? 'approving' : 'rejecting']: true } : r))
    await fetch(`/api/runs/${runId}/hitl/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setHitlRuns(prev => prev.filter(r => r.id !== runId))
  }

  const seedSamples = async () => {
    setSeeding(true)
    setSeedError('')
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.text().then(t => { try { return JSON.parse(t) } catch { return {} } })
      if (!res.ok) {
        setSeedError(data.error ?? `Seed failed (${res.status})`)
        setSeeding(false)
        return
      }
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : 'Network error')
      setSeeding(false)
      return
    }
    await loadData()
    setSeeding(false)
    setSeedDone(true)
    setTimeout(() => setSeedDone(false), 5000)
  }

  const totalRuns = runs.length
  const completedRuns = runs.filter(r => r.status === 'completed').length
  const totalTokens = runs.reduce((s, r) => s + (r.tokens || 0), 0)
  const avgLatency = runs.length ? Math.round(runs.reduce((s, r) => s + (r.latency_ms || 0), 0) / runs.length) : 0

  const stats = [
    { label: 'Total Agents', value: agents.length, icon: Bot, color: '#7c6ff0', bg: 'rgba(124,111,240,0.1)' },
    { label: 'Total Runs', value: totalRuns, icon: Zap, color: '#22d79a', bg: 'rgba(34,215,154,0.1)' },
    { label: 'Tokens Used', value: totalTokens > 1000 ? `${(totalTokens/1000).toFixed(1)}k` : totalTokens, icon: BarChart3, color: '#b080f8', bg: 'rgba(176,128,248,0.1)' },
    { label: 'Avg Latency', value: `${avgLatency}ms`, icon: Clock, color: '#f5a020', bg: 'rgba(245,160,32,0.1)' },
  ]

  return (
    <div style={{ padding: '48px 48px 48px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 48 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>Dashboard</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>Your agent activity at a glance</p>
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

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} style={{ padding: 24, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} color={color} />
              </div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)', letterSpacing: '-1px' }}>
              {loading ? <span style={{ color: 'var(--text3)' }}>—</span> : value}
            </div>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Agents */}
        <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Your Agents</span>
            <Link href="/agents" style={{ fontSize: 12, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
          ) : agents.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Bot size={28} style={{ color: 'var(--text3)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>No agents yet</p>
              <Link href="/agents/new" style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none' }}>Create your first agent →</Link>
            </div>
          ) : agents.slice(0, 5).map(agent => (
            <div key={agent.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--border2)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{agent.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{agent.run_count} runs</div>
              </div>
              <Link href={`/builder/${agent.id}`} style={{
                fontSize: 12, padding: '6px 14px', borderRadius: 8,
                border: '1px solid var(--border)', color: 'var(--text2)',
                background: 'var(--surface2)', textDecoration: 'none',
              }}>Open</Link>
            </div>
          ))}
        </div>

        {/* Recent Runs */}
        <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Recent Runs</span>
            <Link href="/runs" style={{ fontSize: 12, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
          ) : runs.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Zap size={28} style={{ color: 'var(--text3)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>No runs yet</p>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Run an agent from the builder to see activity</p>
            </div>
          ) : runs.slice(0, 6).map(run => (
            <Link key={run.id} href={`/runs/${run.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--border2)', textDecoration: 'none', transition: 'background 0.1s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface2)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {run.status === 'completed' ? <CheckCircle size={14} color="var(--green)" /> : run.status === 'failed' ? <XCircle size={14} color="var(--red)" /> : <Clock size={14} color="var(--orange)" />}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 1 }}>{run.agent_name}</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)' }}>{run.tokens} tokens · {run.latency_ms}ms</div>
                </div>
              </div>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)' }}>
                {new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* HITL Waiting */}
      {hitlRuns.length > 0 && (
        <div style={{ marginBottom: 24, borderRadius: 16, background: 'rgba(245,160,32,0.06)', border: '1px solid rgba(245,160,32,0.3)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 24px', borderBottom: '1px solid rgba(245,160,32,0.2)' }}>
            <MessageSquare size={15} color="var(--orange)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Awaiting Approval</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 6, background: 'rgba(245,160,32,0.15)', color: 'var(--orange)' }}>{hitlRuns.length}</span>
          </div>
          {hitlRuns.map(run => (
            <div key={run.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid rgba(245,160,32,0.1)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{run.agent_name}</div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)' }}>{new Date(run.created_at).toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => hitlAction(run.id, 'reject')}
                  disabled={run.approving || run.rejecting}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(232,85,85,0.4)', background: 'rgba(232,85,85,0.06)', color: 'var(--red)', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: run.rejecting ? 0.6 : 1 }}
                >
                  {run.rejecting ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <ThumbsDown size={12} />} Reject
                </button>
                <button
                  onClick={() => hitlAction(run.id, 'approve')}
                  disabled={run.approving || run.rejecting}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(34,215,154,0.4)', background: 'rgba(34,215,154,0.06)', color: 'var(--green)', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: run.approving ? 0.6 : 1 }}
                >
                  {run.approving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <ThumbsUp size={12} />} Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', padding: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Quick Actions</p>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { href: '/agents/new', icon: Bot, label: 'Build New Agent', color: '#7c6ff0', bg: 'rgba(124,111,240,0.08)' },
            { href: '/api-keys', icon: KeyRound, label: 'Manage API Keys', color: '#22d79a', bg: 'rgba(34,215,154,0.08)' },
            { href: '/docs', icon: BarChart3, label: 'View Docs', color: '#b080f8', bg: 'rgba(176,128,248,0.08)' },
          ].map(({ href, icon: Icon, label, color, bg }) => (
            <Link key={href} href={href} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px 20px', borderRadius: 12,
              border: '1px solid var(--border)', background: bg,
              color: 'var(--text2)', fontSize: 13, fontWeight: 500, textDecoration: 'none',
            }}>
              <Icon size={14} color={color} />{label}
            </Link>
          ))}
          <button onClick={seedSamples} disabled={seeding || seedDone} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px', borderRadius: 12,
            border: '1px solid var(--border)', background: seeding || seedDone ? 'rgba(245,160,32,0.08)' : 'transparent',
            color: seedDone ? 'var(--green)' : 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            opacity: seeding ? 0.7 : 1,
          }}>
            {seeding ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} color="#f5a020" />}
            {seedDone ? '3 Agents Added!' : 'Load Samples'}
          </button>
        </div>
      </div>
      {seedError && (
        <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--red)', fontSize: 12 }}>
          <strong>Seed failed:</strong> {seedError}
        </div>
      )}
      {seedDone && (
        <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(34,215,154,0.08)', border: '1px solid rgba(34,215,154,0.3)', color: 'var(--green)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          3 sample agents created. <Link href="/agents" style={{ color: 'var(--green)', fontWeight: 600, textDecoration: 'underline' }}>View agents →</Link>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
