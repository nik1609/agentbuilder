# AgentHub — Technical Documentation
*Last updated: 2026-05-10*

> **Live:** https://agenthub.nik10x.com  
> **Stack:** Next.js · Supabase · React Flow · TypeScript · Vercel

---

## Vision

AgentHub is a visual, engineer-facing platform where you build AI agents on a canvas and instantly expose them as a single callable API. Anyone can sign up, compose an agent from nodes, deploy it, and call it from Postman or any HTTP client.

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
   - Build memory context string (from memorySources)
   - Check input against guardrail input_rules → block if match
   - Call LLM (Gemini / OpenAI-compatible)
   - Check output against guardrail output_rules → warn if match
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

## Node Types Reference

### Input
The entry point of every agent. Receives the user's message. Use `{{input}}` in any downstream node to reference it. Every agent must have exactly one Input node.

### Output
The exit point. Whatever reaches this node is returned as the final API response. Every agent must have exactly one Output node.

### LLM
Calls an AI model with a system prompt.
- Set a **system prompt** defining the model's role
- Receives `{{last_output}}` from the previous node as its user message
- Use `{{input}}` anywhere in the prompt to reference the original user message
- Config: model, temperature, max tokens, system prompt

### Tool
Runs an external action — web search, HTTP call, code execution, datatable write, etc.
- Select a tool configured in the Tools page
- Input flows automatically from `__last_output`

### Condition
Binary branch — routes execution to either a **true** or **false** path.
- Write a condition in plain English: `"the output contains BILLING"`
- An LLM evaluates it and selects the branch

### HITL (Human-in-the-Loop)
Pauses the run and waits for a human to approve before continuing.
- Agent stops and surfaces current output to a reviewer
- Reviewer can add notes or just approve
- Agent resumes with reviewer feedback injected as context

---

## Quick Decision Guide

| Goal | Node |
|---|---|
| Call an AI model | LLM |
| Search web / call API / write data | Tool |
| Route yes/no | Condition |
| Wait for human approval | HITL |

---

## Supabase Config

- Project URL: `https://aivlkaxxdzxnhisiodkl.supabase.co`
- Auth: Google OAuth
- To seed sample data: sign in, then `POST /api/seed`
- Schema: run `lib/supabase/schema.sql` in SQL Editor for fresh DB

## Vercel Deployment

- Project name: `agenthub`
- Environment vars needed: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`
- Supabase redirect URLs must include Vercel domain in: Auth → URL Configuration → Redirect URLs
