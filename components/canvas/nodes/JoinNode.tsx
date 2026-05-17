'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Merge } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

const COLOR = '#26c6da'

const FORMAT_LABELS: Record<string, string> = {
  array: 'Array [ ]', object: 'Object { }', concatenated: 'Text',
}

export default function JoinNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const mergeFormat = (d.mergeFormat as string | undefined) ?? 'array'

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
      {/* Single center handle — multiple branch edges can connect here */}
      <Handle type="target" position={Position.Top}
        style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid ${COLOR}`, top: -6 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px 8px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: `${COLOR}14`, flexShrink: 0 }}>
          <Merge size={10} color={COLOR} />
          <span style={{ fontSize: 8, fontWeight: 800, color: COLOR, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Join</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.label}
        </span>
        <NodeIdChip id={id} />
      </div>

      <div style={{ padding: '6px 12px 9px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Wait all</span>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${COLOR}14`, color: COLOR, fontWeight: 700, marginLeft: 'auto' }}>
          {FORMAT_LABELS[mergeFormat] ?? mergeFormat}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom}
        style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid ${COLOR}`, bottom: -6 }} />
    </div>
  )
}
