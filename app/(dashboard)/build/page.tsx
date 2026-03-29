'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Wand2, User, ArrowRight, AlertCircle, Wrench, Table2, CheckCircle, ExternalLink, Loader2 } from 'lucide-react'

interface Model { id: string; name: string; provider: string; model_id: string }
interface Message { role: 'user' | 'assistant'; content: string }
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

const WELCOME = `Hi! I'm your agent design assistant. Describe what you want to build and I'll design the full flow — including any tools (web search, HTTP) and datatables you need — then generate everything in one click.

A few examples:
- "Search the web for AI news daily and summarise it"
- "Classify support emails, auto-reply to simple ones, escalate complex ones for review"
- "Ask me for my spending details, then summarise and log them to a table"
- "Research a competitor, score them, and draft a report — wait for my approval before finishing"

What would you like to build?`

function parseContent(text: string) {
  const parts: { type: 'text' | 'code'; lang: string; value: string }[] = []
  const re = /```(\w*)\n?([\s\S]*?)```/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', lang: '', value: text.slice(last, m.index) })
    parts.push({ type: 'code', lang: m[1] || 'text', value: m[2].trim() })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', lang: '', value: text.slice(last) })
  return parts
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

// Render plain text with basic **bold** support
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

export default function BuildPage() {
  const router = useRouter()
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: WELCOME }])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [importingIdx, setImportingIdx] = useState<number | null>(null)
  const [importSteps, setImportSteps] = useState<ImportStep[]>([])
  const [openingIdx, setOpeningIdx] = useState<number | null>(null)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(d => { if (Array.isArray(d)) setModels(d) }).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setError('')

    const withUser: Message[] = [...messages, { role: 'user', content: text }]
    setMessages([...withUser, { role: 'assistant', content: '' }])
    setStreaming(true)

    let acc = ''
    try {
      const res = await fetch('/api/build-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: withUser,
          modelName: selectedModel || undefined,
        }),
      })
      if (!res.ok || !res.body) throw new Error('Request failed')

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
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      setError(msg)
      setMessages(prev => {
        const u = [...prev]
        if (u[u.length - 1]?.role === 'assistant' && u[u.length - 1].content === '') {
          u.pop() // remove empty assistant placeholder
        }
        return u
      })
    } finally {
      setStreaming(false)
    }
  }

  const importPlan = async (msgIdx: number, plan: BuildPlan) => {
    setImportingIdx(msgIdx)
    setError('')

    const steps: ImportStep[] = [
      ...plan.tools.map(t => ({ label: `Create tool: ${t.name}`, status: 'pending' as const })),
      ...plan.datatables.map(d => ({ label: `Create datatable: ${d.name}`, status: 'pending' as const })),
      { label: `Create agent: ${plan.name}`, status: 'pending' as const },
    ]
    setImportSteps(steps)

    const setStep = (i: number, status: ImportStep['status']) => {
      setImportSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status } : s))
    }

    try {
      let stepIdx = 0

      // 1. Create tools
      for (const tool of plan.tools) {
        setStep(stepIdx, 'active')
        const res = await fetch('/api/tools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tool.name,
            description: tool.description ?? '',
            type: tool.type,
            method: tool.method ?? 'GET',
            endpoint: tool.endpoint ?? '',
            headers: tool.headers ?? {},
            inputSchema: tool.inputSchema ?? {},
            timeout: 10000,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(`Tool "${tool.name}": ${err.error ?? res.status}`)
        }
        setStep(stepIdx, 'done')
        stepIdx++
      }

      // 2. Create datatables — and wire datatable_id into any tools + schema nodes that reference them by name
      const datatableIdMap: Record<string, string> = {}
      for (const dt of plan.datatables) {
        setStep(stepIdx, 'active')
        const res = await fetch('/api/datatables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: dt.name, description: dt.description ?? '', columns: dt.columns }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(`Datatable "${dt.name}": ${err.error ?? res.status}`)
        }
        const created = await res.json() as { id: string }
        datatableIdMap[dt.name] = created.id
        setStep(stepIdx, 'done')
        stepIdx++
      }

      // Patch schema: inject datatable_id into tool nodes whose inputSchema references a datatable by name
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

      // 3. Create agent with patched schema
      setStep(stepIdx, 'active')
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
      setStep(stepIdx, 'done')

      await new Promise(r => setTimeout(r, 600))
      router.push(`/builder/${created.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setImportingIdx(null)
      setImportSteps([])
    }
  }

  const openInBuilder = async (msgIdx: number, plan: BuildPlan) => {
    setOpeningIdx(msgIdx)
    setError('')
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: plan.name, description: plan.description ?? '', schema: plan.schema }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Agent creation failed')
      }
      const created = await res.json() as { id: string }
      router.push(`/builder/${created.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open in builder')
    } finally {
      setOpeningIdx(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding: '20px 32px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #7c6ff0, #b080f8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wand2 size={13} color="white" />
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>Build via Chat</h1>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text2)', paddingLeft: 36 }}>Describe your agent — I&apos;ll design the flow and generate importable JSON</p>
        </div>

        {/* Model picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>Model</span>
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            style={{
              padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border)',
              background: 'var(--surface2)', color: 'var(--text)', fontSize: 12,
              cursor: 'pointer', outline: 'none', minWidth: 170,
            }}
          >
            <option value="">Default (Gemini 2.5 Flash)</option>
            {models.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user'
          const isStreamingThis = streaming && idx === messages.length - 1 && !isUser
          const parts = parseContent(msg.content)

          return (
            <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
              {/* Avatar */}
              <div style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0, marginTop: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isUser ? 'rgba(124,111,240,0.15)' : 'rgba(124,111,240,0.08)',
                border: `1px solid ${isUser ? 'rgba(124,111,240,0.3)' : 'var(--border)'}`,
              }}>
                {isUser
                  ? <User size={13} color="var(--blue)" />
                  : <Wand2 size={13} color="var(--blue)" />
                }
              </div>

              {/* Content */}
              <div style={{ maxWidth: 700, minWidth: 0 }}>
                {/* Empty streaming state */}
                {isStreamingThis && msg.content === '' && (
                  <div style={{ padding: '12px 16px', borderRadius: '4px 14px 14px 14px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: '0.2s' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite', animationDelay: '0.4s' }} />
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
                            <span style={{ display: 'inline-block', width: 2, height: 14, background: 'var(--blue)', marginLeft: 2, verticalAlign: 'text-bottom', opacity: 0.8 }}>▋</span>
                          )}
                        </p>
                      </div>
                    )
                  }

                  // Code block
                  const plan = part.lang === 'json' ? tryExtractPlan(part.value) : null
                  const isImporting = importingIdx === idx

                  return (
                    <div key={pi} style={{ marginBottom: pi < parts.length - 1 ? 8 : 0, borderRadius: 12, border: `1px solid ${plan ? 'rgba(124,111,240,0.4)' : 'var(--border)'}`, overflow: 'hidden', background: 'var(--surface)' }}>
                      {/* Code block header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: plan ? 'rgba(124,111,240,0.08)' : 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {plan && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)' }} />}
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: plan ? 'var(--blue)' : 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {plan ? 'Build Plan — ready to deploy' : (part.lang || 'code')}
                          </span>
                          {plan && (plan.tools.length > 0 || plan.datatables.length > 0) && (
                            <div style={{ display: 'flex', gap: 5 }}>
                              {plan.tools.length > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#22d79a', background: 'rgba(34,215,154,0.1)', border: '1px solid rgba(34,215,154,0.2)', borderRadius: 5, padding: '1px 6px' }}>
                                  <Wrench size={9} /> {plan.tools.length} tool{plan.tools.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {plan.datatables.length > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#f5a020', background: 'rgba(245,160,32,0.1)', border: '1px solid rgba(245,160,32,0.2)', borderRadius: 5, padding: '1px 6px' }}>
                                  <Table2 size={9} /> {plan.datatables.length} datatable{plan.datatables.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {plan && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => openInBuilder(idx, plan)}
                              disabled={isImporting || openingIdx === idx}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '5px 12px', borderRadius: 7,
                                border: '1px solid var(--border)',
                                background: 'var(--surface2)',
                                color: 'var(--text2)',
                                fontSize: 12, fontWeight: 600,
                                cursor: (isImporting || openingIdx === idx) ? 'not-allowed' : 'pointer',
                                opacity: (isImporting || openingIdx === idx) ? 0.6 : 1,
                              }}
                            >
                              {openingIdx === idx
                                ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                : <ExternalLink size={12} />
                              }
                              Open in Builder
                            </button>
                            <button
                              onClick={() => importPlan(idx, plan)}
                              disabled={isImporting || openingIdx === idx}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '5px 12px', borderRadius: 7, border: 'none',
                                background: (isImporting || openingIdx === idx) ? 'var(--surface2)' : 'var(--blue)',
                                color: (isImporting || openingIdx === idx) ? 'var(--text3)' : '#fff',
                                fontSize: 12, fontWeight: 600,
                                cursor: (isImporting || openingIdx === idx) ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <ArrowRight size={12} />
                              {isImporting ? 'Building…' : 'Build it'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Import progress steps */}
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

                      <pre style={{ padding: '14px 18px', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.7, color: 'var(--text2)', overflowX: 'auto', margin: 0, maxHeight: 420, overflowY: 'auto' }}>
                        {part.value}
                      </pre>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Error banner */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.25)' }}>
            <AlertCircle size={13} color="var(--red)" />
            <span style={{ fontSize: 13, color: 'var(--red)' }}>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: '14px 32px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 800, margin: '0 auto' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Describe the agent you want to build…"
            rows={1}
            style={{
              flex: 1, padding: '11px 14px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text)', fontSize: 14, resize: 'none', outline: 'none',
              fontFamily: 'inherit', lineHeight: 1.5, overflowY: 'hidden',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            style={{
              width: 42, height: 42, borderRadius: 12, border: 'none', flexShrink: 0,
              background: !input.trim() || streaming ? 'var(--surface2)' : 'var(--blue)',
              color: !input.trim() || streaming ? 'var(--text3)' : '#fff',
              cursor: !input.trim() || streaming ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <Send size={15} />
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
