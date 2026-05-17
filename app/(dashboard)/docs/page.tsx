'use client'
import { useState, useEffect, useRef } from 'react'
import { Copy, CheckCircle, Key, Zap, Globe, Terminal, Code2, BookOpen, Cpu, ChevronRight, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import ThemeToggle from '@/components/ui/ThemeToggle'

// ── Components ────────────────────────────────────────────────────────────────
function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', margin: '12px 0', border: '1px solid #2A2A2A' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #2A2A2A', background: '#111111' }}>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lang}</span>
        <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: copied ? '#22C55E' : '#71717A', background: 'none', border: 'none', cursor: 'pointer' }}>
          {copied ? <CheckCircle size={11} /> : <Copy size={11} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.8, color: '#E4E4E7', overflowX: 'auto', margin: 0, background: '#0A0A0A' }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

function DocSection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginBottom: 40, scrollMarginTop: 28 }}>
      {/* text-h3: 18-20px/600, -0.02em — DESIGN.md */}
      <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>{title}</h3>
      {children}
    </div>
  )
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text2)', margin: '0 0 10px' }}>{children}</p>
}
function Pill({ children }: { children: React.ReactNode }) {
  return <code style={{ fontSize: 12, padding: '2px 7px', borderRadius: 5, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'monospace' }}>{children}</code>
}
function Note({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--accent-light)', borderLeft: '3px solid var(--accent)', fontSize: 12, color: 'var(--text2)', lineHeight: 1.65, margin: '10px 0' }}>{children}</div>
}
function Tip({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--success-bg)', borderLeft: '3px solid var(--success)', fontSize: 12, color: 'var(--text2)', lineHeight: 1.65, margin: '10px 0' }}>{children}</div>
}
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-light)', border: '2px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{n}</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, lineHeight: 1.75, color: 'var(--text2)' }}>{children}</div>
      </div>
    </div>
  )
}
function NodeBadge({ label, color }: { label: string; color: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 5, fontSize: 11, fontWeight: 700, fontFamily: 'monospace', background: `${color}18`, color, border: `1px solid ${color}40`, marginRight: 4 }}>{label}</span>
}

// ── Sidebar structure ─────────────────────────────────────────────────────────
const NAV = [
  { id: 'start',        label: 'Getting Started',    icon: Zap,
    subs: ['quick-start', 'imagine-agent', 'sample-agents'] },
  { id: 'builder',      label: 'Building Agents',    icon: Cpu,
    subs: ['canvas-basics', 'entry-exit', 'template-vars', 'prompts-lib', 'memory-builder', 'guardrails-builder', 'orchestrator', 'walkthrough', 'hitl-builder', 'condition', 'loop', 'fork-join', 'switch'] },
  { id: 'chat',         label: 'Chat & Runs',        icon: Terminal,
    subs: ['chat-page', 'runs-page', 'run-detail', 'dashboard-ref', 'api-keys-ref', 'models-ref', 'tools-ref', 'datatables-ref'] },
  { id: 'nodes',        label: 'Node Types',         icon: Cpu,
    subs: ['nodes-overview', 'quick-decision', 'state-vars'] },
  { id: 'auth',         label: 'Authentication',     icon: Key,         subs: [] },
  { id: 'agents',       label: 'Agents API',         icon: Zap,         subs: [] },
  { id: 'run',          label: 'Running Agents',     icon: BookOpen,    subs: [] },
  { id: 'sessions',     label: 'Sessions & SSE',     icon: Globe,       subs: [] },
  { id: 'hitl',         label: 'HITL Approval',      icon: CheckCircle, subs: [] },
  { id: 'models',       label: 'Model Providers',    icon: Globe,       subs: [] },
  { id: 'sdk',          label: 'SDK Clients',        icon: Code2,       subs: [] },
]

const SUB_LABELS: Record<string, string> = {
  'quick-start': 'Quick start guide', 'imagine-agent': 'Imagine an Agent', 'sample-agents': 'Sample agents',
  'canvas-basics': 'Canvas basics', 'entry-exit': 'Start & End nodes',
  'template-vars': 'Template variables', 'prompts-lib': 'Prompts library',
  'memory-builder': 'Memory in LLM nodes', 'guardrails-builder': 'Guardrails',
  'orchestrator': 'Orchestrator (Smart Clarify)',
  'walkthrough': 'Walkthrough', 'hitl-builder': 'Human Review node', 'condition': 'Branch node',
  'loop': 'Loop node', 'fork-join': 'Fork + Join', 'switch': 'Switch node',
  'chat-page': 'Chat page', 'runs-page': 'Runs page', 'run-detail': 'Run detail & trace',
  'dashboard-ref': 'Dashboard', 'api-keys-ref': 'API Keys',
  'models-ref': 'Models page', 'tools-ref': 'Tools page', 'datatables-ref': 'Datatables',
  'nodes-overview': 'All node types', 'quick-decision': 'Quick decision guide', 'state-vars': 'State & variables',
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('start')
  const [pendingScroll, setPendingScroll] = useState<string | null>(null)
  const [origin, setOrigin] = useState('https://your-domain.com')
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setOrigin(window.location.origin) }, [])

  // After section changes, scroll to pending sub-section
  useEffect(() => {
    if (!pendingScroll) return
    const el = document.getElementById(pendingScroll)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setPendingScroll(null)
    }
  }, [activeSection, pendingScroll])

  const exampleKey = 'ahk_your_api_key'
  const BASE = origin

  function selectSection(id: string) {
    setActiveSection(id)
    contentRef.current?.scrollTo({ top: 0 })
  }

  function navigateToSub(sectionId: string, subId: string) {
    if (sectionId === activeSection) {
      // Already on this section — just scroll
      const el = document.getElementById(subId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      // Switch section first, then scroll after render
      setActiveSection(sectionId)
      contentRef.current?.scrollTo({ top: 0 })
      setPendingScroll(subId)
    }
  }

  const activeNav = NAV.find(n => n.id === activeSection)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* Nav — matches DESIGN.md: 64px, nav-bg, logo with tagline */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--nav-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <ArrowLeft size={13} color="var(--text3)" style={{ marginRight: 2 }} />
            <Zap size={20} color="#2563EB" strokeWidth={2.5} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>AgentHub</div>
              <div style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 3 }}>Docs & Reference</div>
            </div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle />
            <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 16px', borderRadius: 10, fontWeight: 600, background: 'var(--primary)', color: 'var(--primary-fg)', textDecoration: 'none' }}>
              <Zap size={12} strokeWidth={2.5} /> Open App
            </Link>
          </div>
        </div>
      </nav>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar — all sub-items always visible, click navigates across sections */}
        <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--surface)', padding: '12px 8px' }}>
          {NAV.map(section => {
            const isActive = activeSection === section.id
            return (
              <div key={section.id} style={{ marginBottom: 2 }}>
                <button onClick={() => selectSection(section.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  height: 32, padding: '0 10px', borderRadius: 7,
                  background: isActive ? 'var(--text)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <section.icon size={13} color={isActive ? 'var(--bg)' : 'var(--text2)'} strokeWidth={isActive ? 2 : 1.5} />
                  <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--bg)' : 'var(--text2)', flex: 1 }}>{section.label}</span>
                </button>
                {/* Sub-items — always visible, work from any section */}
                {section.subs.map(subId => (
                  <button key={subId} onClick={() => navigateToSub(section.id, subId)} style={{
                    width: '100%', display: 'block', height: 26, padding: '0 10px 0 31px',
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: 12, fontWeight: 400, color: 'var(--text3)', borderRadius: 6,
                    transition: 'color 0.1s, background 0.1s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {SUB_LABELS[subId]}
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        {/* Content — DESIGN.md: --bg, generous whitespace, text-h1 28-32px/700 */}
        <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 760, padding: '40px 56px 80px' }}>

          {/* Section heading — text-h1 style */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.04em', margin: '0 0 6px' }}>{activeNav?.label}</h1>
            <div style={{ height: 1, background: 'var(--border)' }} />
          </div>

          {/* ── GETTING STARTED ── */}
          {activeSection === 'start' && (<>
            <div style={{ padding: '12px 16px', borderRadius: 9, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Prerequisite</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>
                You need an <strong style={{ color: 'var(--text)' }}>LLM API key</strong> to use LLM nodes. Configure any provider on the <strong style={{ color: 'var(--text)' }}>Models</strong> page. Gemini, OpenAI, Anthropic, Groq, or a local Ollama instance. Function tools work without any key.
              </div>
            </div>

            <DocSection id="quick-start" title="Quick start guide">
              <Step n={1} title="Create your first agent">Go to <strong>Agents</strong> in the sidebar and click <Pill>New Agent</Pill>. This creates an empty agent and opens it directly in the Builder. Or use <strong>Imagine an Agent</strong> in the top bar to describe what you want and have it generated automatically.</Step>
              <Step n={2} title="Test an agent in the Builder">Click any agent to open it in the Builder. In the right panel under <em>Test</em>, type a message and hit <Pill>Run</Pill>. Tokens stream in real time; the Trace panel fills step by step.<Tip>Start with a simple one-node LLM agent. Then add a Tool node to see chaining.</Tip></Step>
              <Step n={3} title="Try Chat for a conversation">Open <strong>Chat</strong> in the sidebar. Select an agent on the left, then type. Responses stream in real time. If an agent hits a Human Review node, the pipeline pauses for approval from the <strong>Runs</strong> page.</Step>
              <Step n={4} title="Run from the API">Go to <strong>API Keys</strong>, create a key, then call your agent:
                <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/agents/AGENT_ID/run \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${exampleKey}" \\
  -d '{"message": "Hello!"}'`} />
              </Step>
            </DocSection>

            <DocSection id="imagine-agent" title="Imagine an Agent — AI-assisted building">
              <P>Click <strong>Imagine an Agent</strong> in the top bar to describe what you want in plain English. The AI generates a complete agent plan with all nodes, connections, and configuration. You can then click <strong>Build</strong> to create it instantly or modify the plan before building.</P>
              <Tip>Use this to scaffold complex agents (multi-step research, parallel analysis, HITL workflows) and then refine them in the Builder.</Tip>
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
                <li>Describe what you want: <em>"An agent that researches a company, drafts a report, and waits for human review before sending"</em></li>
                <li>The AI generates a plan. Review it, then click Build.</li>
                <li>The agent opens directly in the Builder ready to test.</li>
                <li>Use the agent dropdown to modify an existing agent instead of creating a new one.</li>
              </ul>
            </DocSection>

            <DocSection id="sample-agents" title="Sample agents reference">
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', padding: '7px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['Agent', 'Nodes', 'What it shows'].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>)}
                </div>
                {[
                  { name: 'Quick Chat',                   nodes: 'LLM',                               tip: 'Simplest possible agent. One LLM node, no dependencies.' },
                  { name: 'Text Analysis Pipeline',       nodes: 'Action → Action → AI Step',                 tip: 'Two function tools (no API key) feed results into an LLM.' },
                  { name: 'Web Research Report',          nodes: 'Action → Transform → AI Step',          tip: 'Search results formatted by Passthrough before LLM synthesises.' },
                  { name: 'Email Drafter + Human Review', nodes: 'AI Step → Human Review → AI Step',                 tip: 'LLM drafts, you review, LLM finalises.' },
                  { name: 'Smart Support Router',         nodes: 'AI Step → Branch → AI Step × 2',        tip: 'Classify input as BILLING or TECHNICAL, route to specialist.' },
                  { name: 'Parallel Analyzer',            nodes: 'Fork → [AI Step + Action] → Join → AI Step', tip: 'Two branches run simultaneously, merged, then synthesised.' },
                  { name: 'Iterative Blog Writer',        nodes: 'Loop → AI Step (3×)',                   tip: 'LLM drafts then improves the same post 3 times.' },
                  { name: 'Topic Expert Router',          nodes: 'Switch → AI Step × 4',                  tip: 'LLM classification picks the right specialist branch.' },
                ].map((a, i, arr) => (
                  <div key={a.name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border2)' : 'none', gap: 8, alignItems: 'start' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{a.name}</div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--accent)' }}>{a.nodes}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>{a.tip}</div>
                  </div>
                ))}
              </div>
            </DocSection>
          </>)}

          {/* ── BUILDING AGENTS ── */}
          {activeSection === 'builder' && (<>
            <P>The Builder is a visual canvas where you connect nodes into a flow. Each node does one thing; the chain is your agent.</P>
            <DocSection id="canvas-basics" title="Canvas basics">
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2.1, paddingLeft: 20, margin: 0 }}>
                <li><strong>Add a node</strong>: click any node type in the left panel to drop it onto the canvas.</li>
                <li><strong>Connect nodes</strong>: drag from the bottom handle of one node to the top handle of the next.</li>
                <li><strong>Configure a node</strong>: click any node to select it; settings appear in the right panel.</li>
                <li><strong>Move nodes</strong>: drag the node body. Ctrl/Cmd + scroll to zoom. Middle-click to pan.</li>
                <li><strong>Delete</strong>: select a node or edge and press Backspace.</li>
                <li><strong>Copy node ID</strong>: click the tiny copy icon next to a node name to copy its <Pill>{'{{nodeId}}'}</Pill> reference.</li>
              </ul>
            </DocSection>
            <DocSection id="entry-exit" title="Start & End nodes">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 12px' }}>
                <NodeBadge label="Start" color="#22d3ee" /> receives your message
                <span style={{ color: 'var(--text3)', fontSize: 13 }}>·</span>
                <NodeBadge label="End" color="#6868a0" /> produces the final output
              </div>
              <Note>Entry and Exit nodes are added automatically when you create a new agent. Do not delete them.</Note>
            </DocSection>
            <DocSection id="template-vars" title="Template variables">
              <P>Use <Pill>{'{{nodeId}}'}</Pill> in system prompts or input mappings to inject upstream node output:</P>
              <CodeBlock lang="text" code={`# In an LLM system prompt:
You received these web search results:
{{n-search}}

Synthesise them into a 3-bullet summary.

# In a Passthrough template:
Query: {{n-in}}
Search results: {{last_output}}`} />
              <Tip>Click the copy icon on any node to instantly copy its <Pill>{'{{nodeId}}'}</Pill> reference.</Tip>
            </DocSection>
            <DocSection id="prompts-lib" title="Prompts library">
              <P>The Prompts page is a registry of reusable system prompts. In any LLM node, click <strong>Load a saved prompt</strong> to select one. The prompt text is copied into the system prompt field — it is a one-time paste, not a live link.</P>
              <Note>Editing a prompt in the Prompts page does NOT update agents that already loaded it. You must re-select it in each LLM node to get the updated version.</Note>
              <P>Use template variables inside prompt text. They are resolved at run time:</P>
              <CodeBlock lang="text" code={`You are a research assistant. The user asked: {{input}}\nPrevious findings: {{last_output}}\nSynthesize a final report.`} />
            </DocSection>

            <DocSection id="memory-builder" title="Memory in LLM nodes">
              <P>Attach a memory config to any LLM node to give it conversation history. In the LLM node config panel, find the <strong>Memory</strong> section and select a config from the dropdown.</P>
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2, paddingLeft: 20, margin: '0 0 10px' }}>
                <li><strong>Sliding</strong>: keeps the last N messages, drops older ones. Good for chat.</li>
                <li><strong>Full</strong>: keeps the entire conversation history. Can get expensive for long chats.</li>
                <li><strong>Summary</strong>: AI summarises old messages to save tokens.</li>
              </ul>
              <Note>Memory configs are <strong>live-linked</strong>. Changing a config in the Memory page immediately affects all agents using it on the next run.</Note>
            </DocSection>

            <DocSection id="guardrails-builder" title="Guardrails">
              <P>Attach a guardrail to any LLM node in the config panel. Guardrails run automatically on every LLM call — no extra nodes needed.</P>
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2, paddingLeft: 20, margin: '0 0 10px' }}>
                <li><strong>Input rules</strong>: checked before the prompt reaches the LLM. Block prompt injection, filter dangerous inputs.</li>
                <li><strong>Output rules</strong>: checked on the LLM response. Redact PII, block unsafe outputs.</li>
                <li>Rules use keyword and pattern matching described in plain English.</li>
                <li>Enable <strong>Log violations</strong> to see when rules fire in the run trace.</li>
              </ul>
              <Note>Guardrails are <strong>live-linked</strong>. Editing a guardrail in the Guardrails page immediately affects all agents using it.</Note>
            </DocSection>

            <DocSection id="orchestrator" title="Orchestrator — Smart Clarify">
              <P>The Orchestrator is an optional layer that wraps every user message before it reaches the pipeline. Enable it in the agent&apos;s <strong>Configure</strong> panel (gear icon in the builder).</P>
              <P>When a pipeline is paused at a <strong>Clarify</strong> node waiting for user input, the Orchestrator intercepts the next message and classifies it:</P>
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', margin: '12px 0' }}>
                {[
                  { action: 'CONTINUE', desc: 'User answered the clarify question. Forward to the pipeline normally.' },
                  { action: 'ANSWER',   desc: 'User asked a domain question instead. Reply inline, keep pipeline paused.' },
                  { action: 'RESPOND',  desc: 'Casual chat or off-topic. Reply naturally, keep pipeline paused.' },
                  { action: 'CANCEL',   desc: 'User said "stop" or "cancel". Mark run as completed.' },
                ].map(({ action, desc }, i, arr) => (
                  <div key={action} style={{ display: 'flex', gap: 14, padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border2)' : 'none', alignItems: 'flex-start' }}>
                    <code style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace', flexShrink: 0, minWidth: 80, marginTop: 1 }}>{action}</code>
                    <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{desc}</span>
                  </div>
                ))}
              </div>
              <Tip>The Orchestrator uses the model you select in the Configure panel. Temperature is set to 0 for classification (fast, deterministic) and 0.7 for inline replies.</Tip>
              <Note>If the Orchestrator is disabled, all user messages go directly to the pipeline as before.</Note>
            </DocSection>

            <DocSection id="walkthrough" title="Walkthrough: building a research agent">
              <Step n={1} title="Entry node">Already on canvas. The message you send becomes the starting input.</Step>
              <Step n={2} title="Tool node — web_search">Add a <NodeBadge label="Action" color="#22d79a" /> node, select <Pill>web_search</Pill>. Connect Entry → Tool.</Step>
              <Step n={3} title="LLM node">Add an <NodeBadge label="AI Step" color="#7c6ff0" /> node. Write instructions in the system prompt and use <Pill>{'{{last_output}}'}</Pill> to reference search results. Connect Tool → LLM.</Step>
              <Step n={4} title="Exit node">Connect LLM → Exit. The LLM response becomes the output.</Step>
              <Step n={5} title="Test it">Type a research topic in the Test panel and click Run.</Step>
            </DocSection>
            <DocSection id="hitl-builder" title="Human Review node">
              <P>Drop a <NodeBadge label="Human Review" color="#b080f8" /> node anywhere in the chain. When reached, execution pauses with status <Pill>waiting_hitl</Pill>. An approval card appears in the Builder test panel and inline in Chat.</P>
              <Note>The node after HITL receives: <Pill>{'"Reviewer approved with notes: \\"feedback\\"\\n\\nPrevious context: [prior output]"'}</Pill></Note>
            </DocSection>
            <DocSection id="condition" title="Branch node">
              <P>Routes to <strong>true</strong> or <strong>false</strong> based on a plain-English condition evaluated by an LLM:</P>
              <CodeBlock lang="text" code={`the output contains BILLING\nthe text is longer than 200 words\nthe response includes an apology`} />
              <P>Connect the green handle (true) and red handle (false) to different downstream nodes.</P>
            </DocSection>
            <DocSection id="loop" title="Loop node">
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
                <li>Entry → Loop (top handle)</li>
                <li>Loop → body nodes (bottom handle)</li>
                <li>Last body node → Loop (back handle) — closes the loop</li>
                <li>Last body node → Exit (bottom handle) — output after loop finishes</li>
              </ul>
              <P>Set <Pill>Max Iterations</Pill> and an optional <Pill>Exit Condition</Pill>.</P>
            </DocSection>
            <DocSection id="fork-join" title="Fork + Join">
              <P>Add a <NodeBadge label="Fork" color="#26c6da" /> node and connect to multiple branches. All run in parallel. Add a <NodeBadge label="Join" color="#26c6da" /> node to collect results. Join merges as array, object, or concatenated text.</P>
            </DocSection>
            <DocSection id="switch" title="Switch node">
              <P>Routes to one of N branches. Use <Pill>llm_classify</Pill> mode — the Switch node automatically picks the right case via an LLM call. Connect each case handle to a different specialist node.</P>
            </DocSection>
          </>)}

          {/* ── CHAT & RUNS ── */}
          {activeSection === 'chat' && (<>
            <DocSection id="chat-page" title="Chat page">
              <P>Click the chat bubble icon in the top bar to open the Chat panel (slide-in modal). Select an agent to start a conversation.</P>
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
                <li>Select an agent from the left dropdown.</li>
                <li>Type your message and press Enter (Shift+Enter for new line).</li>
                <li>Responses stream token-by-token in real time.</li>
                <li>If the pipeline hits a <strong>Clarify</strong> node, the chat pauses and asks you a question. Reply to continue.</li>
                <li>If the pipeline hits a <strong>HITL</strong> node, an approval card appears inline with Approve / Request Revision / Reject buttons.</li>
                <li>If the <strong>Orchestrator</strong> is enabled, it intercepts your messages during clarify pauses and handles off-topic questions or cancellation automatically.</li>
              </ul>
            </DocSection>

            <DocSection id="runs-page" title="Runs page">
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
                <li>Filter by status: All / Completed / Failed / Running / HITL / Clarify.</li>
                <li>Filter by specific agent using the dropdown.</li>
                <li>Click any row to open the run detail page.</li>
                <li>Runs with <Pill>waiting_hitl</Pill> status show an inline approve/reject/revise panel with the agent output for review.</li>
                <li>Runs with <Pill>waiting_clarify</Pill> status show the pending question — open the agent in Chat to respond.</li>
              </ul>
            </DocSection>

            <DocSection id="run-detail" title="Run detail & execution trace">
              <P>Click any run row to open its detail page. This shows:</P>
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2, paddingLeft: 20, margin: '0 0 10px' }}>
                <li><strong>4 stat cards</strong>: tokens used, latency, estimated cost, timestamp.</li>
                <li><strong>Input / Output</strong>: the exact data that entered and left the pipeline (rendered as markdown).</li>
                <li><strong>Waterfall chart</strong>: horizontal bars showing each node&apos;s compute time relative to the total. HITL/Clarify wait times are excluded (they are human time, not compute).</li>
                <li><strong>Execution trace timeline</strong>: vertical timeline with one card per node. Click any node to expand input and output side-by-side. For HITL nodes, approve/reject/revise inline.</li>
              </ul>
              <Note>The first and last items in the trace are the Input and Output nodes — the trace shows the full story from start to finish.</Note>
            </DocSection>
            <DocSection id="dashboard-ref" title="Dashboard">
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
                <li>Shows 5 stats: total agents, runs, tokens used, success rate, and avg latency (last 100 runs).</li>
                <li>Run activity chart for the last 7 days with completed/failed breakdown.</li>
                <li>Three panels: Your Agents, Recent Runs, and Awaiting Approval (HITL).</li>
              </ul>
            </DocSection>
            <DocSection id="api-keys-ref" title="API Keys page">
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
                <li>Click Generate Key, give it a name.</li>
                <li>Copy the full key immediately. it is only shown once.</li>
                <li>Pass it as <Pill>X-AgentHub-Key: ahk_...</Pill> in your request headers.</li>
                <li>Revoke a key any time from this page.</li>
              </ul>
            </DocSection>
            <DocSection id="models-ref" title="Models page">
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
                <li><strong>Provider</strong>: google, openai-compatible, anthropic, or ollama.</li>
                <li><strong>Model ID</strong>: e.g. <Pill>gemini-2.5-flash</Pill>, <Pill>gpt-4o</Pill>, <Pill>claude-sonnet-4-6</Pill>.</li>
                <li><strong>API Key</strong>: leave blank to use the server env var.</li>
                <li><strong>Base URL</strong>: only for OpenAI-compatible endpoints.</li>
              </ul>
            </DocSection>
            <DocSection id="tools-ref" title="Tools page">
              <ul style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 2, paddingLeft: 20, margin: '0 0 10px' }}>
                <li><strong>Function</strong>: JavaScript code runs server-side. <Pill>input</Pill> is the previous node output.</li>
                <li><strong>HTTP</strong>: call any REST endpoint with custom headers and <Pill>{'{{variable}}'}</Pill> body templates.</li>
                <li><strong>Web Search</strong>: DuckDuckGo (free, no key), Tavily, or Serper.</li>
                <li><strong>Web Scrape</strong>: scrapes a URL via Jina AI Reader and returns clean markdown.</li>
                <li><strong>Code Execution</strong>: run Python/JS/Bash/Go in a sandbox. Providers: Wandbox (free, no key), Piston (self-hosted), E2B (API key required).</li>
                <li><strong>Datatable</strong>: import rows as LLM context or export LLM JSON output as a new row.</li>
              </ul>
              <Tip>Use the Test button on the Tools page to run any tool with sample input before wiring it into an agent.</Tip>
            </DocSection>

            <DocSection id="datatables-ref" title="Datatables">
              <P>Datatables are structured tables you can read from and write to inside your agent pipelines. Create tables with custom columns on the Datatables page, then use a <strong>Datatable tool node</strong> in your agent.</P>
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', margin: '10px 0' }}>
                {[
                  { mode: 'Import', desc: 'Reads all rows from the table and injects them as a markdown table into the next LLM node\'s context. The LLM can then reason over the data.' },
                  { mode: 'Export', desc: 'Parses the previous LLM node\'s JSON output and writes it as a new row to the table. The LLM output must match the column names.' },
                ].map(({ mode, desc }, i) => (
                  <div key={mode} style={{ display: 'flex', gap: 14, padding: '10px 14px', borderBottom: i === 0 ? '1px solid var(--border2)' : 'none', alignItems: 'flex-start' }}>
                    <code style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace', flexShrink: 0, minWidth: 60, marginTop: 1 }}>{mode}</code>
                    <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{desc}</span>
                  </div>
                ))}
              </div>
              <P>Schema can be edited after creation — add, rename, or delete columns from the Datatables page. Existing rows are not affected by schema changes.</P>
              <P>Export the full table as CSV from the Data tab. Each row in the table can be edited by clicking on it.</P>
            </DocSection>
          </>)}

          {/* ── NODE TYPES ── */}
          {activeSection === 'nodes' && (<>
            <P>Every agent is a DAG of nodes. Connect them top-to-bottom. Each node type has a specific role.</P>
            <DocSection id="nodes-overview" title="All node types">
              {[
                { name: 'Start',       color: '#22d3ee', badge: 'start',       desc: 'The entry point. Receives the user message.', when: 'Every agent must start here. Use {{input}} in any downstream node.', fields: [] },
                { name: 'End',      color: '#6868a0', badge: 'end',      desc: 'The exit point. Whatever reaches this node is returned as the final API response.', when: 'Every agent must end here.', fields: [] },
                { name: 'AI Step',         color: '#7c6ff0', badge: 'ai-step',         desc: 'Calls a language model with a system prompt and the current state.', when: 'Use for AI reasoning, writing, classification, or summarisation.', fields: [{ f:'model', d:'Model config name. Falls back to server default if blank.' }, { f:'systemPrompt', d:'Supports {{variable}} template vars.' }, { f:'agenticMode', d:'LLM runs in a tool-calling loop until it stops.' }] },
                { name: 'Action',        color: '#26c6da', badge: 'action',        desc: 'Executes a tool from the Tools library.', when: 'Use when you need to interact with the outside world.', fields: [{ f:'toolId', d:'ID of the tool to execute.' }] },
                { name: 'Branch',   color: '#22d79a', badge: 'branch',   desc: 'Binary branch — routes true or false based on plain-English condition.', when: 'Use for yes/no routing.', fields: [{ f:'condition', d:'Plain English, e.g. "the output contains BILLING".' }] },
                { name: 'Switch',      color: '#ffd600', badge: 'switch',      desc: 'Multi-way branch. Routes to one of several named cases.', when: 'Use when input can fall into more than two categories.', fields: [{ f:'switchType', d:'value_match, expression, or llm_classify.' }] },
                { name: 'Loop',        color: '#f5a020', badge: 'loop',        desc: 'Repeats a section until an exit condition is met.', when: 'Use for iterative refinement or processing lists.', fields: [{ f:'maxIterations', d:'Hard stop. Default 5.' }, { f:'exitCondition', d:'Plain English condition checked after each iteration.' }] },
                { name: 'Fork',        color: '#b080f8', badge: 'fork',        desc: 'Splits execution into N parallel branches.', when: 'Use when you want to do multiple independent things at once.', fields: [{ f:'branches', d:'Array of branch labels.' }] },
                { name: 'Join',        color: '#26c6da', badge: 'join',        desc: 'Waits for parallel Fork branches and merges results.', when: 'Always used after a Fork.', fields: [{ f:'mergeFormat', d:'array, object, or concatenated.' }] },
                { name: 'Human Review',        color: '#f5a020', badge: 'human-review',        desc: 'Pauses and waits for a human to review and approve.', when: 'Use before any irreversible action.', fields: [{ f:'question', d:'Message shown to the reviewer.' }], note: 'While paused, run status is waiting_hitl. Approve via Runs page or POST /api/runs/:runId/resume.' },
                { name: 'Ask User',     color: '#e85555', badge: 'ask-user',     desc: 'Pauses and asks the user a clarifying question.', when: 'Use when user input might be ambiguous.', fields: [] },
                { name: 'Transform', color: '#6B7280', badge: 'transform', desc: 'Passes state through unchanged. Useful as an explicit junction.', when: 'Use as a visual connector when multiple branches rejoin.', fields: [] },
              ].map(node => (
                <div key={node.name} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <NodeBadge label={node.name} color={node.color} />
                    <code style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)', fontFamily: 'monospace' }}>{node.badge}</code>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 6px', lineHeight: 1.6 }}>{node.desc}</p>
                  <div style={{ padding: '5px 10px', borderRadius: 6, background: 'var(--accent-light)', borderLeft: '2px solid var(--accent-border)', fontSize: 11, color: 'var(--text2)', marginBottom: node.fields.length ? 8 : 0 }}>
                    <strong style={{ color: 'var(--text3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>When: </strong>{node.when}
                  </div>
                  {node.fields.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {node.fields.map(({ f, d }) => (
                        <div key={f} style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                          <code style={{ color: 'var(--accent)', fontFamily: 'monospace', flexShrink: 0, minWidth: 110 }}>{f}</code>
                          <span style={{ color: 'var(--text3)', lineHeight: 1.5 }}>{d}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {'note' in node && node.note && <Note>{node.note}</Note>}
                </div>
              ))}
            </DocSection>
            <DocSection id="quick-decision" title="Quick decision guide">
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                {[
                  { goal: 'Call an AI model',              node: 'AI Step' },
                  { goal: 'Search web / call API / run code', node: 'Action' },
                  { goal: 'Route yes / no',                node: 'Branch' },
                  { goal: 'Route 3+ options',              node: 'Switch' },
                  { goal: 'Run steps in parallel',         node: 'Fork + Join' },
                  { goal: 'Repeat until good enough',      node: 'Loop' },
                  { goal: 'Wait for human approval',       node: 'Human Review' },
                  { goal: 'Ask user a follow-up question', node: 'Ask User' },
                ].map(({ goal, node }, i, arr) => (
                  <div key={goal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border2)' : 'none' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{goal}</span>
                    <code style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{node}</code>
                  </div>
                ))}
              </div>
            </DocSection>
            <DocSection id="state-vars" title="State & template variables">
              <P>Use <Pill>{'{{nodeId}}'}</Pill> in system prompts or mappings to inject upstream node output.</P>
              <CodeBlock lang="text" code={`Summarise the following research:\n{{web_search_node}}\n\n# In a tool input mapping:\nquery: {{llm_classify_node}}\nlimit: 10`} />
              <P>Condition and Switch expressions can use <Pill>state</Pill>:</P>
              <CodeBlock lang="javascript" code={`state.sentiment === 'positive'\nstate.score > 0.8\nstate.output?.includes('ERROR')`} />
            </DocSection>
          </>)}

          {/* ── AUTH ── */}
          {activeSection === 'auth' && (<>
            <P>All API requests require an API key in the <Pill>X-AgentHub-Key</Pill> header. Generate keys from the API Keys page in the dashboard.</P>
            <DocSection title="curl">
              <CodeBlock lang="bash" code={`curl -H "X-AgentHub-Key: ${exampleKey}" ${BASE}/api/agents`} />
            </DocSection>
            <DocSection title="Python">
              <CodeBlock lang="python" code={`import requests\nresp = requests.get('${BASE}/api/agents', headers={'X-AgentHub-Key': '${exampleKey}'})\nagents = resp.json()`} />
            </DocSection>
            <DocSection title="JavaScript">
              <CodeBlock lang="javascript" code={`const res = await fetch('${BASE}/api/agents', {\n  headers: { 'X-AgentHub-Key': '${exampleKey}' }\n})\nconst agents = await res.json()`} />
            </DocSection>
          </>)}

          {/* ── AGENTS API ── */}
          {activeSection === 'agents' && (<>
            <DocSection title="GET /api/agents">
              <CodeBlock lang="bash" code={`curl -H "X-AgentHub-Key: ${exampleKey}" ${BASE}/api/agents`} />
            </DocSection>
            <DocSection title="GET /api/agents/:agentId">
              <CodeBlock lang="bash" code={`curl -H "X-AgentHub-Key: ${exampleKey}" ${BASE}/api/agents/AGENT_ID`} />
            </DocSection>
            <DocSection title="Response shape">
              <CodeBlock lang="json" code={`[{ "id": "agent_abc123", "name": "My Agent", "description": "...", "version": 1, "run_count": 42, "created_at": "2026-01-01T00:00:00Z" }]`} />
            </DocSection>
          </>)}

          {/* ── RUNNING AGENTS ── */}
          {activeSection === 'run' && (<>
            <P>Execute an agent with a message. Runs synchronously and returns the full response.</P>
            <DocSection title="Request body">
              <CodeBlock lang="json" code={`{\n  "message": "Your input here",\n  "callbackUrl": "https://your-system.com/webhook",  // optional\n  "conversationHistory": [\n    { "role": "user", "content": "Previous message" },\n    { "role": "assistant", "content": "Previous reply" }\n  ]\n}`} />
            </DocSection>
            <DocSection title="Response shape">
              <CodeBlock lang="json" code={`{\n  "runId": "run_abc123",\n  "status": "completed",  // completed | failed | waiting_hitl | waiting_clarify\n  "output": "Here are the trends...",\n  "tokens": 1247,\n  "latencyMs": 2340\n}`} />
            </DocSection>
            <DocSection title="curl">
              <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/agents/AGENT_ID/run \\\n  -H "Content-Type: application/json" \\\n  -H "X-AgentHub-Key: ${exampleKey}" \\\n  -d '{"message": "Analyse the latest trends"}'`} />
            </DocSection>
            <DocSection title="Python">
              <CodeBlock lang="python" code={`import requests\nresp = requests.post(\n    f'${BASE}/api/agents/AGENT_ID/run',\n    headers={'Content-Type': 'application/json', 'X-AgentHub-Key': '${exampleKey}'},\n    json={'message': 'Analyse the latest trends'}\n)\nprint(resp.json()['output'])`} />
            </DocSection>
            <DocSection title="JavaScript">
              <CodeBlock lang="javascript" code={`const res = await fetch('${BASE}/api/agents/AGENT_ID/run', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json', 'X-AgentHub-Key': '${exampleKey}' },\n  body: JSON.stringify({ message: 'Analyse the latest trends' }),\n})\nconst result = await res.json()\nconsole.log(result.output)`} />
            </DocSection>
          </>)}

          {/* ── SESSIONS & SSE ── */}
          {activeSection === 'sessions' && (<>
            <P>Sessions give you a persistent connection with real-time SSE streaming. Ideal for chat apps and long-running agents.</P>
            <DocSection title="1. Create a session">
              <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/agents/AGENT_ID/sessions \\\n  -H "Content-Type: application/json" \\\n  -H "X-AgentHub-Key: ${exampleKey}" \\\n  -d '{"message": "Research the latest LLM benchmarks"}'`} />
              <CodeBlock lang="json" code={`{ "sessionId": "sess_abc123", "runId": "run_xyz456", "streamUrl": "${BASE}/api/sessions/sess_abc123/stream", "status": "created" }`} />
            </DocSection>
            <DocSection title="2. Stream results (SSE)">
              <CodeBlock lang="bash" code={`curl -N -H "Accept: text/event-stream" "${BASE}/api/sessions/SESS_ID/stream"`} />
              <CodeBlock lang="text" code={`data: {"type":"start","sessionId":"sess_abc123","runId":"run_xyz456"}\ndata: {"type":"trace","event":{"type":"node_start","nodeId":"llm-1","message":"LLM started","ts":0}}\ndata: {"type":"done","output":"Here are the benchmarks...","tokens":1247,"status":"completed"}`} />
            </DocSection>
          </>)}

          {/* ── HITL ── */}
          {activeSection === 'hitl' && (<>
            <P>When a pipeline hits a HITL node, execution pauses with <Pill>status: waiting_hitl</Pill>. All three actions go to the same endpoint: <Pill>POST /api/runs/:runId/resume</Pill></P>
            <DocSection title="Full flow">
              <CodeBlock lang="text" code={`1. POST /api/agents/AGENT_ID/run  →  { status: "waiting_hitl", runId, output: { question, partial } }\n2. Your system stores runId, tells user "pending review"\n3. Reviewer approves/rejects from Runs page or via API\n4. POST /api/runs/RUN_ID/resume  →  pipeline resumes\n5. If callbackUrl was provided, final result is POSTed to your webhook`} />
            </DocSection>
            <DocSection title="Approve">
              <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/runs/RUN_ID/resume \\\n  -H "Content-Type: application/json" \\\n  -H "X-AgentHub-Key: ${exampleKey}" \\\n  -d '{"approved": true, "feedback": "Looks good"}'`} />
            </DocSection>
            <DocSection title="Request Revision">
              <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/runs/RUN_ID/resume \\\n  -H "Content-Type: application/json" \\\n  -H "X-AgentHub-Key: ${exampleKey}" \\\n  -d '{"approved": false, "action": "revise", "feedback": "Too formal. Rewrite in plain English"}'`} />
            </DocSection>
            <DocSection title="Reject">
              <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/runs/RUN_ID/resume \\\n  -H "Content-Type: application/json" \\\n  -H "X-AgentHub-Key: ${exampleKey}" \\\n  -d '{"approved": false, "feedback": "Not appropriate"}'`} />
            </DocSection>
          </>)}

          {/* ── MODELS ── */}
          {activeSection === 'models' && (<>
            <P>Configure any LLM provider on the Models page. Each model config gets a name you reference in LLM nodes.</P>
            <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr', padding: '7px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Provider', 'Type', 'Models', 'Notes'].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>)}
              </div>
              {[
                { name: 'Google Gemini', provider: 'google', models: 'gemini-2.5-flash, gemini-2.0-flash', note: 'Leave API key blank to use GEMINI_API_KEY env var' },
                { name: 'OpenAI', provider: 'openai-compatible', models: 'gpt-4o, gpt-4o-mini', note: 'Base URL: https://api.openai.com' },
                { name: 'Anthropic', provider: 'anthropic', models: 'claude-sonnet-4-6, claude-opus-4-6', note: 'Leave blank to use ANTHROPIC_API_KEY env var' },
                { name: 'Groq', provider: 'openai-compatible', models: 'llama-3.3-70b, mixtral-8x7b', note: 'Base URL: https://api.groq.com/openai' },
                { name: 'Ollama (Local)', provider: 'openai-compatible', models: 'llama3, mistral, phi-3', note: 'Base URL: http://localhost:11434. No API key needed.' },
              ].map((p, i, arr) => (
                <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr', padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border2)' : 'none', gap: 8, alignItems: 'start' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                  <code style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace' }}>{p.provider}</code>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{p.models}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.note}</div>
                </div>
              ))}
            </div>
          </>)}

          {/* ── SDK ── */}
          {activeSection === 'sdk' && (<>
            <P>Drop-in Python and JavaScript for calling your agents from code. Includes multi-turn chat loops and HITL handling.</P>
            <DocSection title="Multi-turn chat loop — Python">
              <CodeBlock lang="python" code={`import requests\n\nAPI_KEY  = '${exampleKey}'\nBASE     = '${BASE}'\nAGENT_ID = 'AGENT_ID'\nHEADERS  = { 'Content-Type': 'application/json', 'X-AgentHub-Key': API_KEY }\n\ndef run(msg): return requests.post(f'{BASE}/api/agents/{AGENT_ID}/run', headers=HEADERS, json={'message': msg}).json()\ndef approve(run_id, fb=''): return requests.post(f'{BASE}/api/runs/{run_id}/hitl/approve', headers=HEADERS, json={'feedback': fb}).json()\n\nprint("Chat ready.\\n")\nwhile True:\n    user_input = input("You: ").strip()\n    if user_input.lower() in ('exit', 'quit'): break\n    result = run(user_input)\n    while result.get('status') == 'waiting_hitl':\n        print(f"\\n[HITL] {result.get('output', 'Review required')}")\n        result = approve(result['runId'], input("Feedback (Enter to approve): ").strip())\n    print(f"\\nAgent: {result.get('output', '')}\\n")`} />
            </DocSection>
            <DocSection title="Multi-turn chat loop — JavaScript">
              <CodeBlock lang="javascript" code={`// node chat.mjs\nimport { createInterface } from 'readline/promises'\nimport { stdin as input, stdout as output } from 'process'\n\nconst HEADERS  = { 'Content-Type': 'application/json', 'X-AgentHub-Key': '${exampleKey}' }\nconst post = (url, body) => fetch(url, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) }).then(r => r.json())\nconst rl = createInterface({ input, output })\n\nwhile (true) {\n  const userInput = (await rl.question('You: ')).trim()\n  if (userInput === 'exit') break\n  let result = await post('${BASE}/api/agents/AGENT_ID/run', { message: userInput })\n  while (result.status === 'waiting_hitl') {\n    console.log('\\n[HITL]', result.output ?? 'Review required')\n    result = await post(\`${BASE}/api/runs/\${result.runId}/hitl/approve\`, { feedback: (await rl.question('Feedback: ')).trim() })\n  }\n  console.log('\\nAgent:', result.output ?? '', '\\n')\n}\nrl.close()`} />
            </DocSection>
          </>)}

        </div>
        </div>
      </div>
    </div>
  )
}
