'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2, AlertCircle, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, Brain, Wrench, GitBranch, Repeat, GitMerge, ToggleLeft, UserCheck, ArrowRight, RotateCcw, Trash2, MessageSquare, HelpCircle } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TraceEvent {
  ts: number
  type: string
  nodeId?: string
  message: string
  data?: Record<string, unknown>
}

interface TraceStep {
  nodeId: string
  nodeType?: string
  label?: string
  status: string
  input?: unknown
  output?: unknown
  error?: string
  tokens?: number
  latencyMs?: number
}

function eventsToSteps(events: TraceEvent[]): TraceStep[] {
  const steps: TraceStep[] = []
  const started = new Map<string, { ts: number; data?: Record<string, unknown> }>()
  for (const ev of events) {
    if (ev.type === 'node_start' && ev.nodeId) {
      started.set(ev.nodeId, { ts: ev.ts, data: ev.data })
    } else if (ev.type === 'node_done' && ev.nodeId) {
      const start = started.get(ev.nodeId)
      const sd = start?.data
      const dd = ev.data
      steps.push({
        nodeId: ev.nodeId,
        nodeType: (sd?.nodeType ?? dd?.nodeType) as string | undefined,
        label: (sd?.label ?? dd?.label) as string | undefined,
        status: 'completed',
        input: sd?.input,
        output: dd?.output,
        tokens: dd?.tokens as number | undefined,
        latencyMs: start ? Math.round(ev.ts - start.ts) : undefined,
      })
    } else if (ev.type === 'error' && ev.nodeId) {
      const start = started.get(ev.nodeId)
      const sd = start?.data
      steps.push({
        nodeId: ev.nodeId,
        nodeType: sd?.nodeType as string | undefined,
        label: sd?.label as string | undefined,
        status: 'failed',
        input: sd?.input,
        error: ev.message,
        latencyMs: start ? Math.round(ev.ts - start.ts) : undefined,
      })
    }
  }
  // Include any started-but-not-done nodes (e.g. HITL paused)
  for (const [nodeId, { ts, data: sd }] of started) {
    if (!steps.find(s => s.nodeId === nodeId)) {
      steps.push({
        nodeId,
        nodeType: sd?.nodeType as string | undefined,
        label: sd?.label as string | undefined,
        status: 'waiting_hitl',
        input: sd?.input,
        latencyMs: undefined,
      })
    }
  }
  return steps
}

interface Run {
  id: string
  agent_id: string
  agent_name: string
  status: string
  tokens: number
  latency_ms: number
  cost_usd?: number
  error?: string
  trace?: TraceEvent[]
  input?: unknown
  output?: unknown
  created_at: string
  api_key_prefix?: string
}

function formatCost(usd: number): string {
  if (usd <= 0) return '$0.00'
  if (usd < 0.001) return '<$0.001'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

function StatusBadge({ status, large }: { status: string; large?: boolean }) {
  const cfg: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
    completed: { color: '#22d79a', bg: 'rgba(34,215,154,0.12)', icon: <CheckCircle size={large ? 14 : 11} />, label: 'Completed' },
    failed: { color: '#e85555', bg: 'rgba(232,85,85,0.12)', icon: <XCircle size={large ? 14 : 11} />, label: 'Failed' },
    running: { color: '#7c6ff0', bg: 'rgba(124,111,240,0.12)', icon: <Loader2 size={large ? 14 : 11} style={{ animation: 'spin 1s linear infinite' }} />, label: 'Running' },
    waiting_hitl: { color: '#f5a020', bg: 'rgba(245,160,32,0.12)', icon: <AlertCircle size={large ? 14 : 11} />, label: 'Awaiting HITL' },
  }
  const s = large ? 13 : 11
  const { color, bg, icon, label } = cfg[status] ?? { color: 'var(--text3)', bg: 'var(--surface2)', icon: <Clock size={s} />, label: status }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: s, fontWeight: 600, padding: large ? '5px 12px' : '3px 8px', borderRadius: 8, color, background: bg }}>
      {icon}{label}
    </span>
  )
}

const NODE_TYPE_ICONS: Record<string, React.ReactNode> = {
  llm: <Brain size={13} color="#7c6ff0" />,
  tool: <Wrench size={13} color="#26c6da" />,
  condition: <GitBranch size={13} color="#22d79a" />,
  loop: <Repeat size={13} color="#f5a020" />,
  fork: <GitBranch size={13} color="#b080f8" />,
  join: <GitMerge size={13} color="#26c6da" />,
  switch: <ToggleLeft size={13} color="#ffd600" />,
  hitl: <UserCheck size={13} color="#f5a020" />,
  passthrough: <ArrowRight size={13} color="var(--text3)" />,
}

function OutputBlock({ value }: { value: unknown }) {
  if (value === undefined || value === null) return <span style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: 12 }}>null</span>
  if (typeof value === 'string') {
    return (
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', maxHeight: 400, overflow: 'auto' }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
            h1: ({ children }) => <h1 style={{ fontSize: 16, fontWeight: 700, margin: '10px 0 6px' }}>{children}</h1>,
            h2: ({ children }) => <h2 style={{ fontSize: 14, fontWeight: 700, margin: '10px 0 6px' }}>{children}</h2>,
            h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 700, margin: '8px 0 4px' }}>{children}</h3>,
            strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
            ul: ({ children }) => <ul style={{ margin: '4px 0 8px', paddingLeft: 20, listStyleType: 'disc' }}>{children}</ul>,
            ol: ({ children }) => <ol style={{ margin: '4px 0 8px', paddingLeft: 20 }}>{children}</ol>,
            li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
            code: ({ children }) => <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>{children}</code>,
            pre: ({ children }) => <pre style={{ margin: '6px 0', background: 'var(--bg)', borderRadius: 6, padding: '10px 12px', overflowX: 'auto', fontSize: 12 }}>{children}</pre>,
            table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, margin: '8px 0' }}>{children}</table>,
            th: ({ children }) => <th style={{ border: '1px solid var(--border)', padding: '6px 10px', textAlign: 'left', background: 'var(--surface)', fontWeight: 700 }}>{children}</th>,
            td: ({ children }) => <td style={{ border: '1px solid var(--border)', padding: '5px 10px' }}>{children}</td>,
          }}
        >{value}</ReactMarkdown>
      </div>
    )
  }
  return (
    <pre style={{ margin: 0, fontSize: 12, fontFamily: 'monospace', color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', maxHeight: 300, overflow: 'auto' }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function TraceCard({ step, index }: { step: TraceStep; index: number }) {
  const [open, setOpen] = useState(false)
  const isErr = step.status === 'error' || step.status === 'failed'

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${isErr ? 'rgba(232,85,85,0.3)' : 'var(--border)'}`, background: isErr ? 'rgba(232,85,85,0.04)' : 'var(--surface)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)', minWidth: 20 }}>{index + 1}</span>
        {NODE_TYPE_ICONS[step.nodeType ?? ''] ?? <div style={{ width: 13 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: isErr ? '#e85555' : 'var(--text)' }}>{step.label ?? step.nodeId}</span>
            {step.nodeType && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', textTransform: 'uppercase' }}>{step.nodeType}</span>}
          </div>
          {isErr && step.error && (
            <div style={{ fontSize: 11, color: '#e85555', fontFamily: 'monospace', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.error}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {step.tokens != null && step.tokens > 0 && <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{step.tokens} tok</span>}
          {step.latencyMs != null && step.latencyMs > 0 && <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{step.latencyMs}ms</span>}
          <StatusBadge status={step.status} />
          {open ? <ChevronDown size={14} style={{ color: 'var(--text3)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text3)' }} />}
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border2)' }}>
          <div style={{ paddingTop: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Input</p>
            <OutputBlock value={step.input} />
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Output</p>
            <OutputBlock value={step.output} />
          </div>
          {step.error && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#e85555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Error</p>
              <pre style={{ margin: 0, fontSize: 12, fontFamily: 'monospace', color: '#e85555', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'rgba(232,85,85,0.08)', borderRadius: 8, padding: '10px 14px' }}>{step.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const router = useRouter()
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [hitlDone, setHitlDone] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = (attempt = 0) => {
    fetch(`/api/runs/${runId}`).then(r => r.json()).then(d => {
      if (d.error === 'Unauthorized' && attempt < 2) {
        // Auth cookie may not be set yet — retry after short delay
        setTimeout(() => load(attempt + 1), 600)
        return
      }
      setRun(d.error ? null : d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [runId])

  async function rerun() {
    if (!run) return
    setRerunning(true)
    const msg = typeof run.input === 'string' ? run.input : (run.input as Record<string, unknown>)?.message ?? JSON.stringify(run.input)
    const res = await fetch(`/api/agents/${run.agent_id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    }).then(r => r.json()).catch(() => null)
    setRerunning(false)
    if (res?.runId) router.push(`/runs/${res.runId}`)
  }

  async function doHitl(action: 'approve' | 'reject') {
    setHitlDone(true)
    await fetch(`/api/runs/${runId}/hitl/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setTimeout(load, 800)
  }

  async function deleteRun() {
    if (!confirm('Delete this run? This cannot be undone.')) return
    setDeleting(true)
    await fetch(`/api/runs/${runId}`, { method: 'DELETE' })
    router.push('/runs')
  }

  if (loading) return (
    <div style={{ padding: 48, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)', fontSize: 14 }}>
      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading run…
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!run) return (
    <div style={{ padding: 48 }}>
      <Link href="/runs" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text3)', textDecoration: 'none', marginBottom: 24 }}>
        <ArrowLeft size={14} /> Back to Runs
      </Link>
      <p style={{ color: 'var(--text3)', fontSize: 14 }}>Run not found. It may belong to a different account or have been deleted.</p>
      <button onClick={() => { setLoading(true); load() }} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>Retry</button>
    </div>
  )

  const trace = eventsToSteps(Array.isArray(run.trace) ? run.trace as TraceEvent[] : [])

  return (
    <div style={{ padding: '48px', maxWidth: 900, margin: '0 auto' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Back */}
      <Link href="/runs" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text3)', textDecoration: 'none', marginBottom: 28 }}>
        <ArrowLeft size={14} /> Back to Runs
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', margin: '0 0 8px' }}>{run.agent_name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <StatusBadge status={run.status} large />
          </div>
          <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text3)' }}>Run ID: {run.id}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 24 }}>
          {(run.status === 'waiting_hitl' || run.status === 'waiting_clarify') ? (
            <Link href={`/chat?resumeRunId=${run.id}&agentId=${run.agent_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(124,111,240,0.4)', background: 'rgba(124,111,240,0.1)', color: 'var(--blue)', textDecoration: 'none', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
              <MessageSquare size={14} /> Continue in Chat
            </Link>
          ) : (
            <Link href={`/chat?agentId=${run.agent_id}&viewRunId=${run.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', textDecoration: 'none', fontSize: 13, whiteSpace: 'nowrap' }}>
              <MessageSquare size={14} /> Open in Chat
            </Link>
          )}
          <button onClick={rerun} disabled={rerunning} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', opacity: rerunning ? 0.6 : 1, whiteSpace: 'nowrap' }}>
            {rerunning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={14} />}
            Re-run
          </button>
          <Link href={`/builder/${run.agent_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', textDecoration: 'none', fontSize: 13, whiteSpace: 'nowrap' }}>
            Open in Builder
          </Link>
          <button onClick={deleteRun} disabled={deleting} title="Delete run" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(232,85,85,0.3)', background: 'rgba(232,85,85,0.08)', color: '#e85555', fontSize: 13, cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        {[
          { label: 'Tokens', value: run.tokens > 0 ? run.tokens.toLocaleString() : '—' },
          { label: 'Latency', value: run.latency_ms > 0 ? `${run.latency_ms}ms` : '—' },
          { label: 'Est. Cost', value: run.cost_usd ? formatCost(run.cost_usd) : '—' },
          { label: 'Time', value: new Date(run.created_at).toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* HITL action banner */}
      {run.status === 'waiting_hitl' && !hitlDone && (
        <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 12, background: 'rgba(245,160,32,0.08)', border: '1px solid rgba(245,160,32,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertCircle size={16} color="#f5a020" />
          <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>This run is paused and waiting for your approval to continue.</span>
          <button onClick={() => doHitl('approve')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'rgba(34,215,154,0.15)', color: '#22d79a', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <ThumbsUp size={13} /> Approve
          </button>
          <button onClick={() => doHitl('reject')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'rgba(232,85,85,0.12)', color: '#e85555', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <ThumbsDown size={13} /> Reject
          </button>
        </div>
      )}

      {/* Error banner */}
      {run.status === 'failed' && run.error && (
        <div style={{ marginBottom: 24, padding: '14px 18px', borderRadius: 10, background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.25)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <XCircle size={15} color="#e85555" style={{ flexShrink: 0, marginTop: 1 }} />
          <pre style={{ margin: 0, fontSize: 12, fontFamily: 'monospace', color: '#e85555', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{run.error}</pre>
        </div>
      )}

      {/* Input / Output */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <div style={{ padding: '20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Input</p>
          <OutputBlock value={run.input} />
        </div>
        <div style={{ padding: '20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Output</p>
          <OutputBlock value={run.output} />
        </div>
      </div>

      {/* Trace */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Execution Trace</h2>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{trace.length} step{trace.length !== 1 ? 's' : ''}</span>
      </div>

      {trace.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>No trace data available for this run.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trace.map((step, i) => (
            <TraceCard key={`${step.nodeId}-${i}`} step={step} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
