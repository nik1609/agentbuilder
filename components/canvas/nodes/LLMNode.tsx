'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Brain } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

export default function LLMNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  return (
    <div style={{
      minWidth: 180, borderRadius: 12, overflow: 'hidden', cursor: 'grab',
      background: 'var(--surface)',
      borderStyle: 'solid',
      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 3,
      borderTopColor: selected ? '#7c6ff0' : 'var(--border)', borderRightColor: selected ? '#7c6ff0' : 'var(--border)', borderBottomColor: selected ? '#7c6ff0' : 'var(--border)', borderLeftColor: '#7c6ff0',
      boxShadow: selected ? '0 0 0 2px rgba(124,111,240,0.3), 0 4px 20px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.3)',
    }}>
      {/* Type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 6px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(124,111,240,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Brain size={11} color="#7c6ff0" />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c6ff0' }}>LLM</span>
      </div>
      {/* Content */}
      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3, lineHeight: 1.3 }}>{d.label}</div>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{d.model ?? 'gemini-2.5-flash'}</div>
        {d.systemPrompt && (
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {String(d.systemPrompt).slice(0, 60)}…
          </div>
        )}
      </div>
      {selected && <NodeIdChip id={id} />}
      <Handle type="target" position={Position.Left} style={{ width: 10, height: 10, background: 'var(--surface2)', border: '2px solid #7c6ff0', left: -6 }} />
      <Handle type="source" position={Position.Right} style={{ width: 10, height: 10, background: 'var(--surface2)', border: '2px solid #7c6ff0', right: -6 }} />
    </div>
  )
}
