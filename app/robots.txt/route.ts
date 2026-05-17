import { NextResponse } from 'next/server'

export function GET() {
  return new NextResponse(
    `User-agent: *
Allow: /
Allow: /docs
Disallow: /api/
Disallow: /dashboard/
Disallow: /agents/
Disallow: /runs/
Disallow: /builder/

Sitemap: https://agenthub.nik10x.com/sitemap.xml
`,
    { headers: { 'Content-Type': 'text/plain' } }
  )
}
