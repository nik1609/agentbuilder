'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { GitFork } from 'lucide-react'
import { NodeData, ForkBranch } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

const COLOR = '#26c6da'
const BG = 'rgba(38,198,218,0.15)'

export default function ForkNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const branches = (d.branches as ForkBranch[] | undefined) ?? []

  // Distribute branch handles evenly on the right side
  const branchCount = Math.max(branches.length, 2)

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
          <GitFork size={11} color={COLOR} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: COLOR }}>Fork</span>
        <span style={{ fontSize: 9, color: COLOR, opacity: 0.7, marginLeft: 'auto' }}>{branchCount} branches</span>
      </div>
      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <NodeIdChip id={id} />
        </div>
        {branches.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {branches.slice(0, 4).map(b => (
              <div key={b.id} style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR, flexShrink: 0 }} />
                {b.label}
              </div>
            ))}
            {branches.length > 4 && <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{branches.length - 4} more</div>}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Top} title="Input — broadcasts to all branches" style={{ width: 10, height: 10, background: 'var(--surface2)', border: `2px solid ${COLOR}`, top: -6 }} />
      {/* Dynamic branch output handles — distributed along bottom */}
      {Array.from({ length: branchCount }).map((_, idx) => {
        const pct = ((idx + 1) / (branchCount + 1)) * 100
        const branchId = branches[idx]?.id ?? `branch-${idx}`
        const branchLabel = branches[idx]?.label ?? `Branch ${idx + 1}`
        return (
          <Handle
            key={branchId}
            type="source"
            position={Position.Bottom}
            id={branchId}
            title={`${branchLabel} — connect to first node of this branch`}
            style={{
              width: 10, height: 10,
              background: 'var(--surface2)',
              border: `2px solid ${COLOR}`,
              bottom: -6,
              left: `${pct}%`,
              transform: 'translateX(-50%)',
            }}
          />
        )
      })}
    </div>
  )
}
