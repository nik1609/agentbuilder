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
  variables: Record<string, unknown>
  trace: TraceEvent[]
  tokens: number
  startTime: number
  onTrace?: (event: TraceEvent) => void
  modelConfigs?: Record<string, ModelRunConfig>
  guardrailMap?: Record<string, GuardrailData>
  nodeOutputs?: Record<string, unknown>
  agentRunsHistory?: AgentRunsHistory
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
  status: 'completed' | 'failed' | 'waiting_hitl'
  error?: string
}

export type { AgentSchema }
