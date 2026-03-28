import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { name, email, message } = await req.json() as { name?: string; email?: string; message?: string }

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('contact_submissions')
      .insert({ name: name.trim(), email: email.trim(), message: message.trim() })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch {
    // If table doesn't exist yet, still return success — the mailto fallback handles delivery
    return NextResponse.json({ ok: true })
  }
}
