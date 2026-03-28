'use client'
import { useState, useEffect, useCallback, use, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Save, Play, Copy, CheckCircle, Loader2, ChevronLeft, ChevronRight, ChevronDown, UserCheck, HelpCircle, Send, X, Download, Upload, Bot, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import TracePanel from '@/components/canvas/TracePanel'
import ConfigStudio from '@/components/config/ConfigStudio'
import { AgentNode, AgentEdge, TraceEvent } from '@/types/agent'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Link from 'next/link'

const AgentCanvas = dynamic(() => import('@/components/canvas/AgentCanvas'), { ssr: false })

interface RunResult {
  runId: string
  output: unknown; tokens: number; latencyMs: number
  status: 'completed' | 'failed' | 'waiting_hitl' | 'waiting_clarify'
  trace: TraceEvent[]; error?: string
}

export default function BuilderPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params)
  const isNew = agentId === 'new'

  const [agentName, setAgentName] = useState('Untitled Agent')
  const [schema, setSchema] = useState<{ nodes: AgentNode[]; edges: AgentEdge[]; [key: string]: unknown }>({ nodes: [], edges: [] })
  const [schemaReady, setSchemaReady] = useState(isNew)
  const [saving, setSaving] = useState(false)
  const [savedAgentId, setSavedAgentId] = useState<string | null>(isNew ? null : agentId)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [apiKey, setApiKey] = useState('')
  const [testMessage, setTestMessage] = useState('Hello! What can you help me with?')
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'completed' | 'failed' | 'waiting_hitl' | 'waiting_clarify'>('idle')
  const [trace, setTrace] = useState<TraceEvent[]>([])
  const [copied, setCopied] = useState(false)
  const [studioOpen, setStudioOpen] = useState(true)
  const [pendingAction, setPendingAction] = useState<{ type: 'hitl' | 'clarify'; runId: string } | null>(null)
  const [actionResuming, setActionResuming] = useState(false)
  const [resultDismissed, setResultDismissed] = useState(false)
  const [streamingOutput, setStreamingOutput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string; error?: boolean; tokens?: number; latencyMs?: number; hitl?: boolean; clarify?: boolean }[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const schemaRef = useRef(schema)
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [curlOpen, setCurlOpen] = useState(false)
  const [snippetLang, setSnippetLang] = useState<'curl' | 'python' | 'javascript'>('curl')
  const [openSnippets, setOpenSnippets] = useState<Set<string>>(new Set())
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)
  const [canvasKey, setCanvasKey] = useState(0)
  schemaRef.current = schema

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/agents/${agentId}`).then(r => r.text()).then(t => {
        try { const data = JSON.parse(t); if (data?.name) setAgentName(data.name); if (data?.schema) setSchema(data.schema) } catch { /* ignore */ }
        setSchemaReady(true)
      })
    }
  }, [agentId, isNew])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, streamingOutput])

  const saveAgent = useCallback(async (): Promise<string | null> => {
    if (!agentName.trim()) return savedAgentId
    setSaving(true)
    setSaveStatus('idle')
    try {
      const method = savedAgentId ? 'PATCH' : 'POST'
      const url = savedAgentId ? `/api/agents/${savedAgentId}` : '/api/agents'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: agentName.trim(), schema }),
      })
      const t = await res.text()
      const data = (() => { try { return JSON.parse(t) } catch { return {} } })()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      const newId = data.id ?? savedAgentId
      if (!savedAgentId && newId) setSavedAgentId(newId)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      setSaving(false)
      return newId
    } catch {
      setSaveStatus('error')
      setSaving(false)
      return savedAgentId
    }
  }, [savedAgentId, agentName, schema])

  // Auto-save on schema changes
  useEffect(() => {
    if (!savedAgentId && isNew) return
    if (schema.nodes.length === 0) return
    const t = setTimeout(saveAgent, 1500)
    return () => clearTimeout(t)
  }, [schema]) // eslint-disable-line react-hooks/exhaustive-deps

  const runAgent = useCallback(async () => {
    const id = savedAgentId ?? await saveAgent()
    if (!id) return

    setRunning(true)
    setRunStatus('running')
    setTrace([])
    setRunResult(null)
    setResultDismissed(false)
    setPendingAction(null)
    setStreamingOutput('')

    // Append user message to chat thread
    setChatMessages(prev => [...prev, { role: 'user', content: testMessage }])

    let currentRunId = ''

    try {
      // Build compact history for orchestrator context
      const historyStr = chatMessages.slice(-8)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 150)}`)
        .join(' | ')
      const url = `/api/agents/${id}/run?message=${encodeURIComponent(testMessage)}${historyStr ? `&history=${encodeURIComponent(historyStr)}` : ''}`
      const response = await fetch(url, { headers: { 'X-AgentHub-Key': apiKey || 'test' } })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let done = false

      while (!done) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'start') { currentRunId = event.runId ?? '' }
            if (event.type === 'trace') { setTrace(prev => [...prev, event.event]) }
            if (event.type === 'token') { setStreamingOutput(prev => prev + event.token) }
            if (event.type === 'hitl_pause') {
              const runId = event.runId ?? currentRunId
              const checkpointId = event.checkpoint as string | undefined
              const hitlNode = schemaRef.current.nodes.find(n => n.id === checkpointId)
              const question = String((hitlNode?.data as Record<string, unknown>)?.question || 'Please review and approve to continue.')
              const partial = event.partial
              let content = question
              if (partial) {
                const partialText = typeof partial === 'string' ? partial : JSON.stringify(partial, null, 2)
                content = question + '\n\n**Output to review:**\n' + partialText
              }
              setRunResult({ runId, output: { checkpoint: event.checkpoint, partial: event.partial, message: event.message }, tokens: 0, latencyMs: 0, status: 'waiting_hitl', trace: [] })
              setRunStatus('waiting_hitl')
              setChatMessages(prev => [...prev, { role: 'assistant', content, hitl: true }])
              setPendingAction({ type: 'hitl', runId })
              setStreamingOutput('')
              setRunning(false)
              done = true; break
            }
            if (event.type === 'clarify_pause') {
              const runId = event.runId ?? currentRunId
              const question = String(event.question ?? 'Could you clarify a bit more?')
              setRunResult({ runId, output: { question: event.question, checkpoint: event.checkpoint, partial: event.partial }, tokens: 0, latencyMs: 0, status: 'waiting_clarify', trace: [] })
              setRunStatus('waiting_clarify')
              setChatMessages(prev => [...prev, { role: 'assistant', content: question, clarify: true }])
              setPendingAction({ type: 'clarify', runId })
              setStreamingOutput('')
              setRunning(false)
              done = true; break
            }
            if (event.type === 'done') {
              setRunResult({ runId: event.runId ?? currentRunId, output: event.output, tokens: event.tokens ?? 0, latencyMs: event.latencyMs ?? 0, status: event.status ?? 'completed', trace: [], error: event.error ?? undefined })
              setRunStatus(event.status ?? 'completed')
              const outText = typeof event.output === 'string' ? event.output : JSON.stringify(event.output, null, 2)
              setChatMessages(prev => [...prev, { role: 'assistant', content: outText, error: event.status === 'failed', tokens: event.tokens ?? undefined, latencyMs: event.latencyMs ?? undefined }])
              setStreamingOutput('')
              setRunning(false)
              done = true; break
            }
            if (event.type === 'error') {
              setRunResult({ runId: currentRunId, output: null, tokens: 0, latencyMs: 0, status: 'failed', error: event.message, trace: [] })
              setRunStatus('failed')
              setChatMessages(prev => [...prev, { role: 'assistant', content: String(event.message ?? 'Something went wrong.'), error: true }])
              setStreamingOutput('')
              setRunning(false)
              done = true; break
            }
          } catch { /* malformed SSE line */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setRunResult({ runId: '', output: null, tokens: 0, latencyMs: 0, status: 'failed', error: msg, trace: [] })
      setRunStatus('failed')
      setChatMessages(prev => [...prev, { role: 'assistant', content: msg, error: true }])
      setStreamingOutput('')
      setRunning(false)
    }
  }, [savedAgentId, apiKey, testMessage, chatMessages, saveAgent])

  const handlePendingSend = useCallback(async (input: string) => {
    if (!pendingAction || actionResuming) return
    const { type, runId } = pendingAction
    setActionResuming(true)
    setPendingAction(null)

    if (type === 'hitl') {
      const approved = true
      const feedback = input.trim() || undefined
      setChatMessages(prev => [...prev, { role: 'user', content: `✓ Approved${feedback ? `: "${feedback}"` : ''}` }])
      const res = await fetch(`/api/runs/${runId}/resume`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved, feedback }) })
      const data = await res.json().catch(() => ({ status: 'failed', error: `Server error ${res.status}` }))
      _handleResumeResult(data, res.ok)
    } else {
      const answer = input.trim()
      if (!answer) { setActionResuming(false); setPendingAction({ type, runId }); return }
      setChatMessages(prev => [...prev, { role: 'user', content: answer }])
      const res = await fetch(`/api/runs/${runId}/clarify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer }) })
      const data = await res.json().catch(() => ({ status: 'failed', error: `Server error ${res.status}` }))
      _handleResumeResult(data, res.ok)
    }
    setActionResuming(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction, actionResuming])

  const handlePendingReject = useCallback(async (input: string) => {
    if (!pendingAction || pendingAction.type !== 'hitl' || actionResuming) return
    const { runId } = pendingAction
    setActionResuming(true)
    setPendingAction(null)
    const feedback = input.trim() || undefined
    setChatMessages(prev => [...prev, { role: 'user', content: `✗ Rejected${feedback ? `: "${feedback}"` : ''}` }])
    const res = await fetch(`/api/runs/${runId}/resume`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: false, feedback }) })
    const data = await res.json().catch(() => ({ status: 'failed', error: `Server error ${res.status}` }))
    _handleResumeResult(data, res.ok)
    setActionResuming(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction, actionResuming])

  const _handleResumeResult = (data: Record<string, unknown>, ok: boolean) => {
    setRunResult(data as unknown as RunResult)
    setTrace(prev => [...prev, ...((data.trace as unknown[]) ?? [])] as TraceEvent[])
    const newStatus = (data.status as string) ?? (ok ? 'completed' : 'failed')
    setRunStatus(newStatus as RunResult['status'])
    if (newStatus === 'waiting_hitl') {
      const out = data.output as { checkpoint?: string; partial?: unknown } | null
      const checkpointId = out?.checkpoint
      const hitlNode = schemaRef.current.nodes.find(n => n.id === checkpointId)
      const question = String((hitlNode?.data as Record<string, unknown>)?.question || 'Please review and approve to continue.')
      const partial = out?.partial
      let content = question
      if (partial) content = question + '\n\n**Output to review:**\n' + (typeof partial === 'string' ? partial : JSON.stringify(partial, null, 2))
      setChatMessages(prev => [...prev, { role: 'assistant', content, hitl: true }])
      setPendingAction({ type: 'hitl', runId: String(data.runId ?? '') })
    } else if (newStatus === 'waiting_clarify') {
      const out = data.output as { question?: string } | null
      setChatMessages(prev => [...prev, { role: 'assistant', content: String(out?.question ?? 'Clarify?'), clarify: true }])
      setPendingAction({ type: 'clarify', runId: String(data.runId ?? '') })
    } else {
      const outText = typeof data.output === 'string' ? data.output
        : (data.output as { message?: string } | null)?.message ?? (data.error ? String(data.error) : JSON.stringify(data.output, null, 2))
      setChatMessages(prev => [...prev, { role: 'assistant', content: outText, error: newStatus === 'failed' }])
    }
  }

  const copyEndpoint = () => {
    if (!savedAgentId) return
    navigator.clipboard.writeText(savedAgentId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadPostman = () => {
    if (!savedAgentId) return
    const baseUrl = window.location.origin
    const runUrl = `${baseUrl}/api/agents/${savedAgentId}/run`
    const resumeUrl = `${baseUrl}/api/runs/{{runId}}/resume`

    const collection = {
      info: {
        _postman_id: savedAgentId,
        name: agentName,
        description: `AgentHub — ${agentName}\n\nEndpoint: POST ${runUrl}\n\nImport this collection into Postman to test the agent.\nReplace YOUR_API_KEY with a real key from the API Keys page (or use "test" for dashboard testing).`,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      variable: [
        { key: 'baseUrl',  value: baseUrl,       type: 'string' },
        { key: 'agentId',  value: savedAgentId,  type: 'string' },
        { key: 'apiKey',   value: 'test',         type: 'string', description: 'Use "test" for dashboard testing, or replace with a real key from the API Keys page' },
        { key: 'runId',    value: '',             type: 'string', description: 'Populated from the Run Agent response — paste the runId here for HITL resume' },
      ],
      item: [
        {
          name: '1. Run Agent',
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type',   value: 'application/json' },
              { key: 'X-AgentHub-Key', value: '{{apiKey}}', description: 'Use "test" for local testing or add a real API key' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ message: testMessage || 'Hello! What can you help me with?' }, null, 2),
              options: { raw: { language: 'json' } },
            },
            url: {
              raw: '{{baseUrl}}/api/agents/{{agentId}}/run',
              host: ['{{baseUrl}}'],
              path: ['api', 'agents', '{{agentId}}', 'run'],
            },
            description: `Runs the agent with a message input.\n\nReturns:\n- runId: unique run identifier\n- output: agent response\n- status: completed | failed | waiting_hitl\n- tokens: token usage\n- latencyMs: execution time\n- trace: step-by-step execution log\n\nIf status is "waiting_hitl", use the Resume HITL request with the returned runId.`,
          },
          response: [
            {
              name: 'Successful run',
              originalRequest: {
                method: 'POST',
                header: [
                  { key: 'Content-Type',   value: 'application/json' },
                  { key: 'X-AgentHub-Key', value: 'test' },
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify({ message: 'Hello! What can you help me with?' }, null, 2),
                  options: { raw: { language: 'json' } },
                },
                url: { raw: `${runUrl}` },
              },
              status: 'OK',
              code: 200,
              _postman_previewlanguage: 'json',
              body: JSON.stringify({
                runId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
                agentId: savedAgentId,
                agentName,
                output: 'Agent response will appear here',
                status: 'completed',
                tokens: 150,
                latencyMs: 1200,
                trace: [
                  { ts: 0,   type: 'node_start',   nodeId: 'node-1', message: 'Node started' },
                  { ts: 10,  type: 'llm_call',      nodeId: 'node-1', message: 'Calling LLM' },
                  { ts: 1190, type: 'llm_response', nodeId: 'node-1', message: 'LLM response (150 tokens)' },
                  { ts: 1200, type: 'node_done',    nodeId: 'node-1', message: 'Node completed' },
                ],
                error: null,
              }, null, 2),
            },
            {
              name: 'Waiting for HITL approval',
              originalRequest: { method: 'POST', header: [], body: { mode: 'raw', raw: '{}' }, url: { raw: `${runUrl}` } },
              status: 'OK',
              code: 200,
              _postman_previewlanguage: 'json',
              body: JSON.stringify({
                runId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
                agentId: savedAgentId,
                agentName,
                output: { message: 'Waiting for human approval', checkpoint: 'hitl-node-id', partial: 'Content awaiting review' },
                status: 'waiting_hitl',
                tokens: 80,
                latencyMs: 900,
                trace: [],
                error: null,
              }, null, 2),
            },
          ],
        },
        {
          name: '2. Resume HITL (Approve)',
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type',   value: 'application/json' },
              { key: 'X-AgentHub-Key', value: '{{apiKey}}' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ feedback: '' }, null, 2),
              options: { raw: { language: 'json' } },
            },
            url: {
              raw: '{{baseUrl}}/api/runs/{{runId}}/resume',
              host: ['{{baseUrl}}'],
              path: ['api', 'runs', '{{runId}}', 'resume'],
            },
            description: `Resumes a paused HITL run.\n\nSet {{runId}} to the runId from the "Run Agent" response.\n\nLeave feedback empty to approve silently.\nAdd feedback text to give the agent revision notes.\n\nReturns the same schema as Run Agent.`,
          },
        },
        {
          name: '3. Resume HITL (With Feedback)',
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type',   value: 'application/json' },
              { key: 'X-AgentHub-Key', value: '{{apiKey}}' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ feedback: 'Please revise the tone to be more formal' }, null, 2),
              options: { raw: { language: 'json' } },
            },
            url: {
              raw: '{{baseUrl}}/api/runs/{{runId}}/resume',
              host: ['{{baseUrl}}'],
              path: ['api', 'runs', '{{runId}}', 'resume'],
            },
            description: 'Resumes a HITL run with reviewer feedback. The agent receives your notes and revises its output accordingly.',
          },
        },
        {
          name: '4. Chat (Multi-turn)',
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type',   value: 'application/json' },
              { key: 'X-AgentHub-Key', value: '{{apiKey}}' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                message: 'Follow-up question here',
                conversationHistory: [
                  { role: 'user',      content: 'First user message' },
                  { role: 'assistant', content: 'First agent response' },
                ],
              }, null, 2),
              options: { raw: { language: 'json' } },
            },
            url: {
              raw: '{{baseUrl}}/api/agents/{{agentId}}/run',
              host: ['{{baseUrl}}'],
              path: ['api', 'agents', '{{agentId}}', 'run'],
            },
            description: 'Multi-turn chat — pass conversationHistory to maintain context across turns.\n\nEach turn:\n1. Call POST /run with { message, conversationHistory }\n2. Append the response to conversationHistory\n3. Repeat for the next turn\n\nThe agent sees the full conversation history prepended to the current message.',
          },
        },
        {
          name: '5. Resume Clarify',
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type',   value: 'application/json' },
              { key: 'X-AgentHub-Key', value: '{{apiKey}}' },
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({ answer: 'My answer to the clarifying question' }, null, 2),
              options: { raw: { language: 'json' } },
            },
            url: {
              raw: '{{baseUrl}}/api/runs/{{runId}}/clarify',
              host: ['{{baseUrl}}'],
              path: ['api', 'runs', '{{runId}}', 'clarify'],
            },
            description: 'Resumes a run paused at a Clarify node.\n\nWhen status is "waiting_clarify", the agent asked a question. POST your answer here to continue execution.',
          },
        },
        {
          name: '6. Get Agent Schema',
          request: {
            method: 'GET',
            header: [],
            url: {
              raw: '{{baseUrl}}/api/agents/{{agentId}}',
              host: ['{{baseUrl}}'],
              path: ['api', 'agents', '{{agentId}}'],
            },
            description: 'Returns the full agent definition including name, schema (nodes + edges), and metadata.',
          },
        },
        {
          name: '7. Stream Run (SSE)',
          request: {
            method: 'GET',
            header: [
              { key: 'X-AgentHub-Key', value: '{{apiKey}}' },
            ],
            url: {
              raw: `{{baseUrl}}/api/agents/{{agentId}}/run?message=${encodeURIComponent(testMessage || 'Hello!')}`,
              host: ['{{baseUrl}}'],
              path: ['api', 'agents', '{{agentId}}', 'run'],
              query: [{ key: 'message', value: testMessage || 'Hello!' }],
            },
            description: 'Streams trace events in real-time via Server-Sent Events (SSE).\n\nEvents emitted:\n- { type: "start", runId, agentId, agentName }\n- { type: "trace", event: TraceEvent }\n- { type: "done", output, tokens, latencyMs, status }\n- { type: "error", message }\n\nIn Postman, use the "Visualize" tab or a streaming client to see events as they arrive.',
          },
        },
      ],
    }

    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${agentName.replace(/[^a-z0-9]/gi, '_')}_postman.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadImport = () => {
    setImportError('')
    try {
      const parsed = JSON.parse(importJson)
      const nodes = parsed.nodes ?? parsed.schema?.nodes
      const edges = parsed.edges ?? parsed.schema?.edges
      if (!Array.isArray(nodes)) throw new Error('No "nodes" array found')
      setSchema({ nodes, edges: Array.isArray(edges) ? edges : [] })
      if (parsed.name && typeof parsed.name === 'string') setAgentName(parsed.name)
      setCanvasKey(k => k + 1)
      setImportOpen(false)
      setImportJson('')
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      <style>{`@keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }`}</style>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', height: 52 }}>
        {/* Back */}
        <Link href="/agents"
          className="flex items-center justify-center rounded-lg border"
          style={{ color: 'var(--text3)', borderColor: 'var(--border)', background: 'var(--surface2)', width: 32, height: 32, marginLeft: 10 }}>
          <ChevronLeft size={14} />
        </Link>

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

        {/* Agent name */}
        <input
          value={agentName}
          onChange={e => setAgentName(e.target.value)}
          onBlur={saveAgent}
          style={{
            fontSize: 14, fontWeight: 600, background: 'transparent', outline: 'none',
            border: 'none', color: 'var(--text)', maxWidth: 240,
          }}
        />
        {savedAgentId && (
          <span className="font-mono hidden sm:flex items-center gap-1.5"
            style={{ fontSize: 10, padding: '2px 6px 2px 8px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
            {savedAgentId.slice(0, 8)}
            <button onClick={copyEndpoint} title="Copy agent ID"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--green)' : 'var(--text3)', padding: 0, display: 'flex', alignItems: 'center' }}>
              {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
            </button>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {saveStatus === 'saved' && <span style={{ fontSize: 11, color: 'var(--green)' }}>Saved ✓</span>}
          {saveStatus === 'error' && <span style={{ fontSize: 11, color: 'var(--red)' }}>Save failed</span>}
          {savedAgentId && (
            <button onClick={() => setCurlOpen(true)}
              className="hidden sm:flex items-center gap-1.5"
              title="View curl examples for this agent"
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text2)', background: 'var(--surface2)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
              <HelpCircle size={11} />
              API Usage
            </button>
          )}
          <button onClick={() => setExportOpen(true)}
            className="hidden sm:flex items-center gap-1.5"
            title="Export agent schema as JSON"
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text2)', background: 'var(--surface2)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
            <Download size={11} />
            Export
          </button>
          <button onClick={() => setImportOpen(true)}
            className="hidden sm:flex items-center gap-1.5"
            title="Import agent schema from JSON"
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text2)', background: 'var(--surface2)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
            <Upload size={11} />
            Import
          </button>
          <button onClick={saveAgent} disabled={saving}
            className="flex items-center gap-1.5"
            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text2)', background: 'var(--surface2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Config Studio — icon strip always visible, content panel collapses */}
        <div style={{
          width: studioOpen ? 300 : 56, flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.2s ease', zIndex: 10,
          position: 'relative',
        }}>
          <ConfigStudio
            currentAgentId={savedAgentId ?? undefined}
            currentAgentName={agentName}
          />
        </div>

        {/* Collapse toggle — sits on the seam between Config Studio and canvas */}
        <button
          onClick={() => setStudioOpen(o => !o)}
          title={studioOpen ? 'Collapse panel' : 'Expand panel'}
          style={{
            position: 'absolute',
            left: (studioOpen ? 300 : 56) - 12,
            top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text3)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
            zIndex: 30,
            transition: 'left 0.2s ease',
          }}
        >
          {studioOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Canvas + panels */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
            {schemaReady && (
              <AgentCanvas
                key={`${savedAgentId ?? 'new'}-${canvasKey}`}
                initialNodes={schema.nodes}
                initialEdges={schema.edges}
                onSchemaChange={(s) => setSchema(prev => ({ ...prev, nodes: s.nodes, edges: s.edges }))}
                onAfterToolSave={saveAgent}
              />
            )}
            {!schemaReady && (
              <div className="w-full h-full flex items-center justify-center">
                <ChevronRight size={16} className="animate-spin" style={{ color: 'var(--text3)' }} />
              </div>
            )}
          </div>


          {/* Chat thread — conversation history + streaming */}
          {(chatMessages.length > 0 || running) && (
            <div className="flex-shrink-0 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)', maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--border2)', flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Test Chat</span>
                <button onClick={() => { setChatMessages([]); setRunResult(null); setRunStatus('idle') }}
                  title="Clear conversation"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', padding: 0 }}>
                  <Trash2 size={11} />
                </button>
              </div>
              {/* Messages */}
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(124,111,240,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <Bot size={11} color="var(--blue)" />
                      </div>
                    )}
                    <div style={{
                      maxWidth: '82%', padding: '6px 10px', borderRadius: msg.role === 'user' ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
                      background: msg.role === 'user' ? 'var(--blue)' : msg.error ? 'rgba(232,85,85,0.08)' : msg.hitl ? 'rgba(245,160,32,0.06)' : msg.clarify ? 'rgba(244,114,182,0.06)' : 'var(--surface2)',
                      border: msg.error ? '1px solid rgba(232,85,85,0.2)' : msg.hitl ? '1px solid rgba(245,160,32,0.3)' : msg.clarify ? '1px solid rgba(244,114,182,0.3)' : msg.role === 'user' ? 'none' : '1px solid var(--border)',
                      color: msg.role === 'user' ? '#fff' : msg.error ? 'var(--red)' : 'var(--text)',
                      fontSize: 11, lineHeight: 1.6, wordBreak: 'break-word',
                    }}>
                      {msg.hitl && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,160,32,0.15)', border: '1px solid rgba(245,160,32,0.3)' }}>
                            <UserCheck size={9} color="var(--orange)" />
                            <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--orange)', letterSpacing: '0.06em' }}>HITL REVIEW</span>
                          </div>
                        </div>
                      )}
                      {msg.clarify && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, background: 'rgba(244,114,182,0.15)', border: '1px solid rgba(244,114,182,0.3)' }}>
                            <HelpCircle size={9} color="#f472b6" />
                            <span style={{ fontSize: 9, fontWeight: 800, color: '#f472b6', letterSpacing: '0.06em' }}>NEEDS CLARIFICATION</span>
                          </div>
                        </div>
                      )}
                      {msg.role === 'assistant' && !msg.error ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          p: ({children}) => <p style={{margin:'0 0 4px',lineHeight:1.6}}>{children}</p>,
                          strong: ({children}) => <strong style={{fontWeight:700}}>{children}</strong>,
                          ul: ({children}) => <ul style={{margin:'2px 0 4px',paddingLeft:14}}>{children}</ul>,
                          li: ({children}) => <li style={{marginBottom:1}}>{children}</li>,
                          code: ({children}) => <code style={{fontFamily:'monospace',fontSize:10,background:'var(--bg)',padding:'1px 3px',borderRadius:3}}>{children}</code>,
                          table: ({children}) => <table style={{borderCollapse:'collapse',width:'100%',fontSize:10,margin:'2px 0'}}>{children}</table>,
                          th: ({children}) => <th style={{padding:'3px 6px',borderBottom:'1px solid var(--border)',textAlign:'left',fontWeight:700}}>{children}</th>,
                          td: ({children}) => <td style={{padding:'3px 6px',borderBottom:'1px solid var(--border2)'}}>{children}</td>,
                        }}>{msg.content}</ReactMarkdown>
                      ) : msg.content}
                      {msg.role === 'assistant' && (msg.tokens || msg.latencyMs) && (
                        <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'monospace', marginTop: 3 }}>
                          {msg.tokens ? `${msg.tokens} tok` : ''}{msg.tokens && msg.latencyMs ? ' · ' : ''}{msg.latencyMs ? `${msg.latencyMs}ms` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {/* Streaming bubble */}
                {running && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(124,111,240,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Bot size={11} color="var(--blue)" />
                    </div>
                    <div style={{ maxWidth: '82%', padding: '6px 10px', borderRadius: '10px 10px 10px 3px', background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 11, lineHeight: 1.6, color: 'var(--text)', wordBreak: 'break-word' }}>
                      {streamingOutput ? (
                        <>
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                            p: ({children}) => <p style={{margin:'0 0 4px',lineHeight:1.6}}>{children}</p>,
                            strong: ({children}) => <strong style={{fontWeight:700}}>{children}</strong>,
                          }}>{streamingOutput}</ReactMarkdown>
                          <span style={{ display: 'inline-block', width: 2, height: 11, background: 'var(--blue)', marginLeft: 1, verticalAlign: 'text-bottom', animation: 'blink 0.9s step-end infinite' }} />
                        </>
                      ) : (
                        <span style={{ color: 'var(--text3)', fontSize: 10 }}>thinking…</span>
                      )}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>
          )}

          {/* Input / Run bar */}
          <div className="flex-shrink-0 border-t" style={{ borderColor: pendingAction?.type === 'hitl' ? 'rgba(245,160,32,0.5)' : pendingAction?.type === 'clarify' ? 'rgba(244,114,182,0.5)' : 'var(--border)', background: 'var(--surface)' }}>
            {pendingAction?.type === 'hitl' && (
              <div style={{ padding: '5px 12px 0', fontSize: 10, color: 'var(--orange)', fontWeight: 600 }}>
                HITL paused — add optional notes then Approve, or Reject to stop
              </div>
            )}
            {pendingAction?.type === 'clarify' && (
              <div style={{ padding: '5px 12px 0', fontSize: 10, color: '#f472b6', fontWeight: 600 }}>
                Agent is waiting for your answer
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
              <input
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (pendingAction?.type === 'clarify') { handlePendingSend(testMessage); setTestMessage('') }
                    else if (!pendingAction && !running) { runAgent(); setTestMessage('') }
                  }
                }}
                placeholder={
                  pendingAction?.type === 'hitl' ? 'Optional notes before approving…' :
                  pendingAction?.type === 'clarify' ? 'Type your answer…' :
                  chatMessages.length > 0 ? 'Reply…' : 'Enter agent input and press Run…'
                }
                style={{
                  flex: 1, padding: '7px 12px', borderRadius: 7, fontSize: 12, outline: 'none',
                  background: 'var(--surface2)',
                  border: pendingAction?.type === 'hitl' ? '1px solid rgba(245,160,32,0.4)' : pendingAction?.type === 'clarify' ? '1px solid rgba(244,114,182,0.4)' : '1px solid var(--border)',
                  color: 'var(--text)', minWidth: 0, height: 34,
                }}
              />
              {pendingAction?.type === 'hitl' ? (
                <>
                  <button
                    onClick={() => { handlePendingSend(testMessage); setTestMessage('') }}
                    disabled={actionResuming}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, border: 'none',
                      background: 'var(--green)', color: '#030d07', fontSize: 12, fontWeight: 700, flexShrink: 0, height: 34,
                      cursor: actionResuming ? 'not-allowed' : 'pointer', opacity: actionResuming ? 0.7 : 1,
                    }}>
                    {actionResuming ? <Loader2 size={11} className="animate-spin" /> : <UserCheck size={11} />}
                    Approve
                  </button>
                  <button
                    onClick={() => { handlePendingReject(testMessage); setTestMessage('') }}
                    disabled={actionResuming}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7,
                      background: 'rgba(232,85,85,0.12)', color: 'var(--red)',
                      border: '1px solid rgba(232,85,85,0.3)', fontSize: 12, fontWeight: 600, flexShrink: 0, height: 34,
                      cursor: actionResuming ? 'not-allowed' : 'pointer', opacity: actionResuming ? 0.4 : 1,
                    }}>
                    Reject
                  </button>
                </>
              ) : pendingAction?.type === 'clarify' ? (
                <button
                  onClick={() => { handlePendingSend(testMessage); setTestMessage('') }}
                  disabled={actionResuming || !testMessage.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, border: 'none',
                    background: 'rgba(244,114,182,0.2)', color: '#f472b6', fontSize: 12, fontWeight: 700, flexShrink: 0, height: 34,
                    cursor: (actionResuming || !testMessage.trim()) ? 'not-allowed' : 'pointer',
                    opacity: !testMessage.trim() ? 0.4 : actionResuming ? 0.7 : 1,
                  }}>
                  {actionResuming ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                  Send
                </button>
              ) : (
                <button
                  onClick={() => { runAgent(); setTestMessage('') }}
                  disabled={running}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, flexShrink: 0, height: 34,
                    background: running ? 'var(--surface2)' : 'var(--blue)',
                    color: running ? 'var(--text3)' : '#fff',
                    border: 'none', cursor: running ? 'not-allowed' : 'pointer',
                  }}>
                  {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  {chatMessages.length > 0 ? 'Send' : 'Run'}
                </button>
              )}
            </div>
          </div>

          {/* Trace */}
          <TracePanel trace={trace} status={runStatus} tokens={runResult?.tokens} latencyMs={runResult?.latencyMs} />
        </div>
      </div>

      {/* Export JSON Modal */}
      {exportOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setExportOpen(false)}>
          <div style={{
            width: 560, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Export Agent Schema</span>
              <button onClick={() => setExportOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
              Copy this JSON to share your agent, back it up, or import it into another AgentHub account.
            </p>
            <textarea
              readOnly
              value={JSON.stringify({ name: agentName, schema: { nodes: schema.nodes, edges: schema.edges } }, null, 2)}
              rows={14}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 11,
                fontFamily: 'monospace', lineHeight: 1.6, resize: 'vertical',
                background: 'var(--bg)', border: '1px solid var(--border)',
                color: 'var(--text)', outline: 'none', cursor: 'text',
              }}
              onFocus={e => e.target.select()}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setExportOpen(false)} style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface2)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
              }}>Close</button>
              <button onClick={() => {
                const json = JSON.stringify({ name: agentName, schema: { nodes: schema.nodes, edges: schema.edges } }, null, 2)
                const blob = new Blob([json], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `${agentName.replace(/\s+/g, '-').toLowerCase()}.json`
                a.click(); URL.revokeObjectURL(url)
              }} style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: 'var(--blue)', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Download size={13} /> Download .json
              </button>
              <button onClick={() => {
                const json = JSON.stringify({ name: agentName, schema: { nodes: schema.nodes, edges: schema.edges } }, null, 2)
                navigator.clipboard.writeText(json)
              }} style={{
                padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface2)', color: 'var(--text2)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Copy size={13} /> Copy JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Usage Modal */}
      {curlOpen && savedAgentId && (() => {
        const base = typeof window !== 'undefined' ? window.location.origin : ''
        const runUrl = `${base}/api/agents/${savedAgentId}/run`
        const key = apiKey || 'YOUR_API_KEY'
        const msg = testMessage || 'Hello!'

        const snippets: Record<'curl' | 'python' | 'javascript', { title: string; description: string; code: string }[]> = {
          curl: [
            {
              title: 'Basic run',
              description: 'Send a message and get the output.',
              code: `curl -s -X POST "${runUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${key}" \\
  -d '{"message": ${JSON.stringify(msg)}}'`,
            },
            {
              title: 'Clarify flow',
              description: 'Agent pauses with status "waiting_clarify" and asks a question. Send your answer to continue.',
              code: `# Step 1 — start the run
RESPONSE=$(curl -s -X POST "${runUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${key}" \\
  -d '{"message": ${JSON.stringify(msg)}}')
RUN_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['runId'])")

# Step 2 — send your answer
curl -s -X POST "${base}/api/runs/$RUN_ID/clarify" \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${key}" \\
  -d '{"answer": "Your answer here"}'`,
            },
            {
              title: 'HITL flow',
              description: 'Agent pauses with status "waiting_hitl" for human approval. Approve or reject to continue.',
              code: `# Step 1 — start the run
RESPONSE=$(curl -s -X POST "${runUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${key}" \\
  -d '{"message": ${JSON.stringify(msg)}}')
RUN_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['runId'])")

# Step 2 — approve (set approved: false to reject)
curl -s -X POST "${base}/api/runs/$RUN_ID/resume" \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${key}" \\
  -d '{"approved": true, "feedback": "Looks good."}'`,
            },
            {
              title: 'Interactive chat loop (save as chat.sh)',
              description: 'Terminal chat session — handles Clarify and HITL pauses automatically.',
              code: `#!/usr/bin/env bash
BASE_URL="${base}"
AGENT_ID="${savedAgentId}"
API_KEY="${key}"

echo ""; echo "  AgentHub Chat — ${agentName}"; echo "  Type 'exit' to quit."; echo ""

_j() { python3 - "$1" "$2" <<'PYEOF'
import sys, json
raw, field = sys.argv[1], sys.argv[2]
try:
  d = json.loads(raw)
  v = d.get(field)
  if v is None: print(''); sys.exit(0)
  if isinstance(v, str): print(v); sys.exit(0)
  if isinstance(v, dict):
    for k in ('text','content','message','output','answer','result','question','summary'):
      if k in v and isinstance(v[k], str) and v[k].strip(): print(v[k]); sys.exit(0)
    parts = [str(x) for x in v.values() if isinstance(x, str) and str(x).strip()]
    print(' | '.join(parts) if parts else json.dumps(v, ensure_ascii=False))
  elif isinstance(v, list):
    parts = []
    for item in v:
      if isinstance(item, str): parts.append(item)
      elif isinstance(item, dict):
        for k in ('text','content','message','output'):
          if k in item and isinstance(item[k], str): parts.append(item[k]); break
    print(' '.join(parts) if parts else json.dumps(v, ensure_ascii=False))
  else: print(str(v))
except Exception: print('')
PYEOF
}
_q() { python3 - "$1" <<'PYEOF'
import sys, json
try:
  d = json.loads(sys.argv[1])
  for key in ('question','clarifyQuestion','prompt'):
    v = d.get(key)
    if isinstance(v, str) and v.strip(): print(v); sys.exit(0)
  out = d.get('output')
  if isinstance(out, dict):
    for k in ('question','text','content','message','prompt'):
      if k in out and isinstance(out[k], str) and out[k].strip(): print(out[k]); sys.exit(0)
  print('Please provide more information.')
except Exception: print('Please provide more information.')
PYEOF
}
_hitl_partial() { python3 - "$1" <<'PYEOF'
import sys, json
try:
  d = json.loads(sys.argv[1])
  out = d.get('output', {})
  if not isinstance(out, dict): print(''); sys.exit(0)
  p = out.get('partial')
  if p is None: print(''); sys.exit(0)
  if isinstance(p, str): print(p)
  elif isinstance(p, dict):
    for k in ('text','content','message','output','answer','result'):
      if k in p and isinstance(p[k], str) and p[k].strip(): print(p[k]); sys.exit(0)
    print(json.dumps(p, ensure_ascii=False))
  else: print(str(p))
except Exception: print('')
PYEOF
}

while true; do
  printf "\\033[1;36mYou:\\033[0m "; read -r MSG
  [ "$MSG" = "exit" ] || [ "$MSG" = "quit" ] && echo "Bye." && break
  [ -z "$MSG" ] && continue
  printf "\\033[2m  thinking...\\033[0m\\r"
  RAW=$(curl -s -X POST "$BASE_URL/api/agents/$AGENT_ID/run" \\
    -H "Content-Type: application/json" -H "X-AgentHub-Key: $API_KEY" \\
    -d "{\\"message\\": \\"$MSG\\"}")
  printf "                 \\r"
  STATUS=$(_j "$RAW" status); RUN_ID=$(_j "$RAW" runId)

  while [ "$STATUS" = "waiting_clarify" ]; do
    QUESTION=$(_q "$RAW")
    printf "\\033[1;35mAgent:\\033[0m %s\\n" "$QUESTION"
    printf "\\033[1;36mYou:\\033[0m "; read -r ANSWER
    [ -z "$ANSWER" ] && continue
    printf "\\033[2m  thinking...\\033[0m\\r"
    RAW=$(curl -s -X POST "$BASE_URL/api/runs/$RUN_ID/clarify" \\
      -H "Content-Type: application/json" -H "X-AgentHub-Key: $API_KEY" \\
      -d "{\\"answer\\": \\"$ANSWER\\"}")
    printf "                 \\r"
    STATUS=$(_j "$RAW" status); RUN_ID=$(_j "$RAW" runId)
  done

  while [ "$STATUS" = "waiting_hitl" ]; do
    printf "\\n  \\033[1;33m[HITL]\\033[0m Human review required.\\n"
    PREVIEW=$(_hitl_partial "$RAW")
    [ -n "$PREVIEW" ] && printf "  Preview: %s\\n" "$PREVIEW"
    printf "  Approve? [y/n]: "; read -r CHOICE
    APPROVED="true"; [ "$CHOICE" != "y" ] && APPROVED="false"
    printf "  Feedback (optional, Enter to skip): "; read -r FB
    printf "\\033[2m  resuming...\\033[0m\\r"
    RAW=$(curl -s -X POST "$BASE_URL/api/runs/$RUN_ID/resume" \\
      -H "Content-Type: application/json" -H "X-AgentHub-Key: $API_KEY" \\
      -d "{\\"approved\\": $APPROVED, \\"feedback\\": \\"$FB\\"}")
    printf "                 \\r"
    STATUS=$(_j "$RAW" status); RUN_ID=$(_j "$RAW" runId)
  done

  OUTPUT=$(_j "$RAW" output); ERR=$(_j "$RAW" error)
  if [ -n "$OUTPUT" ]; then printf "\\033[1;35mAgent:\\033[0m\\n%s\\n\\n" "$OUTPUT"
  elif [ -n "$ERR" ]; then printf "\\033[1;31mError:\\033[0m %s\\n\\n" "$ERR"
  else printf "\\033[2mAgent: [status=%s — no output]\\033[0m\\n\\n" "$STATUS"; fi
done`,
            },
          ],
          python: [
            {
              title: 'Basic run',
              description: 'Send a message and get the output. pip install requests',
              code: `import requests

response = requests.post(
    "${runUrl}",
    headers={"X-AgentHub-Key": "${key}"},
    json={"message": ${JSON.stringify(msg)}}
)
data = response.json()
print(data["output"])`,
            },
            {
              title: 'Clarify flow',
              description: 'Handle agents that pause to ask clarifying questions.',
              code: `import requests

HEADERS = {"X-AgentHub-Key": "${key}"}

# Step 1 — start the run
res = requests.post("${runUrl}", headers=HEADERS,
    json={"message": ${JSON.stringify(msg)}}).json()

# Step 2 — answer clarifying questions until done
while res.get("status") == "waiting_clarify":
    question = res["output"].get("question", "Please clarify:")
    print(f"Agent: {question}")
    answer = input("You: ")
    res = requests.post(
        f"${base}/api/runs/{res['runId']}/clarify",
        headers=HEADERS, json={"answer": answer}
    ).json()

print(res["output"])`,
            },
            {
              title: 'HITL flow',
              description: 'Handle agents that pause for human approval before continuing.',
              code: `import requests

HEADERS = {"X-AgentHub-Key": "${key}"}

# Step 1 — start the run
res = requests.post("${runUrl}", headers=HEADERS,
    json={"message": ${JSON.stringify(msg)}}).json()

# Step 2 — approve or reject HITL pauses
while res.get("status") == "waiting_hitl":
    partial = res["output"].get("partial", "")
    if partial:
        print(f"Content to review:\\n{partial}\\n")
    approved = input("Approve? [y/n]: ").strip().lower() == "y"
    feedback = input("Feedback (optional): ").strip() or None
    res = requests.post(
        f"${base}/api/runs/{res['runId']}/resume",
        headers=HEADERS,
        json={"approved": approved, "feedback": feedback}
    ).json()

print(res["output"])`,
            },
            {
              title: 'Chat loop (run + clarify + HITL)',
              description: 'Interactive chat loop — handles clarify + HITL pauses, keeps conversation going. Save as chat.py',
              code: `# chat.py — save and run with: python3 chat.py
import requests

BASE_URL = "${base}"
AGENT_ID = "${savedAgentId}"
API_KEY  = "${key}"
HEADERS  = {"X-AgentHub-Key": API_KEY}

def send(message):
    res = requests.post(
        f"{BASE_URL}/api/agents/{AGENT_ID}/run",
        headers=HEADERS, json={"message": message}
    ).json()

    while res.get("status") in ("waiting_clarify", "waiting_hitl"):
        run_id = res["runId"]
        if res["status"] == "waiting_clarify":
            question = res.get("output", {}).get("question", "Please clarify:")
            answer = input(f"Agent: {question}\\nYou: ")
            res = requests.post(f"{BASE_URL}/api/runs/{run_id}/clarify",
                headers=HEADERS, json={"answer": answer}).json()
        else:
            partial = res.get("output", {}).get("partial", "")
            if partial:
                print(f"\\nReview:\\n{partial}\\n")
            approved = input("Approve? [y/n]: ").lower() == "y"
            feedback = input("Feedback (optional): ").strip() or None
            res = requests.post(f"{BASE_URL}/api/runs/{run_id}/resume",
                headers=HEADERS, json={"approved": approved, "feedback": feedback}).json()

    if res.get("status") == "failed":
        raise RuntimeError(res.get("error", "Agent failed"))
    return res.get("output", "")

print(f"\\n  AgentHub Chat — type 'exit' to quit\\n")
while True:
    msg = input("You: ").strip()
    if msg.lower() in ("exit", "quit"):
        print("Bye."); break
    if not msg:
        continue
    try:
        output = send(msg)
        print(f"\\nAgent: {output}\\n")
    except Exception as e:
        print(f"\\nError: {e}\\n")`,
            },
          ],
          javascript: [
            {
              title: 'Basic run',
              description: 'Send a message and get the output. Works in Node.js and the browser.',
              code: `const response = await fetch("${runUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-AgentHub-Key": "${key}",
  },
  body: JSON.stringify({ message: ${JSON.stringify(msg)} }),
});

const data = await response.json();
console.log(data.output);`,
            },
            {
              title: 'Clarify flow',
              description: 'Handle agents that pause to ask clarifying questions.',
              code: `async function runWithClarify(message) {
  const headers = {
    "Content-Type": "application/json",
    "X-AgentHub-Key": "${key}",
  };

  let res = await fetch("${runUrl}", {
    method: "POST", headers,
    body: JSON.stringify({ message }),
  }).then(r => r.json());

  while (res.status === "waiting_clarify") {
    const question = res.output?.question ?? "Please clarify:";
    const answer = prompt(question); // replace with your UI
    res = await fetch(\`${base}/api/runs/\${res.runId}/clarify\`, {
      method: "POST", headers,
      body: JSON.stringify({ answer }),
    }).then(r => r.json());
  }

  return res.output;
}

const output = await runWithClarify(${JSON.stringify(msg)});
console.log(output);`,
            },
            {
              title: 'HITL flow',
              description: 'Handle agents that pause for human approval before continuing.',
              code: `async function runWithHITL(message) {
  const headers = {
    "Content-Type": "application/json",
    "X-AgentHub-Key": "${key}",
  };

  let res = await fetch("${runUrl}", {
    method: "POST", headers,
    body: JSON.stringify({ message }),
  }).then(r => r.json());

  while (res.status === "waiting_hitl") {
    const partial = res.output?.partial;
    if (partial) console.log("Review:", partial);

    const approved = confirm("Approve this output?"); // replace with your UI
    const feedback = approved ? prompt("Feedback (optional):") : "Rejected";
    res = await fetch(\`${base}/api/runs/\${res.runId}/resume\`, {
      method: "POST", headers,
      body: JSON.stringify({ approved, feedback }),
    }).then(r => r.json());
  }

  return res.output;
}

const output = await runWithHITL(${JSON.stringify(msg)});
console.log(output);`,
            },
            {
              title: 'Chat loop (Node.js)',
              description: 'Interactive chat loop — handles clarify + HITL pauses, keeps conversation going. Run with: node chat.mjs',
              code: `// chat.mjs — run with: node chat.mjs
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const AGENT_ID = "${savedAgentId}";
const API_KEY  = "${key}";
const BASE_URL = "${base}";
const HEADERS  = { "Content-Type": "application/json", "X-AgentHub-Key": API_KEY };
const rl = readline.createInterface({ input: stdin, output: stdout });

async function send(message) {
  let res = await fetch(\`\${BASE_URL}/api/agents/\${AGENT_ID}/run\`, {
    method: "POST", headers: HEADERS, body: JSON.stringify({ message }),
  }).then(r => r.json());

  while (res.status === "waiting_clarify" || res.status === "waiting_hitl") {
    if (res.status === "waiting_clarify") {
      const question = res.output?.question ?? "Please clarify:";
      const answer = await rl.question(\`Agent: \${question}\\nYou: \`);
      res = await fetch(\`\${BASE_URL}/api/runs/\${res.runId}/clarify\`,
        { method: "POST", headers: HEADERS, body: JSON.stringify({ answer }) }
      ).then(r => r.json());
    } else {
      if (res.output?.partial) console.log("\\nReview:", res.output.partial, "\\n");
      const choice = await rl.question("Approve? [y/n]: ");
      const approved = choice.trim().toLowerCase() === "y";
      const feedback = approved ? (await rl.question("Feedback (optional): ")) || undefined : undefined;
      res = await fetch(\`\${BASE_URL}/api/runs/\${res.runId}/resume\`,
        { method: "POST", headers: HEADERS, body: JSON.stringify({ approved, feedback }) }
      ).then(r => r.json());
    }
  }

  if (res.status === "failed") throw new Error(res.error ?? "Agent failed");
  return res.output;
}

console.log("\\n  AgentHub Chat — type 'exit' to quit\\n");
while (true) {
  const msg = (await rl.question("You: ")).trim();
  if (msg === "exit" || msg === "quit") { console.log("Bye."); rl.close(); break; }
  if (!msg) continue;
  try {
    const output = await send(msg);
    console.log(\`\\nAgent: \${typeof output === "string" ? output : JSON.stringify(output)}\\n\`);
  } catch (e) {
    console.log(\`\\nError: \${e.message}\\n\`);
  }
}`,
            },
            {
              title: 'Full integration (TypeScript)',
              description: 'Typed helper for TypeScript projects — compile with tsc or use ts-node / tsx.',
              code: `// agent.ts — run with: npx tsx agent.ts
const AGENT_ID = "${savedAgentId}";
const API_KEY = "${key}";
const BASE_URL = "${base}";

interface AgentResponse {
  runId: string;
  output: unknown;
  status: "completed" | "failed" | "waiting_hitl" | "waiting_clarify";
  error?: string;
}

async function callAgent(
  message: string,
  onClarify: (question: string) => Promise<string>,
  onHITL: (partial: unknown) => Promise<{ approved: boolean; feedback?: string }>
): Promise<unknown> {
  const headers = {
    "Content-Type": "application/json",
    "X-AgentHub-Key": API_KEY,
  };

  let res: AgentResponse = await fetch(
    \`\${BASE_URL}/api/agents/\${AGENT_ID}/run\`,
    { method: "POST", headers, body: JSON.stringify({ message }) }
  ).then(r => r.json());

  while (res.status === "waiting_clarify" || res.status === "waiting_hitl") {
    if (res.status === "waiting_clarify") {
      const question = (res.output as { question?: string })?.question ?? "Please clarify:";
      const answer = await onClarify(question);
      res = await fetch(\`\${BASE_URL}/api/runs/\${res.runId}/clarify\`,
        { method: "POST", headers, body: JSON.stringify({ answer }) }
      ).then(r => r.json());
    } else {
      const partial = (res.output as { partial?: unknown })?.partial;
      const { approved, feedback } = await onHITL(partial);
      res = await fetch(\`\${BASE_URL}/api/runs/\${res.runId}/resume\`,
        { method: "POST", headers, body: JSON.stringify({ approved, feedback }) }
      ).then(r => r.json());
    }
  }

  if (res.status === "failed") throw new Error(res.error ?? "Agent failed");
  return res.output;
}

// Usage
const output = await callAgent(
  ${JSON.stringify(msg)},
  async (question) => { process.stdout.write(\`Agent: \${question}\\nYou: \`); return "your answer"; },
  async (partial) => ({ approved: true, feedback: "Looks good" })
);
console.log("\\nAgent:", output);`,
            },
          ],
        }

        const tabs: { id: 'curl' | 'python' | 'javascript'; label: string }[] = [
          { id: 'curl', label: 'cURL' },
          { id: 'python', label: 'Python' },
          { id: 'javascript', label: 'JavaScript / TS' },
        ]

        const steps = snippets[snippetLang]

        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setCurlOpen(false)}>
            <div style={{
              width: 720, maxHeight: '88vh', borderRadius: 16,
              background: 'var(--surface)', border: '1px solid var(--border)',
              padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', overflowY: 'auto',
            }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Integrate your agent</span>
                  <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                    Agent ID: <code style={{ fontFamily: 'monospace', background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>{savedAgentId}</code>
                    {' · '}API key: <code style={{ fontFamily: 'monospace', background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>API Keys</code> page
                  </p>
                </div>
                <button onClick={() => setCurlOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Language tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setSnippetLang(tab.id)} style={{
                    padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: 'none', border: 'none',
                    borderBottom: snippetLang === tab.id ? '2px solid var(--blue)' : '2px solid transparent',
                    color: snippetLang === tab.id ? 'var(--blue)' : 'var(--text3)',
                    marginBottom: -1,
                  }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Snippets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {steps.map((step, i) => {
                  const key = `${snippetLang}-${i}`
                  const isOpen = openSnippets.has(key)
                  const toggle = () => setOpenSnippets(prev => {
                    const next = new Set(prev)
                    isOpen ? next.delete(key) : next.add(key)
                    return next
                  })
                  return (
                    <div key={i} style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <button onClick={toggle} style={{
                        width: '100%', padding: '10px 14px', cursor: 'pointer',
                        background: isOpen ? 'var(--surface2)' : 'var(--surface)',
                        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                        borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                        display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                      }}>
                        {isOpen ? <ChevronDown size={12} color="var(--text3)" /> : <ChevronRight size={12} color="var(--text3)" />}
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{step.title}</span>
                          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{step.description}</p>
                        </div>
                      </button>
                      {isOpen && (
                        <div style={{ position: 'relative' }}>
                          <pre style={{
                            margin: 0, padding: '12px 14px', fontSize: 11, fontFamily: 'monospace',
                            lineHeight: 1.6, background: 'var(--bg)', color: 'var(--text)',
                            overflowX: 'auto', whiteSpace: 'pre',
                          }}>{step.code}</pre>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(step.code)
                              setCopiedSnippet(key)
                              setTimeout(() => setCopiedSnippet(null), 2000)
                            }}
                            style={{
                              position: 'absolute', top: 8, right: 8, background: 'var(--surface2)',
                              border: `1px solid ${copiedSnippet === key ? 'var(--green)' : 'var(--border)'}`,
                              borderRadius: 6, padding: '3px 8px',
                              cursor: 'pointer', color: copiedSnippet === key ? 'var(--green)' : 'var(--text3)', fontSize: 10,
                              display: 'flex', alignItems: 'center', gap: 4,
                              transition: 'color 0.15s, border-color 0.15s',
                            }}>
                            {copiedSnippet === key ? <CheckCircle size={9} /> : <Copy size={9} />}
                            {copiedSnippet === key ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Import JSON Modal */}
      {importOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setImportOpen(false)}>
          <div style={{
            width: 520, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Import Agent Schema</span>
              <button onClick={() => setImportOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
              Paste a JSON object with a <code style={{ fontFamily: 'monospace', background: 'var(--surface2)', padding: '1px 4px', borderRadius: 3 }}>nodes</code> array (and optionally <code style={{ fontFamily: 'monospace', background: 'var(--surface2)', padding: '1px 4px', borderRadius: 3 }}>edges</code> and <code style={{ fontFamily: 'monospace', background: 'var(--surface2)', padding: '1px 4px', borderRadius: 3 }}>name</code>).
            </p>
            <textarea
              value={importJson}
              onChange={e => { setImportJson(e.target.value); setImportError('') }}
              placeholder={'{\n  "name": "My Agent",\n  "nodes": [...],\n  "edges": [...]\n}'}
              rows={12}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 11,
                fontFamily: 'monospace', lineHeight: 1.6, resize: 'vertical',
                background: 'var(--bg)', border: `1px solid ${importError ? 'var(--red)' : 'var(--border)'}`,
                color: 'var(--text)', outline: 'none',
              }}
            />
            {importError && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>{importError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setImportOpen(false)} style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface2)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={loadImport} disabled={!importJson.trim()} style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: importJson.trim() ? 'var(--blue)' : 'var(--surface2)',
                color: importJson.trim() ? '#fff' : 'var(--text3)',
                fontSize: 13, fontWeight: 600, cursor: importJson.trim() ? 'pointer' : 'not-allowed',
              }}>Load Schema</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
