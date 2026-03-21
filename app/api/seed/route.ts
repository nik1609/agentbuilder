import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

const E = (color: string) => ({ animated: true, style: { stroke: color, strokeWidth: 1.5 }, markerEnd: { type: 'arrowclosed', color, width: 16, height: 16 } })

// ─── Model Configs ─────────────────────────────────────────────────────────────
// IMPORTANT: agent nodes reference models by the `name` field below
const MODELS = [
  {
    name: 'Gemma3 4B (Local)',
    provider: 'ollama',
    model_id: 'gemma3:4b',
    temperature: 0.7,
    max_tokens: 2048,
    api_key: 'ollama',
    base_url: 'http://localhost:11434/v1',
  },
  {
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    model_id: 'gemini-2.5-flash',
    temperature: 0.7,
    max_tokens: 4096,
    api_key: null,
    base_url: null,
  },
  {
    name: 'Gemini 2.5 Flash (Precise)',
    provider: 'google',
    model_id: 'gemini-2.5-flash',
    temperature: 0.1,
    max_tokens: 4096,
    api_key: null,
    base_url: null,
  },
]

// ─── Tools ────────────────────────────────────────────────────────────────────
// Function tools have real JS code in `endpoint`. HTTP tools have placeholder URLs.
const TOOLS = [
  {
    name: 'word_counter',
    description: 'Counts words, characters, sentences, and paragraphs in the input text.',
    type: 'function',
    endpoint: `
const text = typeof input === 'string' ? input : JSON.stringify(input)
const words = text.trim().split(/\\s+/).filter(Boolean).length
const chars = text.length
const sentences = text.split(/[.!?]+/).filter(Boolean).length
const paragraphs = text.split(/\\n\\n+/).filter(Boolean).length
return { words, chars, sentences, paragraphs, text: text.slice(0, 100) + (text.length > 100 ? '...' : '') }
    `.trim(),
    method: 'POST',
    headers: {},
    timeout: 1000,
  },
  {
    name: 'text_transformer',
    description: 'Transforms text: trims whitespace, normalizes newlines, and wraps in a structured envelope with metadata.',
    type: 'function',
    endpoint: `
const text = typeof input === 'string' ? input : (input?.output ?? JSON.stringify(input))
const cleaned = text.trim().replace(/\\n{3,}/g, '\\n\\n')
const wordCount = cleaned.split(/\\s+/).filter(Boolean).length
const readingTimeMin = Math.ceil(wordCount / 200)
return {
  content: cleaned,
  meta: {
    word_count: wordCount,
    reading_time: readingTimeMin + ' min read',
    char_count: cleaned.length,
    processed_at: new Date().toISOString(),
  }
}
    `.trim(),
    method: 'POST',
    headers: {},
    timeout: 1000,
  },
  {
    name: 'sentiment_scorer',
    description: 'Simple rule-based sentiment analysis — returns positive/negative/neutral score and emoji.',
    type: 'function',
    endpoint: `
const text = typeof input === 'string' ? input : JSON.stringify(input)
const lower = text.toLowerCase()
const pos = ['great','good','excellent','amazing','love','fantastic','wonderful','best','happy','perfect','thanks','helpful','awesome','beautiful','brilliant'].filter(w => lower.includes(w)).length
const neg = ['bad','terrible','awful','hate','worst','horrible','poor','disappointed','broken','failed','error','wrong','ugly','slow','useless'].filter(w => lower.includes(w)).length
const score = pos - neg
const sentiment = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'
const emoji = score > 1 ? '😊' : score > 0 ? '🙂' : score < -1 ? '😠' : score < 0 ? '😕' : '😐'
return { sentiment, score, pos_signals: pos, neg_signals: neg, emoji, summary: emoji + ' ' + sentiment.toUpperCase() + ' (score: ' + score + ')', original_text: text.slice(0, 300) }
    `.trim(),
    method: 'POST',
    headers: {},
    timeout: 1000,
  },
  {
    name: 'web_search',
    description: 'Search the web for real-time information. Replace endpoint with your actual search API.',
    type: 'http',
    endpoint: 'https://api.search.example.com/search',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'YOUR_KEY_HERE' },
    timeout: 8000,
  },
  {
    name: 'send_notification',
    description: 'Send a notification (email/Slack/webhook). Replace endpoint with your actual service.',
    type: 'http',
    endpoint: 'https://hooks.example.com/notify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer YOUR_TOKEN' },
    timeout: 5000,
  },
]

// ─── Prompts ──────────────────────────────────────────────────────────────────
const PROMPTS = [
  {
    name: 'Helpful Local Assistant',
    content: `You are a helpful, concise assistant running on a local Ollama model.
Keep responses clear and to the point.
If you don't know something, say so honestly rather than guessing.`,
    variables: [],
  },
  {
    name: 'Content Classifier',
    content: `You are a content classification specialist. Analyze the input and return a JSON object with:
- category: one of [question, statement, complaint, request, feedback, other]
- length_class: short (< 50 words) | medium (50-200 words) | long (> 200 words)
- sentiment: positive | neutral | negative
- requires_human_review: true if content is sensitive, complex, or ambiguous
- confidence: 0.0 to 1.0

Respond ONLY with valid JSON, no markdown.`,
    variables: [],
  },
  {
    name: 'Summary Writer',
    content: `You are a professional summarizer. Create a concise, accurate summary of the provided content.
- Capture the key points and main ideas
- Use bullet points for clarity
- Keep it under 150 words
- Preserve any important numbers, names, or dates`,
    variables: [],
  },
]

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const now = new Date().toISOString()

  const AGENT_NAMES = ['Word Counter', 'Gemini Chatbot', 'Sentiment Analyst', 'Story Writer (Ollama)', 'Local Text Processor (Ollama)']

  // Clear existing seed data to avoid duplicates
  await db.from('agents').delete().eq('user_id', userId).in('name', AGENT_NAMES)
  await db.from('models').delete().eq('user_id', userId).in('name', MODELS.map(m => m.name))
  await db.from('tools').delete().eq('user_id', userId).in('name', TOOLS.map(t => t.name))
  await db.from('prompts').delete().eq('user_id', userId).in('name', PROMPTS.map(p => p.name))

  // ── Seed Models ────────────────────────────────────────────────────────────
  for (const model of MODELS) {
    await db.from('models').insert({ id: uuidv4(), user_id: userId, ...model, created_at: now })
  }

  // ── Seed Tools ─────────────────────────────────────────────────────────────
  for (const tool of TOOLS) {
    await db.from('tools').insert({ id: uuidv4(), user_id: userId, ...tool, created_at: now })
  }

  // ── Seed Prompts ───────────────────────────────────────────────────────────
  for (const prompt of PROMPTS) {
    await db.from('prompts').insert({ id: uuidv4(), user_id: userId, ...prompt, created_at: now })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 1: Word Counter — pure function tool, no API key required
  // Flow: Input → word_counter (fn tool) → Output
  // Type any text → see word/char/sentence stats immediately
  // ══════════════════════════════════════════════════════════════════════════
  const a1 = {
    id: uuidv4(),
    user_id: userId,
    name: 'Word Counter',
    description: 'Type any text and get word/character/sentence stats. Pure function tool — no API key needed. Great for testing tool execution.',
    schema: {
      nodes: [
        { id: 'n-in',  type: 'input',  position: { x: 80,  y: 200 }, data: { label: 'Your Text',   nodeType: 'input'  } },
        { id: 'n-wc',  type: 'tool',   position: { x: 320, y: 200 }, data: { label: 'Count Words', nodeType: 'tool', toolName: 'word_counter' } },
        { id: 'n-out', type: 'output', position: { x: 560, y: 200 }, data: { label: 'Stats',       nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',  target: 'n-wc',  ...E('#22d79a') },
        { id: 'e2', source: 'n-wc',  target: 'n-out', ...E('#22d79a') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 2: Gemini Chatbot — pure LLM, no tools
  // Flow: Input → Gemini 2.5 Flash → Output
  // Direct AI chat — requires GEMINI_API_KEY in env or add key in Models tab
  // ══════════════════════════════════════════════════════════════════════════
  const a2 = {
    id: uuidv4(),
    user_id: userId,
    name: 'Gemini Chatbot',
    description: 'Simple AI chat with Gemini 2.5 Flash. Type a message, get a response. Requires GEMINI_API_KEY environment variable or set API key in the Models tab.',
    schema: {
      nodes: [
        { id: 'n-in',  type: 'input',  position: { x: 80,  y: 200 }, data: { label: 'Your Message', nodeType: 'input'  } },
        {
          id: 'n-llm', type: 'llm', position: { x: 340, y: 200 },
          data: {
            label: 'Gemini 2.5 Flash', nodeType: 'llm',
            model: 'Gemini 2.5 Flash',
            temperature: 0.7,
            systemPrompt: 'You are a helpful, friendly assistant. Answer clearly and concisely.',
          },
        },
        { id: 'n-out', type: 'output', position: { x: 620, y: 200 }, data: { label: 'Response', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',  target: 'n-llm', ...E('#7c6ff0') },
        { id: 'e2', source: 'n-llm', target: 'n-out', ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 3: Sentiment Analyst — function tool → LLM pipeline
  // Flow: Input → sentiment_scorer (fn tool) → Gemini LLM (explains results) → Output
  // sentiment_scorer returns JSON with original_text, sentiment, score, emoji
  // Gemini reads that JSON and writes a human-friendly explanation
  // ══════════════════════════════════════════════════════════════════════════
  const a3 = {
    id: uuidv4(),
    user_id: userId,
    name: 'Sentiment Analyst',
    description: 'Analyzes the sentiment of your message (positive/negative/neutral) using a fast function tool, then Gemini writes a friendly interpretation. Shows the tool → LLM pipeline pattern.',
    schema: {
      nodes: [
        { id: 'n-in',  type: 'input',  position: { x: 80,  y: 200 }, data: { label: 'Your Message',    nodeType: 'input'  } },
        { id: 'n-sa',  type: 'tool',   position: { x: 340, y: 200 }, data: { label: 'Score Sentiment', nodeType: 'tool', toolName: 'sentiment_scorer' } },
        {
          id: 'n-llm', type: 'llm', position: { x: 620, y: 200 },
          data: {
            label: 'Explain Results', nodeType: 'llm',
            model: 'Gemini 2.5 Flash',
            temperature: 0.6,
            systemPrompt: `You receive a JSON object from a sentiment analysis tool with these fields:
- sentiment: "positive", "negative", or "neutral"
- score: numeric score (positive = more positive words)
- emoji: mood emoji
- pos_signals / neg_signals: counts of positive/negative words found
- original_text: the text that was analyzed

Write a short, friendly 2-3 sentence interpretation. For example:
"Your message has a [sentiment] tone [emoji]. The analysis picked up [N] positive signals like '...' ..."
Be conversational and helpful. Do NOT just repeat the JSON.`,
          },
        },
        { id: 'n-out', type: 'output', position: { x: 900, y: 200 }, data: { label: 'Analysis', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',  target: 'n-sa',  ...E('#22d79a') },
        { id: 'e2', source: 'n-sa',  target: 'n-llm', ...E('#7c6ff0') },
        { id: 'e3', source: 'n-llm', target: 'n-out', ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 4: Story Writer (Ollama + HITL)
  // Flow: Input (prompt) → Gemma3 (draft story) → HITL (human reviews)
  //       → Gemma3 (revise based on feedback) → Output
  //
  // Key: Gemma3 is the FIRST node so it gets the original prompt directly.
  // After HITL, the second Gemma3 receives:
  //   "Reviewer approved with notes: '...' \n\nPrevious context:\n{draft}"
  // and revises accordingly.
  // ══════════════════════════════════════════════════════════════════════════
  const a4 = {
    id: uuidv4(),
    user_id: userId,
    name: 'Story Writer (Ollama)',
    description: 'Generates a short story draft with Gemma3 (local Ollama), pauses for human review via HITL, then revises based on your feedback. Requires Ollama running with gemma3:4b.',
    schema: {
      nodes: [
        { id: 'n-in',    type: 'input',  position: { x: 80,  y: 220 }, data: { label: 'Story Prompt', nodeType: 'input' } },
        {
          id: 'n-draft', type: 'llm',    position: { x: 320, y: 220 },
          data: {
            label: 'Write Draft', nodeType: 'llm',
            model: 'Gemma3 4B (Local)',
            temperature: 0.9,
            systemPrompt: `You are a creative storyteller. Write a short, engaging story (150-250 words) based on the user's prompt.
Use vivid descriptions and a clear narrative arc (beginning, middle, end).
End with a satisfying conclusion. Output ONLY the story, no meta-commentary.`,
          },
        },
        {
          id: 'n-hitl',  type: 'hitl',   position: { x: 580, y: 220 },
          data: {
            label: 'Review Draft', nodeType: 'hitl',
            question: 'Read the story draft below. Click Approve to finalize it, or add notes asking for changes (e.g., "make it funnier", "add a plot twist", "change the ending").',
          },
        },
        {
          id: 'n-revise',type: 'llm',    position: { x: 840, y: 220 },
          data: {
            label: 'Revise Story', nodeType: 'llm',
            model: 'Gemma3 4B (Local)',
            temperature: 0.8,
            systemPrompt: `You are revising a story draft based on reviewer feedback.
You will receive text that starts with "Reviewer approved with notes:" followed by the feedback and the original draft.
If the reviewer gave notes, revise the story accordingly.
If approved without notes, polish the draft slightly and output the final version.
Output ONLY the final story, no meta-commentary.`,
          },
        },
        { id: 'n-out',   type: 'output', position: { x: 1100, y: 220 }, data: { label: 'Final Story', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',     target: 'n-draft',  ...E('#7c6ff0') },
        { id: 'e2', source: 'n-draft',  target: 'n-hitl',   ...E('#f5a020') },
        { id: 'e3', source: 'n-hitl',   target: 'n-revise', ...E('#f5a020') },
        { id: 'e4', source: 'n-revise', target: 'n-out',    ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 5: Local Text Processor (Ollama multi-step pipeline)
  // Flow: Input → Gemma3 (structured analysis) → text_transformer (format)
  //       → sentiment_scorer (score Gemma3's response tone) → Gemma3 (final summary) → Output
  //
  // Each step builds on the previous — Gemma3 analyzes, tools enrich,
  // second Gemma3 synthesizes everything into a final readable response.
  // ══════════════════════════════════════════════════════════════════════════
  const a5 = {
    id: uuidv4(),
    user_id: userId,
    name: 'Local Text Processor (Ollama)',
    description: 'Multi-step local pipeline: Gemma3 analyzes your input → text_transformer formats it → sentiment_scorer scores the analysis → Gemma3 synthesizes a final summary. All LLM steps run locally via Ollama.',
    schema: {
      nodes: [
        { id: 'n-in',       type: 'input',  position: { x: 60,   y: 220 }, data: { label: 'Input Text',    nodeType: 'input'  } },
        {
          id: 'n-analyze',  type: 'llm',    position: { x: 300,  y: 220 },
          data: {
            label: 'Analyze (Gemma3)', nodeType: 'llm',
            model: 'Gemma3 4B (Local)',
            temperature: 0.5,
            systemPrompt: `Analyze the given text and provide a structured response with:
1. TOPIC: What is this about? (1 sentence)
2. KEY POINTS: 2-3 bullet points of main ideas
3. TONE: What is the tone/mood of this text?
4. VERDICT: Is this text clear and effective? (1 sentence)
Be concise. Use the exact headings above.`,
          },
        },
        { id: 'n-fmt',      type: 'tool',   position: { x: 580,  y: 220 }, data: { label: 'Format Output', nodeType: 'tool', toolName: 'text_transformer' } },
        { id: 'n-score',    type: 'tool',   position: { x: 840,  y: 220 }, data: { label: 'Score Tone',    nodeType: 'tool', toolName: 'sentiment_scorer'  } },
        {
          id: 'n-summary',  type: 'llm',    position: { x: 1120, y: 220 },
          data: {
            label: 'Synthesize (Gemma3)', nodeType: 'llm',
            model: 'Gemma3 4B (Local)',
            temperature: 0.4,
            systemPrompt: `You receive a JSON object from a processing pipeline. It contains:
- sentiment, score, emoji: tone analysis of the previous analysis
- original_text: the structured analysis text

Write a clean, final 2-3 paragraph summary that combines the analysis insights with the tone assessment.
Start with the key topic and findings, then note the overall tone.
Be clear and professional. No JSON, just readable prose.`,
          },
        },
        { id: 'n-out',      type: 'output', position: { x: 1400, y: 220 }, data: { label: 'Final Report',  nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',      target: 'n-analyze', ...E('#7c6ff0') },
        { id: 'e2', source: 'n-analyze', target: 'n-fmt',     ...E('#22d79a') },
        { id: 'e3', source: 'n-fmt',     target: 'n-score',   ...E('#22d79a') },
        { id: 'e4', source: 'n-score',   target: 'n-summary', ...E('#7c6ff0') },
        { id: 'e5', source: 'n-summary', target: 'n-out',     ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  const { error: e1 } = await db.from('agents').insert(a1)
  if (e1) return NextResponse.json({ error: e1.message, agent: a1.name }, { status: 500 })

  const { error: e2 } = await db.from('agents').insert(a2)
  if (e2) return NextResponse.json({ error: e2.message, agent: a2.name }, { status: 500 })

  const { error: e3 } = await db.from('agents').insert(a3)
  if (e3) return NextResponse.json({ error: e3.message, agent: a3.name }, { status: 500 })

  const { error: e4 } = await db.from('agents').insert(a4)
  if (e4) return NextResponse.json({ error: e4.message, agent: a4.name }, { status: 500 })

  const { error: e5 } = await db.from('agents').insert(a5)
  if (e5) return NextResponse.json({ error: e5.message, agent: a5.name }, { status: 500 })

  return NextResponse.json({
    seeded: { models: MODELS.length, tools: TOOLS.length, prompts: PROMPTS.length, agents: 5 },
    agents: [
      { name: a1.name, description: 'Pure function tool — no API key needed.' },
      { name: a2.name, description: 'Direct Gemini chat.' },
      { name: a3.name, description: 'Function tool → Gemini LLM pipeline.' },
      { name: a4.name, description: 'Multi-step Ollama with HITL review loop.' },
      { name: a5.name, description: 'Ollama → tools → Ollama pipeline.' },
    ],
  }, { status: 201 })
}
