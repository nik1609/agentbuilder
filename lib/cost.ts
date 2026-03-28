/**
 * Token cost estimator — rough USD cost per model.
 * Prices are blended input+output averages, accurate enough for analytics.
 * All values in USD per 1M tokens.
 */

const COST_PER_1M: Record<string, number> = {
  // Google
  'gemini-2.5-flash': 0.18,
  'gemini-2.0-pro': 3.50,
  'gemini-1.5-pro': 3.50,
  'gemini-1.5-flash': 0.15,
  // OpenAI
  'gpt-4o': 7.50,
  'gpt-4o-mini': 0.30,
  'gpt-4-turbo': 15.00,
  'gpt-3.5-turbo': 0.75,
  'o1': 22.50,
  'o1-mini': 4.50,
  // Anthropic
  'claude-opus-4-6': 37.50,
  'claude-sonnet-4-6': 9.00,
  'claude-haiku-4-5-20251001': 1.25,
  'claude-haiku-4-5': 1.25,
  // Groq (fast/cheap)
  'llama-3.3-70b-versatile': 0.59,
  'llama-3.1-8b-instant': 0.06,
  'mixtral-8x7b-32768': 0.27,
  // Local (free)
  'llama3': 0,
  'mistral': 0,
  'phi-3': 0,
}

/** Default fallback: ~Gemini Flash pricing */
const DEFAULT_COST_PER_1M = 0.18

/**
 * Estimate USD cost for a given number of tokens on a given model.
 * Returns a number in dollars (e.g. 0.00045).
 */
export function estimateCost(tokens: number, modelId?: string): number {
  if (!tokens || tokens <= 0) return 0
  const key = modelId?.toLowerCase().trim() ?? ''
  // Exact match
  if (COST_PER_1M[key] !== undefined) return (tokens / 1_000_000) * COST_PER_1M[key]
  // Prefix match (e.g. 'claude-sonnet' matches 'claude-sonnet-4-6')
  for (const [pattern, price] of Object.entries(COST_PER_1M)) {
    if (key.startsWith(pattern) || pattern.startsWith(key)) return (tokens / 1_000_000) * price
  }
  return (tokens / 1_000_000) * DEFAULT_COST_PER_1M
}

/** Format cost for display: "$0.0012" or "<$0.001" */
export function formatCost(usd: number): string {
  if (usd <= 0) return '$0.00'
  if (usd < 0.001) return '<$0.001'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}
