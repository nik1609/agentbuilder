'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bot, Plus, Trash2, ExternalLink, Zap, Upload, X, AlertCircle } from 'lucide-react'

interface Agent {
  id: string; name: string; description: string; version: number
  run_count: number; updated_at: string; created_at: string
}

export default function AgentsPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/agents').then(r => r.text()).then(t => { const d = (() => { try { return JSON.parse(t) } catch { return [] } })()
      setAgents(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])



  const deleteAgent = async (id: string) => {
    if (!confirm('Delete this agent? This cannot be undone.')) return
    await fetch(`/api/agents/${id}`, { method: 'DELETE' })
    setAgents(a => a.filter(x => x.id !== id))
  }

  const handleImport = async () => {
    setImportError('')
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(importJson)
    } catch {
      setImportError('Invalid JSON — check formatting and try again.')
      return
    }
    if (!parsed.name || typeof parsed.name !== 'string') {
      setImportError('Missing required field: "name"')
      return
    }
    if (!parsed.schema || typeof parsed.schema !== 'object') {
      setImportError('Missing required field: "schema" (nodes + edges)')
      return
    }
    setImporting(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: parsed.name, description: parsed.description ?? '', schema: parsed.schema }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Import failed')
      }
      const created = await res.json() as Agent
      setAgents(a => [created, ...a])
      setShowImport(false)
      setImportJson('')
      router.push(`/builder/${created.id}`)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ padding: '48px', maxWidth: 900, margin: '0 auto' }}>

      {/* Import Modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 560, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', padding: '28px 28px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Import Agent</h2>
                <p style={{ fontSize: 12, color: 'var(--text2)' }}>Paste agent JSON exported from another account or pre-built template</p>
              </div>
              <button onClick={() => { setShowImport(false); setImportError(''); setImportJson('') }} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
                <X size={14} />
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={importJson}
              onChange={e => { setImportJson(e.target.value); setImportError('') }}
              placeholder={'{\n  "name": "My Agent",\n  "description": "...",\n  "schema": { "nodes": [], "edges": [] }\n}'}
              rows={12}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${importError ? 'var(--red)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontFamily: 'monospace', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
            />
            {importError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, padding: '7px 10px', borderRadius: 8, background: 'rgba(232,85,85,0.1)', border: '1px solid rgba(232,85,85,0.25)' }}>
                <AlertCircle size={13} color="var(--red)" />
                <span style={{ fontSize: 12, color: 'var(--red)' }}>{importError}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => { setShowImport(false); setImportError(''); setImportJson('') }} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleImport} disabled={importing || !importJson.trim()} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--blue)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: importing || !importJson.trim() ? 'not-allowed' : 'pointer', opacity: importing || !importJson.trim() ? 0.6 : 1 }}>
                {importing ? 'Importing…' : 'Import & Open Builder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 48 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>Agents</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>
            {loading ? 'Loading…' : `${agents.length} agent${agents.length !== 1 ? 's' : ''} · each deployed as a live API endpoint`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowImport(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 18px', borderRadius: 12,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text2)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            <Upload size={15} /> Import
          </button>
          <Link href="/agents/new" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 20px', borderRadius: 12,
            background: 'var(--blue)', color: '#fff',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            <Plus size={15} /> New Agent
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text3)', fontSize: 14 }}>Loading agents…</div>
      ) : agents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(124,111,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Bot size={28} color="var(--blue)" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>No agents yet</h3>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 28, lineHeight: 1.6 }}>
            Build your first agent visually and it will<br />be instantly deployed as a REST API.
          </p>
          <Link href="/agents/new" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', borderRadius: 12,
            background: 'var(--blue)', color: '#fff',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            <Plus size={15} /> Build your first agent
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {agents.map(agent => (
            <div key={agent.id} style={{ padding: '24px 28px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 20 }}>
              {/* Icon */}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(124,111,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={20} color="var(--blue)" />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{agent.name}</span>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
                    v{agent.version}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                  {agent.description || 'No description'}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: 'var(--surface2)' }}>
                  <Zap size={11} color="var(--text3)" />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{agent.run_count}</span>
                </div>
                <Link href={`/builder/${agent.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--surface2)',
                  color: 'var(--text2)', fontSize: 12, fontWeight: 500, textDecoration: 'none',
                }}>
                  <ExternalLink size={12} /> Open Builder
                </Link>
                <button onClick={() => deleteAgent(agent.id)} style={{
                  width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--red)',
                }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
