'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, BackgroundVariant,
  addEdge, Connection, useNodesState, useEdgesState, Node, Edge,
  NodeChange, EdgeChange, ConnectionMode, ReactFlowInstance,
} from '@xyflow/react'
import { Undo2, Redo2 } from 'lucide-react'
import '@xyflow/react/dist/style.css'
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

const DEFAULT_EDGE_STYLE = {
  stroke: '#7c6ff0',
  strokeWidth: 2.5,
  strokeDasharray: undefined as string | undefined,
}

const defaultNodes: Node[] = [
  { id: 'input-1', type: 'input', position: { x: 60, y: 180 }, data: { label: 'Pipeline Input', nodeType: 'input' } },
  { id: 'output-1', type: 'output', position: { x: 580, y: 180 }, data: { label: 'Pipeline Output', nodeType: 'output' } },
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
    if (changes.some(c => c.type === 'remove')) snapshot()
    onEdgesChange(changes)
    setEdges(eds => {
      scheduleSync(nodesRef.current, eds)
      return eds
    })
  }, [onEdgesChange, setEdges, scheduleSync, snapshot])

  const onConnect = useCallback((params: Connection) => {
    snapshot()
    setEdges(eds => {
      const newEdges = addEdge({
        ...params,
        type: 'smoothstep',
        animated: true,
        style: DEFAULT_EDGE_STYLE,
        markerEnd: { type: 'arrowclosed' as const, color: '#7c6ff0', width: 20, height: 20 },
      }, eds)
      scheduleSync(nodesRef.current, newEdges)
      return newEdges
    })
  }, [setEdges, scheduleSync, snapshot])

  const addNode = useCallback((type: 'llm' | 'tool' | 'condition' | 'hitl' | 'clarify' | 'passthrough' | 'loop' | 'fork' | 'join' | 'switch') => {
    const labels: Record<string, string> = {
      passthrough: 'I/O Node', llm: 'LLM Call', tool: 'Tool Call',
      condition: 'Condition', hitl: 'HITL Review', clarify: 'Ask User',
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

    const newNode: Node = {
      id: uuidv4(),
      type,
      position: pos,
      data: { label: labels[type], nodeType: type, ...(defaults[type] ?? {}) } as NodeData,
    }
    snapshot()
    setNodes(nds => {
      const updated = [...nds, newNode]
      scheduleSync(updated, edgesRef.current)
      return updated
    })
  }, [setNodes, scheduleSync, snapshot])

  const addNodeAt = useCallback((type: Parameters<typeof addNode>[0], position: { x: number; y: number }) => {
    const labels: Record<string, string> = {
      passthrough: 'I/O Node', llm: 'LLM Call', tool: 'Tool Call',
      condition: 'Condition', hitl: 'HITL Review', clarify: 'Ask User',
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

  return (
    <div className="w-full h-full relative flex">
      <div className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
        {/* Add node toolbar — horizontal strip at top */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', flexDirection: 'row', gap: 4, alignItems: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '5px 8px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }} onMouseDown={e => e.stopPropagation()}>
          {/* Undo / Redo */}
          <button onClick={undo} disabled={!canUndo} title="Undo (⌘Z)" style={{
            height: 30, width: 30, borderRadius: 7, border: '1px solid var(--border)',
            background: canUndo ? 'var(--surface2)' : 'transparent',
            color: canUndo ? 'var(--text)' : 'var(--text3)',
            cursor: canUndo ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: canUndo ? 1 : 0.4,
          }}>
            <Undo2 size={13} />
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)" style={{
            height: 30, width: 30, borderRadius: 7, border: '1px solid var(--border)',
            background: canRedo ? 'var(--surface2)' : 'transparent',
            color: canRedo ? 'var(--text)' : 'var(--text3)',
            cursor: canRedo ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: canRedo ? 1 : 0.4,
            marginRight: 6,
          }}>
            <Redo2 size={13} />
          </button>
          <div style={{ width: 1, height: 18, background: 'var(--border)', marginRight: 4 }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em', marginRight: 4 }}>ADD</span>
          {[
            { type: 'passthrough' as const, label: 'I/O', color: '#64b5f6', bg: 'rgba(100,181,246,0.12)' },
            { type: 'llm' as const, label: 'LLM', color: '#7c6ff0', bg: 'rgba(124,111,240,0.12)' },
            { type: 'tool' as const, label: 'Tool', color: '#22d79a', bg: 'rgba(34,215,154,0.12)' },
            { type: 'condition' as const, label: 'Cond', color: '#f5a020', bg: 'rgba(245,160,32,0.12)' },
            { type: 'hitl' as const, label: 'HITL', color: '#b080f8', bg: 'rgba(176,128,248,0.12)' },
            { type: 'clarify' as const, label: 'Clarify', color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
            { type: 'loop' as const, label: 'Loop', color: '#ff7043', bg: 'rgba(255,112,67,0.12)' },
            { type: 'fork' as const, label: 'Fork', color: '#26c6da', bg: 'rgba(38,198,218,0.12)' },
            { type: 'join' as const, label: 'Join', color: '#26c6da', bg: 'rgba(38,198,218,0.12)' },
            { type: 'switch' as const, label: 'Switch', color: '#ffd600', bg: 'rgba(255,214,0,0.12)' },
          ].map(({ type, label, color, bg }) => (
            <button
              key={type}
              onClick={() => addNode(type)}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('application/reactflow-nodetype', type)
                e.dataTransfer.effectAllowed = 'move'
              }}
              title={`Click to add or drag onto canvas`}
              style={{
                height: 30, paddingInline: 12, borderRadius: 7, border: `1px solid ${color}40`,
                background: bg, color, cursor: 'grab',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>{label}</span>
            </button>
          ))}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
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
            animated: true,
            style: DEFAULT_EDGE_STYLE,
            markerEnd: { type: 'arrowclosed' as const, color: '#7c6ff0', width: 20, height: 20 },
          }}
          connectionMode={ConnectionMode.Strict}
          connectionRadius={40}
          onInit={setRfInstance}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode="Delete"
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="var(--border2)" />
          <Controls style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} />
          {/* <MiniMap
            width={120}
            height={80}
            nodeColor={(n) => {
              const t = (n.data as NodeData)?.nodeType
              if (t === 'llm') return '#7c6ff0'
              if (t === 'tool') return '#22d79a'
              if (t === 'condition') return '#f5a020'
              if (t === 'hitl') return '#22d79a'
              return '#1a1a35'
            }}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            maskColor="rgba(0,0,0,0.4)"
          /> */}
        </ReactFlow>
      </div>

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
        />
      )}
    </div>
  )
}
