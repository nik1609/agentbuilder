'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, BackgroundVariant,
  addEdge, Connection, useNodesState, useEdgesState, Node, Edge,
  NodeChange, EdgeChange, ConnectionMode, ReactFlowInstance, reconnectEdge,
} from '@xyflow/react'
import { Undo2, Redo2, Brain, Wrench, GitBranch, ToggleLeft, RefreshCw, GitFork, Merge, UserCheck, HelpCircle, Shuffle, Sparkles } from 'lucide-react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'
import EditableEdge from './EditableEdge'
import LLMNode from './nodes/LLMNode'
import ToolNode from './nodes/ToolNode'
import ConditionNode from './nodes/ConditionNode'
import HITLNode from './nodes/HITLNode'
import InputOutputNode from './nodes/InputOutputNode'
import PassthroughNode from './nodes/PassthroughNode'
import LoopNode from './nodes/LoopNode'
import ForkNode from './nodes/ForkNode'
import JoinNode from './nodes/JoinNode'
import SwitchNode from './nodes/SwitchNode'
import ClarifyNode from './nodes/ClarifyNode'
import NodeConfigPanel from './NodeConfigPanel'
import { NodeData, AgentNode, AgentEdge } from '@/types/agent'
import { v4 as uuidv4 } from 'uuid'

const nodeTypes = {
  llm: LLMNode,
  tool: ToolNode,
  condition: ConditionNode,
  hitl: HITLNode,
  clarify: ClarifyNode,
  input: InputOutputNode,
  output: InputOutputNode,
  passthrough: PassthroughNode,
  loop: LoopNode,
  fork: ForkNode,
  join: JoinNode,
  switch: SwitchNode,
}

const edgeTypes = {
  editable: EditableEdge,
}

const NODE_COLORS: Record<string, string> = {
  llm: '#7c6ff0', tool: '#22d79a', condition: '#f5a020', switch: '#f59e0b',
  loop: '#ff7043', fork: '#26c6da', join: '#26c6da', hitl: '#b080f8',
  clarify: '#f472b6', passthrough: '#64b5f6', input: '#5ED7F7', output: '#6B7280',
}

const DEFAULT_EDGE_STYLE = {
  stroke: '#C8C8D0',
  strokeWidth: 1.5,
  strokeDasharray: undefined as string | undefined,
}

function edgeStyleForSourceType(type: string | undefined) {
  const color = NODE_COLORS[type ?? ''] ?? '#C8C8D0'
  return {
    style: { stroke: color, strokeWidth: 1.5 },
    markerEnd: { type: 'arrowclosed' as const, color, width: 16, height: 16 },
  }
}

const defaultNodes: Node[] = [
  { id: 'input-1', type: 'input', position: { x: 180, y: 60 }, data: { label: 'Start', nodeType: 'input', inputField: 'message' } },
  { id: 'output-1', type: 'output', position: { x: 180, y: 400 }, data: { label: 'End', nodeType: 'output' } },
]

interface AgentCanvasProps {
  initialNodes?: AgentNode[]
  initialEdges?: AgentEdge[]
  onSchemaChange?: (schema: { nodes: AgentNode[]; edges: AgentEdge[] }) => void
  onNodeSelect?: (id: string | null, data: NodeData | null) => void
  onAfterToolSave?: () => void
}

export default function AgentCanvas({
  initialNodes,
  initialEdges,
  onSchemaChange,
  onNodeSelect,
  onAfterToolSave,
}: AgentCanvasProps) {
  const initNodes = initialNodes && initialNodes.length > 0
    ? (initialNodes as unknown as Node[])
    : defaultNodes

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (initialEdges as unknown as Edge[]) ?? []
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const syncRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Refs to always have current values in callbacks (prevents stale closure bug)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges
  // Track which node started a connection drag — restore its panel selection on connect end
  const connectingFromRef = useRef<string | null>(null)
  // Tracks positions claimed by addNode BEFORE React re-renders — prevents same-tick overlaps
  const pendingPositions = useRef<{ x: number; y: number }[]>([])
  // Clear pending once React state has caught up (nodes length changed)
  useEffect(() => { pendingPositions.current = [] }, [nodes.length])

  // Auto-sync schema with debounce
  const scheduleSync = useCallback((ns: Node[], es: Edge[]) => {
    if (syncRef.current) clearTimeout(syncRef.current)
    syncRef.current = setTimeout(() => {
      onSchemaChange?.({
        nodes: ns as unknown as AgentNode[],
        edges: es as unknown as AgentEdge[],
      })
    }, 300)
  }, [onSchemaChange])

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  const pastRef   = useRef<{ nodes: Node[]; edges: Edge[] }[]>([])
  const futureRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const snapshot = useCallback(() => {
    pastRef.current = [...pastRef.current.slice(-49), { nodes: nodesRef.current, edges: edgesRef.current }]
    futureRef.current = []
    setCanUndo(true)
    setCanRedo(false)
  }, [])

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return
    const prev = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [{ nodes: nodesRef.current, edges: edgesRef.current }, ...futureRef.current.slice(0, 49)]
    setNodes(prev.nodes)
    setEdges(prev.edges)
    scheduleSync(prev.nodes, prev.edges)
    setCanUndo(pastRef.current.length > 0)
    setCanRedo(true)
  }, [setNodes, setEdges, scheduleSync])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current[0]
    futureRef.current = futureRef.current.slice(1)
    pastRef.current = [...pastRef.current.slice(-49), { nodes: nodesRef.current, edges: edgesRef.current }]
    setNodes(next.nodes)
    setEdges(next.edges)
    scheduleSync(next.nodes, next.edges)
    setCanUndo(true)
    setCanRedo(futureRef.current.length > 0)
  }, [setNodes, setEdges, scheduleSync])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const hasRemove = changes.some(c => c.type === 'remove')
    const filtered = changes.filter(c => {
      if (c.type !== 'remove') return true
      const node = nodesRef.current.find(n => n.id === c.id)
      return node?.type !== 'input' && node?.type !== 'output'
    })
    if (hasRemove && filtered.some(c => c.type === 'remove')) snapshot()
    onNodesChange(filtered)
    setNodes(nds => {
      scheduleSync(nds, edgesRef.current)
      return nds
    })
  }, [onNodesChange, setNodes, scheduleSync, snapshot])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removals = changes.filter(c => c.type === 'remove')
    if (removals.length) {
      snapshot()
      // Clear targetLabel/branch label for any removed Switch or Fork edges
      const removedIds = new Set(removals.map(c => (c as { id: string }).id))
      const removedEdges = edgesRef.current.filter(e => removedIds.has(e.id))
      if (removedEdges.length) {
        setNodes(nds => nds.map(n => {
          if (n.type === 'switch') {
            const affected = removedEdges.filter(e => e.source === n.id)
            if (!affected.length) return n
            const cases = ((n.data?.cases ?? []) as Array<Record<string, unknown>>).map(c => {
              const wasRemoved = affected.some(e =>
                e.sourceHandle === c.label ||
                (e.label && c.targetLabel && String(e.label) === String(c.targetLabel))
              )
              return wasRemoved ? { ...c, targetLabel: undefined } : c
            })
            return { ...n, data: { ...n.data, cases } }
          }
          if (n.type === 'fork') {
            const affected = removedEdges.filter(e => e.source === n.id)
            if (!affected.length) return n
            const branches = ((n.data?.branches ?? []) as Array<Record<string, unknown>>).map((b, idx) => {
              const wasRemoved = affected.some(e => e.sourceHandle === b.id)
              return wasRemoved ? { ...b, label: `Branch ${idx + 1}` } : b
            })
            return { ...n, data: { ...n.data, branches } }
          }
          return n
        }))
      }
    }
    onEdgesChange(changes)
    setEdges(eds => {
      scheduleSync(nodesRef.current, eds)
      return eds
    })
  }, [onEdgesChange, setEdges, setNodes, scheduleSync, snapshot])

  const truncLabel = (s: string, max = 18) => s.length > max ? s.slice(0, max) + '…' : s

  // For switch/condition/fork nodes, derive a readable label from the sourceHandle
  function edgeLabelForHandle(sourceType: string | undefined, sourceHandle: string | null | undefined, sourceNodeId?: string): string | undefined {
    if (!sourceHandle) return undefined
    if (sourceType === 'condition') {
      if (sourceHandle === 'true') return 'True'
      if (sourceHandle === 'false') return 'False'
    }
    if (sourceType === 'switch') {
      if (sourceHandle === 'default') return 'Default'
      return truncLabel(sourceHandle)
    }
    if (sourceType === 'fork') {
      // sourceHandle is the branch UUID — look up the human label from node data
      const forkNode = nodesRef.current.find(n => n.id === sourceNodeId)
      const branches = (forkNode?.data?.branches as { id: string; label: string }[] | undefined) ?? []
      const branch = branches.find(b => b.id === sourceHandle)
      const label = branch?.label ?? sourceHandle
      return truncLabel(label)
    }
    return undefined
  }

  const onConnect = useCallback((params: Connection) => {
    snapshot()
    const sourceNode = nodesRef.current.find(n => n.id === params.source)
    const targetNode = nodesRef.current.find(n => n.id === params.target)
    const targetLabel = targetNode?.data?.label ? String(targetNode.data.label) : undefined

    setEdges(eds => {
      const { style, markerEnd } = edgeStyleForSourceType(sourceNode?.type)
      const label = (sourceNode?.type === 'switch' || sourceNode?.type === 'fork') && targetLabel
        ? truncLabel(targetLabel)
        : edgeLabelForHandle(sourceNode?.type, params.sourceHandle, params.source ?? undefined)
      const newEdges = addEdge({
        ...params, type: 'smoothstep', animated: false, style, markerEnd,
        ...(label ? { label } : {}),
      }, eds)
      scheduleSync(nodesRef.current, newEdges)
      return newEdges
    })

    // Sync node card labels after manual connection
    if (targetLabel && params.source) {
      setNodes(nds => nds.map(n => {
        if (n.id !== params.source) return n
        if (n.type === 'switch') {
          const cases = ((n.data?.cases ?? []) as Array<Record<string, unknown>>).map(c =>
            c.label === params.sourceHandle ? { ...c, targetLabel } : c
          )
          return { ...n, data: { ...n.data, cases } }
        }
        if (n.type === 'fork') {
          const branches = ((n.data?.branches ?? []) as Array<Record<string, unknown>>).map(b =>
            b.id === params.sourceHandle ? { ...b, label: targetLabel } : b
          )
          return { ...n, data: { ...n.data, branches } }
        }
        return n
      }))
    }
  }, [setEdges, setNodes, scheduleSync, snapshot])

  const onConnectStart = useCallback((_: unknown, { nodeId }: { nodeId: string | null }) => {
    connectingFromRef.current = nodeId
  }, [])

  const onConnectEnd = useCallback(() => {
    const sourceId = connectingFromRef.current
    connectingFromRef.current = null
    if (!sourceId) return
    // Restore the source node's panel after ReactFlow auto-selects the target
    const sourceNode = nodesRef.current.find(n => n.id === sourceId)
    if (sourceNode) {
      setSelectedNodeId(sourceId)
      onNodeSelect?.(sourceId, sourceNode.data as NodeData)
    }
  }, [onNodeSelect])

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    snapshot()
    const sourceNode = nodesRef.current.find(n => n.id === newConnection.source)
    const targetNode = nodesRef.current.find(n => n.id === newConnection.target)
    const targetLabel = targetNode?.data?.label ? String(targetNode.data.label) : undefined

    setEdges(eds => {
      const { style, markerEnd } = edgeStyleForSourceType(sourceNode?.type)
      const label = (sourceNode?.type === 'switch' || sourceNode?.type === 'fork') && targetLabel
        ? truncLabel(targetLabel)
        : edgeLabelForHandle(sourceNode?.type, newConnection.sourceHandle, newConnection.source ?? undefined)
      const updated = reconnectEdge(oldEdge, newConnection, eds)
      // reconnectEdge generates a new edge ID — match by connection properties, not old ID
      return updated.map(e =>
        e.source === newConnection.source &&
        e.sourceHandle === newConnection.sourceHandle &&
        e.target === newConnection.target
          ? { ...e, type: 'smoothstep', animated: false, style, markerEnd, ...(label ? { label } : { label: undefined }) }
          : e
      )
    })

    // Sync node card labels after reconnect
    if (targetLabel && newConnection.source) {
      const oldLabel = oldEdge.label ? String(oldEdge.label) : null
      setNodes(nds => nds.map(n => {
        if (n.id !== newConnection.source) return n
        if (n.type === 'switch') {
          const cases = ((n.data?.cases ?? []) as Array<Record<string, unknown>>).map(c =>
            // Match by sourceHandle OR by old targetLabel (handles legacy edges)
            c.label === newConnection.sourceHandle || (oldLabel && c.targetLabel === oldLabel)
              ? { ...c, targetLabel }
              : c
          )
          return { ...n, data: { ...n.data, cases } }
        }
        if (n.type === 'fork') {
          const branches = ((n.data?.branches ?? []) as Array<Record<string, unknown>>).map(b =>
            b.id === newConnection.sourceHandle || (oldLabel && b.label === oldLabel)
              ? { ...b, label: targetLabel }
              : b
          )
          return { ...n, data: { ...n.data, branches } }
        }
        return n
      }))
    }
  }, [setEdges, setNodes, snapshot])

  // Sync edge data (midpoint offsets) back to agent schema when edges change
  useEffect(() => {
    scheduleSync(nodesRef.current, edges)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges])

  // Color + truncate-label edges on load and whenever edge count changes
  const edgesColoredRef = useRef(false)
  useEffect(() => {
    if (nodes.length === 0 || edges.length === 0) return
    if (edgesColoredRef.current) {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
      const needsUpdate = edges.some(e =>
        e.type === 'editable' ||
        (e.data as Record<string,unknown>)?.midOffsetX !== undefined ||
        (typeof e.label === 'string' && (e.label.length > 19 || uuidRe.test(e.label)))
      )
      if (!needsUpdate) return
    }
    edgesColoredRef.current = true
    const nodeTypeMap = new Map(nodes.map(n => [n.id, n.type ?? '']))

    // Sync switch/fork node card labels from outgoing edges (fixes legacy agents on load)
    setNodes(nds => nds.map(n => {
      if (n.type === 'switch') {
        const outEdges = edges.filter(e => e.source === n.id)
        const cases = ((n.data?.cases ?? []) as Array<Record<string, unknown>>).map(c => {
          const connected = outEdges.find(e => e.sourceHandle === c.label || e.label === c.targetLabel)
          const targetNode = connected ? nodesRef.current.find(x => x.id === connected.target) : null
          return targetNode ? { ...c, targetLabel: String(targetNode.data?.label ?? c.label) } : c
        })
        return { ...n, data: { ...n.data, cases } }
      }
      if (n.type === 'fork') {
        const outEdges = edges.filter(e => e.source === n.id)
        const branches = ((n.data?.branches ?? []) as Array<Record<string, unknown>>).map(b => {
          const connected = outEdges.find(e => e.sourceHandle === b.id)
          const targetNode = connected ? nodesRef.current.find(x => x.id === connected.target) : null
          return targetNode ? { ...b, label: String(targetNode.data?.label ?? b.label) } : b
        })
        return { ...n, data: { ...n.data, branches } }
      }
      return n
    }))

    setEdges(eds => {
      const deduped = eds.filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
      return deduped.map(edge => {
        const sourceType = nodeTypeMap.get(edge.source)
        const { style, markerEnd } = edgeStyleForSourceType(sourceType)
        const targetNode = nodesRef.current.find(n => n.id === edge.target)
        const raw = (sourceType === 'switch' || sourceType === 'fork') && targetNode?.data?.label
          ? String(targetNode.data.label)
          : (edge.label ?? edgeLabelForHandle(sourceType, edge.sourceHandle, edge.source))
        const label = raw ? truncLabel(String(raw)) : undefined
        const { midOffsetX: _x, midOffsetY: _y, ...cleanData } = (edge.data ?? {}) as Record<string, unknown>
        return { ...edge, type: 'smoothstep', animated: false, style, markerEnd, data: cleanData, ...(label ? { label } : {}) }
      })
    })
  }, [nodes.length, edges.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Estimate node height based on type + content (for better dagre layout)
  const estimateNodeHeight = (node: Node): number => {
    const d = node.data as Record<string, unknown>
    const type = node.type ?? d.nodeType
    const HEADER = 46, BODY = 50, CHIP_ROW = 28

    switch (type) {
      case 'input': return HEADER + BODY + 16
      case 'output': return HEADER + BODY - 10
      case 'llm': {
        const hasChips = !!(d.agenticMode || d.guardrailId || (Array.isArray(d.memorySources) && (d.memorySources as unknown[]).length > 0) || (d.retry as {enabled?:boolean})?.enabled)
        return HEADER + BODY + (hasChips ? CHIP_ROW : 0) + 8
      }
      case 'switch': {
        const cases = (d.cases as unknown[] | undefined) ?? []
        return HEADER + 40 + Math.max(cases.length, 2) * 24 + 16
      }
      case 'fork': {
        const branches = (d.branches as unknown[] | undefined) ?? []
        return HEADER + 32 + Math.max(branches.length, 2) * 24 + 16
      }
      case 'condition': return HEADER + BODY + 8
      case 'loop':      return HEADER + BODY + 8
      case 'join':      return HEADER + BODY + 8
      case 'hitl':      return HEADER + BODY + CHIP_ROW
      case 'clarify':   return HEADER + BODY + CHIP_ROW
      case 'tool':      return HEADER + BODY + 8
      case 'passthrough': return HEADER + BODY
      default:          return HEADER + BODY + 8
    }
  }

  // Auto-arrange with dagre
  const autoLayout = useCallback(() => {
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 70 })

    const NODE_W = 250

    // Detect back-edges (loop cycles) via DFS — feed only forward edges to dagre
    const nodeIds = new Set(nodesRef.current.map(n => n.id))
    const color = new Map<string, number>()
    nodeIds.forEach(id => color.set(id, 0))
    const backEdgeSet = new Set<string>()
    const dfs = (id: string) => {
      color.set(id, 1)
      for (const e of edgesRef.current.filter(e => e.source === id)) {
        if (color.get(e.target) === 1) backEdgeSet.add(e.id)
        else if (color.get(e.target) === 0) dfs(e.target)
      }
      color.set(id, 2)
    }
    nodesRef.current.forEach(n => { if (color.get(n.id) === 0) dfs(n.id) })

    nodesRef.current.forEach(n => g.setNode(n.id, { width: NODE_W, height: estimateNodeHeight(n) }))
    edgesRef.current.forEach(e => { if (!backEdgeSet.has(e.id)) g.setEdge(e.source, e.target) })

    dagre.layout(g)
    snapshot()

    const positioned = nodesRef.current.map(n => {
      const pos = g.node(n.id)
      if (!pos) return n
      const h = estimateNodeHeight(n)
      return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - h / 2 } }
    })
    setNodes(positioned)
    scheduleSync(positioned, edgesRef.current)
    setTimeout(() => rfInstance?.fitView({ padding: 0.18, duration: 500 }), 60)
  }, [setNodes, scheduleSync, snapshot, rfInstance])

  const addNode = useCallback((type: 'llm' | 'tool' | 'condition' | 'hitl' | 'clarify' | 'passthrough' | 'loop' | 'fork' | 'join' | 'switch') => {
    const labels: Record<string, string> = {
      passthrough: 'Transform', llm: 'AI Step', tool: 'Action',
      condition: 'Branch', hitl: 'Human Review', clarify: 'Ask User',
      loop: 'Loop', fork: 'Fork', join: 'Join', switch: 'Switch',
    }
    const defaults: Record<string, Partial<NodeData>> = {
      fork: { branches: [{ id: uuidv4(), label: 'Branch A' }, { id: uuidv4(), label: 'Branch B' }] },
      loop: { maxIterations: 5, exitConditionType: 'expression' },
      switch: { switchType: 'value_match', cases: [{ label: 'Case A', match: '' }, { label: 'Case B', match: '' }] },
    }

    // NODE_W/H are conservative upper bounds — Fork with 5 branches is ~300px tall
    const NODE_W = 260, NODE_H = 320, GAP = 50
    // All claimed positions: React state nodes + same-tick pending (not yet in state)
    const allPos = [
      ...nodesRef.current.map(n => n.position),
      ...pendingPositions.current,
    ]
    const hits = (x: number, y: number) => allPos.some(p =>
      x < p.x + NODE_W + GAP && x + NODE_W + GAP > p.x &&
      y < p.y + NODE_H + GAP && y + NODE_H + GAP > p.y
    )
    // Start anchor: just below the lowest existing node
    let anchorX = 100, anchorY = 100
    if (allPos.length > 0) {
      anchorY = Math.max(...allPos.map(p => p.y)) + NODE_H + GAP
      anchorX = Math.round(allPos.reduce((s, p) => s + p.x, 0) / allPos.length)
    }
    // Scan a 4-column × 20-row grid from the anchor until we find an empty slot
    let pos = { x: anchorX, y: anchorY }
    search: for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 4; col++) {
        const cx = anchorX + (col - 1) * (NODE_W + GAP)   // -1, 0, +1, +2 offsets
        const cy = anchorY + row * (NODE_H + GAP)
        if (!hits(cx, cy)) { pos = { x: cx, y: cy }; break search }
      }
    }
    // Reserve immediately — cleared by useEffect once React state catches up
    pendingPositions.current = [...pendingPositions.current, pos]

    const newId = uuidv4()
    const newNode: Node = {
      id: newId,
      type,
      position: pos,
      className: 'node-entering',
      data: { label: labels[type], nodeType: type, ...(defaults[type] ?? {}) } as NodeData,
    }
    snapshot()
    setNodes(nds => {
      const updated = [...nds, newNode]
      scheduleSync(updated, edgesRef.current)
      return updated
    })
    // Remove entrance class after animation completes
    setTimeout(() => {
      setNodes(nds => nds.map(n => n.id === newId ? { ...n, className: undefined } : n))
    }, 400)
  }, [setNodes, scheduleSync, snapshot])

  const addNodeAt = useCallback((type: Parameters<typeof addNode>[0], position: { x: number; y: number }) => {
    const labels: Record<string, string> = {
      passthrough: 'Transform', llm: 'AI Step', tool: 'Action',
      condition: 'Branch', hitl: 'Human Review', clarify: 'Ask User',
      loop: 'Loop', fork: 'Fork', join: 'Join', switch: 'Switch',
    }
    const defaults: Record<string, Partial<NodeData>> = {
      fork: { branches: [{ id: uuidv4(), label: 'Branch A' }, { id: uuidv4(), label: 'Branch B' }] },
      loop: { maxIterations: 5, exitConditionType: 'expression' },
      switch: { switchType: 'value_match', cases: [{ label: 'Case A', match: '' }, { label: 'Case B', match: '' }] },
    }
    const newNode: Node = {
      id: uuidv4(),
      type,
      position,
      data: { label: labels[type], nodeType: type, ...(defaults[type] ?? {}) } as NodeData,
    }
    snapshot()
    setNodes(nds => {
      const updated = [...nds, newNode]
      scheduleSync(updated, edgesRef.current)
      return updated
    })
  }, [setNodes, scheduleSync, snapshot])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/reactflow-nodetype') as Parameters<typeof addNode>[0]
    if (!type || !rfInstance) return
    const position = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    addNodeAt(type, position)
  }, [rfInstance, addNodeAt])

  // Update node data (from config panel)
  const updateNodeData = useCallback((nodeId: string, data: Partial<NodeData>) => {
    snapshot()
    setNodes(nds => {
      const updated = nds.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      )
      scheduleSync(updated, edgesRef.current)
      return updated
    })
  }, [setNodes, scheduleSync, snapshot])

  const selectedNode = nodes.find(n => n.id === selectedNodeId)
  const selectedNodeData = selectedNode?.data as NodeData | undefined

  const NODE_PALETTE: { type: Parameters<typeof addNode>[0]; Icon: React.ElementType; label: string; color: string; group?: string }[] = [
    // Processing
    { type: 'llm',         Icon: Brain,         label: 'AI Step',     color: '#7c6ff0', group: 'processing' },
    { type: 'tool',        Icon: Wrench,         label: 'Action',      color: '#22d79a', group: 'processing' },
    { type: 'passthrough', Icon: Shuffle,        label: 'Transform',   color: '#64b5f6', group: 'processing' },
    // Routing
    { type: 'condition',   Icon: GitBranch,      label: 'Branch',      color: '#f5a020', group: 'routing' },
    { type: 'switch',      Icon: ToggleLeft,     label: 'Switch',      color: '#f59e0b', group: 'routing' },
    // Parallel
    { type: 'fork',        Icon: GitFork,        label: 'Fork',        color: '#26c6da', group: 'parallel' },
    { type: 'join',        Icon: Merge,          label: 'Join',        color: '#26c6da', group: 'parallel' },
    // Control
    { type: 'loop',        Icon: RefreshCw,      label: 'Loop',        color: '#ff7043', group: 'control' },
    // Human
    { type: 'hitl',        Icon: UserCheck,      label: 'Human Review', color: '#b080f8', group: 'human' },
    { type: 'clarify',     Icon: HelpCircle,     label: 'Ask User',    color: '#f472b6', group: 'human' },
  ]

  const Tip = ({ label }: { label: string }) => (
    <div style={{
      position: 'absolute', left: 'calc(100% + 10px)', top: '50%', transform: 'translateY(-50%)',
      background: '#0D0D0D', color: '#fff', fontSize: 11, fontWeight: 600,
      padding: '4px 9px', borderRadius: 6, whiteSpace: 'nowrap', pointerEvents: 'none',
      opacity: 0, transition: 'opacity 0.12s 0.25s', zIndex: 9999, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }} className="pal-tip">{label}</div>
  )

  const PalBtn = ({ tip, onClick, disabled, children, first }: { tip: string; onClick?: () => void; disabled?: boolean; children: React.ReactNode; first?: boolean }) => (
    <div style={{ position: 'relative', width: '100%' }}
      onMouseEnter={e => { const t = e.currentTarget.querySelector('.pal-tip') as HTMLElement; if (t) t.style.opacity = '1' }}
      onMouseLeave={e => { const t = e.currentTarget.querySelector('.pal-tip') as HTMLElement; if (t) t.style.opacity = '0' }}>
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 32, border: 'none', borderRadius: first ? '9px 9px 0 0' : 0,
      background: 'transparent',
      color: disabled ? 'var(--text4)' : 'var(--text3)',
      cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? 0.3 : 1, transition: 'background 0.1s, color 0.1s',
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = disabled ? 'var(--text4)' : 'var(--text3)' }}
    >{children}</button>
    <Tip label={tip} />
    </div>
  )

  return (
    <div className="w-full h-full relative flex">

      <div className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>

        {/* ── Floating node palette — absolute, not full height ────────── */}
        <div style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', alignItems: 'stretch',
          padding: 0, gap: 0, zIndex: 10, overflow: 'visible', width: 40,
        }}>

          {/* Undo / Redo */}
          <PalBtn tip="Undo (⌘Z)" onClick={undo} disabled={!canUndo} first><Undo2 size={13} /></PalBtn>
          <PalBtn tip="Redo (⌘⇧Z)" onClick={redo} disabled={!canRedo}><Redo2 size={13} /></PalBtn>

          <div style={{ width: '100%', height: 1, background: 'var(--border)', flexShrink: 0 }} />

          {/* Node type buttons — grouped with signature colors */}
          {NODE_PALETTE.map(({ type, Icon, label, color, group }, idx) => {
            const prevGroup = idx > 0 ? NODE_PALETTE[idx - 1].group : group
            const showDivider = idx > 0 && group !== prevGroup
            return (
              <React.Fragment key={type}>
                {showDivider && <div style={{ width: '100%', height: 1, background: 'var(--border2)', flexShrink: 0 }} />}
                {/* Color on the div, tooltip outside overflow */}
                <div style={{ position: 'relative', width: '100%' }}
                  onMouseEnter={e => { const t = e.currentTarget.querySelector('.pal-tip') as HTMLElement; if (t) t.style.opacity = '1' }}
                  onMouseLeave={e => { const t = e.currentTarget.querySelector('.pal-tip') as HTMLElement; if (t) t.style.opacity = '0' }}>
                  <div
                    style={{ width: '100%', background: `${color}10`, transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${color}22`)}
                    onMouseLeave={e => (e.currentTarget.style.background = `${color}10`)}
                  >
                    <button
                      onClick={() => addNode(type)} draggable
                      onDragStart={e => { e.dataTransfer.setData('application/reactflow-nodetype', type); e.dataTransfer.effectAllowed = 'move' }}
                      style={{ width: '100%', height: 32, border: 'none', borderRadius: 0, padding: 0,
                        background: 'transparent', color: `${color}DD`, cursor: 'grab',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = color }}
                      onMouseLeave={e => { e.currentTarget.style.color = `${color}DD` }}
                    ><Icon size={14} /></button>
                  </div>
                  <Tip label={label} />
                </div>
              </React.Fragment>
            )
          })}

          {/* Auto-arrange */}
          <div style={{ width: '100%', height: 1, background: 'var(--border)', flexShrink: 0 }} />
          <div style={{ position: 'relative', width: '100%' }}
            onMouseEnter={e => { const t = e.currentTarget.querySelector('.pal-tip') as HTMLElement; if (t) t.style.opacity = '1' }}
            onMouseLeave={e => { const t = e.currentTarget.querySelector('.pal-tip') as HTMLElement; if (t) t.style.opacity = '0' }}>
            <div
              style={{ width: '100%', background: 'rgba(37,99,235,0.08)', transition: 'background 0.1s', borderRadius: '0 0 9px 9px' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(37,99,235,0.08)')}
            >
              <button onClick={autoLayout} style={{
                width: '100%', height: 32, border: 'none', borderRadius: '0 0 9px 9px', padding: 0,
                background: 'transparent', color: 'rgba(37,99,235,0.7)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.1s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(37,99,235,0.7)' }}
              ><Sparkles size={14} /></button>
            </div>
            <Tip label="Auto-arrange" />
          </div>

        </div>{/* end palette */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onReconnect={onReconnect}
          onNodeDragStart={snapshot}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id)
            onNodeSelect?.(node.id, node.data as NodeData)
          }}
          onPaneClick={() => {
            setSelectedNodeId(null)
            onNodeSelect?.(null, null)
          }}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: false,
            style: DEFAULT_EDGE_STYLE,
            markerEnd: { type: 'arrowclosed' as const, color: '#C8C8D0', width: 16, height: 16 },
          }}
          connectionMode={ConnectionMode.Strict}
          connectionRadius={40}
          onInit={setRfInstance}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode="Delete"
          snapToGrid
          snapGrid={[16, 16]}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="#DADADE" />
          <Controls position="bottom-right" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} />
        </ReactFlow>
      </div>{/* end canvas column */}

      {/* Node config panel */}
      {selectedNodeId && selectedNodeData && (
        <NodeConfigPanel
          key={selectedNodeId}
          nodeId={selectedNodeId}
          nodeData={selectedNodeData}
          allNodes={nodes.map(n => ({ id: n.id, data: { label: String(n.data.label ?? ''), nodeType: String(n.data.nodeType ?? '') } }))}
          onUpdate={(data) => updateNodeData(selectedNodeId, data)}
          onClose={() => setSelectedNodeId(null)}
          onAfterToolSave={onAfterToolSave}
          outgoingEdges={edges.filter(e => e.source === selectedNodeId).map(e => ({ sourceHandle: e.sourceHandle, target: e.target }))}
          onAddEdge={(sourceHandle, targetNodeId, label) => {
            snapshot()
            setEdges(eds => {
              const sourceNode = nodesRef.current.find(n => n.id === selectedNodeId)
              const { style, markerEnd } = edgeStyleForSourceType(sourceNode?.type)
              const filtered = eds.filter(e => !(e.source === selectedNodeId && e.sourceHandle === sourceHandle))
              const newEdge = {
                id: `e-${selectedNodeId}-${sourceHandle}-${targetNodeId}`,
                source: selectedNodeId, target: targetNodeId,
                sourceHandle, type: 'smoothstep', animated: false,
                style, markerEnd, label: label ? truncLabel(label) : label,
              }
              const updated = [...filtered, newEdge]
              scheduleSync(nodesRef.current, updated)
              return updated
            })
          }}
          onRemoveEdge={(sourceHandle) => {
            snapshot()
            setEdges(eds => {
              const updated = eds.filter(e => !(e.source === selectedNodeId && e.sourceHandle === sourceHandle))
              scheduleSync(nodesRef.current, updated)
              return updated
            })
          }}
        />
      )}
    </div>
  )
}
