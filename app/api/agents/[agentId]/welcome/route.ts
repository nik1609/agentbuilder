export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserFromSession } from '@/lib/auth'
import { callLLM } from '@/lib/llm'
import { AgentSchema } from '@/types/agent'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const db = createAdminClient()
  const userId = await getUserFromSession()

  const agentQuery = db.from('agents').select('*').eq('id', agentId)
  if (userId) agentQuery.eq('user_id', userId)
  const { data: agent } = await agentQuery.single()

  if (!agent) return NextResponse.json({ welcome: 'Hello! Send a message to get started.' })

  const schema = agent.schema as AgentSchema & { orchestratorConfig?: { enabled?: boolean; model?: string } }
  const orchCfg = schema.orchestratorConfig
  const agentName: string = agent.name
  const agentDesc: string = (agent as Record<string, unknown>).description as string ?? ''

  // Derive what the workflow expects from the input node
  const inputNode = schema.nodes?.find(n => n.data.nodeType === 'input')
  const expectedInput = [
    inputNode?.data?.label && inputNode.data.label !== 'Input' ? String(inputNode.data.label) : null,
    (inputNode?.data?.description as string | undefined) ?? null,
  ].filter(Boolean).join(' — ') || null

  // Key workflow steps (skip structural nodes)
  const workflowSteps = (schema.nodes ?? [])
    .filter(n => !['input', 'output', 'hitl', 'clarify', 'fork', 'join'].includes(n.data.nodeType))
    .map(n => n.data.label)
    .join(', ')

  // ── LLM-generated welcome (when orchestrator is configured) ─────────────────
  if (orchCfg?.enabled && orchCfg.model) {
    try {
      const modelConfigs: Record<string, { provider: string; modelId: string; apiKey?: string; baseUrl?: string }> = {}
      if (userId) {
        const { data: modelRows } = await db.from('models').select('*').eq('user_id', userId)
        for (const m of (modelRows ?? [])) {
          modelConfigs[m.name] = {
            provider: m.provider ?? 'google',
            modelId: m.model_id ?? m.name,
            apiKey: m.api_key ?? undefined,
            baseUrl: m.base_url ?? undefined,
          }
        }
      }

      const orchModel = modelConfigs[orchCfg.model]
      const welcomePrompt = `You are ${agentName}.${agentDesc ? ` ${agentDesc}` : ''}
${workflowSteps ? `Your workflow covers: ${workflowSteps}.` : ''}
${expectedInput ? `To get started, the user needs to provide: ${expectedInput}.` : ''}

Write a friendly, specific welcome message for a new chat session (2–3 sentences max).
- Introduce yourself by name
- Say briefly what you can help with
- Tell the user exactly what to send to kick things off

Be specific and concrete. Avoid generic phrases like "I'm here to help" or "How can I assist you today?". No bullet lists — just natural flowing text.`

      const { text } = await callLLM({
        provider: (orchModel?.provider ?? 'google') as Parameters<typeof callLLM>[0]['provider'],
        model: orchModel?.modelId ?? orchCfg.model,
        apiKey: orchModel?.apiKey,
        baseUrl: orchModel?.baseUrl,
        userMessage: welcomePrompt,
        temperature: 0.6,
        maxTokens: 120,
      })

      return NextResponse.json({ welcome: text.trim() })
    } catch {
      // fall through to template
    }
  }

  // ── Template fallback (no LLM needed) ──────────────────────────────────────
  const parts: string[] = [`Hi! I'm **${agentName}**.`]
  if (agentDesc) parts.push(agentDesc.replace(/\.$/, '') + '.')
  if (expectedInput) {
    parts.push(`To get started, send me ${expectedInput}.`)
  } else {
    parts.push('Send me a message to begin.')
  }

  return NextResponse.json({ welcome: parts.join(' ') })
}
