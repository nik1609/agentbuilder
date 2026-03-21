'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function NodeIdChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const ref = `{{node.${id}}}`
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(ref).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div
      onClick={copy}
      title={`Copy reference: ${ref}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 7px', borderTop: '1px solid var(--border2)',
        background: 'var(--bg)', cursor: 'pointer',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text3)', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {id}
      </span>
      {copied
        ? <Check size={9} color="#22d79a" />
        : <Copy size={9} color="var(--text3)" />
      }
    </div>
  )
}
