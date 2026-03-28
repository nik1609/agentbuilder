# AgentHub — Full Build Specification
*Last updated: 2026-03-27*

> **Live:** https://agenthub.nik10x.com
> **Stack:** Next.js 16.2 · Supabase · React Flow · TypeScript · Vercel

---

## Vision

AgentHub is a visual, engineer-facing platform where you build AI agents on a canvas and instantly expose them as a single callable API. Anyone can sign up, compose an agent from nodes, deploy it, and call it from Postman or any HTTP client. The API initiates a persistent session — the agent runs, handles tool calls, pauses for human input when needed, and communicates back in real time via streaming events.

---

## Current State — Confirmed Bugs (Code Audit)

### Executor
- `__last_output` is the only data channel — no named state. Node 5 cannot reference Node 2's output directly.
- Topological sort rejects cycles — loops are architecturally impossible today.
- No parallel execution (`Promise.all` only used for output compression, not nodes).
- No retry, no error branch routing, no fallback.
- Condition node edge labels (`true`/`false`) have no UI — user must know to label edges correctly but there's no affordance.

### Canvas
- **Closure staleness bug** in `handleNodesChange` and `handleEdgesChange` — `edges`/`nodes` are captured at callback creation time, causing stale references on rapid changes. This is the drag sluggishness.
- Handles are left/right only — vertical flow (top/bottom connections) not possible.
- No undo/redo anywhere in the app.
- No `isValidConnection` validation — self-loops possible, invalid topologies possible.
- No way to label edges (required for Condition routing but no UI for it).
- Loop back-edges not supported visually or executionally.

### Tools
- Seeded `web_search` points to `https://api.search.example.com/search` — fake URL, always fails.
- Seeded `send_notification` points to `https://hooks.example.com/notify` — fake URL.
- Piston code execution provider broken since Feb 2026 (requires whitelist).
- `function` type tools use `new Function()` — arbitrary server-side JS with no sandbox (security issue).
- Variable substitution uses regex `.replace()` — if `__last_output` contains `$1`/`$2` it silently corrupts output.

### HITL
- HITL is a pause button, not a real checkpoint. No distinction between approved/rejected reaching the next node.
- HITL node is *skipped* on resume (executor fast-forwards past it). The next node sees "Reviewer approved with notes: ..." prepended as raw text.
- No multi-turn conversation — one note, then continues.
- No external workflow — only works from builder UI.
- No timeout or auto-resolve.

### API
- No LLM token streaming — full response waits, then sends at once.
- No session concept — each call is stateless, no reconnection to in-progress runs.
- No rate limiting on API keys.

---

## Build Plan — 7 Categories

---

## Category 1: Canvas UX Fixes

### 1.1 Fix Closure Staleness Bug (drag sluggishness)

**File:** `components/canvas/AgentCanvas.tsx`

`handleNodesChange` captures `edges` at creation time. Use refs alongside state:

```typescript
const nodesRef = useRef(nodes)
const edgesRef = useRef(edges)
useEffect(() => { nodesRef.current = nodes }, [nodes])
useEffect(() => { edgesRef.current = edges }, [edges])

const handleNodesChange = useCallback((changes) => {
  onNodesChange(changes)
  scheduleSync(nodesRef.current, edgesRef.current)
}, [onNodesChange, scheduleSync])
```

Same pattern for `handleEdgesChange` and `addNode`.

### 1.2 Add Top/Bottom Handles to All Nodes

Every node needs 4 handles:
- `input-left` — Position.Left (existing)
- `input-top` — Position.Top (new)
- `output-right` — Position.Right (existing)
- `output-bottom` — Position.Bottom (new)

Handles should be visually small, appear on hover only, so they don't clutter the node at rest.

### 1.3 Edge Label UI

Condition nodes route based on edge labels (`true`/`false`) but there's zero UI to set them.

**Fix:**
- Clicking an edge opens an inline label input
- Auto-label edges from Condition nodes: 1st connection → "true", 2nd → "false"
- Show label as a small pill on the edge in the canvas
- Edges from Switch nodes: auto-labeled `branch_1`, `branch_2`, etc.

### 1.4 Prevent Invalid Connections

Add `isValidConnection` callback to `ReactFlow`:
- Prevent self-loops (`source === target`)
- Prevent duplicate edges between the same pair of nodes
- Prevent connecting to Input node's input handle (it's output-only)
- Prevent connecting from Output node's output handle (it's input-only)

### 1.5 Back-Edge Support (required for Loop nodes)

Loop nodes need edges going backwards (downstream node → upstream node).

**Fix:**
- Detect back-edges (target appears before source in topological order)
- Render back-edges as **orange dashed curved arcs** (visually distinct from forward edges)
- Show iteration counter badge on the arc during execution
- Executor must accept cycles when a Loop node is involved (not throw on cycle detection)

### 1.6 Undo/Redo

```typescript
const [history, setHistory] = useState<{nodes: Node[], edges: Edge[]}[]>([])
const [historyIndex, setHistoryIndex] = useState(0)
// Push snapshot on every meaningful change (debounced)
// Cmd+Z: restore history[index-1]
// Cmd+Shift+Z: restore history[index+1]
```

### 1.7 Copy/Paste Nodes

- `Cmd+C` on selected node(s) → copy to a ref
- `Cmd+V` → paste with +20px offset, generate new IDs, preserve all config

### 1.8 Multi-Select + Group Move

Shift+click to select multiple nodes. Drag any selected node to move the entire group. Delete key removes all selected.

### 1.9 Snap to Grid

Toggle in toolbar. When on, nodes snap to 20px grid. Helps with alignment.

---

## Category 2: New Node Types

### 2.1 Loop Node

**Purpose:** Re-run a section of the graph N times or until a condition is met.

**Config:**
```typescript
{
  label: string
  max_iterations: number           // hard stop, default 10
  exit_condition: string           // "when output contains 'DONE'"
  exit_condition_type: 'llm' | 'expression'
  on_max_reached: 'continue' | 'error'
}
```

**Visual:** Placed at the re-entry point. The loop-back edge is an orange dashed arc from a downstream node back to this node.

**Execution:**
1. Check if loop counter for this node ID >= max_iterations → if yes, continue forward
2. Evaluate exit_condition against current state → if met, continue forward
3. Otherwise: increment counter, follow back-edge to self

### 2.2 Fork Node

**Purpose:** Fan out to N parallel branches.

**Config:**
```typescript
{
  label: string
  branches: { id: string, label: string }[]
  input_mode: 'broadcast' | 'split'
  // broadcast: all branches get same input
  // split: input is array, each branch gets one element
}
```

**Visual:** Diamond shape. N labeled output handles on the right.

**Execution:** `Promise.all` across all branches. Each branch writes to `state.variables[branchId]`.

### 2.3 Join Node

**Purpose:** Wait for parallel branches and merge results.

**Config:**
```typescript
{
  label: string
  mode: 'wait_all' | 'wait_first' | 'wait_any_n'
  n?: number
  merge_as: string             // state key, e.g. "branch_results"
  merge_format: 'array' | 'object' | 'concatenated'
}
```

**Visual:** Reverse diamond. N labeled input handles on the left, one output on the right.

### 2.4 Switch Node (multi-way routing)

**Purpose:** Route to one of N branches based on a value or LLM classification.

**Config:**
```typescript
{
  label: string
  type: 'value_match' | 'llm_classify' | 'expression'
  input_key: string
  cases: { label: string, match: string }[]
  default_case: string
}
```

**Visual:** Node with N labeled output handles. Keep existing Condition node for simple true/false.

### 2.5 LLM Node — Agentic Mode Toggle

Add toggle: **"Agentic Mode"** to the existing LLM node config panel.

When enabled:
- "Bound Tools" section appears — pick tools from tool library
- LLM receives tool definitions, internally loops: call tool → observe result → decide next
- Node outputs only when LLM stops calling tools
- Max tool call iterations: configurable (default 10)
- Visually: tool name chips shown below node label, border color changes

**Implementation:** Use each provider's native function calling:
- Gemini: `functionDeclarations`
- Anthropic: `tools` parameter
- OpenAI: `tools` with `tool_choice: 'auto'`

---

## Category 3: Executor Engine Rebuild

### 3.1 Named State Dict

Replace `ctx.variables.__last_output` with a proper named state:

```typescript
interface ExecutionState {
  input: string
  variables: Record<string, unknown>      // nodeId → output + named keys
  messages: { role: string, content: string }[]
  trace: TraceEvent[]
  loopCounters: Record<string, number>    // nodeId → iteration count
  branchStatus: Record<string, 'pending'|'running'|'done'|'failed'>
}
```

Each node writes to `state.variables[node.id]`. Templates use `{{node.nodeId}}` (already supported) or `{{state.myKey}}`.

Keep `{{last_output}}` as alias for `state.variables[previousNodeId]` — backwards compatible.

### 3.2 Cycle-Aware Graph Traversal

Current topological sort throws on cycles. New approach:
1. Mark back-edges (those that create cycles — must target a Loop node)
2. Build execution order excluding back-edges (standard topo sort)
3. When executor reaches a Loop node: evaluate exit condition, if not done — increment counter and re-enter the loop segment

### 3.3 Parallel Execution (Fork/Join)

When executor encounters a Fork node:
1. Create N sub-contexts (copies of current state)
2. Execute each branch with `Promise.all` (or `Promise.allSettled` for wait_any)
3. Each branch writes to its own key in a shared results map
4. Join node merges per configured mode

### 3.4 Retry with Backoff

Per-node config in advanced settings:
```typescript
retry: {
  enabled: boolean
  max_attempts: number        // default 3
  backoff_ms: number          // initial delay, doubles each attempt
  retry_on: 'error' | 'empty_output' | 'guardrail_block'
}
```

### 3.5 Error Branch

Every node gets an optional error output handle. If a node fails and an error edge is connected:
- Route to the error branch instead of halting
- Inject `state.variables.__error = { message, nodeId, attempt }` for the error handler node
- If no error edge: existing behavior (halt run) applies

### 3.6 Agentic Tool-Calling Loop in LLM Node

When `agenticMode: true`:
```
while iterations < max_tool_iterations:
  response = llm.invoke(messages, tool_definitions)
  if response.has_tool_calls:
    for each tool_call in response.tool_calls:
      result = execute_tool(tool_call.name, tool_call.args)
      messages.push({ role: 'tool', content: result })
    iterations++
  else:
    break
return response.final_content
```

Uses existing tool execution logic. No new tool infrastructure needed.

### 3.7 Variable Substitution Security Fix

Current `String.replace` with regex breaks when output contains `$1`, `$2`.

**Fix:** Use split/join instead:
```typescript
function resolveVars(template: string, ctx: ExecutionState): string {
  let result = template
  result = result.split('{{input}}').join(String(ctx.input ?? ''))
  result = result.split('{{last_output}}').join(String(getLastOutput(ctx) ?? ''))
  // For {{node.id}} — safe manual parse
  return result.replace(/\{\{node\.([\w-]+)\}\}/g, (match, id) => {
    const val = ctx.variables[id]
    return val !== undefined ? String(val) : match
  })
}
```

---

## Category 4: Tools — Fix All Broken Ones

### 4.1 Fix Seeded Placeholder Tools

**`web_search`** (seeded) → Change type from `http` to `web_search` (built-in). The executor already supports DuckDuckGo/Tavily/Serper. Remove the fake HTTP config.

**`send_notification`** (seeded) → Replace with a real working webhook example. Use Webhook.site or Resend API. Add documentation: "Replace with your own webhook URL."

### 4.2 Fix Piston Code Execution

Piston public API requires whitelist since Feb 2026. Fix:
- Remove Piston from the provider list in the executor
- Or replace with Judge0 (free tier, no whitelist)
- Show clear error if Piston is configured: "Piston requires a self-hosted instance. Use Wandbox or E2B instead."

### 4.3 Sandbox Function Tools

`new Function()` runs arbitrary JS on the server. This is a critical security issue for multi-tenant SaaS.

**Fix:** Route all `function` type tools through the `code_exec` path (Wandbox/E2B). Same user experience, proper sandboxing. Remove the raw `new Function()` execution path entirely.

### 4.4 Add Tool Test Button

Every tool in the Tools page needs a "Test" button:
1. Shows an input text field
2. Calls `POST /api/tools/:toolId/test` with the input
3. Shows raw result inline
4. Shows errors clearly (status code, message)

### 4.5 Fix Datatable Export Validation

Before writing, fetch datatable column definitions and validate exported row keys match defined columns. Return clear error on mismatch instead of silently corrupting data.

### 4.6 Working Seed Tools

Replace placeholder seeds with these working tools:

| Tool | Type | Notes |
|---|---|---|
| DuckDuckGo Search | web_search | Free, no API key |
| Jina Web Scraper | web_scrape | Scrapes URL to markdown |
| Run JavaScript | code_exec (Wandbox) | Executes JS snippet |
| Post to Webhook | http | POST JSON to any webhook |
| Get Current Time | function (via code_exec) | Returns ISO timestamp |
| Format as Markdown Table | function (via code_exec) | JSON → markdown |

---

## Category 5: HITL — Full Redesign

### 5.1 New Data Model

```sql
CREATE TABLE hitl_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','approved','rejected','timed_out')),
  context JSONB,           -- snapshot of agent state at pause
  resolution JSONB,        -- { action, reason, by }
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE hitl_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES hitl_sessions(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('agent','human')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.2 HITL Node Config Expansion

```typescript
interface HITLNodeConfig {
  label: string
  question: string                  // What to ask the human
  context_keys: string[]            // State keys to show (e.g. ['summary', 'search_result'])
  type: 'approval' | 'chat' | 'form'

  // For 'chat': agent can respond mid-conversation
  agent_model?: string
  agent_system_prompt?: string

  // For 'form': structured fields
  fields?: { name: string, label: string, type: 'text'|'select'|'boolean', options?: string[] }[]

  // Timeout
  timeout_minutes?: number
  timeout_action?: 'approve' | 'reject'

  // External notification
  notification_webhook?: string     // POST here when HITL is waiting
}
```

### 5.3 New HITL API Endpoints

```
GET  /api/runs/:runId/hitl              — get current HITL session + message history
POST /api/runs/:runId/hitl/message      — send a human message
POST /api/runs/:runId/hitl/approve      — body: { note?: string }
POST /api/runs/:runId/hitl/reject       — body: { reason: string }
```

Keep existing `/api/runs/:runId/resume` as alias for approve (backwards compat).

### 5.4 HITL Chat UI

Replace the current approve/note panel in the builder with a full chat panel when `runStatus === 'waiting_hitl'`:

```
┌──────────────────────────────────────────────────┐
│ ⏸ HITL Checkpoint — "Quality Review"             │
│──────────────────────────────────────────────────│
│ Context:                                          │
│ ┌────────────────────────────────────────────┐   │
│ │ Summary: The conflict in... [collapsible]  │   │
│ └────────────────────────────────────────────┘   │
│                                                   │
│ 🤖 Agent: "Does this summary look accurate        │
│            before I publish it?"                  │
│                                                   │
│ 👤 You: "The date in paragraph 2 is wrong"        │
│                                                   │
│ 🤖 Agent: "Got it — I'll flag that. Anything      │
│            else before continuing?"               │
│                                                   │
│ ┌────────────────────────────┐ [Send]             │
│ │ Type a message...          │                    │
│ └────────────────────────────┘                    │
│                                                   │
│ [✕ Reject]                  [✓ Approve & Run ▶]  │
└──────────────────────────────────────────────────┘
```

**Behaviors:**
- Messages loaded from `hitl_messages` on mount
- Sending hits `POST /api/runs/:runId/hitl/message`
- If `type === 'chat'`: server calls LLM with agent's system prompt, saves response as `role: 'agent'`
- If `type === 'approval'`: messages logged, no agent response
- On approve/reject: full conversation history passed to executor as context
- Executor receives: `{ approved: true, conversation: [{role, content}[]], finalNote: string }`

### 5.5 External HITL (for API Callers)

When API caller hits a HITL-paused run, response includes:

```json
{
  "status": "waiting_hitl",
  "runId": "run_abc",
  "hitl": {
    "sessionId": "htl_xyz",
    "question": "Does this look correct?",
    "context": { "summary": "..." },
    "endpoints": {
      "messages": "POST /api/runs/run_abc/hitl/message",
      "approve":  "POST /api/runs/run_abc/hitl/approve",
      "reject":   "POST /api/runs/run_abc/hitl/reject",
      "poll":     "GET  /api/runs/run_abc/hitl"
    }
  }
}
```

Full interaction possible from Postman without touching the UI.

---

## Category 6: API & Session Design

### 6.1 Session-Based Execution

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,               -- "sess_" prefixed
  run_id UUID REFERENCES agent_runs(id),
  agent_id UUID REFERENCES agents(id),
  user_id UUID,
  status TEXT DEFAULT 'running',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ             -- 24h TTL
);
```

**Start a session:**
```
POST /api/agents/:agentId/sessions
Headers: X-AgentHub-Key: hub_live_xyz
Body: { "input": "Research quantum computing in 2025" }

Response:
{
  "sessionId": "sess_abc123",
  "runId": "run_xyz789",
  "streamUrl": "/api/sessions/sess_abc123/stream",
  "status": "running"
}
```

### 6.2 SSE Stream Endpoint

```
GET /api/sessions/:sessionId/stream
```

Event types:
```typescript
type StreamEvent =
  | { type: 'node_start',   nodeId: string, nodeType: string, label: string }
  | { type: 'node_done',    nodeId: string, output: string, tokens: number }
  | { type: 'llm_token',    nodeId: string, token: string }       // NEW
  | { type: 'tool_call',    nodeId: string, tool: string, input: string }
  | { type: 'tool_result',  nodeId: string, result: string }
  | { type: 'hitl_pause',   sessionId: string, question: string, context: object }
  | { type: 'hitl_message', role: string, content: string }
  | { type: 'completed',    output: string, tokens: number, latencyMs: number }
  | { type: 'error',        message: string, nodeId?: string }
```

### 6.3 LLM Token Streaming

Add streaming to each provider in `lib/llm.ts`:

**Gemini:**
```typescript
const stream = await model.generateContentStream(prompt)
for await (const chunk of stream.stream) {
  emit({ type: 'llm_token', nodeId, token: chunk.text() })
}
```

**Anthropic:**
```typescript
const stream = client.messages.stream({ ... })
stream.on('text', (text) => emit({ type: 'llm_token', nodeId, token: text }))
```

**OpenAI:**
```typescript
const stream = await client.chat.completions.create({ stream: true, ... })
for await (const chunk of stream) {
  emit({ type: 'llm_token', nodeId, token: chunk.choices[0].delta.content ?? '' })
}
```

### 6.4 Postman Workflow (End-to-End)

**Step 1 — Start session:**
```
POST /api/agents/:agentId/sessions
X-AgentHub-Key: hub_live_xyz
{ "input": "Write a report on AI in healthcare" }
→ { sessionId: "sess_abc", streamUrl: "..." }
```

**Step 2 — Open stream (separate tab):**
```
GET /api/sessions/sess_abc/stream
→ streams node_start, llm_token, tool_call... events
```

**Step 3 — HITL arrives on stream:**
```json
{ "type": "hitl_pause", "question": "Does this look right?", "context": {...} }
```

**Step 4 — Respond:**
```
POST /api/runs/run_xyz/hitl/message
{ "content": "Add more detail on diagnostics" }
```

**Step 5 — Approve:**
```
POST /api/runs/run_xyz/hitl/approve
```

**Step 6 — Wait for `completed` event on stream.**

### 6.5 Auto-Generate Postman Collection

The existing "Postman" button in the builder header should generate a complete Postman collection JSON with:
- Start session request (pre-filled agent ID + API key)
- Stream URL request
- HITL message request
- HITL approve/reject requests
- All headers pre-configured

User imports it with one click.

---

## Category 7: Production Polish

### 7.1 Memory TTL Enforcement

TTL is stored in `memory_configs.ttl_hours` but never checked. Fix: add a `WHERE created_at > now() - (ttl_hours || ' hours')::interval` to the memory loading query in the executor. One-line fix.

### 7.2 Real Analytics Charts

Add `recharts` (lightweight, no extra UI library needed). Charts to build:
- **Runs over time** — line chart, last 30 days
- **Success vs failure rate** — pie chart
- **Average latency trend** — line chart
- **Token usage by model** — bar chart
- **Recent errors** — table with run link, error message, node that failed

All data is in `agent_runs`. Just query and visualize.

### 7.3 Rate Limiting

Add to `api_keys` table:
```sql
max_calls_per_day INTEGER DEFAULT 100,
calls_today INTEGER DEFAULT 0,
calls_today_reset_at TIMESTAMPTZ DEFAULT now()
```

Check on each `/sessions` and `/run` request. Return `429 Too Many Requests` if exceeded. Reset at midnight UTC.

### 7.4 Cost Tracking

Add to `agent_runs`:
```sql
cost_usd DECIMAL(10,6)
```

Static price table per model (update as needed):
```typescript
const MODEL_PRICES = {
  'gemini-2.5-flash':   { input: 0.000_000_075,  output: 0.000_000_300 },
  'claude-sonnet-4-5':  { input: 0.000_003,       output: 0.000_015 },
  'gpt-4o':             { input: 0.000_005,        output: 0.000_015 },
}
```

Calculate at end of run: `(inputTokens * inputPrice) + (outputTokens * outputPrice)`. Show in analytics.

### 7.5 Agent Versioning UI

- "Publish v{N}" button in builder — locks current schema as a deployed version
- Version selector on API Keys page — which version does this key call?
- Version history sidebar in builder — click to preview/restore old schemas

### 7.6 Tests

Add `vitest` and write at minimum:
- Executor: 2-node graph (LLM → Tool), assert output shape
- Executor: condition node routes correctly to true/false branches
- Executor: loop node exits at max_iterations
- API: `POST /sessions` with valid key → 200
- API: `POST /sessions` with invalid key → 401
- API: `POST /sessions` over rate limit → 429

---

## Master Checklist

### Canvas UX
- [ ] C1. Fix closure staleness in handleNodesChange / handleEdgesChange (drag performance)
- [ ] C2. Add top/bottom handles to all node types
- [ ] C3. Add click-to-edit edge label UI
- [ ] C4. Auto-label edges from Condition nodes (true/false)
- [ ] C5. Add isValidConnection — prevent self-loops, invalid topologies
- [ ] C6. Add back-edge visual rendering (orange dashed curved arcs)
- [ ] C7. Implement undo/redo (Cmd+Z / Cmd+Shift+Z)
- [ ] C8. Implement copy/paste nodes (Cmd+C / Cmd+V)
- [ ] C9. Add multi-select group move (Shift+click + drag)
- [ ] C10. Add snap-to-grid toggle

### New Nodes
- [ ] N1. Loop node — component + config panel
- [ ] N2. Fork node — component + N output handles
- [ ] N3. Join node — component + N input handles + merge modes
- [ ] N4. Switch node — multi-way routing component
- [ ] N5. LLM node — Agentic Mode toggle + bound tools picker

### Executor Engine
- [ ] E1. Fix variable substitution ($1/$2 corruption — use split/join)
- [ ] E2. Migrate to named state dict (replace __last_output)
- [ ] E3. Cycle-aware graph traversal (support back-edges for Loop nodes)
- [ ] E4. Loop node execution (counter + exit condition evaluation)
- [ ] E5. Fork/Join parallel execution (Promise.all)
- [ ] E6. Switch node multi-way routing
- [ ] E7. Per-node retry with exponential backoff
- [ ] E8. Error branch routing (optional error output handle per node)
- [ ] E9. LLM agentic mode tool-calling loop
- [ ] E10. Enforce memory TTL in loading query

### Tools
- [ ] T1. Fix seeded web_search — use built-in web_search type, remove fake URL
- [ ] T2. Fix seeded send_notification — replace with real webhook example
- [ ] T3. Remove/fix Piston provider (broken since Feb 2026)
- [ ] T4. Sandbox function tools — route through code_exec, remove new Function()
- [ ] T5. Add "Test Tool" button with inline result viewer
- [ ] T6. Fix datatable export schema validation
- [ ] T7. Replace placeholder seeds with 6 working tools
- [ ] T8. Fix variable substitution in tool URL/header/body templates

### HITL
- [ ] H1. Create hitl_sessions DB table
- [ ] H2. Create hitl_messages DB table
- [ ] H3. Expand HITL node config (type, timeout, notification webhook, form fields)
- [ ] H4. GET /api/runs/:runId/hitl endpoint
- [ ] H5. POST /api/runs/:runId/hitl/message endpoint
- [ ] H6. POST /api/runs/:runId/hitl/approve endpoint
- [ ] H7. POST /api/runs/:runId/hitl/reject endpoint
- [ ] H8. Update executor to pass full HITL conversation on resume
- [ ] H9. HITL timeout + auto-resolve
- [ ] H10. External notification webhook on HITL pause
- [ ] H11. Build new HITL chat UI panel (replaces approve/note UI)
- [ ] H12. "HITL waiting" badge on Agents list for paused runs

### API & Sessions
- [ ] A1. Create sessions DB table
- [ ] A2. POST /api/agents/:agentId/sessions endpoint
- [ ] A3. GET /api/sessions/:sessionId/stream SSE endpoint
- [ ] A4. LLM token streaming — Gemini, Anthropic, OpenAI
- [ ] A5. Emit llm_token events from executor
- [ ] A6. Update Postman export to generate full session collection
- [ ] A7. Rate limiting on API key usage (per-day limit + 429 response)

### Production
- [ ] P1. Cost tracking (cost_usd on agent_runs + price table)
- [ ] P2. Real analytics charts (runs, latency, errors, token/cost)
- [ ] P3. Agent version publish UI + version selector on API keys
- [ ] P4. Smoke tests for executor + run API (vitest)
- [ ] P5. Memory TTL enforcement in memory loading query

**Total: 57 items**

---

## Implementation Order

```
Phase 1 — Foundation (unblocks everything)
  E1  variable substitution fix
  E2  named state dict
  C1  canvas staleness fix

Phase 2 — Core Engine
  E3  cycle-aware traversal
  E4  loop execution
  E5  fork/join execution
  E6  switch routing
  E7  retry
  E8  error branch

Phase 3 — New Nodes (requires Phase 2)
  N1, N2, N3, N4
  C2, C3, C4, C5, C6
  E9  agentic tool calling
  N5  LLM agentic mode

Phase 4 — Tools (independent, run in parallel with Phase 2-3)
  T1–T8

Phase 5 — HITL Redesign (requires Phase 1 + 2)
  H1, H2  DB tables
  H3      node config
  H4–H8   endpoints + executor
  H9, H10 timeout + notifications
  H11, H12 UI

Phase 6 — Sessions & Streaming (requires Phase 5)
  A1–A7

Phase 7 — Canvas Polish (parallel with Phase 6)
  C7–C10

Phase 8 — Production
  P1–P5
  E10 memory TTL
```

---

## What the Final App Looks Like

An engineer signs up, opens the builder, and sees a canvas. They drag out nodes: an Input, two Tool nodes (search + scrape) running in parallel via a Fork/Join, an LLM in agentic mode with 3 tools bound to it that it calls dynamically, a Switch routing to three different output handlers based on content type, a HITL checkpoint before publishing with a chat interface, and an Output. They hit Save and Deploy.

They copy the endpoint. In Postman, they `POST /api/agents/:id/sessions` with their API key and a natural-language input. They open a second tab to the stream URL and watch the agent work — node by node, token by token. The agent hits HITL. Postman receives a `hitl_pause` event with the agent's question and current context. They `POST /hitl/message` with feedback. The agent responds. They `POST /hitl/approve`. The agent finishes. One API key, three HTTP calls, one streaming endpoint.

That is the product.

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

```
Example system prompt:
"You are a professional email writer.
Rewrite the following draft in a formal tone: {{last_output}}"
```

### Tool
Runs an external action — web search, HTTP call, code execution, datatable write, etc.
- Select a tool configured in the Tools page
- Input flows automatically from `__last_output`
- Config: tool name (references the tool library)

### Condition
Binary branch — routes execution to either a **true** or **false** path.
- Write a condition in plain English: `"the output contains BILLING"`
- An LLM evaluates it and selects the branch
- Connect two edges out; they must carry `sourceHandle: "true"` and `sourceHandle: "false"` (set automatically by the canvas)

```
Input → Classify → Condition: "output is BILLING"
                       ├── true  → Billing Support LLM
                       └── false → Tech Support LLM
```

### HITL (Human-in-the-Loop)
Pauses the run and waits for a human to approve before continuing.
- Agent stops and surfaces current output to a reviewer
- Reviewer can add notes or just approve
- Agent resumes with reviewer feedback injected as context
- Use before: sending emails, publishing content, executing payments

### Clarify
Pauses and asks the user a clarifying question mid-run.
- Agent auto-generates a question based on current context
- Waits for the user's answer
- Continues with the answer injected as new context
- Use when: input is ambiguous and more info is needed before proceeding

### Loop
Repeats a section of the graph until a condition is met or a max iteration count is hit.
- **Exit condition** — plain English: `"output contains APPROVED"`
- **Max iterations** — hard stop (default 10) to prevent infinite loops
- Connect the last node in the loop body back to the Loop node with a back-edge (orange dashed arc)

```
Loop → Draft → Evaluate → (back-edge to Loop)
                               ↓ exit condition met
                            Output
```

Common pattern: **generate → critique → refine** (produces noticeably better output than a single LLM pass).

### Fork
Splits into multiple parallel branches that all execute simultaneously.
- All branches receive the same input (broadcast) or a split of an array input
- Branches run via `Promise.all`
- Must always be followed by a **Join** node to merge results

```
Use when: doing 2+ independent tasks at once (e.g. search Google AND scrape a URL)
```

### Join
Waits for parallel Fork branches to complete and merges their results.
- Modes: `wait_all` (default), `wait_first`, `wait_any_n`
- Merge formats: `array`, `object` (keyed by branch), `concatenated` string
- Always paired with a preceding Fork node

### Switch
Routes to one of many branches — like Condition but for 3+ options.
- Each case has a label; the LLM classifies which case matches
- Has a default fallback case for unmatched inputs

```
Input → Intent Switch
            ├── "billing"    → Billing LLM
            ├── "technical"  → Tech LLM
            └── "general"    → General LLM
```

---

## Quick Decision Guide

| Goal | Node |
|---|---|
| Call an AI model | LLM |
| Search web / call API / write data | Tool |
| Route yes/no | Condition |
| Route 3+ options | Switch |
| Run steps in parallel | Fork + Join |
| Repeat until good enough | Loop |
| Wait for human approval | HITL |
| Ask user a follow-up question | Clarify |
