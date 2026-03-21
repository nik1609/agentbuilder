'use client'
import { useState, useEffect, useCallback, use } from 'react'
import dynamic from 'next/dynamic'
import { Save, Play, Copy, CheckCircle, Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, UserCheck, ThumbsUp, Send, X, Download } from 'lucide-react'
import TracePanel from '@/components/canvas/TracePanel'
import ConfigStudio from '@/components/config/ConfigStudio'
import { AgentNode, AgentEdge, TraceEvent } from '@/types/agent'
import ThemeToggle from '@/components/ui/ThemeToggle'
import Link from 'next/link'

const AgentCanvas = dynamic(() => import('@/components/canvas/AgentCanvas'), { ssr: false })

interface RunResult {
  runId: string
  output: unknown; tokens: number; latencyMs: number
  status: 'completed' | 'failed' | 'waiting_hitl'
  trace: TraceEvent[]; error?: string
}

export default function BuilderPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params)
  const isNew = agentId === 'new'

  const [agentName, setAgentName] = useState('Untitled Agent')
  const [schema, setSchema] = useState<{ nodes: AgentNode[]; edges: AgentEdge[] }>({ nodes: [], edges: [] })
  const [schemaReady, setSchemaReady] = useState(isNew)
  const [saving, setSaving] = useState(false)
  const [savedAgentId, setSavedAgentId] = useState<string | null>(isNew ? null : agentId)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [apiKey, setApiKey] = useState('')
  const [testMessage, setTestMessage] = useState('Hello! What can you help me with?')
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'completed' | 'failed' | 'waiting_hitl'>('idle')
  const [trace, setTrace] = useState<TraceEvent[]>([])
  const [copied, setCopied] = useState(false)
  const [studioOpen, setStudioOpen] = useState(true)
  const [hitlFeedback, setHitlFeedback] = useState('')
  const [hitlResuming, setHitlResuming] = useState(false)
  const [hitlCollapsed, setHitlCollapsed] = useState(false)
  const [resultDismissed, setResultDismissed] = useState(false)

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/agents/${agentId}`).then(r => r.json()).then(data => {
        if (data?.name) setAgentName(data.name)
        if (data?.schema) setSchema(data.schema)
        setSchemaReady(true)
      })
    }
  }, [agentId, isNew])

  const saveAgent = useCallback(async () => {
    if (!agentName.trim()) return
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      if (!savedAgentId) setSavedAgentId(data.id)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
    setSaving(false)
  }, [savedAgentId, agentName, schema])

  // Auto-save on schema changes
  useEffect(() => {
    if (!savedAgentId && isNew) return
    if (schema.nodes.length === 0) return
    const t = setTimeout(saveAgent, 1500)
    return () => clearTimeout(t)
  }, [schema]) // eslint-disable-line react-hooks/exhaustive-deps

  const runAgent = useCallback(async () => {
    if (!savedAgentId) {
      // Save first then run
      await saveAgent()
    }
    const id = savedAgentId
    if (!id) return

    setRunning(true)
    setRunStatus('running')
    setTrace([])
    setRunResult(null)
    setResultDismissed(false)
    setHitlCollapsed(false)

    const res = await fetch(`/api/agents/${id}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgentHub-Key': apiKey || 'test',
      },
      body: JSON.stringify({ message: testMessage }),
    })
    const data = await res.json()
    setRunResult(data)
    setTrace(data.trace ?? [])
    setRunStatus(data.status ?? (res.ok ? 'completed' : 'failed'))
    setRunning(false)
  }, [savedAgentId, apiKey, testMessage, saveAgent])

  const resumeHitl = useCallback(async (feedback?: string) => {
    if (!runResult?.runId) return
    setHitlResuming(true)
    const res = await fetch(`/api/runs/${runResult.runId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: feedback?.trim() || undefined }),
    })
    const data = await res.json()
    setRunResult(data)
    setTrace(prev => [...prev, ...(data.trace ?? [])])
    setRunStatus(data.status ?? (res.ok ? 'completed' : 'failed'))
    setHitlFeedback('')
    setHitlResuming(false)
  }, [runResult])

  const copyEndpoint = () => {
    if (!savedAgentId) return
    navigator.clipboard.writeText(`${window.location.origin}/api/agents/${savedAgentId}/run`)
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
          name: '4. Get Agent Schema',
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
          name: '5. Stream Run (SSE)',
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

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
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
          <span className="font-mono hidden sm:block"
            style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)' }}>
            {savedAgentId.slice(0, 8)}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {saveStatus === 'saved' && <span style={{ fontSize: 11, color: 'var(--green)' }}>Saved ✓</span>}
          {saveStatus === 'error' && <span style={{ fontSize: 11, color: 'var(--red)' }}>Save failed</span>}

          {savedAgentId && (
            <button onClick={copyEndpoint}
              className="hidden sm:flex items-center gap-1.5 font-mono"
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--blue)', background: 'var(--surface2)', fontSize: 11 }}>
              {copied ? <CheckCircle size={11} /> : <Copy size={11} />}
              Copy endpoint
            </button>
          )}
          {savedAgentId && (
            <button onClick={downloadPostman}
              className="hidden sm:flex items-center gap-1.5"
              title="Download Postman collection — import into Postman to test this agent"
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text2)', background: 'var(--surface2)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
              <Download size={11} />
              Postman
            </button>
          )}
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
          <div className="flex-1 relative overflow-hidden">
            {schemaReady && (
              <AgentCanvas
                key={savedAgentId ?? 'new'}
                initialNodes={schema.nodes}
                initialEdges={schema.edges}
                onSchemaChange={setSchema}
              />
            )}
            {!schemaReady && (
              <div className="w-full h-full flex items-center justify-center">
                <ChevronRight size={16} className="animate-spin" style={{ color: 'var(--text3)' }} />
              </div>
            )}
          </div>

          {/* HITL Review Panel */}
          {runStatus === 'waiting_hitl' && (() => {
            const hitlOutput = runResult?.output as { checkpoint?: string; partial?: unknown; message?: string } | null
            const checkpointId = hitlOutput?.checkpoint
            const hitlNode = schema.nodes.find(n => n.id === checkpointId)
            const question = String(hitlNode?.data?.question || 'Please review and approve to continue.')
            const partial = hitlOutput?.partial
            return (
              <div style={{ flexShrink: 0, borderTop: '2px solid var(--orange)', background: 'var(--surface)' }}>
                {/* HITL Header — always visible, click to collapse */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', cursor: 'pointer', borderBottom: hitlCollapsed ? 'none' : '1px solid var(--border2)' }}
                  onClick={() => setHitlCollapsed(c => !c)}
                >
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(245,160,32,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserCheck size={11} color="var(--orange)" />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>Human Review Required</span>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
                    padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(245,160,32,0.12)', color: 'var(--orange)',
                    border: '1px solid rgba(245,160,32,0.3)',
                  }}>PAUSED</span>
                  <div style={{ marginLeft: 'auto', color: 'var(--orange)', opacity: 0.7 }}>
                    {hitlCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                  </div>
                </div>

                {!hitlCollapsed && (
                  <div style={{ padding: '12px 16px' }}>
                    <p style={{ fontSize: 12, color: 'var(--text)', marginBottom: 10, lineHeight: 1.5 }}>{question}</p>

                    {!!partial && (
                      <div style={{
                        marginBottom: 10, padding: '7px 10px', borderRadius: 7, fontSize: 11, fontFamily: 'monospace',
                        background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text3)',
                        maxHeight: 56, overflowY: 'auto', lineHeight: 1.6,
                      }}>
                        {typeof partial === 'string' ? partial : JSON.stringify(partial as object, null, 2)}
                      </div>
                    )}

                    <textarea
                      value={hitlFeedback}
                      onChange={e => setHitlFeedback(e.target.value)}
                      placeholder="Optional notes for the agent..."
                      rows={2}
                      style={{
                        width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 12, outline: 'none', resize: 'none',
                        background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
                        lineHeight: 1.5, fontFamily: 'inherit', marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={e => { e.stopPropagation(); resumeHitl(hitlFeedback || undefined) }}
                        disabled={hitlResuming}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '8px 12px', borderRadius: 7, border: 'none', cursor: hitlResuming ? 'not-allowed' : 'pointer',
                          background: 'var(--green)', color: '#030d07', fontSize: 12, fontWeight: 700,
                          opacity: hitlResuming ? 0.7 : 1,
                        }}>
                        {hitlResuming ? <Loader2 size={11} className="animate-spin" /> : <ThumbsUp size={11} />}
                        Approve
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); resumeHitl(hitlFeedback || 'Rejected by reviewer') }}
                        disabled={hitlResuming || !hitlFeedback.trim()}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '8px 12px', borderRadius: 7,
                          background: 'var(--surface2)', color: 'var(--text2)',
                          border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          opacity: (hitlResuming || !hitlFeedback.trim()) ? 0.4 : 1,
                        }}>
                        <Send size={11} /> Send Notes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Output panel */}
          {runResult && !resultDismissed && runStatus !== 'waiting_hitl' && (
            <div className="flex-shrink-0 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Output</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: runStatus === 'failed' ? 'rgba(248,113,113,0.12)' : 'rgba(34,215,154,0.12)',
                    color: runStatus === 'failed' ? 'var(--red)' : 'var(--green)',
                    border: `1px solid ${runStatus === 'failed' ? 'rgba(248,113,113,0.3)' : 'rgba(34,215,154,0.3)'}`,
                  }}>
                    {runStatus.toUpperCase()}
                  </span>
                  {runResult.tokens ? <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'monospace' }}>{runResult.tokens} tokens · {runResult.latencyMs}ms</span> : null}
                </div>
                <button
                  onClick={() => setResultDismissed(true)}
                  style={{ width: 18, height: 18, borderRadius: 4, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={11} />
                </button>
              </div>
              <div style={{ margin: '6px 12px 8px' }}>
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--surface2)',
                  border: `1px solid ${runStatus === 'failed' ? 'rgba(248,113,113,0.4)' : 'var(--border)'}`,
                  color: runStatus === 'failed' ? 'var(--red)' : 'var(--text)',
                  fontSize: 12, lineHeight: 1.7, maxHeight: 160, overflowY: 'auto',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {runResult.error
                    ? runResult.error
                    : typeof runResult.output === 'string'
                      ? runResult.output
                      : JSON.stringify(runResult.output, null, 2)}
                </div>
              </div>
            </div>
          )}

          {/* Input / Run bar */}
          <div className="flex-shrink-0 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
              <input
                value={testMessage}
                onChange={e => setTestMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !running && runStatus !== 'waiting_hitl' && runAgent()}
                placeholder="Enter agent input and press Run…"
                style={{
                  flex: 1, padding: '7px 12px', borderRadius: 7, fontSize: 12, outline: 'none',
                  background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
                  minWidth: 0, height: 34,
                }}
              />
              <button
                onClick={runAgent}
                disabled={running || runStatus === 'waiting_hitl'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, flexShrink: 0, height: 34,
                  background: (running || runStatus === 'waiting_hitl') ? 'var(--surface2)' : 'var(--blue)',
                  color: (running || runStatus === 'waiting_hitl') ? 'var(--text3)' : '#fff',
                  border: 'none', cursor: (running || runStatus === 'waiting_hitl') ? 'not-allowed' : 'pointer',
                }}>
                {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Run
              </button>
            </div>
          </div>

          {/* Trace */}
          <TracePanel trace={trace} status={runStatus} tokens={runResult?.tokens} latencyMs={runResult?.latencyMs} />
        </div>
      </div>
    </div>
  )
}
