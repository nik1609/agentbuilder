'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Loader2, AlertCircle,
  ChevronDown, Brain, Wrench, GitBranch, Repeat, GitMerge,
  ToggleLeft, UserCheck, ArrowRight, Trash2, ExternalLink,
  ThumbsUp, ThumbsDown, RotateCcw,
} from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TraceEvent {
  ts: number; type: string; nodeId?: string; message: string; data?: Record<string, unknown>
}
interface TraceStep {
  nodeId: string; nodeType?: string; label?: string; status: string
  input?: unknown; output?: unknown; error?: string
  tokens?: number; latencyMs?: number; startMs?: number
}
interface Run {
  id: string; agent_id: string; agent_name: string; status: string
  tokens: number; latency_ms: number; cost_usd?: number; error?: string
  trace?: TraceEvent[]; input?: unknown; output?: unknown; created_at: string
}

function ConfirmModal({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onClick={onCancel} />
      <div style={{ position: 'relative', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px', maxWidth: 400, width: 'calc(100% - 48px)', boxShadow: 'var(--shadow-xl)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--error)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

function eventsToSteps(events: TraceEvent[]): TraceStep[] {
  const steps: TraceStep[] = []
  const started = new Map<string, { ts: number; data?: Record<string, unknown> }>()
  const firstTs = events.find(e => e.type === 'node_start')?.ts ?? 0
  for (const ev of events) {
    if (ev.type === 'node_start' && ev.nodeId) {
      started.set(ev.nodeId, { ts: ev.ts, data: ev.data })
    } else if (ev.type === 'node_done' && ev.nodeId) {
      const s = started.get(ev.nodeId)
      steps.push({
        nodeId: ev.nodeId,
        nodeType: (s?.data?.nodeType ?? ev.data?.nodeType) as string | undefined,
        label: (s?.data?.label ?? ev.data?.label) as string | undefined,
        status: 'completed', input: s?.data?.input, output: ev.data?.output,
        tokens: ev.data?.tokens as number | undefined,
        latencyMs: s ? Math.round(ev.ts - s.ts) : undefined,
        startMs: s ? Math.round(s.ts - firstTs) : undefined,
      })
    } else if (ev.type === 'error' && ev.nodeId) {
      const s = started.get(ev.nodeId)
      steps.push({
        nodeId: ev.nodeId, nodeType: s?.data?.nodeType as string,
        label: s?.data?.label as string, status: 'failed',
        input: s?.data?.input, error: ev.message,
        latencyMs: s ? Math.round(ev.ts - s.ts) : undefined,
        startMs: s ? Math.round(s.ts - firstTs) : undefined,
      })
    }
  }
  for (const [nodeId, { ts, data: sd }] of started) {
    if (!steps.find(s => s.nodeId === nodeId))
      steps.push({ nodeId, nodeType: sd?.nodeType as string, label: sd?.label as string, status: 'waiting', input: sd?.input, startMs: Math.round(ts - firstTs) })
  }
  return steps
}

function formatCost(usd: number) {
  if (usd <= 0) return '$0.00'; if (usd < 0.001) return '<$0.001'
  if (usd < 0.01) return `$${usd.toFixed(4)}`; if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}

const NODE_COLOR: Record<string, string> = {
  llm: '#7C3AED', tool: '#0891B2', condition: '#16A34A', loop: '#EA580C',
  fork: '#9333EA', join: '#9333EA', switch: '#D97706', hitl: '#DB2777',
  clarify: '#DC2626', passthrough: '#6B7280', input: '#374151', output: '#374151',
  orchestrator: '#2563EB',
}
const NODE_ICON: Record<string, React.ReactNode> = {
  llm: <Brain size={12} />, tool: <Wrench size={12} />, condition: <GitBranch size={12} />,
  loop: <Repeat size={12} />, fork: <GitBranch size={12} />, join: <GitMerge size={12} />,
  switch: <ToggleLeft size={12} />, hitl: <UserCheck size={12} />, passthrough: <ArrowRight size={12} />,
}

// Nodes whose latency is user-wait time — exclude from waterfall timing
const WAIT_TYPES = new Set(['hitl', 'clarify'])

function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const map: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
    completed:    { color: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success-border)', icon: <CheckCircle size={size === 'md' ? 13 : 11} />, label: 'Completed' },
    failed:       { color: 'var(--error)',   bg: 'var(--error-bg)',   border: 'var(--error-border)',   icon: <XCircle size={size === 'md' ? 13 : 11} />,    label: 'Failed' },
    running:      { color: 'var(--accent)',  bg: 'var(--accent-light)', border: 'var(--accent-border)', icon: <Loader2 size={size === 'md' ? 13 : 11} style={{ animation: 'spin 1s linear infinite' }} />, label: 'Running' },
    waiting_hitl: { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)', icon: <AlertCircle size={size === 'md' ? 13 : 11} />, label: 'Awaiting HITL' },
    waiting:      { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)', icon: <Clock size={size === 'md' ? 13 : 11} />,       label: 'Waiting' },
  }
  const cfg = map[status] ?? { color: 'var(--text3)', bg: 'var(--surface2)', border: 'var(--border)', icon: <Clock size={11} />, label: status }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: size === 'md' ? 12 : 11, fontWeight: 600, padding: size === 'md' ? '5px 12px' : '3px 8px', borderRadius: 7, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function MdContent({ value }: { value: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      p: ({ children }) => <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{children}</p>,
      h1: ({ children }) => <h1 style={{ fontSize: 15, fontWeight: 700, margin: '10px 0 5px', color: 'var(--text)' }}>{children}</h1>,
      h2: ({ children }) => <h2 style={{ fontSize: 13, fontWeight: 700, margin: '8px 0 4px', color: 'var(--text)' }}>{children}</h2>,
      h3: ({ children }) => <h3 style={{ fontSize: 12, fontWeight: 700, margin: '6px 0 3px', color: 'var(--text)' }}>{children}</h3>,
      strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
      ul: ({ children }) => <ul style={{ margin: '3px 0 6px', paddingLeft: 18, fontSize: 13 }}>{children}</ul>,
      ol: ({ children }) => <ol style={{ margin: '3px 0 6px', paddingLeft: 18, fontSize: 13 }}>{children}</ol>,
      li: ({ children }) => <li style={{ margin: '2px 0', color: 'var(--text)' }}>{children}</li>,
      code: ({ children }) => <code style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--surface3)', padding: '1px 4px', borderRadius: 3 }}>{children}</code>,
      pre: ({ children }) => <pre style={{ margin: '4px 0', background: 'var(--surface3)', borderRadius: 6, padding: '8px 10px', overflowX: 'auto', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{children}</pre>,
      table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, margin: '6px 0' }}>{children}</table>,
      th: ({ children }) => <th style={{ border: '1px solid var(--border)', padding: '5px 8px', textAlign: 'left', background: 'var(--surface2)', fontWeight: 700, fontSize: 11 }}>{children}</th>,
      td: ({ children }) => <td style={{ border: '1px solid var(--border)', padding: '4px 8px', fontSize: 12 }}>{children}</td>,
    }}>{value}</ReactMarkdown>
  )
}

function OutputBlock({ value, error }: { value: unknown; error?: string }) {
  if (error) return <pre style={{ margin: 0, fontSize: 12, fontFamily: 'monospace', color: 'var(--error)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</pre>
  if (value === undefined || value === null) return <span style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: 12 }}>—</span>
  if (typeof value === 'string' && !value.trim()) return <span style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: 12 }}>—</span>
  if (typeof value === 'string') return <MdContent value={value} />
  return <pre style={{ margin: 0, fontSize: 12, fontFamily: 'monospace', color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>{JSON.stringify(value, null, 2)}</pre>
}

function hasContent(val: unknown): boolean {
  if (val === undefined || val === null) return false
  if (typeof val === 'string') return val.trim().length > 0
  if (typeof val === 'object') return Object.keys(val as object).length > 0
  return true
}

// ── Waterfall: only compute/LLM/tool steps — skip HITL/clarify wait times ────
function WaterfallStrip({ steps }: { steps: TraceStep[] }) {
  const timed = steps.filter(s => !WAIT_TYPES.has(s.nodeType ?? '') && s.latencyMs != null && s.latencyMs > 0)
  if (timed.length === 0) return null
  const maxEnd = Math.max(...timed.map(s => (s.startMs ?? 0) + (s.latencyMs ?? 0)))
  if (maxEnd === 0) return null
  return (
    <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Waterfall · compute steps only</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{maxEnd}ms</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {timed.map((step, i) => {
          const color = NODE_COLOR[step.nodeType ?? ''] ?? '#6B7280'
          const offsetPct = ((step.startMs ?? 0) / maxEnd) * 100
          const widthPct  = Math.max(1, ((step.latencyMs ?? 0) / maxEnd) * 100)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div title={step.label ?? step.nodeType ?? step.nodeId} style={{ width: 160, flexShrink: 0, fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'default' }}>{step.label ?? step.nodeType}</div>
              <div style={{ flex: 1, height: 14, borderRadius: 3, background: 'var(--surface2)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 2, bottom: 2, left: `${offsetPct}%`, width: `${widthPct}%`, minWidth: 3, background: color, borderRadius: 2, opacity: 0.75 }} />
              </div>
              <div style={{ width: 48, flexShrink: 0, fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', textAlign: 'right' }}>{step.latencyMs}ms</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Input / Output trace entries ─────────────────────────────────────────────
function InputOutputEntry({ label, value, index, isLast }: { label: string; value: unknown; index: number; isLast: boolean }) {
  const isInput = label === 'Input'
  const color = '#374151'
  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, border: `2px solid var(--card-bg)`, boxShadow: `0 0 0 1.5px ${color}40`, flexShrink: 0, marginTop: 18 }} />
        {!isLast && <div style={{ flex: 1, width: 1.5, background: 'var(--border)', marginTop: 3, marginBottom: -10 }} />}
      </div>
      <div style={{ flex: 1, marginBottom: 8, marginLeft: 8, minWidth: 0 }}>
        <div style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card-bg)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)', minWidth: 16 }}>{isInput ? '0' : '—'}</span>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
              {isInput ? <ArrowRight size={12} /> : <CheckCircle size={12} />}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)', padding: '12px 14px', maxHeight: 200, overflowY: 'auto', overflowX: 'hidden' }}>
            <div style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
              {hasContent(value) ? <OutputBlock value={value} /> : <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>—</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Trace card ─────────────────────────────────────────────────────────────────
function TraceCard({ step, index, totalMs, isLast, runId, onAction }: {
  step: TraceStep; index: number; totalMs: number; isLast: boolean
  runId: string; onAction: () => void
}) {
  const [open, setOpen] = useState(false)
  const [hitlNotes, setHitlNotes] = useState('')
  const [hitlLoading, setHitlLoading] = useState<'approve' | 'revise' | 'reject' | undefined>()

  const failed = step.status === 'failed'
  const waiting = step.status === 'waiting'
  const isHitl  = step.nodeType === 'hitl' && waiting
  const color   = NODE_COLOR[step.nodeType ?? ''] ?? '#6B7280'
  const icon    = NODE_ICON[step.nodeType ?? '']
  const showTypePill = step.nodeType && step.label?.toLowerCase() !== step.nodeType?.toLowerCase()

  // For waterfall bar: skip wait-type nodes from timing
  const isWaitType = WAIT_TYPES.has(step.nodeType ?? '')
  const barW = !isWaitType && totalMs > 0 && step.latencyMs
    ? Math.max(2, Math.round((step.latencyMs / totalMs) * 100))
    : 0

  const inputOk  = hasContent(step.input)
  const outputOk = hasContent(failed ? step.error : step.output)
  const canExpand = inputOk || outputOk || isHitl

  async function doHitl(action: 'approve' | 'revise' | 'reject') {
    setHitlLoading(action)
    const body = action === 'approve'
      ? { approved: true, feedback: hitlNotes || undefined }
      : action === 'revise'
      ? { approved: false, action: 'revise', feedback: hitlNotes || undefined }
      : { approved: false, feedback: hitlNotes || undefined }
    await fetch(`/api/runs/${runId}/resume`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setHitlLoading(undefined)
    onAction()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: failed ? 'var(--error)' : waiting ? 'var(--warning)' : color, border: `2px solid var(--card-bg)`, boxShadow: `0 0 0 1.5px ${failed ? 'var(--error)' : waiting ? 'var(--warning)' : color}40`, flexShrink: 0, marginTop: 18 }} />
        {!isLast && <div style={{ flex: 1, width: 1.5, background: 'var(--border)', marginTop: 3, marginBottom: -10 }} />}
      </div>

      {/* Card */}
      <div style={{ flex: 1, marginBottom: 8, marginLeft: 8, minWidth: 0 }}>
        <div style={{ borderRadius: 10, border: `1px solid ${failed ? 'var(--error-border)' : waiting ? 'var(--warning-border)' : 'var(--border)'}`, background: 'var(--card-bg)', overflow: 'hidden' }}>
          <button onClick={() => canExpand && setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 'none', cursor: canExpand ? 'pointer' : 'default', textAlign: 'left' }}>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)', minWidth: 16, flexShrink: 0 }}>{index + 1}</span>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
              {icon ?? <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: barW ? 4 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: failed ? 'var(--error)' : waiting ? 'var(--warning)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {step.label ?? step.nodeId}
                </span>
                {showTypePill && (
                  <span style={{ fontSize: 9, color, background: `${color}18`, padding: '1px 5px', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>{step.nodeType!.toUpperCase()}</span>
                )}
              </div>
              {barW > 0 && (
                <div style={{ height: 3, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ width: `${barW}%`, height: '100%', background: color, borderRadius: 2, opacity: 0.6 }} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {step.tokens != null && step.tokens > 0 && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{step.tokens > 999 ? `${(step.tokens/1000).toFixed(1)}k` : step.tokens} tok</span>}
              {!isWaitType && step.latencyMs != null && step.latencyMs > 0 && <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{step.latencyMs}ms</span>}
              <StatusBadge status={step.status} />
              {canExpand && <ChevronDown size={13} color="var(--text3)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />}
            </div>
          </button>

          {open && canExpand && (
            <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
              {/* Input / output side by side */}
              {(inputOk || outputOk) && (
                <div style={{ display: 'grid', gridTemplateColumns: inputOk && outputOk ? '1fr 1fr' : '1fr', minWidth: 0 }}>
                  {inputOk && (
                    <div style={{ minWidth: 0, padding: '12px 14px', borderRight: outputOk ? '1px solid var(--border)' : 'none', maxHeight: 300, overflowY: 'auto', overflowX: 'hidden' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Input</p>
                      <div style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}><OutputBlock value={step.input} /></div>
                    </div>
                  )}
                  {outputOk && (
                    <div style={{ minWidth: 0, padding: '12px 14px', maxHeight: 300, overflowY: 'auto', overflowX: 'hidden' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{failed ? 'Error' : 'Output'}</p>
                      <div style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}><OutputBlock value={step.output} error={failed ? step.error : undefined} /></div>
                    </div>
                  )}
                </div>
              )}

              {/* Inline HITL actions */}
              {isHitl && (
                <div style={{ padding: '12px 14px', borderTop: (inputOk || outputOk) ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12 }}>
                    <textarea value={hitlNotes} onChange={e => setHitlNotes(e.target.value)}
                      placeholder="Notes for the agent (optional)…" rows={2}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {([
                        { action: 'approve' as const, label: 'Approve',  icon: <ThumbsUp size={11} />,  s: { border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontWeight: 600 } },
                        { action: 'revise'  as const, label: 'Request Revision', icon: <RotateCcw size={11} />, s: { border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontWeight: 500 } },
                        { action: 'reject'  as const, label: 'Reject',   icon: <ThumbsDown size={11} />,s: { border: '1px solid var(--error-border)', background: 'var(--error-bg)', color: 'var(--error)', fontWeight: 500 } },
                      ] as const).map(({ action, label, icon, s }) => {
                        const busy = hitlLoading === action
                        return (
                          <button key={action} onClick={() => doHitl(action)} disabled={!!hitlLoading}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 10px', borderRadius: 7, fontSize: 12, cursor: hitlLoading ? 'default' : 'pointer', opacity: hitlLoading && !busy ? 0.35 : 1, ...s }}>
                            {busy ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : icon}
                            {busy ? '…' : label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const router    = useRouter()
  const [run, setRun]       = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm] = useState<null | { title: string; message: string; onConfirm: () => void }>(null)

  const load = (attempt = 0) => {
    fetch(`/api/runs/${runId}`).then(r => r.json()).then(d => {
      if ((d.error === 'Unauthorized' || d.error === 'Not found') && attempt < 3) { setTimeout(() => load(attempt + 1), 600 * (attempt + 1)); return }
      setRun(d.error ? null : d); setLoading(false)
    }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [runId])

  function askDelete() {
    setConfirm({ title: 'Delete this run?', message: 'All trace and output data will be permanently removed.', onConfirm: async () => { setConfirm(null); setDeleting(true); await fetch(`/api/runs/${runId}`, { method: 'DELETE' }); router.push('/runs') } })
  }


  if (loading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text3)', fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading run…
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!run) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <p style={{ color: 'var(--text3)', fontSize: 13 }}>Run not found.</p>
      <button onClick={() => { setLoading(true); load() }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', cursor: 'pointer', fontSize: 12 }}>Retry</button>
      <Link href="/runs" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>← Back to Runs</Link>
    </div>
  )

  const trace   = eventsToSteps(Array.isArray(run.trace) ? run.trace as TraceEvent[] : [])
  // totalMs from compute steps only (not HITL/clarify wait)
  const totalMs = trace.filter(t => !WAIT_TYPES.has(t.nodeType ?? '')).reduce((s, t) => s + (t.latencyMs ?? 0), 0)

  return (
    // Non-scrollable outer shell — trace section scrolls
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}

      {/* Fixed top section */}
      <div style={{ flexShrink: 0, padding: '20px 32px 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <button onClick={() => router.push('/runs')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}>
              <ArrowLeft size={14} />
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{run.agent_name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusBadge status={run.status} size="md" />
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)' }}>{run.id}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
            <Link href={`/builder/${run.agent_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
              <ExternalLink size={12} /> Open in Builder
            </Link>
            <button onClick={askDelete} disabled={deleting} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: '1px solid var(--error-border)', background: 'var(--error-bg)', color: 'var(--error)', cursor: 'pointer', fontSize: 12, fontWeight: 500, opacity: deleting ? 0.5 : 1 }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Tokens',    value: run.tokens > 0 ? run.tokens.toLocaleString() : '—' },
            { label: 'Latency',   value: run.latency_ms > 0 ? `${run.latency_ms}ms` : '—' },
            { label: 'Est. Cost', value: run.cost_usd ? formatCost(run.cost_usd) : '—' },
            { label: 'Time',      value: new Date(run.created_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Error banner — only for failed runs */}
        {run.status === 'failed' && run.error && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--error-bg)', border: '1px solid var(--error-border)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <XCircle size={13} color="var(--error)" style={{ flexShrink: 0, marginTop: 1 }} />
            <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', color: 'var(--error)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{run.error}</pre>
          </div>
        )}

        {/* Trace header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Execution Trace</h2>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{trace.length} step{trace.length !== 1 ? 's' : ''}{totalMs > 0 ? ` · ${totalMs}ms compute` : ''}</span>
        </div>
      </div>

      {/* Scrollable trace section */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 32px 24px' }}>
        {trace.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>No trace data for this run.</p>
          </div>
        ) : (
          <>
            <WaterfallStrip steps={trace} />
            {/* Input as first trace entry */}
            <InputOutputEntry label="Input" value={run.input} index={0} isLast={false} />
            {trace.map((step, i) => (
              <TraceCard key={`${step.nodeId}-${i}`} step={step} index={i + 1} totalMs={totalMs} isLast={i === trace.length - 1 && !hasContent(run.output)} runId={runId} onAction={load} />
            ))}
            {/* Output as last trace entry */}
            {hasContent(run.output) && <InputOutputEntry label="Output" value={run.output} index={trace.length + 1} isLast />}
          </>
        )}
      </div>
    </div>
  )
}
