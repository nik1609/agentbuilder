import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

const E = (color: string) => ({ type: 'smoothstep', animated: true, style: { stroke: color, strokeWidth: 2.5 }, markerEnd: { type: 'arrowclosed', color, width: 20, height: 20 } })

// ─── Model Configs ─────────────────────────────────────────────────────────────
const MODELS = [
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
    description: 'Search the web using DuckDuckGo (free, no API key needed). Returns relevant results for any query.',
    type: 'web_search',
    endpoint: '',
    method: 'GET',
    headers: {},
    timeout: 10000,
    input_schema: { provider: 'duckduckgo', max_results: 5 },
  },
  {
    name: 'web_scraper',
    description: 'Scrape any webpage and extract its content as clean text/markdown using Jina AI Reader.',
    type: 'web_scrape',
    endpoint: '',
    method: 'GET',
    headers: {},
    timeout: 15000,
  },
  {
    name: 'webhook_post',
    description: 'POST JSON data to any webhook URL. Configure the endpoint in the tool settings.',
    type: 'http',
    endpoint: 'https://httpbin.org/post',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeout: 8000,
  },
]

// ─── Prompts ──────────────────────────────────────────────────────────────────
const PROMPTS = [
  {
    name: 'Helpful Assistant',
    content: `You are a helpful, friendly assistant. Answer clearly and concisely. If you don't know something, say so honestly.`,
    variables: [],
  },
  {
    name: 'Content Summarizer',
    content: `You are a professional summarizer. Create a concise, accurate summary of the provided content.
- Capture the key points and main ideas
- Use bullet points for clarity
- Keep it under 150 words
- Preserve any important numbers, names, or dates`,
    variables: [],
  },
  {
    name: 'Research Synthesizer',
    content: `You are a research assistant. Synthesize the provided information into a clear, well-structured response.
Format with ## headings, bullet points, and cite sources where relevant.
Be factual and concise.`,
    variables: [],
  },
]

const AGENT_NAMES = [
  'Quick Gemini Chat',
  'Text Analysis Pipeline',
  'Web Research Report',
  'Email Drafter + Human Review',
  'Smart Support Router',
  'Parallel Analyzer',
  'Iterative Blog Writer',
  'Topic Expert Router',
  'Trip Planner with Clarification',
  'Vendor Due Diligence Agent',
  // Legacy names to clean up
  'Word Counter', 'Gemini Chatbot', 'Sentiment Analyst',
  'Story Writer (Ollama)', 'Local Text Processor (Ollama)',
  'Web Research Agent', 'Smart Content Router', 'Iterative Quality Writer',
]

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const now = new Date().toISOString()

  // Clear existing seed data
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
  // AGENT 1: Quick Gemini Chat
  // Demonstrates: Basic LLM node
  // Flow: Input → Gemini LLM → Output
  // Try it: Ask anything — "What is quantum computing?", "Write a haiku about rain"
  // ══════════════════════════════════════════════════════════════════════════
  const a1 = {
    id: uuidv4(), user_id: userId,
    name: 'Quick Gemini Chat',
    description: 'The simplest agent — type anything and Gemini answers. Demonstrates the LLM node. No API key setup required if GEMINI_API_KEY is set in your environment.',
    schema: {
      nodes: [
        { id: 'n-in',  type: 'input',  position: { x: 400, y: 60  }, data: { label: 'Your Message', nodeType: 'input' } },
        {
          id: 'n-llm', type: 'llm',    position: { x: 400, y: 220 },
          data: {
            label: 'Gemini Assistant', nodeType: 'llm',
            model: '',
            temperature: 0.7,
            systemPrompt: 'You are a helpful, friendly assistant. Answer clearly and concisely. If you are unsure about something, say so.',
          },
        },
        { id: 'n-out', type: 'output', position: { x: 400, y: 380 }, data: { label: 'Response', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',  target: 'n-llm', ...E('#7c6ff0') },
        { id: 'e2', source: 'n-llm', target: 'n-out', ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 2: Text Analysis Pipeline
  // Demonstrates: Function tools (no API key needed) + LLM
  // Flow: Input → word_counter → sentiment_scorer → LLM (interprets both) → Output
  // Tools run pure JS, no external calls. LLM synthesizes the JSON results.
  // ══════════════════════════════════════════════════════════════════════════
  const a2 = {
    id: uuidv4(), user_id: userId,
    name: 'Text Analysis Pipeline',
    description: 'Analyzes any text using two built-in function tools (word counter + sentiment scorer), then Gemini interprets the combined results. Tools run instantly with no API key. Great for learning tool → LLM pipelines.',
    schema: {
      nodes: [
        { id: 'n-in',   type: 'input',  position: { x: 400, y: 60  }, data: { label: 'Input Text', nodeType: 'input' } },
        { id: 'n-wc',   type: 'tool',   position: { x: 400, y: 220 }, data: { label: 'Count Words', nodeType: 'tool', toolName: 'word_counter' } },
        { id: 'n-sent', type: 'tool',   position: { x: 400, y: 380 }, data: { label: 'Score Sentiment', nodeType: 'tool', toolName: 'sentiment_scorer' } },
        {
          id: 'n-llm',  type: 'llm',    position: { x: 400, y: 540 },
          data: {
            label: 'Interpret Results', nodeType: 'llm',
            model: '',
            temperature: 0.6,
            systemPrompt: `You receive a JSON object from a sentiment analysis tool that also contains word count stats from a prior step in its "original_text" field. The JSON has these fields:
- sentiment: "positive", "negative", or "neutral"
- score: numeric sentiment score
- emoji: mood emoji
- pos_signals / neg_signals: counts of positive/negative words found
- original_text: the text that was analyzed (may be truncated)

Write a short, friendly 3-4 sentence interpretation covering:
1. The overall sentiment and what signals suggest it
2. Any notable observations about the writing

Be conversational. Do NOT just restate the JSON fields.`,
          },
        },
        { id: 'n-out',  type: 'output', position: { x: 400, y: 710 }, data: { label: 'Analysis Report', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',   target: 'n-wc',   ...E('#22d79a') },
        { id: 'e2', source: 'n-wc',   target: 'n-sent', ...E('#22d79a') },
        { id: 'e3', source: 'n-sent', target: 'n-llm',  ...E('#7c6ff0') },
        { id: 'e4', source: 'n-llm',  target: 'n-out',  ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 3: Web Research Report
  // Demonstrates: web_search tool + Passthrough (template vars) + LLM synthesis
  // Flow: Input → web_search → Passthrough (adds query context) → LLM → Output
  // Passthrough uses {{n-in}} to inject the original query alongside search results
  // ══════════════════════════════════════════════════════════════════════════
  const a3 = {
    id: uuidv4(), user_id: userId,
    name: 'Web Research Report',
    description: 'Search the web for any topic and get a structured research summary. Uses the Passthrough node to combine the original query with search results before passing to Gemini. Shows: web_search tool → Passthrough → LLM.',
    schema: {
      nodes: [
        { id: 'n-in',   type: 'input',  position: { x: 400, y: 60  }, data: { label: 'Research Topic', nodeType: 'input' } },
        { id: 'n-srch', type: 'tool',   position: { x: 400, y: 220 }, data: {
          label: 'Web Search', nodeType: 'tool', toolName: 'web_search',
          toolConfig: { type: 'web_search', endpoint: '', method: 'GET', headers: {}, timeout: 10000, input_schema: { provider: 'duckduckgo', max_results: 5 } },
        }},
        {
          id: 'n-pass', type: 'passthrough', position: { x: 400, y: 380 },
          data: {
            label: 'Format Context', nodeType: 'passthrough',
            template: 'Research query: {{n-in}}\n\nSearch results:\n{{last_output}}',
          },
        },
        {
          id: 'n-llm',  type: 'llm',    position: { x: 400, y: 540 },
          data: {
            label: 'Synthesize Report', nodeType: 'llm',
            model: '',
            temperature: 0.3,
            systemPrompt: `You are a research assistant. You receive a research query followed by web search results.
Produce a clear, well-structured report.

Format:
## Summary
(2-3 sentences capturing the key finding)

## Key Points
- Point 1
- Point 2
- Point 3

## Sources
(list 2-3 source names/URLs from the results)

Be factual and cite where information came from. If results are sparse, note that.`,
          },
        },
        { id: 'n-out',  type: 'output', position: { x: 400, y: 710 }, data: { label: 'Research Summary', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',   target: 'n-srch', ...E('#22d79a') },
        { id: 'e2', source: 'n-srch', target: 'n-pass', ...E('#64b5f6') },
        { id: 'e3', source: 'n-pass', target: 'n-llm',  ...E('#7c6ff0') },
        { id: 'e4', source: 'n-llm',  target: 'n-out',  ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 4: Email Drafter + Human Review (HITL)
  // Demonstrates: HITL node — human-in-the-loop approval with optional feedback
  // Flow: Input (brief) → LLM (draft email) → HITL (review) → LLM (finalize) → Output
  //
  // HOW TO USE HITL:
  // 1. Run the agent — it will pause at the HITL node showing "waiting_hitl"
  // 2. In the builder test panel: click Approve or type feedback then Approve
  // 3. If you gave feedback: final LLM rewrites draft incorporating your notes
  // 4. If you just approved: final LLM polishes and sends as-is
  //
  // Via API: POST /api/runs/{runId}/hitl/approve with optional {"feedback":"..."}
  // ══════════════════════════════════════════════════════════════════════════
  const a4 = {
    id: uuidv4(), user_id: userId,
    name: 'Email Drafter + Human Review',
    description: 'Gemini drafts a professional email from your brief, then pauses for your review (HITL). Approve as-is or give feedback like "make it shorter" or "add a follow-up question" — Gemini rewrites accordingly. Best demo of the HITL node.',
    schema: {
      nodes: [
        { id: 'n-in',    type: 'input',  position: { x: 400, y: 60  }, data: { label: 'Email Brief', nodeType: 'input' } },
        {
          id: 'n-draft', type: 'llm',    position: { x: 400, y: 220 },
          data: {
            label: 'Draft Email', nodeType: 'llm',
            model: '',
            temperature: 0.6,
            systemPrompt: `You are a professional email writer. The user provides a brief describing what they need.
Write a complete, professional email with:
- A clear subject line (prefix with "Subject: ")
- Appropriate greeting
- Concise body (3-4 sentences max)
- Professional sign-off

Output ONLY the email. No commentary.`,
          },
        },
        {
          id: 'n-hitl',  type: 'hitl',   position: { x: 400, y: 390 },
          data: {
            label: 'Review Draft', nodeType: 'hitl',
            question: 'Review the email draft above. Click Approve to finalize it, or type specific feedback before approving (e.g., "make it more formal", "shorten to 2 sentences", "add a deadline of Friday", "change the tone to be warmer").',
          },
        },
        {
          id: 'n-final', type: 'llm',    position: { x: 400, y: 560 },
          data: {
            label: 'Finalize Email', nodeType: 'llm',
            model: '',
            temperature: 0.4,
            systemPrompt: `You are finalizing an email draft based on reviewer feedback.

Your input will be in this format:
"Reviewer approved with notes: '[feedback]'

Previous context: [original draft]"

If feedback was provided: rewrite the email incorporating all the reviewer's notes.
If approved without notes: lightly polish the draft (fix any awkward phrasing, ensure professional tone).

Output ONLY the final email. No commentary.`,
          },
        },
        { id: 'n-out',   type: 'output', position: { x: 400, y: 730 }, data: { label: 'Final Email', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',    target: 'n-draft', ...E('#7c6ff0') },
        { id: 'e2', source: 'n-draft', target: 'n-hitl',  ...E('#b080f8') },
        { id: 'e3', source: 'n-hitl',  target: 'n-final', ...E('#b080f8') },
        { id: 'e4', source: 'n-final', target: 'n-out',   ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 5: Smart Support Router (Condition)
  // Demonstrates: Condition node — binary branching based on LLM evaluation
  // Flow: Input → LLM (classify as BILLING or TECHNICAL)
  //       → Condition (does output contain "BILLING"?)
  //       [true]  → Billing specialist LLM → Output
  //       [false] → Tech support LLM → Output
  // ══════════════════════════════════════════════════════════════════════════
  const a5 = {
    id: uuidv4(), user_id: userId,
    name: 'Smart Support Router',
    description: 'Classifies your support request as BILLING or TECHNICAL, then routes it to the right specialist LLM. Demonstrates the Condition node for binary branching. Try: "I was charged twice last month" vs "My API keeps returning 500 errors".',
    schema: {
      nodes: [
        { id: 'n-in',     type: 'input',     position: { x: 400, y: 60  }, data: { label: 'Support Request', nodeType: 'input' } },
        {
          id: 'n-clf',    type: 'llm',       position: { x: 400, y: 220 },
          data: {
            label: 'Classify Request', nodeType: 'llm',
            model: '',
            temperature: 0.0,
            systemPrompt: `Classify the support request into one of two categories.

Reply with ONLY one word:
BILLING — payment issues, charges, refunds, subscriptions, invoices, pricing
TECHNICAL — bugs, errors, API, code, integrations, features, how-to questions

Reply with ONLY "BILLING" or "TECHNICAL". Nothing else.`,
          },
        },
        {
          id: 'n-cond',   type: 'condition', position: { x: 400, y: 380 },
          data: { label: 'Is Billing?', nodeType: 'condition', model: '', condition: 'the output contains BILLING' },
        },
        {
          id: 'n-billing',type: 'llm',       position: { x: 200, y: 540 },
          data: {
            label: 'Billing Support', nodeType: 'llm',
            model: '',
            temperature: 0.5,
            systemPrompt: 'You are a billing support specialist. Help the customer with their billing or payment issue. Be empathetic, clear, and offer concrete next steps. If a refund or account change is needed, explain the process.',
          },
        },
        {
          id: 'n-tech',   type: 'llm',       position: { x: 600, y: 540 },
          data: {
            label: 'Tech Support', nodeType: 'llm',
            model: '',
            temperature: 0.5,
            systemPrompt: 'You are a technical support engineer. Help the user solve their technical problem. Be precise, suggest diagnostic steps, and provide code examples where relevant. Ask clarifying questions if needed.',
          },
        },
        { id: 'n-out',    type: 'output',    position: { x: 400, y: 710 }, data: { label: 'Support Response', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',      target: 'n-clf',     ...E('#7c6ff0') },
        { id: 'e2', source: 'n-clf',     target: 'n-cond',    ...E('#f5a020') },
        { id: 'e3', source: 'n-cond',    target: 'n-billing', sourceHandle: 'true',  ...E('#22d79a') },
        { id: 'e4', source: 'n-cond',    target: 'n-tech',    sourceHandle: 'false', ...E('#e85555') },
        { id: 'e5', source: 'n-billing', target: 'n-out',     ...E('#7c6ff0') },
        { id: 'e6', source: 'n-tech',    target: 'n-out',     ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 6: Parallel Analyzer (Fork + Join)
  // Demonstrates: Fork (parallel execution) + Join (merge results)
  // Flow: Input → Fork
  //       [Branch A] → LLM (2-sentence summary) → Join
  //       [Branch B] → sentiment_scorer (tool) → Join
  //       → Join (concatenated merge) → LLM (combine both perspectives) → Output
  //
  // Both branches run in PARALLEL. Join waits for both, concatenates outputs.
  // Final LLM gets a summary AND sentiment score to synthesize.
  // ══════════════════════════════════════════════════════════════════════════
  const a6 = {
    id: uuidv4(), user_id: userId,
    name: 'Parallel Analyzer',
    description: 'Runs two analysis branches simultaneously (Fork): one summarizes your text with Gemini, the other scores its sentiment with a function tool. Join merges both results, then Gemini synthesizes a combined analysis. Demonstrates Fork + Join parallel execution.',
    schema: {
      nodes: [
        { id: 'n-in',   type: 'input',  position: { x: 400, y: 60  }, data: { label: 'Text to Analyze', nodeType: 'input' } },
        {
          id: 'n-fork', type: 'fork',   position: { x: 400, y: 200 },
          data: {
            label: 'Analyze in Parallel', nodeType: 'fork',
            inputMode: 'broadcast',
            branches: [
              { id: 'b-sum',  label: 'Summarize' },
              { id: 'b-tone', label: 'Tone Check' },
            ],
          },
        },
        {
          id: 'n-sum',  type: 'llm',    position: { x: 180, y: 360 },
          data: {
            label: 'Quick Summary', nodeType: 'llm',
            model: '',
            temperature: 0.3,
            systemPrompt: 'Summarize the input text in exactly 2 clear sentences. Capture the most important point. Output ONLY the 2-sentence summary, nothing else.',
          },
        },
        { id: 'n-tone', type: 'tool',   position: { x: 620, y: 360 }, data: { label: 'Sentiment Score', nodeType: 'tool', toolName: 'sentiment_scorer' } },
        {
          id: 'n-join', type: 'join',   position: { x: 400, y: 520 },
          data: { label: 'Merge Results', nodeType: 'join', mergeFormat: 'concatenated', joinMode: 'wait_all', mergeAs: 'combined' },
        },
        {
          id: 'n-llm',  type: 'llm',    position: { x: 400, y: 680 },
          data: {
            label: 'Combine Insights', nodeType: 'llm',
            model: '',
            temperature: 0.5,
            systemPrompt: `You receive two analysis results merged together:
1. A 2-sentence summary of the text
2. A JSON sentiment score object with sentiment, score, emoji, and signals

Write a cohesive 3-4 sentence analysis that combines both perspectives:
- Start with what the text is about (from the summary)
- Note the overall tone/sentiment and what drives it
- End with a brief assessment of the text's effectiveness

Be clear and insightful. No bullet points, just flowing prose.`,
          },
        },
        { id: 'n-out',  type: 'output', position: { x: 400, y: 840 }, data: { label: 'Combined Analysis', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',   target: 'n-fork', ...E('#26c6da') },
        { id: 'e2', source: 'n-fork', target: 'n-sum',  sourceHandle: 'b-sum',  ...E('#7c6ff0') },
        { id: 'e3', source: 'n-fork', target: 'n-tone', sourceHandle: 'b-tone', ...E('#22d79a') },
        { id: 'e4', source: 'n-sum',  target: 'n-join', targetHandle: 'join-in-1', ...E('#26c6da') },
        { id: 'e5', source: 'n-tone', target: 'n-join', targetHandle: 'join-in-2', ...E('#26c6da') },
        { id: 'e6', source: 'n-join', target: 'n-llm',  ...E('#7c6ff0') },
        { id: 'e7', source: 'n-llm',  target: 'n-out',  ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 7: Iterative Blog Writer (Loop)
  // Demonstrates: Loop node — repeats a step N times to iteratively improve output
  // Flow: Input (topic/brief) → Loop (3 iterations, exits after iteration >= 3)
  //       → LLM (write on pass 1, improve on passes 2-3) → [back to Loop]
  //       → Output (final draft after loop exits)
  //
  // Each pass: LLM receives its previous output and improves it.
  // Watch the Trace panel to see each iteration.
  // ══════════════════════════════════════════════════════════════════════════
  const a7 = {
    id: uuidv4(), user_id: userId,
    name: 'Iterative Blog Writer',
    description: 'Demonstrates the Loop node: Gemini writes an initial blog post draft, then refines it twice more (3 passes total). Each iteration improves structure, clarity, and engagement. Watch the Trace panel to see each pass. Try: "Write a blog post about the benefits of remote work".',
    schema: {
      nodes: [
        { id: 'n-in',   type: 'input',  position: { x: 400, y: 60  }, data: { label: 'Blog Brief', nodeType: 'input' } },
        {
          id: 'n-loop', type: 'loop',   position: { x: 400, y: 200 },
          data: {
            label: 'Refine 3x', nodeType: 'loop',
            maxIterations: 3,
            exitConditionType: 'expression',
            exitCondition: 'iteration >= 3',
            onMaxReached: 'continue',
          },
        },
        {
          id: 'n-write',type: 'llm',    position: { x: 400, y: 360 },
          data: {
            label: 'Write & Refine', nodeType: 'llm',
            model: '',
            temperature: 0.75,
            systemPrompt: `You are an iterative blog writer working in multiple passes.

Pass 1: You receive a brief. Write a complete first draft (introduction, 3 sections with headers, conclusion). ~300-400 words.

Pass 2+: You receive your previous draft. Improve it by:
- Strengthening the opening hook
- Making each section more specific with examples
- Improving transitions between sections
- Sharpening the conclusion with a clear call-to-action

Output ONLY the blog post content. No commentary like "Here's the improved version".`,
          },
        },
        { id: 'n-out',  type: 'output', position: { x: 400, y: 520 }, data: { label: 'Final Blog Post', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',    target: 'n-loop',  ...E('#ff7043') },
        { id: 'e2', source: 'n-loop',  target: 'n-write', ...E('#7c6ff0') },
        { id: 'e3', source: 'n-write', target: 'n-loop',  targetHandle: 'loop-back', ...E('#ff7043') },
        { id: 'e4', source: 'n-write', target: 'n-out',   ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 8: Topic Expert Router (Switch)
  // Demonstrates: Switch node with llm_classify — routes to a specialist per topic
  // Flow: Input → Switch (llm_classify: Technology | Health | Business)
  //       [Technology] → Tech expert LLM → Output
  //       [Health]     → Health advisor LLM → Output
  //       [Business]   → Business analyst LLM → Output
  //       [default]    → General assistant LLM → Output
  //
  // llm_classify internally calls Gemini to pick the best matching category.
  // The Switch node then activates only that branch.
  // ══════════════════════════════════════════════════════════════════════════
  const a8 = {
    id: uuidv4(), user_id: userId,
    name: 'Topic Expert Router',
    description: 'Automatically routes your question to a specialist based on its topic. Switch node uses LLM classification to pick: Technology expert, Health advisor, or Business analyst. Unrecognized topics go to a general assistant. Demonstrates the Switch node with llm_classify.',
    schema: {
      nodes: [
        { id: 'n-in',    type: 'input',  position: { x: 400, y: 60  }, data: { label: 'Your Question', nodeType: 'input' } },
        {
          id: 'n-sw',    type: 'switch', position: { x: 400, y: 200 },
          data: {
            label: 'Topic Router', nodeType: 'switch',
            switchType: 'llm_classify',
            model: '',
            cases: [
              { label: 'Technology', match: '' },
              { label: 'Health',     match: '' },
              { label: 'Business',   match: '' },
            ],
            defaultCase: 'General',
          },
        },
        {
          id: 'n-tech',  type: 'llm',    position: { x: 100, y: 360 },
          data: {
            label: 'Tech Expert', nodeType: 'llm',
            model: '',
            temperature: 0.4,
            systemPrompt: 'You are a senior software engineer and technology expert. Answer technical questions with precision. Include code examples when helpful. Reference relevant standards, best practices, or tools.',
          },
        },
        {
          id: 'n-health',type: 'llm',    position: { x: 310, y: 360 },
          data: {
            label: 'Health Advisor', nodeType: 'llm',
            model: '',
            temperature: 0.3,
            systemPrompt: 'You are a knowledgeable health information advisor. Provide evidence-based health information clearly. Always recommend consulting a healthcare professional for personal medical decisions. Focus on general wellness and factual information.',
          },
        },
        {
          id: 'n-biz',   type: 'llm',    position: { x: 520, y: 360 },
          data: {
            label: 'Business Analyst', nodeType: 'llm',
            model: '',
            temperature: 0.5,
            systemPrompt: 'You are an experienced business analyst and strategy consultant. Provide practical business insights, frameworks, and actionable advice. Reference relevant business models, market dynamics, or financial principles when appropriate.',
          },
        },
        {
          id: 'n-gen',   type: 'llm',    position: { x: 700, y: 360 },
          data: {
            label: 'General Assistant', nodeType: 'llm',
            model: '',
            temperature: 0.7,
            systemPrompt: 'You are a helpful, knowledgeable assistant. Answer the question clearly and helpfully, drawing on broad general knowledge.',
          },
        },
        { id: 'n-out',   type: 'output', position: { x: 400, y: 530 }, data: { label: 'Expert Response', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',     target: 'n-sw',    ...E('#ffd600') },
        { id: 'e2', source: 'n-sw',     target: 'n-tech',  sourceHandle: 'Technology', ...E('#7c6ff0') },
        { id: 'e3', source: 'n-sw',     target: 'n-health',sourceHandle: 'Health',     ...E('#22d79a') },
        { id: 'e4', source: 'n-sw',     target: 'n-biz',   sourceHandle: 'Business',   ...E('#f5a020') },
        { id: 'e5', source: 'n-sw',     target: 'n-gen',   sourceHandle: 'General',    ...E('#b080f8') },
        { id: 'e6', source: 'n-tech',   target: 'n-out',   ...E('#7c6ff0') },
        { id: 'e7', source: 'n-health', target: 'n-out',   ...E('#22d79a') },
        { id: 'e8', source: 'n-biz',    target: 'n-out',   ...E('#f5a020') },
        { id: 'e9', source: 'n-gen',    target: 'n-out',   ...E('#b080f8') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 9: Trip Planner with Clarification (Clarify node)
  // Demonstrates: Clarify node — LLM pauses to ask the user a question mid-flow
  // Flow: Input (vague trip request) → Clarify (asks destination/duration/budget)
  //       → LLM (builds detailed itinerary using the clarified answer) → Output
  //
  // HOW TO USE:
  // 1. In Chat, type something vague like "help me plan a trip" or "I want to travel"
  // 2. The agent pauses and asks you a clarifying question about destination/dates
  // 3. Type your answer (e.g. "Tokyo for 5 days, budget $2000")
  // 4. Gemini builds a full day-by-day itinerary with that context
  // ══════════════════════════════════════════════════════════════════════════
  const a9 = {
    id: uuidv4(), user_id: userId,
    name: 'Trip Planner with Clarification',
    description: 'Demonstrates the Clarify node: type a vague trip request and the agent pauses to ask for specifics (destination, duration, budget). Once you answer, Gemini builds a detailed day-by-day itinerary. Best demo of the Clarify node — try it in Chat.',
    schema: {
      nodes: [
        { id: 'n-in',     type: 'input',   position: { x: 400, y: 60  }, data: { label: 'Trip Request', nodeType: 'input' } },
        {
          id: 'n-clarify', type: 'clarify', position: { x: 400, y: 220 },
          data: {
            label: 'Get Trip Details', nodeType: 'clarify',
            model: '',
            clarifySystemPrompt: `You are a friendly travel assistant. The user has given you a vague trip request. Ask them ONE specific question to gather the most important missing details needed to plan their trip.

Focus on the most critical unknown: destination, duration, or budget — whichever is most unclear from their message. Ask naturally, as if you're a helpful travel agent. Keep it to one sentence.`,
          },
        },
        {
          id: 'n-plan',  type: 'llm',     position: { x: 400, y: 400 },
          data: {
            label: 'Build Itinerary', nodeType: 'llm',
            model: '',
            temperature: 0.6,
            systemPrompt: `You are an expert travel planner. You will receive the user's original trip request followed by their clarifying answer in this format:

"User answered: '[their answer]'

Previous context: [original request]"

Using both pieces of information, create a detailed, practical travel itinerary.

Format your response as:
## Trip Overview
(destination, dates/duration, estimated budget if mentioned)

## Day-by-Day Plan
**Day 1:** ...
**Day 2:** ...
(continue for each day)

## Practical Tips
- Best time to visit each attraction
- Transport between locations
- Food recommendations

Keep it specific and actionable. Tailor it to any budget or preference clues given.`,
          },
        },
        { id: 'n-out',   type: 'output',  position: { x: 400, y: 580 }, data: { label: 'Travel Itinerary', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e1', source: 'n-in',      target: 'n-clarify', ...E('#f472b6') },
        { id: 'e2', source: 'n-clarify', target: 'n-plan',    ...E('#f472b6') },
        { id: 'e3', source: 'n-plan',    target: 'n-out',     ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AGENT 10: Vendor Due Diligence Agent (FLAGSHIP DEMO)
  // Demonstrates: Clarify + Fork (5 parallel tool calls) + Join + Condition
  //               (risk gate) + Loop (self-directed gap filling) + HITL + LLM
  //
  // A single LLM cannot do this — requires parallel research, risk-gated routing,
  // iterative self-improvement, and human judgment at the right moment.
  //
  // Flow:
  //   Input (vendor + use case)
  //   → Clarify (primary concern)
  //   → Fork 5 branches SIMULTANEOUSLY:
  //       A: Passthrough (build security query) → web_search → LLM extract risk signals
  //       B: Passthrough (build pricing query)  → web_search → LLM extract cost gotchas
  //       C: Passthrough (build reviews query)  → web_search → sentiment_scorer → LLM summarize
  //       D: Passthrough (build SLA query)      → web_search → LLM extract reliability score
  //       E: Passthrough (build compliance query)→ web_search → LLM extract certifications
  //   → Join (wait all 5)
  //   → Passthrough (inject vendor name for scoring)
  //   → LLM score vendor: Security / Cost / Reliability / Compliance (0–10 each)
  //   → Condition: any score < 4? (critical risk threshold)
  //       TRUE  → LLM format risk summary → HITL ("CRITICAL RISK — review before proceeding")
  //       FALSE → Loop (LLM self-evaluates if gaps exist, max 2x targeted searches)
  //                 → LLM query generator → web_search → LLM extract gaps
  //   → LLM draft full due diligence report
  //   → HITL (procurement lead adds institutional context)
  //   → LLM finalize incorporating reviewer notes
  //   → Output: Vendor Scorecard (Approve / Approve with conditions / Reject)
  // ══════════════════════════════════════════════════════════════════════════
  const a10 = {
    id: uuidv4(), user_id: userId,
    name: 'Vendor Due Diligence Agent',
    description: 'The flagship demo agent. Runs 5 parallel web research branches simultaneously (security, pricing, reviews, uptime, compliance), applies a risk-gate Condition, self-directs gap filling via a Loop, then pauses for human sign-off before producing a vendor scorecard. Impossible with a single LLM call.',
    schema: {
      nodes: [
        // ── Entry ──────────────────────────────────────────────────────────
        { id: 'n-in', type: 'input', position: { x: 500, y: 40 },
          data: { label: 'Vendor + Use Case', nodeType: 'input' } },

        // ── Clarify ────────────────────────────────────────────────────────
        { id: 'n-clarify', type: 'clarify', position: { x: 500, y: 160 },
          data: {
            label: 'Understand Priority', nodeType: 'clarify', model: '',
            clarifySystemPrompt: `You are a procurement assistant helping vet a software vendor. The user has told you the vendor name and use case. Ask them ONE focused question to understand their biggest concern so the research can be prioritized.

Choose the most important unknown from: (a) security & compliance requirements, (b) budget constraints and total cost of ownership, or (c) reliability requirements and expected SLA. Frame it as a clear, single question.`,
          },
        },

        // ── Fork: 5 parallel research branches ─────────────────────────────
        { id: 'n-fork', type: 'fork', position: { x: 500, y: 300 },
          data: {
            label: 'Research in Parallel', nodeType: 'fork', inputMode: 'broadcast',
            branches: [
              { id: 'b-sec',   label: 'Security Research' },
              { id: 'b-cost',  label: 'Pricing Research' },
              { id: 'b-rev',   label: 'Customer Reviews' },
              { id: 'b-rel',   label: 'Reliability Research' },
              { id: 'b-comp',  label: 'Compliance Check' },
            ],
          },
        },

        // ── Branch A: Security ──────────────────────────────────────────────
        // Passthrough builds a targeted search query using {{n-in}} (original vendor input)
        { id: 'n-pass-sec', type: 'passthrough', position: { x: 40, y: 440 },
          data: {
            label: 'Build Security Query', nodeType: 'passthrough',
            template: '{{n-in}} security breach data leak CVE vulnerability 2024',
          },
        },
        { id: 'n-srch-sec', type: 'tool', position: { x: 40, y: 580 },
          data: {
            label: 'Search: Security History', nodeType: 'tool', toolName: 'web_search',
            toolConfig: { type: 'web_search', endpoint: '', method: 'GET', headers: {}, timeout: 10000, input_schema: { provider: 'duckduckgo', max_results: 5 } },
          },
        },
        { id: 'n-llm-sec', type: 'llm', position: { x: 40, y: 720 },
          data: {
            label: 'Extract Security Signals', nodeType: 'llm', model: '', temperature: 0.1,
            systemPrompt: `You receive web search results about a vendor's security and data breach history.

Extract and summarize:
1. Any known data breaches (dates, severity, data exposed)
2. CVEs or known vulnerabilities
3. Security incident response quality
4. Any ongoing security concerns

Output as JSON: { "breaches": [...], "cves": [...], "security_score": 0-10, "summary": "..." }
Score 10 = no known issues, 0 = major active breach. If no issues found, score 8 (unknown ≠ clean).`,
          },
        },

        // ── Branch B: Pricing ───────────────────────────────────────────────
        { id: 'n-pass-cost', type: 'passthrough', position: { x: 220, y: 440 },
          data: {
            label: 'Build Pricing Query', nodeType: 'passthrough',
            template: '{{n-in}} pricing enterprise contract cost hidden fees 2024',
          },
        },
        { id: 'n-srch-cost', type: 'tool', position: { x: 220, y: 580 },
          data: {
            label: 'Search: Pricing & Contracts', nodeType: 'tool', toolName: 'web_search',
            toolConfig: { type: 'web_search', endpoint: '', method: 'GET', headers: {}, timeout: 10000, input_schema: { provider: 'duckduckgo', max_results: 5 } },
          },
        },
        { id: 'n-llm-cost', type: 'llm', position: { x: 220, y: 720 },
          data: {
            label: 'Extract Cost Intelligence', nodeType: 'llm', model: '', temperature: 0.1,
            systemPrompt: `You receive web search results about a vendor's pricing and enterprise contracts. Extract:
1. Pricing tiers and starting costs
2. Enterprise contract terms (annual commitment, seat minimums)
3. Hidden costs (overage fees, add-ons, professional services)
4. Price increase history or complaints
5. Any "pricing not transparent" complaints

Output as JSON: { "pricing_tiers": [...], "hidden_costs": [...], "cost_score": 0-10, "summary": "..." }
Score 10 = transparent, fair pricing. Score 0 = opaque, predatory, many hidden costs.`,
          },
        },

        // ── Branch C: Customer Reviews → Sentiment ──────────────────────────
        { id: 'n-pass-rev', type: 'passthrough', position: { x: 400, y: 440 },
          data: {
            label: 'Build Reviews Query', nodeType: 'passthrough',
            template: '{{n-in}} reviews G2 Capterra user complaints pros cons 2024',
          },
        },
        { id: 'n-srch-rev', type: 'tool', position: { x: 400, y: 580 },
          data: {
            label: 'Search: G2/Capterra Reviews', nodeType: 'tool', toolName: 'web_search',
            toolConfig: { type: 'web_search', endpoint: '', method: 'GET', headers: {}, timeout: 10000, input_schema: { provider: 'duckduckgo', max_results: 8 } },
          },
        },
        { id: 'n-sent-rev', type: 'tool', position: { x: 400, y: 720 },
          data: { label: 'Score Sentiment', nodeType: 'tool', toolName: 'sentiment_scorer' },
        },
        { id: 'n-llm-rev', type: 'llm', position: { x: 400, y: 860 },
          data: {
            label: 'Summarize Customer Voice', nodeType: 'llm', model: '', temperature: 0.2,
            systemPrompt: `You receive customer review search results and a sentiment score JSON. Synthesize them into a customer satisfaction analysis.

Extract:
1. Top praised aspects (from positive reviews)
2. Top complaints (from negative reviews)
3. Support quality perception
4. Common deal-breakers mentioned

Use the sentiment score to calibrate your assessment.

Output as JSON: { "top_praise": [...], "top_complaints": [...], "support_quality": "good|mixed|poor", "customer_score": 0-10, "summary": "..." }`,
          },
        },

        // ── Branch D: Reliability / SLA ─────────────────────────────────────
        { id: 'n-pass-rel', type: 'passthrough', position: { x: 620, y: 440 },
          data: {
            label: 'Build Reliability Query', nodeType: 'passthrough',
            template: '{{n-in}} uptime SLA outage downtime incidents status page 2024',
          },
        },
        { id: 'n-srch-rel', type: 'tool', position: { x: 620, y: 580 },
          data: {
            label: 'Search: Uptime & Incidents', nodeType: 'tool', toolName: 'web_search',
            toolConfig: { type: 'web_search', endpoint: '', method: 'GET', headers: {}, timeout: 10000, input_schema: { provider: 'duckduckgo', max_results: 5 } },
          },
        },
        { id: 'n-llm-rel', type: 'llm', position: { x: 620, y: 720 },
          data: {
            label: 'Extract Reliability Data', nodeType: 'llm', model: '', temperature: 0.1,
            systemPrompt: `You receive search results about a vendor's uptime, SLA, outages, and reliability. Extract:
1. Stated SLA percentage (99.9%, 99.99%, etc.)
2. Known major outages (dates, duration, impact)
3. Status page transparency
4. SLA credit policy

Output as JSON: { "stated_sla": "...", "major_outages": [...], "reliability_score": 0-10, "summary": "..." }
Score 10 = 99.99%+ SLA, no major outages. Score 0 = frequent outages, no SLA.`,
          },
        },

        // ── Branch E: Compliance / Certifications (web_search, not scraper) ─
        { id: 'n-pass-comp', type: 'passthrough', position: { x: 820, y: 440 },
          data: {
            label: 'Build Compliance Query', nodeType: 'passthrough',
            template: '{{n-in}} SOC2 ISO27001 GDPR HIPAA compliance certifications trust security',
          },
        },
        { id: 'n-srch-comp', type: 'tool', position: { x: 820, y: 580 },
          data: {
            label: 'Search: Compliance & Certs', nodeType: 'tool', toolName: 'web_search',
            toolConfig: { type: 'web_search', endpoint: '', method: 'GET', headers: {}, timeout: 10000, input_schema: { provider: 'duckduckgo', max_results: 5 } },
          },
        },
        { id: 'n-llm-comp', type: 'llm', position: { x: 820, y: 720 },
          data: {
            label: 'Extract Certifications', nodeType: 'llm', model: '', temperature: 0.1,
            systemPrompt: `You receive web search results about a vendor's compliance certifications and security posture. Extract:
1. Security certifications held (SOC 2 Type II, ISO 27001, GDPR, HIPAA, PCI-DSS, FedRAMP, etc.)
2. Penetration testing frequency
3. Data residency options
4. Sub-processor transparency
5. Bug bounty program

Output as JSON: { "certifications": [...], "pen_test_frequency": "...", "data_residency": [...], "compliance_score": 0-10, "summary": "..." }
Score 10 = SOC2 Type II + ISO27001 + GDPR + transparent sub-processors. Score 0 = no certifications found.`,
          },
        },

        // ── Join: wait all 5 branches ───────────────────────────────────────
        { id: 'n-join', type: 'join', position: { x: 500, y: 1020 },
          data: {
            label: 'Consolidate All Research', nodeType: 'join',
            mergeFormat: 'concatenated', joinMode: 'wait_all', mergeAs: 'all_research',
          },
        },

        // ── Inject vendor name before scoring ──────────────────────────────
        // Prepends the original vendor input so the scoring LLM can populate vendor_name
        { id: 'n-vendor-ctx', type: 'passthrough', position: { x: 500, y: 1160 },
          data: {
            label: 'Add Vendor Context', nodeType: 'passthrough',
            template: 'Vendor being evaluated: {{n-in}}\n\nResearch findings:\n{{last_output}}',
          },
        },

        // ── Score all 5 dimensions ──────────────────────────────────────────
        { id: 'n-score', type: 'llm', position: { x: 500, y: 1300 },
          data: {
            label: 'Score Vendor (5 Dimensions)', nodeType: 'llm', model: '', temperature: 0.0,
            systemPrompt: `You receive vendor research with a header line "Vendor being evaluated: [name]" followed by concatenated research from 5 parallel analysis branches:
1. Security history analysis (JSON with security_score)
2. Pricing intelligence (JSON with cost_score)
3. Customer satisfaction (JSON with customer_score)
4. Reliability analysis (JSON with reliability_score)
5. Compliance certifications (JSON with compliance_score)

Extract the vendor name from the header line. Parse all JSON blocks and extract the numeric scores. Then output ONLY this JSON — no other text:
{
  "vendor_name": "...",
  "scores": {
    "security": <0-10>,
    "cost_transparency": <0-10>,
    "customer_satisfaction": <0-10>,
    "reliability": <0-10>,
    "compliance": <0-10>
  },
  "lowest_score": <lowest of all scores>,
  "lowest_dimension": "<dimension name>",
  "critical_risks": ["<any dimension scoring < 4>"],
  "overall": <average of all 5 scores, 1 decimal>
}`,
          },
        },

        // ── Condition: critical risk gate ────────────────────────────────────
        { id: 'n-cond', type: 'condition', position: { x: 500, y: 1460 },
          data: {
            label: 'Critical Risk Gate', nodeType: 'condition', model: '',
            condition: 'the JSON contains a "critical_risks" array that is not empty, meaning at least one dimension scored below 4',
          },
        },

        // ── TRUE branch: format risk summary → HITL escalation ─────────────
        // LLM converts scores JSON to readable markdown so the reviewer sees tables, not raw JSON
        { id: 'n-format-risk', type: 'llm', position: { x: 200, y: 1620 },
          data: {
            label: 'Format Risk Summary', nodeType: 'llm', model: '', temperature: 0.1,
            systemPrompt: `You receive vendor due diligence scores as JSON. Convert them into a clear, readable risk alert for a human reviewer. Do not output any raw JSON.

Format your response as:

## ⚠️ Critical Risk Alert — [Vendor Name]

**Overall Score:** X.X / 10

| Dimension | Score | Status |
|-----------|-------|--------|
| Security | X/10 | 🟢/🟡/🔴 |
| Cost Transparency | X/10 | 🟢/🟡/🔴 |
| Customer Satisfaction | X/10 | 🟢/🟡/🔴 |
| Reliability | X/10 | 🟢/🟡/🔴 |
| Compliance | X/10 | 🟢/🟡/🔴 |

(🟢 = 7+, 🟡 = 4–6, 🔴 = below 4 = critical risk)

## 🔴 Critical Dimensions
- **[dimension]** scored X/10 — [brief explanation of what this means for the business]

## Recommendation
This vendor has one or more critical risk flags. Human review required before proceeding.`,
          },
        },
        { id: 'n-hitl-risk', type: 'hitl', position: { x: 200, y: 1800 },
          data: {
            label: '⚠️ Critical Risk — Escalate', nodeType: 'hitl',
            question: 'CRITICAL RISK DETECTED: One or more vendor dimensions scored below 4/10. Review the risk summary above carefully. Do you want to proceed anyway (add your context below), or should this vendor be rejected? Your decision and reasoning will be included in the final report.',
          },
        },

        // ── FALSE branch: loop for gap filling ─────────────────────────────
        { id: 'n-loop', type: 'loop', position: { x: 760, y: 1620 },
          data: {
            label: 'Fill Research Gaps', nodeType: 'loop',
            maxIterations: 2, exitConditionType: 'llm', model: '',
            exitCondition: 'The research is comprehensive enough to write a confident vendor assessment with no major unanswered questions',
            onMaxReached: 'continue',
          },
        },
        // LLM reads scores + original input to generate a targeted search query string
        { id: 'n-query-gen', type: 'llm', position: { x: 760, y: 1780 },
          data: {
            label: 'Generate Gap Query', nodeType: 'llm', model: '', temperature: 0.3,
            systemPrompt: `You receive vendor research data. Your job is to generate ONE targeted web search query to fill the most important information gap.

Look at the data: identify which dimension has the lowest score or most uncertainty. The vendor name is available in context.

Output ONLY a search query string (5–9 words). Examples:
- "Stripe SOC2 Type II audit report 2024"
- "Salesforce enterprise pricing overage fees 2024"
- "AWS outage history SLA credits 2023 2024"

Do not output anything except the search query string.`,
          },
        },
        { id: 'n-gap-search', type: 'tool', position: { x: 760, y: 1940 },
          data: {
            label: 'Targeted Gap Search', nodeType: 'tool', toolName: 'web_search',
            toolConfig: { type: 'web_search', endpoint: '', method: 'GET', headers: {}, timeout: 10000, input_schema: { provider: 'duckduckgo', max_results: 5 } },
          },
        },
        { id: 'n-gap-llm', type: 'llm', position: { x: 760, y: 2080 },
          data: {
            label: 'Extract Gap Intelligence', nodeType: 'llm', model: '', temperature: 0.2,
            systemPrompt: 'You receive additional web search results gathered to fill gaps in vendor research. Extract any new relevant facts about security, pricing, reliability, or compliance and summarize them in 3-5 bullet points. Label each: [SECURITY], [COST], [RELIABILITY], or [COMPLIANCE].',
          },
        },

        // ── Draft full report ───────────────────────────────────────────────
        { id: 'n-draft', type: 'llm', position: { x: 500, y: 2260 },
          data: {
            label: 'Draft Due Diligence Report', nodeType: 'llm', model: '', temperature: 0.3,
            systemPrompt: `You are a senior procurement analyst. You have received comprehensive research on a software vendor from multiple parallel analysis branches. Write a professional due diligence report.

Structure it as:

# Vendor Due Diligence Report: [Vendor Name]
**Assessment Date:** [today]  **Prepared for:** Procurement Review

## Executive Summary
(2-3 sentences: overall recommendation and key rationale)

## Vendor Scorecard
| Dimension | Score | Status |
|-----------|-------|--------|
| Security | X/10 | 🟢/🟡/🔴 |
| Cost Transparency | X/10 | 🟢/🟡/🔴 |
| Customer Satisfaction | X/10 | 🟢/🟡/🔴 |
| Reliability | X/10 | 🟢/🟡/🔴 |
| Compliance | X/10 | 🟢/🟡/🔴 |
| **Overall** | **X.X/10** | |

(🟢 = 7+, 🟡 = 4-6, 🔴 = <4)

## Key Findings
### ✅ Strengths
- ...

### ⚠️ Risks & Concerns
- ...

### 🔴 Critical Issues (if any)
- ...

## Recommendation
**APPROVE** / **APPROVE WITH CONDITIONS** / **REJECT**

Conditions (if applicable):
- ...

## Next Steps
1. ...
2. ...

---
*This report was generated by autonomous research across security databases, pricing sources, customer review platforms, uptime records, and compliance certification sources.*`,
          },
        },

        // ── Final HITL: procurement sign-off ───────────────────────────────
        { id: 'n-hitl-final', type: 'hitl', position: { x: 500, y: 2420 },
          data: {
            label: 'Procurement Sign-off', nodeType: 'hitl',
            question: 'Review the due diligence report. Add any institutional context before finalizing (e.g. "we already have a signed BAA", "legal approved this vendor class", "we need HIPAA compliance specifically", "negotiate on price before signing"). Your notes will be incorporated into the final report.',
          },
        },

        // ── Finalize ────────────────────────────────────────────────────────
        { id: 'n-final', type: 'llm', position: { x: 500, y: 2580 },
          data: {
            label: 'Finalize Report', nodeType: 'llm', model: '', temperature: 0.2,
            systemPrompt: `You receive a vendor due diligence report followed by reviewer context in this format:
"Reviewer approved with notes: '[reviewer notes]'
Previous context: [report]"

If reviewer notes were provided: update the report to incorporate their institutional knowledge, adjust the recommendation if warranted, and add any conditions they specified.
If no notes: lightly polish the report (fix formatting, ensure professional tone).

Output the complete, final report only. No meta-commentary.`,
          },
        },

        // ── Output ──────────────────────────────────────────────────────────
        { id: 'n-out', type: 'output', position: { x: 500, y: 2740 },
          data: { label: 'Vendor Scorecard & Report', nodeType: 'output' } },
      ],
      edges: [
        { id: 'e-in-clarify',      source: 'n-in',          target: 'n-clarify',     ...E('#f472b6') },
        { id: 'e-clarify-fork',    source: 'n-clarify',     target: 'n-fork',        ...E('#26c6da') },
        // Fork → passthrough query builders
        { id: 'e-fork-psec',       source: 'n-fork',        target: 'n-pass-sec',    sourceHandle: 'b-sec',  ...E('#22d79a') },
        { id: 'e-fork-pcost',      source: 'n-fork',        target: 'n-pass-cost',   sourceHandle: 'b-cost', ...E('#22d79a') },
        { id: 'e-fork-prev',       source: 'n-fork',        target: 'n-pass-rev',    sourceHandle: 'b-rev',  ...E('#22d79a') },
        { id: 'e-fork-prel',       source: 'n-fork',        target: 'n-pass-rel',    sourceHandle: 'b-rel',  ...E('#22d79a') },
        { id: 'e-fork-pcomp',      source: 'n-fork',        target: 'n-pass-comp',   sourceHandle: 'b-comp', ...E('#22d79a') },
        // Branch A: security
        { id: 'e-psec-srch',       source: 'n-pass-sec',    target: 'n-srch-sec',    ...E('#22d79a') },
        { id: 'e-sec-llm',         source: 'n-srch-sec',    target: 'n-llm-sec',     ...E('#7c6ff0') },
        { id: 'e-sec-join',        source: 'n-llm-sec',     target: 'n-join',        targetHandle: 'join-in-1', ...E('#26c6da') },
        // Branch B: pricing
        { id: 'e-pcost-srch',      source: 'n-pass-cost',   target: 'n-srch-cost',   ...E('#22d79a') },
        { id: 'e-cost-llm',        source: 'n-srch-cost',   target: 'n-llm-cost',    ...E('#7c6ff0') },
        { id: 'e-cost-join',       source: 'n-llm-cost',    target: 'n-join',        targetHandle: 'join-in-2', ...E('#26c6da') },
        // Branch C: reviews → sentiment → LLM
        { id: 'e-prev-srch',       source: 'n-pass-rev',    target: 'n-srch-rev',    ...E('#22d79a') },
        { id: 'e-rev-sent',        source: 'n-srch-rev',    target: 'n-sent-rev',    ...E('#22d79a') },
        { id: 'e-sent-llm',        source: 'n-sent-rev',    target: 'n-llm-rev',     ...E('#7c6ff0') },
        { id: 'e-rev-join',        source: 'n-llm-rev',     target: 'n-join',        targetHandle: 'join-in-3', ...E('#26c6da') },
        // Branch D: reliability
        { id: 'e-prel-srch',       source: 'n-pass-rel',    target: 'n-srch-rel',    ...E('#22d79a') },
        { id: 'e-rel-llm',         source: 'n-srch-rel',    target: 'n-llm-rel',     ...E('#7c6ff0') },
        { id: 'e-rel-join',        source: 'n-llm-rel',     target: 'n-join',        targetHandle: 'join-in-4', ...E('#26c6da') },
        // Branch E: compliance (web_search, not scraper)
        { id: 'e-pcomp-srch',      source: 'n-pass-comp',   target: 'n-srch-comp',   ...E('#22d79a') },
        { id: 'e-comp-llm',        source: 'n-srch-comp',   target: 'n-llm-comp',    ...E('#7c6ff0') },
        { id: 'e-comp-join',       source: 'n-llm-comp',    target: 'n-join',        targetHandle: 'join-in-5', ...E('#26c6da') },
        // Join → vendor context → score
        { id: 'e-join-ctx',        source: 'n-join',        target: 'n-vendor-ctx',  ...E('#64b5f6') },
        { id: 'e-ctx-score',       source: 'n-vendor-ctx',  target: 'n-score',       ...E('#7c6ff0') },
        { id: 'e-score-cond',      source: 'n-score',       target: 'n-cond',        ...E('#f5a020') },
        // Condition: true → format risk → critical HITL, false → loop
        { id: 'e-cond-fmt',        source: 'n-cond',        target: 'n-format-risk', sourceHandle: 'true',  ...E('#e85555') },
        { id: 'e-fmt-risk',        source: 'n-format-risk', target: 'n-hitl-risk',   ...E('#e85555') },
        { id: 'e-cond-loop',       source: 'n-cond',        target: 'n-loop',        sourceHandle: 'false', ...E('#ff7043') },
        // Loop body: query gen → search → extract → loop back
        { id: 'e-loop-qgen',       source: 'n-loop',        target: 'n-query-gen',   ...E('#f5a020') },
        { id: 'e-qgen-search',     source: 'n-query-gen',   target: 'n-gap-search',  ...E('#22d79a') },
        { id: 'e-search-gapllm',   source: 'n-gap-search',  target: 'n-gap-llm',     ...E('#7c6ff0') },
        { id: 'e-gapllm-loop',     source: 'n-gap-llm',     target: 'n-loop',        targetHandle: 'loop-back', ...E('#ff7043') },
        // Both paths converge to draft
        { id: 'e-risk-draft',      source: 'n-hitl-risk',   target: 'n-draft',       ...E('#7c6ff0') },
        { id: 'e-loop-draft',      source: 'n-gap-llm',     target: 'n-draft',       ...E('#7c6ff0') },
        // Final flow
        { id: 'e-draft-hitl',      source: 'n-draft',       target: 'n-hitl-final',  ...E('#b080f8') },
        { id: 'e-hitl-final',      source: 'n-hitl-final',  target: 'n-final',       ...E('#7c6ff0') },
        { id: 'e-final-out',       source: 'n-final',       target: 'n-out',         ...E('#7c6ff0') },
      ],
    },
    version: 1, is_public: false, run_count: 0, created_at: now, updated_at: now,
  }

  // ── Insert all agents ───────────────────────────────────────────────────────
  const agents = [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10]
  for (const agent of agents) {
    const { error } = await db.from('agents').insert(agent)
    if (error) return NextResponse.json({ error: error.message, agent: agent.name }, { status: 500 })
  }

  // Best-effort: add cost_usd column if missing
  try { await db.rpc('exec_migration', { sql: 'ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS cost_usd float8' }) } catch { /* ok */ }

  return NextResponse.json({
    seeded: { models: MODELS.length, tools: TOOLS.length, prompts: PROMPTS.length, agents: agents.length },
    sql_migration_needed: 'If Analytics shows 0, run in Supabase SQL Editor: ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS cost_usd float8;',
    agents: agents.map(a => ({ name: a.name, description: a.description })),
  }, { status: 201 })
}
