'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Send, Wand2, User, ArrowRight, AlertCircle, Wrench, Table2, CheckCircle,
  ExternalLink, Loader2, Plus, Clock, ChevronDown, Trash2, Bot, Paperclip,
  X, Play, ChevronRight, Edit3, GitBranch, Layers,
} from 'lucide-react'

interface Model { id: string; name: string; provider: string; model_id: string }
interface Message { role: 'user' | 'assistant'; content: string; fileAttachment?: string }
interface ToolDef { name: string; description?: string; type: string; method?: string; endpoint?: string; headers?: Record<string, string>; inputSchema?: Record<string, unknown> }
interface DatatableDef { name: string; description?: string; columns: { name: string; type: string; isPrimaryKey?: boolean }[] }
interface BuildPlan {
  name: string
  description?: string
  tools: ToolDef[]
  datatables: DatatableDef[]
  schema: { nodes: unknown[]; edges: unknown[] }
}
type ImportStep = { label: string; status: 'pending' | 'done' | 'active' }

interface BuildSession {
  id: string
  name: string
  messages: Message[]
  agentId?: string
  agentName?: string
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'agenthub_build_sessions'
const MAX_SESSIONS = 20

function loadSessions(): BuildSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveSessions(sessions: BuildSession[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS))) } catch {}
}

function stripCodeBlocks(text: string): string {
  return text.replace(/```[\w]*\n?[\s\S]*?```/g, '[build plan omitted]').trim()
}

const WELCOME = `Hi! I'm your agent design assistant. Describe what you want to build and I'll design the full flow — including any tools (web search, HTTP) and datatables you need — then generate everything in one click.

What would you like to build?`

const STARTER_PROMPTS = [
  { label: 'Classify & route support emails', icon: '📧' },
  { label: 'Research a competitor and draft a report', icon: '🔍' },
  { label: 'Monitor a website for changes daily', icon: '📡' },
  { label: 'Extract data from emails into a spreadsheet', icon: '📊' },
  { label: 'Auto-reply to simple support tickets', icon: '🤖' },
  { label: 'Ask for spending details, summarise and log them', icon: '💰' },
  { label: 'Scrape product prices and alert on changes', icon: '🛒' },
  { label: 'Summarise a URL and translate to another language', icon: '🌐' },
]

const SUGGESTION_CHIPS = [
  'Add human approval before the final step',
  'Add error handling and retry logic',
  'Add a clarification step at the start',
  'Log results to a datatable',
  'Add parallel research branches',
]

function parseContent(text: string) {
  // Line-based parser: only treats ``` at the very start of a line as a fence.
  // This prevents triple-backticks INSIDE JSON string values (e.g. passthrough templates
  // like "```json\n{{nodeId}}\n```") from breaking the outer code block.
  const parts: { type: 'text' | 'code'; lang: string; value: string }[] = []
  const lines = text.split('\n')
  let inCode = false
  let codeLang = ''
  let codeLines: string[] = []
  let textLines: string[] = []

  for (const line of lines) {
    if (!inCode && /^```(\w*)$/.test(line)) {
      if (textLines.length > 0) {
        const joined = textLines.join('\n').trim()
        if (joined) parts.push({ type: 'text', lang: '', value: joined })
        textLines = []
      }
      codeLang = line.slice(3)
      codeLines = []
      inCode = true
    } else if (inCode && line.trim() === '```') {
      parts.push({ type: 'code', lang: codeLang, value: codeLines.join('\n').trim() })
      codeLines = []
      inCode = false
    } else if (inCode) {
      codeLines.push(line)
    } else {
      textLines.push(line)
    }
  }
  // Unclosed block (still streaming) — show remaining as text
  if (inCode) { textLines.push('```' + codeLang); textLines.push(...codeLines) }
  if (textLines.length > 0) {
    const joined = textLines.join('\n').trim()
    if (joined) parts.push({ type: 'text', lang: '', value: joined })
  }
  return parts
}

// Extract the LAST ```json block by scanning lines from the end.
// Robust against nested backtick sequences inside JSON string values.
function extractLastJsonBlock(text: string): string | null {
  const lines = text.split('\n')
  let end = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (end === -1 && lines[i].trim() === '```') { end = i; continue }
    if (end !== -1 && /^```json/.test(lines[i])) {
      return lines.slice(i + 1, end).join('\n')
    }
  }
  return null
}

function tryExtractPlan(code: string): BuildPlan | null {
  try {
    const p = JSON.parse(code)
    if (p?.name && Array.isArray(p?.schema?.nodes) && p.schema.nodes.length > 0) {
      return {
        ...p,
        tools: Array.isArray(p.tools) ? p.tools : [],
        datatables: Array.isArray(p.datatables) ? p.datatables : [],
      } as BuildPlan
    }
  } catch { /* not valid JSON */ }
  return null
}

function TextSpan({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} style={{ color: 'var(--text)', fontWeight: 600 }}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function PlanCard({
  plan, isEditing, models, selectedModel, onModelChange, isBuilt,
}: {
  plan: BuildPlan
  isEditing: boolean
  models: Model[]
  selectedModel: string
  onModelChange: (m: string) => void
  isBuilt: boolean
}) {
  const [showJson, setShowJson] = useState(false)
  const llmNodeCount = (plan.schema.nodes as Array<{ type?: string }>).filter(n => n.type === 'llm').length
  const nodeCount = plan.schema.nodes.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Summary */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{plan.name}</div>
            {plan.description && <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{plan.description}</div>}
          </div>
          {isEditing && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(245,160,32,0.12)', color: '#f5a020', border: '1px solid rgba(245,160,32,0.3)', fontWeight: 700, whiteSpace: 'nowrap' }}>
              UPDATED
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>
            <GitBranch size={10} /> {nodeCount} node{nodeCount !== 1 ? 's' : ''}
          </span>
          {plan.tools.map((t, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#22d79a', background: 'rgba(34,215,154,0.08)', border: '1px solid rgba(34,215,154,0.2)', borderRadius: 6, padding: '3px 8px' }}>
              <Wrench size={10} /> {t.name}
            </span>
          ))}
          {plan.datatables.map((d, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f5a020', background: 'rgba(245,160,32,0.08)', border: '1px solid rgba(245,160,32,0.2)', borderRadius: 6, padding: '3px 8px' }}>
              <Table2 size={10} /> {d.name}
            </span>
          ))}
        </div>

        {/* Model picker — shown only when there are LLM nodes and plan isn't built yet */}
        {llmNodeCount > 0 && !isBuilt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border2)' }}>
            <Layers size={11} color="var(--text3)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
              Default model ({llmNodeCount} LLM node{llmNodeCount !== 1 ? 's' : ''})
            </span>
            <select
              value={selectedModel}
              onChange={e => onModelChange(e.target.value)}
              style={{
                flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: 7,
                border: '1px solid var(--border)', background: 'var(--surface2)',
                color: 'var(--text)', fontSize: 11, cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="">Gemini 2.5 Flash (default)</option>
              {models.map(m => (
                <option key={m.id} value={m.name}>{m.name} · {m.provider}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* JSON toggle */}
      <button
        onClick={() => setShowJson(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 16px', background: 'var(--surface2)', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', textAlign: 'left' }}
      >
        <ChevronRight size={11} style={{ transform: showJson ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
        {showJson ? 'Hide' : 'Show'} raw JSON
      </button>
      {showJson && (
        <pre style={{ padding: '12px 16px', fontSize: 11, fontFamily: 'monospace', lineHeight: 1.6, color: 'var(--text2)', overflowX: 'auto', margin: 0, maxHeight: 320, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
          {JSON.stringify(plan, null, 2)}
        </pre>
      )}
    </div>
  )
}

function BuildPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: WELCOME }])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [importingIdx, setImportingIdx] = useState<number | null>(null)
  const [importSteps, setImportSteps] = useState<ImportStep[]>([])
  const [openingIdx, setOpeningIdx] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [showSessionList, setShowSessionList] = useState(false)

  // Edit mode
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)
  const [editingAgentName, setEditingAgentName] = useState<string | null>(null)
  const [editingAgentSchema, setEditingAgentSchema] = useState<unknown>(null)

  // Per-plan model selection: msgIdx → model name
  const [planModels, setPlanModels] = useState<Record<number, string>>({})

  // Test after build
  const [builtAgentId, setBuiltAgentId] = useState<string | null>(null)
  const [builtAgentName, setBuiltAgentName] = useState<string | null>(null)
  const [builtMsgIdx, setBuiltMsgIdx] = useState<number | null>(null)
  const [testInput, setTestInput] = useState('')
  const [testRunning, setTestRunning] = useState(false)
  const [testOutput, setTestOutput] = useState<string | null>(null)

  // File attachment
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Suggestion chips — show after last assistant message has a plan
  const [lastPlanMsgIdx, setLastPlanMsgIdx] = useState<number | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sessionListRef = useRef<HTMLDivElement>(null)

  // Load from URL params (edit mode)
  useEffect(() => {
    const agentId = searchParams.get('agentId')
    const agentName = searchParams.get('agentName')
    if (!agentId) return
    setEditingAgentId(agentId)
    setEditingAgentName(agentName ?? 'this agent')
    fetch(`/api/agents/${agentId}`).then(r => r.json()).then(d => {
      if (d?.schema) {
        setEditingAgentSchema(d.schema)
        setMessages([{
          role: 'assistant',
          content: `I've loaded **${agentName ?? 'your agent'}**. Tell me what you'd like to change — I'll update the flow and you can apply it in one click.`,
        }])
      }
    }).catch(() => {})
  }, [searchParams])

  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(d => { if (Array.isArray(d)) setModels(d) }).catch(() => {})
    const saved = loadSessions()
    setSessions(saved)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, testOutput])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sessionListRef.current && !sessionListRef.current.contains(e.target as Node)) {
        setShowSessionList(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function saveCurrentSession(msgs: Message[], agentId?: string, agentName?: string) {
    if (msgs.length <= 1) return
    const userMessages = msgs.filter(m => m.role === 'user')
    if (userMessages.length === 0) return
    const name = userMessages[0].content.slice(0, 60) + (userMessages[0].content.length > 60 ? '…' : '')
    const now = new Date().toISOString()
    setSessions(prev => {
      const existing = currentSessionId ? prev.find(s => s.id === currentSessionId) : null
      let updated: BuildSession[]
      if (existing) {
        updated = prev.map(s => s.id === currentSessionId
          ? { ...s, name, messages: msgs, agentId: agentId ?? s.agentId, agentName: agentName ?? s.agentName, updatedAt: now }
          : s
        )
      } else {
        const newSession: BuildSession = {
          id: crypto.randomUUID(), name, messages: msgs, agentId, agentName, createdAt: now, updatedAt: now,
        }
        setCurrentSessionId(newSession.id)
        updated = [newSession, ...prev]
      }
      saveSessions(updated)
      return updated
    })
  }

  function startNewSession() {
    setCurrentSessionId(null)
    setEditingAgentId(null)
    setEditingAgentName(null)
    setEditingAgentSchema(null)
    setBuiltAgentId(null)
    setBuiltAgentName(null)
    setBuiltMsgIdx(null)
    setTestOutput(null)
    setPlanModels({})
    setMessages([{ role: 'assistant', content: WELCOME }])
    setInput('')
    setError('')
    setAttachedFile(null)
    setLastPlanMsgIdx(null)
    setShowSessionList(false)
  }

  function loadSession(session: BuildSession) {
    setCurrentSessionId(session.id)
    setMessages(session.messages)
    setError('')
    setShowSessionList(false)
    setBuiltAgentId(session.agentId ?? null)
    setBuiltAgentName(session.agentName ?? null)
    setBuiltMsgIdx(null)
    setTestOutput(null)
    setLastPlanMsgIdx(null)
  }

  function deleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId)
      saveSessions(updated)
      return updated
    })
    if (currentSessionId === sessionId) startNewSession()
  }

  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const content = ev.target?.result as string
      setAttachedFile({ name: file.name, content: content.slice(0, 8000) })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const sendMessage = async (overrideText?: string) => {
    const raw = overrideText ?? input.trim()
    if (!raw || streaming) return
    setInput('')
    setError('')
    setLastPlanMsgIdx(null)

    // Prepend file content if attached
    const text = attachedFile
      ? `[Attached file: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\`\n\n${raw}`
      : raw
    setAttachedFile(null)

    const withUser: Message[] = [...messages, { role: 'user', content: text }]
    setMessages([...withUser, { role: 'assistant', content: '' }])
    setStreaming(true)

    const historyForApi = withUser.map(m => ({
      role: m.role,
      content: m.role === 'assistant' ? stripCodeBlocks(m.content) : m.content,
    }))

    let acc = ''
    try {
      const res = await fetch('/api/build-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForApi,
          modelName: selectedModel || undefined,
          editingSchema: editingAgentSchema ?? undefined,
          editingAgentName: editingAgentName ?? undefined,
        }),
      })
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6)) as { type: string; token?: string; message?: string }
            if (ev.type === 'token' && ev.token) {
              acc += ev.token
              setMessages(prev => {
                const u = [...prev]
                u[u.length - 1] = { role: 'assistant', content: acc }
                return u
              })
            }
            if (ev.type === 'error') throw new Error(ev.message ?? 'LLM error')
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue
            throw parseErr
          }
        }
      }

      const finalMsgs: Message[] = [...withUser, { role: 'assistant', content: acc }]
      setMessages(finalMsgs)
      saveCurrentSession(finalMsgs)

      // Check if response contains a plan → show suggestion chips
      const lastBlock = extractLastJsonBlock(acc)
      const hasPlan = lastBlock !== null && tryExtractPlan(lastBlock) !== null
      if (hasPlan) setLastPlanMsgIdx(finalMsgs.length - 1)

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      setError(msg)
      setMessages(prev => {
        const u = [...prev]
        if (u[u.length - 1]?.role === 'assistant' && u[u.length - 1].content === '') u.pop()
        return u
      })
    } finally {
      setStreaming(false)
    }
  }

  const importPlan = async (msgIdx: number, plan: BuildPlan, modelName?: string) => {
    setImportingIdx(msgIdx)
    setError('')
    setBuiltAgentId(null)
    setTestOutput(null)

    const steps: ImportStep[] = [
      ...plan.tools.map(t => ({ label: `Create tool: ${t.name}`, status: 'pending' as const })),
      ...plan.datatables.map(d => ({ label: `Create datatable: ${d.name}`, status: 'pending' as const })),
      { label: editingAgentId ? `Update agent: ${plan.name}` : `Create agent: ${plan.name}`, status: 'pending' as const },
    ]
    setImportSteps(steps)

    const setStep = (i: number, status: ImportStep['status']) => {
      setImportSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status } : s))
    }

    try {
      let stepIdx = 0

      for (const tool of plan.tools) {
        setStep(stepIdx, 'active')
        const toolPayload = {
          name: tool.name, description: tool.description ?? '', type: tool.type,
          method: tool.method ?? 'GET', endpoint: tool.endpoint ?? '',
          headers: tool.headers ?? {}, inputSchema: tool.inputSchema ?? {}, timeout: 10000,
        }
        let toolRes = await fetch('/api/tools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toolPayload),
        })
        // If name already exists (409 or 500 with duplicate), try to find and update it
        if (!toolRes.ok) {
          const errBody = await toolRes.json().catch(() => ({})) as { error?: string }
          const isDuplicate = errBody.error?.includes('duplicate') || errBody.error?.includes('unique') || toolRes.status === 409
          if (isDuplicate) {
            // Fetch existing tools to find the one with this name
            const listRes = await fetch('/api/tools')
            if (listRes.ok) {
              const existing = await listRes.json() as { id: string; name: string }[]
              const match = existing.find(t => t.name === tool.name)
              if (match) {
                const patchRes = await fetch('/api/tools', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: match.id, ...toolPayload }),
                })
                if (!patchRes.ok) {
                  const pErr = await patchRes.json().catch(() => ({})) as { error?: string }
                  throw new Error(`Tool "${tool.name}": ${pErr.error ?? patchRes.status}`)
                }
                toolRes = patchRes // mark success
              }
            }
          } else {
            throw new Error(`Tool "${tool.name}": ${errBody.error ?? toolRes.status}`)
          }
        }
        setStep(stepIdx, 'done')
        stepIdx++
      }

      const datatableIdMap: Record<string, string> = {}
      for (const dt of plan.datatables) {
        setStep(stepIdx, 'active')
        const dtRes = await fetch('/api/datatables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: dt.name, description: dt.description ?? '', columns: dt.columns }),
        })
        if (dtRes.ok) {
          const created = await dtRes.json() as { id: string }
          datatableIdMap[dt.name] = created.id
        } else {
          const errBody = await dtRes.json().catch(() => ({})) as { error?: string }
          const isDuplicate = errBody.error?.includes('duplicate') || errBody.error?.includes('unique') || dtRes.status === 409
          if (isDuplicate) {
            // Find existing datatable with this name
            const listRes = await fetch('/api/datatables')
            if (listRes.ok) {
              const existing = await listRes.json() as { id: string; name: string }[]
              const match = existing.find(d => d.name === dt.name)
              if (match) { datatableIdMap[dt.name] = match.id }
              else throw new Error(`Datatable "${dt.name}": ${errBody.error ?? dtRes.status}`)
            } else throw new Error(`Datatable "${dt.name}": ${errBody.error ?? dtRes.status}`)
          } else {
            throw new Error(`Datatable "${dt.name}": ${errBody.error ?? dtRes.status}`)
          }
        }
        setStep(stepIdx, 'done')
        stepIdx++
      }

      const patchedSchema = JSON.parse(JSON.stringify(plan.schema)) as typeof plan.schema
      const schemaNodes = (patchedSchema?.nodes ?? []) as Array<{ type?: string; data?: Record<string, unknown> }>

      // Apply the chosen model to every LLM node
      if (modelName) {
        for (const node of schemaNodes) {
          if ((node.type === 'llm' || node.data?.nodeType === 'llm') && node.data) {
            node.data.model = modelName
          }
        }
      }

      for (const node of schemaNodes) {
        if (node.type === 'tool' && node.data) {
          const cfg = node.data.toolConfig as Record<string, unknown> | undefined
          const sch = (cfg?.input_schema ?? node.data.inputSchema) as Record<string, unknown> | undefined
          const refName = sch?.datatable_name as string | undefined
          if (refName && datatableIdMap[refName]) {
            if (cfg) {
              (cfg.input_schema as Record<string, unknown>).datatable_id = datatableIdMap[refName]
            } else {
              node.data.toolConfig = {
                ...(node.data.toolConfig as object ?? {}),
                type: 'datatable',
                input_schema: { ...(sch ?? {}), datatable_id: datatableIdMap[refName] },
              }
            }
          }
        }
      }

      setStep(stepIdx, 'active')

      let agentId: string
      if (editingAgentId) {
        // Update existing agent
        const res = await fetch(`/api/agents/${editingAgentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: plan.name, description: plan.description ?? '', schema: patchedSchema }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(err.error ?? `Agent update failed (${res.status})`)
        }
        agentId = editingAgentId
        // Update the local editing schema
        setEditingAgentSchema(patchedSchema)
      } else {
        // Create new agent
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: plan.name, description: plan.description ?? '', schema: patchedSchema }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(err.error ?? `Agent creation failed (${res.status})`)
        }
        const created = await res.json() as { id: string }
        agentId = created.id
      }

      setStep(stepIdx, 'done')
      saveCurrentSession(messages, agentId, plan.name)

      // Show inline test instead of navigating away
      setBuiltAgentId(agentId)
      setBuiltAgentName(plan.name)
      setBuiltMsgIdx(msgIdx)
      setImportingIdx(null)

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setImportingIdx(null)
      setImportSteps([])
    }
  }

  const runTest = async () => {
    if (!testInput.trim() || !builtAgentId || testRunning) return
    setTestRunning(true)
    setTestOutput('')
    try {
      const res = await fetch(`/api/agents/${builtAgentId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testInput.trim() }),
      })
      const data = await res.json() as { output?: string; error?: string; status?: string }
      if (data.error) setTestOutput(`Error: ${data.error}`)
      else setTestOutput(typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2))
    } catch {
      setTestOutput('Request failed')
    } finally {
      setTestRunning(false)
    }
  }

  const currentSession = sessions.find(s => s.id === currentSessionId)
  const showStarters = messages.length === 1 && !streaming && !editingAgentId

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', fontFamily: 'inherit' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#7c6ff0,#b080f8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wand2 size={10} color="white" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>Build via Chat</span>
        </div>

        {editingAgentId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6, background: 'rgba(245,160,32,0.1)', border: '1px solid rgba(245,160,32,0.25)', flexShrink: 0 }}>
            <Edit3 size={10} color="#f5a020" />
            <span style={{ fontSize: 11, color: '#f5a020', fontWeight: 600 }}>Editing: {editingAgentName}</span>
            <button onClick={() => { setEditingAgentId(null); setEditingAgentName(null); setEditingAgentSchema(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5a020', padding: 0, display: 'flex', marginLeft: 1, opacity: 0.7 }}>
              <X size={10} />
            </button>
          </div>
        )}

        {/* Session picker */}
        <div ref={sessionListRef} style={{ position: 'relative', flex: 1, maxWidth: 240 }}>
          <button onClick={() => setShowSessionList(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', outline: 'none', transition: 'border-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(124,111,240,0.35)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <Clock size={11} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentSession ? currentSession.name : 'New build'}
            </span>
            <ChevronDown size={11} style={{ flexShrink: 0, transition: 'transform 0.15s', transform: showSessionList ? 'rotate(180deg)' : 'none' }} />
          </button>

          {showSessionList && (
            <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.25)', overflow: 'hidden', minWidth: 260 }}>
              <button onClick={startNewSession}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Plus size={12} /> New build
              </button>
              {sessions.length === 0 ? (
                <div style={{ padding: '12px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>No previous builds yet</div>
              ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {sessions.map(s => (
                    <div key={s.id} onClick={() => loadSession(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 13px', cursor: 'pointer', background: s.id === currentSessionId ? 'var(--surface2)' : 'transparent', borderBottom: '1px solid var(--border2)', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = s.id === currentSessionId ? 'var(--surface2)' : 'transparent')}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{timeAgo(s.updatedAt)}</span>
                          {s.agentName && (
                            <span style={{ fontSize: 10, color: '#22d79a', background: 'rgba(34,215,154,0.08)', border: '1px solid rgba(34,215,154,0.18)', borderRadius: 4, padding: '0 5px' }}>
                              {s.agentName}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={e => deleteSession(s.id, e)}
                        style={{ padding: 4, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', flexShrink: 0, display: 'flex', opacity: 0.5, transition: 'opacity 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--red)' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text3)' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Model picker — compact */}
        <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
          style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 11, cursor: 'pointer', outline: 'none', maxWidth: 180 }}>
          <option value="">Gemini 2.5 Flash</option>
          {models.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
      </div>

      {/* ── Scroll area ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 16px 12px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Starter prompts */}
          {showStarters && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 7, marginBottom: 28 }}>
              {STARTER_PROMPTS.map((p, i) => (
                <button key={i} onClick={() => sendMessage(p.label)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', lineHeight: 1.4 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,111,240,0.4)'; e.currentTarget.style.background = 'rgba(124,111,240,0.04)'; e.currentTarget.style.color = 'var(--text)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text2)' }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user'
            const isStreamingThis = streaming && idx === messages.length - 1 && !isUser
            const parts = parseContent(msg.content)
            const isLastAssistant = !isUser && idx === messages.length - 1

            return (
              <div key={idx} style={{ marginBottom: 20, animation: 'fadeUp 0.18s ease-out both' }}>
                {isUser ? (
                  /* User bubble — right aligned */
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ maxWidth: '78%', padding: '10px 15px', borderRadius: '18px 18px 4px 18px', background: 'rgba(124,111,240,0.13)', border: '1px solid rgba(124,111,240,0.2)', fontSize: 14, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  /* Assistant — no bubble, just text + plan cards */
                  <div style={{ paddingRight: 8 }}>
                    {/* Typing indicator */}
                    {isStreamingThis && msg.content === '' && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 2px', marginBottom: 4 }}>
                        {[0, 0.18, 0.36].map((delay, i) => (
                          <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block', opacity: 0.4, animation: 'pulse 1.1s ease-in-out infinite', animationDelay: `${delay}s` }} />
                        ))}
                      </div>
                    )}

                    {parts.map((part, pi) => {
                      if (part.type === 'text' && !part.value.trim()) return null

                      if (part.type === 'text') {
                        return (
                          <p key={pi} style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.75, margin: '0 0 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            <TextSpan text={part.value.trim()} />
                            {isStreamingThis && pi === parts.length - 1 && (
                              <span style={{ display: 'inline-block', width: 2, height: 13, background: 'var(--blue)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }}>▋</span>
                            )}
                          </p>
                        )
                      }

                      const plan = part.lang === 'json' ? tryExtractPlan(part.value) : null
                      const isImporting = importingIdx === idx

                      return (
                        <div key={pi} style={{ marginBottom: 10, borderRadius: 12, border: `1px solid ${plan ? 'rgba(124,111,240,0.3)' : 'var(--border)'}`, overflow: 'hidden', background: 'var(--surface)', boxShadow: plan ? '0 2px 12px rgba(124,111,240,0.08)' : '0 1px 4px rgba(0,0,0,0.06)' }}>
                          {/* Plan toolbar */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: plan ? 'rgba(124,111,240,0.06)' : 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {plan && <Layers size={11} color="var(--blue)" />}
                              <span style={{ fontSize: 10, fontFamily: 'monospace', color: plan ? 'var(--blue)' : 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                {plan ? (editingAgentId ? 'Updated plan' : 'Build plan') : (part.lang || 'code')}
                              </span>
                            </div>

                            {plan && (
                              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                {builtMsgIdx === idx && builtAgentId ? (
                                  <>
                                    <span style={{ fontSize: 11, color: '#22d79a', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                                      <CheckCircle size={11} /> Built
                                    </span>
                                    <button onClick={() => router.push(`/builder/${builtAgentId}`)}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 7, border: 'none', background: 'var(--blue)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                      <ExternalLink size={10} /> Open in Builder
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {editingAgentId && (
                                      <button onClick={() => router.push(`/builder/${editingAgentId}`)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                        <ExternalLink size={10} /> Open
                                      </button>
                                    )}
                                    <button onClick={() => importPlan(idx, plan, planModels[idx] || undefined)}
                                      disabled={isImporting || openingIdx === idx}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 13px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: 700, cursor: isImporting ? 'default' : 'pointer', background: isImporting ? 'var(--surface2)' : 'var(--blue)', color: isImporting ? 'var(--text3)' : '#fff', transition: 'background 0.15s' }}>
                                      {isImporting
                                        ? <><span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />{editingAgentId ? 'Applying…' : 'Building…'}</>
                                        : <><ArrowRight size={11} />{editingAgentId ? 'Apply' : 'Build it'}</>
                                      }
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Import progress */}
                          {isImporting && importSteps.length > 0 && (
                            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {importSteps.map((step, si) => (
                                <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: step.status === 'done' ? '#22d79a' : step.status === 'active' ? 'var(--text)' : 'var(--text3)', transition: 'color 0.2s' }}>
                                  {step.status === 'done'
                                    ? <CheckCircle size={11} color="#22d79a" />
                                    : step.status === 'active'
                                      ? <span style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid var(--blue)', borderTopColor: 'transparent', display: 'inline-block', flexShrink: 0, animation: 'spin 0.7s linear infinite' }} />
                                      : <span style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid var(--border)', display: 'inline-block', flexShrink: 0 }} />
                                  }
                                  {step.label}
                                </div>
                              ))}
                            </div>
                          )}

                          {plan ? (
                            <PlanCard plan={plan} isEditing={!!editingAgentId} models={models}
                              selectedModel={planModels[idx] ?? ''} onModelChange={m => setPlanModels(prev => ({ ...prev, [idx]: m }))}
                              isBuilt={builtMsgIdx === idx} />
                          ) : (
                            <pre style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.7, color: 'var(--text2)', overflowX: 'auto', margin: 0, maxHeight: 400, overflowY: 'auto' }}>
                              {part.value}
                            </pre>
                          )}
                        </div>
                      )
                    })}

                    {/* Suggestion chips */}
                    {isLastAssistant && lastPlanMsgIdx === idx && !streaming && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                        {SUGGESTION_CHIPS.map((chip, ci) => (
                          <button key={ci} onClick={() => sendMessage(chip)}
                            style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, border: '1px solid rgba(124,111,240,0.25)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,111,240,0.5)'; e.currentTarget.style.color = 'var(--blue)'; e.currentTarget.style.background = 'rgba(124,111,240,0.06)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(124,111,240,0.25)'; e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Test panel ──────────────────────────────────────────── */}
          {builtAgentId && !streaming && (
            <div style={{ borderRadius: 12, border: '1px solid rgba(34,215,154,0.25)', background: 'var(--surface)', overflow: 'hidden', marginBottom: 16, boxShadow: '0 2px 12px rgba(34,215,154,0.06)', animation: 'fadeUp 0.2s ease-out both' }}>
              <div style={{ padding: '9px 14px', borderBottom: '1px solid rgba(34,215,154,0.15)', background: 'rgba(34,215,154,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <CheckCircle size={13} color="#22d79a" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#22d79a' }}>
                    {editingAgentId ? 'Changes applied!' : 'Agent built!'}&ensp;
                  </span>
                  {builtAgentName && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{builtAgentName}</span>}
                </div>
                <button onClick={() => router.push(`/builder/${builtAgentId}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'rgba(124,111,240,0.35)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <ExternalLink size={11} /> Open in Builder
                </button>
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 7 }}>
                  <input value={testInput} onChange={e => setTestInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') runTest() }}
                    placeholder="Send a test message to this agent…"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(124,111,240,0.4)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                  <button onClick={runTest} disabled={!testInput.trim() || testRunning}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 9, border: 'none', background: !testInput.trim() || testRunning ? 'var(--surface2)' : '#22d79a', color: !testInput.trim() || testRunning ? 'var(--text3)' : '#fff', fontSize: 13, fontWeight: 600, cursor: !testInput.trim() || testRunning ? 'default' : 'pointer', transition: 'background 0.15s' }}>
                    {testRunning ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} />}
                    Run
                  </button>
                </div>
                {testOutput !== null && (
                  <div style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto' }}>
                    {testRunning ? <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Running…</span> : testOutput}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', borderRadius: 9, background: 'rgba(232,85,85,0.06)', border: '1px solid rgba(232,85,85,0.2)', marginBottom: 12, animation: 'fadeUp 0.15s ease-out both' }}>
              <AlertCircle size={13} color="var(--red)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 16px 14px', background: 'var(--surface)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          {/* File chip */}
          {attachedFile && (
            <div style={{ marginBottom: 7 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 7, background: 'rgba(124,111,240,0.09)', border: '1px solid rgba(124,111,240,0.22)', fontSize: 11, color: 'var(--blue)' }}>
                <Paperclip size={9} /> {attachedFile.name}
                <button onClick={() => setAttachedFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', padding: 0, display: 'flex', opacity: 0.7, marginLeft: 2 }}>
                  <X size={9} />
                </button>
              </span>
            </div>
          )}

          {/* Unified pill input */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '5px 6px 5px 14px', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onFocusCapture={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(124,111,240,0.45)'; el.style.boxShadow = '0 0 0 3px rgba(124,111,240,0.07)' }}
            onBlurCapture={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.boxShadow = 'none' }}
          >
            <textarea ref={textareaRef} value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder={editingAgentId ? `What would you like to change in "${editingAgentName}"?` : 'Describe the agent you want to build…'}
              rows={1}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', padding: '6px 0', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.55, overflowY: 'hidden' }}
            />
            <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.json,.xml" style={{ display: 'none' }} onChange={handleFileAttach} />
            <button onClick={() => fileInputRef.current?.click()} title="Attach file"
              style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: 'transparent', color: attachedFile ? 'var(--blue)' : 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--blue)')}
              onMouseLeave={e => (e.currentTarget.style.color = attachedFile ? 'var(--blue)' : 'var(--text3)')}
            >
              <Paperclip size={13} />
            </button>
            <button onClick={() => sendMessage()} disabled={!input.trim() || streaming}
              style={{ width: 34, height: 34, borderRadius: 10, border: 'none', flexShrink: 0, background: !input.trim() || streaming ? 'rgba(124,111,240,0.12)' : 'var(--blue)', color: !input.trim() || streaming ? 'rgba(124,111,240,0.4)' : '#fff', cursor: !input.trim() || streaming ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, color 0.15s' }}>
              <Send size={13} />
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', marginTop: 5, opacity: 0.7 }}>
            Enter to send · Shift+Enter for new line · Attach .txt .csv .json
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp   { from { opacity:0; transform:translateY(7px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse    { 0%,100% { opacity:0.25; transform:scale(0.75) } 50% { opacity:1; transform:scale(1) } }
        @keyframes spin     { to { transform:rotate(360deg) } }
        @keyframes blink    { 0%,100% { opacity:1 } 50% { opacity:0 } }
      `}</style>
    </div>
  )
}

export default function BuildPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, color: 'var(--text3)', fontSize: 14 }}>Loading…</div>}>
      <BuildPageInner />
    </Suspense>
  )
}
