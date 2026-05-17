'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Brain, Shield, Database, RefreshCw } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

const COLOR = '#7c6ff0'

export default function LLMNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const preview = d.systemPrompt
    ? String(d.systemPrompt).slice(0, 72) + (String(d.systemPrompt).length > 72 ? '…' : '')
    : null

  const isAgentic = !!d.agenticMode
  const hasGuardrail = !!d.guardrailId
  const hasMemory = Array.isArray(d.memorySources) && (d.memorySources as unknown[]).length > 0
  const hasRetry = !!(d.retry as { enabled?: boolean } | undefined)?.enabled
  const hasChips = isAgentic || hasGuardrail || hasMemory || hasRetry

  return (
    <div style={{
      minWidth: 210, maxWidth: 260,
      borderRadius: 12, overflow: 'visible', cursor: 'grab',
      background: 'var(--bg)',
      border: `1.5px solid ${selected ? COLOR : 'var(--border)'}`,
      boxShadow: selected
        ? `0 0 0 3px ${COLOR}1A, 0 4px 16px rgba(0,0,0,0.1)`
        : '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}>
      <Handle type="target" position={Position.Top}
        style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid ${COLOR}`, top: -6 }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px 8px', borderBottom: '1px solid var(--border2)', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: `${COLOR}14`, flexShrink: 0 }}>
          <Brain size={10} color={COLOR} />
          <span style={{ fontSize: 8, fontWeight: 800, color: COLOR, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {isAgentic ? 'Agentic' : 'AI Step'}
          </span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.label}
        </span>
        <NodeIdChip id={id} />
      </div>

      {/* Body — system prompt preview */}
      <div style={{ padding: '6px 12px 9px', background: 'var(--bg)', borderRadius: hasChips ? 0 : '0 0 12px 12px', overflow: 'hidden' }}>
        <p style={{ fontSize: 11, color: preview ? 'var(--text3)' : 'var(--text4)', lineHeight: 1.55, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {preview ?? 'No system prompt set'}
        </p>
        {d.model && (
          <span style={{ display: 'inline-block', marginTop: 5, fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--text3)', fontFamily: 'monospace' }}>
            {String(d.model)}
          </span>
        )}
      </div>

      {/* Status chips */}
      {hasChips && (
        <div style={{ padding: '5px 12px 9px', display: 'flex', gap: 4, flexWrap: 'wrap', borderRadius: '0 0 12px 12px', overflow: 'hidden', background: 'var(--bg)' }}>
          {isAgentic && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${COLOR}14`, color: COLOR, fontWeight: 700 }}>
              <Brain size={8} /> Agentic
            </span>
          )}
          {hasMemory && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(251,146,60,0.12)', color: '#f97316', fontWeight: 700 }}>
              <Database size={8} /> Memory
            </span>
          )}
          {hasGuardrail && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(220,38,38,0.1)', color: '#dc2626', fontWeight: 700 }}>
              <Shield size={8} /> Guardrail
            </span>
          )}
          {hasRetry && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,160,32,0.1)', color: '#f5a020', fontWeight: 700 }}>
              <RefreshCw size={8} /> Retry
            </span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom}
        style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid ${COLOR}`, bottom: -6 }} />
    </div>
  )
}
