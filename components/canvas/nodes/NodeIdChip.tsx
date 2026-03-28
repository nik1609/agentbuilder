'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function NodeIdChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const ref = `{{${id}}}`
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(ref).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={copy}
      title={`Copy node reference: ${ref}`}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '1px 3px', borderRadius: 3, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        color: copied ? '#22d79a' : 'var(--text3)',
        opacity: 0.55,
        transition: 'opacity 0.15s, color 0.15s',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.55')}
    >
      {copied ? <Check size={9} /> : <Copy size={9} />}
    </button>
  )
}
