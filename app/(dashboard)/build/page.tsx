'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  Send, Wand2, User, ArrowRight, AlertCircle, Wrench, Table2, CheckCircle,
  ExternalLink, Loader2, Plus, Clock, ChevronDown, Trash2, Bot, Paperclip,
  X, Play, ChevronRight, Edit3, GitBranch, Layers, Zap,
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
  builtMsgIdx?: number
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
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>
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

interface BuildPageProps {
  selectedModel?: string
  setSelectedModel?: (m: string) => void
  models?: Model[]
}

function BuildPageInner({ selectedModel: extModel, setSelectedModel: extSetModel, models: extModels }: BuildPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [internalModels, setInternalModels] = useState<Model[]>([])
  const [internalSelectedModel, setInternalSelectedModel] = useState('')
  const [userInitial, setUserInitial] = useState('?')
  const models = extModels ?? internalModels
  const selectedModel = extModel ?? internalSelectedModel
  const setSelectedModel = extSetModel ?? setInternalSelectedModel
  const [sessions, setSessions] = useState<BuildSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [deletedSessionId, setDeletedSessionId] = useState<string | null>(null)
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

  // Per-plan target agent: msgIdx → agentId ('new' = create new)
  const [planTargets, setPlanTargets] = useState<Record<number, string>>({})

  // Existing agents list for target selector
  const [existingAgents, setExistingAgents] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setExistingAgents(d.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })))
    }).catch(() => {})
  }, [])

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
    if (!extModels) {
      fetch('/api/models').then(r => r.json()).then(d => { if (Array.isArray(d)) setInternalModels(d) }).catch(() => {})
    }
    createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) return
      const name: string = u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? ''
      setUserInitial(name.trim()[0]?.toUpperCase() ?? '?')
    })
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

  function saveCurrentSession(msgs: Message[], agentId?: string, agentName?: string, builtMsgIdx?: number) {
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
          ? { ...s, name, messages: msgs, agentId: agentId ?? s.agentId, agentName: agentName ?? s.agentName, builtMsgIdx: builtMsgIdx ?? s.builtMsgIdx, updatedAt: now }
          : s
        )
      } else {
        const newSession: BuildSession = {
          id: crypto.randomUUID(), name, messages: msgs, agentId, agentName, builtMsgIdx, createdAt: now, updatedAt: now,
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
    setBuiltMsgIdx(session.builtMsgIdx ?? null)
    setTestOutput(null)
    setLastPlanMsgIdx(null)
  }

  async function deleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletingSessionId(sessionId)
    // small async tick so spinner renders before synchronous state update
    await new Promise(r => setTimeout(r, 400))
    setDeletingSessionId(null)
    setDeletedSessionId(sessionId)
    setTimeout(() => {
      setDeletedSessionId(null)
      setSessions(prev => {
        const updated = prev.filter(s => s.id !== sessionId)
        saveSessions(updated)
        return updated
      })
      if (currentSessionId === sessionId) startNewSession()
    }, 800)
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

    // Determine target: explicit per-plan selection > editingAgentId > new
    const target = planTargets[msgIdx] ?? (editingAgentId ?? 'new')
    const targetAgentId = target !== 'new' ? target : null

    const steps: ImportStep[] = [
      ...plan.tools.map(t => ({ label: `Create tool: ${t.name}`, status: 'pending' as const })),
      ...plan.datatables.map(d => ({ label: `Create datatable: ${d.name}`, status: 'pending' as const })),
      { label: targetAgentId ? `Update agent: ${plan.name}` : `Create agent: ${plan.name}`, status: 'pending' as const },
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
      if (targetAgentId) {
        // Update existing agent (user selected one from dropdown, or it's the active editing agent)
        const res = await fetch(`/api/agents/${targetAgentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: plan.name, description: plan.description ?? '', schema: patchedSchema }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(err.error ?? `Agent update failed (${res.status})`)
        }
        agentId = targetAgentId
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
      saveCurrentSession(messages, agentId, plan.name, msgIdx)

      setBuiltAgentId(agentId)
      setBuiltAgentName(plan.name)
      setBuiltMsgIdx(msgIdx)
      setImportingIdx(null)

      // Auto-switch to edit mode so subsequent messages modify this agent
      setEditingAgentId(agentId)
      setEditingAgentName(plan.name)
      setEditingAgentSchema(patchedSchema)
      // Also refresh the existing agents list so dropdown shows the new agent
      fetch('/api/agents').then(r => r.json()).then(d => {
        if (Array.isArray(d)) setExistingAgents(d.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })))
      }).catch(() => {})

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
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', fontFamily: 'inherit' }}>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>

        {/* New build — black pill button */}
        <div style={{ padding: '10px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={startNewSession}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, padding: '0 14px', borderRadius: 8, width: '100%',
              border: 'none', cursor: 'pointer',
              background: 'var(--primary)', color: 'var(--primary-fg)',
              fontSize: 13, fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary)' }}
          >
            <Plus size={14} strokeWidth={2} /> Build a new agent
          </button>
        </div>


        {/* Session history */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sessions.length === 0 ? (
            <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--text4)', textAlign: 'center', lineHeight: 1.6 }}>No history yet.<br />Start a new build.</div>
          ) : sessions.map(s => (
            <div key={s.id} onClick={() => loadSession(s)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', background: s.id === currentSessionId ? 'var(--surface2)' : 'transparent', borderBottom: '1px solid var(--border2)', borderLeft: `2px solid ${s.id === currentSessionId ? 'var(--text)' : 'transparent'}`, transition: 'background 0.1s, border-color 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = s.id === currentSessionId ? 'var(--surface2)' : 'transparent')}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{timeAgo(s.updatedAt)}</div>
              </div>
              <button
                onClick={e => deleteSession(s.id, e)}
                disabled={deletingSessionId === s.id || deletedSessionId === s.id}
                style={{
                  width: 22, height: 22, borderRadius: 5, border: 'none', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: deletingSessionId === s.id || deletedSessionId === s.id ? 'default' : 'pointer',
                  background: deletedSessionId === s.id ? 'var(--success-bg)' : 'var(--error-bg)',
                  color: deletedSessionId === s.id ? 'var(--success)' : 'var(--error)',
                  opacity: deletingSessionId === s.id ? 0.6 : 1,
                  transition: 'opacity 0.1s',
                }}
                onMouseEnter={e => { if (!deletingSessionId && !deletedSessionId) e.currentTarget.style.opacity = '0.75' }}
                onMouseLeave={e => { if (!deletingSessionId && !deletedSessionId) e.currentTarget.style.opacity = '1' }}
              >
                {deletingSessionId === s.id
                  ? <Loader2 size={10} style={{ animation: 'spin 0.7s linear infinite' }} />
                  : deletedSessionId === s.id
                  ? <CheckCircle size={10} />
                  : <Trash2 size={10} />
                }
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chat column ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

      {/* ── Scroll area ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 20px 12px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>


          {/* Messages */}
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user'
            const isStreamingThis = streaming && idx === messages.length - 1 && !isUser
            const parts = parseContent(msg.content)
            const isLastAssistant = !isUser && idx === messages.length - 1

            return (
              <div key={idx} style={{ marginBottom: 20, animation: 'fadeUp 0.18s ease-out both' }}>
                {isUser ? (
                  /* User bubble — right aligned with avatar */
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 8 }}>
                    <div style={{ maxWidth: '76%', padding: '10px 15px', borderRadius: '18px 18px 4px 18px', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.content}
                    </div>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--text)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700 }}>
                      {userInitial}
                    </div>
                  </div>
                ) : (
                  /* Assistant — avatar + text */
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <Zap size={12} color="var(--bg)" strokeWidth={2.5} />
                    </div>
                  <div style={{ flex: 1, paddingRight: 8 }}>
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
                        <div key={pi} style={{ marginBottom: 10, borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface)', boxShadow: 'var(--shadow-xs)' }}>
                          {/* Plan toolbar */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {plan && <Layers size={11} color="var(--text3)" />}
                              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                {plan ? (editingAgentId ? 'Updated plan' : 'Build plan') : (part.lang || 'code')}
                              </span>
                            </div>

                            {plan && (
                              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                {builtMsgIdx === idx && builtAgentId ? (
                                  /* This specific plan was built */
                                  <>
                                    <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                                      <CheckCircle size={11} /> Built
                                    </span>
                                    <button onClick={() => router.push(`/builder/${builtAgentId}`)}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                      <ExternalLink size={10} /> Open in Builder
                                    </button>
                                  </>
                                ) : lastPlanMsgIdx === idx ? (
                                  /* This is the LATEST plan and not yet built — show dropdown + apply */
                                  <>
                                    <div style={{ position: 'relative' }}>
                                      <select
                                        value={planTargets[idx] ?? (editingAgentId ?? 'new')}
                                        onChange={e => setPlanTargets(prev => ({ ...prev, [idx]: e.target.value }))}
                                        style={{ fontSize: 11, padding: '4px 22px 4px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text2)', cursor: 'pointer', outline: 'none', appearance: 'none', fontFamily: 'inherit', fontWeight: 500 }}>
                                        <option value="new">New agent</option>
                                        {existingAgents.map(a => (
                                          <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                      </select>
                                      <ChevronDown size={9} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                                    </div>
                                    <button onClick={() => importPlan(idx, plan, planModels[idx] || undefined)}
                                      disabled={isImporting}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 13px', borderRadius: 7, border: 'none', fontSize: 11, fontWeight: 700, cursor: isImporting ? 'default' : 'pointer', background: isImporting ? 'var(--surface2)' : 'var(--primary)', color: isImporting ? 'var(--text3)' : 'var(--primary-fg)', transition: 'background 0.15s' }}>
                                      {isImporting
                                        ? <><span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />Applying…</>
                                        : <><ArrowRight size={11} />{(planTargets[idx] ?? (editingAgentId ?? 'new')) !== 'new' ? 'Apply' : 'Build it'}</>
                                      }
                                    </button>
                                  </>
                                ) : null
                                }
                              </div>
                            )}
                          </div>

                          {/* Import progress */}
                          {isImporting && importSteps.length > 0 && (
                            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {importSteps.map((step, si) => (
                                <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: step.status === 'done' ? 'var(--text2)' : step.status === 'active' ? 'var(--text)' : 'var(--text3)', transition: 'color 0.2s' }}>
                                  {step.status === 'done'
                                    ? <CheckCircle size={11} color="var(--text2)" />
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
                            style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>
                )}
              </div>
            )
          })}


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
      <div style={{ padding: '10px 16px 14px', background: 'var(--bg)', flexShrink: 0 }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>

          {/* Suggestion chips — shown only on fresh chat, just above input */}
          {showStarters && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'nowrap', overflow: 'hidden' }}>
              {[
                'Research a competitor',
                'Classify & route emails',
                'Extract data from emails',
              ].map((label, i) => (
                <button key={i} onClick={() => sendMessage(label)}
                  style={{
                    padding: '5px 12px', borderRadius: 20,
                    border: 'none', background: 'var(--surface)',
                    color: 'var(--text3)', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text3)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {/* File chip */}
          {attachedFile && (
            <div style={{ marginBottom: 7 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 7, background: 'var(--accent-light)', border: '1px solid var(--accent-border)', fontSize: 11, color: 'var(--accent)' }}>
                <Paperclip size={9} /> {attachedFile.name}
                <button onClick={() => setAttachedFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', padding: 0, display: 'flex', opacity: 0.7, marginLeft: 2 }}>
                  <X size={9} />
                </button>
              </span>
            </div>
          )}

          {/* Unified pill input */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '5px 6px 5px 14px', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onFocusCapture={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--accent-border)'; el.style.boxShadow = '0 0 0 3px var(--accent-light)' }}
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
              style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: 'transparent', color: attachedFile ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = attachedFile ? 'var(--accent)' : 'var(--text3)')}
            >
              <Paperclip size={13} />
            </button>
            <button onClick={() => sendMessage()} disabled={!input.trim() || streaming}
              style={{
                width: 34, height: 34, borderRadius: 10, border: 'none', flexShrink: 0,
                background: streaming ? 'var(--surface2)' : input.trim() ? 'var(--primary)' : 'var(--surface2)',
                color: streaming ? 'var(--text3)' : input.trim() ? 'var(--primary-fg)' : 'var(--text4)',
                cursor: input.trim() && !streaming ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s, color 0.15s',
              }}>
              {streaming
                ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }}/>
                : <Send size={13} />
              }
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
    </div>
  )
}

export default function BuildPage(props: BuildPageProps = {}) {
  return (
    <Suspense fallback={<div style={{ padding: 48, color: 'var(--text3)', fontSize: 14 }}>Loading…</div>}>
      <BuildPageInner {...props} />
    </Suspense>
  )
}
