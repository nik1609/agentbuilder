export type NodeType = 'llm' | 'tool' | 'condition' | 'hitl' | 'input' | 'output' | 'passthrough'

export interface MemorySource {
  id: string
  type: 'agent_runs' | 'node_output'
  memoryConfigId?: string  // used when type === 'agent_runs'
  nodeId?: string          // used when type === 'node_output'
  nodeLabel?: string       // display label for node_output sources
}

export interface NodeData extends Record<string, unknown> {
  label: string
  nodeType: NodeType
  // LLM node
  model?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  guardrailId?: string
  memorySources?: MemorySource[]
  // Tool node
  toolName?: string
  toolConfig?: Record<string, unknown>
  compressOutput?: boolean
  compressModel?: string
  // Condition node
  condition?: string
  // HITL node
  question?: string
  // General
  description?: string
}

export interface AgentNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: NodeData
}

export interface AgentEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
}

export interface AgentSchema {
  nodes: AgentNode[]
  edges: AgentEdge[]
}

export interface ToolConfig {
  id: string
  name: string
  description: string
  type: 'http' | 'function' | 'code_exec'
  endpoint?: string
  method?: string
  headers?: Record<string, string>
  inputSchema: Record<string, { type: string; required?: boolean; description?: string }>
  timeout?: number
  createdAt: string
}

export interface ModelConfig {
  id: string
  name: string
  provider: 'google' | 'openai' | 'anthropic'
  modelId: string
  temperature: number
  maxTokens: number
  topP: number
  stream: boolean
  createdAt: string
}

export interface PromptConfig {
  id: string
  name: string
  content: string
  variables: string[]
  createdAt: string
}

export interface MemoryConfig {
  id: string
  name: string
  type: 'sliding' | 'full' | 'summary'
  windowSize: number
  ttlHours: number
  scope: 'session' | 'user' | 'run'
  createdAt: string
}

export interface GuardrailRule {
  id: string
  text: string
  type: 'input' | 'output' | 'block'
  color: string
}

export interface GuardrailConfig {
  id: string
  name: string
  inputRules: GuardrailRule[]
  outputRules: GuardrailRule[]
  logViolations: boolean
  createdAt: string
}

export interface Agent {
  id: string
  name: string
  description: string
  version: number
  schema: AgentSchema
  modelId?: string
  tools: string[]
  systemPromptId?: string
  memoryId?: string
  guardrailId?: string
  createdAt: string
  updatedAt: string
  isPublic: boolean
  runCount: number
}

export interface ApiKey {
  id: string
  name: string
  key: string // shown once on creation
  keyPrefix: string // first 8 chars, for display
  keyHash: string // sha256, stored
  isActive: boolean
  createdAt: string
  lastUsed?: string
  totalCalls: number
}

export interface AgentRun {
  id: string
  agentId: string
  agentName: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
  status: 'running' | 'completed' | 'failed' | 'waiting_hitl'
  tokens: number
  latencyMs: number
  error?: string
  trace: TraceEvent[]
  createdAt: string
  apiKeyPrefix?: string
}

export interface TraceEvent {
  ts: number // ms offset from start
  type: 'node_start' | 'node_done' | 'node_output' | 'tool_call' | 'tool_result' | 'llm_call' | 'llm_response' | 'error' | 'hitl_pause' | 'guardrail_block' | 'guardrail_warn' | 'compress_start' | 'compress_done'
  nodeId?: string
  message: string
  data?: unknown
}
