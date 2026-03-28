'use client'
import { useState } from 'react'
import { useEffect } from 'react'
import { Copy, CheckCircle, Key, Zap, Globe, Terminal, Code2, BookOpen, Cpu, ChevronDown } from 'lucide-react'

interface ApiKey { id: string; name: string; key_prefix: string; created_at: string }

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', margin: '10px 0', border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lang}</span>
        <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: copied ? 'var(--green)' : 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
          {copied ? <CheckCircle size={11} /> : <Copy size={11} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.8, color: 'var(--text2)', overflowX: 'auto', margin: 0 }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

function SubAccordion({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 6 }}>
      <button onClick={() => setIsOpen(v => !v)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: isOpen ? 'rgba(124,111,240,0.05)' : 'var(--surface2)',
        border: 'none', cursor: 'pointer',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: isOpen ? 'var(--blue)' : 'var(--text)' }}>{label}</span>
        <ChevronDown size={12} color="var(--text3)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>
      {isOpen && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

const SECTIONS = [
  { id: 'start',    label: 'Getting Started',   icon: Zap },
  { id: 'builder',  label: 'Building Agents',    icon: Cpu },
  { id: 'chat',     label: 'Chat & Runs',        icon: Terminal },
  { id: 'nodes',    label: 'Node Types',         icon: Cpu },
  { id: 'auth',     label: 'Authentication',     icon: Key },
  { id: 'agents',   label: 'Agents API',         icon: Zap },
  { id: 'run',      label: 'Running Agents',     icon: BookOpen },
  { id: 'sessions', label: 'Sessions & SSE',     icon: Globe },
  { id: 'hitl',     label: 'HITL Approval',      icon: CheckCircle },
  { id: 'models',   label: 'Model Providers',    icon: Globe },
  { id: 'sdk',      label: 'SDK Clients',        icon: Code2 },
]

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text2)', margin: '0 0 8px' }}>{children}</p>
}
function Pill({ children }: { children: React.ReactNode }) {
  return <code style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--blue)', fontFamily: 'monospace' }}>{children}</code>
}

export default function DocsPage() {
  const [open, setOpen] = useState<Set<string>>(new Set(['start']))
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [origin, setOrigin] = useState('https://your-domain.com')

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch('/api/keys').then(r => r.json()).then(d => setApiKeys(Array.isArray(d) ? d : []))
  }, [])

  const exampleKey = apiKeys[0] ? `ahk_${apiKeys[0].key_prefix}...` : 'ahk_your_api_key'
  const BASE = origin

  const toggle = (id: string) => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const Note = ({ children }: { children: React.ReactNode }) => (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(124,111,240,0.07)', borderLeft: '3px solid rgba(124,111,240,0.5)', fontSize: 12, color: 'var(--text2)', lineHeight: 1.65, margin: '10px 0' }}>
      {children}
    </div>
  )
  const Tip = ({ children }: { children: React.ReactNode }) => (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(34,215,154,0.06)', borderLeft: '3px solid rgba(34,215,154,0.5)', fontSize: 12, color: 'var(--text2)', lineHeight: 1.65, margin: '10px 0' }}>
      {children}
    </div>
  )
  const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(124,111,240,0.15)', border: '2px solid rgba(124,111,240,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>{n}</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>{title}</div>
        <div style={{ fontSize: 12, lineHeight: 1.75, color: 'var(--text2)' }}>{children}</div>
      </div>
    </div>
  )
  const NodeBadge = ({ label, color }: { label: string; color: string }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', background: `${color}18`, color, border: `1px solid ${color}40`, marginRight: 4 }}>{label}</span>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '48px 56px', maxWidth: 820, margin: '0 auto' }}>

        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>Docs &amp; Reference</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>Everything you need to build, deploy, and integrate agents.</p>
        </div>

        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const isOpen = open.has(id)
          return (
            <div key={id} style={{ borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 8 }}>
              <button onClick={() => toggle(id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '15px 20px', background: isOpen ? 'rgba(124,111,240,0.06)' : 'var(--surface)',
                border: 'none', cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon size={14} color={isOpen ? 'var(--blue)' : 'var(--text3)'} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: isOpen ? 'var(--blue)' : 'var(--text)' }}>{label}</span>
                </div>
                <ChevronDown size={14} color="var(--text3)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </button>

              {isOpen && (
                <div style={{ padding: '20px 24px 28px', borderTop: '1px solid var(--border)' }}>

                  {/* ── GETTING STARTED ── */}
                  {id === 'start' && (<>
                    <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(245,160,32,0.07)', border: '1px solid rgba(245,160,32,0.25)', marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#f5a020', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Prerequisite</div>
                      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>
                        You need an <strong style={{ color: 'var(--text)' }}>LLM API key</strong> to use LLM nodes. Configure any provider on the <strong style={{ color: 'var(--text)' }}>Models</strong> page — Gemini, OpenAI, Anthropic, Groq, or a local Ollama instance. Function tools work without any key.
                      </div>
                    </div>

                    <SubAccordion label="Quick start guide">
                      <Step n={1} title="Load the sample agents">
                        Go to the <strong>Dashboard</strong> and click <Pill>Load Samples</Pill>. This creates 8 ready-to-run agents demonstrating every node type. It also seeds tools and model configs you can customise later.
                      </Step>
                      <Step n={2} title="Test an agent in the Builder">
                        Click any agent card to open it in the <strong>Builder</strong>. In the right panel under <em>Test</em>, type a message and hit <Pill>Run</Pill>. Tokens stream in real time; the Trace panel fills step by step.
                        <Tip>Start with <strong>Quick Chat</strong> — it&apos;s one LLM node, no dependencies. Then try <strong>Text Analysis Pipeline</strong> to see tools chaining.</Tip>
                      </Step>
                      <Step n={3} title="Try Chat for a real conversation">
                        Open <strong>Chat</strong> in the sidebar. Select an agent on the left, then type — responses stream in real time. If an agent hits a HITL node, an approval card appears inline.
                      </Step>
                      <Step n={4} title="Run from the API">
                        Go to <strong>API Keys</strong>, create a key, then call your agent from curl, Python, JavaScript, or any HTTP client:
                        <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/agents/AGENT_ID/run \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${exampleKey}" \\
  -d '{"message": "Hello!"}'`} />
                        <Tip>The <strong>API Keys</strong> page has ready-to-copy curl, Python, and JavaScript snippets pre-filled with your key.</Tip>
                      </Step>
                      <Step n={5} title="Build your own agent">
                        Click <Pill>New Agent</Pill> on the Dashboard. Drag nodes from the left panel onto the canvas, connect them top-to-bottom, configure each node in the right panel, and hit <Pill>Save</Pill>.
                      </Step>
                    </SubAccordion>

                    <SubAccordion label="Sample agents reference">
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {[
                          { name: 'Quick Chat',                    nodes: 'LLM',                              tip: 'Simplest possible agent. One LLM node, no dependencies.' },
                          { name: 'Text Analysis Pipeline',        nodes: 'Tool → Tool → LLM',                tip: 'Two function tools (no API key) feed results into an LLM.' },
                          { name: 'Web Research Report',           nodes: 'Tool → Passthrough → LLM',         tip: 'Search results formatted by Passthrough before LLM synthesises.' },
                          { name: 'Email Drafter + Human Review',  nodes: 'LLM → HITL → LLM',                tip: 'LLM drafts, you review, LLM finalises. Shows HITL feedback flow.' },
                          { name: 'Smart Support Router',          nodes: 'LLM → Condition → LLM × 2',       tip: 'Classify input as BILLING or TECHNICAL, route to specialist.' },
                          { name: 'Parallel Analyzer',             nodes: 'Fork → [LLM + Tool] → Join → LLM',tip: 'Two branches run simultaneously, merged, then synthesised.' },
                          { name: 'Iterative Blog Writer',         nodes: 'Loop → LLM (3×)',                  tip: 'LLM drafts then improves the same post 3 times.' },
                          { name: 'Topic Expert Router',           nodes: 'Switch → LLM × 4',                 tip: 'LLM classification picks the right specialist branch.' },
                        ].map(a => (
                          <div key={a.name} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border2)' }}>
                            <div style={{ flex: '0 0 200px', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{a.name}</div>
                            <div style={{ flex: '0 0 190px', fontSize: 11, fontFamily: 'monospace', color: 'var(--blue)' }}>{a.nodes}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>{a.tip}</div>
                          </div>
                        ))}
                      </div>
                    </SubAccordion>
                  </>)}

                  {/* ── BUILDING AGENTS ── */}
                  {id === 'builder' && (<>
                    <P>The Builder is a visual canvas where you connect nodes into a flow. Each node does one thing; the chain of nodes is your agent.</P>

                    <SubAccordion label="Canvas basics">
                      <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 2, paddingLeft: 18, margin: 0 }}>
                        <li><strong>Add a node</strong> — click any node type in the left panel to drop it onto the canvas.</li>
                        <li><strong>Connect nodes</strong> — drag from the bottom handle of one node to the top handle of the next.</li>
                        <li><strong>Configure a node</strong> — click any node to select it; settings appear in the right panel.</li>
                        <li><strong>Move nodes</strong> — drag the node body. Ctrl/Cmd + scroll to zoom. Middle-click to pan.</li>
                        <li><strong>Delete</strong> — select a node or edge and press Backspace.</li>
                        <li><strong>Copy node ID</strong> — click the tiny copy icon next to a node&apos;s name to copy its <Pill>{'{{nodeId}}'}</Pill> reference.</li>
                      </ul>
                    </SubAccordion>

                    <SubAccordion label="Required nodes: Entry & Exit">
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '4px 0 12px' }}>
                        <NodeBadge label="Entry" color="#22d3ee" /> — the start node (receives your message)
                        <NodeBadge label="Exit" color="#6868a0" /> — the end node (produces the final output)
                      </div>
                      <Note>Entry and Exit nodes are added automatically when you create a new agent. Do not delete them.</Note>
                    </SubAccordion>

                    <SubAccordion label="Template variables — {{nodeId}}">
                      <P>Use <Pill>{'{{nodeId}}'}</Pill> anywhere in a system prompt or passthrough template to inject a previous node&apos;s output:</P>
                      <CodeBlock lang="text" code={`# In an LLM system prompt:
You received these web search results:
{{n-search}}

Synthesise them into a 3-bullet summary.

# In a Passthrough template:
Query: {{n-in}}
Search results: {{last_output}}`} />
                      <Tip>Click the copy icon on any node to instantly copy its <Pill>{'{{nodeId}}'}</Pill> reference — no need to remember IDs.</Tip>
                    </SubAccordion>

                    <SubAccordion label="Walkthrough: building a research agent">
                      <Step n={1} title="Entry node">Already on canvas. The message you send becomes the starting input.</Step>
                      <Step n={2} title="Tool node — web_search">Add a <NodeBadge label="Tool" color="#22d79a" /> node, select <Pill>web_search</Pill>. Connect Entry → Tool.</Step>
                      <Step n={3} title="LLM node — synthesise results">Add an <NodeBadge label="LLM" color="#7c6ff0" /> node. Write instructions in the system prompt and use <Pill>{'{{last_output}}'}</Pill> to reference search results. Connect Tool → LLM.</Step>
                      <Step n={4} title="Exit node">Connect LLM → Exit. The LLM&apos;s response becomes the output.</Step>
                      <Step n={5} title="Test it">Type a research topic in the Test panel and click Run. Tokens stream in as the LLM responds.</Step>
                    </SubAccordion>

                    <SubAccordion label="HITL (Human-in-the-Loop) node">
                      <P>Drop a <NodeBadge label="HITL" color="#b080f8" /> node anywhere in the chain. When the agent reaches it:</P>
                      <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 2, paddingLeft: 18, margin: '4px 0' }}>
                        <li>Execution pauses. Run status becomes <Pill>waiting_hitl</Pill>.</li>
                        <li>An approval card appears in the Builder test panel and inline in Chat.</li>
                        <li>Click <strong>Approve &amp; Continue</strong> to resume, or type feedback first.</li>
                      </ul>
                      <Note>The node after HITL receives: <Pill>{'"Reviewer approved with notes: \\"feedback\\"\\n\\nPrevious context: [prior output]"'}</Pill></Note>
                    </SubAccordion>

                    <SubAccordion label="Condition node (true / false branch)">
                      <P>Routes to <strong>true</strong> or <strong>false</strong> based on a plain-English condition evaluated by an LLM:</P>
                      <CodeBlock lang="text" code={`the output contains BILLING
the text is longer than 200 words
the response includes an apology`} />
                      <P>Connect the <strong>green handle</strong> (true) and <strong>red handle</strong> (false) to different downstream nodes.</P>
                    </SubAccordion>

                    <SubAccordion label="Loop node">
                      <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 2, paddingLeft: 18, margin: '4px 0' }}>
                        <li>Entry → Loop (top handle)</li>
                        <li>Loop → body nodes (bottom handle)</li>
                        <li>Last body node → Loop (left <strong>loop-back</strong> handle) — closes the loop</li>
                        <li>Last body node → Exit (bottom handle) — output after loop finishes</li>
                      </ul>
                      <P>Set <Pill>Max Iterations</Pill> and an optional <Pill>Exit Condition</Pill> like <Pill>iteration {'>'}= 3</Pill>.</P>
                    </SubAccordion>

                    <SubAccordion label="Fork + Join (parallel branches)">
                      <P>Add a <NodeBadge label="Fork" color="#26c6da" /> node and connect it to multiple branches — each runs in parallel. Add a <NodeBadge label="Join" color="#26c6da" /> node to collect all results. Join merges as array, object, or concatenated text.</P>
                    </SubAccordion>

                    <SubAccordion label="Switch node (multi-way routing)">
                      <P>Routes to one of N branches. Use <Pill>llm_classify</Pill> mode — the Switch node automatically picks the right case via an LLM call. Connect each case handle to a different specialist node.</P>
                    </SubAccordion>
                  </>)}

                  {/* ── CHAT & RUNS ── */}
                  {id === 'chat' && (<>
                    <SubAccordion label="Chat page">
                      <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 2, paddingLeft: 18, margin: 0 }}>
                        <li>Select an agent from the left panel.</li>
                        <li>Type your message and press <strong>Enter</strong> (Shift+Enter for new line).</li>
                        <li>Responses stream token-by-token — blinking cursor while the LLM generates.</li>
                        <li>HITL nodes show an approval card inline — type optional feedback then click <strong>Approve &amp; Continue</strong>.</li>
                        <li>Click <strong>Clear</strong> in the top right to start a fresh conversation.</li>
                      </ul>
                      <Note>The Chat page uses the same SSE streaming endpoint as the builder — tokens appear live, not all at once.</Note>
                    </SubAccordion>

                    <SubAccordion label="Runs page">
                      <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 2, paddingLeft: 18, margin: 0 }}>
                        <li>Filter by status: All / Completed / Failed / Waiting HITL.</li>
                        <li>Filter by specific agent using the dropdown.</li>
                        <li>Click any run to see input, output, token count, latency, cost, and full trace.</li>
                        <li>Runs with <Pill>waiting_hitl</Pill> status show an inline approve/reject card.</li>
                        <li>Use <strong>Re-run</strong> to resubmit the same input.</li>
                      </ul>
                    </SubAccordion>

                    <SubAccordion label="Analytics page">
                      <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 2, paddingLeft: 18, margin: '0 0 8px' }}>
                        <li>Total runs, success rate, total tokens, estimated cost, average latency.</li>
                        <li>7-day run volume chart and per-agent breakdown.</li>
                      </ul>
                      <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(245,160,32,0.07)', border: '1px solid rgba(245,160,32,0.25)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#f5a020', marginBottom: 5 }}>If Analytics shows 0</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.65 }}>Run this in your Supabase SQL Editor:</div>
                        <CodeBlock lang="sql" code={`ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS cost_usd float8;`} />
                      </div>
                    </SubAccordion>

                    <SubAccordion label="API Keys page">
                      <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 2, paddingLeft: 18, margin: 0 }}>
                        <li>Click <strong>Create Key</strong>, give it a name.</li>
                        <li>Copy the full key immediately — it&apos;s only shown once.</li>
                        <li>Pass it as <Pill>X-AgentHub-Key: ahk_...</Pill> in your request headers.</li>
                        <li>Revoke a key any time from this page.</li>
                      </ul>
                    </SubAccordion>

                    <SubAccordion label="Models page">
                      <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 2, paddingLeft: 18, margin: 0 }}>
                        <li><strong>Provider</strong>: google, openai-compatible, anthropic, or ollama.</li>
                        <li><strong>Model ID</strong>: e.g. <Pill>gemini-2.5-flash</Pill>, <Pill>gpt-4o</Pill>, <Pill>claude-sonnet-4-6</Pill>.</li>
                        <li><strong>API Key</strong>: leave blank to use the server env var.</li>
                        <li><strong>Base URL</strong>: only for OpenAI-compatible endpoints (Ollama, Groq, LM Studio).</li>
                      </ul>
                      <Note>LLM nodes with no model selected use the server&apos;s default model. Configure any provider on the Models page.</Note>
                    </SubAccordion>

                    <SubAccordion label="Tools page">
                      <ul style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 2, paddingLeft: 18, margin: 0 }}>
                        <li><strong>Function</strong> — JavaScript code runs server-side. <Pill>input</Pill> is the previous node&apos;s output.</li>
                        <li><strong>HTTP</strong> — call any REST endpoint with custom headers and <Pill>{'{{variable}}'}</Pill> body templates.</li>
                        <li><strong>Web Search</strong> — built-in DuckDuckGo search.</li>
                        <li><strong>Web Scrape</strong> — scrapes a URL via Jina AI Reader.</li>
                        <li><strong>Datatable</strong> — import or export rows from a Datatable.</li>
                      </ul>
                      <Tip>Use the <strong>Test</strong> button on the Tools page to run any tool with sample input before wiring it into an agent.</Tip>
                    </SubAccordion>
                  </>)}

                  {/* ── NODE TYPES ── */}
                  {id === 'nodes' && (<>
                    <P>Every agent is a DAG of nodes. Connect them top-to-bottom. Each node type has a specific role.</P>

                    {[
                      { name: 'Input',       color: '#22d79a', badge: 'input',       desc: 'The entry point of every agent. Receives the user\'s message.', when: 'Every agent must start here. Use {{input}} in any downstream node.', fields: [] },
                      { name: 'Output',      color: '#22d79a', badge: 'output',      desc: 'The exit point. Whatever reaches this node is returned as the final API response.', when: 'Every agent must end here. Only one Output node per agent.', fields: [] },
                      { name: 'LLM',         color: '#7c6ff0', badge: 'llm',         desc: 'Calls a language model with a system prompt and the current message/state. The core building block of any agent.', when: 'Use when you need AI reasoning, writing, classification, summarisation, or any language task.',
                        fields: [
                          { f: 'model',       d: 'Model ID (e.g. gemini-2.5-flash, gpt-4o, claude-sonnet-4-6). Falls back to server default if blank.' },
                          { f: 'systemPrompt',d: 'System prompt. Supports {{variable}} template vars from upstream nodes.' },
                          { f: 'temperature', d: '0–1. Default 0.7. Lower = more deterministic.' },
                          { f: 'maxTokens',   d: 'Max output tokens. Leave blank for model default.' },
                          { f: 'agenticMode', d: 'LLM runs in a tool-calling loop until it stops calling tools.' },
                          { f: 'retry.enabled',d: 'Auto-retry on error, empty output, or guardrail block.' },
                        ],
                        note: 'In agentic mode, tools attached to the agent are available as function calls. Loop runs until the model emits a plain text response.' },
                      { name: 'Tool',        color: '#26c6da', badge: 'tool',        desc: 'Executes a tool (HTTP call, web search, code execution, datatable write, etc.) from the Tools library.', when: 'Use when you need to interact with the outside world — search, call an API, run code, or write to a database.',
                        fields: [
                          { f: 'toolId',       d: 'ID of the tool to execute.' },
                          { f: 'inputMapping', d: 'Map upstream outputs to tool input fields using {{variable}} syntax.' },
                          { f: 'retry.enabled',d: 'Auto-retry on tool error.' },
                        ] },
                      { name: 'Condition',   color: '#22d79a', badge: 'condition',   desc: 'Binary branch — routes execution to true or false based on a plain-English condition evaluated by an LLM.', when: 'Use for yes/no routing. E.g. "the output contains BILLING" → true path = billing, false = tech.',
                        fields: [
                          { f: 'condition', d: 'Plain English condition, e.g. "the output contains BILLING".' },
                          { f: 'model',     d: 'Model used to evaluate the condition.' },
                        ],
                        note: 'Connect the true handle and false handle to different downstream nodes. Both should eventually reconnect at Output.' },
                      { name: 'Switch',      color: '#ffd600', badge: 'switch',      desc: 'Multi-way branch. Routes to one of several named cases — like Condition but for 3+ options.', when: 'Use when input can fall into more than two categories.',
                        fields: [
                          { f: 'switchType', d: 'value_match: exact string. expression: JS expression. llm_classify: LLM picks the case.' },
                          { f: 'cases',      d: 'Array of { label, match } pairs. label becomes a canvas handle.' },
                          { f: 'defaultCase',d: 'Node to route to when no case matches.' },
                        ] },
                      { name: 'Loop',        color: '#f5a020', badge: 'loop',        desc: 'Repeats a section of the graph until an exit condition is met or a max iteration count is hit.', when: 'Use for iterative refinement (generate → critique → improve) or processing a list item by item.',
                        fields: [
                          { f: 'maxIterations',    d: 'Hard stop. Default 10.' },
                          { f: 'exitCondition',    d: 'Plain English condition checked after each iteration.' },
                          { f: 'exitConditionType',d: 'expression or llm_judge.' },
                        ],
                        note: 'Connect the last body node back to Loop (back-edge) to close the loop. Execution exits forward when condition is met.' },
                      { name: 'Fork',        color: '#b080f8', badge: 'fork',        desc: 'Splits execution into N parallel branches that all run simultaneously.', when: 'Use when you want to do multiple independent things at once (e.g. search + scrape + query DB in parallel).',
                        fields: [
                          { f: 'branches',  d: 'Array of branch labels. Each becomes a separate output handle.' },
                          { f: 'inputMode', d: 'broadcast: all branches get the same input. split: each branch gets one element of an array.' },
                        ],
                        note: 'Always pair with a Join node downstream.' },
                      { name: 'Join',        color: '#26c6da', badge: 'join',        desc: 'Waits for parallel Fork branches to complete and merges results into one.', when: 'Always used after a Fork.',
                        fields: [
                          { f: 'joinMode',    d: 'wait_all / wait_first / wait_n.' },
                          { f: 'mergeFormat', d: 'array / object / concatenated.' },
                          { f: 'mergeAs',     d: 'Variable name for merged output (optional).' },
                        ] },
                      { name: 'HITL',        color: '#f5a020', badge: 'hitl',        desc: 'Pauses the run and waits for a human to review, give feedback, and approve before continuing.', when: 'Use before any irreversible action — sending an email, publishing content, processing a payment.',
                        fields: [
                          { f: 'question',    d: 'Message shown to the reviewer.' },
                          { f: 'guardPrompt', d: 'Optional prompt to evaluate reviewer feedback before resuming.' },
                        ],
                        note: 'While paused, run status is waiting_hitl. Approve via Runs page or POST /api/runs/:runId/resume.' },
                      { name: 'Clarify',     color: '#e85555', badge: 'clarify',     desc: 'Pauses mid-run and asks the user a clarifying question, then continues with their answer.', when: 'Use when user input might be ambiguous. E.g. "write a report" → ask "What topic and length?".',
                        fields: [
                          { f: 'clarifySystemPrompt', d: 'System prompt for question-generating LLM. Leave blank for default.' },
                        ],
                        note: 'Agent auto-generates the question based on current context. User answers in the Chat UI or via the API.' },
                      { name: 'Passthrough', color: 'var(--text3)', badge: 'passthrough', desc: 'Passes state through unchanged. Useful as an explicit junction or label in complex graphs.', when: 'Use as a visual connector when multiple branches rejoin.', fields: [] },
                    ].map(node => (
                      <SubAccordion key={node.name} label={
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: node.color }}>{node.name}</span>
                          <code style={{ fontSize: 10, padding: '1px 7px', borderRadius: 5, background: 'var(--surface)', border: '1px solid var(--border)', fontFamily: 'monospace', color: 'var(--text3)', fontWeight: 400 }}>{node.badge}</code>
                        </span>
                      }>
                        <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text2)', margin: '0 0 8px' }}>{node.desc}</p>
                        <div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 7, background: 'rgba(124,111,240,0.06)', borderLeft: '3px solid rgba(124,111,240,0.35)', fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>
                          <strong style={{ color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>When to use · </strong>{node.when}
                        </div>
                        {node.fields.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 'note' in node && node.note ? 10 : 0 }}>
                            {node.fields.map(({ f, d }) => (
                              <div key={f} style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                                <code style={{ color: 'var(--blue)', fontFamily: 'monospace', flexShrink: 0, minWidth: 120 }}>{f}</code>
                                <span style={{ color: 'var(--text3)', lineHeight: 1.5 }}>{d}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {'note' in node && node.note && (
                          <div style={{ padding: '7px 10px', borderRadius: 7, background: 'rgba(34,215,154,0.06)', borderLeft: '3px solid rgba(34,215,154,0.35)', fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>
                            {node.note}
                          </div>
                        )}
                      </SubAccordion>
                    ))}

                    <SubAccordion label="Quick decision guide">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {[
                          { goal: 'Call an AI model',             node: 'LLM' },
                          { goal: 'Search web / call API / run code', node: 'Tool' },
                          { goal: 'Route yes / no',               node: 'Condition' },
                          { goal: 'Route 3+ options',             node: 'Switch' },
                          { goal: 'Run steps in parallel',        node: 'Fork + Join' },
                          { goal: 'Repeat until good enough',     node: 'Loop' },
                          { goal: 'Wait for human approval',      node: 'HITL' },
                          { goal: 'Ask user a follow-up question',node: 'Clarify' },
                        ].map(({ goal, node }) => (
                          <div key={goal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', gap: 10 }}>
                            <span style={{ fontSize: 11, color: 'var(--text2)' }}>{goal}</span>
                            <code style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', fontFamily: 'monospace', flexShrink: 0 }}>{node}</code>
                          </div>
                        ))}
                      </div>
                    </SubAccordion>

                    <SubAccordion label="Template variables & state object">
                      <P>Use <Pill>{'{{nodeId}}'}</Pill> syntax in system prompts or input mappings to inject upstream node output.</P>
                      <CodeBlock lang="text" code={`# In an LLM system prompt:
Summarise the following research:
{{web_search_node}}

# In a tool input mapping:
query: {{llm_classify_node}}
limit: 10`} />
                      <P>Condition and Switch expressions run in a sandboxed context with <Pill>state</Pill> available:</P>
                      <CodeBlock lang="javascript" code={`state.sentiment === 'positive'
state.score > 0.8
state.output?.includes('ERROR')
state.intent  // for switch: matches against case .match fields`} />
                    </SubAccordion>
                  </>)}

                  {/* ── AUTHENTICATION ── */}
                  {id === 'auth' && (<>
                    <P>All API requests require an API key in the <Pill>X-AgentHub-Key</Pill> header. Generate keys from the API Keys page.</P>
                    <SubAccordion label="curl">
                      <CodeBlock lang="bash" code={`curl -H "X-AgentHub-Key: ${exampleKey}" ${BASE}/api/agents`} />
                    </SubAccordion>
                    <SubAccordion label="Python">
                      <CodeBlock lang="python" code={`import requests

resp = requests.get('${BASE}/api/agents', headers={
    'Content-Type': 'application/json',
    'X-AgentHub-Key': '${exampleKey}',
})
agents = resp.json()`} />
                    </SubAccordion>
                    <SubAccordion label="JavaScript">
                      <CodeBlock lang="javascript" code={`const res = await fetch('${BASE}/api/agents', {
  headers: {
    'Content-Type': 'application/json',
    'X-AgentHub-Key': '${exampleKey}',
  }
})
const agents = await res.json()`} />
                    </SubAccordion>
                  </>)}

                  {/* ── AGENTS API ── */}
                  {id === 'agents' && (<>
                    <SubAccordion label="List agents — GET /api/agents">
                      <CodeBlock lang="bash" code={`curl -H "X-AgentHub-Key: ${exampleKey}" ${BASE}/api/agents`} />
                    </SubAccordion>
                    <SubAccordion label="Get agent — GET /api/agents/:agentId">
                      <CodeBlock lang="bash" code={`curl -H "X-AgentHub-Key: ${exampleKey}" \\
  ${BASE}/api/agents/AGENT_ID`} />
                    </SubAccordion>
                    <SubAccordion label="Response shape">
                      <CodeBlock lang="json" code={`[
  {
    "id": "agent_abc123",
    "name": "My Agent",
    "description": "Does something useful",
    "version": 1,
    "run_count": 42,
    "created_at": "2026-01-01T00:00:00Z"
  }
]`} />
                    </SubAccordion>
                  </>)}

                  {/* ── RUNNING AGENTS ── */}
                  {id === 'run' && (<>
                    <P>Execute an agent with a message. Runs synchronously and returns the full response.</P>
                    <SubAccordion label="Endpoint & response shape">
                      <CodeBlock lang="bash" code={`POST ${BASE}/api/agents/:agentId/run`} />
                      <CodeBlock lang="json" code={`{
  "runId": "run_abc123",
  "status": "completed",
  "output": "Here are the latest trends...",
  "tokens": 1247,
  "latencyMs": 2340,
  "trace": [
    { "type": "node_start", "nodeId": "llm-1", "message": "LLM Node started", "ts": 0 },
    { "type": "llm_response", "nodeId": "llm-1", "message": "Response received (1247 tokens)", "ts": 2310 }
  ]
}`} />
                    </SubAccordion>
                    <SubAccordion label="curl">
                      <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/agents/AGENT_ID/run \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${exampleKey}" \\
  -d '{"message": "Analyse the latest trends"}'`} />
                    </SubAccordion>
                    <SubAccordion label="Python">
                      <CodeBlock lang="python" code={`import requests

resp = requests.post(
    f'${BASE}/api/agents/AGENT_ID/run',
    headers={
        'Content-Type': 'application/json',
        'X-AgentHub-Key': '${exampleKey}',
    },
    json={'message': 'Analyse the latest trends'},
)
result = resp.json()
print(result['output'])`} />
                    </SubAccordion>
                    <SubAccordion label="JavaScript">
                      <CodeBlock lang="javascript" code={`const res = await fetch(\`${BASE}/api/agents/AGENT_ID/run\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-AgentHub-Key': '${exampleKey}',
  },
  body: JSON.stringify({ message: 'Analyse the latest trends' }),
})
const result = await res.json()
console.log(result.output)`} />
                    </SubAccordion>
                  </>)}

                  {/* ── SESSIONS & SSE ── */}
                  {id === 'sessions' && (<>
                    <P>Sessions give you a persistent connection to an agent with real-time SSE streaming. Ideal for chat apps and long-running agents.</P>
                    <SubAccordion label="1. Create a session">
                      <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/agents/AGENT_ID/sessions \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${exampleKey}" \\
  -d '{"message": "Research the latest LLM benchmarks"}'`} />
                      <CodeBlock lang="json" code={`{
  "sessionId": "sess_abc123",
  "runId": "run_xyz456",
  "streamUrl": "${BASE}/api/sessions/sess_abc123/stream",
  "status": "created"
}`} />
                    </SubAccordion>
                    <SubAccordion label="2. Stream results (SSE)">
                      <CodeBlock lang="bash" code={`curl -N -H "Accept: text/event-stream" \\
  "${BASE}/api/sessions/SESS_ID/stream"`} />
                      <P>Events are newline-delimited JSON prefixed with <Pill>data:</Pill>:</P>
                      <CodeBlock lang="text" code={`data: {"type":"start","sessionId":"sess_abc123","runId":"run_xyz456"}
data: {"type":"trace","event":{"type":"node_start","nodeId":"llm-1","message":"LLM Call started","ts":0}}
data: {"type":"done","output":"Here are the top benchmarks...","tokens":1247,"latencyMs":2340,"status":"completed"}`} />
                    </SubAccordion>
                    <SubAccordion label="HITL pause event">
                      <CodeBlock lang="text" code={`data: {"type":"hitl_pause","runId":"run_xyz456","checkpoint":"hitl-1",
  "approveUrl":"/api/runs/run_xyz456/hitl/approve",
  "messagesUrl":"/api/runs/run_xyz456/hitl"}`} />
                    </SubAccordion>
                    <SubAccordion label="Python SSE client">
                      <CodeBlock lang="python" code={`import requests, json

API_KEY = '${exampleKey}'
BASE    = '${BASE}'
AGENT   = 'AGENT_ID'

sess = requests.post(
    f'{BASE}/api/agents/{AGENT}/sessions',
    headers={'Content-Type': 'application/json', 'X-AgentHub-Key': API_KEY},
    json={'message': 'Research the latest LLM benchmarks'},
).json()

with requests.get(
    sess['streamUrl'],
    headers={'Accept': 'text/event-stream'},
    stream=True
) as stream:
    for line in stream.iter_lines():
        if not line or not line.startswith(b'data:'):
            continue
        event = json.loads(line[5:].strip())
        if event['type'] == 'trace':
            print('[trace]', event['event'].get('message', ''))
        elif event['type'] == 'done':
            print('Output:', event['output'])
            break
        elif event['type'] == 'hitl_pause':
            print('HITL paused — approve via:', event['approveUrl'])
            break`} />
                    </SubAccordion>
                    <SubAccordion label="JavaScript SSE client">
                      <CodeBlock lang="javascript" code={`const sess = await fetch(\`${BASE}/api/agents/\${agentId}/sessions\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-AgentHub-Key': '${exampleKey}' },
  body: JSON.stringify({ message }),
}).then(r => r.json())

const es = new EventSource(sess.streamUrl)
es.onmessage = (e) => {
  const event = JSON.parse(e.data)
  if (event.type === 'done') { console.log('Output:', event.output); es.close() }
  if (event.type === 'hitl_pause') { es.close(); /* show review UI */ }
}`} />
                    </SubAccordion>
                  </>)}

                  {/* ── HITL APPROVAL ── */}
                  {id === 'hitl' && (<>
                    <P>When an agent hits a HITL node, execution pauses. Your app can inspect, chat, approve, or reject.</P>
                    <SubAccordion label="Check status — GET /api/runs/:runId/hitl">
                      <CodeBlock lang="bash" code={`curl -H "X-AgentHub-Key: ${exampleKey}" ${BASE}/api/runs/RUN_ID/hitl`} />
                      <CodeBlock lang="json" code={`{
  "runId": "run_abc123",
  "status": "waiting_hitl",
  "question": "Review the draft email before sending",
  "partial": "Dear team, ...",
  "messages": [{ "role": "agent", "content": "Please review this draft", "ts": 100 }]
}`} />
                    </SubAccordion>
                    <SubAccordion label="Send a message — POST /api/runs/:runId/hitl/message">
                      <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/runs/RUN_ID/hitl/message \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${exampleKey}" \\
  -d '{"content": "Can you make it more formal?"}'`} />
                    </SubAccordion>
                    <SubAccordion label="Approve — POST /api/runs/:runId/hitl/approve">
                      <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/runs/RUN_ID/hitl/approve \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${exampleKey}" \\
  -d '{"feedback": "Looks good, tone it down slightly"}'`} />
                    </SubAccordion>
                    <SubAccordion label="Reject — POST /api/runs/:runId/hitl/reject">
                      <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/runs/RUN_ID/hitl/reject \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${exampleKey}" \\
  -d '{"reason": "Draft needs complete rewrite"}'`} />
                    </SubAccordion>
                    <SubAccordion label="Full HITL flow (JavaScript)">
                      <CodeBlock lang="javascript" code={`const result = await hub.run(agentId, message)

if (result.status === 'waiting_hitl') {
  const { runId } = result

  // 1. Get context
  const hitl = await fetch(\`${BASE}/api/runs/\${runId}/hitl\`).then(r => r.json())
  showReviewUI(hitl.question, hitl.partial)

  // 2. Optional: chat with the agent
  await fetch(\`${BASE}/api/runs/\${runId}/hitl/message\`, {
    method: 'POST', body: JSON.stringify({ content: 'Make it shorter' })
  })

  // 3. Approve
  const final = await fetch(\`${BASE}/api/runs/\${runId}/hitl/approve\`, {
    method: 'POST', body: JSON.stringify({ feedback: 'LGTM' })
  }).then(r => r.json())

  console.log(final.output)
}`} />
                    </SubAccordion>
                  </>)}

                  {/* ── MODEL PROVIDERS ── */}
                  {id === 'models' && (<>
                    <P>Configure any LLM provider on the Models page — all providers are first-class. Each model config gets a name you reference in LLM nodes.</P>
                    {[
                      { name: 'Google Gemini',  provider: 'google',            models: 'gemini-2.5-flash, gemini-2.0-pro',       key: 'GEMINI_API_KEY (env)',   url: 'Built-in — no URL needed' },
                      { name: 'OpenAI',         provider: 'openai-compatible', models: 'gpt-4o, gpt-4o-mini, gpt-3.5-turbo',    key: 'Your OpenAI key',        url: 'https://api.openai.com' },
                      { name: 'Anthropic',      provider: 'anthropic',         models: 'claude-sonnet-4-6, claude-opus-4-6',     key: 'Your Anthropic key',     url: 'https://api.anthropic.com' },
                      { name: 'Groq (Fast)',    provider: 'openai-compatible', models: 'llama-3.3-70b, mixtral-8x7b',           key: 'Your Groq key',          url: 'https://api.groq.com/openai' },
                      { name: 'Ollama (Local)', provider: 'openai-compatible', models: 'llama3, mistral, phi-3',                key: 'ollama (no key needed)', url: 'http://localhost:11434' },
                      { name: 'LM Studio',      provider: 'openai-compatible', models: 'Any local model',                      key: 'lm-studio',              url: 'http://localhost:1234' },
                    ].map(p => (
                      <SubAccordion key={p.name} label={p.name}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text3)' }}>Provider type: </span><code style={{ color: 'var(--blue)', fontFamily: 'monospace', fontSize: 11 }}>{p.provider}</code></div>
                          <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text3)' }}>API Key: </span><span style={{ color: 'var(--text2)' }}>{p.key}</span></div>
                          <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text3)' }}>Models: </span><span style={{ color: 'var(--text2)' }}>{p.models}</span></div>
                          <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text3)' }}>Base URL: </span><span style={{ fontFamily: 'monospace', color: 'var(--cyan)', fontSize: 11 }}>{p.url}</span></div>
                        </div>
                      </SubAccordion>
                    ))}
                  </>)}

                  {/* ── SDK CLIENTS ── */}
                  {id === 'sdk' && (<>
                    <P>Drop-in Python and JavaScript for calling your agents from code. Includes multi-turn chat loops and HITL handling.</P>
                    <SubAccordion label="Multi-turn chat loop — Python">
                      <CodeBlock lang="python" code={`# chat_loop.py  —  run with: python3 chat_loop.py
import requests

API_KEY  = '${exampleKey}'
BASE     = '${BASE}'
AGENT_ID = 'AGENT_ID'

HEADERS = { 'Content-Type': 'application/json', 'X-AgentHub-Key': API_KEY }

def run(msg): return requests.post(f'{BASE}/api/agents/{AGENT_ID}/run', headers=HEADERS, json={'message': msg}).json()
def approve(run_id, fb=''): return requests.post(f'{BASE}/api/runs/{run_id}/hitl/approve', headers=HEADERS, json={'feedback': fb}).json()

print("Chat ready. Type 'exit' to quit.\\n")
while True:
    user_input = input("You: ").strip()
    if user_input.lower() in ('exit', 'quit'): break

    result = run(user_input)

    while result.get('status') == 'waiting_hitl':
        print(f"\\n[HITL] {result.get('output', 'Review required')}")
        result = approve(result['runId'], input("Feedback (Enter to approve): ").strip())

    while result.get('status') == 'waiting_clarify':
        print(f"\\n[Clarify] {result.get('output', 'Please clarify')}")
        result = approve(result['runId'], input("Your answer: ").strip())

    print(f"\\nAgent: {result.get('output', '')}\\n")`} />
                    </SubAccordion>
                    <SubAccordion label="Multi-turn chat loop — JavaScript">
                      <CodeBlock lang="javascript" code={`// chat_loop.mjs  —  run with: node chat_loop.mjs
import { createInterface } from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

const API_KEY  = '${exampleKey}'
const BASE     = '${BASE}'
const AGENT_ID = 'AGENT_ID'
const HEADERS  = { 'Content-Type': 'application/json', 'X-AgentHub-Key': API_KEY }

const post = (url, body) => fetch(url, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) }).then(r => r.json())
const rl = createInterface({ input, output })

console.log("Chat ready. Type 'exit' to quit.\\n")
while (true) {
  const userInput = (await rl.question('You: ')).trim()
  if (userInput === 'exit' || userInput === 'quit') break

  let result = await post(\`\${BASE}/api/agents/\${AGENT_ID}/run\`, { message: userInput })

  while (result.status === 'waiting_hitl') {
    console.log(\`\\n[HITL] \${result.output ?? 'Review required'}\`)
    result = await post(\`\${BASE}/api/runs/\${result.runId}/hitl/approve\`, { feedback: (await rl.question('Feedback (Enter to approve): ')).trim() })
  }
  while (result.status === 'waiting_clarify') {
    console.log(\`\\n[Clarify] \${result.output ?? 'Please clarify'}\`)
    result = await post(\`\${BASE}/api/runs/\${result.runId}/hitl/approve\`, { feedback: (await rl.question('Your answer: ')).trim() })
  }

  console.log(\`\\nAgent: \${result.output ?? ''}\\n\`)
}
rl.close()`} />
                    </SubAccordion>
                    <SubAccordion label="AgentHub class — JavaScript">
                      <CodeBlock lang="javascript" code={`class AgentHub {
  constructor(apiKey, baseUrl = '${BASE}') {
    this.headers = { 'Content-Type': 'application/json', 'X-AgentHub-Key': apiKey }
    this.baseUrl = baseUrl
  }
  async listAgents() { return fetch(\`\${this.baseUrl}/api/agents\`, { headers: this.headers }).then(r => r.json()) }
  async run(agentId, message) {
    return fetch(\`\${this.baseUrl}/api/agents/\${agentId}/run\`, {
      method: 'POST', headers: this.headers, body: JSON.stringify({ message }),
    }).then(r => r.json())
  }
  async resume(runId, feedback) {
    return fetch(\`\${this.baseUrl}/api/runs/\${runId}/resume\`, {
      method: 'POST', headers: this.headers, body: JSON.stringify({ feedback }),
    }).then(r => r.json())
  }
  async runWithHITL(agentId, message, onReview) {
    let result = await this.run(agentId, message)
    while (result.status === 'waiting_hitl') result = await this.resume(result.runId, await onReview(result.output))
    return result
  }
}

const hub = new AgentHub('${exampleKey}')
const result = await hub.run('AGENT_ID', 'Summarise this week in AI')
console.log(result.output)`} />
                    </SubAccordion>
                    <SubAccordion label="AgentHub class — Python">
                      <CodeBlock lang="python" code={`import requests
from typing import Callable, Optional

class AgentHub:
    def __init__(self, api_key: str, base_url: str = '${BASE}'):
        self.base_url = base_url.rstrip('/')
        self.headers = { 'Content-Type': 'application/json', 'X-AgentHub-Key': api_key }

    def list_agents(self): return requests.get(f'{self.base_url}/api/agents', headers=self.headers).json()

    def run(self, agent_id: str, message: str):
        return requests.post(f'{self.base_url}/api/agents/{agent_id}/run', headers=self.headers, json={'message': message}).json()

    def resume(self, run_id: str, feedback: Optional[str] = None):
        return requests.post(f'{self.base_url}/api/runs/{run_id}/resume', headers=self.headers, json={'feedback': feedback}).json()

    def run_with_hitl(self, agent_id, message, on_review: Callable):
        result = self.run(agent_id, message)
        while result['status'] == 'waiting_hitl':
            result = self.resume(result['runId'], on_review(result['output']))
        return result

hub = AgentHub('${exampleKey}')
result = hub.run('AGENT_ID', 'What are the top AI papers this week?')
print(result['output'])`} />
                    </SubAccordion>
                  </>)}

                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
