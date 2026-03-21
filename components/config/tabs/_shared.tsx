import { Check, X } from 'lucide-react'

// Shared form field wrapper used across all config tabs
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className} style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 5,
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div className="field-inputs">
        {children}
      </div>
    </div>
  )
}

// Form action buttons: Save + Cancel
export function FormButtons({
  saving, onSave, onCancel, saveLabel,
}: {
  saving?: boolean
  onSave: () => void
  onCancel: () => void
  saveLabel: string
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px 12px', borderRadius: 7, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          background: 'var(--blue)', color: '#fff', fontSize: 12, fontWeight: 700,
          opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s',
          whiteSpace: 'nowrap', minWidth: 0,
        }}
      >
        <Check size={12} style={{ flexShrink: 0 }} /> {saving ? 'Saving…' : saveLabel}
      </button>
      <button
        onClick={onCancel}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          padding: '9px 14px', borderRadius: 7, cursor: 'pointer',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          color: 'var(--text3)', fontSize: 12, fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        <X size={11} style={{ flexShrink: 0 }} /> Cancel
      </button>
    </div>
  )
}

// Form section header ("✎ Editing ..." or "+ New ...")
export function FormHeading({ editing, noun }: { editing: boolean; noun: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: 5, flexShrink: 0,
        background: editing ? 'rgba(124,111,240,0.12)' : 'rgba(34,215,154,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11,
      }}>
        {editing ? '✎' : '+'}
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
        {editing ? `Edit ${noun}` : `New ${noun}`}
      </span>
    </div>
  )
}
