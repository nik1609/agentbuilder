'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, BackgroundVariant,
  addEdge, Connection, useNodesState, useEdgesState, Node, Edge,
  NodeChange, EdgeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import LLMNode from './nodes/LLMNode'
import ToolNode from './nodes/ToolNode'
import ConditionNode from './nodes/ConditionNode'
import HITLNode from './nodes/HITLNode'
import InputOutputNode from './nodes/InputOutputNode'
import NodeConfigPanel from './NodeConfigPanel'
import { NodeData, AgentNode, AgentEdge } from '@/types/agent'
import { v4 as uuidv4 } from 'uuid'

const nodeTypes = {
  llm: LLMNode,
  tool: ToolNode,
  condition: ConditionNode,
  hitl: HITLNode,
  input: InputOutputNode,
  output: InputOutputNode,
}

const DEFAULT_EDGE_STYLE = {
  stroke: '#7c6ff0',
  strokeWidth: 1.5,
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
}

export default function AgentCanvas({
  initialNodes,
  initialEdges,
  onSchemaChange,
  onNodeSelect,
}: AgentCanvasProps) {
  const initNodes = initialNodes && initialNodes.length > 0
    ? (initialNodes as unknown as Node[])
    : defaultNodes

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (initialEdges as unknown as Edge[]) ?? []
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const syncRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    setNodes(nds => {
      scheduleSync(nds, edges)
      return nds
    })
  }, [onNodesChange, setNodes, scheduleSync, edges])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes)
    setEdges(eds => {
      scheduleSync(nodes, eds)
      return eds
    })
  }, [onEdgesChange, setEdges, scheduleSync, nodes])

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => {
      const newEdges = addEdge({
        ...params,
        animated: true,
        style: DEFAULT_EDGE_STYLE,
        markerEnd: { type: 'arrowclosed' as const, color: '#7c6ff0', width: 16, height: 16 },
      }, eds)
      scheduleSync(nodes, newEdges)
      return newEdges
    })
  }, [setEdges, scheduleSync, nodes])

  const addNode = useCallback((type: 'llm' | 'tool' | 'condition' | 'hitl') => {
    const labels: Record<string, string> = {
      llm: 'LLM Call', tool: 'Tool Call', condition: 'Condition', hitl: 'HITL Review',
    }
    const newNode: Node = {
      id: uuidv4(),
      type,
      position: { x: 160 + Math.random() * 240, y: 80 + Math.random() * 200 },
      data: { label: labels[type], nodeType: type } as NodeData,
    }
    setNodes(nds => {
      const updated = [...nds, newNode]
      scheduleSync(updated, edges)
      return updated
    })
  }, [setNodes, scheduleSync, edges])

  // Update node data (from config panel)
  const updateNodeData = useCallback((nodeId: string, data: Partial<NodeData>) => {
    setNodes(nds => {
      const updated = nds.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      )
      scheduleSync(updated, edges)
      return updated
    })
  }, [setNodes, scheduleSync, edges])

  const selectedNode = nodes.find(n => n.id === selectedNodeId)
  const selectedNodeData = selectedNode?.data as NodeData | undefined

  return (
    <div className="w-full h-full relative flex">
      <div className="flex-1 relative">
        {/* Add node toolbar — horizontal strip at top */}
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', flexDirection: 'row', gap: 4, alignItems: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '5px 8px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }} onMouseDown={e => e.stopPropagation()}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em', marginRight: 4 }}>ADD</span>
          {[
            { type: 'llm' as const, label: 'LLM', color: '#7c6ff0', bg: 'rgba(124,111,240,0.12)' },
            { type: 'tool' as const, label: 'Tool', color: '#22d79a', bg: 'rgba(34,215,154,0.12)' },
            { type: 'condition' as const, label: 'Cond', color: '#f5a020', bg: 'rgba(245,160,32,0.12)' },
            { type: 'hitl' as const, label: 'HITL', color: '#b080f8', bg: 'rgba(176,128,248,0.12)' },
          ].map(({ type, label, color, bg }) => (
            <button key={type} onClick={() => addNode(type)} title={`Add ${label} node`} style={{
              height: 30, paddingInline: 12, borderRadius: 7, border: `1px solid ${color}40`,
              background: bg, color, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
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
            animated: true,
            style: DEFAULT_EDGE_STYLE,
            markerEnd: { type: 'arrowclosed' as const, color: '#7c6ff0', width: 16, height: 16 },
          }}
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
        />
      )}
    </div>
  )
}
