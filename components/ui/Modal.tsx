'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: number
}

export default function Modal({ open, onClose, title, children, width = 480 }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="relative rounded-xl shadow-2xl overflow-hidden"
        style={{ width, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)', background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between border-b" style={{ padding: '14px 24px', borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md" style={{ color: 'var(--text3)' }}>
            <X size={15} />
          </button>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function ConfirmModal({
  open, onClose, onConfirm, title, message, danger = false
}: {
  open: boolean; onClose: () => void; onConfirm: () => void
  title: string; message: string; danger?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={400}>
      <div style={{ padding: '20px 24px 24px' }}>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', color: 'var(--text2)', background: 'var(--surface2)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', background: danger ? 'var(--red)' : '#7c6ff0', color: 'white', cursor: 'pointer' }}
          >
            {danger ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
