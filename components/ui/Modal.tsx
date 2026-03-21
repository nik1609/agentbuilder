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
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
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
      <div className="p-5">
        <p className="text-sm mb-5" style={{ color: 'var(--text2)' }}>{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--text2)', background: 'var(--surface2)' }}>
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: danger ? 'var(--red)' : 'var(--blue)', color: danger ? 'white' : '#080810' }}
          >
            {danger ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
