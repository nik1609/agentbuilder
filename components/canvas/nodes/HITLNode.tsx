'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { UserCheck } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

export default function HITLNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  return (
    <div style={{
      minWidth: 180, borderRadius: 12, overflow: 'hidden', cursor: 'grab',
      background: 'var(--surface)',
      borderStyle: 'solid',
      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 3,
      borderTopColor: selected ? '#b080f8' : 'var(--border)', borderRightColor: selected ? '#b080f8' : 'var(--border)', borderBottomColor: selected ? '#b080f8' : 'var(--border)', borderLeftColor: '#b080f8',
      boxShadow: selected ? '0 0 0 2px rgba(176,128,248,0.3), 0 4px 20px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 6px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(176,128,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <UserCheck size={11} color="#b080f8" />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b080f8' }}>HITL</span>
      </div>
      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3, lineHeight: 1.3 }}>{d.label}</div>
        {d.question && (
          <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {String(d.question).slice(0, 60)}
          </div>
        )}
      </div>
      {selected && <NodeIdChip id={id} />}
      <Handle type="target" position={Position.Left} style={{ width: 10, height: 10, background: 'var(--surface2)', border: '2px solid #b080f8', left: -6 }} />
      <Handle type="source" position={Position.Right} style={{ width: 10, height: 10, background: 'var(--surface2)', border: '2px solid #b080f8', right: -6 }} />
    </div>
  )
}
