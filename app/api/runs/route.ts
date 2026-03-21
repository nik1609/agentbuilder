import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const db = createAdminClient()
  const url = new URL(req.url)
  const agentId = url.searchParams.get('agentId')

  let query = db
    .from('agent_runs')
    .select('id, agent_id, agent_name, status, tokens, latency_ms, error, created_at, api_key_prefix, input, output')
    .order('created_at', { ascending: false })
    .limit(100)

  if (agentId) query = query.eq('agent_id', agentId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
