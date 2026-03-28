export type NodeType = 'llm' | 'tool' | 'condition' | 'hitl' | 'clarify' | 'input' | 'output' | 'passthrough' | 'loop' | 'fork' | 'join' | 'switch'

export interface MemorySource {
  id: string
  type: 'agent_runs' | 'node_output'
  memoryConfigId?: string  // used when type === 'agent_runs'
  nodeId?: string          // used when type === 'node_output'
  nodeLabel?: string       // display label for node_output sources
}

// ── Retry config (per-node) ─────────────────────────────────────────────────
export interface RetryConfig {
  enabled: boolean
  maxAttempts: number      // default 3
  backoffMs: number        // initial delay, doubles each attempt
  retryOn: 'error' | 'empty_output' | 'guardrail_block'
}

// ── Fork / Join / Loop / Switch configs ─────────────────────────────────────
export interface ForkBranch {
  id: string
  label: string
}

export interface SwitchCase {
  label: string
  match: string
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
  // LLM agentic mode
  agenticMode?: boolean
  boundTools?: string[]         // tool names attached in agentic mode
  maxToolIterations?: number    // default 10
  // Tool node
  toolName?: string
  toolConfig?: Record<string, unknown>
  compressOutput?: boolean
  compressModel?: string
  // Condition node
  condition?: string
  // Clarify node
  clarifySystemPrompt?: string
  // HITL node
  question?: string
  hitlType?: 'approval' | 'chat' | 'form'
  contextKeys?: string[]
  agentModel?: string
  agentSystemPrompt?: string
  hitlFields?: { name: string; label: string; type: 'text' | 'select' | 'boolean'; options?: string[] }[]
  timeoutMinutes?: number
  timeoutAction?: 'approve' | 'reject'
  notificationWebhook?: string
  // Loop node
  maxIterations?: number
  exitCondition?: string
  exitConditionType?: 'llm' | 'expression'
  onMaxReached?: 'continue' | 'error'
  // Fork node
  branches?: ForkBranch[]
  inputMode?: 'broadcast' | 'split'
  // Join node
  joinMode?: 'wait_all' | 'wait_first' | 'wait_any_n'
  joinN?: number
  mergeAs?: string
  mergeFormat?: 'array' | 'object' | 'concatenated'
  // Switch node
  switchType?: 'value_match' | 'llm_classify' | 'expression'
  inputKey?: string
  cases?: SwitchCase[]
  defaultCase?: string
  // Retry (any node)
  retry?: RetryConfig
  // General
  description?: string
  outputKey?: string           // named output key for state dict
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

export interface OrchestratorConfig {
  enabled: boolean
  model: string   // key from user's registered models
}

export interface AgentSchema {
  nodes: AgentNode[]
  edges: AgentEdge[]
  orchestratorConfig?: OrchestratorConfig
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
  maxCallsPerDay?: number
}

export interface AgentRun {
  id: string
  agentId: string
  agentName: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
  status: 'running' | 'completed' | 'failed' | 'waiting_hitl' | 'waiting_clarify'
  tokens: number
  latencyMs: number
  costUsd?: number
  error?: string
  trace: TraceEvent[]
  createdAt: string
  apiKeyPrefix?: string
}

export interface TraceEvent {
  ts: number // ms offset from start
  type: 'node_start' | 'node_done' | 'node_output' | 'tool_call' | 'tool_result' | 'llm_call' | 'llm_response' | 'llm_token' | 'error' | 'hitl_pause' | 'clarify_pause' | 'guardrail_block' | 'guardrail_warn' | 'compress_start' | 'compress_done' | 'loop_iteration' | 'fork_start' | 'fork_done' | 'join_wait' | 'join_done' | 'retry' | 'agentic_tool_call' | 'agentic_tool_result'
  nodeId?: string
  message: string
  data?: unknown
}

// ── HITL types ──────────────────────────────────────────────────────────────
export interface HITLSession {
  id: string
  runId: string
  nodeId: string
  status: 'waiting' | 'approved' | 'rejected' | 'timed_out'
  context?: Record<string, unknown>
  resolution?: { action: string; reason?: string }
  createdAt: string
  resolvedAt?: string
}

export interface HITLMessage {
  id: string
  sessionId: string
  role: 'agent' | 'human'
  content: string
  createdAt: string
}

// ── Session types ───────────────────────────────────────────────────────────
export interface Session {
  id: string
  runId: string
  agentId: string
  userId?: string
  status: 'running' | 'completed' | 'failed' | 'waiting_hitl' | 'waiting_clarify'
  createdAt: string
  expiresAt: string
}
