/**
 * POST /api/agents/:agentId/sessions
 * Creates a new interactive session for an agent.
 * Returns: { sessionId, runId, streamUrl }
 * Then poll GET /api/sessions/:sessionId/stream for SSE events.
 *
 * Headers: X-AgentHub-Key (required for production, omit/test for dev)
 * Body: { message: string, ...anyInputFields }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromSession, getUserFromApiKey, hashApiKey } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const db = createAdminClient()

  // Auth
  const sessionUserId = await getUserFromSession()
  const apiKeyHeader = req.headers.get('X-AgentHub-Key') || req.headers.get('x-agenthub-key')
  const isTestMode = !apiKeyHeader || apiKeyHeader === 'test'
  const apiKeyUserId = (!sessionUserId && !isTestMode) ? await getUserFromApiKey(req) : null
  const resolvedUserId = sessionUserId ?? apiKeyUserId

  if (!resolvedUserId && !isTestMode) {
    return NextResponse.json({ error: 'Unauthorized. Pass X-AgentHub-Key or sign in.' }, { status: 401 })
  }

  let keyRecord: { id: string; key_prefix: string; total_calls: number } | null = null
  if (!isTestMode && apiKeyHeader) {
    const keyHash = hashApiKey(apiKeyHeader)
    const { data } = await db.from('api_keys').select('id, key_prefix, total_calls').eq('key_hash', keyHash).eq('is_active', true).single()
    if (!data) return NextResponse.json({ error: 'Invalid or revoked API key.' }, { status: 403 })
    keyRecord = data
  }

  // Load agent
  const agentQuery = db.from('agents').select('id, name, description, schema').eq('id', agentId)
  if (resolvedUserId) agentQuery.eq('user_id', resolvedUserId)
  const { data: agent, error: agentError } = await agentQuery.single()
  if (agentError || !agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  let input: Record<string, unknown> = {}
  try { input = await req.json() } catch { input = {} }

  const sessionId = uuidv4()
  const runId = uuidv4()
  const now = new Date().toISOString()

  // Create session record (use agent_runs table with a session_id marker in output)
  await db.from('agent_runs').insert({
    id: runId,
    agent_id: agentId,
    agent_name: agent.name,
    api_key_id: keyRecord?.id ?? null,
    api_key_prefix: keyRecord?.key_prefix ?? (isTestMode ? 'test' : null),
    input,
    status: 'running',
    trace: [],
    created_at: now,
    user_id: resolvedUserId ?? null,
    // Store sessionId in output temporarily so stream handler can find it
    output: { __sessionId: sessionId } as object,
  })

  const baseUrl = req.nextUrl.origin
  return NextResponse.json({
    sessionId,
    runId,
    agentId,
    agentName: agent.name,
    streamUrl: `${baseUrl}/api/sessions/${sessionId}/stream`,
    status: 'created',
    createdAt: now,
  })
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-AgentHub-Key',
    },
  })
}
