'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { UserCheck } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

const COLOR = '#b080f8'

export default function HITLNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const preview = d.question
    ? String(d.question).slice(0, 60) + (String(d.question).length > 60 ? '…' : '')
    : null

  return (
    <div style={{
      minWidth: 190, maxWidth: 250,
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px 8px', borderBottom: '1px solid var(--border2)', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: `${COLOR}14`, flexShrink: 0 }}>
          <UserCheck size={10} color={COLOR} />
          <span style={{ fontSize: 8, fontWeight: 800, color: COLOR, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Human</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.label}
        </span>
        <NodeIdChip id={id} />
      </div>

      <div style={{ padding: '6px 12px 9px', borderRadius: '0 0 12px 12px', overflow: 'hidden', background: 'var(--bg)' }}>
        <p style={{ fontSize: 11, color: preview ? 'var(--text3)' : 'var(--text4)', lineHeight: 1.55, margin: '0 0 5px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {preview ?? 'No review question set'}
        </p>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${COLOR}14`, color: COLOR, fontWeight: 700 }}>
          Pauses for approval
        </span>
      </div>

      <Handle type="source" position={Position.Bottom}
        style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid ${COLOR}`, bottom: -6 }} />
    </div>
  )
}
