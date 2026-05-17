'use client'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Wrench } from 'lucide-react'
import { NodeData } from '@/types/agent'
import NodeIdChip from './NodeIdChip'

const COLOR = '#22d79a'

const TYPE_LABELS: Record<string, string> = {
  http: 'HTTP', web_search: 'Search', web_scrape: 'Scrape', datatable: 'Table',
}

export default function ToolNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const cfg = d.toolConfig as Record<string, unknown> | undefined
  const toolType = (cfg?.type as string) ?? 'http'
  const typeLabel = TYPE_LABELS[toolType] ?? toolType

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px 8px', borderBottom: '1px solid var(--border2)', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: `${COLOR}14`, flexShrink: 0 }}>
          <Wrench size={10} color={COLOR} />
          <span style={{ fontSize: 8, fontWeight: 800, color: COLOR, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Action</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.label}
        </span>
        <NodeIdChip id={id} />
      </div>

      <div style={{ padding: '6px 12px 9px', borderRadius: '0 0 12px 12px', overflow: 'hidden', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: d.toolName ? 'var(--text2)' : 'var(--text4)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.toolName ? String(d.toolName) : 'No tool configured'}
        </span>
        {d.toolName && (
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${COLOR}14`, color: COLOR, fontWeight: 700, flexShrink: 0 }}>
            {typeLabel}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom}
        style={{ width: 10, height: 10, background: 'var(--bg)', border: `2px solid ${COLOR}`, bottom: -6 }} />
    </div>
  )
}
