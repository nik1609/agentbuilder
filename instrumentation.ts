/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Currently a no-op; IPv4 DNS preference is handled via
 * NODE_OPTIONS=--dns-result-order=ipv4first in the dev/start scripts.
 */
export async function register() {
  // no-op
}
