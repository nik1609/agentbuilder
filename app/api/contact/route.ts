import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { name, email, message } = await req.json() as { name?: string; email?: string; message?: string }

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  const n = name.trim(); const e = email.trim(); const m = message.trim()

  // Save to Supabase (best-effort)
  try {
    const supabase = createAdminClient()
    await supabase.from('contact_submissions').insert({ name: n, email: e, message: m })
  } catch { /* ignore — email is the primary delivery */ }

  // Send email via Resend
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Email not configured.' }, { status: 500 })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'AgentHub Contact <onboarding@resend.dev>',
      to: ['nikhil76503@gmail.com'],
      reply_to: e,
      subject: `AgentHub contact from ${n}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 16px;font-size:18px;color:#0D0D0D">New contact from AgentHub</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#6B6B6B;width:80px">Name</td><td style="padding:8px 0;color:#0D0D0D;font-weight:600">${n}</td></tr>
            <tr><td style="padding:8px 0;color:#6B6B6B">Email</td><td style="padding:8px 0"><a href="mailto:${e}" style="color:#2563EB">${e}</a></td></tr>
          </table>
          <div style="margin-top:16px;padding:16px;background:#F7F7F8;border-radius:8px;font-size:14px;color:#0D0D0D;line-height:1.6;white-space:pre-wrap">${m}</div>
          <p style="margin-top:16px;font-size:12px;color:#9B9B9B">Sent from agenthub.nik10x.com contact form</p>
        </div>`,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
    return NextResponse.json({ error: 'Failed to send.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
