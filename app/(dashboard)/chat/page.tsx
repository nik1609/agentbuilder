'use client'
import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Bot, MessageSquare, Trash2, Loader2, ChevronDown, ThumbsUp, HelpCircle, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Agent { id: string; name: string; description: string; run_count: number }
interface Message {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
  nudge?: boolean
  welcome?: boolean
  tokens?: number
  latencyMs?: number
  hitl?: { runId: string; partial: unknown }
  clarify?: { runId: string; partial: unknown }
}

function ChatContent() {
  const searchParams = useSearchParams()
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentSearch, setAgentSearch] = useState('')
  // Single input handles both new messages and HITL/Clarify responses
  const [pendingAction, setPendingAction] = useState<{ type: 'hitl' | 'clarify'; runId: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const esRef = useRef<EventSource | null>(null)
  // Typewriter queue — incoming tokens are buffered here and drained at a fixed rate
  // so streaming always looks smooth regardless of how fast tokens actually arrive.
  const tokenQueueRef = useRef<string>('')
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const TYPEWRITER_CHARS = 5   // chars revealed per tick
  const TYPEWRITER_MS   = 16  // tick interval (~60fps feel)

  useEffect(() => {
    fetch('/api/agents').then(r => r.text()).then(t => {
      try { const d = JSON.parse(t); setAgents(Array.isArray(d) ? d : []) } catch { setAgents([]) }
      setAgentsLoading(false)
    })
  }, [])

  // Load run context from URL params:
  //   /chat?resumeRunId=xxx&agentId=yyy  — resume a paused run (HITL/Clarify)
  //   /chat?viewRunId=xxx&agentId=yyy    — view a completed run's conversation
  //   /chat?agentId=yyy                  — just auto-select agent
  useEffect(() => {
    const resumeRunId = searchParams.get('resumeRunId')
    const viewRunId = searchParams.get('viewRunId')
    const agentIdParam = searchParams.get('agentId')
    if (!agentIdParam) return

    const runIdToLoad = resumeRunId || viewRunId

    // If only agentId (no run to load), just auto-select the agent
    if (!runIdToLoad) {
      fetch('/api/agents').then(r => r.json()).catch(() => []).then((agentsRes: Agent[]) => {
        const allAgents: Agent[] = Array.isArray(agentsRes) ? agentsRes : []
        setAgents(allAgents)
        setAgentsLoading(false)
        const agent = allAgents.find(a => a.id === agentIdParam)
        if (agent) setSelectedAgent(agent)
      })
      return
    }

    // Fetch agents + run in parallel
    const loadResumeContext = async () => {
      const [agentsRes, runRes] = await Promise.all([
        fetch('/api/agents').then(r => r.json()).catch(() => []),
        fetch(`/api/runs/${runIdToLoad}`).then(r => r.json()).catch(() => null),
      ])

      const allAgents: Agent[] = Array.isArray(agentsRes) ? agentsRes : []
      setAgents(allAgents)
      setAgentsLoading(false)

      if (!runRes || runRes.error) return
      const agent = allAgents.find(a => a.id === agentIdParam)
      if (!agent) return

      setSelectedAgent(agent)

      // Reconstruct conversation: user message + agent partial + HITL/Clarify card
      const runInput = typeof runRes.input === 'string' ? runRes.input
        : (runRes.input as Record<string, unknown>)?.message ?? JSON.stringify(runRes.input)
      const runOutput = runRes.output as { partial?: unknown; question?: string; checkpoint?: string } | null

      const msgs: Message[] = [
        { role: 'user', content: String(runInput) },
      ]

      if (runRes.status === 'waiting_hitl') {
        const partial = runOutput?.partial
        const partialText = typeof partial === 'string' ? partial
          : partial ? JSON.stringify(partial, null, 2) : 'Agent paused — review required.'
        msgs.push({
          role: 'assistant',
          content: partialText,
          hitl: { runId: runIdToLoad, partial },
        })
        setPendingAction({ type: 'hitl', runId: runIdToLoad })
      } else if (runRes.status === 'waiting_clarify') {
        const question = String(runOutput?.question ?? 'Could you clarify?')
        msgs.push({
          role: 'assistant',
          content: question,
          clarify: { runId: runIdToLoad, partial: runOutput?.partial },
        })
        setPendingAction({ type: 'clarify', runId: runIdToLoad })
      } else if (runRes.output) {
        // Completed/failed run — show the output; user can continue the conversation
        const outputText = typeof runRes.output === 'string' ? runRes.output : JSON.stringify(runRes.output, null, 2)
        msgs.push({
          role: 'assistant',
          content: outputText,
          tokens: runRes.tokens ?? undefined,
          latencyMs: runRes.latency_ms ?? undefined,
        })
      }

      setMessages(msgs)
    }

    loadResumeContext()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, streamingContent])

  const selectAgent = (agent: Agent) => {
    // Cancel any in-progress stream + typewriter
    readerRef.current?.cancel().catch(() => {})
    readerRef.current = null
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null }
    tokenQueueRef.current = ''
    esRef.current?.close()
    esRef.current = null
    setSelectedAgent(agent)
    setMessages([])
    setStreamingContent('')
    setInput('')
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
    // Fetch welcome message from orchestrator (or template fallback)
    fetch(`/api/agents/${agent.id}/welcome`)
      .then(r => r.json())
      .then((d: { welcome?: string }) => {
        if (d.welcome) setMessages([{ role: 'assistant', content: d.welcome, welcome: true }])
      })
      .catch(() => {})
  }

  const sendMessage = () => {
    if (!input.trim() || !selectedAgent || loading) return
    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)
    setStreamingContent('')

    // Stop any previous typewriter, reset queue, close previous stream
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null }
    tokenQueueRef.current = ''
    esRef.current?.close()
    esRef.current = null

    // Build compact conversation history for orchestrator context.
    const historyStr = messages.slice(-8)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 150)}`)
      .join(' | ')

    const safeEncode = (s: string) => { try { return encodeURIComponent(s) } catch { return encodeURIComponent(s.replace(/[\uD800-\uDFFF]/g, '')) } }
    const url = `/api/agents/${selectedAgent.id}/run?message=${safeEncode(userMessage)}${historyStr ? `&history=${safeEncode(historyStr)}` : ''}`
    const es = new EventSource(url)
    esRef.current = es
    let accumulated = ''
    // Buffer nudge until after the main response is shown
    let pendingNudge = ''

    // Typewriter: drain the token queue at a controlled rate so streaming always
    // looks smooth — fast bursts slow down, slow trickles display immediately.
    const startTypewriter = () => {
      if (typewriterRef.current) return
      typewriterRef.current = setInterval(() => {
        const q = tokenQueueRef.current
        if (!q.length) return
        const chunk = q.slice(0, TYPEWRITER_CHARS)
        tokenQueueRef.current = q.slice(TYPEWRITER_CHARS)
        setStreamingContent(prev => prev + chunk)
      }, TYPEWRITER_MS)
    }

    const stopTypewriter = () => {
      if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null }
      // Flush anything remaining in the queue immediately
      if (tokenQueueRef.current) {
        setStreamingContent(prev => prev + tokenQueueRef.current)
        tokenQueueRef.current = ''
      }
    }

    const finish = () => {
      stopTypewriter()
      es.close()
      esRef.current = null
    }

    es.onmessage = (e) => {
      let event: Record<string, unknown>
      try { event = JSON.parse(e.data) } catch { return }

      if (event.type === 'token') {
        const tok = String(event.token ?? '')
        accumulated += tok
        tokenQueueRef.current += tok
        startTypewriter()
        return
      }

      if (event.type === 'nudge') {
        // Don't show yet — buffer until after the main response so ordering is correct
        pendingNudge = String(event.message ?? '')
        return
      }

      if (event.type === 'hitl_pause') {
        stopTypewriter()
        setStreamingContent('')
        if (accumulated) {
          setMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
          accumulated = ''
        }
        const partial = event.partial
        const partialText = typeof partial === 'string' ? partial
          : partial ? JSON.stringify(partial, null, 2) : 'Agent paused — waiting for your approval.'
        const runId = String(event.runId ?? '')
        setMessages(prev => [...prev, { role: 'assistant', content: partialText, hitl: { runId, partial } }])
        setPendingAction({ type: 'hitl', runId })
        setLoading(false)
        finish(); return
      }

      if (event.type === 'clarify_pause') {
        stopTypewriter()
        setStreamingContent('')
        if (accumulated) {
          setMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
          accumulated = ''
        }
        const question = String(event.question ?? 'Could you clarify a bit more?')
        const runId = String(event.runId ?? '')
        setMessages(prev => [...prev, { role: 'assistant', content: question, clarify: { runId, partial: event.partial } }])
        setPendingAction({ type: 'clarify', runId })
        setLoading(false)
        finish(); return
      }

      if (event.type === 'done') {
        // Stop typewriter — use accumulated (server truth) for the final message,
        // not whatever the typewriter has displayed so far.
        stopTypewriter()
        setStreamingContent('')
        const output = accumulated || (
          typeof event.output === 'string' ? event.output : JSON.stringify(event.output, null, 2)
        )
        setMessages(prev => [...prev, {
          role: 'assistant', content: output,
          tokens: event.tokens as number ?? undefined,
          latencyMs: event.latencyMs as number ?? undefined,
        }])
        if (event.status === 'failed' && event.error) {
          setMessages(prev => [...prev, { role: 'assistant', content: String(event.error), error: true }])
        }
        // Show nudge AFTER the main response, with a short delay so it reads as a follow-up
        if (pendingNudge) {
          const nudge = pendingNudge
          pendingNudge = ''
          setTimeout(() => {
            setMessages(prev => [...prev, { role: 'assistant', content: nudge, nudge: true }])
          }, 600)
        }
        setLoading(false)
        finish(); return
      }

      if (event.type === 'error') {
        stopTypewriter()
        setStreamingContent('')
        setMessages(prev => [...prev, { role: 'assistant', content: String(event.message ?? 'Something went wrong.'), error: true }])
        setLoading(false)
        finish()
      }
    }

    es.onerror = () => {
      // Only show error if we haven't already finished
      if (esRef.current) {
        setStreamingContent('')
        if (!accumulated) {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.', error: true }])
        }
        setLoading(false)
        finish()
      }
    }
  }

  // Unified send: routes to the right action based on pendingAction state
  const handleSend = async () => {
    if (loading) return
    if (pendingAction?.type === 'hitl') {
      const { runId } = pendingAction
      const feedback = input.trim() || undefined
      setInput('')
      setPendingAction(null)
      setMessages(prev => [
        ...prev.map(m => m.hitl?.runId === runId ? { ...m, hitl: undefined } : m),
        ...(feedback ? [{ role: 'user' as const, content: `✓ Approved${feedback ? `: "${feedback}"` : ''}` }] : []),
      ])
      setLoading(true)
      try {
        const res = await fetch(`/api/runs/${runId}/resume`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: true, feedback }) })
        const data = await res.json().catch(() => ({ error: `Server error: ${res.status}` }))
        if (!res.ok || data.status === 'failed') {
          setMessages(prev => [...prev, { role: 'assistant', content: data.error ?? 'Resume failed.', error: true }])
        } else if (data.status === 'waiting_hitl') {
          const out = data.output as { partial?: unknown } | null
          const text = typeof out?.partial === 'string' ? out.partial : out?.partial ? JSON.stringify(out.partial, null, 2) : 'Paused again.'
          setMessages(prev => [...prev, { role: 'assistant', content: text, hitl: { runId: String(data.runId ?? runId), partial: out?.partial } }])
          setPendingAction({ type: 'hitl', runId: String(data.runId ?? runId) })
        } else if (data.status === 'waiting_clarify') {
          const out = data.output as { question?: string; partial?: unknown } | null
          setMessages(prev => [...prev, { role: 'assistant', content: String(out?.question ?? 'Clarify?'), clarify: { runId: String(data.runId ?? runId), partial: out?.partial } }])
          setPendingAction({ type: 'clarify', runId: String(data.runId ?? runId) })
        } else {
          const output = typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2)
          setMessages(prev => [...prev, { role: 'assistant', content: output, tokens: data.tokens, latencyMs: data.latencyMs }])
        }
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Network error during resume.', error: true }])
      }
      setLoading(false)
      return
    }

    if (pendingAction?.type === 'clarify') {
      const { runId } = pendingAction
      const answer = input.trim()
      if (!answer) return
      setInput('')
      setPendingAction(null)
      setMessages(prev => [
        ...prev.map(m => m.clarify?.runId === runId ? { ...m, clarify: undefined } : m),
        { role: 'user', content: answer },
      ])
      setLoading(true)
      try {
        const res = await fetch(`/api/runs/${runId}/clarify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer }) })
        const data = await res.json().catch(() => ({ error: `Server error: ${res.status}` }))
        if (!res.ok || data.status === 'failed') {
          setMessages(prev => [...prev, { role: 'assistant', content: data.error ?? 'Failed to resume.', error: true }])
        } else if (data.status === 'waiting_clarify') {
          const out = data.output as { question?: string; partial?: unknown } | null
          setMessages(prev => [...prev, { role: 'assistant', content: String(out?.question ?? 'Clarify further?'), clarify: { runId: String(data.runId ?? runId), partial: out?.partial } }])
          setPendingAction({ type: 'clarify', runId: String(data.runId ?? runId) })
        } else if (data.status === 'waiting_hitl') {
          const out = data.output as { partial?: unknown } | null
          const text = typeof out?.partial === 'string' ? out.partial : out?.partial ? JSON.stringify(out.partial, null, 2) : 'Paused.'
          setMessages(prev => [...prev, { role: 'assistant', content: text, hitl: { runId: String(data.runId ?? runId), partial: out?.partial } }])
          setPendingAction({ type: 'hitl', runId: String(data.runId ?? runId) })
        } else {
          const output = typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2)
          setMessages(prev => [...prev, { role: 'assistant', content: output, tokens: data.tokens, latencyMs: data.latencyMs }])
        }
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Network error.', error: true }])
      }
      setLoading(false)
      return
    }

    // Normal new message
    sendMessage()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleReject = async () => {
    if (loading || pendingAction?.type !== 'hitl') return
    const { runId } = pendingAction
    const feedback = input.trim() || undefined
    setInput('')
    setPendingAction(null)
    setMessages(prev => [
      ...prev.map(m => m.hitl?.runId === runId ? { ...m, hitl: undefined } : m),
      { role: 'user' as const, content: `✗ Rejected${feedback ? `: "${feedback}"` : ''}` },
    ])
    setLoading(true)
    try {
      const res = await fetch(`/api/runs/${runId}/resume`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: false, feedback }) })
      const data = await res.json().catch(() => ({ error: `Server error: ${res.status}` }))
      const output = typeof data.output === 'string' ? data.output
        : (data.output as { message?: string } | null)?.message ?? data.error ?? 'Rejected.'
      setMessages(prev => [...prev, { role: 'assistant', content: output }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error during reject.', error: true }])
    }
    setLoading(false)
  }

  const selectAgentAndClear = (agent: Agent) => {
    setPendingAction(null)
    selectAgent(agent)
  }

  const filteredAgents = agents.filter(a => a.name.toLowerCase().includes(agentSearch.toLowerCase()))

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>

      {/* Left — agent selector */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Select Agent</div>
          <input
            value={agentSearch}
            onChange={e => setAgentSearch(e.target.value)}
            placeholder="Search agents…"
            style={{ width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 12, outline: 'none', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {agentsLoading ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Loader2 size={18} style={{ color: 'var(--text3)', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            </div>
          ) : filteredAgents.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <Bot size={24} style={{ color: 'var(--text3)', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>{agentSearch ? 'No agents match' : 'No agents yet'}</p>
            </div>
          ) : filteredAgents.map(agent => (
            <button
              key={agent.id}
              onClick={() => selectAgentAndClear(agent)}
              style={{
                width: '100%', textAlign: 'left', padding: '12px 16px',
                borderBottom: '1px solid var(--border2)', border: 'none',
                background: selectedAgent?.id === agent.id ? 'rgba(124,111,240,0.1)' : 'transparent',
                cursor: 'pointer', display: 'block',
                borderLeft: selectedAgent?.id === agent.id ? '2px solid var(--blue)' : '2px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: selectedAgent?.id === agent.id ? 'rgba(124,111,240,0.15)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={13} color={selectedAgent?.id === agent.id ? 'var(--blue)' : 'var(--text3)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: selectedAgent?.id === agent.id ? 'var(--blue)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{agent.run_count} runs</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right — chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {selectedAgent ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(124,111,240,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={15} color="var(--blue)" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{selectedAgent.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{messages.length} messages this session</div>
                </div>
              </div>
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setStreamingContent('') }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>
                  <Trash2 size={11} /> Clear
                </button>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={16} color="var(--text3)" />
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>Select an agent to start chatting</span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {!selectedAgent ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(124,111,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={24} color="var(--blue)" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Start a conversation</p>
                <p style={{ fontSize: 13, color: 'var(--text3)' }}>Pick an agent from the left panel</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 12 }}>
                <ChevronDown size={14} style={{ transform: 'rotate(90deg)' }} /> Select an agent
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760, margin: '0 auto' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* Welcome card — full-width centered intro, not a chat bubble */}
                  {msg.welcome ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 8px', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(124,111,240,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bot size={20} color="var(--blue)" />
                      </div>
                      <div style={{ maxWidth: 480, textAlign: 'center', padding: '14px 20px', borderRadius: 12, background: 'rgba(124,111,240,0.06)', border: '1px solid rgba(124,111,240,0.18)' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          p: ({ children }) => <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text2)' }}>{children}</p>,
                          strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'var(--text)' }}>{children}</strong>,
                        }}>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                  <div style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(124,111,240,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <Bot size={14} color="var(--blue)" />
                      </div>
                    )}
                    <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: msg.role === 'user' ? 'var(--blue)' : msg.error ? 'rgba(232,85,85,0.08)' : msg.nudge ? 'rgba(124,111,240,0.05)' : 'var(--surface)',
                        border: msg.role === 'user' ? 'none' : `1px solid ${msg.error ? 'rgba(232,85,85,0.25)' : msg.nudge ? 'rgba(124,111,240,0.2)' : 'var(--border)'}`,
                        color: msg.role === 'user' ? '#fff' : msg.error ? 'var(--red)' : msg.nudge ? 'var(--text2)' : 'var(--text)',
                        fontSize: msg.nudge ? 12 : 13, lineHeight: 1.6, wordBreak: 'break-word',
                        fontStyle: msg.nudge ? 'italic' : 'normal',
                      }}>
                        {msg.role === 'user' ? (
                          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                            p: ({ children }) => <p style={{ margin: '0 0 8px', lineHeight: 1.6 }}>{children}</p>,
                            h1: ({ children }) => <h1 style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 6px', color: 'var(--text)' }}>{children}</h1>,
                            h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 700, margin: '12px 0 5px', color: 'var(--text)' }}>{children}</h2>,
                            h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 700, margin: '10px 0 4px', color: 'var(--text)' }}>{children}</h3>,
                            strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'var(--text)' }}>{children}</strong>,
                            em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                            ul: ({ children }) => <ul style={{ margin: '4px 0 8px', paddingLeft: 20, listStyleType: 'disc' }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ margin: '4px 0 8px', paddingLeft: 20 }}>{children}</ol>,
                            li: ({ children }) => <li style={{ margin: '2px 0', lineHeight: 1.5 }}>{children}</li>,
                            code: ({ children, className }) => className
                              ? <pre style={{ margin: '8px 0', padding: '10px 12px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 11, fontFamily: 'monospace', lineHeight: 1.6, overflowX: 'auto' }}><code>{children}</code></pre>
                              : <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--bg)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border2)' }}>{children}</code>,
                            blockquote: ({ children }) => <blockquote style={{ margin: '8px 0', paddingLeft: 12, borderLeft: '3px solid var(--border)', color: 'var(--text2)', fontStyle: 'italic' }}>{children}</blockquote>,
                            hr: () => <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid var(--border)' }} />,
                            table: ({ children }) => <div style={{ overflowX: 'auto', margin: '8px 0' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>{children}</table></div>,
                            th: ({ children }) => <th style={{ padding: '6px 10px', borderBottom: '2px solid var(--border)', textAlign: 'left', fontWeight: 700, color: 'var(--text2)' }}>{children}</th>,
                            td: ({ children }) => <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border2)', color: 'var(--text)' }}>{children}</td>,
                          }}>{msg.content}</ReactMarkdown>
                        )}
                      </div>
                      {msg.role === 'assistant' && !msg.error && !msg.hitl && (msg.tokens || msg.latencyMs) && (
                        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', paddingLeft: 4 }}>
                          {msg.tokens ? `${msg.tokens} tokens` : ''}{msg.tokens && msg.latencyMs ? ' · ' : ''}{msg.latencyMs ? `${msg.latencyMs}ms` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  )} {/* end welcome ternary */}
                  {/* Clarify pill — no inline input, handled by bottom bar */}
                  {!msg.welcome && msg.clarify && (
                    <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.3)' }}>
                      <HelpCircle size={11} color="#f472b6" />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#f472b6' }}>Reply below to answer</span>
                    </div>
                  )}

                  {/* HITL pill — no inline input, handled by bottom bar */}
                  {!msg.welcome && msg.hitl && (
                    <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'rgba(176,128,248,0.1)', border: '1px solid rgba(176,128,248,0.3)' }}>
                      <ThumbsUp size={11} color="#b080f8" />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#b080f8' }}>Add notes below then send to approve</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming bubble */}
              {loading && streamingContent && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(124,111,240,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Bot size={14} color="var(--blue)" />
                  </div>
                  <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, lineHeight: 1.6, wordBreak: 'break-word' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                      p: ({ children }) => <p style={{ margin: '0 0 8px', lineHeight: 1.6, display: 'inline' }}>{children}</p>,
                      h1: ({ children }) => <h1 style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 6px' }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 700, margin: '12px 0 5px' }}>{children}</h2>,
                      h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 700, margin: '10px 0 4px' }}>{children}</h3>,
                      strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                      ul: ({ children }) => <ul style={{ margin: '4px 0 8px', paddingLeft: 20, listStyleType: 'disc' }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ margin: '4px 0 8px', paddingLeft: 20 }}>{children}</ol>,
                      li: ({ children }) => <li style={{ margin: '2px 0', lineHeight: 1.5 }}>{children}</li>,
                      code: ({ children }) => <code style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>{children}</code>,
                    }}>{streamingContent}</ReactMarkdown>
                    <span style={{ display: 'inline-block', width: 2, height: 13, background: 'var(--blue)', marginLeft: 1, verticalAlign: 'text-bottom', animation: 'blink 0.9s step-end infinite' }} />
                  </div>
                </div>
              )}

              {/* Dots while waiting for first token */}
              {loading && !streamingContent && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(124,111,240,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Bot size={14} color="var(--blue)" />
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: '14px 14px 14px 4px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', gap: 5, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', opacity: 0.5, animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {selectedAgent && (
          <div style={{ padding: '12px 24px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              {/* Context banner for HITL / Clarify mode */}
              {pendingAction && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 8,
                  borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: pendingAction.type === 'hitl' ? 'rgba(245,160,32,0.1)' : 'rgba(244,114,182,0.1)',
                  border: `1px solid ${pendingAction.type === 'hitl' ? 'rgba(245,160,32,0.3)' : 'rgba(244,114,182,0.3)'}`,
                  color: pendingAction.type === 'hitl' ? '#f5a020' : '#f472b6',
                }}>
                  {pendingAction.type === 'hitl'
                    ? <><AlertCircle size={13} /> Approval mode — type optional notes then press Send to approve</>
                    : <><HelpCircle size={13} /> Clarify mode — type your answer and press Send</>}
                  <button
                    onClick={() => setPendingAction(null)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.7, padding: 0, display: 'flex', alignItems: 'center' }}
                    title="Cancel"
                  >✕</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    pendingAction?.type === 'hitl' ? 'Optional notes before approving…' :
                    pendingAction?.type === 'clarify' ? 'Type your answer…' :
                    `Message ${selectedAgent.name}…`
                  }
                  rows={1}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 13, outline: 'none',
                    background: 'var(--surface)', border: `1px solid ${pendingAction ? (pendingAction.type === 'hitl' ? 'rgba(245,160,32,0.4)' : 'rgba(244,114,182,0.4)') : 'var(--border)'}`,
                    color: 'var(--text)',
                    fontFamily: 'inherit', resize: 'none', lineHeight: 1.5, maxHeight: 160, overflowY: 'auto',
                    transition: 'border-color 0.15s',
                  }}
                  onInput={e => {
                    const t = e.target as HTMLTextAreaElement
                    t.style.height = 'auto'
                    t.style.height = Math.min(t.scrollHeight, 160) + 'px'
                  }}
                />
                {pendingAction?.type === 'hitl' && (
                  <button
                    onClick={handleReject}
                    disabled={loading}
                    title="Reject — stop the workflow"
                    style={{
                      height: 40, padding: '0 14px', borderRadius: 10, flexShrink: 0,
                      background: 'rgba(232,85,85,0.12)', border: '1px solid rgba(232,85,85,0.3)',
                      color: 'var(--red)', fontSize: 12, fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    Reject
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !pendingAction) || loading}
                  style={{
                    width: 40, height: 40, borderRadius: 10, border: 'none',
                    background: (input.trim() || pendingAction) && !loading
                      ? (pendingAction?.type === 'hitl' ? '#f5a020' : pendingAction?.type === 'clarify' ? '#f472b6' : 'var(--blue)')
                      : 'var(--surface2)',
                    color: (input.trim() || pendingAction) && !loading ? '#fff' : 'var(--text3)',
                    cursor: (input.trim() || pendingAction) && !loading ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                >
                  {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
                </button>
              </div>
              <p style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 8 }}>
                {pendingAction?.type === 'hitl'
                  ? 'Send to approve · Reject to stop the workflow'
                  : pendingAction?.type === 'clarify'
                  ? 'Send to answer the agent\'s question'
                  : 'Enter to send · Shift+Enter for new line · Responses stream in real time'}
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0) } 40% { transform: translateY(-6px) } }
        @keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Loader2 size={18} style={{ color: 'var(--text3)', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}
