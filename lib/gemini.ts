import { GoogleGenerativeAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
]

export function getModel(modelId = 'gemini-2.5-flash', temperature = 0.7, maxTokens = 4096): GenerativeModel {
  return genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      topP: 1,
    },
    safetySettings,
  })
}

export interface LLMCallOptions {
  systemPrompt?: string
  userMessage: string
  history?: Array<{ role: 'user' | 'model'; parts: string }>
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface LLMResult {
  text: string
  tokens: number
}

export async function callLLM(opts: LLMCallOptions): Promise<LLMResult> {
  const model = getModel(opts.model ?? 'gemini-2.5-flash', opts.temperature ?? 0.7, opts.maxTokens ?? 4096)

  const history = (opts.history ?? []).map((h) => ({
    role: h.role,
    parts: [{ text: h.parts }],
  }))

  const chat = model.startChat({
    history,
    systemInstruction: opts.systemPrompt?.trim()
      ? { role: 'user', parts: [{ text: opts.systemPrompt.trim() }] }
      : undefined,
  })

  const result = await chat.sendMessage(opts.userMessage)
  const response = result.response
  const text = response.text()
  const tokens = response.usageMetadata?.totalTokenCount ?? estimateTokens(text)

  return { text, tokens }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
