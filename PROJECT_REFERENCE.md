# AgentHub — Project Reference

> Local reference doc. Do not commit. Last updated: 2026-03-21.

---

## What Is AgentHub

A full-stack SaaS platform where users visually build AI agents on a canvas and every agent is automatically exposed as a callable REST API. Think LangGraph + n8n but opinionated toward LLM pipelines and API-first exposure.

**Core value prop:** Build an agent in the UI → call it via `POST /api/agents/:id/run` from anywhere.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 App Router (TypeScript) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Canvas | @xyflow/react (React Flow) |
| LLM — default | Gemini 2.5 Flash (`gemini-2.5-flash`) |
| LLM — others | OpenAI, Groq (openai-compatible), Ollama |
| Hosting | Vercel |
| Styling | Custom CSS vars dark theme (no Tailwind) |

---

## Directory Structure

```
app/
  (auth)/login/          — Google OAuth login page
  (dashboard)/
    dashboard/           — Overview stats
    agents/              — Agent list + new agent
    builder/[agentId]/   — Visual canvas builder
    chat/                — Chat interface for running agents
    models/              — LLM config management
    analytics/           — Run history & traces
    api-keys/            — API key management
    docs/                — Built-in API documentation
  api/
    agents/              — CRUD for agents
    agents/[agentId]/run — Execute an agent (core endpoint)
    runs/                — List/filter agent runs
    runs/[runId]/resume  — Resume a paused HITL run
    models/              — CRUD for model configs
    prompts/             — CRUD for prompts
    guardrails/          — CRUD for guardrails
    memory/              — CRUD for memory configs
    keys/                — API key management
    seed/                — Seed sample data for new accounts

lib/
  executor/
    dag-executor.ts      — Core DAG execution engine
    types.ts             — ExecutionContext, GuardrailData, etc.
  llm.ts                 — Multi-provider LLM abstraction
  gemini.ts              — Gemini-specific client
  auth.ts                — getUserId() helper (session + API key)
  supabase/
    server.ts            — Server-side Supabase client
    client.ts            — Client-side Supabase client
    schema.sql           — Full DB schema (run in Supabase SQL Editor)

components/
  canvas/
    AgentCanvas.tsx      — React Flow canvas wrapper
    NodeConfigPanel.tsx  — Right-side config panel for selected node
    TracePanel.tsx       — Execution trace viewer
  ui/                    — Shared UI primitives
```

---

## Database Schema

### Tables

| Table | Purpose |
|---|---|
| `agents` | Agent definitions (schema stored as JSONB) |
| `models` | LLM configurations (provider, model_id, api_key, base_url) |
| `prompts` | Reusable system prompts with variable support |
| `guardrails` | Input/output keyword rule sets per LLM node |
| `memory_configs` | Memory source configs (type, TTL, window size, scope) |
| `tools` | HTTP tool definitions (endpoint, method, headers, schema) |
| `api_keys` | Hashed API keys with prefix display |
| `agent_runs` | Full run history with trace, tokens, latency, status |

### RLS
All tables have Row Level Security. Every query is scoped to `auth.uid() = user_id`. No user can read another user's data.

### Key columns — agent_runs
```sql
id, agent_id, agent_name, user_id, api_key_id, api_key_prefix,
input (jsonb), output (jsonb), status, tokens, latency_ms, error, trace (jsonb)
```

Status values: `running` | `completed` | `failed` | `waiting_hitl`

---

## Agent Schema (JSONB)

Each agent's `schema` column holds a React Flow graph:

```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "agentNode",
      "data": {
        "label": "My LLM",
        "nodeType": "llm",
        "modelId": "<uuid>",
        "promptId": "<uuid>",
        "guardrailId": "<uuid>",
        "memorySources": [
          { "id": "ms-1", "type": "agent_runs", "memoryConfigId": "<uuid>" },
          { "id": "ms-2", "type": "node_output", "nodeId": "node-0" }
        ]
      }
    }
  ],
  "edges": [{ "id": "e1", "source": "node-1", "target": "node-2" }]
}
```

### Node types
| nodeType | Description |
|---|---|
| `input` | Entry point — receives the user message |
| `llm` | LLM call with model, prompt, guardrail, memory |
| `tool` | HTTP tool call |
| `hitl` | Human-in-the-loop checkpoint (pauses run) |
| `output` | Terminal node — returns result |

---

## Execution Engine

File: `lib/executor/dag-executor.ts`

### Flow
1. Parse nodes/edges from agent schema
2. Topological sort (Kahn's algorithm)
3. Execute nodes in order, passing output between them via `ctx.nodeOutputs`
4. For each LLM node:
   a. Build memory context string (from memorySources)
   b. Check input against guardrail input_rules → block if match
   c. Call LLM (Gemini / OpenAI-compatible)
   d. Check output against guardrail output_rules → warn if match
5. For HITL node: persist partial result, return `waiting_hitl` status
6. Emit trace events throughout

### ExecutionContext
```ts
interface ExecutionContext {
  runId: string
  agentId: string
  userId: string
  nodeOutputs: Record<string, unknown>
  guardrailMap?: Record<string, GuardrailData>
  agentRunsHistory?: Record<string, string>   // memoryConfigId → formatted history string
  trace: TraceEvent[]
  tokens: number
  startTime: number
}
```

---

## LLM Support

File: `lib/llm.ts`

| Provider | How |
|---|---|
| `google` | Gemini SDK directly |
| `openai` | OpenAI SDK with default base URL |
| `openai-compatible` | OpenAI SDK with custom `base_url` (Groq, local, etc.) |
| `ollama` | OpenAI SDK pointed at `http://localhost:11434/v1` |
| `groq` | openai-compatible with `https://api.groq.com/openai/v1` |

Model configs are stored per-user in the `models` table including encrypted api_key and base_url.

---

## Auth

Two auth modes for API calls:

1. **Session auth** — browser sessions via Supabase Auth (Google OAuth)
2. **API key auth** — `X-AgentHub-Key: ahk_...` header, SHA-256 hash matched against `api_keys.key_hash`

`lib/auth.ts → getUserId()` tries session first, falls back to API key lookup.

---

## Guardrails

Stored in `guardrails` table as:
```json
{
  "input_rules": [{ "text": "ignore all previous" }, { "text": "jailbreak" }],
  "output_rules": [{ "text": "confidential" }, { "text": "API key" }]
}
```

- **input_rules** match: run is blocked, `guardrail_block` trace event emitted
- **output_rules** match: run continues but `guardrail_warn` trace event emitted (orange in trace panel)
- Assigned per LLM node via `guardrailId` in node data

---

## Memory Sources

Each LLM node can have multiple `memorySources`:

| type | Source | How |
|---|---|---|
| `agent_runs` | Cross-session DB history | Loads last N completed runs for this memoryConfigId, formats as Q&A |
| `node_output` | Upstream node in current pipeline | Reads `ctx.nodeOutputs[nodeId]` |

Memory is prepended to the user message before the LLM call.

> ⚠️ TTL/window/scope in `memory_configs` are stored but not yet enforced in executor. Future work.

---

## Chat Page

Route: `/chat`

- Left panel: agent list with search
- Right panel: conversation bubbles (user = right/blue, assistant = left/dark)
- Conversation history sent as `conversationHistory` array on every request
- HITL checkpoint: shows inline approval card (full-width, outside bubble)
  - Textarea for optional feedback
  - "Approve & Continue" → `POST /api/runs/:runId/resume`
  - "Send Feedback" → same resume endpoint with feedback text

> ⚠️ Chat history is in-memory React state only — not persisted to DB. Refresh loses history.

---

## API Reference

### Run an agent
```
POST /api/agents/:agentId/run
X-AgentHub-Key: ahk_...
Content-Type: application/json

{
  "message": "Your input here",
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Response (completed):
```json
{ "status": "completed", "output": "...", "tokens": 312, "latencyMs": 1840, "runId": "..." }
```

Response (HITL paused):
```json
{ "status": "waiting_hitl", "runId": "...", "output": { "partial": "..." } }
```

### Resume HITL
```
POST /api/runs/:runId/resume
Content-Type: application/json

{ "feedback": "Looks good, continue" }
```

---

## Known Gaps (as of 2026-03-21)

| Gap | Priority | Effort |
|---|---|---|
| Streaming LLM output | High | Medium |
| Persistent chat sessions | High | Medium |
| Enforce memory TTL/window | Medium | Low |
| Real analytics charts | Medium | Low |
| Test coverage | Medium | High |
| Guardrail regex/semantic matching | Low | Medium |
| Rate limiting on run API | Medium | Low |
| Agent templates gallery | Low | Low |
| Undo/redo in canvas | Low | High |
| Webhook callbacks on run complete | Low | Medium |

---

## Technical Scorecard (2026-03-21)

| Category | Score |
|---|---|
| Core Architecture | 8.0 |
| Auth & Security | 7.0 |
| Builder UX | 7.0 |
| API / Extensibility | 7.0 |
| Guardrails | 6.5 |
| Chat | 6.0 |
| Code Quality | 6.0 |
| Memory | 5.5 |
| Analytics | 5.0 |
| Production Readiness | 5.0 |
| **Overall** | **6.4 / 10** |

---

## Supabase Config

- Project URL: `https://aivlkaxxdzxnhisiodkl.supabase.co`
- Auth: Google OAuth
- To seed sample data: sign in, then `POST /api/seed`
- Schema: run `lib/supabase/schema.sql` in SQL Editor for fresh DB
- To add user_id to existing agent_runs: `ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;`

---

## Vercel Deployment

- Project name: `agenthub`
- Environment vars needed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
- Supabase redirect URLs must include Vercel domain in: Auth → URL Configuration → Redirect URLs
