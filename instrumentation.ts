/**
 * Next.js instrumentation hook — runs once when the server starts.
 *
 * Patches the global fetch dispatcher (undici) to prefer IPv4 addresses.
 * This is needed because Node.js built-in fetch uses undici which does its
 * own DNS resolution and may prefer IPv6 even when --dns-result-order=ipv4first
 * is set, causing "TypeError: fetch failed" on Supabase calls in local dev.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { setGlobalDispatcher, Agent } = require('undici') as {
        setGlobalDispatcher: (d: unknown) => void
        Agent: new (opts: unknown) => unknown
      }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const dns = require('dns') as typeof import('dns')

      setGlobalDispatcher(
        new Agent({
          connect: {
            // Force IPv4 for all outbound fetch connections made by undici
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
      )
      console.log('[instrumentation] undici global dispatcher: IPv4-first')
    } catch {
      // undici not available in this runtime — safe to ignore
    }
  }
}
