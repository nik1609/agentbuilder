'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { ToggleLeft } from 'lucide-react'
import { NodeData, SwitchCase } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

const COLOR = '#f59e0b'

const MODE_LABEL: Record<string, string> = {
  value_match:  'Exact match',
  expression:   'Expression',
  llm_classify: 'AI classify',
}

export default function SwitchNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const cases = (d.cases as SwitchCase[] | undefined) ?? []
  const switchType = (d.switchType as string | undefined) ?? 'value_match'
  const handleCount = Math.max(cases.length, 2)

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

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px 8px', borderBottom: '1px solid var(--border2)', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: `${COLOR}14`, flexShrink: 0 }}>
          <ToggleLeft size={10} color={COLOR} />
          <span style={{ fontSize: 8, fontWeight: 800, color: COLOR, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Switch</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.label}
        </span>
        <NodeIdChip id={id} />
      </div>

      {/* Body */}
      <div style={{ padding: '6px 12px 9px', borderRadius: '0 0 12px 12px', overflow: 'hidden', background: 'var(--bg)' }}>
        {/* Mode badge */}
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${COLOR}12`, color: COLOR, fontWeight: 700, marginBottom: 5, display: 'inline-block' }}>
          {MODE_LABEL[switchType] ?? switchType}
        </span>

        {/* Case list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {cases.slice(0, 4).map((c, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)', minWidth: 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: 2, background: COLOR, flexShrink: 0, opacity: 0.7 }} />
              <span style={{ fontWeight: 500, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{((c as unknown) as Record<string,string>).targetLabel ?? c.label}</span>
              {c.match && switchType !== 'llm_classify' && (
                <span style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'monospace', flexShrink: 0 }}>{c.match.slice(0, 14)}</span>
              )}
            </div>
          ))}
          {cases.length === 0 && (
            <span style={{ fontSize: 11, color: 'var(--text4)' }}>No cases defined</span>
          )}
          {cases.length > 4 && (
            <span style={{ fontSize: 10, color: 'var(--text4)' }}>+{cases.length - 4} more</span>
          )}
        </div>
      </div>

      {/* Dynamic case handles along bottom */}
      {Array.from({ length: handleCount }).map((_, idx) => {
        const pct = ((idx + 0.75) / (handleCount + 0.5)) * 100
        const caseLabel = cases[idx]?.label ?? `case-${idx}`
        return (
          <Handle key={idx} type="source" position={Position.Bottom} id={caseLabel} title={caseLabel}
            style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid ${COLOR}`, bottom: -6, left: `${pct}%`, transform: 'translateX(-50%)' }}
          />
        )
      })}
      <Handle type="source" position={Position.Bottom} id="default" title="Default"
        style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid ${COLOR}60`, bottom: -6, left: '92%', transform: 'translateX(-50%)' }}
      />
    </div>
  )
}
