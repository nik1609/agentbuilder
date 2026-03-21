'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Wrench } from 'lucide-react'
import { NodeData } from '@/types/agent'

export default function ToolNode({ data, selected }: NodeProps) {
  const d = data as NodeData
  return (
    <div style={{
      minWidth: 180, borderRadius: 12, overflow: 'hidden', cursor: 'grab',
      background: 'var(--surface)',
      border: `1px solid ${selected ? '#22d79a' : 'var(--border)'}`,
      boxShadow: selected ? '0 0 0 2px rgba(34,215,154,0.3), 0 4px 20px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.3)',
      borderLeft: '3px solid #22d79a',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 6px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(34,215,154,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Wrench size={11} color="#22d79a" />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22d79a' }}>Tool</span>
      </div>
      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3, lineHeight: 1.3 }}>{d.label}</div>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{String(d.toolName ?? 'No tool set')}</div>
      </div>
      <Handle type="target" position={Position.Left} style={{ width: 10, height: 10, background: 'var(--surface2)', border: '2px solid #22d79a', left: -6 }} />
      <Handle type="source" position={Position.Right} style={{ width: 10, height: 10, background: 'var(--surface2)', border: '2px solid #22d79a', right: -6 }} />
    </div>
  )
}
