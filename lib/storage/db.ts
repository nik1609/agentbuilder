/**
 * Storage layer — uses Supabase when env vars are present,
 * falls back to in-memory store for local dev without DB.
 */
import { Agent, ApiKey, AgentRun, ToolConfig, ModelConfig, PromptConfig, MemoryConfig, GuardrailConfig } from '@/types/agent'

// ─── In-Memory Store (local dev fallback) ────────────────────────────────────
const store = {
  agents: new Map<string, Agent>(),
  apiKeys: new Map<string, ApiKey>(),
  runs: new Map<string, AgentRun>(),
  tools: new Map<string, ToolConfig>(),
  models: new Map<string, ModelConfig>(),
  prompts: new Map<string, PromptConfig>(),
  memory: new Map<string, MemoryConfig>(),
  guardrails: new Map<string, GuardrailConfig>(),
}

// ─── Agents ──────────────────────────────────────────────────────────────────
export async function getAgents(): Promise<Agent[]> {
  return Array.from(store.agents.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export async function getAgent(id: string): Promise<Agent | null> {
  return store.agents.get(id) ?? null
}

export async function saveAgent(agent: Agent): Promise<Agent> {
  store.agents.set(agent.id, agent)
  return agent
}

export async function deleteAgent(id: string): Promise<void> {
  store.agents.delete(id)
}

// ─── API Keys ─────────────────────────────────────────────────────────────────
export async function getApiKeys(): Promise<ApiKey[]> {
  return Array.from(store.apiKeys.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function saveApiKey(key: ApiKey): Promise<ApiKey> {
  store.apiKeys.set(key.id, key)
  return key
}

export async function getApiKeyByHash(hash: string): Promise<ApiKey | null> {
  for (const key of store.apiKeys.values()) {
    if (key.keyHash === hash) return key
  }
  return null
}

export async function updateApiKeyUsage(id: string): Promise<void> {
  const key = store.apiKeys.get(id)
  if (key) {
    store.apiKeys.set(id, {
      ...key,
      lastUsed: new Date().toISOString(),
      totalCalls: key.totalCalls + 1,
    })
  }
}

export async function revokeApiKey(id: string): Promise<void> {
  const key = store.apiKeys.get(id)
  if (key) store.apiKeys.set(id, { ...key, isActive: false })
}

// ─── Runs ─────────────────────────────────────────────────────────────────────
export async function getRuns(agentId?: string): Promise<AgentRun[]> {
  const all = Array.from(store.runs.values())
  const filtered = agentId ? all.filter((r) => r.agentId === agentId) : all
  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function saveRun(run: AgentRun): Promise<AgentRun> {
  store.runs.set(run.id, run)
  return run
}

export async function updateRun(id: string, updates: Partial<AgentRun>): Promise<void> {
  const run = store.runs.get(id)
  if (run) store.runs.set(id, { ...run, ...updates })
}

export async function getRun(id: string): Promise<AgentRun | null> {
  return store.runs.get(id) ?? null
}

// ─── Tools ────────────────────────────────────────────────────────────────────
export async function getTools(): Promise<ToolConfig[]> {
  return Array.from(store.tools.values())
}
export async function saveTool(tool: ToolConfig): Promise<ToolConfig> {
  store.tools.set(tool.id, tool)
  return tool
}
export async function deleteTool(id: string): Promise<void> {
  store.tools.delete(id)
}

// ─── Models ───────────────────────────────────────────────────────────────────
export async function getModels(): Promise<ModelConfig[]> {
  return Array.from(store.models.values())
}
export async function saveModel(model: ModelConfig): Promise<ModelConfig> {
  store.models.set(model.id, model)
  return model
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
export async function getPrompts(): Promise<PromptConfig[]> {
  return Array.from(store.prompts.values())
}
export async function savePrompt(prompt: PromptConfig): Promise<PromptConfig> {
  store.prompts.set(prompt.id, prompt)
  return prompt
}

// ─── Memory ───────────────────────────────────────────────────────────────────
export async function getMemoryConfigs(): Promise<MemoryConfig[]> {
  return Array.from(store.memory.values())
}
export async function saveMemoryConfig(mem: MemoryConfig): Promise<MemoryConfig> {
  store.memory.set(mem.id, mem)
  return mem
}

// ─── Guardrails ───────────────────────────────────────────────────────────────
export async function getGuardrails(): Promise<GuardrailConfig[]> {
  return Array.from(store.guardrails.values())
}
export async function saveGuardrail(g: GuardrailConfig): Promise<GuardrailConfig> {
  store.guardrails.set(g.id, g)
  return g
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function getAnalytics() {
  const runs = Array.from(store.runs.values())
  const completed = runs.filter((r) => r.status === 'completed')
  const failed = runs.filter((r) => r.status === 'failed')
  const totalTokens = completed.reduce((sum, r) => sum + r.tokens, 0)
  const avgLatency = completed.length
    ? completed.reduce((sum, r) => sum + r.latencyMs, 0) / completed.length
    : 0

  // Last 7 days run counts
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().split('T')[0]
    return {
      date: key,
      count: runs.filter((r) => r.createdAt.startsWith(key)).length,
    }
  })

  return {
    totalRuns: runs.length,
    completedRuns: completed.length,
    failedRuns: failed.length,
    totalTokens,
    avgLatencyMs: Math.round(avgLatency),
    last7Days: last7,
    topAgents: Array.from(store.agents.values())
      .sort((a, b) => b.runCount - a.runCount)
      .slice(0, 5)
      .map((a) => ({ id: a.id, name: a.name, runs: a.runCount })),
  }
}
