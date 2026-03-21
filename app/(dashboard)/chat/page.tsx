'use client'
import { useState, useEffect, useRef } from 'react'
import { Send, Bot, MessageSquare, Trash2, Loader2, ChevronDown, ThumbsUp, Send as SendIcon } from 'lucide-react'

interface Agent { id: string; name: string; description: string; run_count: number }
interface Message {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
  tokens?: number
  latencyMs?: number
  hitl?: { runId: string; partial: unknown }  // HITL checkpoint waiting for approval
}

export default function ChatPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentSearch, setAgentSearch] = useState('')
  const [hitlFeedback, setHitlFeedback] = useState<Record<string, string>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(d => {
      setAgents(Array.isArray(d) ? d : [])
      setAgentsLoading(false)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const selectAgent = (agent: Agent) => {
    setSelectedAgent(agent)
    setMessages([])
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = async () => {
    if (!input.trim() || !selectedAgent || loading) return
    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AgentHub-Key': 'test' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()

      if (!res.ok || data.status === 'failed') {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error ?? 'Something went wrong. Please try again.', error: true }])
      } else if (data.status === 'waiting_hitl') {
        const partial = (data.output as Record<string, unknown>)?.partial
        const partialText = typeof partial === 'string' ? partial : JSON.stringify(partial, null, 2)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: partialText ?? 'Agent paused — waiting for your approval.',
          hitl: { runId: data.runId, partial },
        }])
      } else {
        const output = typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2)
        setMessages(prev => [...prev, { role: 'assistant', content: output, tokens: data.tokens, latencyMs: data.latencyMs }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Please try again.', error: true }])
    }
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const resumeHitl = async (runId: string, feedback?: string) => {
    setLoading(true)
    // Mark that HITL message is resolved
    setMessages(prev => prev.map(m => m.hitl?.runId === runId ? { ...m, hitl: undefined, content: m.content + '\n\n✓ Approved' + (feedback ? ` with notes: "${feedback}"` : '') } : m))
    try {
      const res = await fetch(`/api/runs/${runId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback?.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok || data.status === 'failed') {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error ?? 'Resume failed.', error: true }])
      } else {
        const output = typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2)
        setMessages(prev => [...prev, { role: 'assistant', content: output, tokens: data.tokens, latencyMs: data.latencyMs }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error during resume.', error: true }])
    }
    setLoading(false)
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
              onClick={() => selectAgent(agent)}
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
                <button onClick={() => setMessages([])} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>
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
          ) : messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(124,111,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={22} color="var(--blue)" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{selectedAgent.name}</p>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>Send a message to begin</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760, margin: '0 auto' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(124,111,240,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <Bot size={14} color="var(--blue)" />
                      </div>
                    )}
                    <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: msg.role === 'user' ? 'var(--blue)' : msg.error ? 'rgba(232,85,85,0.08)' : 'var(--surface)',
                        border: msg.role === 'user' ? 'none' : `1px solid ${msg.error ? 'rgba(232,85,85,0.25)' : 'var(--border)'}`,
                        color: msg.role === 'user' ? '#fff' : msg.error ? 'var(--red)' : 'var(--text)',
                        fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                      {msg.role === 'assistant' && !msg.error && !msg.hitl && (msg.tokens || msg.latencyMs) && (
                        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', paddingLeft: 4 }}>
                          {msg.tokens ? `${msg.tokens} tokens` : ''}{msg.tokens && msg.latencyMs ? ' · ' : ''}{msg.latencyMs ? `${msg.latencyMs}ms` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* HITL card — full width, outside the bubble */}
                  {msg.hitl && (
                    <div style={{ marginTop: 10, padding: '16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid rgba(176,128,248,0.35)', display: 'flex', flexDirection: 'column', gap: 12, width: '100%', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(176,128,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <ThumbsUp size={11} color="#b080f8" />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#b080f8' }}>Approval required to continue</span>
                      </div>
                      <textarea
                        value={hitlFeedback[msg.hitl.runId] ?? ''}
                        onChange={e => setHitlFeedback(prev => ({ ...prev, [msg.hitl!.runId]: e.target.value }))}
                        placeholder="Optional: add notes or feedback before approving…"
                        rows={2}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12, outline: 'none', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => resumeHitl(msg.hitl!.runId, hitlFeedback[msg.hitl!.runId])}
                          disabled={loading}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 8, background: 'var(--green)', color: '#0a0a12', border: 'none', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                          <ThumbsUp size={12} /> Approve & Continue
                        </button>
                        <button
                          onClick={() => { const fb = hitlFeedback[msg.hitl!.runId]; if (!fb?.trim()) return; resumeHitl(msg.hitl!.runId, fb) }}
                          disabled={loading || !hitlFeedback[msg.hitl.runId]?.trim()}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 8, background: 'rgba(176,128,248,0.15)', color: '#b080f8', border: '1px solid rgba(176,128,248,0.3)', fontSize: 12, fontWeight: 700, cursor: (loading || !hitlFeedback[msg.hitl.runId]?.trim()) ? 'not-allowed' : 'pointer', opacity: !hitlFeedback[msg.hitl.runId]?.trim() ? 0.4 : loading ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                          <SendIcon size={12} /> Send Feedback
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
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
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${selectedAgent.name}…`}
                rows={1}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 13, outline: 'none',
                  background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
                  fontFamily: 'inherit', resize: 'none', lineHeight: 1.5, maxHeight: 160, overflowY: 'auto',
                }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 160) + 'px'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  width: 40, height: 40, borderRadius: 10, border: 'none',
                  background: input.trim() && !loading ? 'var(--blue)' : 'var(--surface2)',
                  color: input.trim() && !loading ? '#fff' : 'var(--text3)',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
              </button>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 8 }}>
              Enter to send · Shift+Enter for new line · Conversation history sent automatically
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0) } 40% { transform: translateY(-6px) } }
      `}</style>
    </div>
  )
}
