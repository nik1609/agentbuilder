'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Bot, Zap, BarChart3, ArrowRight,
  CheckCircle, MessageSquare, ThumbsUp, ThumbsDown,
  LayoutDashboard, Activity, Timer, Layers, Loader2,
} from 'lucide-react'
import SectionLayout from '@/components/ui/SectionLayout'

const DASHBOARD_NAV = [
  { href: '/dashboard', label: 'Overview',  icon: LayoutDashboard, match: (p: string) => p === '/dashboard' },
  { href: '/runs',      label: 'Runs',      icon: Activity,        match: (p: string) => p === '/runs' || p.startsWith('/runs/') },
]

interface Run {
  id: string; agent_name: string; status: string; tokens: number; latency_ms: number; created_at: string
}
interface Agent {
  id: string; name: string; run_count: number; updated_at: string; description: string
}
interface HitlRun {
  id: string; agent_name: string; created_at: string; approving?: boolean; rejecting?: boolean
}

function Shimmer({ w, h, r = 6 }: { w: number | string; h: number; r?: number }) {
  return <span style={{ display: 'inline-block', width: w, height: h, borderRadius: r, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
}

function StatusDot({ status }: { status: string }) {
  const c = status === 'completed' ? 'var(--success)' : status === 'failed' ? 'var(--error)' : 'var(--warning)'
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />
}

function buildChartData(runs: Run[]) {
  const days: { label: string; date: string; completed: number; failed: number; other: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    days.push({ label: i === 0 ? 'Today' : d.toLocaleDateString('en', { weekday: 'short' }), date: d.toDateString(), completed: 0, failed: 0, other: 0 })
  }
  for (const r of runs) {
    const d = new Date(r.created_at); d.setHours(0, 0, 0, 0)
    const slot = days.find(s => s.date === d.toDateString())
    if (!slot) continue
    if (r.status === 'completed') slot.completed++
    else if (r.status === 'failed') slot.failed++
    else slot.other++
  }
  return days
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = (payload[0]?.value ?? 0) + (payload[1]?.value ?? 0) + (payload[2]?.value ?? 0)
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>{label}</div>
      <div style={{ color: 'var(--text3)', marginBottom: 4 }}>{total} run{total !== 1 ? 's' : ''}</div>
      {payload[0]?.value > 0 && <div style={{ color: 'var(--success)', fontSize: 11 }}>✓ {payload[0].value} completed</div>}
      {payload[1]?.value > 0 && <div style={{ color: 'var(--error)', fontSize: 11 }}>✗ {payload[1].value} failed</div>}
      {payload[2]?.value > 0 && <div style={{ color: 'var(--warning)', fontSize: 11 }}>◌ {payload[2].value} other</div>}
    </div>
  )
}

export default function DashboardPage() {
  const [agents, setAgents]     = useState<Agent[]>([])
  const [runs, setRuns]         = useState<Run[]>([])
  const [hitlRuns, setHitlRuns] = useState<HitlRun[]>([])
  const [loading, setLoading]   = useState(true)

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

  const totalTokens   = runs.reduce((s, r) => s + (r.tokens || 0), 0)
  const avgLatency    = runs.length ? Math.round(runs.reduce((s, r) => s + (r.latency_ms || 0), 0) / runs.length) : 0
  const successRate   = runs.length ? Math.round((runs.filter(r => r.status === 'completed').length / runs.length) * 100) : 0
  const tokenDisplay  = totalTokens >= 1_000_000 ? `${(totalTokens / 1_000_000).toFixed(1)}M` : totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : String(totalTokens)
  const chartData     = buildChartData(runs)

  const stats = [
    { label: 'Agents',       value: agents.length,                            icon: Layers,       iconColor: '#6B7280', iconBg: 'rgba(107,114,128,0.12)' },
    { label: 'Total Runs',   value: runs.length,                              icon: Zap,          iconColor: '#3B82F6', iconBg: 'rgba(59,130,246,0.12)'  },
    { label: 'Tokens Used',  value: tokenDisplay,                             icon: Bot,          iconColor: '#8B5CF6', iconBg: 'rgba(139,92,246,0.12)'  },
    { label: 'Success Rate', value: `${successRate}%`,                        icon: CheckCircle,  iconColor: '#22C55E', iconBg: 'rgba(34,197,94,0.12)'   },
    { label: 'Avg Latency',  value: avgLatency ? `${avgLatency}ms` : '—',    icon: Timer,        iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,0.12)'  },
  ]

  return (
    <SectionLayout nav={DASHBOARD_NAV}>
      {/* Full-height, no page scroll — cards scroll internally */}
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 36px 20px' }}>

        {/* ── Header ─────────────────────────────────── */}
        <div style={{ flexShrink: 0, marginBottom: 18, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 2 }}>Dashboard</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>Your agent activity at a glance</p>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>
            Stats based on last 100 runs
          </span>
        </div>

        {/* ── 5 Stat cards ───────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, flexShrink: 0, marginBottom: 14 }}>
          {stats.map(({ label, value, icon: Icon, iconColor, iconBg }) => (
            <div key={label} style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={12} color={iconColor} strokeWidth={1.75} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {loading ? <Shimmer w={52} h={20} /> : value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Activity chart ──────────────────────────── */}
        <div style={{ flexShrink: 0, borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Run Activity</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>Last 7 days</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {[{ c: '#16A34A', l: 'Completed' }, { c: '#DC2626', l: 'Failed' }, { c: '#D97706', l: 'Other' }].map(({ c, l }) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: c, display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          {loading ? (
            <div style={{ height: 96, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              {[35, 60, 45, 80, 40, 70, 55].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 4, background: 'var(--surface2)', animation: `dash-shimmer 1.4s ease-in-out ${i * 0.08}s infinite` }} />
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={96}>
              <BarChart data={chartData} barSize={18} barGap={1} barCategoryGap="30%">
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'inherit' }} />
                <YAxis hide allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface)' }} />
                <Bar dataKey="completed" stackId="a" fill="#16A34A" fillOpacity={0.85} radius={[0, 0, 0, 0]} />
                <Bar dataKey="failed"    stackId="a" fill="#DC2626" fillOpacity={0.85} radius={[0, 0, 0, 0]} />
                <Bar dataKey="other"     stackId="a" fill="#D97706" fillOpacity={0.75} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Three scrollable columns — fills remaining height ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

          {/* Your Agents */}
          <div style={{ borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Your Agents</span>
              <Link href="/agents" style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none', fontWeight: 500 }}>
                View all <ArrowRight size={10} />
              </Link>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {loading ? (
                [0, 1, 2, 3, 4].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border2)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><Shimmer w={88 + i * 8} h={10} /><Shimmer w={36} h={8} /></div>
                    <Shimmer w={38} h={22} r={6} />
                  </div>
                ))
              ) : agents.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                    <Bot size={14} color="var(--text3)" />
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 3 }}>No agents yet</p>
                  <Link href="/build" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>Build your first →</Link>
                </div>
              ) : agents.map((agent, idx) => (
                <div key={agent.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderBottom: '1px solid var(--border2)',
                  transition: 'background 0.1s', cursor: 'default',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{agent.run_count} {agent.run_count === 1 ? 'run' : 'runs'}</div>
                  </div>
                  <Link href={`/builder/${agent.id}`} style={{
                    fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 6,
                    border: '1px solid var(--border)', color: 'var(--text2)', background: 'var(--card-bg)',
                    textDecoration: 'none', flexShrink: 0, marginLeft: 8,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text3)'; e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
                  >Open</Link>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Runs */}
          <div style={{ borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Recent Runs</span>
              <Link href="/runs" style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none', fontWeight: 500 }}>
                View all <ArrowRight size={10} />
              </Link>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {loading ? (
                [0, 1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid var(--border2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Shimmer w={7} h={7} r={99} /><div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><Shimmer w={70 + i * 7} h={10} /><Shimmer w={46} h={8} /></div></div>
                    <Shimmer w={26} h={8} />
                  </div>
                ))
              ) : runs.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                    <Zap size={14} color="var(--text3)" />
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 3 }}>No runs yet</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)' }}>Run an agent to see activity</p>
                </div>
              ) : runs.map((run, idx) => (
                <Link key={run.id} href={`/runs/${run.id}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 16px', borderBottom: '1px solid var(--border2)',
                  textDecoration: 'none', transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <StatusDot status={run.status} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{run.agent_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{run.tokens} tok · {run.latency_ms}ms</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', flexShrink: 0, marginLeft: 8 }}>
                    {new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Awaiting Approval */}
          <div style={{ borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Awaiting Approval</span>
              {!loading && hitlRuns.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99, background: 'rgba(217,119,6,0.12)', color: 'var(--warning)', marginLeft: 'auto' }}>
                  {hitlRuns.length}
                </span>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {loading ? (
                [0, 1, 2].map(i => (
                  <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border2)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}><Shimmer w={88 + i * 10} h={10} /><Shimmer w={60} h={8} /></div>
                    <div style={{ display: 'flex', gap: 5 }}><Shimmer w="50%" h={24} r={6} /><Shimmer w="50%" h={24} r={6} /></div>
                  </div>
                ))
              ) : hitlRuns.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                    <MessageSquare size={14} color="var(--text3)" />
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 3 }}>All clear</p>
                  <p style={{ fontSize: 11, color: 'var(--text3)' }}>No runs awaiting review</p>
                </div>
              ) : hitlRuns.map((run, idx) => (
                <div key={run.id} style={{ padding: '10px 16px', borderBottom: idx < hitlRuns.length - 1 ? '1px solid var(--border2)' : 'none' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{run.agent_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', marginBottom: 8 }}>{new Date(run.created_at).toLocaleString()}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => hitlAction(run.id, 'reject')} disabled={run.approving || run.rejecting} style={{
                      flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      padding: '5px 0', borderRadius: 6, border: '1px solid var(--error-border)', background: 'var(--error-bg)',
                      color: 'var(--error)', fontSize: 11, fontWeight: 500, cursor: 'pointer', opacity: run.rejecting ? 0.6 : 1,
                    }}>
                      {run.rejecting ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <ThumbsDown size={10} />} Reject
                    </button>
                    <button onClick={() => hitlAction(run.id, 'approve')} disabled={run.approving || run.rejecting} style={{
                      flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      padding: '5px 0', borderRadius: 6, border: '1px solid var(--success-border)', background: 'var(--success-bg)',
                      color: 'var(--success)', fontSize: 11, fontWeight: 500, cursor: 'pointer', opacity: run.approving ? 0.6 : 1,
                    }}>
                      {run.approving ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <ThumbsUp size={10} />} Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes dash-shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>
    </SectionLayout>
  )
}
