'use client'
import { useEffect, useState } from 'react'
import { KeyRound, Plus, Copy, CheckCircle, Trash2, Bot, Brain, Wrench, Table2, FileText, Database, Shield, X, Search, Zap } from 'lucide-react'
import SectionLayout from '@/components/ui/SectionLayout'
import { ConfirmModal } from '@/components/ui/Modal'

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

interface ApiKey {
  id: string; name: string; key_prefix: string; is_active: boolean
  total_calls: number; last_used?: string; created_at: string; key?: string
}

const COLS = '1fr 150px 120px 100px 88px 80px'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (d > 30) return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' })
  if (d > 0) return `${d}d ago`; if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`; return 'just now'
}

export default function ApiKeysPage() {
  const [keys, setKeys]             = useState<ApiKey[]>([])
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [newKey, setNewKey]         = useState<string | null>(null)
  const [copied, setCopied]         = useState(false)
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  useEffect(() => {
    fetch('/api/keys').then(r => r.text()).then(t => {
      const d = (() => { try { return JSON.parse(t) } catch { return [] } })()
      setKeys(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const createKey = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    const res = await fetch('/api/keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName }),
    })
    const data = await res.text().then(t => { try { return JSON.parse(t) } catch { return {} } })
    setNewKey(data.key)
    setKeys(k => [{ ...data, is_active: true, total_calls: 0, created_at: new Date().toISOString() }, ...k])
    setNewKeyName('')
    setCreating(false)
  }

  const revokeKey = async (id: string) => {
    await fetch('/api/keys', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setKeys(k => k.map(x => x.id === id ? { ...x, is_active: false } : x))
    setRevokeId(null)
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <SectionLayout nav={AGENTS_NAV}>

      {/* Generate Key modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} onClick={() => { if (!newKey) setShowModal(false) }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(37,99,235,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <KeyRound size={14} color="var(--accent)" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                {newKey ? 'Key Created' : 'Generate API Key'}
              </span>
              {!newKey && (
                <button onClick={() => setShowModal(false)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
                  <X size={13} />
                </button>
              )}
            </div>

            <div style={{ padding: '20px 22px' }}>
              {newKey ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--success-bg)', border: '1px solid var(--success-border)' }}>
                    <CheckCircle size={13} color="var(--success)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>Copy this key now. It will not be shown again.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)', marginBottom: 16 }}>
                    <code style={{ fontSize: 12, fontFamily: 'monospace', flex: 1, color: 'var(--text)', wordBreak: 'break-all' }}>{newKey}</code>
                    <button onClick={() => copy(newKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, color: copied ? 'var(--success)' : 'var(--text3)' }}>
                      {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                  <button onClick={() => { setNewKey(null); setShowModal(false) }} style={{ width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Done, I saved my key
                  </button>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Key Name</div>
                    <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createKey()}
                      placeholder="e.g. Production, My App, Staging" autoFocus
                      style={{ width: '100%', height: 36, padding: '0 11px', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Used to identify this key in your dashboard.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={createKey} disabled={creating || !newKeyName.trim()} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 600, cursor: creating || !newKeyName.trim() ? 'not-allowed' : 'pointer', opacity: creating || !newKeyName.trim() ? 0.5 : 1 }}>
                      {creating ? 'Generating…' : 'Generate Key'}
                    </button>
                    <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!revokeId} onClose={() => setRevokeId(null)}
        onConfirm={() => revokeKey(revokeId!)}
        title="Revoke this key?" message="All requests using this key will fail immediately. This cannot be undone." danger
      />

      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 36px 20px' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 3 }}>API Keys</h1>
            <p style={{ fontSize: 12, color: 'var(--text3)' }}>Authenticate requests to your agent endpoints.</p>
          </div>
          <button onClick={() => { setShowModal(true); setNewKey(null); setNewKeyName('') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={13} strokeWidth={2.5} /> Generate Key
          </button>
        </div>

        {/* Search */}
        <div style={{ flexShrink: 0, position: 'relative', marginBottom: 12 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search keys…"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Table header — fixed */}
        {!loading && keys.length > 0 && (
          <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: COLS, padding: '7px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px 10px 0 0', borderBottom: 'none' }}>
            {['Name', 'Key prefix', 'Activity', 'Last used', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
            ))}
          </div>
        )}

        {/* Rows only — scroll */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {(() => {
            const filtered = keys.filter(k => !search || k.name.toLowerCase().includes(search.toLowerCase()))
            const maxCalls = Math.max(...keys.map(k => k.total_calls), 1)
            const colors = ['#2563EB','#7C3AED','#0891B2','#16A34A','#D97706','#DB2777','#9333EA','#EA580C']
            const keyColor = (name: string) => colors[name.charCodeAt(0) % colors.length]
            return (
            <div style={{ borderRadius: !loading && keys.length > 0 ? '0 0 12px 12px' : 12, border: '1px solid var(--border)', borderTop: !loading && keys.length > 0 ? 'none' : '1px solid var(--border)', background: 'var(--card-bg)', overflow: 'hidden' }}>
            {loading ? (
              [0, 1, 2].map(i => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: COLS, padding: '12px 16px', borderBottom: '1px solid var(--border2)', alignItems: 'center', opacity: 1 - i * 0.2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0 }} />
                    <div style={{ height: 12, width: '60%', borderRadius: 4, background: 'var(--surface2)', animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                  </div>
                  <div style={{ height: 10, width: 90, borderRadius: 4, background: 'var(--surface2)' }} />
                  <div style={{ height: 10, width: 80, borderRadius: 4, background: 'var(--surface2)' }} />
                  <div style={{ height: 10, width: 60, borderRadius: 4, background: 'var(--surface2)' }} />
                  <div style={{ height: 20, width: 60, borderRadius: 10, background: 'var(--surface2)' }} />
                  <div />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div style={{ padding: '56px 24px', textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  {search ? <Search size={18} color="var(--text3)" /> : <KeyRound size={18} color="var(--text3)" />}
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{search ? 'No keys match' : 'No API keys yet'}</p>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: search ? 0 : 18 }}>
                  {search ? `Nothing found for "${search}"` : 'Generate a key to start calling your agents externally.'}
                </p>
                {!search && (
                  <button onClick={() => setShowModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <Plus size={13} /> Generate your first key
                  </button>
                )}
              </div>
            ) : (
              filtered.map((key, idx) => {
                const color = keyColor(key.name)
                const letter = key.name.trim()[0]?.toUpperCase() ?? '?'
                const callsPct = Math.max(key.total_calls > 0 ? 3 : 0, Math.round((key.total_calls / maxCalls) * 100))
                return (
                  <div key={key.id} style={{ display: 'grid', gridTemplateColumns: COLS, padding: '10px 16px', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border2)' : 'none', alignItems: 'center', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Name with avatar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color }}>
                        {letter}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{key.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Created {timeAgo(key.created_at)}</div>
                      </div>
                    </div>
                    {/* Key prefix */}
                    <code style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)' }}>{key.key_prefix}…</code>
                    {/* Activity bar + call count */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                        <div style={{ width: `${callsPct}%`, height: '100%', background: color, borderRadius: 2, opacity: 0.7 }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        <Zap size={9} color="var(--text3)" />
                        <span style={{ fontSize: 11, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums', minWidth: 16 }}>{key.total_calls}</span>
                      </div>
                    </div>
                    {/* Last used */}
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{key.last_used ? timeAgo(key.last_used) : 'Never'}</span>
                    {/* Status */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: key.is_active ? 'var(--success-bg)' : 'var(--error-bg)', color: key.is_active ? 'var(--success)' : 'var(--error)', border: `1px solid ${key.is_active ? 'var(--success-border)' : 'var(--error-border)'}`, width: 'fit-content' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                      {key.is_active ? 'Active' : 'Revoked'}
                    </span>
                    {/* Actions */}
                    <div>
                      {key.is_active && (
                        <button onClick={() => setRevokeId(key.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                          <Trash2 size={11} /> Revoke
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            </div>
            )
          })()}
        </div>{/* end rows scroll */}
      </div>

      <style>{`@keyframes dash-shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </SectionLayout>
  )
}
