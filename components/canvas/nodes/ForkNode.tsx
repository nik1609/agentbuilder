'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { GitFork } from 'lucide-react'
import { NodeData, ForkBranch } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

const COLOR = '#26c6da'

export default function ForkNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const branches = (d.branches as ForkBranch[] | undefined) ?? []
  const branchCount = Math.max(branches.length, 2)

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
      <Handle type="target" position={Position.Top}
        style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid ${COLOR}`, top: -6 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px 8px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: `${COLOR}14`, flexShrink: 0 }}>
          <GitFork size={10} color={COLOR} />
          <span style={{ fontSize: 8, fontWeight: 800, color: COLOR, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Fork</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.label}
        </span>
        <NodeIdChip id={id} />
      </div>

      <div style={{ padding: '6px 12px 9px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {branches.slice(0, 4).map((b, idx) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)', minWidth: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</span>
            </div>
          ))}
          {branches.length === 0 && (
            <span style={{ fontSize: 11, color: 'var(--text4)' }}>{branchCount} branches (parallel)</span>
          )}
          {branches.length > 4 && (
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>+{branches.length - 4} more</span>
          )}
        </div>
      </div>

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
            title={branchLabel}
            style={{
              width: 10, height: 10,
              background: 'var(--bg)',
              border: `2px solid ${COLOR}`,
              bottom: -6, left: `${pct}%`, transform: 'translateX(-50%)',
            }}
          />
        )
      })}
    </div>
  )
}
