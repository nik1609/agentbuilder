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

function PlanCard({ plan, isEditing }: { plan: BuildPlan; isEditing: boolean }) {
  const [showJson, setShowJson] = useState(false)
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

  const importPlan = async (msgIdx: number, plan: BuildPlan) => {
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding: '14px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #7c6ff0, #b080f8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wand2 size={13} color="white" />
          </div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Build via Chat</h1>
        </div>

        {/* Edit mode badge */}
        {editingAgentId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: 'rgba(245,160,32,0.1)', border: '1px solid rgba(245,160,32,0.3)' }}>
            <Edit3 size={11} color="#f5a020" />
            <span style={{ fontSize: 12, color: '#f5a020', fontWeight: 600 }}>Editing: {editingAgentName}</span>
            <button onClick={() => { setEditingAgentId(null); setEditingAgentName(null); setEditingAgentSchema(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5a020', padding: 0, display: 'flex', marginLeft: 2 }}>
              <X size={11} />
            </button>
          </div>
        )}

        {/* Session picker */}
        <div ref={sessionListRef} style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <button
            onClick={() => setShowSessionList(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border)',
              background: 'var(--surface2)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', outline: 'none',
            }}
          >
            <Clock size={12} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentSession ? currentSession.name : 'New build'}
            </span>
            <ChevronDown size={12} style={{ flexShrink: 0 }} />
          </button>

          {showSessionList && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden', minWidth: 300,
            }}>
              <button onClick={startNewSession}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Plus size={13} /> New build
              </button>
              {sessions.length === 0 ? (
                <div style={{ padding: '14px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>No previous builds yet</div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {sessions.map(s => (
                    <div key={s.id} onClick={() => loadSession(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', background: s.id === currentSessionId ? 'var(--surface2)' : 'transparent', borderBottom: '1px solid var(--border2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = s.id === currentSessionId ? 'var(--surface2)' : 'transparent')}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{timeAgo(s.updatedAt)}</span>
                          {s.agentName && (
                            <span style={{ fontSize: 10, color: '#22d79a', background: 'rgba(34,215,154,0.1)', border: '1px solid rgba(34,215,154,0.2)', borderRadius: 4, padding: '0 5px' }}>
                              <Bot size={8} style={{ display: 'inline', marginRight: 2 }} />{s.agentName}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={e => deleteSession(s.id, e)}
                        style={{ padding: 4, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', flexShrink: 0, display: 'flex' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'rgba(232,85,85,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
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

        {/* Model picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>Model</span>
          <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 12, cursor: 'pointer', outline: 'none', minWidth: 170 }}>
            <option value="">Default (Gemini 2.5 Flash)</option>
            {models.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Starter prompts — empty state */}
        {showStarters && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: 700, paddingLeft: 42 }}>
            {STARTER_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => sendMessage(p.label)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 20,
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)',
                  fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,111,240,0.4)'; e.currentTarget.style.color = 'var(--blue)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
              >
                <span>{p.icon}</span> {p.label}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user'
          const isStreamingThis = streaming && idx === messages.length - 1 && !isUser
          const parts = parseContent(msg.content)
          const isLastAssistant = !isUser && idx === messages.length - 1

          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0, marginTop: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isUser ? 'rgba(124,111,240,0.15)' : 'rgba(124,111,240,0.08)',
                  border: `1px solid ${isUser ? 'rgba(124,111,240,0.3)' : 'var(--border)'}`,
                }}>
                  {isUser ? <User size={13} color="var(--blue)" /> : <Wand2 size={13} color="var(--blue)" />}
                </div>

                <div style={{ maxWidth: 700, minWidth: 0, flex: 1 }}>
                  {isStreamingThis && msg.content === '' && (
                    <div style={{ padding: '12px 16px', borderRadius: '4px 14px 14px 14px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${delay}s` }} />
                      ))}
                    </div>
                  )}

                  {parts.map((part, pi) => {
                    if (part.type === 'text' && part.value.trim() === '') return null

                    if (part.type === 'text') {
                      return (
                        <div key={pi} style={{
                          padding: '12px 16px',
                          borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                          background: isUser ? 'rgba(124,111,240,0.1)' : 'var(--surface)',
                          border: `1px solid ${isUser ? 'rgba(124,111,240,0.2)' : 'var(--border)'}`,
                          marginBottom: pi < parts.length - 1 ? 8 : 0,
                          display: 'inline-block', maxWidth: '100%',
                        }}>
                          <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>
                            <TextSpan text={part.value.trim()} />
                            {isStreamingThis && pi === parts.length - 1 && (
                              <span style={{ display: 'inline-block', width: 2, height: 14, background: 'var(--blue)', marginLeft: 2, verticalAlign: 'text-bottom' }}>▋</span>
                            )}
                          </p>
                        </div>
                      )
                    }

                    const plan = part.lang === 'json' ? tryExtractPlan(part.value) : null
                    const isImporting = importingIdx === idx

                    return (
                      <div key={pi} style={{ marginBottom: pi < parts.length - 1 ? 8 : 0, borderRadius: 12, border: `1px solid ${plan ? 'rgba(124,111,240,0.4)' : 'var(--border)'}`, overflow: 'hidden', background: 'var(--surface)' }}>
                        {/* Plan header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: plan ? 'rgba(124,111,240,0.08)' : 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {plan && <Layers size={12} color="var(--blue)" />}
                            <span style={{ fontSize: 10, fontFamily: 'monospace', color: plan ? 'var(--blue)' : 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {plan ? (editingAgentId ? 'Updated Plan — ready to apply' : 'Build Plan — ready to deploy') : (part.lang || 'code')}
                            </span>
                          </div>
                          {plan && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {/* After this plan was built/applied — show Open in Builder instead */}
                              {builtMsgIdx === idx && builtAgentId ? (
                                <>
                                  <span style={{ fontSize: 11, color: '#22d79a', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <CheckCircle size={11} /> Built
                                  </span>
                                  <button
                                    onClick={() => router.push(`/builder/${builtAgentId}`)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', background: 'var(--blue)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    <ExternalLink size={12} /> Open in Builder
                                  </button>
                                </>
                              ) : (
                                <>
                                  {(editingAgentId) && (
                                    <button
                                      onClick={() => router.push(`/builder/${editingAgentId}`)}
                                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                    >
                                      <ExternalLink size={12} /> Open in Builder
                                    </button>
                                  )}
                                  <button
                                    onClick={() => importPlan(idx, plan)}
                                    disabled={isImporting || openingIdx === idx}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 7, border: 'none',
                                      background: (isImporting || openingIdx === idx) ? 'var(--surface2)' : 'var(--blue)',
                                      color: (isImporting || openingIdx === idx) ? 'var(--text3)' : '#fff',
                                      fontSize: 12, fontWeight: 600, cursor: (isImporting || openingIdx === idx) ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    <ArrowRight size={12} />
                                    {isImporting ? (editingAgentId ? 'Applying…' : 'Building…') : (editingAgentId ? 'Apply Changes' : 'Build it')}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Import steps */}
                        {isImporting && importSteps.length > 0 && (
                          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {importSteps.map((step, si) => (
                              <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                                {step.status === 'done'
                                  ? <CheckCircle size={12} color="#22d79a" />
                                  : step.status === 'active'
                                    ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--blue)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                                    : <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)', display: 'inline-block' }} />
                                }
                                <span style={{ color: step.status === 'done' ? '#22d79a' : step.status === 'active' ? 'var(--text)' : 'var(--text3)' }}>
                                  {step.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Visual plan card */}
                        {plan && <PlanCard plan={plan} isEditing={!!editingAgentId} />}
                        {!plan && (
                          <pre style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.7, color: 'var(--text2)', overflowX: 'auto', margin: 0, maxHeight: 420, overflowY: 'auto' }}>
                            {part.value}
                          </pre>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Suggestion chips — after last assistant message with a plan */}
              {isLastAssistant && lastPlanMsgIdx === idx && !streaming && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 42 }}>
                  {SUGGESTION_CHIPS.map((chip, ci) => (
                    <button key={ci} onClick={() => sendMessage(chip)}
                      style={{
                        padding: '5px 12px', borderRadius: 16, fontSize: 12,
                        border: '1px solid rgba(124,111,240,0.3)', background: 'rgba(124,111,240,0.06)',
                        color: 'var(--blue)', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,111,240,0.12)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,111,240,0.06)' }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Built — inline test panel */}
        {builtAgentId && !streaming && (
          <div style={{ borderRadius: 14, border: '1px solid rgba(34,215,154,0.3)', background: 'rgba(34,215,154,0.04)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(34,215,154,0.2)', background: 'rgba(34,215,154,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={14} color="#22d79a" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#22d79a' }}>
                  {editingAgentId ? 'Changes applied!' : 'Agent created!'} Try it now
                </span>
                {builtAgentName && <span style={{ fontSize: 12, color: 'var(--text3)' }}>— {builtAgentName}</span>}
              </div>
              <button onClick={() => router.push(`/builder/${builtAgentId}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
                <ExternalLink size={11} /> Open in Builder
              </button>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') runTest() }}
                  placeholder="Type a test message for this agent…"
                  style={{ flex: 1, padding: '9px 13px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                />
                <button onClick={runTest} disabled={!testInput.trim() || testRunning}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: 'none', background: !testInput.trim() || testRunning ? 'var(--surface2)' : '#22d79a', color: !testInput.trim() || testRunning ? 'var(--text3)' : '#fff', fontSize: 13, fontWeight: 600, cursor: !testInput.trim() || testRunning ? 'not-allowed' : 'pointer' }}>
                  {testRunning ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} />}
                  Run
                </button>
              </div>
              {testOutput !== null && (
                <div style={{ padding: '12px 14px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                  {testRunning ? <span style={{ color: 'var(--text3)' }}>Running…</span> : testOutput}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.25)' }}>
            <AlertCircle size={13} color="var(--red)" />
            <span style={{ fontSize: 13, color: 'var(--red)' }}>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: '12px 32px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        {/* Attached file chip */}
        {attachedFile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, maxWidth: 800, margin: '0 auto 8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, background: 'rgba(124,111,240,0.1)', border: '1px solid rgba(124,111,240,0.25)', fontSize: 12, color: 'var(--blue)' }}>
              <Paperclip size={10} /> {attachedFile.name}
              <button onClick={() => setAttachedFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', padding: 0, display: 'flex', marginLeft: 2 }}>
                <X size={10} />
              </button>
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: 800, margin: '0 auto' }}>
          {/* File attach button */}
          <button onClick={() => fileInputRef.current?.click()}
            title="Attach a file for context"
            style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: attachedFile ? 'var(--blue)' : 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Paperclip size={14} />
          </button>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.json,.xml" style={{ display: 'none' }} onChange={handleFileAttach} />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder={editingAgentId ? `Tell me what to change in "${editingAgentName}"…` : 'Describe the agent you want to build…'}
            rows={1}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text)', fontSize: 14, resize: 'none', outline: 'none',
              fontFamily: 'inherit', lineHeight: 1.5, overflowY: 'hidden',
            }}
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || streaming}
            style={{
              width: 42, height: 42, borderRadius: 12, border: 'none', flexShrink: 0,
              background: !input.trim() || streaming ? 'var(--surface2)' : 'var(--blue)',
              color: !input.trim() || streaming ? 'var(--text3)' : '#fff',
              cursor: !input.trim() || streaming ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Send size={15} />
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
          Enter to send · Shift+Enter for new line · Attach .txt .csv .json for context
        </p>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
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
