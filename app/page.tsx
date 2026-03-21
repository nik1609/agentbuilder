import Link from 'next/link'
import { Zap, ArrowRight, Code2, Globe, Shield, BarChart3 } from 'lucide-react'

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #7c6ff0, #b080f8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={15} color="white" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>AgentHub</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/dashboard" style={{ fontSize: 14, padding: '8px 16px', borderRadius: 8, fontWeight: 500, color: 'var(--text2)', textDecoration: 'none' }}>
              Dashboard
            </Link>
            <Link href="/agents/new" style={{ fontSize: 14, padding: '8px 18px', borderRadius: 10, fontWeight: 600, background: 'var(--blue)', color: '#fff', textDecoration: 'none' }}>
              Build an Agent
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '96px 32px 80px', textAlign: 'center' }}>
        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 100, fontSize: 12, fontFamily: 'monospace', marginBottom: 32, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--blue)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Multi-model · Gemini · GPT-4 · Claude · Ollama
        </div>

        <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-2px', marginBottom: 24 }}>
          Build AI agents visually.{' '}
          <span style={{ background: 'linear-gradient(135deg, #7c6ff0, #b080f8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Deploy as REST APIs.
          </span>
        </h1>

        <p style={{ fontSize: 18, lineHeight: 1.7, color: 'var(--text2)', maxWidth: 580, margin: '0 auto 40px' }}>
          Design multi-agent pipelines on a drag-and-drop canvas. Every agent becomes
          a callable API endpoint — integrate into any product in minutes.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 72 }}>
          <Link href="/agents/new" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '13px 28px', borderRadius: 12, fontWeight: 700, fontSize: 15,
            background: 'var(--blue)', color: '#fff', textDecoration: 'none',
            boxShadow: '0 0 40px rgba(124,111,240,0.3)',
          }}>
            Start building <ArrowRight size={16} />
          </Link>
          <Link href="/dashboard" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '13px 28px', borderRadius: 12, fontWeight: 600, fontSize: 15,
            color: 'var(--text2)', textDecoration: 'none',
            border: '1px solid var(--border)', background: 'var(--surface)',
          }}>
            View dashboard
          </Link>
        </div>

        {/* API code snippet */}
        <div style={{ maxWidth: 560, margin: '0 auto', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
            <span style={{ marginLeft: 8, fontSize: 12, fontFamily: 'monospace', color: 'var(--text3)' }}>Your agent, live as an API</span>
          </div>
          <pre style={{ padding: '20px 24px', fontSize: 12, fontFamily: 'monospace', lineHeight: 2, color: 'var(--text2)', overflowX: 'auto', margin: 0 }}>
{`curl -X POST https://yourdomain.com`}<span style={{ color: 'var(--text2)' }}>{`/api/agents/`}</span><span style={{ color: 'var(--orange)' }}>{`YOUR_ID`}</span>{`/run \\
  -H "X-AgentHub-Key: `}<span style={{ color: 'var(--green)' }}>{`ahk_xxxxxxxxxx`}</span>{`" \\
  -d '{"message": "Summarise this article..."}'\n
`}<span style={{ color: 'var(--blue)' }}>{`// → Response`}</span>{`
{
  "output": "Here is the summary...",
  "tokens": 342,
  "latencyMs": 1240,
  "status": "completed"
}`}
          </pre>
        </div>
      </section>

      {/* Feature grid */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px 96px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { icon: Code2, color: '#7c6ff0', bg: 'rgba(124,111,240,0.1)', title: 'Visual Builder', desc: 'Drag-and-drop DAG canvas with LLM, Tool, Condition, and HITL nodes' },
            { icon: Globe, color: '#22d79a', bg: 'rgba(34,215,154,0.1)', title: 'API Exposure', desc: 'Every agent auto-gets a REST endpoint. Call it from anywhere, instantly.' },
            { icon: Shield, color: '#b080f8', bg: 'rgba(176,128,248,0.1)', title: 'API Key Auth', desc: 'Generate keys, revoke instantly, track usage per key and per agent.' },
            { icon: BarChart3, color: '#f5a020', bg: 'rgba(245,160,32,0.1)', title: 'Usage Analytics', desc: 'Calls, tokens, latency, error rates — tracked per agent and per key.' },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} style={{ padding: '24px 20px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon size={18} color={color} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: 'var(--text)' }}>{title}</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text2)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </div>
  )
}
