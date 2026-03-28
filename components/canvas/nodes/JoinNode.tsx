'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Merge } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

const COLOR = '#26c6da'
const BG = 'rgba(38,198,218,0.15)'

const FORMAT_LABELS: Record<string, string> = {
  array: '[ ]',
  object: '{ }',
  concatenated: '...',
}

export default function JoinNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const mergeFormat = (d.mergeFormat as string | undefined) ?? 'array'
  const joinMode = (d.joinMode as string | undefined) ?? 'wait_all'

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
          <Merge size={11} color={COLOR} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: COLOR }}>Join</span>
        <span style={{ fontSize: 9, color: COLOR, opacity: 0.7, marginLeft: 'auto' }}>{FORMAT_LABELS[mergeFormat] ?? mergeFormat}</span>
      </div>
      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <NodeIdChip id={id} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)' }}>
          {joinMode === 'wait_all' ? 'wait all' : joinMode === 'wait_first' ? 'first wins' : `wait ${d.joinN ?? 1}`}
          {d.mergeAs ? ` → ${d.mergeAs}` : ''}
        </div>
      </div>
      {/* Multiple inputs from above — distributed */}
      <Handle type="target" position={Position.Top} id="join-in-1" title="Branch input 1 — connect first fork branch here" style={{ width: 10, height: 10, background: 'var(--surface2)', border: `2px solid ${COLOR}`, top: -6, left: '30%', transform: 'translateX(-50%)' }} />
      <Handle type="target" position={Position.Top} id="join-in-2" title="Branch input 2 — connect second fork branch here" style={{ width: 10, height: 10, background: 'var(--surface2)', border: `2px solid ${COLOR}`, top: -6, left: '70%', transform: 'translateX(-50%)' }} />
      <Handle type="source" position={Position.Bottom} title="Merged output — connect to next node" style={{ width: 10, height: 10, background: 'var(--surface2)', border: `2px solid ${COLOR}`, bottom: -6 }} />
    </div>
  )
}
