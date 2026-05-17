'use client'
import { useCallback } from 'react'
import { EdgeProps, BaseEdge, getSmoothStepPath, EdgeLabelRenderer, useReactFlow } from '@xyflow/react'

export default function EditableEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style = {}, markerEnd, label, data, selected,
}: EdgeProps) {
  const { setEdges, getViewport } = useReactFlow()

  const midOffsetX = (data?.midOffsetX as number) ?? 0
  const midOffsetY = (data?.midOffsetY as number) ?? 0
  const hasMidpoint = midOffsetX !== 0 || midOffsetY !== 0

  const baseMidX = (sourceX + targetX) / 2
  const baseMidY = (sourceY + targetY) / 2
  const midX = baseMidX + midOffsetX
  const midY = baseMidY + midOffsetY

  let edgePath: string
  let labelX: number
  let labelY: number

  if (hasMidpoint) {
    // Two straight segments through the dragged midpoint
    edgePath = `M ${sourceX},${sourceY} L ${midX},${midY} L ${targetX},${targetY}`
    labelX = midX
    labelY = midY
  } else {
    const [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
    edgePath = path
    labelX = lx
    labelY = ly
  }

  const onMidDragStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const startClientX = e.clientX
    const startClientY = e.clientY
    const startOffX = (data?.midOffsetX as number) ?? 0
    const startOffY = (data?.midOffsetY as number) ?? 0

    const onMove = (me: MouseEvent) => {
      const { zoom } = getViewport()
      const dx = (me.clientX - startClientX) / zoom
      const dy = (me.clientY - startClientY) / zoom
      setEdges(eds => eds.map(edge =>
        edge.id === id
          ? { ...edge, data: { ...edge.data, midOffsetX: startOffX + dx, midOffsetY: startOffY + dy } }
          : edge
      ))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [id, data, setEdges, getViewport])

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEdges(eds => eds.map(edge =>
      edge.id === id
        ? { ...edge, data: { ...edge.data, midOffsetX: 0, midOffsetY: 0 } }
        : edge
    ))
  }, [id, setEdges])

  const edgeColor = (style as React.CSSProperties).stroke as string | undefined

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />

      {/* Midpoint drag handle — visible when selected or already has a custom midpoint */}
      {(selected || hasMidpoint) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            onMouseDown={onMidDragStart}
            onDoubleClick={onDoubleClick}
            title="Drag to reshape. Double-click to reset."
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)`,
              pointerEvents: 'all',
              cursor: 'grab',
              width: 10, height: 10,
              borderRadius: '50%',
              background: 'var(--bg)',
              border: `2px solid ${edgeColor ?? 'var(--border)'}`,
              zIndex: 1000,
            }}
          />
        </EdgeLabelRenderer>
      )}

      {/* Edge label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: 10, fontWeight: 600,
              color: 'var(--text3)',
              background: 'var(--bg)',
              padding: '1px 5px',
              borderRadius: 4,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
