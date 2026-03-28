'use client'
import { useEffect, useState } from 'react'
import { BarChart3, CheckCircle, XCircle, Zap, Clock, TrendingUp, DollarSign } from 'lucide-react'

interface Run {
  id: string; agent_name: string; status: string; tokens: number
  latency_ms: number; cost_usd?: number; created_at: string; api_key_prefix: string; error?: string
}

function formatCost(usd: number): string {
  if (usd <= 0) return '$0.00'
  if (usd < 0.001) return '<$0.001'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

export default function AnalyticsPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/runs').then(r => r.text()).then(t => { const d = (() => { try { return JSON.parse(t) } catch { return [] } })()
      setRuns(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const completed = runs.filter(r => r.status === 'completed')
  const failed = runs.filter(r => r.status === 'failed')
  const successRate = runs.length ? Math.round((completed.length / runs.length) * 100) : 0
  const totalTokens = runs.reduce((s, r) => s + (r.tokens || 0), 0)
  const totalCost = runs.reduce((s, r) => s + (r.cost_usd || 0), 0)
  const avgLatency = completed.length
    ? Math.round(completed.reduce((s, r) => s + (r.latency_ms || 0), 0) / completed.length)
    : 0

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().split('T')[0]
    const count = runs.filter(r => r.created_at?.startsWith(key)).length
    return { date: key, count, label: d.toLocaleDateString('en', { weekday: 'short' }) }
  })
  const maxCount = Math.max(...last7.map(d => d.count), 1)

  const byAgent = Object.entries(
    runs.reduce((acc, r) => {
      if (!acc[r.agent_name]) acc[r.agent_name] = { runs: 0, tokens: 0, cost: 0, errors: 0 }
      acc[r.agent_name].runs++
      acc[r.agent_name].tokens += r.tokens || 0
      acc[r.agent_name].cost += r.cost_usd || 0
      if (r.status === 'failed') acc[r.agent_name].errors++
      return acc
    }, {} as Record<string, { runs: number; tokens: number; cost: number; errors: number }>)
  ).sort((a, b) => b[1].runs - a[1].runs)

  const stats = [
    { label: 'Total Runs', value: runs.length, icon: Zap, color: '#7c6ff0', bg: 'rgba(124,111,240,0.1)' },
    { label: 'Success Rate', value: `${successRate}%`, icon: CheckCircle, color: '#22d79a', bg: 'rgba(34,215,154,0.1)' },
    { label: 'Total Tokens', value: totalTokens > 999 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens, icon: BarChart3, color: '#b080f8', bg: 'rgba(176,128,248,0.1)' },
    { label: 'Est. Cost', value: formatCost(totalCost), icon: DollarSign, color: '#22d79a', bg: 'rgba(34,215,154,0.1)' },
    { label: 'Avg Latency', value: `${avgLatency}ms`, icon: Clock, color: '#f5a020', bg: 'rgba(245,160,32,0.1)' },
  ]

  return (
    <div style={{ padding: '48px', maxWidth: 1000, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>Analytics</h1>
        <p style={{ fontSize: 14, color: 'var(--text2)' }}>Usage across all agents and API keys</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 32 }}>
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} style={{ padding: 24, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
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

      {/* 7-day bar chart */}
      <div style={{ marginBottom: 24, padding: '28px 28px 20px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Runs — Last 7 Days</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
            <TrendingUp size={13} />
            {runs.length} total
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
          {last7.map(({ label, count }) => (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: count > 0 ? 'var(--text2)' : 'var(--text3)' }}>{count || ''}</span>
              <div style={{
                width: '100%', borderRadius: '6px 6px 0 0',
                height: `${Math.max((count / maxCount) * 110, count > 0 ? 8 : 3)}px`,
                background: count > 0 ? 'var(--blue)' : 'var(--border)',
                transition: 'height 0.3s ease',
              }} />
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom two cols */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* By agent */}
        <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>By Agent</span>
          </div>
          {loading ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
          ) : byAgent.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <BarChart3 size={28} style={{ color: 'var(--text3)', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>No runs yet</p>
            </div>
          ) : byAgent.map(([name, s]) => {
            const pct = runs.length ? (s.runs / runs.length) * 100 : 0
            return (
              <div key={name} style={{ padding: '14px 24px', borderBottom: '1px solid var(--border2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {s.cost > 0 && <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'monospace' }}>{formatCost(s.cost)}</span>}
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{s.tokens.toLocaleString()} tok</span>
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: 'var(--blue)' }}>{s.runs}</span>
                  </div>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: 'var(--surface2)' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: s.errors > 0 ? 'var(--red)' : 'var(--blue)', width: `${pct}%`, transition: 'width 0.4s' }} />
                </div>
                {s.errors > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--red)', marginTop: 4, display: 'block' }}>{s.errors} error{s.errors > 1 ? 's' : ''}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Recent errors */}
        <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Recent Errors</span>
          </div>
          {failed.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(34,215,154,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <CheckCircle size={22} color="var(--green)" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No errors</p>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>All runs completed successfully</p>
            </div>
          ) : failed.slice(0, 6).map(run => (
            <div key={run.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border2)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(232,85,85,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <XCircle size={13} color="var(--red)" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{run.agent_name}</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--red)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{run.error || 'Unknown error'}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{new Date(run.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
