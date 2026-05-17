import { NextResponse } from 'next/server'

export function GET() {
  const base = 'https://agenthub.nik10x.com'
  const now = new Date().toISOString().split('T')[0]
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${base}/docs</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } }
  )
}
