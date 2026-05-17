import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/agents'

  if (!code) return NextResponse.redirect(`${origin}/login?error=auth_failed`)

  try {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1')
      if (forwardedHost && !isLocalhost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }

    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  } catch {
    // Network timeout (common on local dev with slow Supabase connectivity).
    // Redirect to a retry page instead of a dead error.
    const retryUrl = new URL(`${origin}/login`)
    retryUrl.searchParams.set('error', 'timeout')
    retryUrl.searchParams.set('hint', 'Network timeout reaching Supabase. Please try signing in again.')
    return NextResponse.redirect(retryUrl)
  }
}
