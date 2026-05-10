import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Build a fetch function backed by an undici Agent that forces IPv4 DNS lookups.
// This prevents "TypeError: fetch failed" when undici prefers IPv6 on machines
// without working IPv6 internet routes (common in local dev on macOS).
function buildIpv4Fetch() {
  try {
    // undici is bundled with Node.js 18+ — safe to require at runtime
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fetch: undiciFetch, Agent } = require('undici') as {
      fetch: typeof globalThis.fetch
      Agent: new (opts: unknown) => unknown
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dns = require('dns') as typeof import('dns')

    const agent = new Agent({
      connect: {
        lookup: (
          hostname: string,
          _opts: unknown,
          callback: (err: Error | null, address: string, family: number) => void
        ) => {
          dns.lookup(hostname, { family: 4 }, (err, addr) => {
            callback(err, addr ?? '', 4)
          })
        },
      },
    })

    // Return an undici fetch bound to the IPv4 agent dispatcher
    return (input: RequestInfo | URL, init?: RequestInit) =>
      // @ts-expect-error — undici's dispatcher option is not in the standard RequestInit type
      undiciFetch(input, { ...init, dispatcher: agent }) as Promise<Response>
  } catch {
    // undici not available — fall back to global fetch
    return undefined
  }
}

// Singleton fetch instance (one agent per process)
const ipv4Fetch = buildIpv4Fetch()

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
      ...(ipv4Fetch ? { global: { fetch: ipv4Fetch as typeof fetch } } : {}),
    }
  )
}

// Service role client for server-side admin operations (no RLS)
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      ...(ipv4Fetch ? { global: { fetch: ipv4Fetch as typeof fetch } } : {}),
    }
  )
}
