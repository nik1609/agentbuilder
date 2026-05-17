'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

const COLOR = '#f5a020'

export default function ConditionNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const preview = d.condition
    ? String(d.condition).slice(0, 72) + (String(d.condition).length > 72 ? '…' : '')
    : null

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
          <GitBranch size={10} color={COLOR} />
          <span style={{ fontSize: 8, fontWeight: 800, color: COLOR, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Branch</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.label}
        </span>
        <NodeIdChip id={id} />
      </div>

      {/* Body */}
      <div style={{ padding: '7px 12px 12px', borderRadius: '0 0 12px 12px', overflow: 'hidden', background: 'var(--bg)' }}>
        <p style={{ fontSize: 11, color: preview ? 'var(--text2)' : 'var(--text4)', lineHeight: 1.55, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontStyle: preview ? 'normal' : 'italic' }}>
          {preview ?? 'No condition set'}
        </p>

        {d.model && (
          <span style={{ display: 'inline-block', marginTop: 6, fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--text3)', fontFamily: 'monospace' }}>
            {String(d.model)}
          </span>
        )}

        {/* Subtle handle labels — sit just above their respective handles */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingBottom: 2 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: '#22d79a', letterSpacing: '0.04em', paddingLeft: '16%' }}>
            True
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, color: '#dc2626', letterSpacing: '0.04em', paddingRight: '16%' }}>
            False
          </span>
        </div>
      </div>

      {/* True → left, False → right */}
      <Handle type="source" id="true" position={Position.Bottom}
        style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid #22d79a`, bottom: -6, left: '30%', transform: 'translateX(-50%)' }} />
      <Handle type="source" id="false" position={Position.Bottom}
        style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid #dc2626`, bottom: -6, left: '70%', transform: 'translateX(-50%)' }} />
    </div>
  )
}
