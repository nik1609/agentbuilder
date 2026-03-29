'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { HelpCircle } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

const COLOR = '#f472b6'
const BG = 'rgba(244,114,182,0.15)'

export default function ClarifyNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  return (
    <div style={{
      minWidth: 180, borderRadius: 12, overflow: 'hidden', cursor: 'grab',
      background: 'var(--surface)',
      borderStyle: 'solid',
      borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 3,
      borderTopColor: selected ? COLOR : 'var(--border)',
      borderRightColor: selected ? COLOR : 'var(--border)',
      borderBottomColor: selected ? COLOR : 'var(--border)',
      borderLeftColor: COLOR,
      boxShadow: selected ? `0 0 0 2px ${COLOR}4d, 0 4px 20px rgba(0,0,0,0.4)` : '0 2px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 6px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HelpCircle size={11} color={COLOR} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: COLOR }}>Clarify</span>
      </div>
      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <NodeIdChip id={id} />
        </div>
        {d.clarifyMode === 'static' ? (
          <div style={{ fontSize: 10, color: COLOR, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontStyle: 'italic' }}>
            &ldquo;{String(d.staticQuestion || 'Please provide more details.').slice(0, 60)}&rdquo;
          </div>
        ) : d.clarifySystemPrompt ? (
          <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {String(d.clarifySystemPrompt).slice(0, 60)}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 }}>LLM-generated question</div>
        )}
      </div>
      <Handle type="target" position={Position.Top} title="Input — LLM reads this to generate a clarifying question" style={{ width: 10, height: 10, background: 'var(--surface2)', border: `2px solid ${COLOR}`, top: -6 }} />
      <Handle type="source" position={Position.Bottom} title="Output — continues after user answers (answer included in context)" style={{ width: 10, height: 10, background: 'var(--surface2)', border: `2px solid ${COLOR}`, bottom: -6 }} />
    </div>
  )
}
