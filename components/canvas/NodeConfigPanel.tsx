'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Brain, Wrench, GitBranch, UserCheck, ChevronDown, Plus, Trash2, Shield, Database, Search, Globe, ArrowRightLeft } from 'lucide-react'
import { NodeData, MemorySource } from '@/types/agent'
import { useRegistry } from '@/lib/hooks/useRegistry'

interface Tool { id: string; name: string; description: string; type: string; endpoint?: string; method: string; headers: Record<string, string>; input_schema: Record<string, unknown>; timeout: number; created_at: string }
interface Prompt { id: string; name: string; content: string; created_at: string }
interface ModelConfig { id: string; name: string; model_id: string; provider: string; temperature: number; max_tokens: number; created_at: string }
interface Guardrail { id: string; name: string; created_at: string }
interface MemoryConfig { id: string; name: string; type: string; window_size: number; created_at: string }
interface DatatableCol { name: string; type: string; isPrimaryKey?: boolean; required?: boolean }
interface Datatable { id: string; name: string; columns: DatatableCol[]; created_at: string }

interface NodeConfigPanelProps {
  nodeId: string
  nodeData: NodeData
  allNodes: { id: string; data: { label: string; nodeType: string } }[]
  onUpdate: (data: Partial<NodeData>) => void
  onClose: () => void
  onAfterToolSave?: () => void
}


const NODE_META: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  input:       { color: '#64b5f6', bg: 'rgba(100,181,246,0.1)', icon: ArrowRightLeft, label: 'I/O Node' },
  passthrough: { color: '#64b5f6', bg: 'rgba(100,181,246,0.1)', icon: ArrowRightLeft, label: 'I/O Node' },
  llm:         { color: '#7c6ff0', bg: 'rgba(124,111,240,0.1)', icon: Brain,          label: 'LLM Node' },
  tool:        { color: '#22d79a', bg: 'rgba(34,215,154,0.1)',  icon: Wrench,         label: 'Tool Node' },
  condition:   { color: '#f5a020', bg: 'rgba(245,160,32,0.1)',  icon: GitBranch,      label: 'Condition Node' },
  hitl:        { color: '#b080f8', bg: 'rgba(176,128,248,0.1)', icon: UserCheck,      label: 'HITL Node' },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
      {children}
    </div>
  )
}


const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 12, outline: 'none',
  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit',
}
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', cursor: 'pointer' }

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const SEARCH_PROVIDERS = [
  { value: 'duckduckgo', label: 'DuckDuckGo (free, no key)' },
  { value: 'tavily',     label: 'Tavily' },
  { value: 'serper',     label: 'Serper (Google)' },
]

type HeaderRow = { key: string; value: string }

function headersToRows(h: Record<string, string>): HeaderRow[] {
  const rows = Object.entries(h ?? {}).map(([key, value]) => ({ key, value }))
  rows.push({ key: '', value: '' })
  return rows.length ? rows : [{ key: '', value: '' }]
}

export default function NodeConfigPanel({ nodeId, nodeData, allNodes, onUpdate, onClose, onAfterToolSave }: NodeConfigPanelProps) {
  const { items: tools, saving: toolSaving, update: updateTool, create: createTool } = useRegistry<Tool>('/api/tools')
  const { items: prompts }      = useRegistry<Prompt>('/api/prompts')
  const { items: modelConfigs } = useRegistry<ModelConfig>('/api/models')
  const { items: guardrails }   = useRegistry<Guardrail>('/api/guardrails')
  const { items: memoryConfigs} = useRegistry<MemoryConfig>('/api/memory')
  const { items: datatables }   = useRegistry<Datatable>('/api/datatables')

  const [label, setLabel]               = useState(nodeData.label)
  const [model, setModel]               = useState(nodeData.model ?? '')
  const [temperature, setTemperature]   = useState(String(nodeData.temperature ?? 0.7))
  const [systemPrompt, setSystemPrompt] = useState(nodeData.systemPrompt ?? '')
  const [selectedPromptId, setSelectedPromptId] = useState('')
  const [guardrailId, setGuardrailId]   = useState((nodeData.guardrailId as string) ?? '')
  const [memorySources, setMemorySources] = useState<MemorySource[]>((nodeData.memorySources as MemorySource[]) ?? [])
  const [toolName, setToolName]         = useState(nodeData.toolName ?? '')
  const [condition, setCondition]       = useState(nodeData.condition ?? '')
  const [question, setQuestion]         = useState(nodeData.question ?? '')

  // Inline tool editor state — seed from inline toolConfig saved on node data
  const _inlineCfg = nodeData.toolConfig as Record<string, unknown> | undefined
  const _inlineSchema = _inlineCfg?.input_schema as Record<string, unknown> | undefined
  const [toolType, setToolType]           = useState((_inlineCfg?.type as string) ?? 'http')
  const [toolMethod, setToolMethod]       = useState('POST')
  const [toolEndpoint, setToolEndpoint]   = useState('')
  const [toolHeaders, setToolHeaders]     = useState<HeaderRow[]>([{ key: '', value: '' }])
  const [toolBody, setToolBody]           = useState('')
  const [toolRespPath, setToolRespPath]   = useState('')
  const [toolTimeout, setToolTimeout]     = useState('10000')
  const [toolProvider, setToolProvider]   = useState('duckduckgo')
  const [toolApiKey, setToolApiKey]       = useState('')
  const [toolMaxResults, setToolMaxResults] = useState('5')
  const [toolSaved, setToolSaved]         = useState(false)
  const [compressOutput, setCompressOutput] = useState(!!(nodeData.compressOutput))
  const [compressModel, setCompressModel]   = useState((nodeData.compressModel as string) ?? '')
  // Datatable tool state — seeded from inline toolConfig so reopening panel restores correctly
  const [dtId, setDtId]       = useState((_inlineSchema?.datatable_id as string) ?? '')
  const [dtMode, setDtMode]   = useState<'import' | 'export'>(((_inlineSchema?.mode as string) ?? 'import') as 'import' | 'export')
  const [dtPkFilter, setDtPkFilter] = useState((_inlineSchema?.pk_filter as string) ?? '')
  const lastToolId = useRef<string | null>(null)

  // Passthrough / I/O node state
  const [template, setTemplate] = useState((nodeData.template as string) ?? '')

  // When selected tool changes, populate edit state
  useEffect(() => {
    const t = tools.find(x => x.name === toolName)
    if (!t || t.id === lastToolId.current) return
    lastToolId.current = t.id
    const s = t.input_schema ?? {}
    setToolType(t.type ?? 'http')
    setToolMethod(t.method ?? 'POST')
    setToolEndpoint(t.endpoint ?? '')
    setToolHeaders(headersToRows(t.headers ?? {}))
    setToolBody((s.body_template as string) ?? '')
    setToolRespPath((s.response_path as string) ?? '')
    setToolTimeout(String(t.timeout ?? 10000))
    setToolProvider((s.provider as string) ?? 'duckduckgo')
    setToolApiKey((s.api_key as string) ?? '')
    setToolMaxResults(String((s.max_results as number) ?? 5))
    if (t.type === 'datatable') {
      // Prefer inline toolConfig saved on node data (more up-to-date than DB registry)
      const inlineSchema = (nodeData.toolConfig as Record<string, unknown> | undefined)?.input_schema as Record<string, unknown> | undefined
      setDtId((inlineSchema?.datatable_id as string) ?? (s.datatable_id as string) ?? '')
      setDtMode(((inlineSchema?.mode ?? s.mode ?? 'import') as string) as 'import' | 'export')
      setDtPkFilter((inlineSchema?.pk_filter as string) ?? (s.pk_filter as string) ?? '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolName, tools.length])

  const saveToolEdits = async () => {
    const t = tools.find(x => x.name === toolName)
    const headers: Record<string, string> = {}
    for (const { key, value } of toolHeaders) if (key.trim()) headers[key.trim()] = value
    const selectedDt = datatables.find(d => d.id === dtId)
    const payload: Record<string, unknown> = {
      type: toolType, method: toolType === 'http' ? toolMethod : 'GET',
      endpoint: toolType === 'http' ? toolEndpoint.trim() : '',
      headers: toolType === 'http' ? headers : {},
      timeout: parseInt(toolTimeout) || 10000,
      inputSchema: toolType === 'http'
        ? { body_template: toolBody.trim(), response_path: toolRespPath.trim() }
        : toolType === 'web_search'
          ? { provider: toolProvider, api_key: toolApiKey.trim(), max_results: parseInt(toolMaxResults) || 5 }
          : toolType === 'datatable'
            ? { datatable_id: dtId, datatable_name: selectedDt?.name ?? '', mode: dtMode, columns: selectedDt?.columns ?? [], pk_filter: dtPkFilter.trim() }
            : { api_key: toolApiKey.trim() },
    }
    let savedName = toolName
    if (t) {
      await updateTool(t.id, payload)
    } else {
      // Create new inline — use label as name
      const newTool = await createTool({ name: label || 'New Tool', description: '', ...payload })
      savedName = newTool.name
      setToolName(newTool.name)
      lastToolId.current = null // force re-populate
    }
    // Embed toolConfig inline on the node so the run route has a reliable fallback
    // even if the tool table lookup misses (e.g. name mismatch or stale DB record)
    onUpdate({
      toolName: savedName,
      toolConfig: {
        type: toolType,
        endpoint: toolType === 'http' ? toolEndpoint.trim() : '',
        method: toolType === 'http' ? toolMethod : 'GET',
        headers: toolType === 'http' ? Object.fromEntries(toolHeaders.filter(r => r.key.trim()).map(r => [r.key.trim(), r.value])) : {},
        timeout: parseInt(toolTimeout) || 10000,
        input_schema: payload.inputSchema,
      },
    })
    // Force an immediate agent save so toolConfig is persisted in the schema
    setTimeout(() => onAfterToolSave?.(), 350)
    setToolSaved(true)
    setTimeout(() => setToolSaved(false), 2000)
  }

  const setHeader = (i: number, field: 'key' | 'value', val: string) => {
    setToolHeaders(rows => {
      const next = [...rows]
      next[i] = { ...next[i], [field]: val }
      if (i === next.length - 1 && (next[i].key || next[i].value)) next.push({ key: '', value: '' })
      return next
    })
  }
  const removeHeader = (i: number) => setToolHeaders(rows => rows.filter((_, idx) => idx !== i))

  // Add memory source form state
  const [addingMemory, setAddingMemory] = useState(false)
  const [newMemType, setNewMemType]     = useState<'agent_runs' | 'node_output'>('agent_runs')
  const [newMemConfigId, setNewMemConfigId] = useState('')
  const [newMemNodeId, setNewMemNodeId] = useState('')

  const upstreamNodes = allNodes.filter(n => n.id !== nodeId && n.data.nodeType !== 'input' && n.data.nodeType !== 'output')

  // When model configs finish loading, auto-select the first config if no valid model is set
  const modelConfigsLoaded = useRef(false)
  useEffect(() => {
    if (modelConfigs.length === 0) return
    if (modelConfigsLoaded.current) return
    modelConfigsLoaded.current = true
    const valid = modelConfigs.some(m => m.name === model)
    if (!valid) {
      const first = modelConfigs[0].name
      setModel(first)
      onUpdate({ model: first })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelConfigs.length])

  const addMemorySource = () => {
    if (newMemType === 'agent_runs' && !newMemConfigId) return
    if (newMemType === 'node_output' && !newMemNodeId) return
    const node = upstreamNodes.find(n => n.id === newMemNodeId)
    const newSrc: MemorySource = {
      id: Date.now().toString(),
      type: newMemType,
      memoryConfigId: newMemType === 'agent_runs' ? newMemConfigId : undefined,
      nodeId: newMemType === 'node_output' ? newMemNodeId : undefined,
      nodeLabel: newMemType === 'node_output' ? (node?.data.label ?? newMemNodeId) : undefined,
    }
    const updated = [...memorySources, newSrc]
    setMemorySources(updated)
    onUpdate({ memorySources: updated })
    setAddingMemory(false)
    setNewMemConfigId('')
    setNewMemNodeId('')
  }

  const removeMemorySource = (id: string) => {
    const updated = memorySources.filter(s => s.id !== id)
    setMemorySources(updated)
    onUpdate({ memorySources: updated })
  }

  const meta = NODE_META[nodeData.nodeType ?? ''] ?? NODE_META.llm
  const Icon = meta.icon

  return (
    <div style={{
      width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--surface)', borderLeft: `2px solid ${meta.color}`, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: meta.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} style={{ color: meta.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{meta.label}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{nodeId.slice(0, 12)}…</div>
        </div>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text3)', cursor: 'pointer', flexShrink: 0 }}>
          <X size={12} />
        </button>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        <Field label="Label">
          <input value={label} onChange={e => { setLabel(e.target.value); onUpdate({ label: e.target.value }) }} style={inputStyle} placeholder="Node label" />
        </Field>

        {/* LLM config */}
        {nodeData.nodeType === 'llm' && (<>
          <Field label="Model Config">
            <div style={{ position: 'relative' }}>
              {modelConfigs.length === 0 ? (
                <select disabled style={{ ...selectStyle, color: 'var(--text3)' }}>
                  <option>{model || 'Loading models…'}</option>
                </select>
              ) : (
                <select value={model} onChange={e => { setModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                  {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name} · {m.model_id}</option>)}
                </select>
              )}
              <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            </div>
          </Field>

          <Field label="Temperature">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input value={temperature} onChange={e => { setTemperature(e.target.value); onUpdate({ temperature: parseFloat(e.target.value) }) }} type="range" min="0" max="2" step="0.1" style={{ flex: 1, accentColor: meta.color }} />
              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: meta.color, width: 28, textAlign: 'center', padding: '3px 6px', borderRadius: 5, background: meta.bg }}>
                {parseFloat(temperature).toFixed(1)}
              </span>
            </div>
          </Field>

          {/* Guardrail */}
          <Field label="Guardrail">
            <div style={{ position: 'relative' }}>
              <select value={guardrailId} onChange={e => { setGuardrailId(e.target.value); onUpdate({ guardrailId: e.target.value || undefined }) }} style={{ ...selectStyle, color: guardrailId ? 'var(--red)' : 'var(--text3)' }}>
                <option value="">— None —</option>
                {guardrails.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <Shield size={10} style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)', color: guardrailId ? 'var(--red)' : 'var(--text3)', pointerEvents: 'none' }} />
              <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            </div>
          </Field>

          {/* Memory Sources */}
          <Field label="Memory Sources">
            {memorySources.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                {memorySources.map(src => {
                  const label = src.type === 'agent_runs'
                    ? `Past runs · ${memoryConfigs.find(m => m.id === src.memoryConfigId)?.name ?? src.memoryConfigId}`
                    : `Node output · ${src.nodeLabel ?? src.nodeId}`
                  return (
                    <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, background: 'rgba(124,111,240,0.08)', border: '1px solid rgba(124,111,240,0.2)' }}>
                      <Database size={9} color="var(--blue)" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: 'var(--text2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                      <button onClick={() => removeMemorySource(src.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0, flexShrink: 0 }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {addingMemory ? (
              <div style={{ padding: '10px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <select value={newMemType} onChange={e => setNewMemType(e.target.value as 'agent_runs' | 'node_output')} style={{ ...selectStyle, fontSize: 11 }}>
                    <option value="agent_runs">Past agent runs (cross-session)</option>
                    <option value="node_output">Upstream node output</option>
                  </select>
                  <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                </div>

                {newMemType === 'agent_runs' && (
                  <div style={{ position: 'relative' }}>
                    <select value={newMemConfigId} onChange={e => setNewMemConfigId(e.target.value)} style={{ ...selectStyle, fontSize: 11 }}>
                      <option value="">— pick memory config —</option>
                      {memoryConfigs.map(m => <option key={m.id} value={m.id}>{m.name} ({m.type}, {m.window_size} turns)</option>)}
                    </select>
                    <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                  </div>
                )}

                {newMemType === 'node_output' && (
                  <div style={{ position: 'relative' }}>
                    <select value={newMemNodeId} onChange={e => setNewMemNodeId(e.target.value)} style={{ ...selectStyle, fontSize: 11 }}>
                      <option value="">— pick node —</option>
                      {upstreamNodes.map(n => <option key={n.id} value={n.id}>{n.data.label} ({n.data.nodeType})</option>)}
                    </select>
                    <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={addMemorySource} style={{ flex: 1, padding: '5px 0', borderRadius: 6, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Add</button>
                  <button onClick={() => { setAddingMemory(false); setNewMemConfigId(''); setNewMemNodeId('') }} style={{ flex: 1, padding: '5px 0', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingMemory(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 0', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>
                <Plus size={10} /> Add memory source
              </button>
            )}
          </Field>

          {/* System Prompt */}
          <Field label="System Prompt">
            {prompts.length > 0 && (
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <select value={selectedPromptId} onChange={e => { setSelectedPromptId(e.target.value); const p = prompts.find(x => x.id === e.target.value); if (p) { setSystemPrompt(p.content); onUpdate({ systemPrompt: p.content }) } }} style={{ ...selectStyle, fontSize: 11, color: 'var(--text3)' }}>
                  <option value="">— pick from registry —</option>
                  {prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            )}
            <textarea value={systemPrompt} onChange={e => { setSystemPrompt(e.target.value); onUpdate({ systemPrompt: e.target.value }) }} rows={6} placeholder="You are a helpful assistant..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, minHeight: 96 }} />
          </Field>
        </>)}

        {/* Passthrough / I/O node config */}
        {(nodeData.nodeType === 'passthrough' || nodeData.nodeType === 'input') && (<>
          <Field label="Template">
            <textarea
              value={template}
              onChange={e => { setTemplate(e.target.value); onUpdate({ template: e.target.value }) }}
              rows={6}
              placeholder={'{{last_output}}\n\nOr add extra context:\nContext: {{last_output}}\nUser asked: {{input}}'}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, minHeight: 100 }}
            />
          </Field>
          <div style={{ padding: '8px 10px', borderRadius: 7, fontSize: 10, background: 'rgba(100,181,246,0.08)', border: '1px solid rgba(100,181,246,0.2)', color: 'var(--text3)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text2)' }}>Variables:</strong><br />
            <code style={{ background: 'var(--bg)', padding: '0 3px', borderRadius: 3 }}>{'{{last_output}}'}</code> — previous node output<br />
            <code style={{ background: 'var(--bg)', padding: '0 3px', borderRadius: 3 }}>{'{{input}}'}</code> — original pipeline input<br />
            <code style={{ background: 'var(--bg)', padding: '0 3px', borderRadius: 3 }}>{'{{node.NODE_ID}}'}</code> — any upstream node<br />
            <span style={{ marginTop: 4, display: 'block' }}>Leave empty to pass through unchanged.</span>
          </div>
        </>)}

        {/* Tool config */}
        {nodeData.nodeType === 'tool' && (<>
          <Field label="Tool">
            <div style={{ position: 'relative' }}>
              <select value={toolName} onChange={e => { setToolName(e.target.value); onUpdate({ toolName: e.target.value }); lastToolId.current = null }} style={selectStyle}>
                <option value="">— select or configure below —</option>
                {tools.map(t => <option key={t.id} value={t.name}>{t.name} [{t.type}]</option>)}
              </select>
              <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            </div>
          </Field>

          {/* Tool type selector */}
          <Field label="Type">
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ v: 'http', icon: <Wrench size={10} />, label: 'HTTP' }, { v: 'web_search', icon: <Search size={10} />, label: 'Search' }, { v: 'web_scrape', icon: <Globe size={10} />, label: 'Scrape' }, { v: 'datatable', icon: <Database size={10} />, label: 'Table' }].map(({ v, icon, label: lbl }) => (
                <button key={v} onClick={() => setToolType(v)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 4px', borderRadius: 6, border: `1px solid ${toolType === v ? '#22d79a' : 'var(--border)'}`, background: toolType === v ? 'rgba(34,215,154,0.1)' : 'var(--bg)', color: toolType === v ? '#22d79a' : 'var(--text3)', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                  {icon}{lbl}
                </button>
              ))}
            </div>
          </Field>

          {/* HTTP fields */}
          {toolType === 'http' && (<>
            <Field label="Method + URL">
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ position: 'relative', width: 72, flexShrink: 0 }}>
                  <select value={toolMethod} onChange={e => setToolMethod(e.target.value)} style={{ ...selectStyle, fontSize: 11, padding: '6px 20px 6px 8px' }}>
                    {HTTP_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                  <ChevronDown size={9} style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                </div>
                <input value={toolEndpoint} onChange={e => setToolEndpoint(e.target.value)} style={{ ...inputStyle, fontSize: 11, flex: 1, minWidth: 0 }} placeholder="https://api.example.com/search?q={{last_output}}" />
              </div>
            </Field>
            <Field label="Headers">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {toolHeaders.map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input value={row.key} onChange={e => setHeader(i, 'key', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 10, padding: '5px 7px' }} placeholder="Header" />
                    <input value={row.value} onChange={e => setHeader(i, 'value', e.target.value)} style={{ ...inputStyle, flex: 2, fontSize: 10, padding: '5px 7px' }} placeholder="Value / {{last_output}}" />
                    {toolHeaders.length > 1 && <button onClick={() => removeHeader(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', flexShrink: 0, padding: 0 }}><X size={10} /></button>}
                  </div>
                ))}
              </div>
            </Field>
            {!['GET', 'DELETE', 'HEAD'].includes(toolMethod) && (
              <Field label="Body Template (JSON)">
                <textarea value={toolBody} onChange={e => setToolBody(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 10, lineHeight: 1.5, padding: '6px 8px' }} placeholder={'{\n  "query": "{{last_output}}"\n}'} />
                <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>Leave empty → auto-sends {'{"input":"{{last_output}}"}'}</div>
              </Field>
            )}
            <Field label="Response Path (optional)">
              <input value={toolRespPath} onChange={e => setToolRespPath(e.target.value)} style={{ ...inputStyle, fontSize: 11 }} placeholder="results.0.text" />
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>Dot notation to extract field from JSON response</div>
            </Field>
            <Field label="Timeout (ms)">
              <input value={toolTimeout} onChange={e => setToolTimeout(e.target.value)} type="number" style={{ ...inputStyle, fontSize: 11 }} />
            </Field>
          </>)}

          {/* Web search fields */}
          {toolType === 'web_search' && (<>
            <Field label="Provider">
              <div style={{ position: 'relative' }}>
                <select value={toolProvider} onChange={e => setToolProvider(e.target.value)} style={selectStyle}>
                  {SEARCH_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            </Field>
            {toolProvider !== 'duckduckgo' && (
              <Field label="API Key">
                <input value={toolApiKey} onChange={e => setToolApiKey(e.target.value)} style={inputStyle} placeholder={toolProvider === 'tavily' ? 'tvly-...' : 'your-serper-key'} />
              </Field>
            )}
            <Field label="Max Results">
              <input value={toolMaxResults} onChange={e => setToolMaxResults(e.target.value)} type="number" min="1" max="20" style={{ ...inputStyle, width: 100 }} />
            </Field>
            <div style={{ fontSize: 10, color: 'var(--text3)', padding: '6px 8px', borderRadius: 6, background: 'rgba(34,215,154,0.06)', border: '1px solid rgba(34,215,154,0.15)' }}>
              Uses prev node output as search query automatically.
            </div>
          </>)}

          {/* Web scrape fields */}
          {toolType === 'web_scrape' && (<>
            <Field label="Jina API Key (optional)">
              <input value={toolApiKey} onChange={e => setToolApiKey(e.target.value)} style={inputStyle} placeholder="jina_..." />
            </Field>
            <div style={{ fontSize: 10, color: 'var(--text3)', padding: '6px 8px', borderRadius: 6, background: 'rgba(34,215,154,0.06)', border: '1px solid rgba(34,215,154,0.15)' }}>
              Uses prev node output as the URL to scrape via jina.ai/reader.
            </div>
          </>)}

          {/* Datatable fields */}
          {toolType === 'datatable' && (<>
            <Field label="Datatable">
              <select value={dtId} onChange={e => setDtId(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 11 }}>
                <option value="">— select a datatable —</option>
                {datatables.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Mode">
              <div style={{ display: 'flex', gap: 4 }}>
                {(['import', 'export'] as const).map(m => (
                  <button key={m} onClick={() => setDtMode(m)} style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: `1px solid ${dtMode === m ? '#7c6ff0' : 'var(--border)'}`, background: dtMode === m ? 'rgba(124,111,240,0.15)' : 'var(--bg)', color: dtMode === m ? '#7c6ff0' : 'var(--text3)', cursor: 'pointer', fontSize: 10, fontWeight: 700, textTransform: 'capitalize' }}>
                    {m === 'import' ? '⬇ Import' : '⬆ Export'}
                  </button>
                ))}
              </div>
            </Field>
            {dtId && (() => {
              const dt = datatables.find(d => d.id === dtId)
              if (!dt) return null
              return (
                <div style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 10 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 9 }}>Columns</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {dt.columns.map(c => (
                      <span key={c.name} style={{ padding: '2px 7px', borderRadius: 4, background: c.isPrimaryKey ? 'rgba(124,111,240,0.15)' : 'var(--surface2)', border: `1px solid ${c.isPrimaryKey ? 'rgba(124,111,240,0.4)' : 'var(--border)'}`, color: c.isPrimaryKey ? '#7c6ff0' : 'var(--text2)', fontSize: 10 }}>
                        {c.name} <span style={{ opacity: 0.6 }}>({c.type})</span>{c.isPrimaryKey ? ' 🔑' : ''}
                      </span>
                    ))}
                  </div>
                  {dtMode === 'import' && dt.columns.some(c => c.isPrimaryKey) && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Filter by {dt.columns.find(c => c.isPrimaryKey)?.name} (PK)
                      </div>
                      <input
                        value={dtPkFilter}
                        onChange={e => setDtPkFilter(e.target.value)}
                        placeholder={`e.g. alice  or  {{last_output}}`}
                        style={{ width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                      />
                      <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>
                        Leave blank to import all rows. Use <code style={{ background: 'var(--surface2)', padding: '1px 4px', borderRadius: 3 }}>{'{{last_output}}'}</code> to filter by the previous node&apos;s output.
                      </div>
                    </div>
                  )}
                  {dtMode === 'export' && (
                    <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text3)' }}>
                      Previous LLM node must output a JSON object with matching column keys.
                    </div>
                  )}
                </div>
              )
            })()}
          </>)}

          {/* Compress output toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 7, background: compressOutput ? 'rgba(124,111,240,0.08)' : 'var(--bg)', border: `1px solid ${compressOutput ? 'rgba(124,111,240,0.3)' : 'var(--border)'}`, marginBottom: compressOutput ? 4 : 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>Compress large output</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>Recursively chunk + summarise responses &gt;1500 chars before passing to next node</div>
            </div>
            <button
              onClick={() => { const next = !compressOutput; setCompressOutput(next); onUpdate({ compressOutput: next }) }}
              style={{ width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', position: 'relative', background: compressOutput ? 'var(--blue)' : 'var(--border)', padding: 0, flexShrink: 0 }}>
              <span style={{ position: 'absolute', width: 13, height: 13, borderRadius: '50%', background: '#fff', top: 2.5, left: compressOutput ? 16 : 3, transition: 'left 0.2s' }} />
            </button>
          </div>
          {compressOutput && (
            <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compression model</div>
              <select
                value={compressModel}
                onChange={e => { setCompressModel(e.target.value); onUpdate({ compressModel: e.target.value || undefined }) }}
                style={{ width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 11 }}
              >
                <option value="">Auto (first model)</option>
                {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
          )}

          <button onClick={saveToolEdits} disabled={toolSaving} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, width: '100%', padding: '7px 0', borderRadius: 7, border: 'none', background: toolSaved ? 'rgba(34,215,154,0.15)' : 'rgba(34,215,154,0.2)', color: toolSaved ? '#22d79a' : '#22d79a', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
            {toolSaved ? '✓ Saved' : toolSaving ? 'Saving…' : (toolName ? 'Save Tool Changes' : 'Create & Assign Tool')}
          </button>
        </>)}

        {/* Condition config */}
        {nodeData.nodeType === 'condition' && (<>
          <Field label="Evaluator Model">
            <div style={{ position: 'relative' }}>
              {modelConfigs.length === 0 ? (
                <select disabled style={{ ...selectStyle, color: 'var(--text3)' }}>
                  <option>Loading models…</option>
                </select>
              ) : (
                <select value={model} onChange={e => { setModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                  <option value="">— use any available —</option>
                  {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name} · {m.model_id}</option>)}
                </select>
              )}
              <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            </div>
          </Field>
          <Field label="Condition Expression">
            <textarea value={condition} onChange={e => { setCondition(e.target.value); onUpdate({ condition: e.target.value }) }} rows={4} placeholder="e.g. the response mentions an error" style={{ ...inputStyle, resize: 'vertical', fontSize: 11, lineHeight: 1.6 }} />
          </Field>
          <div style={{ padding: '8px 10px', borderRadius: 7, fontSize: 10, background: 'rgba(245,160,32,0.08)', border: '1px solid rgba(245,160,32,0.2)', color: 'var(--text3)', lineHeight: 1.5 }}>
            Evaluated by LLM. <span style={{ color: '#22d79a', fontWeight: 700 }}>True</span> → top handle · <span style={{ color: 'var(--red)', fontWeight: 700 }}>False</span> → bottom handle
          </div>
        </>)}

        {/* HITL config */}
        {nodeData.nodeType === 'hitl' && (<>
          <Field label="Checkpoint Question">
            <textarea value={question} onChange={e => { setQuestion(e.target.value); onUpdate({ question: e.target.value }) }} rows={4} placeholder="What should the reviewer check before approving?" style={{ ...inputStyle, resize: 'vertical', fontSize: 11, lineHeight: 1.6 }} />
          </Field>
          <div style={{ padding: '8px 10px', borderRadius: 7, fontSize: 10, background: 'rgba(176,128,248,0.08)', border: '1px solid rgba(176,128,248,0.2)', color: 'var(--text3)', lineHeight: 1.5 }}>
            Pipeline pauses here. Resume via dashboard or API.
          </div>
        </>)}
      </div>
    </div>
  )
}
