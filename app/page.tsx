'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Zap, ArrowRight, Code2, Globe, Shield, BarChart3, GitBranch, Cpu, RefreshCw, UserCheck, CheckCircle, Loader2, Mail, MessageSquare } from 'lucide-react'

const LLM_PROVIDERS = [
  { name: 'OpenAI', color: '#10a37f' },
  { name: 'Gemini', color: '#4285F4' },
  { name: 'Claude', color: '#d97706' },
  { name: 'Groq', color: '#f55036' },
  { name: 'Llama', color: '#7c6ff0' },
  { name: 'Mistral', color: '#ff7000' },
  { name: 'Ollama', color: '#22d79a' },
  { name: 'Any OpenAI-compatible API', color: '#8888b0' },
]

const NODE_TYPES = [
  { name: 'LLM', color: '#7c6ff0', bg: 'rgba(124,111,240,0.08)', desc: 'Call any language model with a system prompt' },
  { name: 'Tool', color: '#26c6da', bg: 'rgba(38,198,218,0.08)', desc: 'Web search, HTTP calls, code execution, databases' },
  { name: 'Condition', color: '#22d79a', bg: 'rgba(34,215,154,0.08)', desc: 'Binary yes/no routing evaluated by LLM' },
  { name: 'Switch', color: '#ffd600', bg: 'rgba(255,214,0,0.08)', desc: 'Multi-way routing for 3+ branches' },
  { name: 'Loop', color: '#f5a020', bg: 'rgba(245,160,32,0.08)', desc: 'Repeat until exit condition is met' },
  { name: 'Fork / Join', color: '#b080f8', bg: 'rgba(176,128,248,0.08)', desc: 'Parallel execution, merge results' },
  { name: 'HITL', color: '#f472b6', bg: 'rgba(244,114,182,0.08)', desc: 'Pause for human approval before continuing' },
  { name: 'Clarify', color: '#e85555', bg: 'rgba(232,85,85,0.08)', desc: 'Ask user a follow-up question mid-run' },
]

const HOW_IT_WORKS = [
  { n: 1, title: 'Design on the canvas', desc: 'Drag nodes onto the canvas and connect them. Each node does one thing: call an LLM, run a tool, check a condition, or wait for human approval.' },
  { n: 2, title: 'Pick any LLM', desc: 'Configure your own API keys for OpenAI, Gemini, Claude, Groq, Mistral, or any OpenAI-compatible endpoint including self-hosted Ollama.' },
  { n: 3, title: 'Save and call it', desc: 'Every agent is instantly available as a REST API. One POST request and your agent runs, tools fire, LLMs respond, results stream back.' },
]

const FEATURES = [
  { icon: Code2, color: '#7c6ff0', bg: 'rgba(124,111,240,0.12)', title: 'Visual DAG Builder', desc: 'Build complex multi-step pipelines by connecting nodes. No code required for the flow.' },
  { icon: Globe, color: '#22d79a', bg: 'rgba(34,215,154,0.12)', title: 'Instant REST API', desc: 'Every agent auto-gets a live POST endpoint. Call it from Python, JavaScript, curl, or any HTTP client.' },
  { icon: Cpu, color: '#26c6da', bg: 'rgba(38,198,218,0.12)', title: 'Any LLM Provider', desc: 'Bring your own API keys. Mix providers across nodes: GPT-4 for reasoning, Gemini for speed.' },
  { icon: GitBranch, color: '#f5a020', bg: 'rgba(245,160,32,0.12)', title: 'Conditional Routing', desc: 'Condition and Switch nodes let the agent pick its own path based on what it finds.' },
  { icon: RefreshCw, color: '#ff7043', bg: 'rgba(255,112,67,0.12)', title: 'Loops & Parallel', desc: 'Loop nodes refine until quality passes. Fork/Join nodes run multiple branches simultaneously.' },
  { icon: UserCheck, color: '#b080f8', bg: 'rgba(176,128,248,0.12)', title: 'Human-in-the-Loop', desc: 'HITL nodes pause the run for human review before continuing. Full audit trail included.' },
  { icon: Shield, color: '#f472b6', bg: 'rgba(244,114,182,0.12)', title: 'Guardrails', desc: 'Block bad input and filter unsafe output at the node level. Per-node, not per-agent.' },
  { icon: BarChart3, color: '#ffd600', bg: 'rgba(255,214,0,0.12)', title: 'Runs & Analytics', desc: 'Every execution is logged with tokens, latency, cost, and full trace. Filter and export.' },
]

export default function LandingPage() {
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMsg, setContactMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [contactError, setContactError] = useState('')

  const sendContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contactEmail.trim() || !contactMsg.trim()) return
    setSending(true)
    setContactError('')
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMsg }),
      })
      setSent(true)
    } catch {
      window.location.href = `mailto:hello@agenthub.dev?subject=AgentHub Contact from ${contactName}&body=${encodeURIComponent(contactMsg)}`
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#06060f', color: '#ffffff' }}>

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(11,11,28,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(124,111,240,0.15)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #7c6ff0, #b080f8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(124,111,240,0.4)' }}>
              <Zap size={16} color="white" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px', color: '#ffffff' }}>AgentHub</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[
              { label: 'Features', href: '#features' },
              { label: 'How it works', href: '#how' },
              { label: 'Contact', href: '#contact' },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{ fontSize: 14, color: '#8888b0', textDecoration: 'none', fontWeight: 500, padding: '6px 14px', borderRadius: 8, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c8c8e8')}
                onMouseLeave={e => (e.currentTarget.style.color = '#8888b0')}
              >{label}</a>
            ))}
            <div style={{ width: 1, height: 20, background: 'rgba(124,111,240,0.2)', margin: '0 8px' }} />
            <Link href="/login" style={{ fontSize: 14, padding: '8px 16px', borderRadius: 9, fontWeight: 500, color: '#c8c8e8', textDecoration: 'none', border: '1px solid rgba(124,111,240,0.2)', background: 'rgba(124,111,240,0.06)' }}>
              Sign in
            </Link>
            <Link href="/signup" style={{ fontSize: 14, padding: '8px 20px', borderRadius: 9, fontWeight: 600, background: 'linear-gradient(135deg, #7c6ff0, #9d8ef5)', color: '#fff', textDecoration: 'none', boxShadow: '0 0 20px rgba(124,111,240,0.3)' }}>
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', maxWidth: 900, margin: '0 auto', padding: '110px 32px 90px', textAlign: 'center', overflow: 'hidden' }}>
        {/* background glows */}
        <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse, rgba(124,111,240,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 100, fontSize: 12, marginBottom: 32, background: 'rgba(124,111,240,0.1)', border: '1px solid rgba(124,111,240,0.3)', color: '#b080f8', fontWeight: 600, position: 'relative' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d79a', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Bring your own API keys. Any LLM, any provider.
        </div>

        <h1 style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.06, letterSpacing: '-2.5px', marginBottom: 24, position: 'relative' }}>
          Build AI agents visually.{' '}
          <span style={{ background: 'linear-gradient(135deg, #7c6ff0 0%, #b080f8 60%, #22d79a 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Deploy as REST APIs.
          </span>
        </h1>

        <p style={{ fontSize: 18, lineHeight: 1.75, color: '#c8c8e8', maxWidth: 620, margin: '0 auto 14px', position: 'relative' }}>
          Design multi-step AI pipelines on a drag-and-drop canvas. LLM calls, tool use, conditional branching, loops, parallel execution, and human review checkpoints.
        </p>
        <p style={{ fontSize: 15, color: '#8888b0', marginBottom: 48, position: 'relative' }}>
          Every agent becomes a live API endpoint. One POST request, that&apos;s it.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 72, position: 'relative' }}>
          <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12, fontWeight: 700, fontSize: 15, background: 'linear-gradient(135deg, #7c6ff0, #9d8ef5)', color: '#fff', textDecoration: 'none', boxShadow: '0 0 48px rgba(124,111,240,0.4), 0 4px 20px rgba(0,0,0,0.4)' }}>
            Start building free <ArrowRight size={16} />
          </Link>
          <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 12, fontWeight: 600, fontSize: 15, color: '#c8c8e8', textDecoration: 'none', border: '1px solid rgba(124,111,240,0.25)', background: 'rgba(124,111,240,0.07)' }}>
            Sign in
          </Link>
        </div>

        {/* Code snippet */}
        <div style={{ maxWidth: 560, margin: '0 auto', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(124,111,240,0.2)', background: '#0b0b1c', textAlign: 'left', boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,111,240,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid rgba(124,111,240,0.12)', background: '#10102a' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
            <span style={{ marginLeft: 8, fontSize: 12, fontFamily: 'monospace', color: '#8888b0' }}>Your agent, live as an API</span>
          </div>
          <pre style={{ padding: '20px 24px', fontSize: 12, fontFamily: 'monospace', lineHeight: 2.1, color: '#c8c8e8', overflowX: 'auto', margin: 0 }}>
{`curl -X POST `}<span style={{ color: '#8888b0' }}>https://your-app.com</span>{`/api/agents/`}<span style={{ color: '#f5a020' }}>AGENT_ID</span>{`/run \\
  -H "X-AgentHub-Key: `}<span style={{ color: '#22d79a' }}>ahk_xxxxxxxxxx</span>{`" \\
  -d '{"message": "Summarise this article..."}'

`}<span style={{ color: '#7c6ff0' }}>{`// Response`}</span>{`
{ "output": "...", "tokens": 342, "status": "completed" }`}
          </pre>
        </div>
      </section>

      {/* ── LLM providers strip ──────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid rgba(124,111,240,0.1)', borderBottom: '1px solid rgba(124,111,240,0.1)', background: '#0b0b1c', padding: '28px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#8888b0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20 }}>
            Works with any LLM. You bring your own API keys.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {LLM_PROVIDERS.map(p => (
              <span key={p.name} style={{ fontSize: 13, fontWeight: 600, padding: '7px 18px', borderRadius: 20, background: '#10102a', border: `1px solid ${p.color}33`, color: p.color }}>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how" style={{ maxWidth: 900, margin: '0 auto', padding: '100px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-1.5px', marginBottom: 12 }}>How it works</h2>
          <p style={{ fontSize: 16, color: '#8888b0' }}>Three steps from idea to running API</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {HOW_IT_WORKS.map(({ n, title, desc }) => (
            <div key={n} style={{ padding: '28px 24px', borderRadius: 16, background: '#0b0b1c', border: '1px solid rgba(124,111,240,0.15)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(124,111,240,0.12)', border: '1px solid rgba(124,111,240,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#7c6ff0' }}>{n}</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#ffffff' }}>{title}</h3>
              <p style={{ fontSize: 13, color: '#8888b0', lineHeight: 1.7 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Node types ───────────────────────────────────────────────── */}
      <section style={{ background: '#0b0b1c', borderTop: '1px solid rgba(124,111,240,0.1)', borderBottom: '1px solid rgba(124,111,240,0.1)', padding: '80px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1px', marginBottom: 10 }}>8 node types. Infinite combinations.</h2>
            <p style={{ fontSize: 15, color: '#8888b0' }}>Every building block you need to model any AI workflow</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {NODE_TYPES.map(({ name, color, bg, desc }) => (
              <div key={name} style={{ padding: '18px 20px', borderRadius: 14, background: bg, border: `1px solid ${color}28` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 6, fontFamily: 'monospace' }}>{name}</div>
                <div style={{ fontSize: 12, color: '#8888b0', lineHeight: 1.55 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-1.5px', marginBottom: 12 }}>Everything you need</h2>
          <p style={{ fontSize: 16, color: '#8888b0' }}>Built for engineers who want to ship AI fast</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} style={{ padding: '24px 20px', borderRadius: 16, border: '1px solid rgba(124,111,240,0.12)', background: '#0b0b1c' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon size={18} color={color} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#ffffff' }}>{title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.65, color: '#8888b0' }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ───────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto 100px', padding: '0 32px' }}>
        <div style={{ borderRadius: 24, background: 'linear-gradient(135deg, rgba(124,111,240,0.12) 0%, rgba(176,128,248,0.08) 50%, rgba(34,215,154,0.06) 100%)', border: '1px solid rgba(124,111,240,0.25)', padding: '60px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 300, background: 'radial-gradient(ellipse, rgba(124,111,240,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-1.5px', marginBottom: 14, position: 'relative' }}>Ready to build your first agent?</h2>
          <p style={{ fontSize: 16, color: '#8888b0', maxWidth: 480, margin: '0 auto 36px', position: 'relative' }}>
            No credit card. No infra to manage. Sign up, build, and call your agent in under 5 minutes.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', position: 'relative' }}>
            <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 36px', borderRadius: 12, fontWeight: 700, fontSize: 15, background: 'linear-gradient(135deg, #7c6ff0, #9d8ef5)', color: '#fff', textDecoration: 'none', boxShadow: '0 0 40px rgba(124,111,240,0.4)' }}>
              Get started free <ArrowRight size={16} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center', marginTop: 32, position: 'relative' }}>
            {['Free to start', 'Your own API keys', 'Instant REST API', 'No vendor lock-in'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#8888b0' }}>
                <CheckCircle size={13} color="#22d79a" /> {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────── */}
      <section id="contact" style={{ maxWidth: 620, margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(124,111,240,0.12)', border: '1px solid rgba(124,111,240,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <MessageSquare size={20} color="#7c6ff0" />
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', marginBottom: 10 }}>Get in touch</h2>
          <p style={{ fontSize: 15, color: '#8888b0', lineHeight: 1.6 }}>
            Have a question, feature request, or want to report a bug?<br />We&apos;d love to hear from you.
          </p>
        </div>

        <div style={{ background: '#0b0b1c', border: '1px solid rgba(124,111,240,0.2)', borderRadius: 20, padding: '36px 40px', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,215,154,0.1)', border: '2px solid rgba(34,215,154,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle size={24} color="#22d79a" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Message sent!</h3>
              <p style={{ fontSize: 14, color: '#8888b0' }}>We&apos;ll get back to you within 24 hours.</p>
              <button onClick={() => { setSent(false); setContactName(''); setContactEmail(''); setContactMsg('') }} style={{ marginTop: 20, fontSize: 13, color: '#7c6ff0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={sendContact} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8888b0', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 7 }}>Name</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    className="contact-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #1a1a35', background: '#06060f', color: '#ffffff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#8888b0', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 7 }}>Email <span style={{ color: '#e85555' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8888b0', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={contactEmail}
                      onChange={e => { setContactEmail(e.target.value); setContactError('') }}
                      required
                      className="contact-input"
                      style={{ width: '100%', padding: '10px 14px 10px 34px', borderRadius: 10, border: '1px solid #1a1a35', background: '#06060f', color: '#ffffff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#8888b0', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 7 }}>Message <span style={{ color: '#e85555' }}>*</span></label>
                <textarea
                  placeholder="Tell us what's on your mind. Feature request, bug report, question, or just hello."
                  value={contactMsg}
                  onChange={e => { setContactMsg(e.target.value); setContactError('') }}
                  required
                  rows={5}
                  className="contact-input"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #1a1a35', background: '#06060f', color: '#ffffff', fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }}
                />
              </div>

              {contactError && (
                <div style={{ fontSize: 12, color: '#e85555', padding: '8px 12px', borderRadius: 8, background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.2)' }}>
                  {contactError}
                </div>
              )}

              <button
                type="submit"
                disabled={sending || !contactEmail || !contactMsg}
                style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #7c6ff0, #9d8ef5)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: sending || !contactEmail || !contactMsg ? 'not-allowed' : 'pointer', opacity: sending || !contactEmail || !contactMsg ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {sending ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <MessageSquare size={15} />}
                {sending ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(124,111,240,0.1)', background: '#0b0b1c' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '52px 32px 36px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #7c6ff0, #b080f8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={13} color="white" strokeWidth={2.5} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#ffffff' }}>AgentHub</span>
              </div>
              <p style={{ fontSize: 13, color: '#8888b0', lineHeight: 1.7, maxWidth: 280 }}>
                Visual AI agent builder. Design pipelines on a canvas, deploy as REST APIs, bring your own LLM keys.
              </p>
              <p style={{ fontSize: 12, color: '#8888b0', marginTop: 14, lineHeight: 1.7 }}>
                Works with OpenAI, Gemini, Claude, Groq,<br />Mistral, Llama, Ollama, and any OpenAI-compatible API.
              </p>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8888b0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Product</div>
              {[
                { label: 'Dashboard', href: '/agents' },
                { label: 'Build an agent', href: '/agents/new' },
                { label: 'Documentation', href: '/docs' },
                { label: 'API Reference', href: '/docs' },
              ].map(l => (
                <Link key={l.label} href={l.href} style={{ display: 'block', fontSize: 13, color: '#c8c8e8', textDecoration: 'none', marginBottom: 10 }}>
                  {l.label}
                </Link>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8888b0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Nodes</div>
              {['LLM', 'Tool', 'Condition', 'Switch', 'Loop', 'Fork / Join', 'HITL', 'Clarify'].map(n => (
                <div key={n} style={{ fontSize: 13, color: '#8888b0', marginBottom: 8 }}>{n}</div>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8888b0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Company</div>
              {[
                { label: 'Sign up', href: '/signup' },
                { label: 'Sign in', href: '/login' },
                { label: 'Contact', href: '#contact' },
              ].map(l => (
                <a key={l.label} href={l.href} style={{ display: 'block', fontSize: 13, color: '#c8c8e8', textDecoration: 'none', marginBottom: 10 }}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(124,111,240,0.1)', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 12, color: '#8888b0' }}>© {new Date().getFullYear()} AgentHub. Built for engineers who move fast.</p>
            <div style={{ display: 'flex', gap: 20 }}>
              <span style={{ fontSize: 12, color: '#8888b0', cursor: 'pointer' }}>Privacy Policy</span>
              <span style={{ fontSize: 12, color: '#8888b0', cursor: 'pointer' }}>Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .contact-input:focus { border-color: rgba(124,111,240,0.5) !important; box-shadow: 0 0 0 3px rgba(124,111,240,0.1); }
        .contact-input::placeholder { color: #8888b0; }
      `}</style>
    </div>
  )
}
