'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bot, LayoutDashboard, KeyRound, BarChart3, Zap, BookOpen, LogOut, ChevronLeft, ChevronRight, Brain } from 'lucide-react'
import { useState } from 'react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/models', label: 'Models', icon: Brain },
  { href: '/api-keys', label: 'API Keys', icon: KeyRound },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/docs', label: 'Docs', icon: BookOpen },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const w = collapsed ? 64 : 220

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar — outer wrapper allows the collapse button to overflow */}
      <div style={{
        width: w, flexShrink: 0, position: 'relative',
        transition: 'width 0.2s ease',
        zIndex: 10,
      }}>
        {/* Inner content: clips overflow so labels don't bleed when collapsed */}
        <aside style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', borderRight: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Logo */}
          <div style={{
            height: 60, display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '0 16px' : '0 20px',
            borderBottom: '1px solid var(--border)', flexShrink: 0,
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}>
            {!collapsed && (
              <>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #7c6ff0, #b080f8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={14} color="white" strokeWidth={2.5} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', flex: 1, whiteSpace: 'nowrap' }}>AgentHub</span>
              </>
            )}
            {collapsed && (
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #7c6ff0, #b080f8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={14} color="white" strokeWidth={2.5} />
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {nav.map(({ href, label, icon: Icon }) => {
              const active = path === href || (href !== '/dashboard' && path.startsWith(href))
              return (
                <Link key={href} href={href} title={collapsed ? label : undefined} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: collapsed ? '10px 0' : '10px 12px',
                  borderRadius: 8, textDecoration: 'none',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: active ? 'rgba(124,111,240,0.12)' : 'transparent',
                  color: active ? 'var(--blue)' : 'var(--text2)',
                  transition: 'all 0.15s',
                }}>
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  {!collapsed && <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, whiteSpace: 'nowrap' }}>{label}</span>}
                </Link>
              )
            })}
          </nav>

          {/* Bottom */}
          <div style={{
            padding: '8px', borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: collapsed ? 'column' : 'row',
            alignItems: 'center',
            gap: 4  ,
          }}>
            <button onClick={signOut} title="Sign out" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: collapsed ? '9px 0' : '8px 10px',
              borderRadius: 8, border: 'none', background: 'transparent',
              color: 'var(--text3)', cursor: 'pointer',
              justifyContent: 'center',
              flex: collapsed ? undefined : 1,
              whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0,
            }}>
              <LogOut size={15} style={{ flexShrink: 0 }} />
              {!collapsed && <span style={{ fontSize: 13 }}>Sign out</span>}
            </button>
            <ThemeToggle />
          </div>
        </aside>

        {/* Collapse toggle — centered on right edge, outside the clipping aside */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text3)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
            zIndex: 20,
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>{children}</main>
    </div>
  )
}
