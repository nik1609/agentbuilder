import { AgentSchema, TraceEvent } from '@/types/agent'

export interface ModelRunConfig {
  provider: 'google' | 'openai-compatible' | 'anthropic' | 'ollama'
  modelId: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
}

export interface GuardrailData {
  inputRules: { text: string }[]
  outputRules: { text: string }[]
}

// agentRunsHistory: memoryConfigId → formatted history string
export type AgentRunsHistory = Record<string, string>

export interface ExecutionContext {
  agentId: string
  runId: string
  input: Record<string, unknown>
  // Named state dict — each node writes to variables[nodeId]
  variables: Record<string, unknown>
  // __last_output is kept for backwards compat, auto-updated to last node's output
  trace: TraceEvent[]
  tokens: number
  startTime: number
  onTrace?: (event: TraceEvent) => void
  /** Called per streaming token — nodeId + chunk text */
  onToken?: (nodeId: string, token: string) => void
  modelConfigs?: Record<string, ModelRunConfig>
  guardrailMap?: Record<string, GuardrailData>
  // nodeOutputs tracks per-node outputs for memory sources and {{node.id}} refs
  nodeOutputs?: Record<string, unknown>
  agentRunsHistory?: AgentRunsHistory
  datatableImportData?: Record<string, unknown[]>
  datatableWriter?: (datatableId: string, row: Record<string, unknown>) => Promise<void>
  // Loop counters: nodeId → current iteration count
  loopCounters?: Record<string, number>
  // Branch results collected by Fork for Join to consume
  branchResults?: Record<string, unknown>
}

export interface NodeResult {
  output: unknown
  tokens?: number
  error?: string
}

export interface ExecutionResult {
  output: unknown
  tokens: number
  latencyMs: number
  trace: TraceEvent[]
  status: 'completed' | 'failed' | 'waiting_hitl' | 'waiting_clarify'
  error?: string
  /** Post-workflow nudge from the orchestrator (only set when orch is enabled + history exists) */
  nudge?: string
}

export type { AgentSchema }
