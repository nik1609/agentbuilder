'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

export default function ConditionNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  return (
    <div style={{
      minWidth: 180, borderRadius: 12, overflow: 'hidden', cursor: 'grab',
      background: 'var(--surface)',
      borderStyle: 'solid',
      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 3,
      borderTopColor: selected ? '#f5a020' : 'var(--border)', borderRightColor: selected ? '#f5a020' : 'var(--border)', borderBottomColor: selected ? '#f5a020' : 'var(--border)', borderLeftColor: '#f5a020',
      boxShadow: selected ? '0 0 0 2px rgba(245,160,32,0.3), 0 4px 20px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 6px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(245,160,32,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GitBranch size={11} color="#f5a020" />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f5a020' }}>Condition</span>
      </div>
      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <NodeIdChip id={id} />
        </div>
        {d.condition && (
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', lineHeight: 1.4 }}>
            {String(d.condition).slice(0, 50)}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Top} title="Input" style={{ width: 10, height: 10, background: 'var(--surface2)', border: '2px solid #f5a020', top: -6 }} />
      <Handle type="source" position={Position.Bottom} id="true" title="True → condition met" style={{ width: 10, height: 10, background: 'var(--surface2)', border: '2px solid #22d79a', bottom: -6, left: '30%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Bottom} id="false" title="False → condition not met" style={{ width: 10, height: 10, background: 'var(--surface2)', border: '2px solid #e85555', bottom: -6, left: '70%', transform: 'translateX(-50%)' }} />
    </div>
  )
}
