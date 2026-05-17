'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Play, ArrowUp } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

export default function InputOutputNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const isInput = d.nodeType === 'input'
  const COLOR = isInput ? '#5ED7F7' : '#6B7280'

  const fieldName = (d.inputField as string) || 'message'
  const hasDefault = !!(d.inputDefault as string | undefined)
  const description = d.description as string | undefined

  return (
    <div style={{
      minWidth: 170, maxWidth: 240,
      borderRadius: 12, overflow: 'visible', cursor: 'grab',
      background: 'var(--bg)',
      border: `1.5px solid ${selected ? COLOR : 'var(--border)'}`,
      boxShadow: selected
        ? `0 0 0 3px ${COLOR}1A, 0 4px 16px rgba(0,0,0,0.1)`
        : '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}>
      {!isInput && (
        <Handle type="target" position={Position.Top}
          style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid ${COLOR}`, top: -6 }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px 8px', borderBottom: isInput ? '1px solid var(--border2)' : 'none', borderRadius: isInput ? '12px 12px 0 0' : 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: `${COLOR}14`, flexShrink: 0 }}>
          {isInput ? <Play size={9} color={COLOR} fill={COLOR} /> : <ArrowUp size={10} color={COLOR} />}
          <span style={{ fontSize: 8, fontWeight: 800, color: COLOR, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {isInput ? 'Start' : 'End'}
          </span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.label}
        </span>
        <NodeIdChip id={id} />
      </div>

      {/* Body — only for Start node, shows API contract */}
      {isInput && (
        <div style={{ padding: '6px 12px 9px', borderRadius: '0 0 12px 12px', overflow: 'hidden', background: 'var(--bg)' }}>
          {description && (
            <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, margin: '0 0 6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {description}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text3)' }}>API field:</span>
            <code style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: COLOR, background: `${COLOR}12`, padding: '1px 6px', borderRadius: 4 }}>
              {fieldName}
            </code>
            {hasDefault && (
              <span style={{ fontSize: 9, color: 'var(--text4)', marginLeft: 2 }}>· has default</span>
            )}
          </div>
        </div>
      )}

      {isInput && (
        <Handle type="source" position={Position.Bottom}
          style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid ${COLOR}`, bottom: -6 }} />
      )}
    </div>
  )
}
