'use client'
import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { Send, Bot, MessageSquare, Trash2, Loader2, ThumbsUp, HelpCircle, AlertCircle, Zap } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface Agent { id: string; name: string; description: string; run_count: number }
interface Message {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
  nudge?: boolean
  welcome?: boolean
  tokens?: number
  latencyMs?: number
  hitl?: { runId: string; partial: unknown; question?: string }
  clarify?: { runId: string; partial: unknown }
}

type RunItem = { id: string; created_at: string; status: string; input: unknown }

interface ChatContentProps {
  onRunHistoryReady?: (history: RunItem[], loadRun: (id: string) => void) => void
}

function ChatContent({ onRunHistoryReady }: ChatContentProps = {}) {
  const searchParams = useSearchParams()
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentSearch, setAgentSearch] = useState('')
  const [runHistory, setRunHistory] = useState<{ id: string; created_at: string; status: string; input: unknown }[]>([])
  // Single input handles both new messages and HITL/Clarify responses
  const [pendingAction, setPendingAction] = useState<{ type: 'hitl' | 'clarify'; runId: string; question?: string } | null>(null)
  const [agentOrchestratorEnabled, setAgentOrchestratorEnabled] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [agentSwitching, setAgentSwitching] = useState(false)
  const [userInitial, setUserInitial] = useState('')
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
        setPendingAction({ type: 'clarify', runId: runIdToLoad, question: runOutput?.question })
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
    createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      const email = data?.user?.email ?? ''
      const name = data?.user?.user_metadata?.full_name ?? ''
      const initial = name ? name[0] : email ? email[0] : 'U'
      setUserInitial(initial.toUpperCase())
    }).catch(() => {})
  }, [])

  const loadRunById = async (runId: string) => {
    if (!runId) return
    setHistoryLoading(true)
    setPendingAction(null)
    setStreamingContent('')
    try {
      const runRes = await fetch(`/api/runs/${runId}`).then(r => r.json()).catch(() => null)
      if (!runRes || runRes.error) return
      const runInput = typeof runRes.input === 'string' ? runRes.input
        : (runRes.input as Record<string, unknown>)?.message ?? JSON.stringify(runRes.input)
      const runOutput = runRes.output as { partial?: unknown; question?: string } | null
      const msgs: Message[] = [{ role: 'user', content: String(runInput) }]
      if (runRes.status === 'waiting_hitl') {
        const partial = runOutput?.partial
        const partialText = typeof partial === 'string' ? partial : partial ? JSON.stringify(partial, null, 2) : 'Agent paused.'
        msgs.push({ role: 'assistant', content: partialText, hitl: { runId, partial } })
        setPendingAction({ type: 'hitl', runId })
      } else if (runRes.status === 'waiting_clarify') {
        const question = String(runOutput?.question ?? 'Could you clarify?')
        msgs.push({ role: 'assistant', content: question, clarify: { runId, partial: runOutput?.partial } })
        setPendingAction({ type: 'clarify', runId, question: runOutput?.question })
      } else if (runRes.output) {
        const outputText = typeof runRes.output === 'string' ? runRes.output : JSON.stringify(runRes.output, null, 2)
        msgs.push({ role: 'assistant', content: outputText, tokens: runRes.tokens ?? undefined, latencyMs: runRes.latency_ms ?? undefined })
      }
      setMessages(msgs)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedAgent) { setRunHistory([]); onRunHistoryReady?.([], loadRunById); return }
    fetch(`/api/runs?agentId=${selectedAgent.id}&limit=10`)
      .then(r => r.json())
      .catch(() => [])
      .then((d: unknown) => {
        const history = Array.isArray(d) ? d : []
        setRunHistory(history)
        onRunHistoryReady?.(history, loadRunById)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, streamingContent])

  // Poll for HITL completion — when reviewer approves from the Runs page,
  // the run status changes to completed and we inject the final output into chat.
  const hitlPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (pendingAction?.type !== 'hitl') {
      if (hitlPollRef.current) { clearInterval(hitlPollRef.current); hitlPollRef.current = null }
      return
    }
    const runId = pendingAction.runId
    hitlPollRef.current = setInterval(async () => {
      try {
        const run = await fetch(`/api/runs/${runId}`).then(r => r.json())
        if (run.status === 'waiting_hitl') return // still waiting
        // Run finished (completed, failed, or another pause)
        clearInterval(hitlPollRef.current!); hitlPollRef.current = null
        setPendingAction(null)
        // Remove the HITL pill from the message that triggered it
        setMessages(prev => prev.map(m => m.hitl?.runId === runId ? { ...m, hitl: undefined } : m))
        if (run.status === 'completed') {
          const output = run.output
          const text = typeof output === 'string' ? output
            : output && typeof output === 'object' && 'rejected' in (output as object)
              ? `Rejected by reviewer. ${(output as { message?: string }).message ?? ''}`
              : JSON.stringify(output, null, 2)
          setMessages(prev => [...prev, {
            role: 'assistant' as const,
            content: text,
            tokens: run.tokens ?? undefined,
            latencyMs: run.latency_ms ?? undefined,
          }])
        } else if (run.status === 'failed') {
          setMessages(prev => [...prev, { role: 'assistant' as const, content: `Run failed: ${run.error ?? 'Unknown error'}`, error: true }])
        }
      } catch { /* network error — keep polling */ }
    }, 5000)
    return () => { if (hitlPollRef.current) { clearInterval(hitlPollRef.current); hitlPollRef.current = null } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction?.type, pendingAction?.runId])

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
    setAgentSwitching(true)
    setTimeout(() => inputRef.current?.focus(), 100)
    // Load orchestrator status for this agent
    fetch(`/api/agents/${agent.id}`)
      .then(r => r.json())
      .then((d: { schema?: { orchestratorConfig?: { enabled?: boolean } } }) => {
        setAgentOrchestratorEnabled(!!d?.schema?.orchestratorConfig?.enabled)
      })
      .catch(() => setAgentOrchestratorEnabled(false))

    // Fetch welcome message from orchestrator (or template fallback)
    fetch(`/api/agents/${agent.id}/welcome`)
      .then(r => r.json())
      .then((d: { welcome?: string }) => {
        if (d.welcome) setMessages([{ role: 'assistant', content: d.welcome, welcome: true }])
      })
      .catch(() => {})
      .finally(() => setAgentSwitching(false))
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
        const question = String(event.question ?? 'Please review before continuing.')
        const partialText = typeof partial === 'string' ? partial
          : partial ? JSON.stringify(partial, null, 2) : ''
        const displayContent = partialText
          ? `${partialText}\n\n---\n**Review required:** ${question}`
          : `**Review required:** ${question}`
        const runId = String(event.runId ?? '')
        setMessages(prev => [...prev, { role: 'assistant', content: displayContent, hitl: { runId, partial, question } }])
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
        setPendingAction({ type: 'clarify', runId, question: event.question as string | undefined })
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
    // HITL is handled by the reviewer from the Runs page — chat cannot approve
    if (pendingAction?.type === 'hitl') return

    if (pendingAction?.type === 'clarify') {
      const { runId, question: pendingQuestion } = pendingAction
      const answer = input.trim()
      if (!answer) return
      setInput('')
      setMessages(prev => [
        ...prev.map(m => m.clarify?.runId === runId ? { ...m, clarify: undefined } : m),
        { role: 'user', content: answer },
      ])
      setLoading(true)

      // Use smart-clarify if orchestrator is enabled — it can handle off-topic replies
      const endpoint = agentOrchestratorEnabled
        ? `/api/runs/${runId}/smart-clarify`
        : `/api/runs/${runId}/clarify`
      const body = agentOrchestratorEnabled
        ? { answer, pendingQuestion: pendingQuestion ?? '' }
        : { answer }

      try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        const data = await res.json().catch(() => ({ error: `Server error: ${res.status}` }))
        // Smart-clarify: orchestrator replied inline, keep clarify paused
        if (data.action === 'reply') {
          setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
          // Re-attach the clarify pending state so next message also goes through orchestrator
          setPendingAction({ type: 'clarify', runId, question: pendingQuestion })
          setLoading(false)
          return
        }
        // Smart-clarify: user said cancel
        if (data.action === 'cancel') {
          setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Run cancelled.' }])
          setPendingAction(null)
          setLoading(false)
          return
        }

        if (!res.ok || data.status === 'failed') {
          setMessages(prev => [...prev, { role: 'assistant', content: data.error ?? 'Failed to resume.', error: true }])
          setPendingAction(null)
        } else if (data.status === 'waiting_clarify') {
          const out = data.output as { question?: string; partial?: unknown } | null
          setMessages(prev => [...prev, { role: 'assistant', content: String(out?.question ?? 'Clarify further?'), clarify: { runId: String(data.runId ?? runId), partial: out?.partial } }])
          setPendingAction({ type: 'clarify', runId: String(data.runId ?? runId), question: (data.output as { question?: string } | null)?.question })
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

  const handleRevise = async () => {
    if (loading || pendingAction?.type !== 'hitl') return
    const { runId } = pendingAction
    const feedback = input.trim()
    setInput('')
    setPendingAction(null)
    setMessages(prev => [
      ...prev.map(m => m.hitl?.runId === runId ? { ...m, hitl: undefined } : m),
      { role: 'user' as const, content: `↩ Revision requested${feedback ? `: "${feedback}"` : ''}` },
    ])
    setLoading(true)
    try {
      const res = await fetch(`/api/runs/${runId}/resume`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revise', feedback: feedback || undefined }),
      })
      const data = await res.json().catch(() => ({ error: `Server error: ${res.status}` }))
      if (!res.ok || data.status === 'failed') {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error ?? 'Revision failed.', error: true }])
      } else if (data.status === 'waiting_hitl') {
        const out = data.output as { partial?: unknown; question?: string } | null
        const q = String(out?.question ?? 'Please review before continuing.')
        const partialText = typeof out?.partial === 'string' ? out.partial : out?.partial ? JSON.stringify(out.partial, null, 2) : ''
        const displayContent = partialText ? `${partialText}\n\n---\n**Review required:** ${q}` : `**Review required:** ${q}`
        setMessages(prev => [...prev, { role: 'assistant', content: displayContent, hitl: { runId: String(data.runId ?? runId), partial: out?.partial, question: q } }])
        setPendingAction({ type: 'hitl', runId: String(data.runId ?? runId) })
      } else {
        const output = typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2)
        setMessages(prev => [...prev, { role: 'assistant', content: output, tokens: data.tokens, latencyMs: data.latencyMs }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error during revision.', error: true }])
    }
    setLoading(false)
  }

  const selectAgentAndClear = (agent: Agent) => {
    setPendingAction(null)
    selectAgent(agent)
  }

  const filteredAgents = agents.filter(a => a.name.toLowerCase().includes(agentSearch.toLowerCase()))

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: 'var(--bg)' }}>

      {/* Left — agent selector */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <input
            value={agentSearch}
            onChange={e => setAgentSearch(e.target.value)}
            placeholder="Search agents…"
            style={{ width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 12, outline: 'none', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {agentsLoading ? (
            <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 52, borderRadius: 8, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i*0.15}s` }} />
              ))}
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
                background: selectedAgent?.id === agent.id ? 'var(--surface2)' : 'transparent',
                cursor: 'pointer', display: 'block',
                borderLeft: selectedAgent?.id === agent.id ? '2px solid var(--text)' : '2px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={13} color={selectedAgent?.id === agent.id ? 'var(--accent)' : 'var(--text3)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: selectedAgent?.id === agent.id ? 'var(--text)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.name}</div>
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
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 0 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {selectedAgent ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={15} color="var(--accent)" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{selectedAgent.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{messages.length} messages this session</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {messages.length > 0 && (
                  <button onClick={() => { setMessages([]); setStreamingContent('') }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>
                    <Trash2 size={11} /> Clear
                  </button>
                )}
              </div>
            </>
          ) : (
            <div />
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 24px 24px' }}>
          {agentSwitching ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--text)', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Loading…</span>
              </div>
            </div>
          ) : !selectedAgent ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={22} color="var(--text3)" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Start a conversation</p>
                <p style={{ fontSize: 13, color: 'var(--text3)' }}>Pick an agent from the left panel</p>
              </div>
            </div>
          ) : historyLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--text)', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>Loading conversation…</span>
              </div>
            </div>
          ) : loading && messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i*0.15}s` }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 14, borderRadius: 6, background: 'var(--surface2)', width: `${60 + i*15}%`, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i*0.15}s` }} />
                    <div style={{ height: 14, borderRadius: 6, background: 'var(--surface2)', width: `${40 + i*10}%`, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i*0.15+0.1}s` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* Welcome card — full-width centered intro, not a chat bubble */}
                  {msg.welcome ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 8px', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bot size={20} color="var(--accent)" />
                      </div>
                      <div style={{ maxWidth: 480, textAlign: 'center', padding: '14px 20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          p: ({ children }) => <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text2)' }}>{children}</p>,
                          strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'var(--text)' }}>{children}</strong>,
                        }}>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                  <div style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <Zap size={12} color="#fff" />
                      </div>
                    )}
                    {msg.role === 'user' && (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{userInitial || 'U'}</span>
                      </div>
                    )}
                    <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: msg.role === 'user' ? 'var(--primary)' : msg.error ? 'rgba(232,85,85,0.08)' : msg.nudge ? 'var(--surface2)' : 'var(--surface)',
                        border: msg.role === 'user' ? 'none' : `1px solid ${msg.error ? 'rgba(232,85,85,0.25)' : msg.nudge ? 'var(--border)' : 'var(--border)'}`,
                        color: msg.role === 'user' ? 'var(--primary-fg)' : msg.error ? 'var(--red)' : msg.nudge ? 'var(--text2)' : 'var(--text)',
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

                  {/* HITL pill — reviewer approves from Runs page, chat polls for completion */}
                  {!msg.welcome && msg.hitl && (
                    <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}>
                      <Loader2 size={12} color="var(--warning)" style={{ animation: 'spin 1.5s linear infinite', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)' }}>Pending reviewer approval</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>A reviewer approves from the Runs page. This chat will update automatically when approved.</div>
                      </div>
                      <Link href="/runs" style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--warning-border)', background: 'var(--bg)', color: 'var(--warning)', fontSize: 11, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Go to Runs
                      </Link>
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming bubble */}
              {loading && streamingContent && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Zap size={12} color="#fff" />
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
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Zap size={12} color="#fff" />
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 2px' }}>
                    {[0, 0.18, 0.36].map((delay, i) => (
                      <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue)', display: 'inline-block', opacity: 0.4, animation: 'agentPulse 1.1s ease-in-out infinite', animationDelay: `${delay}s` }} />
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
          <div style={{ padding: '12px 16px 12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div>
              {/* Context banner for HITL / Clarify mode */}
              {pendingAction?.type === 'hitl' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 8,
                  borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning)',
                }}>
                  <AlertCircle size={13} /> This run is waiting for a reviewer. Approve it from the <Link href="/runs" style={{ color: 'var(--warning)', fontWeight: 700, textDecoration: 'none' }}>Runs page</Link>.
                  <button onClick={() => setPendingAction(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.7, padding: 0, display: 'flex', alignItems: 'center' }} title="Cancel">✕</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    pendingAction?.type === 'hitl' ? 'Waiting for reviewer approval…' :
                    `Message ${selectedAgent.name}…`
                  }
                  readOnly={pendingAction?.type === 'hitl'}
                  rows={1}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 13, outline: 'none',
                    background: 'var(--surface)', border: `1px solid ${pendingAction ? (pendingAction.type === 'hitl' ? 'var(--warning-border)' : 'var(--accent-border)') : 'var(--border)'}`,
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
                <button
                  onClick={handleSend}
                  disabled={pendingAction?.type === 'hitl' || (!input.trim() && !pendingAction) || loading}
                  style={{
                    width: 40, height: 40, borderRadius: 10, border: 'none',
                    background: (input.trim() || pendingAction) && !loading
                      ? (pendingAction?.type === 'hitl' ? 'var(--warning)' : pendingAction?.type === 'clarify' ? 'var(--accent)' : 'var(--blue)')
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
                  ? 'Approve or reject this run from the Runs page'
                  : 'Enter to send · Shift+Enter for new line · Responses stream in real time'}
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
        @keyframes pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 1 } }
        @keyframes agentPulse { 0%, 100% { opacity: 0.25; transform: scale(0.75) } 50% { opacity: 1; transform: scale(1) } }
      `}</style>
    </div>
  )
}

export default function ChatPage(props: ChatContentProps) {
  return (
    <Suspense fallback={
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Loader2 size={18} style={{ color: 'var(--text3)', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
      </div>
    }>
      <ChatContent {...props} />
    </Suspense>
  )
}
