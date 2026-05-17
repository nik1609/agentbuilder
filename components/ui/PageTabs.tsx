'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Tab {
  href: string
  label: string
  match?: (p: string) => boolean
}

export default function PageTabs({ tabs }: { tabs: Tab[] }) {
  const path = usePathname()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 28 }}>
      {tabs.map(({ href, label, match }) => {
        const active = match ? match(path) : path === href
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 30,
              padding: '0 14px',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              textDecoration: 'none',
              background: active ? 'var(--text)' : 'transparent',
              color: active ? 'var(--bg)' : 'var(--text3)',
              border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.color = 'var(--text2)'
                e.currentTarget.style.borderColor = 'var(--border2)'
                e.currentTarget.style.background = 'var(--surface)'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.color = 'var(--text3)'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
