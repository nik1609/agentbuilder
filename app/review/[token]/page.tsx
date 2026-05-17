'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, XCircle, RotateCcw, AlertCircle, Zap } from 'lucide-react'

interface ReviewContext {
  runId: string
  agentName: string
  question: string
  partial: unknown
  createdAt: string
}

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>()
  const [ctx, setCtx]         = useState<ReviewContext | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [notes, setNotes]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]       = useState<{ action: string; message?: string } | null>(null)

  useEffect(() => {
    fetch(`/api/review/${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setCtx(d) })
      .catch(() => setError('Failed to load review. Check the link and try again.'))
  }, [token])

  async function submit(action: 'approve' | 'revise' | 'reject') {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback: notes.trim() || undefined }),
      }).then(r => r.json())
      if (res.error) { setError(res.error); setSubmitting(false); return }
      setDone({
        action,
        message: action === 'reject'
          ? 'Run rejected. The pipeline has been stopped.'
          : action === 'revise'
          ? 'Revision requested. The agent is regenerating its output.'
          : 'Approved. The pipeline is continuing.',
      })
    } catch {
      setError('Submission failed. Please try again.')
      setSubmitting(false)
    }
  }

  const partialText = ctx?.partial
    ? typeof ctx.partial === 'string' ? ctx.partial : JSON.stringify(ctx.partial, null, 2)
    : null

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
        <Zap size={20} color="#2563EB" strokeWidth={2.5} />
        <span style={{ fontSize: 16, fontWeight: 700, color: '#0D0D0D', letterSpacing: '-0.02em' }}>AgentHub</span>
      </div>

      <div style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 16, border: '1px solid #E5E5E5', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', overflow: 'hidden' }}>

        {/* Header accent */}
        <div style={{ height: 4, background: '#F59E0B' }} />

        <div style={{ padding: '28px 32px' }}>

          {/* Loading */}
          {!ctx && !error && !done && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9B9B9B', fontSize: 14 }}>Loading review…</div>
          )}

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', gap: 12, padding: '16px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#DC2626', marginBottom: 4 }}>Unable to load review</div>
                <div style={{ fontSize: 13, color: '#6B6B6B' }}>{error}</div>
              </div>
            </div>
          )}

          {/* Done */}
          {done && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                background: done.action === 'reject' ? '#FEF2F2' : '#F0FDF4',
                border: `1px solid ${done.action === 'reject' ? '#FECACA' : '#BBF7D0'}` }}>
                {done.action === 'reject'
                  ? <XCircle size={24} color="#DC2626" />
                  : <CheckCircle size={24} color="#16A34A" />}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0D0D0D', marginBottom: 8 }}>
                {done.action === 'approve' ? 'Approved' : done.action === 'revise' ? 'Revision Requested' : 'Rejected'}
              </div>
              <div style={{ fontSize: 14, color: '#6B6B6B' }}>{done.message}</div>
              <div style={{ marginTop: 20, fontSize: 12, color: '#C2C2C2' }}>You can close this tab.</div>
            </div>
          )}

          {/* Review form */}
          {ctx && !done && !error && (
            <>
              {/* Agent + meta */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Human Review Required</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0D0D0D', marginBottom: 6 }}>{ctx.agentName}</div>
                <div style={{ fontSize: 12, color: '#9B9B9B' }}>
                  Run ID: <span style={{ fontFamily: 'monospace' }}>{ctx.runId.slice(0, 8)}…</span>
                  &nbsp;·&nbsp;
                  {new Date(ctx.createdAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Question */}
              <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Review Question</div>
                <div style={{ fontSize: 14, color: '#0D0D0D', lineHeight: 1.6 }}>{ctx.question}</div>
              </div>

              {/* Partial output / context */}
              {partialText && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Agent Output to Review</div>
                  <pre style={{ fontSize: 13, color: '#0D0D0D', background: '#F7F7F8', border: '1px solid #E5E5E5', borderRadius: 8, padding: '12px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto', lineHeight: 1.6, margin: 0, fontFamily: 'inherit' }}>
                    {partialText}
                  </pre>
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Notes for the agent (optional)</div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Feedback or revision instructions…"
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E5E5E5', fontSize: 13, fontFamily: 'inherit', color: '#0D0D0D', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => submit('approve')}
                  disabled={submitting}
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', borderRadius: 10, border: 'none', background: submitting ? '#E5E5E5' : '#16A34A', color: '#fff', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
                  <CheckCircle size={15} /> Approve
                </button>
                <button
                  onClick={() => submit('revise')}
                  disabled={submitting}
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', borderRadius: 10, border: '1px solid #FDE68A', background: '#FFFBEB', color: '#D97706', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
                  <RotateCcw size={14} /> Request Revision
                </button>
                <button
                  onClick={() => submit('reject')}
                  disabled={submitting}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
                  <XCircle size={14} /> Reject
                </button>
              </div>
            </>
          )}

        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: '#C2C2C2' }}>
        Powered by <span style={{ color: '#2563EB', fontWeight: 600 }}>AgentHub</span>
      </div>
    </div>
  )
}
