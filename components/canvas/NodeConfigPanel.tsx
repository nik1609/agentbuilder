'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Brain, Wrench, GitBranch, UserCheck, HelpCircle, ChevronDown, Plus, Trash2, Shield, Database, Search, Globe, ArrowRightLeft, Shuffle, RefreshCw, GitFork, Merge, ToggleLeft, Copy, Check } from 'lucide-react'
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
  onAddEdge?: (sourceHandle: string, targetNodeId: string, label: string) => void
  onRemoveEdge?: (sourceHandle: string) => void
  outgoingEdges?: { sourceHandle?: string | null; target: string }[]
}


const NODE_META: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  input:       { color: '#5ED7F7', bg: 'rgba(94,215,247,0.1)',   icon: ArrowRightLeft, label: 'Start' },
  output:      { color: '#6B7280', bg: 'rgba(107,114,128,0.1)',  icon: ArrowRightLeft, label: 'End' },
  passthrough: { color: '#64b5f6', bg: 'rgba(100,181,246,0.1)',  icon: Shuffle,        label: 'Transform' },
  llm:         { color: '#7c6ff0', bg: 'rgba(124,111,240,0.1)',  icon: Brain,          label: 'AI Step' },
  tool:        { color: '#22d79a', bg: 'rgba(34,215,154,0.1)',   icon: Wrench,         label: 'Action' },
  condition:   { color: '#f5a020', bg: 'rgba(245,160,32,0.1)',   icon: GitBranch,      label: 'Branch' },
  hitl:        { color: '#b080f8', bg: 'rgba(176,128,248,0.1)',  icon: UserCheck,      label: 'Human Review' },
  clarify:     { color: '#f472b6', bg: 'rgba(244,114,182,0.1)',  icon: HelpCircle,     label: 'Ask User' },
  loop:        { color: '#ff7043', bg: 'rgba(255,112,67,0.1)',   icon: RefreshCw,      label: 'Loop' },
  fork:        { color: '#26c6da', bg: 'rgba(38,198,218,0.1)',   icon: GitFork,        label: 'Fork' },
  join:        { color: '#26c6da', bg: 'rgba(38,198,218,0.1)',   icon: Merge,          label: 'Join' },
  switch:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   icon: ToggleLeft,     label: 'Switch' },
}

function Field({ label, children, accentColor }: { label: string; children: React.ReactNode; accentColor?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: accentColor ?? 'var(--text3)', marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: accentColor ? 0.8 : 1 }}>
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

export default function NodeConfigPanel({ nodeId, nodeData, allNodes, onUpdate, onClose, onAfterToolSave, onAddEdge, onRemoveEdge, outgoingEdges = [] }: NodeConfigPanelProps) {
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
  const [showSwitchHelp, setShowSwitchHelp]   = useState(false)

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
  const [toolPickerOpen, setToolPickerOpen] = useState(false)
  const [toolPickerSearch, setToolPickerSearch] = useState('')
  const [compressModel, setCompressModel]   = useState((nodeData.compressModel as string) ?? '')
  // Datatable tool state — seeded from inline toolConfig so reopening panel restores correctly
  const [dtId, setDtId]       = useState((_inlineSchema?.datatable_id as string) ?? '')
  const [dtMode, setDtMode]   = useState<'import' | 'export'>(((_inlineSchema?.mode as string) ?? 'import') as 'import' | 'export')
  const [dtPkFilter, setDtPkFilter] = useState((_inlineSchema?.pk_filter as string) ?? '')
  const lastToolId = useRef<string | null>(null)

  // Passthrough / Transform node state
  const [template, setTemplate] = useState((nodeData.template as string) ?? '')

  // Start (input) node state
  const [inputField, setInputField]     = useState((nodeData.inputField as string) ?? 'message')
  const [inputDefault, setInputDefault] = useState((nodeData.inputDefault as string) ?? '')
  const [inputDesc, setInputDesc]       = useState((nodeData.description as string) ?? '')

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

  // When model configs finish loading, auto-select the first config if no valid model is set.
  // Covers all three model state vars (AI Step, Branch share `model`; Loop uses `loopModel`; Switch uses `switchModel`).
  const modelConfigsLoaded = useRef(false)
  useEffect(() => {
    if (modelConfigs.length === 0) return
    if (modelConfigsLoaded.current) return
    modelConfigsLoaded.current = true
    const names = modelConfigs.map(m => m.name)
    const first = modelConfigs[0].name
    if (!names.includes(model))       { setModel(first);       onUpdate({ model: first }) }
    if (!names.includes(loopModel))   { setLoopModel(first) }
    if (!names.includes(switchModel)) { setSwitchModel(first) }
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
  const [copiedId, setCopiedId] = useState(false)
  const copyNodeId = () => {
    navigator.clipboard.writeText(nodeId).then(() => {
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 1500)
    })
  }
  const Icon = meta.icon

  return (
    <div style={{
      width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', borderLeft: '1px solid var(--border)', overflow: 'hidden',
    }}>
      {/* Header — colored top bar + icon + title + close */}
      <div style={{ flexShrink: 0 }}>
        {/* Signature color accent bar */}
        <div style={{ height: 3, background: meta.color, borderRadius: '0 0 2px 2px' }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px 10px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
        }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: meta.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={14} style={{ color: meta.color }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: meta.color, lineHeight: 1.2 }}>{meta.label}</div>
            {/* Node ID row: copy icon + full id */}
            <button
              onClick={copyNodeId}
              title={nodeId}
              style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: copiedId ? meta.color : 'var(--text4)', transition: 'color 0.15s', minWidth: 0, maxWidth: '100%' }}
            >
              {copiedId ? <Check size={9} style={{ flexShrink: 0 }} /> : <Copy size={9} style={{ flexShrink: 0 }} />}
              <span style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nodeId}
              </span>
            </button>
          </div>
          <button
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', cursor: 'pointer', flexShrink: 0, transition: 'background 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text3)' }}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        <Field label="Label">
          <input value={label} onChange={e => { setLabel(e.target.value); onUpdate({ label: e.target.value }) }} style={inputStyle} placeholder="Node label" />
        </Field>

        {/* ── AI Step (LLM) config ─────────────────────────────────────────── */}
        {nodeData.nodeType === 'llm' && (() => {
          const C = meta.color
          const hasConvMemory = memorySources.some(s => s.type === 'agent_runs')
          const convMemSrc = memorySources.find(s => s.type === 'agent_runs')
          const nodeOutputSources = memorySources.filter(s => s.type === 'node_output')

          const setConvMemory = (on: boolean) => {
            if (on) {
              const firstCfg = memoryConfigs[0]
              if (!firstCfg) return
              const src: MemorySource = { id: Date.now().toString(), type: 'agent_runs', memoryConfigId: firstCfg.id }
              const updated = [...memorySources.filter(s => s.type !== 'agent_runs'), src]
              setMemorySources(updated); onUpdate({ memorySources: updated })
            } else {
              const updated = memorySources.filter(s => s.type !== 'agent_runs')
              setMemorySources(updated); onUpdate({ memorySources: updated })
            }
          }

          const setConvMemConfig = (configId: string) => {
            const updated = memorySources.map(s =>
              s.type === 'agent_runs' ? { ...s, memoryConfigId: configId } : s
            )
            setMemorySources(updated); onUpdate({ memorySources: updated })
          }

          const addNodeOutputSource = (nodeId: string) => {
            const node = upstreamNodes.find(n => n.id === nodeId)
            if (!node) return
            const src: MemorySource = { id: Date.now().toString(), type: 'node_output', nodeId, nodeLabel: node.data.label }
            const updated = [...memorySources, src]
            setMemorySources(updated); onUpdate({ memorySources: updated })
          }

          return (<>
            {/* Model */}
            <Field label="Model" accentColor={C}>
              <div style={{ position: 'relative' }}>
                <select value={model} onChange={e => { setModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                  <option value="">Default model</option>
                  {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            </Field>

            {/* System Prompt */}
            <Field label="System Prompt" accentColor={C}>
              {prompts.length > 0 && (
                <div style={{ position: 'relative', marginBottom: 7 }}>
                  <select value={selectedPromptId} onChange={e => {
                    setSelectedPromptId(e.target.value)
                    const p = prompts.find(x => x.id === e.target.value)
                    if (p) { setSystemPrompt(p.content); onUpdate({ systemPrompt: p.content }) }
                  }} style={{ ...selectStyle, fontSize: 11, color: 'var(--text3)' }}>
                    <option value="">Load a saved prompt...</option>
                    {prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                </div>
              )}
              <textarea
                value={systemPrompt}
                onChange={e => { setSystemPrompt(e.target.value); onUpdate({ systemPrompt: e.target.value }) }}
                rows={5}
                placeholder={'You are a helpful assistant.\n\nUse {{input}} to reference the user message.'}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.65, minHeight: 90 }}
              />
            </Field>

            <div style={{ height: 1, background: 'var(--border2)' }} />

            {/* Agentic Mode */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', borderRadius: agenticMode ? '8px 8px 0 0' : 8, background: agenticMode ? `${C}10` : 'var(--surface)', border: `1px solid ${agenticMode ? C + '35' : 'var(--border)'}`, borderBottom: agenticMode ? 'none' : undefined }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: agenticMode ? C : 'var(--text)' }}>Agentic mode</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>AI calls tools autonomously until done</div>
                </div>
                <button onClick={() => { const n = !agenticMode; setAgenticMode(n); onUpdate({ agenticMode: n }) }}
                  style={{ width: 34, height: 19, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative', background: agenticMode ? C : 'var(--border)', padding: 0, flexShrink: 0, transition: 'background 0.2s' }}>
                  <span style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff', top: 2.5, left: agenticMode ? 17 : 3, transition: 'left 0.2s' }} />
                </button>
              </div>
              {agenticMode && (
                <div style={{ padding: '10px 11px', borderRadius: '0 0 8px 8px', background: `${C}08`, border: `1px solid ${C}35`, borderTop: 'none' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>Tools</div>
                  {boundTools.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
                      {boundTools.map(t => (
                        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: `${C}18`, border: `1px solid ${C}30`, fontSize: 11, color: C }}>
                          <Wrench size={9} />{t}
                          <button onClick={() => { const n = boundTools.filter(x => x !== t); setBoundTools(n); onUpdate({ boundTools: n }) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C, display: 'flex', padding: 0, marginLeft: 1 }}>
                            <X size={9} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ position: 'relative' }}>
                    <select value="" onChange={e => {
                      const val = e.target.value
                      if (!val || boundTools.includes(val)) return
                      const n = [...boundTools, val]; setBoundTools(n); onUpdate({ boundTools: n })
                    }} style={{ ...selectStyle, fontSize: 11, background: 'var(--bg)' }}>
                      <option value="">+ Add tool…</option>
                      {tools.filter(t => !boundTools.includes(t.name)).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      {!boundTools.includes('web_search') && <option value="web_search">web_search (built-in)</option>}
                      {!boundTools.includes('web_scrape') && <option value="web_scrape">web_scrape (built-in)</option>}
                    </select>
                    <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--border2)' }} />

            {/* Memory */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.8 }}>Memory</div>

              {/* Conversation memory toggle */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', borderRadius: hasConvMemory ? '8px 8px 0 0' : 8, background: hasConvMemory ? `${C}08` : 'var(--surface)', border: `1px solid ${hasConvMemory ? C + '30' : 'var(--border)'}`, borderBottom: hasConvMemory ? 'none' : undefined }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: hasConvMemory ? C : 'var(--text)' }}>Remember conversations</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Inject past runs as context</div>
                  </div>
                  <button
                    onClick={() => setConvMemory(!hasConvMemory)}
                    disabled={!hasConvMemory && memoryConfigs.length === 0}
                    title={!hasConvMemory && memoryConfigs.length === 0 ? 'Create a memory config in the Memory tab first' : undefined}
                    style={{ width: 34, height: 19, borderRadius: 10, border: 'none', cursor: memoryConfigs.length === 0 && !hasConvMemory ? 'not-allowed' : 'pointer', position: 'relative', background: hasConvMemory ? C : 'var(--border)', padding: 0, flexShrink: 0, transition: 'background 0.2s', opacity: !hasConvMemory && memoryConfigs.length === 0 ? 0.4 : 1 }}>
                    <span style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff', top: 2.5, left: hasConvMemory ? 17 : 3, transition: 'left 0.2s' }} />
                  </button>
                </div>
                {hasConvMemory && (
                  <div style={{ padding: '10px 11px', borderRadius: '0 0 8px 8px', background: `${C}06`, border: `1px solid ${C}30`, borderTop: 'none' }}>
                    <div style={{ position: 'relative' }}>
                      <select value={convMemSrc?.memoryConfigId ?? ''} onChange={e => setConvMemConfig(e.target.value)}
                        style={{ ...selectStyle, fontSize: 11, background: 'var(--bg)' }}>
                        <option value="">Select memory config...</option>
                        {memoryConfigs.map(m => <option key={m.id} value={m.id}>{m.name} · last {m.window_size} runs</option>)}
                      </select>
                      <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                    </div>
                  </div>
                )}
              </div>
              {!hasConvMemory && memoryConfigs.length === 0 && (
                <div style={{ fontSize: 10, color: 'var(--text4)', padding: '4px 2px' }}>Create a memory config in the Memory tab to enable this.</div>
              )}

              {/* Node output sources */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>Inject upstream node output</div>
                {nodeOutputSources.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                    {nodeOutputSources.map(src => (
                      <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, background: `${C}08`, border: `1px solid ${C}20` }}>
                        <Database size={9} color={C} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.nodeLabel ?? src.nodeId}</span>
                        <button onClick={() => removeMemorySource(src.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0 }}>
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {upstreamNodes.filter(n => !nodeOutputSources.some(s => s.nodeId === n.id)).length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <select value="" onChange={e => { if (e.target.value) addNodeOutputSource(e.target.value) }}
                      style={{ ...selectStyle, fontSize: 11 }}>
                      <option value="">+ Add node output…</option>
                      {upstreamNodes.filter(n => !nodeOutputSources.some(s => s.nodeId === n.id))
                        .map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}
                    </select>
                    <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                  </div>
                )}
                {upstreamNodes.length === 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text4)' }}>No upstream nodes yet.</div>
                )}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border2)' }} />

            {/* Guardrail */}
            <Field label="Guardrail" accentColor={C}>
              <div style={{ position: 'relative' }}>
                <select value={guardrailId} onChange={e => { setGuardrailId(e.target.value); onUpdate({ guardrailId: e.target.value || undefined }) }}
                  style={{ ...selectStyle, color: guardrailId ? 'var(--error)' : 'var(--text3)' }}>
                  <option value="">None</option>
                  {guardrails.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <Shield size={10} style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)', color: guardrailId ? 'var(--error)' : 'var(--text3)', pointerEvents: 'none' }} />
                <ChevronDown size={11} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            </Field>

            {/* Retry */}
            <RetryConfig color={C} bg={meta.bg} enabled={retryEnabled} maxAttempts={retryMax} backoffMs={retryBackoff} retryOn={retryOn}
              onToggle={v => { setRetryEnabled(v); onUpdate({ retry: { enabled: v, maxAttempts: parseInt(retryMax), backoffMs: parseInt(retryBackoff), retryOn } }) }}
              onMax={v => { setRetryMax(v); onUpdate({ retry: { enabled: retryEnabled, maxAttempts: parseInt(v) || 3, backoffMs: parseInt(retryBackoff), retryOn } }) }}
              onBackoff={v => { setRetryBackoff(v); onUpdate({ retry: { enabled: retryEnabled, maxAttempts: parseInt(retryMax), backoffMs: parseInt(v) || 1000, retryOn } }) }}
              onRetryOn={v => { setRetryOn(v); onUpdate({ retry: { enabled: retryEnabled, maxAttempts: parseInt(retryMax), backoffMs: parseInt(retryBackoff), retryOn: v } }) }}
            />
          </>)
        })()}

        {/* Start (input) node config */}
        {nodeData.nodeType === 'input' && (<>
          <Field label="Description" accentColor={meta.color}>
            <textarea
              value={inputDesc}
              onChange={e => { setInputDesc(e.target.value); onUpdate({ description: e.target.value }) }}
              rows={2}
              placeholder="What does this agent do? Shown to the orchestrator for routing."
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.55, fontSize: 12 }}
            />
          </Field>
          <Field label="API Input Field" accentColor={meta.color}>
            <input
              value={inputField}
              onChange={e => { setInputField(e.target.value); onUpdate({ inputField: e.target.value }) }}
              style={{ ...inputStyle, fontFamily: 'monospace' }}
              placeholder="message"
            />
          </Field>
          <Field label="Default Value (optional)" accentColor={meta.color}>
            <input
              value={inputDefault}
              onChange={e => { setInputDefault(e.target.value); onUpdate({ inputDefault: e.target.value }) }}
              style={inputStyle}
              placeholder="Used when no input is provided"
            />
          </Field>
          <div style={{ padding: '9px 11px', borderRadius: 8, fontSize: 10, background: meta.bg, border: `1px solid ${meta.color}30`, color: 'var(--text3)', lineHeight: 1.7 }}>
            <strong style={{ color: meta.color, display: 'block', marginBottom: 3, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>API contract</strong>
            Callers POST <code style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace', color: meta.color }}>{`{ "${inputField || 'message'}": "..." }`}</code> to run this agent.
            Use <code style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace' }}>{'{{input}}'}</code> in downstream nodes to reference this value.
          </div>
        </>)}

        {/* End (output) node config */}
        {nodeData.nodeType === 'output' && (
          <div style={{ padding: '9px 11px', borderRadius: 8, fontSize: 10, background: meta.bg, border: `1px solid ${meta.color}30`, color: 'var(--text3)', lineHeight: 1.7 }}>
            <strong style={{ color: meta.color, display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>How it works</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span>· The pipeline terminates here</span>
              <span>· The last node's output becomes the agent's final response</span>
              <span>· No configuration needed. Connect it to the final step.</span>
            </div>
          </div>
        )}

        {/* Transform (passthrough) node config */}
        {nodeData.nodeType === 'passthrough' && (() => {
          const C = meta.color
          return (<>
            <Field label="Template" accentColor={C}>
              <textarea
                value={template}
                onChange={e => { setTemplate(e.target.value); onUpdate({ template: e.target.value }) }}
                rows={6}
                placeholder={'{{last_output}}\n\nOr reshape it:\nContext: {{last_output}}\nUser asked: {{input}}'}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, minHeight: 100 }}
              />
            </Field>
            <div style={{ padding: '9px 11px', borderRadius: 8, fontSize: 10, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7 }}>
              <strong style={{ color: C, display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Variables</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span>· <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>{'{{last_output}}'}</code> previous node output</span>
                <span>· <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>{'{{input}}'}</code> original pipeline input</span>
                <span>· <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>{'{{node.NODE_ID}}'}</code> any upstream node's output</span>
                <span>· <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>{'{{state.key}}'}</code> any named variable</span>
                <span style={{ color: 'var(--text4)', marginTop: 2 }}>Leave empty to pass through unchanged.</span>
              </div>
            </div>
          </>)
        })()}

        {/* Tool config */}
        {nodeData.nodeType === 'tool' && (() => {
          const C = meta.color
          const TYPE_ICON: Record<string, React.ReactNode> = {
            http: <Wrench size={10} />, web_search: <Search size={10} />,
            web_scrape: <Globe size={10} />, datatable: <Database size={10} />,
            function: <Wrench size={10} />, code_exec: <Wrench size={10} />,
          }
          const TYPE_LABEL: Record<string, string> = {
            http: 'HTTP', web_search: 'Search', web_scrape: 'Scrape',
            datatable: 'Table', function: 'Function', code_exec: 'Code',
          }
          const filteredTools = tools.filter(t =>
            !toolPickerSearch || t.name.toLowerCase().includes(toolPickerSearch.toLowerCase()) ||
            (t.type && t.type.toLowerCase().includes(toolPickerSearch.toLowerCase()))
          )
          const selectedTool = tools.find(t => t.name === toolName)
          return (<>
          <Field label="Tool" accentColor={C}>
            {/* Selected tool display */}
            {selectedTool ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: `${C}08`, border: `1px solid ${C}30`, cursor: 'pointer' }}
                onClick={() => setToolPickerOpen(o => !o)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                  <span style={{ color: C, display: 'flex' }}>{TYPE_ICON[selectedTool.type] ?? <Wrench size={10} />}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedTool.name}</span>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${C}14`, color: C, fontWeight: 700, flexShrink: 0 }}>{TYPE_LABEL[selectedTool.type] ?? selectedTool.type}</span>
                </div>
                <ChevronDown size={12} style={{ color: C, flexShrink: 0, transform: toolPickerOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
              </div>
            ) : (
              <button onClick={() => setToolPickerOpen(o => !o)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--text3)', fontFamily: 'inherit' }}>
                Select a tool...
                <ChevronDown size={12} style={{ color: 'var(--text3)', transform: toolPickerOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
              </button>
            )}

            {/* Dropdown picker */}
            {toolPickerOpen && (
              <div style={{ marginTop: 4, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                {/* Search */}
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border2)' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                    <input
                      value={toolPickerSearch}
                      onChange={e => setToolPickerSearch(e.target.value)}
                      placeholder="Search tools..."
                      autoFocus
                      style={{ ...inputStyle, paddingLeft: 26, fontSize: 11, padding: '6px 8px 6px 26px' }}
                    />
                  </div>
                </div>
                {/* Tool list */}
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {filteredTools.length === 0 ? (
                    <div style={{ padding: '12px 12px', fontSize: 11, color: 'var(--text4)', textAlign: 'center' }}>No tools found</div>
                  ) : filteredTools.map(t => (
                    <button key={t.id}
                      onClick={() => { setToolName(t.name); onUpdate({ toolName: t.name }); lastToolId.current = null; setToolPickerOpen(false); setToolPickerSearch('') }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: t.name === toolName ? `${C}08` : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', borderBottom: '1px solid var(--border2)' }}
                      onMouseEnter={e => { if (t.name !== toolName) e.currentTarget.style.background = 'var(--surface)' }}
                      onMouseLeave={e => { if (t.name !== toolName) e.currentTarget.style.background = 'transparent' }}>
                      <span style={{ color: t.name === toolName ? C : 'var(--text3)', display: 'flex', flexShrink: 0 }}>{TYPE_ICON[t.type] ?? <Wrench size={12} />}</span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: t.name === toolName ? C : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: t.name === toolName ? `${C}14` : 'var(--surface)', color: t.name === toolName ? C : 'var(--text3)', fontWeight: 700, flexShrink: 0 }}>{TYPE_LABEL[t.type] ?? t.type}</span>
                    </button>
                  ))}
                </div>
                {toolName && (
                  <button onClick={() => { setToolName(''); onUpdate({ toolName: '' }); setToolPickerOpen(false) }}
                    style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderTop: '1px solid var(--border2)', cursor: 'pointer', fontSize: 11, color: 'var(--error)', fontFamily: 'inherit', textAlign: 'center' }}>
                    Clear selection
                  </button>
                )}
              </div>
            )}
          </Field>



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

          <RetryConfig color={C} bg={meta.bg} enabled={retryEnabled} maxAttempts={retryMax} backoffMs={retryBackoff} retryOn={retryOn}
            onToggle={v => { setRetryEnabled(v); onUpdate({ retry: { enabled: v, maxAttempts: parseInt(retryMax), backoffMs: parseInt(retryBackoff), retryOn } }) }}
            onMax={v => { setRetryMax(v); onUpdate({ retry: { enabled: retryEnabled, maxAttempts: parseInt(v) || 3, backoffMs: parseInt(retryBackoff), retryOn } }) }}
            onBackoff={v => { setRetryBackoff(v); onUpdate({ retry: { enabled: retryEnabled, maxAttempts: parseInt(retryMax), backoffMs: parseInt(v) || 1000, retryOn } }) }}
            onRetryOn={v => { setRetryOn(v); onUpdate({ retry: { enabled: retryEnabled, maxAttempts: parseInt(retryMax), backoffMs: parseInt(retryBackoff), retryOn: v } }) }}
          />

          </>)
        })()}

        {/* Branch (Condition) config */}
        {nodeData.nodeType === 'condition' && (() => {
          const C = meta.color
          return (<>
            {/* Model */}
            <Field label="Evaluator Model" accentColor={C}>
              <div style={{ position: 'relative' }}>
                <select value={model} onChange={e => { setModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                  <option value="">Default model</option>
                  {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
                <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              </div>
            </Field>

            {/* What the LLM sees */}
            <div style={{ padding: '9px 11px', borderRadius: 8, fontSize: 10, background: `${C}0A`, border: `1px solid ${C}25`, color: 'var(--text3)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: C, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>What the LLM sees</div>
              Your condition + <code style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace' }}>{'{{last_output}}'}</code> as context. Replies with only <strong style={{ color: '#22d79a' }}>true</strong> or <strong style={{ color: '#dc2626' }}>false</strong>.
            </div>

            {/* Condition — the hero field */}
            <Field label="Condition" accentColor={C}>
              <textarea
                value={condition}
                onChange={e => { setCondition(e.target.value); onUpdate({ condition: e.target.value }) }}
                rows={4}
                placeholder={'Write a plain-English condition:\n\n"the sentiment is negative"\n"the user is asking about billing"\n"the output contains an error message"'}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65, minHeight: 90 }}
              />
            </Field>

            {/* Cost note */}
            <div style={{ padding: '9px 11px', borderRadius: 8, background: `${C}0A`, border: `1px solid ${C}25`, color: 'var(--text3)', lineHeight: 1.7, fontSize: 10 }}>
              <strong style={{ color: C, display: 'block', marginBottom: 3, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Cost note</strong>
              Only the provider and API key are used. Temperature and max tokens are fixed at 0 and 10.
            </div>
          </>)
        })()}

        {/* HITL config */}
        {nodeData.nodeType === 'hitl' && (() => {
          const C = meta.color
          return (<>
            <Field label="Review Question" accentColor={C}>
              <textarea
                value={question}
                onChange={e => { setQuestion(e.target.value); onUpdate({ question: e.target.value }) }}
                rows={4}
                placeholder="What should the reviewer check before approving?"
                style={{ ...inputStyle, resize: 'vertical', fontSize: 11, lineHeight: 1.6 }}
              />
            </Field>

            <div style={{ padding: '9px 11px', borderRadius: 8, fontSize: 10, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7 }}>
              <strong style={{ color: C, display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>How it works</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span>· Pipeline pauses here with <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>status: waiting_hitl</code></span>
                <span>· Reviewer sees the question + current output in the dashboard</span>
                <span>· On approve: pipeline resumes. Reviewer notes are injected into the next node's input.</span>
                <span>· On reject: run is marked failed. Pipeline does not continue.</span>
              </div>
            </div>
          </>)
        })()}

        {/* Clarify config */}
        {nodeData.nodeType === 'clarify' && (() => {
          const C = meta.color
          return (<>
            <Field label="Mode" accentColor={C}>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['static', 'llm'] as const).map(m => (
                  <button key={m} onClick={() => { setClarifyMode(m); onUpdate({ clarifyMode: m }) }}
                    style={{ flex: 1, padding: '6px 4px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s',
                      border: `1px solid ${clarifyMode === m ? C : 'var(--border)'}`,
                      background: clarifyMode === m ? `${C}14` : 'var(--bg)',
                      color: clarifyMode === m ? C : 'var(--text3)',
                    }}>
                    {m === 'static' ? 'Fixed Question' : 'LLM Generated'}
                  </button>
                ))}
              </div>
            </Field>

            {clarifyMode === 'static' ? (<>
              <Field label="Question" accentColor={C}>
                <textarea
                  value={staticQuestion}
                  onChange={e => { setStaticQuestion(e.target.value); onUpdate({ staticQuestion: e.target.value }) }}
                  rows={3}
                  placeholder="What are your spending details for today?"
                  style={{ ...inputStyle, resize: 'vertical', fontSize: 11, lineHeight: 1.6 }}
                />
              </Field>
              <div style={{ padding: '9px 11px', borderRadius: 8, fontSize: 10, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7 }}>
                <strong style={{ color: C, display: 'block', marginBottom: 3, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>How it works</strong>
                Shows this exact question to the user. No LLM call. Flow pauses until the user replies.
              </div>
            </>) : (<>
              <Field label="Question Model" accentColor={C}>
                <div style={{ position: 'relative' }}>
                  <select value={clarifyModel} onChange={e => { setClarifyModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                    <option value="">Default model</option>
                    {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                  <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                </div>
              </Field>
              <Field label="System Prompt (optional)" accentColor={C}>
                <textarea
                  value={clarifySystemPrompt}
                  onChange={e => { setClarifySystemPrompt(e.target.value); onUpdate({ clarifySystemPrompt: e.target.value }) }}
                  rows={4}
                  placeholder="You are a helpful assistant. Based on the context, ask ONE concise clarifying question to better understand what the user needs."
                  style={{ ...inputStyle, resize: 'vertical', fontSize: 11, lineHeight: 1.6 }}
                />
              </Field>
              <div style={{ padding: '9px 11px', borderRadius: 8, fontSize: 10, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7 }}>
                <strong style={{ color: C, display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>How it works</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>· LLM reads <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>{'{{last_output}}'}</code> and generates one question</span>
                  <span>· Flow pauses until the user replies in chat</span>
                  <span>· Answer is injected into the next node's input</span>
                </div>
              </div>
            </>)}
          </>)
        })()}

        {/* Loop config */}
        {nodeData.nodeType === 'loop' && (() => {
          const C = meta.color
          return (<>
            <Field label="Exit Condition Type" accentColor={C}>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['expression', 'llm'] as const).map(t => (
                  <button key={t} onClick={() => { setLoopExitType(t); onUpdate({ exitConditionType: t }) }}
                    style={{ flex: 1, padding: '6px', borderRadius: 7, border: `1px solid ${loopExitType === t ? C : 'var(--border)'}`, background: loopExitType === t ? `${C}14` : 'var(--bg)', color: loopExitType === t ? C : 'var(--text3)', cursor: 'pointer', fontSize: 10, fontWeight: 700, transition: 'all 0.12s' }}>
                    {t === 'expression' ? 'JS Expression' : 'LLM Evaluate'}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Exit Condition" accentColor={C}>
              <textarea value={loopExitCond} onChange={e => { setLoopExitCond(e.target.value); onUpdate({ exitCondition: e.target.value }) }} rows={3}
                placeholder={loopExitType === 'llm' ? 'The answer is complete and addresses all the user\'s points' : 'output.includes("DONE") || iteration >= 3'}
                style={{ ...inputStyle, resize: 'vertical', fontSize: 11, fontFamily: loopExitType === 'expression' ? 'monospace' : 'inherit', lineHeight: 1.6 }} />
              {loopExitType === 'expression' && (
                <div style={{ padding: '9px 11px', borderRadius: 8, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7, fontSize: 10, marginTop: 6 }}>
                  <strong style={{ color: C, display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Variables</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span>· <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>output</code> last body output. Iteration 1: node before loop.</span>
                    <span>· <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>iteration</code> count (1-based)</span>
                    <span>· <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>input</code> original pipeline input</span>
                    <span>· <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>{'state["node-id"]'}</code> any upstream node's output</span>
                  </div>
                </div>
              )}
              {loopExitType === 'llm' && (
                <div style={{ padding: '9px 11px', borderRadius: 8, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7, fontSize: 10, marginTop: 6 }}>
                  <strong style={{ color: C, display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>How it works</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span>Plain-English condition. LLM reads it with the current output and replies <strong style={{ color: 'var(--text2)' }}>exit</strong> or <strong style={{ color: 'var(--text2)' }}>continue</strong>.</span>
                    <span>On iteration 1, output is the node before the loop.</span>
                  </div>
                </div>
              )}
            </Field>

            <Field label="Max Iterations" accentColor={C}>
              <input type="number" min={1} max={100} value={loopMaxIter}
                onChange={e => { setLoopMaxIter(e.target.value); onUpdate({ maxIterations: parseInt(e.target.value) || 5 }) }}
                style={{ ...inputStyle, width: 100 }} />
            </Field>

            <Field label="On Max Reached" accentColor={C}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {[{ v: 'continue', label: 'Proceed' }, { v: 'error', label: 'Fail run' }].map(({ v, label: lbl }) => (
                  <button key={v} onClick={() => { setLoopOnMax(v); onUpdate({ onMaxReached: v as 'continue' | 'error' }) }}
                    style={{ flex: 1, padding: '6px', borderRadius: 7, border: `1px solid ${loopOnMax === v ? C : 'var(--border)'}`, background: loopOnMax === v ? `${C}14` : 'var(--bg)', color: loopOnMax === v ? C : 'var(--text3)', cursor: 'pointer', fontSize: 10, fontWeight: 700, transition: 'all 0.12s' }}>
                    {lbl}
                  </button>
                ))}
              </div>
              <div style={{ padding: '9px 11px', borderRadius: 8, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7, fontSize: 10 }}>
                <strong style={{ color: C, display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>What happens</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>· <strong style={{ color: 'var(--text2)' }}>Proceed</strong>: exit loop, continue to next node</span>
                  <span>· <strong style={{ color: 'var(--text2)' }}>Fail run</strong>: stop the pipeline with an error</span>
                </div>
              </div>
            </Field>

            {loopExitType === 'llm' && (
              <Field label="Evaluator Model" accentColor={C}>
                <div style={{ position: 'relative' }}>
                  <select value={loopModel} onChange={e => { setLoopModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                    <option value="">Default model</option>
                    {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                  <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                </div>
              </Field>
            )}

            <div style={{ padding: '9px 11px', borderRadius: 8, fontSize: 10, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7 }}>
              <strong style={{ color: C, display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>How to wire</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span>· Connect the loop body chain below this node</span>
                <span>· Connect the last body node back to the <strong style={{ color: C }}>left handle</strong> to close the loop</span>
                <span>· Exit condition is checked after each iteration</span>
              </div>
            </div>
          </>)
        })()}

        {/* Fork config */}
        {nodeData.nodeType === 'fork' && (() => {
          const C = meta.color
          return (<>
            <Field label="Input Mode" accentColor={C}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ v: 'broadcast', label: 'Broadcast' }, { v: 'split', label: 'Split array' }].map(({ v, label: lbl }) => (
                  <button key={v} onClick={() => { setForkInputMode(v); onUpdate({ inputMode: v as 'broadcast' | 'split' }) }}
                    style={{ flex: 1, padding: '6px 4px', borderRadius: 7, border: `1px solid ${forkInputMode === v ? C : 'var(--border)'}`, background: forkInputMode === v ? `${C}14` : 'var(--bg)', color: forkInputMode === v ? C : 'var(--text3)', cursor: 'pointer', fontSize: 10, fontWeight: 700, transition: 'all 0.12s' }}>
                    {lbl}
                  </button>
                ))}
              </div>
              <div style={{ padding: '9px 11px', borderRadius: 8, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7, fontSize: 10, marginTop: 6 }}>
                <strong style={{ color: C, display: 'block', marginBottom: 3, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Modes</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>· <strong style={{ color: 'var(--text2)' }}>Broadcast</strong>: same input copied to every branch</span>
                  <span>· <strong style={{ color: 'var(--text2)' }}>Split array</strong>: distributes one array item per branch</span>
                </div>
              </div>
            </Field>

            <Field label="Branches" accentColor={C}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {forkBranches.map((b, idx) => {
                  const connectedEdge = outgoingEdges.find(e => e.sourceHandle === b.id)
                  const connectedNodeId = connectedEdge?.target ?? ''
                  const availableNodes = allNodes.filter(n => n.data.nodeType !== 'input' && n.id !== nodeId)
                  return (
                    <div key={b.id} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                        <select
                          value={connectedNodeId}
                          onChange={e => {
                            const targetNode = availableNodes.find(n => n.id === e.target.value)
                            const newLabel = targetNode?.data.label ?? `Branch ${idx + 1}`
                            onRemoveEdge?.(b.id)
                            const updated = forkBranches.map((x, i) => i === idx ? { ...x, label: newLabel } : x)
                            setForkBranches(updated); onUpdate({ branches: updated })
                            if (e.target.value) onAddEdge?.(b.id, e.target.value, newLabel)
                          }}
                          style={{ ...selectStyle, fontSize: 11, padding: '6px 24px 6px 8px', color: connectedNodeId ? 'var(--text)' : 'var(--text4)' }}
                        >
                          <option value="">Branch {idx + 1}...</option>
                          {availableNodes.map(n => (
                            <option key={n.id} value={n.id}>{n.data.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={10} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                      </div>
                      {forkBranches.length > 2 && (
                        <button onClick={() => {
                          onRemoveEdge?.(b.id)
                          const updated = forkBranches.filter((_, i) => i !== idx)
                          setForkBranches(updated); onUpdate({ branches: updated })
                        }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0, flexShrink: 0 }}>
                          <Trash2 size={11} color="var(--error)" />
                        </button>
                      )}
                    </div>
                  )
                })}
                <button onClick={() => {
                  const updated = [...forkBranches, { id: uuidv4(), label: `Branch ${forkBranches.length + 1}` }]
                  setForkBranches(updated); onUpdate({ branches: updated })
                }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px', borderRadius: 7, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 10, cursor: 'pointer' }}>
                  <Plus size={10} /> Add branch
                </button>
              </div>
            </Field>

            <div style={{ padding: '9px 11px', borderRadius: 8, fontSize: 10, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7 }}>
              <strong style={{ color: C, display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>How to wire</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span>· Connect each branch handle to a separate node chain</span>
                <span>· All branches run in parallel</span>
                <span>· Connect all chains to a <strong style={{ color: C }}>Join</strong> node to collect results</span>
              </div>
            </div>

            <div style={{ padding: '9px 11px', borderRadius: 8, fontSize: 10, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--text3)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--warning)', display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Supported inside branches</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span>· AI Step, Action, Transform</span>
              </div>
            </div>
          </>)
        })()}

        {/* Join config */}
        {nodeData.nodeType === 'join' && (() => {
          const C = meta.color
          return (<>
            <Field label="Merge Format" accentColor={C}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ v: 'array', label: '[ ] Array' }, { v: 'object', label: '{ } Object' }, { v: 'concatenated', label: '… Text' }].map(({ v, label: lbl }) => (
                  <button key={v} onClick={() => { setJoinMergeFormat(v); onUpdate({ mergeFormat: v as 'array' | 'object' | 'concatenated' }) }}
                    style={{ flex: 1, padding: '6px 4px', borderRadius: 7, border: `1px solid ${joinMergeFormat === v ? C : 'var(--border)'}`, background: joinMergeFormat === v ? `${C}14` : 'var(--bg)', color: joinMergeFormat === v ? C : 'var(--text3)', cursor: 'pointer', fontSize: 10, fontWeight: 700, transition: 'all 0.12s' }}>
                    {lbl}
                  </button>
                ))}
              </div>
              <div style={{ padding: '9px 11px', borderRadius: 8, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7, fontSize: 10, marginTop: 6 }}>
                <strong style={{ color: C, display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Output shape</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>· <strong style={{ color: 'var(--text2)' }}>Array</strong>: <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3 }}>[resultA, resultB, ...]</code></span>
                  <span>· <strong style={{ color: 'var(--text2)' }}>Object</strong>: <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3 }}>{`{ "Branch A": result, ... }`}</code></span>
                  <span>· <strong style={{ color: 'var(--text2)' }}>Text</strong>: all results joined with a blank line</span>
                </div>
              </div>
            </Field>

            <Field label="Save as variable" accentColor={C}>
              <input
                value={joinMergeAs}
                onChange={e => { setJoinMergeAs(e.target.value); onUpdate({ mergeAs: e.target.value || undefined }) }}
                style={{ ...inputStyle, fontSize: 11, fontFamily: 'monospace' }}
                placeholder="e.g. branch_results"
              />
              <div style={{ padding: '9px 11px', borderRadius: 8, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7, fontSize: 10, marginTop: 6 }}>
                <strong style={{ color: C, display: 'block', marginBottom: 3, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Usage</strong>
                <span>Access via <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>{`{{state.branch_results}}`}</code> in any downstream node. Optional.</span>
              </div>
            </Field>
          </>)
        })()}

        {/* Switch config */}
        {nodeData.nodeType === 'switch' && (() => {
          const C = meta.color

          const MODE_OPTIONS = [
            { v: 'value_match',   label: 'Exact match', desc: 'Routes when the output contains or equals a value. No LLM, no cost.' },
            { v: 'expression',    label: 'Expression',  desc: 'Write a JS condition per case. value = last output, input = original input.' },
            { v: 'llm_classify',  label: 'AI classify', desc: 'The AI reads the output and picks the best matching category. Costs tokens.' },
          ]

          const selectedMode = MODE_OPTIONS.find(m => m.v === switchType)

          return (<>
            {/* Mode selector */}
            <Field label="How to route" accentColor={C}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {MODE_OPTIONS.map(({ v, label: lbl }) => (
                  <button key={v}
                    onClick={() => { setSwitchType(v); onUpdate({ switchType: v as 'value_match' | 'llm_classify' | 'expression' }) }}
                    style={{ flex: 1, padding: '6px 4px', borderRadius: 7, border: `1px solid ${switchType === v ? C : 'var(--border)'}`, background: switchType === v ? `${C}14` : 'var(--bg)', color: switchType === v ? C : 'var(--text3)', cursor: 'pointer', fontSize: 10, fontWeight: 700, transition: 'all 0.12s' }}>
                    {lbl}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 6 }}>
                {switchType === 'value_match' && (
                  <div style={{ padding: '9px 11px', borderRadius: 8, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7, fontSize: 10 }}>
                    <strong style={{ color: C, display: 'block', marginBottom: 3, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>How it works</strong>
                    Routes when the output equals or contains the match value. Case-insensitive.
                  </div>
                )}
                {switchType === 'expression' && (
                  <div style={{ padding: '9px 11px', borderRadius: 8, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7, fontSize: 10 }}>
                    <strong style={{ color: C, display: 'block', marginBottom: 5, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Variables</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span>· <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>value</code> last output</span>
                      <span>· <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>input</code> user message</span>
                      <span>· <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>state["id"]</code> any node's output</span>
                      <span>· Combine with <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>&amp;&amp;</code> or <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>||</code></span>
                    </div>
                  </div>
                )}
                {switchType === 'llm_classify' && (
                  <div style={{ padding: '9px 11px', borderRadius: 8, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7, fontSize: 10 }}>
                    <strong style={{ color: C, display: 'block', marginBottom: 3, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>How it works</strong>
                    AI reads the output and picks the closest category name. One LLM call, temperature 0.
                  </div>
                )}
              </div>
            </Field>

            {/* Read from field — non-LLM only */}
            {switchType !== 'llm_classify' && (
              <Field label="Read from field" accentColor={C}>
                <input
                  value={switchInputKey}
                  onChange={e => { setSwitchInputKey(e.target.value); onUpdate({ inputKey: e.target.value || undefined }) }}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }}
                  placeholder="e.g. sentiment or node-id"
                />
                <div style={{ padding: '9px 11px', borderRadius: 8, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7, fontSize: 10, marginTop: 6 }}>
                  <strong style={{ color: C, display: 'block', marginBottom: 3, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>What to read</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span>· Leave blank to match against the full last output</span>
                    <span>· Use a field name (e.g. <code style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, color: C }}>sentiment</code>) to read from the input object</span>
                    <span>· Use any node's ID to match against that node's output specifically</span>
                  </div>
                </div>
              </Field>
            )}

            {/* Classifier model — LLM mode only */}
            {switchType === 'llm_classify' && (
              <Field label="Classifier model" accentColor={C}>
                <div style={{ position: 'relative' }}>
                  <select value={switchModel} onChange={e => { setSwitchModel(e.target.value); onUpdate({ model: e.target.value }) }} style={selectStyle}>
                    <option value="">Default model</option>
                    {modelConfigs.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                  <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                </div>
                <div style={{ padding: '9px 11px', borderRadius: 8, background: meta.bg, border: `1px solid ${C}30`, color: 'var(--text3)', lineHeight: 1.7, fontSize: 10, marginTop: 6 }}>
                  <strong style={{ color: C, display: 'block', marginBottom: 3, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Cost note</strong>
                  Only the provider and API key from this model are used. Temperature and max tokens are fixed at 0 and 20. Each evaluation costs tokens.
                </div>
              </Field>
            )}

            <div style={{ height: 1, background: 'var(--border2)' }} />

            {/* Cases */}
            <Field label="Cases" accentColor={C}>
              <div style={{ display: 'flex', gap: 5, marginBottom: 5, paddingRight: 20 }}>
                <span style={{ flex: 1, fontSize: 9, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Route to</span>
                <span style={{ flex: 2, fontSize: 9, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {switchType === 'expression' ? 'Condition' : switchType === 'llm_classify' ? 'Category' : 'Match value'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {switchCases.map((c, idx) => {
                  // Find which node is currently wired to this case handle
                  const connectedEdge = outgoingEdges.find(e => e.sourceHandle === c.label)
                  const connectedNodeId = connectedEdge?.target ?? ''
                  const availableNodes = allNodes.filter(n => n.data.nodeType !== 'input' && n.id !== nodeId)

                  const handleNodeSelect = (targetNodeId: string) => {
                    onRemoveEdge?.(c.label)
                    if (targetNodeId) {
                      const targetNode = availableNodes.find(n => n.id === targetNodeId)
                      const edgeLabel = targetNode?.data.label ? String(targetNode.data.label) : c.label
                      onAddEdge?.(c.label, targetNodeId, edgeLabel)
                      const updated = switchCases.map((x, i) => i === idx ? { ...x, targetLabel: edgeLabel } : x)
                      setSwitchCases(updated); onUpdate({ cases: updated })
                    } else {
                      const updated = switchCases.map((x, i) => i === idx ? { ...x, targetLabel: undefined } : x)
                      setSwitchCases(updated); onUpdate({ cases: updated })
                    }
                  }

                  return (
                    <div key={idx} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      {/* Node selector — always shown */}
                      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                        <select
                          value={connectedNodeId}
                          onChange={e => handleNodeSelect(e.target.value)}
                          style={{ ...selectStyle, fontSize: 11, padding: '6px 24px 6px 8px', color: connectedNodeId ? 'var(--text)' : 'var(--text4)' }}
                        >
                          <option value="">Route to...</option>
                          {availableNodes.map(n => (
                            <option key={n.id} value={n.id}>{n.data.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={10} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                      </div>

                      {/* Condition / category — shown for all modes */}
                      <input
                        value={c.match}
                        onChange={e => {
                          const updated = switchCases.map((x, i) => i === idx ? { ...x, match: e.target.value } : x)
                          setSwitchCases(updated); onUpdate({ cases: updated })
                        }}
                        style={{ ...inputStyle, flex: 2, minWidth: 0, fontSize: 11, padding: '6px 8px', fontFamily: switchType === 'expression' ? 'monospace' : 'inherit' }}
                        placeholder={switchType === 'expression' ? 'value.includes("error") || value.length > 300' : switchType === 'llm_classify' ? 'billing complaint' : 'billing'}
                      />

                      {switchCases.length > 2 && (
                        <button onClick={() => {
                          if (c.label) onRemoveEdge?.(c.label)
                          const updated = switchCases.filter((_, i) => i !== idx)
                          setSwitchCases(updated); onUpdate({ cases: updated })
                        }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0, flexShrink: 0 }}>
                          <Trash2 size={11} color="var(--error)" />
                        </button>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={() => {
                    const updated = [...switchCases, { label: `Case ${switchCases.length + 1}`, match: '' }]
                    setSwitchCases(updated); onUpdate({ cases: updated })
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px', borderRadius: 7, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 10, cursor: 'pointer' }}>
                  <Plus size={10} /> Add case
                </button>
              </div>
            </Field>

            {/* Default path — node selector */}
            <Field label="Default path" accentColor={C}>
              <div style={{ position: 'relative' }}>
                {(() => {
                  const defaultEdge = outgoingEdges.find(e => e.sourceHandle === 'default')
                  const availableNodes = allNodes.filter(n => n.data.nodeType !== 'input' && n.id !== nodeId)
                  return (
                    <>
                      <select
                        value={defaultEdge?.target ?? ''}
                        onChange={e => {
                          const targetNode = availableNodes.find(n => n.id === e.target.value)
                          onRemoveEdge?.('default')
                          if (e.target.value) {
                            onAddEdge?.('default', e.target.value, 'Default')
                            setSwitchDefault(targetNode?.data.label ?? '')
                            onUpdate({ defaultCase: targetNode?.data.label ?? undefined })
                          }
                        }}
                        style={{ ...selectStyle, color: defaultEdge ? 'var(--text)' : 'var(--text4)' }}
                      >
                        <option value="">No default route</option>
                        {availableNodes.map(n => (
                          <option key={n.id} value={n.id}>{n.data.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={11} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                    </>
                  )
                })()}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6, lineHeight: 1.6 }}>
                Used when no case matches. If unset, the run stops here.
              </div>
            </Field>

          </>)
        })()}
      </div>
    </div>
  )
}
