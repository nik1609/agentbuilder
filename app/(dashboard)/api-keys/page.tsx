'use client'
import { useEffect, useState } from 'react'
import { KeyRound, Plus, Copy, CheckCircle, Trash2, AlertCircle } from 'lucide-react'

interface ApiKey {
  id: string; name: string; key_prefix: string; is_active: boolean
  total_calls: number; last_used?: string; created_at: string
  key?: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/keys').then(r => r.text()).then(t => { const d = (() => { try { return JSON.parse(t) } catch { return [] } })()
      setKeys(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const createKey = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName }),
    })
    const data = await res.text().then(t => { try { return JSON.parse(t) } catch { return {} } })
    setNewKey(data.key)
    setKeys(k => [{ ...data, key_prefix: data.keyPrefix, is_active: true, total_calls: 0, created_at: new Date().toISOString() }, ...k])
    setNewKeyName('')
    setShowForm(false)
    setCreating(false)
  }

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this key? All requests using it will fail immediately.')) return
    await fetch('/api/keys', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setKeys(k => k.map(x => x.id === id ? { ...x, is_active: false } : x))
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ padding: '48px', maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 48 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>API Keys</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>Authenticate requests to your agent endpoints</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 20px', borderRadius: 12,
          background: 'var(--blue)', color: '#fff',
          fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
        }}>
          <Plus size={15} /> Generate Key
        </button>
      </div>

      {/* New key reveal */}
      {newKey && (
        <div style={{ marginBottom: 24, padding: 24, borderRadius: 16, background: 'rgba(34,215,154,0.05)', border: '1px solid rgba(34,215,154,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <CheckCircle size={18} color="var(--green)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>API key created — copy it now, it won&apos;t be shown again</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <code style={{ fontSize: 13, fontFamily: 'monospace', flex: 1, color: 'var(--text)', wordBreak: 'break-all' }}>{newKey}</code>
            <button onClick={() => copy(newKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              {copied ? <CheckCircle size={16} color="var(--green)" /> : <Copy size={16} color="var(--text3)" />}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>
            ✓ I&apos;ve saved my key
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div style={{ marginBottom: 24, padding: 24, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Name this key</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createKey()}
              placeholder="e.g. Production, My App, Staging…"
              autoFocus
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 14,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text)', outline: 'none',
              }}
            />
            <button onClick={createKey} disabled={creating} style={{
              padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              background: 'var(--blue)', color: '#fff', border: 'none', cursor: 'pointer',
              opacity: creating ? 0.6 : 1,
            }}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} style={{
              padding: '10px 16px', borderRadius: 10, fontSize: 14,
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Usage hint */}
      <div style={{ marginBottom: 32, padding: '14px 20px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <AlertCircle size={14} color="var(--text3)" style={{ flexShrink: 0 }} />
        <code style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text2)' }}>
          curl -H &quot;X-AgentHub-Key: ahk_...&quot; {typeof window !== 'undefined' ? window.location.origin : ''}/api/agents/:id/run
        </code>
      </div>

      {/* Keys list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 14 }}>Loading…</div>
      ) : keys.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 40px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(124,111,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <KeyRound size={24} color="var(--blue)" />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No API keys yet</p>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Generate a key to start calling your agents</p>
        </div>
      ) : (
        <div style={{ borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 110px 90px 80px', padding: '12px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {['Name', 'Key prefix', 'Calls', 'Last used', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {keys.map(key => (
            <div key={key.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 110px 90px 80px', padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border2)', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{key.name}</span>
              <code style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)' }}>{key.key_prefix}…</code>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{key.total_calls}</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                background: key.is_active ? 'rgba(34,215,154,0.1)' : 'rgba(232,85,85,0.1)',
                color: key.is_active ? 'var(--green)' : 'var(--red)',
                width: 'fit-content',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                {key.is_active ? 'Active' : 'Revoked'}
              </span>
              <div>
                {key.is_active && (
                  <button onClick={() => revokeKey(key.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Trash2 size={12} /> Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
