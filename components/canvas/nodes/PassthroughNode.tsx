'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { ArrowRightLeft } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

const color = '#64b5f6'

export default function PassthroughNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const template = (d.template as string) ?? ''
  const preview = template.trim()
    ? template.length > 60 ? template.slice(0, 60) + '…' : template
    : '{{last_output}}'

  return (
    <div style={{
      minWidth: 160, maxWidth: 220, borderRadius: 12, overflow: 'visible', cursor: 'grab',
      background: 'var(--surface2)', border: `1px solid ${color}40`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    }}>
      <Handle type="target" position={Position.Left} style={{ width: 10, height: 10, background: 'var(--surface)', border: `2px solid ${color}`, left: -6 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px 6px', borderBottom: `1px solid ${color}20` }}>
        <div style={{ width: 18, height: 18, borderRadius: 5, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowRightLeft size={9} color={color} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color }}>I/O</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text2)', marginLeft: 2 }}>{d.label}</span>
      </div>
      <div style={{ padding: '7px 12px 9px' }}>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)', lineHeight: 1.4, wordBreak: 'break-all' }}>
          {preview}
        </div>
      </div>
      {selected && <NodeIdChip id={id} />}
      <Handle type="source" position={Position.Right} style={{ width: 10, height: 10, background: 'var(--surface)', border: `2px solid ${color}`, right: -6 }} />
    </div>
  )
}
