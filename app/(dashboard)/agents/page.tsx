'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Upload, X, AlertCircle,
  Zap, Bot, Brain, Wrench, Table2, KeyRound,
  FileText, Database, Shield, Search, Loader2, ChevronRight,
} from 'lucide-react'
import SectionLayout from '@/components/ui/SectionLayout'

const AGENTS_NAV = [
  { href: '/agents',     label: 'Agents',     icon: Bot,      match: (p: string) => p === '/agents' || p.startsWith('/agents/') || p.startsWith('/builder/') },
  { href: '/models',     label: 'Models',     icon: Brain,    match: (p: string) => p.startsWith('/models') },
  { href: '/tools',      label: 'Tools',      icon: Wrench,   match: (p: string) => p.startsWith('/tools') },
  { href: '/prompts',    label: 'Prompts',    icon: FileText, match: (p: string) => p.startsWith('/prompts') },
  { href: '/memory',     label: 'Memory',     icon: Database, match: (p: string) => p.startsWith('/memory') },
  { href: '/guardrails', label: 'Guardrails', icon: Shield,   match: (p: string) => p.startsWith('/guardrails') },
  { href: '/datatables', label: 'Datatables', icon: Table2,   match: (p: string) => p.startsWith('/datatables') },
  { href: '/api-keys',   label: 'API Keys',   icon: KeyRound, match: (p: string) => p.startsWith('/api-keys') },
]

interface Agent {
  id: string; name: string; description: string; version: number
  run_count: number; updated_at: string; created_at: string
}

function ConfirmModal({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onClick={onCancel} />
      <div style={{ position: 'relative', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px', maxWidth: 400, width: 'calc(100% - 48px)', boxShadow: 'var(--shadow-xl)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--error)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

function AgentAvatar({ name }: { name: string }) {
  const letter = name.trim()[0]?.toUpperCase() ?? '?'
  // Generate a consistent color from the name
  const colors = ['#7C3AED', '#2563EB', '#0891B2', '#16A34A', '#D97706', '#DB2777', '#EA580C', '#9333EA']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
      background: `${color}18`, border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 700, color,
    }}>
      {letter}
    </div>
  )
}

export default function AgentsPage() {
  const router = useRouter()
  const [agents, setAgents]     = useState<Agent[]>([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [search, setSearch]     = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importing, setImporting]   = useState(false)
  const [importError, setImportError] = useState('')
  const [confirmModal, setConfirmModal] = useState<null | { title: string; message: string; onConfirm: () => void }>(null)

  useEffect(() => {
    fetch('/api/agents').then(r => r.text()).then(t => {
      const d = (() => { try { return JSON.parse(t) } catch { return [] } })()
      setAgents(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  async function createNewAgent() {
    setCreating(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Agent', description: '', schema: { nodes: [], edges: [] } }),
      })
      const agent = await res.json() as Agent
      setAgents(a => [agent, ...a])
      router.push(`/builder/${agent.id}`)
    } finally { setCreating(false) }
  }

  function deleteAgent(id: string, name: string) {
    setConfirmModal({
      title: `Delete "${name}"?`,
      message: 'This will permanently remove the agent and all its configuration. Existing run data is kept.',
      onConfirm: async () => {
        setConfirmModal(null)
        await fetch(`/api/agents/${id}`, { method: 'DELETE' })
        setAgents(a => a.filter(x => x.id !== id))
      },
    })
  }

  const handleImport = async () => {
    setImportError('')
    let parsed: Record<string, unknown>
    try { parsed = JSON.parse(importJson) }
    catch { setImportError('Invalid JSON — check formatting and try again.'); return }
    if (!parsed.name || typeof parsed.name !== 'string') { setImportError('Missing required field: "name"'); return }
    if (!parsed.schema || typeof parsed.schema !== 'object') { setImportError('Missing required field: "schema"'); return }
    setImporting(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: parsed.name, description: parsed.description ?? '', schema: parsed.schema }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as { error?: string }).error ?? 'Import failed') }
      const created = await res.json() as Agent
      setAgents(a => [created, ...a])
      setShowImport(false); setImportJson('')
      router.push(`/builder/${created.id}`)
    } catch (e) { setImportError(e instanceof Error ? e.message : 'Import failed') }
    finally { setImporting(false) }
  }

  const filtered = agents.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <SectionLayout nav={AGENTS_NAV}>
      {confirmModal && <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal(null)} />}

      {/* Import modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 520, borderRadius: 16, background: 'var(--card-bg)', border: '1px solid var(--border)', padding: 28, boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Import Agent</h2>
                <p style={{ fontSize: 12, color: 'var(--text3)' }}>Paste exported agent JSON</p>
              </div>
              <button onClick={() => { setShowImport(false); setImportError(''); setImportJson('') }} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
                <X size={13} />
              </button>
            </div>
            <textarea value={importJson} onChange={e => { setImportJson(e.target.value); setImportError('') }}
              placeholder={'{\n  "name": "My Agent",\n  "description": "...",\n  "schema": { "nodes": [], "edges": [] }\n}'}
              rows={10}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${importError ? 'var(--error)' : 'var(--border)'}`, background: 'var(--surface2)', color: 'var(--text)', fontSize: 12, fontFamily: 'monospace', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
            />
            {importError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--error-bg)', border: '1px solid var(--error-border)' }}>
                <AlertCircle size={12} color="var(--error)" />
                <span style={{ fontSize: 12, color: 'var(--error)' }}>{importError}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => { setShowImport(false); setImportError(''); setImportJson('') }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleImport} disabled={importing || !importJson.trim()} style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 600, cursor: importing || !importJson.trim() ? 'not-allowed' : 'pointer', opacity: importing || !importJson.trim() ? 0.5 : 1 }}>
                {importing ? 'Importing…' : 'Import & Open Builder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-height layout */}
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 36px 20px' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 2 }}>Agents</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>
              {loading ? 'Loading…' : `${agents.length} agent${agents.length !== 1 ? 's' : ''} · each deployed as a live API endpoint`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowImport(true)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
              <Upload size={12} /> Import
            </button>
            <button onClick={createNewAgent} disabled={creating} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 8,
              background: 'var(--primary)', color: 'var(--primary-fg)',
              fontSize: 12, fontWeight: 600, border: 'none', cursor: creating ? 'default' : 'pointer',
              opacity: creating ? 0.7 : 1,
            }}>
              {creating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} strokeWidth={2.5} />}
              {creating ? 'Creating…' : 'New Agent'}
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ flexShrink: 0, position: 'relative', marginBottom: 14 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Table header */}
        {!loading && agents.length > 0 && (
          <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 88px 100px 60px 90px 90px 32px', gap: 0, padding: '7px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px 10px 0 0', borderBottom: 'none' }}>
            {['Agent', 'Status', 'Activity', 'Runs', 'Created', 'Updated', ''].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
            ))}
          </div>
        )}

        {/* Agent list — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, borderRadius: loading || agents.length === 0 ? 12 : '0 0 12px 12px', border: '1px solid var(--border)', background: 'var(--card-bg)' }}>
          {loading ? (
            [0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid var(--border2)', opacity: 1 - i * 0.12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface2)', flexShrink: 0, animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 12, width: `${30 + i * 7}%`, borderRadius: 4, background: 'var(--surface2)' }} />
                  <div style={{ height: 10, width: `${50 + i * 4}%`, borderRadius: 4, background: 'var(--surface2)' }} />
                </div>
                <div style={{ width: 48, height: 20, borderRadius: 6, background: 'var(--surface2)' }} />
                <div style={{ width: 88, height: 28, borderRadius: 8, background: 'var(--surface2)' }} />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                {search ? <Search size={20} color="var(--text3)" /> : <Zap size={20} color="var(--text3)" />}
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                {search ? 'No agents match' : 'No agents yet'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: search ? 0 : 20 }}>
                {search ? `Nothing found for "${search}"` : 'Build your first agent and deploy it as a REST API.'}
              </p>
              {!search && (
                <button onClick={createNewAgent} disabled={creating} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  <Plus size={13} /> Build your first agent
                </button>
              )}
            </div>
          ) : (
            filtered.map((agent, idx) => (
              <AgentRow key={agent.id} agent={agent} isLast={idx === filtered.length - 1}
                maxRuns={Math.max(...agents.map(a => a.run_count), 1)}
                onDelete={() => deleteAgent(agent.id, agent.name)}
                onClick={() => router.push(`/builder/${agent.id}`)} />
            ))
          )}
        </div>
      </div>
      <style>{`
        @keyframes dash-shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </SectionLayout>
  )
}

function AgentRow({ agent, isLast, maxRuns, onDelete, onClick }: {
  agent: Agent; isLast: boolean; maxRuns: number; onDelete: () => void; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [showTip, setShowTip] = useState(false)

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
    if (d > 30) return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' })
    if (d > 0) return `${d}d ago`; if (h > 0) return `${h}h ago`
    if (m > 0) return `${m}m ago`; return 'just now'
  }

  // Activity: run count relative to the most active agent
  const activityPct = maxRuns > 0 ? Math.max(3, Math.round((agent.run_count / maxRuns) * 100)) : 0
  const colors = ['#7C3AED', '#2563EB', '#0891B2', '#16A34A', '#D97706', '#DB2777', '#EA580C', '#9333EA']
  const accentColor = colors[agent.name.charCodeAt(0) % colors.length]

  // Status pill
  const statusLabel = agent.run_count === 0 ? 'Not run yet' : agent.run_count > 10 ? 'Active' : 'In use'
  const statusColor = agent.run_count === 0 ? 'var(--text3)' : agent.run_count > 10 ? 'var(--success)' : 'var(--accent)'
  const statusBg    = agent.run_count === 0 ? 'var(--surface2)' : agent.run_count > 10 ? 'var(--success-bg)' : 'var(--accent-light)'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid', gridTemplateColumns: '1fr 88px 100px 60px 90px 90px 32px',
        alignItems: 'center', gap: 0,
        padding: '8px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--border2)',
        background: hovered ? 'var(--surface2)' : 'transparent',
        cursor: 'pointer', transition: 'background 0.1s',
      }}
    >
      {/* Name + description */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, paddingRight: 16 }}>
        <AgentAvatar name={agent.name} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.name}</span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '1px 4px', borderRadius: 3, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)', flexShrink: 0 }}>v{agent.version}</span>
          </div>
          <div style={{ position: 'relative', maxWidth: 220 }}
            onMouseEnter={() => agent.description && setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {agent.description || <span style={{ fontStyle: 'italic' }}>No description</span>}
            </div>
            {showTip && agent.description && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 1000,
                background: '#0D0D0D', color: '#fff',
                fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6,
                whiteSpace: 'normal', maxWidth: 320, lineHeight: 1.5,
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)', pointerEvents: 'none',
              }}>
                {agent.description}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status pill */}
      <div>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: statusBg, color: statusColor, whiteSpace: 'nowrap' }}>
          {statusLabel}
        </span>
      </div>

      {/* Activity bar */}
      <div style={{ paddingRight: 16 }}>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
          <div style={{ width: `${activityPct}%`, height: '100%', background: accentColor, borderRadius: 2, opacity: 0.75 }} />
        </div>
      </div>

      {/* Run count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Zap size={10} color="var(--text3)" />
        <span style={{ fontSize: 12, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>{agent.run_count.toLocaleString()}</span>
      </div>

      {/* Created */}
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(agent.created_at)}</div>

      {/* Updated */}
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(agent.updated_at)}</div>

      {/* Delete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
        <button onClick={e => { e.stopPropagation(); onDelete() }} style={{
          width: 24, height: 24, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error)', opacity: 0.5, transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}
