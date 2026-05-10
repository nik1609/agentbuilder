import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/agents'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // On Vercel the origin may be the internal URL — use x-forwarded-host
      // (the public domain) so the redirect goes to the right place.
      // Only use x-forwarded-host in production (not localhost) to avoid
      // redirecting to https://localhost which has no SSL cert.
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1')
      if (forwardedHost && !isLocalhost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
