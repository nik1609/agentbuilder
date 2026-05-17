'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Activity, CheckCircle, XCircle, Clock, Loader2, AlertCircle,
  Search, Bot, Trash2, HelpCircle, ChevronDown,
  LayoutDashboard, BarChart3, ThumbsUp, ThumbsDown, RotateCcw,
} from 'lucide-react'
import SectionLayout from '@/components/ui/SectionLayout'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function ConfirmModal({ title, message, danger = true, onConfirm, onCancel }: {
  title: string; message: string; danger?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onClick={onCancel} />
      <div style={{ position: 'relative', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px', maxWidth: 400, width: 'calc(100% - 48px)', boxShadow: 'var(--shadow-xl)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: danger ? 'var(--error)' : 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {danger ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

const DASHBOARD_NAV = [
  { href: '/dashboard', label: 'Overview',  icon: LayoutDashboard, match: (p: string) => p === '/dashboard' },
  { href: '/runs',      label: 'Runs',      icon: Activity,        match: (p: string) => p === '/runs' || p.startsWith('/runs/') },
]

interface Run {
  id: string; agent_id: string; agent_name: string; status: string
  tokens: number; latency_ms: number; cost_usd?: number; error?: string
  created_at: string; api_key_prefix?: string; input?: unknown; output?: unknown
}
interface Agent { id: string; name: string }

function formatCost(usd: number): string {
  if (usd <= 0) return '$0.00'
  if (usd < 0.001) return '<$0.001'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
    completed:       { color: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success-border)', icon: <CheckCircle size={11} />,   label: 'Completed' },
    failed:          { color: 'var(--error)',   bg: 'var(--error-bg)',   border: 'var(--error-border)',   icon: <XCircle size={11} />,       label: 'Failed' },
    running:         { color: 'var(--accent)',  bg: 'var(--accent-light)', border: 'var(--accent-border)', icon: <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />, label: 'Running' },
    waiting_hitl:    { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)', icon: <AlertCircle size={11} />,   label: 'Awaiting HITL' },
    waiting_clarify: { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)', icon: <HelpCircle size={11} />,    label: 'Needs Clarify' },
  }
  const cfg = map[status] ?? { color: 'var(--text3)', bg: 'var(--surface2)', border: 'var(--border)', icon: <Clock size={11} />, label: status }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

const STATUS_TABS = [
  { key: 'all',             label: 'All' },
  { key: 'completed',       label: 'Completed' },
  { key: 'failed',          label: 'Failed' },
  { key: 'running',         label: 'Running' },
  { key: 'waiting_hitl',    label: 'HITL' },
  { key: 'waiting_clarify', label: 'Clarify' },
]

export default function RunsPage() {
  const router = useRouter()
  const [runs, setRuns]             = useState<Run[]>([])
  const [agents, setAgents]         = useState<Agent[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('all')
  const [agentFilter, setAgent]     = useState('all')
  const [deleting, setDeleting]     = useState<Record<string, boolean>>({})
  const [hitlNotes, setHitlNotes]   = useState<Record<string, string>>({})
  const [hitlLoading, setHitlLoading] = useState<Record<string, 'approve' | 'revise' | 'reject' | undefined>>({})
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showCleanup, setShowCleanup] = useState(false)
  const cleanupRef = useRef<HTMLDivElement>(null)
  const [confirmModal, setConfirmModal] = useState<null | { title: string; message: string; onConfirm: () => void }>(null)

  const load = () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (statusFilter !== 'all') p.set('status', statusFilter)
    if (agentFilter !== 'all') p.set('agentId', agentFilter)
    fetch(`/api/runs?${p}`).then(r => r.json()).then(d => { setRuns(Array.isArray(d) ? d : []); setLoading(false) })
  }

  useEffect(() => { fetch('/api/agents').then(r => r.json()).then(d => setAgents(Array.isArray(d) ? d : [])) }, [])
  useEffect(() => { load() }, [statusFilter, agentFilter])

  // Close cleanup dropdown on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (cleanupRef.current && !cleanupRef.current.contains(e.target as Node)) setShowCleanup(false) }
    document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn)
  }, [])

  const filtered = runs.filter(r => !search || r.agent_name?.toLowerCase().includes(search.toLowerCase()) || r.id.includes(search))

  function deleteRun(runId: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    setConfirmModal({
      title: 'Delete run?',
      message: 'This will permanently remove all trace and output data for this run.',
      onConfirm: async () => {
        setConfirmModal(null)
        setDeleting(p => ({ ...p, [runId]: true }))
        await fetch(`/api/runs/${runId}`, { method: 'DELETE' })
        setRuns(r => r.filter(x => x.id !== runId))
        setSelected(s => { const n = new Set(s); n.delete(runId); return n })
        setDeleting(p => ({ ...p, [runId]: false }))
      },
    })
  }

  function deleteSelected() {
    if (!selected.size) return
    setConfirmModal({
      title: `Delete ${selected.size} run${selected.size > 1 ? 's' : ''}?`,
      message: 'This cannot be undone. All trace and output data for the selected runs will be permanently removed.',
      onConfirm: async () => {
        setConfirmModal(null); setBulkDeleting(true)
        await fetch(`/api/runs?ids=${[...selected].join(',')}`, { method: 'DELETE' })
        setRuns(r => r.filter(x => !selected.has(x.id)))
        setSelected(new Set()); setBulkDeleting(false)
      },
    })
  }

  async function hitlAction(runId: string, action: 'approve' | 'reject' | 'revise') {
    setHitlLoading(p => ({ ...p, [runId]: action }))
    const notes = hitlNotes[runId]?.trim()
    const body = action === 'reject'
      ? { approved: false, feedback: notes }
      : action === 'revise'
      ? { approved: false, action: 'revise', feedback: notes || undefined }
      : { approved: true, feedback: notes || undefined }
    await fetch(`/api/runs/${runId}/resume`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setHitlLoading(p => ({ ...p, [runId]: undefined }))
    setHitlNotes(p => { const n = { ...p }; delete n[runId]; return n })
    load()
  }

  function deleteOlderThan(days: number, status?: string) {
    setShowCleanup(false)
    const label = status ? `all ${status} runs older than ${days} days` : `all runs older than ${days} days`
    setConfirmModal({
      title: `Clean up ${label}?`,
      message: 'This cannot be undone. Matching runs and all their data will be permanently deleted.',
      onConfirm: async () => {
        setConfirmModal(null); setBulkDeleting(true)
        const p = new URLSearchParams({ olderThanDays: String(days) })
        if (status) p.set('status', status)
        if (agentFilter !== 'all') p.set('agentId', agentFilter)
        await fetch(`/api/runs?${p}`, { method: 'DELETE' })
        load(); setBulkDeleting(false)
      },
    })
  }

  function toggleSelect(runId: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    setSelected(s => { const n = new Set(s); n.has(runId) ? n.delete(runId) : n.add(runId); return n })
  }

  const COLS = '28px 1fr 130px 72px 80px 72px 90px 110px 32px'

  return (
    <SectionLayout nav={DASHBOARD_NAV}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 40px 20px' }}>
        {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 2 }}>Runs</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>
              {loading ? 'Loading…' : `${filtered.length} run${filtered.length !== 1 ? 's' : ''}${search ? ' matching search' : ''}`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Bulk delete bar */}
            {selected.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: 'var(--error-bg)', border: '1px solid var(--error-border)' }}>
                <span style={{ fontSize: 12, color: 'var(--error)', fontWeight: 600 }}>{selected.size} selected</span>
                <button onClick={deleteSelected} disabled={bulkDeleting} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--error)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: bulkDeleting ? 0.6 : 1 }}>
                  <Trash2 size={10} /> {bulkDeleting ? 'Deleting…' : 'Delete'}
                </button>
                <button onClick={() => setSelected(new Set())} style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
              </div>
            )}

            {/* Cleanup dropdown */}
            <div ref={cleanupRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowCleanup(v => !v)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '7px 13px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--card-bg)', color: 'var(--text2)', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              }}>
                <Trash2 size={12} /> Clean up <ChevronDown size={10} style={{ transform: showCleanup ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {showCleanup && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 6, minWidth: 210, boxShadow: 'var(--shadow-lg)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 6px' }}>By age</div>
                  {[7, 14, 30, 90].map(days => (
                    <button key={days} onClick={() => deleteOlderThan(days)} style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      Older than {days} days
                    </button>
                  ))}
                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                  <button onClick={() => deleteOlderThan(7, 'failed')} style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--error)', fontSize: 12, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--error-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    All failed runs (7d+)
                  </button>
                </div>
              )}
            </div>

            <button onClick={load} disabled={loading} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '7px 13px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--card-bg)', color: 'var(--text2)', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              opacity: loading ? 0.6 : 1,
            }}>
              <Activity size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> Refresh
            </button>
          </div>
        </div>

        {/* ── Filters ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexShrink: 0 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 160, maxWidth: 260 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by agent or run ID…"
              style={{ width: '100%', paddingLeft: 32, paddingRight: 12, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Agent filter */}
          {agents.length > 0 && (
            <div style={{ position: 'relative' }}>
              <Bot size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              <select value={agentFilter} onChange={e => setAgent(e.target.value)} style={{
                paddingLeft: 26, paddingRight: 24, height: 34, borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--card-bg)',
                color: 'var(--text2)', fontSize: 12, cursor: 'pointer', appearance: 'none', outline: 'none', minWidth: 140,
              }}>
                <option value="all">All Agents</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          {/* Status tabs */}
          <div style={{ display: 'flex', gap: 2, padding: '3px', borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            {STATUS_TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setStatus(key)} style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: statusFilter === key ? 600 : 500,
                background: statusFilter === key ? 'var(--primary)' : 'transparent',
                color: statusFilter === key ? 'var(--primary-fg)' : 'var(--text2)',
                transition: 'background 0.15s, color 0.15s',
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table — fills remaining height, rows scroll ─────── */}
        <div style={{ flex: 1, minHeight: 0, borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>

          {/* Table header — sticky */}
          <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length}
                onChange={() => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map(r => r.id))) }}
                style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
            </div>
            {['Agent', 'Status', 'Tokens', 'Latency', 'Cost', 'Source', 'Time', ''].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center' }}>{h}</span>
            ))}
          </div>

          {/* Rows — scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            [0, 1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: COLS, padding: '13px 20px', borderBottom: '1px solid var(--border2)', opacity: 1 - i * 0.1 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}><div style={{ width: 13, height: 13, borderRadius: 3, background: 'var(--surface2)' }} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center' }}>
                  <div style={{ height: 11, width: `${45 + i * 6}%`, borderRadius: 4, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                  <div style={{ height: 9, width: 55, borderRadius: 4, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}><div style={{ height: 22, width: 80, borderRadius: 6, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} /></div>
                {[36, 50, 44, 40, 70].map((w, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center' }}><div style={{ height: 10, width: w, borderRadius: 4, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} /></div>
                ))}
                <div />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Activity size={18} color="var(--text3)" />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No runs found</p>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>{search ? 'Try a different search term.' : 'Runs will appear here once you execute an agent.'}</p>
            </div>
          ) : filtered.map(run => (
            <div key={run.id}>
              <div style={{
                  display: 'grid', gridTemplateColumns: COLS,
                  padding: '12px 20px', borderBottom: '1px solid var(--border2)',
                  cursor: 'pointer', transition: 'background 0.1s',
                }}
                  onClick={() => router.push(`/runs/${run.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Checkbox */}
                  <div style={{ display: 'flex', alignItems: 'center' }} onClick={e => toggleSelect(run.id, e)}>
                    <input type="checkbox" checked={selected.has(run.id)} onChange={() => {}} style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
                  </div>

                  {/* Agent name + run ID */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{run.agent_name}</div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)' }}>{run.id.slice(0, 8)}…</div>
                  </div>

                  {/* Status */}
                  <div style={{ display: 'flex', alignItems: 'center' }}><StatusBadge status={run.status} /></div>

                  {/* Tokens */}
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text2)', fontFamily: 'monospace' }}>
                    {run.tokens > 0 ? (run.tokens > 999 ? `${(run.tokens / 1000).toFixed(1)}k` : run.tokens) : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </div>

                  {/* Latency */}
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text2)', fontFamily: 'monospace' }}>
                    {run.latency_ms > 0 ? `${run.latency_ms}ms` : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </div>

                  {/* Cost */}
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, fontFamily: 'monospace', color: run.cost_usd ? 'var(--success)' : 'var(--text3)' }}>
                    {run.cost_usd ? formatCost(run.cost_usd) : '—'}
                  </div>

                  {/* Source */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
                      background: run.api_key_prefix ? 'var(--accent-light)' : 'var(--surface2)',
                      color: run.api_key_prefix ? 'var(--accent)' : 'var(--text3)',
                      border: `1px solid ${run.api_key_prefix ? 'var(--accent-border)' : 'var(--border)'}`,
                    }}>
                      {run.api_key_prefix ? 'API' : 'Builder'}
                    </span>
                  </div>

                  {/* Time */}
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--text3)' }}>
                    {new Date(run.created_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>

                  {/* Delete */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button onClick={e => { e.stopPropagation(); deleteRun(run.id, e) }} disabled={deleting[run.id]} title="Delete run"
                      style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: deleting[run.id] ? 0.3 : 0.5, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

              {/* Clarify sub-row */}
              {run.status === 'waiting_clarify' && (
                <div style={{ padding: '9px 20px', background: 'var(--warning-bg)', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HelpCircle size={12} color="var(--warning)" />
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>Agent needs clarification to continue. Open the agent in Chat to respond.</span>
                </div>
              )}

              {/* HITL sub-row */}
              {run.status === 'waiting_hitl' && (() => {
                const out = run.output as { question?: string; partial?: string | Record<string, unknown> } | null
                const content = out?.partial ? (typeof out.partial === 'string' ? out.partial : JSON.stringify(out.partial, null, 2)) : null
                const instruction = out?.question ?? null
                return (
                  <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }} onClick={e => e.preventDefault()}>
                    <div style={{ padding: '12px 20px 14px', display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14, alignItems: 'start' }}>

                      {/* Left — content to review */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>Agent output to review</div>
                        {content ? (
                          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', maxHeight: 180, overflowY: 'auto' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                              p: ({ children }) => <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text)', lineHeight: 1.55 }}>{children}</p>,
                              h1: ({ children }) => <h1 style={{ fontSize: 14, fontWeight: 700, margin: '8px 0 4px' }}>{children}</h1>,
                              h2: ({ children }) => <h2 style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 3px' }}>{children}</h2>,
                              strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                              ul: ({ children }) => <ul style={{ margin: '3px 0 5px', paddingLeft: 16, fontSize: 12 }}>{children}</ul>,
                              li: ({ children }) => <li style={{ margin: '1px 0', color: 'var(--text)' }}>{children}</li>,
                              table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11, margin: '4px 0' }}>{children}</table>,
                              th: ({ children }) => <th style={{ border: '1px solid var(--border)', padding: '4px 7px', background: 'var(--surface2)', fontWeight: 700 }}>{children}</th>,
                              td: ({ children }) => <td style={{ border: '1px solid var(--border)', padding: '3px 7px' }}>{children}</td>,
                            }}>{content}</ReactMarkdown>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>No output to display.</div>
                        )}
                        {instruction && (
                          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text2)' }}>Instruction: </span>{instruction}
                          </div>
                        )}
                      </div>

                      {/* Right — notes + actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 0 }}>Your notes</div>
                        <textarea
                          value={hitlNotes[run.id] ?? ''}
                          onChange={e => setHitlNotes(p => ({ ...p, [run.id]: e.target.value }))}
                          placeholder="Notes for the agent (optional)…"
                          rows={3}
                          onClick={e => e.preventDefault()}
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {([
                            { action: 'approve' as const, label: 'Approve',          icon: <ThumbsUp size={11} />,  style: { border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontWeight: 600 } },
                            { action: 'revise'  as const, label: 'Request Revision', icon: <RotateCcw size={11} />, style: { border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontWeight: 500 } },
                            { action: 'reject'  as const, label: 'Reject',           icon: <ThumbsDown size={11} />,style: { border: '1px solid var(--error-border)', background: 'var(--error-bg)', color: 'var(--error)', fontWeight: 500 } },
                          ] as const).map(({ action, label, icon, style }) => {
                            const busy = hitlLoading[run.id] === action
                            const disabled = !!hitlLoading[run.id]
                            return (
                              <button key={action} onClick={e => { e.preventDefault(); hitlAction(run.id, action) }} disabled={disabled}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, fontSize: 12, cursor: disabled ? 'default' : 'pointer', opacity: disabled && !busy ? 0.35 : 1, transition: 'opacity 0.15s', ...style }}>
                                {busy ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : icon}
                                {busy ? 'Processing…' : label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          ))}
          </div>{/* end scrollable rows */}
        </div>{/* end table card */}

        <style>{`
          @keyframes dash-shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        `}</style>
      </div>
    </SectionLayout>
  )
}
