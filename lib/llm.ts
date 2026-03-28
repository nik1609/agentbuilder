/**
 * Universal LLM client — supports Google Gemini, OpenAI-compatible endpoints,
 * and Anthropic. Falls back to GEMINI_API_KEY env var when no apiKey is given.
 */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

export interface LLMCallOptions {
  provider?: 'google' | 'openai-compatible' | 'anthropic' | 'ollama'
  model?: string
  apiKey?: string
  baseUrl?: string
  systemPrompt?: string
  userMessage: string
  temperature?: number
  maxTokens?: number
  /** Request timeout in ms. Defaults to 60 000. */
  timeout?: number
  /** Called with each streaming token chunk (if provider supports it). */
  onToken?: (token: string) => void
}

export interface LLMResult {
  text: string
  tokens: number
}

// ─── Google / Gemini ─────────────────────────────────────────────────────────
async function callGoogle(opts: LLMCallOptions): Promise<LLMResult> {
  const key = opts.apiKey || process.env.GEMINI_API_KEY!
  const genAI = new GoogleGenerativeAI(key)
  const geminiModel = genAI.getGenerativeModel({
    model: opts.model ?? 'gemini-2.5-flash',
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 4096,
      topP: 1,
    },
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
  })

  const chat = geminiModel.startChat({
    systemInstruction: opts.systemPrompt?.trim()
      ? { role: 'user', parts: [{ text: opts.systemPrompt.trim() }] }
      : undefined,
  })

  if (opts.onToken) {
    // Streaming path
    const streamResult = await chat.sendMessageStream(opts.userMessage)
    let text = ''
    let tokens = 0
    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text()
      if (chunkText) { opts.onToken(chunkText); text += chunkText }
      tokens = chunk.usageMetadata?.totalTokenCount ?? tokens
    }
    if (!tokens) tokens = Math.ceil(text.length / 4)
    return { text, tokens }
  }

  const result = await chat.sendMessage(opts.userMessage)
  const response = result.response
  const text = response.text()
  const tokens = response.usageMetadata?.totalTokenCount ?? Math.ceil(text.length / 4)
  return { text, tokens }
}

// ─── OpenAI-compatible (OpenAI, Ollama, Groq, Together, LM Studio, etc.) ─────
async function callOpenAICompatible(opts: LLMCallOptions): Promise<LLMResult> {
  const rawBase = (opts.baseUrl ?? 'https://api.openai.com').replace(/\/$/, '')
  // Normalize: if base already ends with /v1, use it as-is; otherwise append /v1
  const baseUrl = rawBase.endsWith('/v1') ? rawBase : `${rawBase}/v1`
  const key = opts.apiKey ?? 'ollama' // Ollama doesn't need a real key

  const messages: Array<{ role: string; content: string }> = []
  if (opts.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: opts.systemPrompt.trim() })
  }
  messages.push({ role: 'user', content: opts.userMessage })

  if (opts.onToken) {
    // Streaming path
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: opts.model ?? 'gpt-4o-mini', messages,
        temperature: opts.temperature ?? 0.7, max_tokens: opts.maxTokens ?? 4096,
        stream: true,
      }),
      signal: AbortSignal.timeout(opts.timeout ?? 60000),
    })
    if (!res.ok) throw new Error(`OpenAI-compatible API error ${res.status}: ${await res.text()}`)
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let text = '', tokens = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of dec.decode(value).split('\n')) {
        const trimmed = line.replace(/^data: /, '').trim()
        if (!trimmed || trimmed === '[DONE]') continue
        try {
          const chunk = JSON.parse(trimmed) as { choices?: Array<{ delta?: { content?: string } }>; usage?: { total_tokens?: number } }
          const delta = chunk.choices?.[0]?.delta?.content ?? ''
          if (delta) { opts.onToken(delta); text += delta }
          if (chunk.usage?.total_tokens) tokens = chunk.usage.total_tokens
        } catch { /* skip malformed chunk */ }
      }
    }
    return { text, tokens: tokens || Math.ceil(text.length / 4) }
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model ?? 'gpt-4o-mini',
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
    }),
    signal: AbortSignal.timeout(opts.timeout ?? 60000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI-compatible API error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
    usage?: { total_tokens?: number }
  }
  const text = data.choices[0]?.message?.content ?? ''
  const tokens = data.usage?.total_tokens ?? Math.ceil(text.length / 4)
  return { text, tokens }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────
async function callAnthropic(opts: LLMCallOptions): Promise<LLMResult> {
  const key = opts.apiKey!
  const baseUrl = (opts.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')

  const body: Record<string, unknown> = {
    model: opts.model ?? 'claude-sonnet-4-6',
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.7,
    messages: [{ role: 'user', content: opts.userMessage }],
  }
  if (opts.systemPrompt?.trim()) {
    body.system = opts.systemPrompt.trim()
  }

  if (opts.onToken) {
    body.stream = true
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeout ?? 60000),
    })
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let text = '', inputTokens = 0, outputTokens = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of dec.decode(value).split('\n')) {
        const trimmed = line.replace(/^data: /, '').trim()
        if (!trimmed) continue
        try {
          const ev = JSON.parse(trimmed) as { type: string; delta?: { type: string; text: string }; usage?: { input_tokens?: number; output_tokens?: number } }
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            opts.onToken(ev.delta.text); text += ev.delta.text
          }
          if (ev.usage) { inputTokens = ev.usage.input_tokens ?? inputTokens; outputTokens = ev.usage.output_tokens ?? outputTokens }
        } catch { /* skip */ }
      }
    }
    return { text, tokens: (inputTokens + outputTokens) || Math.ceil(text.length / 4) }
  }

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeout ?? 60000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  const text = data.content.find((b) => b.type === 'text')?.text ?? ''
  const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0) || Math.ceil(text.length / 4)
  return { text, tokens }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export async function callLLM(opts: LLMCallOptions): Promise<LLMResult> {
  const provider = opts.provider ?? 'google'
  const ms = opts.timeout ?? 60000
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`LLM request timed out after ${ms / 1000}s`)), ms)
  )
  switch (provider) {
    case 'openai-compatible':
    case 'ollama': return Promise.race([callOpenAICompatible(opts), timeoutPromise])
    case 'anthropic': return Promise.race([callAnthropic(opts), timeoutPromise])
    case 'google':
    default: return Promise.race([callGoogle(opts), timeoutPromise])
  }
}
