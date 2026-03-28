'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, CheckCircle, XCircle, Clock, Loader2, AlertCircle, Filter, Search, Bot, Trash2, MessageSquare, HelpCircle, ChevronDown } from 'lucide-react'
import Link from 'next/link'

interface Run {
  id: string
  agent_id: string
  agent_name: string
  status: string
  tokens: number
  latency_ms: number
  cost_usd?: number
  error?: string
  created_at: string
  api_key_prefix?: string
  input?: unknown
  output?: unknown
}

interface Agent {
  id: string
  name: string
}

function formatCost(usd: number): string {
  if (usd <= 0) return '$0.00'
  if (usd < 0.001) return '<$0.001'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    completed: { color: '#22d79a', bg: 'rgba(34,215,154,0.12)', icon: <CheckCircle size={11} />, label: 'Completed' },
    failed: { color: '#e85555', bg: 'rgba(232,85,85,0.12)', icon: <XCircle size={11} />, label: 'Failed' },
    running: { color: '#7c6ff0', bg: 'rgba(124,111,240,0.12)', icon: <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />, label: 'Running' },
    waiting_hitl: { color: '#f5a020', bg: 'rgba(245,160,32,0.12)', icon: <AlertCircle size={11} />, label: 'Awaiting HITL' },
    waiting_clarify: { color: '#f472b6', bg: 'rgba(244,114,182,0.12)', icon: <HelpCircle size={11} />, label: 'Needs Clarify' },
  }
  const { color, bg, icon, label } = cfg[status] ?? { color: 'var(--text3)', bg: 'var(--surface2)', icon: <Clock size={11} />, label: status }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color, background: bg }}>
      {icon}{label}
    </span>
  )
}

export default function RunsPage() {
  const router = useRouter()
  const [runs, setRuns] = useState<Run[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showCleanup, setShowCleanup] = useState(false)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (agentFilter !== 'all') params.set('agentId', agentFilter)
    fetch(`/api/runs?${params}`).then(r => r.json()).then(d => {
      setRuns(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(d => setAgents(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => { load() }, [statusFilter, agentFilter])

  const filtered = runs.filter(r =>
    !search || r.agent_name?.toLowerCase().includes(search.toLowerCase()) || r.id.includes(search)
  )

  async function deleteRun(runId: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!confirm('Delete this run?')) return
    setDeleting(p => ({ ...p, [runId]: true }))
    await fetch(`/api/runs/${runId}`, { method: 'DELETE' })
    setRuns(r => r.filter(x => x.id !== runId))
    setSelected(s => { const n = new Set(s); n.delete(runId); return n })
    setDeleting(p => ({ ...p, [runId]: false }))
  }

  async function deleteSelected() {
    if (!selected.size) return
    if (!confirm(`Delete ${selected.size} selected run${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return
    setBulkDeleting(true)
    const ids = [...selected].join(',')
    await fetch(`/api/runs?ids=${ids}`, { method: 'DELETE' })
    setRuns(r => r.filter(x => !selected.has(x.id)))
    setSelected(new Set())
    setBulkDeleting(false)
  }

  async function deleteOlderThan(days: number, status?: string) {
    const label = status ? `all ${status} runs older than ${days} days` : `all runs older than ${days} days`
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return
    setShowCleanup(false)
    setBulkDeleting(true)
    const params = new URLSearchParams({ olderThanDays: String(days) })
    if (status) params.set('status', status)
    if (agentFilter !== 'all') params.set('agentId', agentFilter)
    await fetch(`/api/runs?${params}`, { method: 'DELETE' })
    load()
    setBulkDeleting(false)
  }

  function toggleSelect(runId: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    setSelected(s => { const n = new Set(s); n.has(runId) ? n.delete(runId) : n.add(runId); return n })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(r => r.id)))
  }

  const statuses = ['all', 'completed', 'failed', 'running', 'waiting_hitl', 'waiting_clarify']

  return (
    <div style={{ padding: '48px', maxWidth: 1100, margin: '0 auto' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>Runs</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>{runs.length} runs total</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Bulk delete bar — shown when rows are selected */}
          {selected.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: 'rgba(232,85,85,0.1)', border: '1px solid rgba(232,85,85,0.25)' }}>
              <span style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>{selected.size} selected</span>
              <button onClick={deleteSelected} disabled={bulkDeleting} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: bulkDeleting ? 0.6 : 1 }}>
                <Trash2 size={11} /> {bulkDeleting ? 'Deleting…' : 'Delete selected'}
              </button>
              <button onClick={() => setSelected(new Set())} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>Cancel</button>
            </div>
          )}

          {/* Cleanup dropdown */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowCleanup(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>
              <Trash2 size={13} /> Clean up <ChevronDown size={11} />
            </button>
            {showCleanup && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px', minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 8px' }}>Auto-clean by age</div>
                {[7, 14, 30, 90].map(days => (
                  <button key={days} onClick={() => deleteOlderThan(days)} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    Delete runs older than {days} days
                  </button>
                ))}
                <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 8px' }}>By status</div>
                <button onClick={() => deleteOlderThan(7, 'failed')} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--red)', fontSize: 13, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Delete all failed runs (7d+)
                </button>
              </div>
            )}
          </div>

          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>
            <Activity size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by agent or run ID…"
            style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {agents.length > 0 && (
          <div style={{ position: 'relative' }}>
            <Bot size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 9, paddingBottom: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', appearance: 'none', outline: 'none', minWidth: 160 }}
            >
              <option value="all">All Agents</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Filter size={13} style={{ color: 'var(--text3)', alignSelf: 'center', marginLeft: 6 }} />
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: statusFilter === s ? 'var(--blue)' : 'transparent',
              color: statusFilter === s ? '#fff' : 'var(--text2)',
              textTransform: 'capitalize',
            }}>
              {s === 'waiting_hitl' ? 'HITL' : s === 'waiting_clarify' ? 'Clarify' : s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 140px 80px 90px 90px 100px 120px 36px', gap: 0, padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleSelectAll} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
          </div>
          {['Agent', 'Status', 'Tokens', 'Latency', 'Cost', 'Source', 'Time', ''].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading runs…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <Activity size={28} style={{ color: 'var(--text3)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No runs found</p>
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>Runs will appear here once you execute an agent.</p>
          </div>
        ) : filtered.map(run => (
          <div key={run.id}>
            <Link href={`/runs/${run.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 140px 80px 90px 90px 100px 120px 36px',
                gap: 0, padding: '14px 24px',
                borderBottom: '1px solid var(--border2)',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center' }} onClick={e => toggleSelect(run.id, e)}>
                  <input type="checkbox" checked={selected.has(run.id)} onChange={() => {}} style={{ cursor: 'pointer', accentColor: 'var(--blue)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{run.agent_name}</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)' }}>{run.id.slice(0, 8)}…</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}><StatusBadge status={run.status} /></div>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text2)', fontFamily: 'monospace' }}>
                  {run.tokens > 0 ? (run.tokens > 999 ? `${(run.tokens / 1000).toFixed(1)}k` : run.tokens) : '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text2)', fontFamily: 'monospace' }}>
                  {run.latency_ms > 0 ? `${run.latency_ms}ms` : '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: run.cost_usd ? 'var(--green)' : 'var(--text3)', fontFamily: 'monospace' }}>
                  {run.cost_usd ? formatCost(run.cost_usd) : '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>
                  {run.api_key_prefix ? `key:${run.api_key_prefix}` : 'builder'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--text3)' }}>
                  {new Date(run.created_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={e => deleteRun(run.id, e)}
                    disabled={deleting[run.id]}
                    title="Delete run"
                    style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: deleting[run.id] ? 0.4 : 1 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </Link>

            {/* Paused run — Continue in Chat */}
            {(run.status === 'waiting_hitl' || run.status === 'waiting_clarify') && (
              <div style={{ padding: '10px 24px 12px', background: run.status === 'waiting_clarify' ? 'rgba(244,114,182,0.04)' : 'rgba(245,160,32,0.04)', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                {run.status === 'waiting_clarify'
                  ? <HelpCircle size={13} color="#f472b6" />
                  : <AlertCircle size={13} color="#f5a020" />}
                <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>
                  {run.status === 'waiting_clarify' ? 'Agent needs clarification to continue.' : 'Agent paused — awaiting human approval.'}
                </span>
                <Link
                  href={`/chat?resumeRunId=${run.id}&agentId=${run.agent_id}`}
                  onClick={e => e.stopPropagation()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}
                >
                  <MessageSquare size={12} /> Continue in Chat
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
