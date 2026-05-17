'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef, Suspense } from 'react'
import {
  Zap, LogOut, X, ChevronDown, ChevronLeft, ChevronRight, Trash2, CheckCircle, Loader2,
  Bot, MessageSquare, LayoutDashboard, Activity,
  Brain, Wrench, Table2, KeyRound, FileText, Database, Shield,
} from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import BuildPage from '@/app/(dashboard)/build/page'
import ChatPage from '@/app/(dashboard)/chat/page'

type NavIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>
type NavLoadFn = () => void

/* ── Sidebar nav data ────────────────────────────────────────── */
const SIDEBAR_GROUPS = [
  {
    group: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: (p: string) => p === '/dashboard' },
      { href: '/runs',      label: 'Runs',      icon: Activity,        match: (p: string) => p === '/runs' || p.startsWith('/runs/') },
    ],
  },
  {
    group: 'Workspace',
    items: [
      { href: '/agents',     label: 'Agents',     icon: Bot,      match: (p: string) => p === '/agents' || p.startsWith('/agents/') || p.startsWith('/builder/') },
      { href: '/models',     label: 'Models',     icon: Brain,    match: (p: string) => p.startsWith('/models') },
      { href: '/tools',      label: 'Tools',      icon: Wrench,   match: (p: string) => p.startsWith('/tools') },
      { href: '/prompts',    label: 'Prompts',    icon: FileText, match: (p: string) => p.startsWith('/prompts') },
      { href: '/memory',     label: 'Memory',     icon: Database, match: (p: string) => p.startsWith('/memory') },
      { href: '/guardrails', label: 'Guardrails', icon: Shield,   match: (p: string) => p.startsWith('/guardrails') },
      { href: '/datatables', label: 'Datatables', icon: Table2,   match: (p: string) => p.startsWith('/datatables') },
      { href: '/api-keys',   label: 'API Keys',   icon: KeyRound, match: (p: string) => p.startsWith('/api-keys') },
    ],
  },
]

/* ── Sidebar link ────────────────────────────────────────────── */
function SidebarNavLink({ href, label, icon: Icon, active, onNavigate }: {
  href: string; label: string; icon: NavIcon; active: boolean; onNavigate: NavLoadFn
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 32, padding: '0 10px', borderRadius: 7,
        textDecoration: 'none',
        background: active ? 'var(--text)' : hovered ? 'var(--surface2)' : 'transparent',
        color: active ? 'var(--bg)' : hovered ? 'var(--text)' : 'var(--text2)',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      <Icon size={14} strokeWidth={active ? 2.2 : 1.8} />
      <span style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{label}</span>
    </Link>
  )
}

/* ── Global collapsible sidebar ──────────────────────────────── */
function GlobalSidebar({ open, path, onNavigate, onToggle }: {
  open: boolean; path: string; onNavigate: NavLoadFn; onToggle: NavLoadFn
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const toggleGroup = (group: string) =>
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }))

  return (
    <aside style={{
      width: open ? 200 : 0,
      flexShrink: 0,
      overflow: 'hidden',
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      borderRight: open ? '1px solid var(--border)' : 'none',
      background: 'var(--surface)',
      position: 'sticky',
      top: 64,
      height: 'calc(100vh - 64px)',
      alignSelf: 'flex-start',
      overflowY: 'auto',
    }}>
      <div style={{
        width: 200,
        transform: open ? 'translateY(0)' : 'translateY(-12px)',
        opacity: open ? 1 : 0,
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.18s ease',
        pointerEvents: open ? 'auto' : 'none',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* ‹‹ Collapse button — top-right of the panel */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 8px 2px' }}>
          <button
            onClick={onToggle}
            title="Collapse sidebar"
            style={{
              height: 28, padding: '0 8px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--surface2)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text2)',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--text)'; e.currentTarget.style.color = 'var(--bg)'; e.currentTarget.style.borderColor = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {[1, 0.5].map((opacity, i) => (
                <ChevronLeft key={i} size={11} strokeWidth={2.8} style={{ opacity, marginLeft: i > 0 ? -4 : 0 }} />
              ))}
            </div>
          </button>
        </div>

        {/* Nav groups */}
        <div style={{ padding: '8px 10px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {SIDEBAR_GROUPS.map(({ group, items }) => {
          const isCollapsed = collapsedGroups[group] ?? false
          return (
            <div key={group} style={{ marginBottom: 6 }}>
              <button
                onClick={() => toggleGroup(group)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 10px 6px', border: 'none', background: 'transparent',
                  cursor: 'pointer', marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                  {group}
                </span>
                <ChevronRight
                  size={11} color="var(--text3)"
                  style={{ transform: isCollapsed ? 'none' : 'rotate(90deg)', transition: 'transform 0.15s' }}
                />
              </button>

              {!isCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {items.map(({ href, label, icon, match }) => (
                    <SidebarNavLink
                      key={href} href={href} label={label} icon={icon}
                      active={match(path)}
                      onNavigate={() => { if (!match(path)) onNavigate() }}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        </div>{/* end nav groups */}
      </div>{/* end inner column */}
    </aside>
  )
}

function Pipe() {
  return <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0, margin: '0 4px' }} />
}

/* ── Imagine an Agent button ─────────────────────────────────── */
function BuildButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className={isOpen ? undefined : 'laser-border'}
      style={{ marginLeft: 8, display: 'inline-flex', borderRadius: 10 }}
    >
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex', alignItems: 'center',
          height: 32, padding: '0 13px', borderRadius: 8,
          cursor: 'pointer', whiteSpace: 'nowrap',
          border: isOpen ? 'none' : `1px solid ${hovered ? 'var(--accent-border)' : 'var(--border)'}`,
          background: isOpen ? 'var(--text)' : hovered ? 'var(--accent-light)' : 'transparent',
          color: isOpen ? 'var(--bg)' : hovered ? 'var(--accent)' : 'var(--text2)',
          fontSize: 13, fontWeight: 600,
          transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        }}
      >
        Imagine an Agent
      </button>
    </div>
  )
}

/* ── Build modal ─────────────────────────────────────────────── */
function BuildModal({ onClose }: { onClose: () => void }) {
  const [models, setModels] = useState<{ id: string; name: string; provider: string; model_id: string }[]>([])
  const [selectedModel, setSelectedModel] = useState('')

  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(d => { if (Array.isArray(d)) setModels(d) }).catch(() => {})
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'pageFadeIn 0.15s ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 960, height: '90vh',
        background: 'var(--bg)',
        borderRadius: 16, border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 16px', height: 52, flexShrink: 0,
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', flex: 1 }}>
            Imagine an Agent
          </span>

          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            style={{
              padding: '5px 28px 5px 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text2)', fontSize: 12, cursor: 'pointer',
              outline: 'none', appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
              maxWidth: 200,
            }}
          >
            <option value="">Gemini 2.5 Flash</option>
            {models.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>

          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text3)', transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', color: 'var(--text3)', fontSize: 13 }}>
              Loading…
            </div>
          }>
            <BuildPage
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              models={models}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

/* ── Chat icon button ────────────────────────────────────────── */
function ChatButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  const [tooltip, setTooltip] = useState(false)
  return (
    <div style={{ position: 'relative', marginLeft: 4 }}>
      <button
        onClick={onClick}
        onMouseEnter={e => { setTooltip(true); if (!isOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.05)' }}
        onMouseLeave={e => { setTooltip(false); if (!isOpen) e.currentTarget.style.background = 'transparent' }}
        style={{
          width: 34, height: 34, borderRadius: 9, border: 'none',
          background: isOpen ? 'var(--text)' : 'transparent',
          color: isOpen ? 'var(--bg)' : 'var(--text3)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <MessageSquare size={15} strokeWidth={1.8} />
      </button>
      {tooltip && !isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--text)', color: 'var(--bg)',
          fontSize: 11, fontWeight: 500, padding: '4px 9px', borderRadius: 6,
          whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 200,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          Chat with an Agent
          <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '5px solid var(--text)' }} />
        </div>
      )}
    </div>
  )
}

/* ── Chat modal ──────────────────────────────────────────────── */
function ChatModal({ onClose }: { onClose: () => void }) {
  const [runHistory, setRunHistory] = useState<{ id: string; created_at: string; status: string; input: unknown }[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [ddOpen, setDdOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletedId, setDeletedId] = useState<string | null>(null)
  const loadRunRef = useRef<((id: string) => void) | null>(null)
  const ddRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (ddOpen) setDdOpen(false); else onClose() } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, ddOpen])

  useEffect(() => {
    if (!ddOpen) return
    const handler = (e: MouseEvent) => { if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDdOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ddOpen])

  const handleRunHistoryReady = (history: { id: string; created_at: string; status: string; input: unknown }[], loadRun: (id: string) => void) => {
    setRunHistory(history)
    setSelectedRunId('')
    loadRunRef.current = loadRun
  }

  const deleteRun = async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(runId)
    await fetch(`/api/runs/${runId}`, { method: 'DELETE' })
    setDeletingId(null)
    setDeletedId(runId)
    setTimeout(() => {
      setDeletedId(null)
      setRunHistory(prev => prev.filter(r => r.id !== runId))
      if (selectedRunId === runId) setSelectedRunId('')
    }, 800)
  }

  const formatRunLabel = (run: { id: string; created_at: string; input: unknown }) => {
    const label = typeof run.input === 'string' ? run.input
      : (run.input as Record<string, unknown>)?.message
        ? String((run.input as Record<string, unknown>).message)
        : 'Run'
    const d = new Date(run.created_at)
    const date = `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`
    return { date, label: label.slice(0, 28) + (label.length > 28 ? '…' : '') }
  }

  const selectedRun = runHistory.find(r => r.id === selectedRunId)
  const selectedLabel = selectedRun ? formatRunLabel(selectedRun) : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'pageFadeIn 0.15s ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 960, height: '90vh',
        background: 'var(--bg)',
        borderRadius: 16, border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 16px', height: 52, flexShrink: 0,
          borderBottom: '1px solid var(--border)',
        }}>
          <MessageSquare size={15} color="var(--text3)" strokeWidth={1.8} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', flex: 1 }}>
            Chat with an Agent
          </span>

          {runHistory.length > 0 && (
            <div ref={ddRef} style={{ position: 'relative', width: 200, flexShrink: 0 }}>
              <button
                onClick={() => setDdOpen(o => !o)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 8px 5px 10px', borderRadius: 7,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: selectedLabel ? 'var(--text)' : 'var(--text3)',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  outline: 'none', transition: 'border-color 0.15s',
                }}
              >
                <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedLabel ? `${selectedLabel.date} - ${selectedLabel.label}` : 'Run history…'}
                </span>
                <ChevronDown size={11} color="var(--text3)" style={{ flexShrink: 0, transform: ddOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>

              {ddOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 5px)', right: 0,
                  width: 200, zIndex: 400,
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 10, boxShadow: 'var(--shadow-lg)',
                  overflowX: 'hidden', maxHeight: 220, overflowY: 'auto',
                }}>
                  {runHistory.map(run => {
                    const { date, label } = formatRunLabel(run)
                    const isSelected = run.id === selectedRunId
                    return (
                      <div
                        key={run.id}
                        style={{
                          display: 'flex', alignItems: 'center',
                          padding: '8px 10px', cursor: 'pointer',
                          background: isSelected ? 'var(--surface2)' : 'transparent',
                          borderBottom: '1px solid var(--border2)',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface)' }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                        onClick={() => {
                          setSelectedRunId(run.id)
                          setDdOpen(false)
                          if (loadRunRef.current) loadRunRef.current(run.id)
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{date}</div>
                        </div>
                        <button
                          onClick={(e) => deleteRun(run.id, e)}
                          disabled={deletingId === run.id || deletedId === run.id}
                          style={{
                            width: 24, height: 24, borderRadius: 6, border: 'none',
                            background: deletedId === run.id ? 'var(--success-bg)' : 'var(--error-bg)',
                            cursor: deletingId === run.id || deletedId === run.id ? 'default' : 'pointer',
                            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: deletedId === run.id ? 'var(--success)' : 'var(--error)',
                            transition: 'opacity 0.1s',
                            opacity: deletingId === run.id ? 0.6 : 1,
                          }}
                          onMouseEnter={e => { if (!deletingId && !deletedId) e.currentTarget.style.opacity = '0.75' }}
                          onMouseLeave={e => { if (!deletingId && !deletedId) e.currentTarget.style.opacity = '1' }}
                        >
                          {deletingId === run.id
                            ? <Loader2 size={11} style={{ animation: 'spin 0.7s linear infinite' }} />
                            : deletedId === run.id
                            ? <CheckCircle size={11} />
                            : <Trash2 size={11} />
                          }
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text3)', transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'stretch', minHeight: 0 }}>
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', color: 'var(--text3)', fontSize: 13 }}>
              Loading…
            </div>
          }>
            <ChatPage onRunHistoryReady={handleRunHistoryReady} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

/* ── User avatar dropdown ────────────────────────────────────── */
function UserMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const [initials, setInitials] = useState('?')
  const [email, setEmail] = useState('')

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) return
      setEmail(u.email ?? '')
      const name: string = u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? ''
      const parts = name.trim().split(/\s+/)
      setInitials(parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase()
      )
    })
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--text)', color: 'var(--bg)',
          border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {initials}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 200,
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 4, minWidth: 180,
            boxShadow: 'var(--shadow-md)',
          }}>
            {email && (
              <div style={{ padding: '8px 10px 10px', fontSize: 11, color: 'var(--text3)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                {email}
              </div>
            )}
            <button
              onClick={() => { setOpen(false); onSignOut() }}
              style={{
                width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 7,
                border: 'none', background: 'transparent',
                color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [showBuild,   setShowBuild]   = useState(false)
  const [showChat,    setShowChat]    = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [navLoading,  setNavLoading]  = useState(false)

  useEffect(() => { setShowBuild(false); setShowChat(false); setNavLoading(false) }, [path])

  useEffect(() => {
    document.body.style.overflow = (showBuild || showChat) ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showBuild, showChat])

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  if (path === '/docs' || path.startsWith('/docs/')) {
    return <>{children}</>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── Top bar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto', padding: '0 24px',
          height: 64, display: 'flex', alignItems: 'center', gap: 0,
        }}>
          {/* Logo */}
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
            <Zap size={20} color="#2563EB" strokeWidth={2.5} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>AgentHub</div>
              <div style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 3 }}>Built for engineers who ship</div>
            </div>
          </Link>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Right side */}
          <ChatButton  isOpen={showChat}  onClick={() => setShowChat(o => !o)} />
          <BuildButton isOpen={showBuild} onClick={() => setShowBuild(o => !o)} />

          <Pipe />

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ThemeToggle />
            <UserMenu onSignOut={signOut} />
          </div>
        </div>
      </header>

      {/* ›› Expand sliver — fixed at left edge, 40% from top, when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          title="Expand sidebar"
          style={{
            position: 'fixed',
            left: 0,
            top: 120,
            zIndex: 95,
            width: 16,
            height: 32,
            borderRadius: '0 8px 8px 0',
            border: '1px solid var(--border)',
            borderLeft: 'none',
            background: 'var(--text)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--bg)',
            opacity: 0.75,
            transition: 'width 0.15s ease, opacity 0.15s',
            padding: 0,
            animation: 'sliverIn 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.width = '22px'
            e.currentTarget.style.opacity = '1'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.width = '16px'
            e.currentTarget.style.opacity = '0.75'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {[0.5, 1].map((opacity, i) => (
              <ChevronRight key={i} size={10} strokeWidth={2.8} style={{ opacity, marginLeft: i > 0 ? -4 : 0 }} />
            ))}
          </div>
        </button>
      )}

      {/* ── Sidebar + page — flex row, fixed height so nothing overflows the viewport ── */}
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        <GlobalSidebar
          open={sidebarOpen}
          path={path}
          onNavigate={() => setNavLoading(true)}
          onToggle={() => setSidebarOpen(o => !o)}
        />

        <main key={path} style={{ flex: 1, minWidth: 0, overflowY: 'auto', animation: 'pageFadeIn 0.18s ease' }}>
          {navLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--text)', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : children}
        </main>
      </div>

      {showBuild && <BuildModal onClose={() => setShowBuild(false)} />}
      {showChat  && <ChatModal  onClose={() => setShowChat(false)} />}
    </div>
  )
}
