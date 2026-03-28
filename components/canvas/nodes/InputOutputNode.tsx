'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

export default function InputOutputNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const isInput = d.nodeType === 'input'
  const color = isInput ? '#22d3ee' : '#6868a0'

  return (
    <div style={{
      minWidth: 140, borderRadius: 12, overflow: 'hidden', cursor: 'grab',
      background: 'var(--surface2)',
      border: `1px solid ${color}40`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 6px', borderBottom: `1px solid ${color}20` }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isInput ? <ArrowRight size={11} color={color} /> : <ArrowLeft size={11} color={color} />}
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color }}>
          {isInput ? 'Entry' : 'Exit'}
        </span>
      </div>
      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <NodeIdChip id={id} />
        </div>
      </div>
      {isInput && (
        <Handle type="source" position={Position.Bottom} title="Flow starts here — connect to your first node" style={{ width: 10, height: 10, background: 'var(--surface)', border: `2px solid ${color}`, bottom: -6 }} />
      )}
      {!isInput && (
        <Handle type="target" position={Position.Top} title="Flow ends here — connect from your last node" style={{ width: 10, height: 10, background: 'var(--surface)', border: `2px solid ${color}`, top: -6 }} />
      )}
    </div>
  )
}
