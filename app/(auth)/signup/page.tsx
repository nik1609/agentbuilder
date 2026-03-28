'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Loader2, Mail, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const signUpWithGoogle = async () => {
    setGoogleLoading(true)
    setError('')
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
  }

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
    if (err) {
      const msg = err.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
        setError('An account with this email already exists. Try signing in instead. If you used Google, sign in with Google.')
      } else {
        setError(err.message)
      }
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #7c6ff0, #b080f8)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, boxShadow: '0 0 40px rgba(124,111,240,0.4)', cursor: 'pointer' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.5px', marginBottom: 6 }}>Create account</h1>
          <p style={{ fontSize: 14, color: '#8888b0' }}>Start building AI agents in minutes</p>
        </div>

        {/* Card */}
        <div style={{ background: '#0b0b1c', border: '1px solid rgba(124,111,240,0.2)', borderRadius: 20, padding: 28, boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,111,240,0.05)' }}>

          {done ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,215,154,0.1)', border: '2px solid rgba(34,215,154,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle size={24} color="#22d79a" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', marginBottom: 10 }}>Check your email</h2>
              <p style={{ fontSize: 13, color: '#8888b0', lineHeight: 1.7, marginBottom: 20 }}>
                We sent a confirmation link to<br />
                <strong style={{ color: '#ffffff' }}>{email}</strong>.<br />
                Click the link to verify your account and log in.
              </p>
              <p style={{ fontSize: 12, color: '#8888b0', lineHeight: 1.6 }}>
                Didn&apos;t get it? Check your spam folder.<br />
                The link expires in 24 hours.
              </p>
              <Link href="/login" style={{ display: 'inline-block', marginTop: 24, fontSize: 13, color: '#7c6ff0', fontWeight: 600, textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {/* Google */}
              <button
                onClick={signUpWithGoogle}
                disabled={googleLoading || loading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 24px', borderRadius: 12, border: '1px solid rgba(124,111,240,0.2)', background: '#10102a', color: '#ffffff', fontSize: 14, fontWeight: 600, cursor: googleLoading ? 'not-allowed' : 'pointer', opacity: googleLoading ? 0.7 : 1 }}
              >
                {googleLoading ? <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> : <GoogleIcon />}
                {googleLoading ? 'Redirecting...' : 'Continue with Google'}
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(124,111,240,0.15)' }} />
                <span style={{ fontSize: 12, color: '#8888b0' }}>or sign up with email</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(124,111,240,0.15)' }} />
              </div>

              {/* Form */}
              <form onSubmit={signUp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8888b0', pointerEvents: 'none' }} />
                  <input type="email" placeholder="Email address" value={email} onChange={e => { setEmail(e.target.value); setError('') }} required className="auth-input" style={{ width: '100%', padding: '11px 12px 11px 38px', borderRadius: 10, border: '1px solid #1a1a35', background: '#06060f', color: '#ffffff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8888b0', pointerEvents: 'none' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password (min 8 characters)"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    required
                    className="auth-input"
                    style={{ width: '100%', padding: '11px 40px 11px 38px', borderRadius: 10, border: '1px solid #1a1a35', background: '#06060f', color: '#ffffff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8888b0', display: 'flex', padding: 0 }}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8888b0', pointerEvents: 'none' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                    required
                    className="auth-input"
                    style={{ width: '100%', padding: '11px 12px 11px 38px', borderRadius: 10, border: '1px solid #1a1a35', background: '#06060f', color: '#ffffff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {error && (
                  <div style={{ fontSize: 12, color: '#e85555', padding: '9px 12px', borderRadius: 8, background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.2)', lineHeight: 1.5 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || googleLoading || !email || !password || !confirmPassword}
                  style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #7c6ff0, #9d8ef5)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading || !email || !password || !confirmPassword ? 'not-allowed' : 'pointer', opacity: loading || !email || !password || !confirmPassword ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 }}
                >
                  {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
                  {loading ? 'Creating account...' : 'Create account'}
                </button>

                <p style={{ fontSize: 11, color: '#8888b0', textAlign: 'center', lineHeight: 1.6 }}>
                  By signing up you agree to our{' '}
                  <span style={{ color: '#7c6ff0', cursor: 'pointer' }}>Terms</span>{' '}
                  and{' '}
                  <span style={{ color: '#7c6ff0', cursor: 'pointer' }}>Privacy Policy</span>
                </p>
              </form>

              <p style={{ fontSize: 13, color: '#8888b0', textAlign: 'center', marginTop: 20 }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: '#7c6ff0', fontWeight: 600, textDecoration: 'none' }}>
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 24 }}>
          {['Visual DAG builder', 'Any LLM provider', 'Instant REST API', 'HITL support'].map(f => (
            <span key={f} style={{ fontSize: 11, padding: '5px 13px', borderRadius: 20, background: '#0b0b1c', border: '1px solid rgba(124,111,240,0.25)', color: '#8888b0', fontWeight: 500 }}>{f}</span>
          ))}
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
          .auth-input:focus { border-color: rgba(124,111,240,0.5) !important; box-shadow: 0 0 0 3px rgba(124,111,240,0.1) !important; }
          .auth-input::placeholder { color: #8888b0; }
        `}</style>
      </div>
  )
}
