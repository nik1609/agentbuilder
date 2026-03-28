'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { ToggleLeft } from 'lucide-react'
import { NodeData, SwitchCase } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

const COLOR = '#ffd600'
const BG = 'rgba(255,214,0,0.12)'

export default function SwitchNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const cases = (d.cases as SwitchCase[] | undefined) ?? []
  const switchType = (d.switchType as string | undefined) ?? 'value_match'

  const TYPE_LABEL: Record<string, string> = {
    value_match: 'match',
    expression: 'expr',
    llm_classify: 'LLM',
  }

  // Spread case handles evenly on right
  const handleCount = Math.max(cases.length, 2)

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
          <ToggleLeft size={11} color={COLOR} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: COLOR }}>Switch</span>
        <span style={{ fontSize: 9, color: COLOR, opacity: 0.7, marginLeft: 'auto' }}>{TYPE_LABEL[switchType] ?? switchType}</span>
      </div>
      <div style={{ padding: '8px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <NodeIdChip id={id} />
        </div>
        {cases.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {cases.slice(0, 4).map((c, idx) => (
              <div key={idx} style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: 2, background: COLOR, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{c.label}</span>
                {c.match && <span style={{ opacity: 0.6 }}>= {c.match.slice(0, 20)}</span>}
              </div>
            ))}
            {d.defaultCase && (
              <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>default → {d.defaultCase}</div>
            )}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Top} title="Input — value to match against cases" style={{ width: 10, height: 10, background: 'var(--surface2)', border: `2px solid ${COLOR}`, top: -6 }} />
      {/* Dynamic case output handles — distributed along bottom */}
      {Array.from({ length: handleCount }).map((_, idx) => {
        const pct = ((idx + 0.75) / (handleCount + 0.5)) * 100
        const caseLabel = cases[idx]?.label ?? `case-${idx}`
        return (
          <Handle
            key={caseLabel}
            type="source"
            position={Position.Bottom}
            id={caseLabel}
            title={`Case "${caseLabel}" — routes here when matched`}
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
      {/* Default handle at bottom-right */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        title="Default — routes here when no case matches"
        style={{ width: 10, height: 10, background: 'var(--surface2)', border: `2px solid ${COLOR}80`, bottom: -6, left: '92%', transform: 'translateX(-50%)' }}
      />
    </div>
  )
}
