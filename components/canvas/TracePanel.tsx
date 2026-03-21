'use client'
import { TraceEvent } from '@/types/agent'
import { Activity, Clock, Zap, CheckCircle2, XCircle, Pause, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface TracePanelProps {
  trace: TraceEvent[]
  status: 'idle' | 'running' | 'completed' | 'failed' | 'waiting_hitl'
  tokens?: number
  latencyMs?: number
}

interface TimelineBar {
  nodeId: string
  label: string
  startMs: number
  endMs: number
  type: 'llm' | 'tool' | 'hitl' | 'node'
}

function computeTimelines(trace: TraceEvent[]): TimelineBar[] {
  const starts = new Map<string, { ts: number; label: string; type: TimelineBar['type'] }>()
  const bars: TimelineBar[] = []
  for (const e of trace) {
    if (e.type === 'node_start' && e.nodeId)
      starts.set(e.nodeId, { ts: e.ts, label: e.message.replace(' started', ''), type: 'node' })
    if (e.type === 'llm_call' && e.nodeId) { const x = starts.get(e.nodeId); if (x) x.type = 'llm' }
    if (e.type === 'tool_call' && e.nodeId) { const x = starts.get(e.nodeId); if (x) x.type = 'tool' }
    if (e.type === 'hitl_pause' && e.nodeId) { const x = starts.get(e.nodeId); if (x) x.type = 'hitl' }
    if (e.type === 'node_done' && e.nodeId) {
      const start = starts.get(e.nodeId)
      if (start) {
        bars.push({ nodeId: e.nodeId, label: start.label, startMs: start.ts, endMs: e.ts, type: start.type })
        starts.delete(e.nodeId)
      }
    }
  }
  return bars
}

const TYPE_COLORS: Record<TimelineBar['type'], { bar: string; bg: string; label: string }> = {
  llm:  { bar: '#7c6ff0', bg: 'rgba(124,111,240,0.18)', label: 'LLM' },
  tool: { bar: '#22d79a', bg: 'rgba(34,215,154,0.18)',  label: 'Tool' },
  hitl: { bar: '#f5a020', bg: 'rgba(245,160,32,0.18)',  label: 'HITL' },
  node: { bar: '#22d3ee', bg: 'rgba(34,211,238,0.18)',  label: 'Node' },
}

const EVENT_DOT: Record<string, string> = {
  node_start:       'var(--text3)',
  node_done:        'var(--green)',
  llm_call:         'var(--blue)',
  llm_response:     '#b080f8',
  tool_call:        'var(--cyan)',
  tool_result:      'var(--green)',
  hitl_pause:       'var(--orange)',
  error:            'var(--red)',
  guardrail_block:  'var(--red)',
  guardrail_warn:   'var(--orange)',
}

const EVENT_LABEL: Record<string, string> = {
  node_start:       'start',
  node_done:        'done',
  llm_call:         'llm →',
  llm_response:     '← llm',
  tool_call:        'tool →',
  tool_result:      '← tool',
  hitl_pause:       'paused',
  error:            'error',
  guardrail_block:  'blocked',
  guardrail_warn:   'warned',
}

// Events that carry useful data worth showing
const HAS_DATA_TYPES = new Set(['llm_call', 'llm_response', 'tool_call', 'tool_result', 'error', 'guardrail_block', 'guardrail_warn'])

const STATUS_MAP = {
  running:      { label: 'RUNNING',  color: 'var(--blue)',   bg: 'rgba(124,111,240,0.12)', border: 'rgba(124,111,240,0.3)', pulse: true },
  completed:    { label: 'DONE',     color: 'var(--green)',  bg: 'rgba(34,215,154,0.12)',  border: 'rgba(34,215,154,0.3)',  pulse: false },
  failed:       { label: 'FAILED',   color: 'var(--red)',    bg: 'rgba(232,85,85,0.12)',   border: 'rgba(232,85,85,0.3)',   pulse: false },
  waiting_hitl: { label: 'PAUSED',   color: 'var(--orange)', bg: 'rgba(245,160,32,0.12)',  border: 'rgba(245,160,32,0.3)',  pulse: false },
  idle:         null,
} as const

const StatusBadge = ({ status }: { status: TracePanelProps['status'] }) => {
  const cfg = STATUS_MAP[status]
  if (!cfg) return null
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
      padding: '3px 7px', borderRadius: 5,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      animation: cfg.pulse ? 'pulse 1.5s ease-in-out infinite' : undefined,
    }}>
      {cfg.label}
    </span>
  )
}

const StatusIcon = ({ status }: { status: TracePanelProps['status'] }) => {
  if (status === 'completed') return <CheckCircle2 size={12} style={{ color: 'var(--green)' }} />
  if (status === 'failed') return <XCircle size={12} style={{ color: 'var(--red)' }} />
  if (status === 'waiting_hitl') return <Pause size={12} style={{ color: 'var(--orange)' }} />
  if (status === 'running') return <Activity size={12} style={{ color: 'var(--blue)' }} className="animate-pulse" />
  return <Activity size={12} style={{ color: 'var(--text3)' }} />
}

function DataBlock({ data }: { data: unknown }) {
  if (data == null) return null

  // For LLM input/output — if it's a plain string, show as text
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>

    // LLM call: show input text + system prompt
    if ('input' in d && 'model' in d) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!!d.systemPrompt && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>System Prompt</div>
              <pre style={{ margin: 0, fontSize: 10, color: 'var(--text3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', lineHeight: 1.5 }}>
                {String(d.systemPrompt).slice(0, 300)}{String(d.systemPrompt).length > 300 ? '…' : ''}
              </pre>
            </div>
          )}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Input → {String(d.model)}</div>
            <pre style={{ margin: 0, fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', lineHeight: 1.6 }}>
              {String(d.input).slice(0, 600)}{String(d.input).length > 600 ? '…' : ''}
            </pre>
          </div>
        </div>
      )
    }

    // LLM response: show output text
    if ('output' in d && 'tokens' in d) {
      return (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#b080f8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Output ({String(d.tokens)} tokens)</div>
          <pre style={{ margin: 0, fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', lineHeight: 1.6 }}>
            {typeof d.output === 'string'
              ? d.output.slice(0, 800) + (d.output.length > 800 ? '…' : '')
              : JSON.stringify(d.output, null, 2).slice(0, 800)}
          </pre>
        </div>
      )
    }

    // Tool call: show input
    if ('input' in d && 'tool' in d) {
      const inputStr = typeof d.input === 'string' ? d.input : JSON.stringify(d.input, null, 2)
      return (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Input to {String(d.tool)}</div>
          <pre style={{ margin: 0, fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', lineHeight: 1.6 }}>
            {inputStr.slice(0, 600)}{inputStr.length > 600 ? '…' : ''}
          </pre>
        </div>
      )
    }

    // Tool result: show output
    if ('output' in d && !('tokens' in d)) {
      const outStr = typeof d.output === 'string' ? d.output : JSON.stringify(d.output, null, 2)
      return (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Result</div>
          <pre style={{ margin: 0, fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', lineHeight: 1.6 }}>
            {outStr.slice(0, 800)}{outStr.length > 800 ? '…' : ''}
          </pre>
        </div>
      )
    }
  }

  // Fallback: JSON dump
  return (
    <pre style={{ margin: 0, fontSize: 10, color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', lineHeight: 1.5 }}>
      {JSON.stringify(data, null, 2).slice(0, 800)}
    </pre>
  )
}

export default function TracePanel({ trace, status, tokens, latencyMs }: TracePanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set())

  const toggleEvent = (i: number) => {
    setExpandedEvents(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  if (trace.length === 0 && status === 'idle') return null

  const timelines = computeTimelines(trace)
  const minTs = timelines.length > 0 ? Math.min(...timelines.map(b => b.startMs)) : 0
  const maxTs = timelines.length > 0 ? Math.max(...timelines.map(b => b.endMs)) : 0
  const span = maxTs - minTs || 1

  return (
    <div style={{
      flexShrink: 0, borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 16px', height: 40, flexShrink: 0,
        borderBottom: '1px solid var(--border2)',
        background: 'var(--surface)',
        cursor: 'pointer',
      }} onClick={() => setCollapsed(c => !c)}>
        <StatusIcon status={status} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text3)', textTransform: 'uppercase' }}>
          Trace
        </span>
        <StatusBadge status={status} />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {tokens != null && tokens > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={9} style={{ color: 'var(--text3)' }} />
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)' }}>{tokens.toLocaleString()} tok</span>
            </div>
          )}
          {latencyMs != null && latencyMs > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={9} style={{ color: 'var(--text3)' }} />
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)' }}>{latencyMs}ms</span>
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: 5,
            border: '1px solid var(--border)', background: 'var(--surface2)',
            color: 'var(--text3)',
          }}>
            {collapsed ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </div>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Waterfall chart */}
          {timelines.length > 0 && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border2)' }}>
              <div style={{ marginBottom: 8, display: 'flex', gap: 6 }}>
                {(['llm','tool','hitl','node'] as const).filter(t => timelines.some(b => b.type === t)).map(t => (
                  <div key={t} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '2px 7px', borderRadius: 5,
                    background: TYPE_COLORS[t].bg,
                    border: `1px solid ${TYPE_COLORS[t].bar}40`,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: TYPE_COLORS[t].bar, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: TYPE_COLORS[t].bar, fontWeight: 700, letterSpacing: '0.04em' }}>{TYPE_COLORS[t].label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {timelines.map((bar, i) => {
                  const leftPct = ((bar.startMs - minTs) / span) * 100
                  const widthPct = Math.max(((bar.endMs - bar.startMs) / span) * 100, 1.5)
                  const dur = bar.endMs - bar.startMs
                  const c = TYPE_COLORS[bar.type]
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 76, flexShrink: 0, fontSize: 9, fontFamily: 'monospace', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bar.label}
                      </div>
                      <div style={{ flex: 1, position: 'relative', height: 14, borderRadius: 4, background: 'var(--surface2)' }}>
                        <div style={{ position: 'absolute', top: 0, height: '100%', borderRadius: 4, left: `${leftPct}%`, width: `${widthPct}%`, background: c.bar, opacity: 0.9 }} />
                        <div style={{ position: 'absolute', top: '50%', left: `calc(${leftPct}% + 4px)`, transform: 'translateY(-50%)', fontSize: 7, fontWeight: 800, letterSpacing: '0.05em', color: '#fff', opacity: 0.8, pointerEvents: 'none' }}>
                          {c.label}
                        </div>
                      </div>
                      <div style={{ width: 42, flexShrink: 0, fontSize: 9, fontFamily: 'monospace', color: 'var(--text3)', textAlign: 'right' }}>
                        {dur}ms
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Event log */}
          {trace.length > 0 && (
            <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column' }}>
              {trace.map((e, i) => {
                const dot = EVENT_DOT[e.type] ?? 'var(--text3)'
                const label = EVENT_LABEL[e.type] ?? e.type
                const hasData = HAS_DATA_TYPES.has(e.type) && e.data != null
                const isExpanded = expandedEvents.has(i)

                return (
                  <div key={i}>
                    {/* Row */}
                    <div
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 0', cursor: hasData ? 'pointer' : 'default' }}
                      onClick={() => hasData && toggleEvent(i)}
                    >
                      {/* Dot + vertical line */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, flexShrink: 0 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                        {i < trace.length - 1 && (
                          <div style={{ width: 1, flex: 1, minHeight: 6, background: 'var(--border2)', marginTop: 2 }} />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                          <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: dot, letterSpacing: '0.03em' }}>
                            {label}
                          </span>
                          <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text3)' }}>
                            +{e.ts}ms
                          </span>
                          {e.nodeId && (
                            <span style={{ fontSize: 8, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 3, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
                              {e.nodeId.slice(0, 8)}
                            </span>
                          )}
                          {hasData && (
                            <span style={{ marginLeft: 'auto', color: 'var(--text3)', display: 'flex', alignItems: 'center', fontSize: 9 }}>
                              {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--text2)', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>
                          {e.message}
                        </p>
                      </div>
                    </div>

                    {/* Expanded data panel */}
                    {isExpanded && e.data != null && (
                      <div style={{
                        marginLeft: 16, marginBottom: 8,
                        padding: '10px 12px', borderRadius: 8,
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        maxHeight: 280, overflowY: 'auto',
                      }}>
                        <DataBlock data={e.data} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Running skeleton */}
          {status === 'running' && trace.length === 0 && (
            <div style={{ padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[80, 55, 70].map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
                  <div style={{ height: 10, borderRadius: 4, background: 'var(--surface2)', width: `${w}%`, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
