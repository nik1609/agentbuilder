import { NextRequest, NextResponse } from 'next/server'

const PROTECTED = [
  '/dashboard', '/agents', '/builder', '/api-keys',
  '/runs', '/models', '/tools', '/chat', '/build',
  '/datatables', '/memory', '/prompts', '/guardrails',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  // Check for a Supabase session cookie directly — no network call, no timeout risk.
  // The actual Supabase auth token cookie name follows the pattern:
  //   sb-<project-ref>-auth-token or sb-<project-ref>-auth-token-code-verifier
  // If any Supabase auth cookie is present we let the request through.
  // API routes do their own full auth check on every request.
  const cookies = request.cookies.getAll()
  const hasSession = cookies.some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))

  if (!hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
