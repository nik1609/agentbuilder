'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Brain, Wrench, GitBranch, UserCheck, HelpCircle, ChevronDown, Plus, Trash2, Shield, Database, Search, Globe, ArrowRightLeft, RefreshCw, GitFork, Merge, ToggleLeft } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
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
  clarify:     { color: '#f472b6', bg: 'rgba(244,114,182,0.1)', icon: HelpCircle,    label: 'Clarify Node' },
  loop:        { color: '#ff7043', bg: 'rgba(255,112,67,0.1)',  icon: RefreshCw,      label: 'Loop Node' },
  fork:        { color: '#26c6da', bg: 'rgba(38,198,218,0.1)',  icon: GitFork,        label: 'Fork Node' },
  join:        { color: '#26c6da', bg: 'rgba(38,198,218,0.1)',  icon: Merge,          label: 'Join Node' },
  switch:      { color: '#ffd600', bg: 'rgba(255,214,0,0.1)',   icon: ToggleLeft,     label: 'Switch Node' },
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

function RetryConfig({ color, bg, enabled, maxAttempts, backoffMs, retryOn, onToggle, onMax, onBackoff, onRetryOn }: {
  color: string; bg: string; enabled: boolean; maxAttempts: string; backoffMs: string; retryOn: 'error' | 'empty_output' | 'guardrail_block'
  onToggle: (v: boolean) => void; onMax: (v: string) => void; onBackoff: (v: string) => void; onRetryOn: (v: 'error' | 'empty_output' | 'guardrail_block') => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: enabled ? '7px 7px 0 0' : 7, background: enabled ? bg : 'var(--bg)', border: `1px solid ${enabled ? color + '50' : 'var(--border)'}`, borderBottom: enabled ? 'none' : undefined }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>Auto-Retry</div>
          <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>Retry on failure with exponential backoff</div>
        </div>
        <button onClick={() => onToggle(!enabled)} style={{ width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', position: 'relative', background: enabled ? color : 'var(--border)', padding: 0, flexShrink: 0 }}>
          <span style={{ position: 'absolute', width: 13, height: 13, borderRadius: '50%', background: '#fff', top: 2.5, left: enabled ? 16 : 3, transition: 'left 0.2s' }} />
        </button>
      </div>
      {enabled && (
        <div style={{ padding: '10px', borderRadius: '0 0 7px 7px', background: bg, border: `1px solid ${color}50`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Max attempts</div>
              <input value={maxAttempts} onChange={e => onMax(e.target.value)} type="number" min={1} max={10} style={{ width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 11, outline: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Backoff (ms)</div>
              <input value={backoffMs} onChange={e => onBackoff(e.target.value)} type="number" min={100} step={100} style={{ width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 11, outline: 'none' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Retry on</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([{ v: 'error', label: 'Error' }, { v: 'empty_output', label: 'Empty output' }] as const).map(({ v, label }) => (
                <button key={v} onClick={() => onRetryOn(v)} style={{ flex: 1, padding: '5px', borderRadius: 5, border: `1px solid ${retryOn === v ? color : 'var(--border)'}`, background: retryOn === v ? color + '20' : 'var(--bg)', color: retryOn === v ? color : 'var(--text3)', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
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
  const [maxTokens, setMaxTokens]       = useState(String(nodeData.maxTokens ?? ''))
  const [systemPrompt, setSystemPrompt] = useState(nodeData.systemPrompt ?? '')
  const [selectedPromptId, setSelectedPromptId] = useState('')
  const [guardrailId, setGuardrailId]   = useState((nodeData.guardrailId as string) ?? '')
  const [memorySources, setMemorySources] = useState<MemorySource[]>((nodeData.memorySources as MemorySource[]) ?? [])
  const [toolName, setToolName]         = useState(nodeData.toolName ?? '')
  const [condition, setCondition]       = useState(nodeData.condition ?? '')
  const [question, setQuestion]         = useState(nodeData.question ?? '')

  // Agentic mode (LLM node)
  const [agenticMode, setAgenticMode]   = useState(!!(nodeData.agenticMode))
  const [boundTools, setBoundTools]     = useState<string[]>((nodeData.boundTools as string[] | undefined) ?? [])

  // Retry config (LLM + tool nodes)
  const _retry = nodeData.retry as { enabled?: boolean; maxAttempts?: number; backoffMs?: number; retryOn?: string } | undefined
  const [retryEnabled, setRetryEnabled]   = useState(_retry?.enabled ?? false)
  const [retryMax, setRetryMax]           = useState(String(_retry?.maxAttempts ?? 3))
  const [retryBackoff, setRetryBackoff]   = useState(String(_retry?.backoffMs ?? 1000))
  const [retryOn, setRetryOn]             = useState<'error' | 'empty_output' | 'guardrail_block'>((_retry?.retryOn as 'error' | 'empty_output' | 'guardrail_block') ?? 'error')

  // Loop node state
  const [loopMaxIter, setLoopMaxIter]         = useState(String(nodeData.maxIterations ?? 5))
  const [loopExitCond, setLoopExitCond]       = useState((nodeData.exitCondition as string) ?? '')
  const [loopExitType, setLoopExitType]       = useState((nodeData.exitConditionType as string) ?? 'expression')
  const [loopOnMax, setLoopOnMax]             = useState((nodeData.onMaxReached as string) ?? 'continue')
  const [loopModel, setLoopModel]             = useState((nodeData.model as string) ?? '')

  // Fork node state
  const [forkBranches, setForkBranches]       = useState<{id: string; label: string}[]>((nodeData.branches as {id: string; label: string}[]) ?? [{ id: uuidv4(), label: 'Branch A' }, { id: uuidv4(), label: 'Branch B' }])
  const [forkInputMode, setForkInputMode]     = useState((nodeData.inputMode as string) ?? 'broadcast')

  // Join node state
  const [joinMode, setJoinMode]               = useState((nodeData.joinMode as string) ?? 'wait_all')
  const [joinMergeFormat, setJoinMergeFormat] = useState((nodeData.mergeFormat as string) ?? 'array')
  const [joinMergeAs, setJoinMergeAs]         = useState((nodeData.mergeAs as string) ?? '')

  // Switch node state
  const [switchType, setSwitchType]           = useState((nodeData.switchType as string) ?? 'value_match')
  const [switchInputKey, setSwitchInputKey]   = useState((nodeData.inputKey as string) ?? '')
  const [switchCases, setSwitchCases]         = useState<{label: string; match: string}[]>((nodeData.cases as {label: string; match: string}[]) ?? [{ label: 'Case A', match: '' }, { label: 'Case B', match: '' }])
  const [switchDefault, setSwitchDefault]     = useState((nodeData.defaultCase as string) ?? '')
  const [switchModel, setSwitchModel]         = useState((nodeData.model as string) ?? '')

  // Clarify node state
  const [clarifyMode, setClarifyMode]                 = useState<'static' | 'llm'>((nodeData.clarifyMode as 'static' | 'llm') ?? 'llm')
  const [staticQuestion, setStaticQuestion]           = useState((nodeData.staticQuestion as string) ?? '')
  const [clarifySystemPrompt, setClarifySystemPrompt] = useState((nodeData.clarifySystemPrompt as string) ?? '')
  const [clarifyModel, setClarifyModel]               = useState((nodeData.model as string) ?? '')

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
              <select value={model} onChange={e => { setModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                <option value="">Default (Gemini 2.5 Flash)</option>
                {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name} · {m.model_id}</option>)}
              </select>
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

          <Field label="Max Tokens (optional)">
            <input value={maxTokens} onChange={e => { setMaxTokens(e.target.value); onUpdate({ maxTokens: e.target.value ? parseInt(e.target.value) : undefined }) }} type="number" min={1} max={128000} style={{ ...inputStyle, width: 120, fontSize: 11 }} placeholder="default" />
          </Field>

          {/* Agentic mode */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 7, background: agenticMode ? 'rgba(124,111,240,0.08)' : 'var(--bg)', border: `1px solid ${agenticMode ? 'rgba(124,111,240,0.3)' : 'var(--border)'}` }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>Agentic Mode</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>LLM auto-calls tools in a loop until it stops</div>
            </div>
            <button onClick={() => { const n = !agenticMode; setAgenticMode(n); onUpdate({ agenticMode: n }) }} style={{ width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', position: 'relative', background: agenticMode ? 'var(--blue)' : 'var(--border)', padding: 0, flexShrink: 0 }}>
              <span style={{ position: 'absolute', width: 13, height: 13, borderRadius: '50%', background: '#fff', top: 2.5, left: agenticMode ? 16 : 3, transition: 'left 0.2s' }} />
            </button>
          </div>

          {/* Bound Tools — only shown when agentic mode is on */}
          {agenticMode && (
            <Field label="Bound Tools">
              {/* Selected tools chips */}
              {boundTools.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                  {boundTools.map(t => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(124,111,240,0.12)', border: '1px solid rgba(124,111,240,0.3)', fontSize: 11, color: 'var(--blue)' }}>
                      <Wrench size={9} />
                      <span>{t}</span>
                      <button
                        onClick={() => { const n = boundTools.filter(x => x !== t); setBoundTools(n); onUpdate({ boundTools: n }) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)', display: 'flex', padding: 0, marginLeft: 2 }}
                      >
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Tool picker */}
              <div style={{ position: 'relative' }}>
                <select
                  value=""
                  onChange={e => {
                    const val = e.target.value
                    if (!val || boundTools.includes(val)) return
                    const n = [...boundTools, val]
                    setBoundTools(n)
                    onUpdate({ boundTools: n })
                  }}
                  style={{ ...selectStyle }}
                >
                  <option value="">+ Add tool…</option>
                  {tools.filter(t => !boundTools.includes(t.name)).map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                  {/* Built-in agentic tools */}
                  {!boundTools.includes('web_search') && <option value="web_search">web_search (built-in)</option>}
                  {!boundTools.includes('web_scrape') && <option value="web_scrape">web_scrape (built-in)</option>}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
                The LLM will decide when and how to call these tools. Only web_search and web_scrape are fully supported today.
              </div>
            </Field>
          )}

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

          {/* Retry */}
          <RetryConfig color={meta.color} bg={meta.bg} enabled={retryEnabled} maxAttempts={retryMax} backoffMs={retryBackoff} retryOn={retryOn}
            onToggle={v => { setRetryEnabled(v); onUpdate({ retry: { enabled: v, maxAttempts: parseInt(retryMax), backoffMs: parseInt(retryBackoff), retryOn } }) }}
            onMax={v => { setRetryMax(v); onUpdate({ retry: { enabled: retryEnabled, maxAttempts: parseInt(v) || 3, backoffMs: parseInt(retryBackoff), retryOn } }) }}
            onBackoff={v => { setRetryBackoff(v); onUpdate({ retry: { enabled: retryEnabled, maxAttempts: parseInt(retryMax), backoffMs: parseInt(v) || 1000, retryOn } }) }}
            onRetryOn={v => { setRetryOn(v); onUpdate({ retry: { enabled: retryEnabled, maxAttempts: parseInt(retryMax), backoffMs: parseInt(retryBackoff), retryOn: v } }) }}
          />
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
                <input type="password" value={toolApiKey} onChange={e => setToolApiKey(e.target.value)} style={inputStyle} placeholder={toolProvider === 'tavily' ? 'tvly-...' : 'your-serper-key'} />
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
              <input type="password" value={toolApiKey} onChange={e => setToolApiKey(e.target.value)} style={inputStyle} placeholder="jina_..." />
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

          {/* Retry */}
          <RetryConfig color="#22d79a" bg="rgba(34,215,154,0.08)" enabled={retryEnabled} maxAttempts={retryMax} backoffMs={retryBackoff} retryOn={retryOn}
            onToggle={v => { setRetryEnabled(v); onUpdate({ retry: { enabled: v, maxAttempts: parseInt(retryMax), backoffMs: parseInt(retryBackoff), retryOn } }) }}
            onMax={v => { setRetryMax(v); onUpdate({ retry: { enabled: retryEnabled, maxAttempts: parseInt(v) || 3, backoffMs: parseInt(retryBackoff), retryOn } }) }}
            onBackoff={v => { setRetryBackoff(v); onUpdate({ retry: { enabled: retryEnabled, maxAttempts: parseInt(retryMax), backoffMs: parseInt(v) || 1000, retryOn } }) }}
            onRetryOn={v => { setRetryOn(v); onUpdate({ retry: { enabled: retryEnabled, maxAttempts: parseInt(retryMax), backoffMs: parseInt(retryBackoff), retryOn: v } }) }}
          />
        </>)}

        {/* Condition config */}
        {nodeData.nodeType === 'condition' && (<>
          <Field label="Evaluator Model">
            <div style={{ position: 'relative' }}>
              <select value={model} onChange={e => { setModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                <option value="">Default (Gemini 2.5 Flash)</option>
                {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name} · {m.model_id}</option>)}
              </select>
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

        {/* Clarify config */}
        {nodeData.nodeType === 'clarify' && (<>
          {/* Mode toggle */}
          <Field label="Mode">
            <div style={{ display: 'flex', gap: 6 }}>
              {(['static', 'llm'] as const).map(m => (
                <button key={m} onClick={() => { setClarifyMode(m); onUpdate({ clarifyMode: m }) }} style={{
                  flex: 1, height: 32, borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${clarifyMode === m ? '#f472b6' : 'var(--border)'}`,
                  background: clarifyMode === m ? 'rgba(244,114,182,0.12)' : 'var(--surface2)',
                  color: clarifyMode === m ? '#f472b6' : 'var(--text3)',
                }}>
                  {m === 'static' ? 'Fixed Question' : 'LLM Generated'}
                </button>
              ))}
            </div>
          </Field>

          {clarifyMode === 'static' ? (<>
            <Field label="Question to ask the user">
              <textarea
                value={staticQuestion}
                onChange={e => { setStaticQuestion(e.target.value); onUpdate({ staticQuestion: e.target.value }) }}
                rows={3}
                placeholder="What are your spending details for today?"
                style={{ ...inputStyle, resize: 'vertical', fontSize: 11, lineHeight: 1.6 }}
              />
            </Field>
            <div style={{ padding: '8px 10px', borderRadius: 7, fontSize: 10, background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)', color: 'var(--text3)', lineHeight: 1.5 }}>
              Shows this exact question to the user. No LLM call. Flow pauses until the user replies in chat.
            </div>
          </>) : (<>
            <Field label="Question Model">
              <div style={{ position: 'relative' }}>
                <select value={clarifyModel} onChange={e => { setClarifyModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                  <option value="">Default (first configured model)</option>
                  {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name} · {m.model_id}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            </Field>
            <Field label="System Prompt (optional)">
              <textarea
                value={clarifySystemPrompt}
                onChange={e => { setClarifySystemPrompt(e.target.value); onUpdate({ clarifySystemPrompt: e.target.value }) }}
                rows={4}
                placeholder="You are a helpful assistant. Based on the context, ask ONE concise clarifying question to better understand what the user needs."
                style={{ ...inputStyle, resize: 'vertical', fontSize: 11, lineHeight: 1.6 }}
              />
            </Field>
            <div style={{ padding: '8px 10px', borderRadius: 7, fontSize: 10, background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)', color: 'var(--text3)', lineHeight: 1.5 }}>
              LLM generates a question from context. Flow pauses until the user replies in chat. The answer is injected into the next node&apos;s input.
            </div>
          </>)}
        </>)}

        {/* Loop config */}
        {nodeData.nodeType === 'loop' && (<>
          <Field label="Max Iterations">
            <input type="number" min={1} max={100} value={loopMaxIter} onChange={e => { setLoopMaxIter(e.target.value); onUpdate({ maxIterations: parseInt(e.target.value) || 5 }) }} style={{ ...inputStyle, width: 100 }} />
          </Field>
          <Field label="Exit Condition Type">
            <div style={{ display: 'flex', gap: 4 }}>
              {(['expression', 'llm'] as const).map(t => (
                <button key={t} onClick={() => { setLoopExitType(t); onUpdate({ exitConditionType: t }) }} style={{ flex: 1, padding: '6px', borderRadius: 6, border: `1px solid ${loopExitType === t ? '#ff7043' : 'var(--border)'}`, background: loopExitType === t ? 'rgba(255,112,67,0.1)' : 'var(--bg)', color: loopExitType === t ? '#ff7043' : 'var(--text3)', cursor: 'pointer', fontSize: 10, fontWeight: 700, textTransform: 'capitalize' }}>
                  {t === 'expression' ? 'JS Expression' : 'LLM Evaluate'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Exit Condition">
            <textarea value={loopExitCond} onChange={e => { setLoopExitCond(e.target.value); onUpdate({ exitCondition: e.target.value }) }} rows={3} placeholder={loopExitType === 'llm' ? 'The output is a complete, valid answer' : 'output.includes("DONE") || iteration >= 3'} style={{ ...inputStyle, resize: 'vertical', fontSize: 11, fontFamily: loopExitType === 'expression' ? 'monospace' : 'inherit', lineHeight: 1.6 }} />
          </Field>
          {loopExitType === 'llm' && (
            <Field label="Evaluator Model">
              <div style={{ position: 'relative' }}>
                <select value={loopModel} onChange={e => { setLoopModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                  <option value="">Default (first configured model)</option>
                  {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name} · {m.model_id}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            </Field>
          )}
          <Field label="On Max Reached">
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ v: 'continue', label: 'Continue' }, { v: 'error', label: 'Error' }].map(({ v, label: lbl }) => (
                <button key={v} onClick={() => { setLoopOnMax(v); onUpdate({ onMaxReached: v as 'continue' | 'error' }) }} style={{ flex: 1, padding: '6px', borderRadius: 6, border: `1px solid ${loopOnMax === v ? '#ff7043' : 'var(--border)'}`, background: loopOnMax === v ? 'rgba(255,112,67,0.1)' : 'var(--bg)', color: loopOnMax === v ? '#ff7043' : 'var(--text3)', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                  {lbl}
                </button>
              ))}
            </div>
          </Field>
          <div style={{ padding: '8px 10px', borderRadius: 7, fontSize: 10, background: 'rgba(255,112,67,0.06)', border: '1px solid rgba(255,112,67,0.2)', color: 'var(--text3)', lineHeight: 1.5 }}>
            Connect loop body below this node. Connect the last body node back to the <strong style={{ color: '#ff7043' }}>left handle</strong> to form the loop. Exit condition is checked after each iteration.
          </div>
        </>)}

        {/* Fork config */}
        {nodeData.nodeType === 'fork' && (<>
          <Field label="Input Mode">
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ v: 'broadcast', label: 'Broadcast (copy to all)' }, { v: 'split', label: 'Split (distribute array)' }].map(({ v, label: lbl }) => (
                <button key={v} onClick={() => { setForkInputMode(v); onUpdate({ inputMode: v as 'broadcast' | 'split' }) }} style={{ flex: 1, padding: '5px 4px', borderRadius: 6, border: `1px solid ${forkInputMode === v ? '#26c6da' : 'var(--border)'}`, background: forkInputMode === v ? 'rgba(38,198,218,0.1)' : 'var(--bg)', color: forkInputMode === v ? '#26c6da' : 'var(--text3)', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>
                  {lbl}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Branches">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {forkBranches.map((b, idx) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <input value={b.label} onChange={e => {
                    const updated = forkBranches.map((x, i) => i === idx ? { ...x, label: e.target.value } : x)
                    setForkBranches(updated); onUpdate({ branches: updated })
                  }} style={{ ...inputStyle, flex: 1, fontSize: 11 }} placeholder={`Branch ${idx + 1}`} />
                  {forkBranches.length > 2 && (
                    <button onClick={() => {
                      const updated = forkBranches.filter((_, i) => i !== idx)
                      setForkBranches(updated); onUpdate({ branches: updated })
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0 }}><Trash2 size={11} /></button>
                  )}
                </div>
              ))}
              <button onClick={() => {
                const updated = [...forkBranches, { id: uuidv4(), label: `Branch ${forkBranches.length + 1}` }]
                setForkBranches(updated); onUpdate({ branches: updated })
              }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '5px', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 10, cursor: 'pointer' }}>
                <Plus size={10} /> Add branch
              </button>
            </div>
          </Field>
          <div style={{ padding: '8px 10px', borderRadius: 7, fontSize: 10, background: 'rgba(38,198,218,0.06)', border: '1px solid rgba(38,198,218,0.2)', color: 'var(--text3)', lineHeight: 1.5 }}>
            Connect each branch handle to a separate node chain. All branches run in parallel. Connect them to a Join node to collect results.
          </div>
        </>)}

        {/* Join config */}
        {nodeData.nodeType === 'join' && (<>
          <Field label="Merge Format">
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ v: 'array', label: '[ ] Array' }, { v: 'object', label: '{ } Object' }, { v: 'concatenated', label: '… Text' }].map(({ v, label: lbl }) => (
                <button key={v} onClick={() => { setJoinMergeFormat(v); onUpdate({ mergeFormat: v as 'array' | 'object' | 'concatenated' }) }} style={{ flex: 1, padding: '5px 4px', borderRadius: 6, border: `1px solid ${joinMergeFormat === v ? '#26c6da' : 'var(--border)'}`, background: joinMergeFormat === v ? 'rgba(38,198,218,0.1)' : 'var(--bg)', color: joinMergeFormat === v ? '#26c6da' : 'var(--text3)', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>
                  {lbl}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Join Mode">
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ v: 'wait_all', label: 'All' }, { v: 'wait_first', label: 'First' }].map(({ v, label: lbl }) => (
                <button key={v} onClick={() => { setJoinMode(v); onUpdate({ joinMode: v as 'wait_all' | 'wait_first' }) }} style={{ flex: 1, padding: '5px 4px', borderRadius: 6, border: `1px solid ${joinMode === v ? '#26c6da' : 'var(--border)'}`, background: joinMode === v ? 'rgba(38,198,218,0.1)' : 'var(--bg)', color: joinMode === v ? '#26c6da' : 'var(--text3)', cursor: 'pointer', fontSize: 9, fontWeight: 700 }}>
                  Wait {lbl}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Save as variable (optional)">
            <input value={joinMergeAs} onChange={e => { setJoinMergeAs(e.target.value); onUpdate({ mergeAs: e.target.value || undefined }) }} style={{ ...inputStyle, fontSize: 11 }} placeholder="e.g. branch_results" />
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>Access via {'{{state.branch_results}}'} in downstream nodes</div>
          </Field>
        </>)}

        {/* Switch config */}
        {nodeData.nodeType === 'switch' && (<>
          <Field label="Switch Type">
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ v: 'value_match', label: 'Match' }, { v: 'expression', label: 'Expr' }, { v: 'llm_classify', label: 'LLM' }].map(({ v, label: lbl }) => (
                <button key={v} onClick={() => { setSwitchType(v); onUpdate({ switchType: v as 'value_match' | 'llm_classify' | 'expression' }) }} style={{ flex: 1, padding: '6px', borderRadius: 6, border: `1px solid ${switchType === v ? '#ffd600' : 'var(--border)'}`, background: switchType === v ? 'rgba(255,214,0,0.1)' : 'var(--bg)', color: switchType === v ? '#ffd600' : 'var(--text3)', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                  {lbl}
                </button>
              ))}
            </div>
          </Field>
          {switchType === 'llm_classify' && (
            <Field label="Classifier Model">
              <div style={{ position: 'relative' }}>
                <select value={switchModel} onChange={e => { setSwitchModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                  <option value="">Default (first configured model)</option>
                  {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name} · {m.model_id}</option>)}
                </select>
              </div>
            </Field>
          )}
          {switchType !== 'llm_classify' && (
            <Field label="Input Key (optional)">
              <input value={switchInputKey} onChange={e => { setSwitchInputKey(e.target.value); onUpdate({ inputKey: e.target.value || undefined }) }} style={{ ...inputStyle, fontSize: 11 }} placeholder="e.g. sentiment (from {{input.sentiment}})" />
            </Field>
          )}
          <Field label="Cases">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {switchCases.map((c, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <input value={c.label} onChange={e => {
                    const updated = switchCases.map((x, i) => i === idx ? { ...x, label: e.target.value } : x)
                    setSwitchCases(updated); onUpdate({ cases: updated })
                  }} style={{ ...inputStyle, flex: 1, fontSize: 10, padding: '5px 7px' }} placeholder="Label" />
                  <input value={c.match} onChange={e => {
                    const updated = switchCases.map((x, i) => i === idx ? { ...x, match: e.target.value } : x)
                    setSwitchCases(updated); onUpdate({ cases: updated })
                  }} style={{ ...inputStyle, flex: 2, fontSize: 10, padding: '5px 7px', fontFamily: switchType === 'expression' ? 'monospace' : 'inherit' }} placeholder={switchType === 'expression' ? 'value === "yes"' : switchType === 'llm_classify' ? 'Category name' : 'match value'} />
                  {switchCases.length > 2 && (
                    <button onClick={() => {
                      const updated = switchCases.filter((_, i) => i !== idx)
                      setSwitchCases(updated); onUpdate({ cases: updated })
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0 }}><Trash2 size={11} /></button>
                  )}
                </div>
              ))}
              <button onClick={() => {
                const updated = [...switchCases, { label: `Case ${switchCases.length + 1}`, match: '' }]
                setSwitchCases(updated); onUpdate({ cases: updated })
              }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '5px', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 10, cursor: 'pointer' }}>
                <Plus size={10} /> Add case
              </button>
            </div>
          </Field>
          <Field label="Default Case Label">
            <input value={switchDefault} onChange={e => { setSwitchDefault(e.target.value); onUpdate({ defaultCase: e.target.value || undefined }) }} style={{ ...inputStyle, fontSize: 11 }} placeholder="e.g. Default (connects via bottom handle)" />
          </Field>
        </>)}
      </div>
    </div>
  )
}
