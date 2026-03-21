'use client'
import { useState, useEffect } from 'react'
import { Copy, CheckCircle, Key, Zap, Globe, Terminal, Code2, BookOpen } from 'lucide-react'

interface ApiKey { id: string; name: string; key_prefix: string; created_at: string }

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', margin: '12px 0', border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)', fontWeight: 600 }}>{lang}</span>
        <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: copied ? 'var(--green)' : 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
          {copied ? <CheckCircle size={11} /> : <Copy size={11} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{ padding: '16px 20px', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.8, color: 'var(--text2)', overflowX: 'auto', margin: 0 }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'auth', label: 'Authentication', icon: Key },
  { id: 'agents', label: 'Agents API', icon: Zap },
  { id: 'run', label: 'Running Agents', icon: Terminal },
  { id: 'hitl', label: 'HITL Approval', icon: CheckCircle },
  { id: 'models', label: 'Model Providers', icon: Globe },
  { id: 'quickstart', label: 'Quick Start', icon: Code2 },
]

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.4px', marginBottom: 8, marginTop: 0 }}>{children}</h2>
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 28, marginBottom: 6 }}>{children}</h3>
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text2)', margin: '0 0 4px' }}>{children}</p>
}
function Pill({ children }: { children: React.ReactNode }) {
  return <code style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--blue)', fontFamily: 'monospace' }}>{children}</code>
}

export default function DocsPage() {
  const [active, setActive] = useState('overview')
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [origin, setOrigin] = useState('https://your-domain.com')

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch('/api/keys').then(r => r.json()).then(d => setApiKeys(Array.isArray(d) ? d : []))
  }, [])

  const exampleKey = apiKeys[0] ? `ahk_${apiKeys[0].key_prefix}...` : 'ahk_your_api_key'
  const BASE = origin

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Left nav */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '32px 12px', overflowY: 'auto', background: 'var(--surface)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', padding: '0 12px', marginBottom: 12 }}>API Reference</p>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActive(id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
              background: active === id ? 'rgba(124,111,240,0.12)' : 'transparent',
              color: active === id ? 'var(--blue)' : 'var(--text2)',
              fontSize: 13, fontWeight: active === id ? 600 : 500,
            }}>
              <Icon size={14} style={{ flexShrink: 0 }} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 56px', maxWidth: 760 }}>

        {active === 'overview' && (
          <div>
            <H2>AgentHub API</H2>
            <P>Integrate AI agents into any application with a simple REST API. Build agents visually, deploy instantly, call from anywhere.</P>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '24px 0' }}>
              {[
                { label: 'Base URL', value: BASE },
                { label: 'Auth Header', value: 'X-AgentHub-Key' },
                { label: 'Content-Type', value: 'application/json' },
                { label: 'Format', value: 'JSON' },
              ].map(item => (
                <div key={item.label} style={{ padding: '16px 20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--blue)', wordBreak: 'break-all' }}>{item.value}</div>
                </div>
              ))}
            </div>

            <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/agents/AGENT_ID/run \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${exampleKey}" \\
  -d '{"message": "Hello!"}'`} />
          </div>
        )}

        {active === 'auth' && (
          <div>
            <H2>Authentication</H2>
            <P>All API requests require an API key in the <Pill>X-AgentHub-Key</Pill> header. Generate keys from the API Keys page.</P>
            <CodeBlock lang="bash" code={`curl -H "X-AgentHub-Key: ${exampleKey}" ${BASE}/api/agents`} />
            <CodeBlock lang="javascript" code={`const res = await fetch('${BASE}/api/agents', {
  headers: {
    'Content-Type': 'application/json',
    'X-AgentHub-Key': '${exampleKey}',
  }
})
const agents = await res.json()`} />
            <CodeBlock lang="python" code={`import requests

resp = requests.get('${BASE}/api/agents', headers={
    'Content-Type': 'application/json',
    'X-AgentHub-Key': '${exampleKey}',
})
agents = resp.json()`} />
          </div>
        )}

        {active === 'agents' && (
          <div>
            <H2>Agents API</H2>
            <H3>List Agents</H3>
            <CodeBlock lang="bash" code={`GET ${BASE}/api/agents

curl -H "X-AgentHub-Key: ${exampleKey}" ${BASE}/api/agents`} />
            <H3>Get Agent</H3>
            <CodeBlock lang="bash" code={`GET ${BASE}/api/agents/:agentId

curl -H "X-AgentHub-Key: ${exampleKey}" \\
  ${BASE}/api/agents/AGENT_ID`} />
            <H3>Response shape</H3>
            <CodeBlock lang="json" code={`[
  {
    "id": "agent_abc123",
    "name": "My Agent",
    "description": "Does something useful",
    "version": 1,
    "run_count": 42,
    "created_at": "2026-01-01T00:00:00Z"
  }
]`} />
          </div>
        )}

        {active === 'run' && (
          <div>
            <H2>Running Agents</H2>
            <P>Execute an agent with a message. Runs synchronously and returns the full response.</P>
            <CodeBlock lang="bash" code={`POST ${BASE}/api/agents/:agentId/run

curl -X POST ${BASE}/api/agents/AGENT_ID/run \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${exampleKey}" \\
  -d '{"message": "Analyse the latest trends"}'`} />
            <H3>Response</H3>
            <CodeBlock lang="json" code={`{
  "runId": "run_abc123",
  "status": "completed",
  "output": "Here are the latest trends...",
  "tokens": 1247,
  "latencyMs": 2340,
  "trace": [
    { "type": "node_start", "nodeId": "llm-1", "message": "LLM Node started", "ts": 0 },
    { "type": "llm_response", "nodeId": "llm-1", "message": "Response received (1247 tokens)", "ts": 2310 }
  ]
}`} />
            <CodeBlock lang="javascript" code={`async function runAgent(agentId, message) {
  const res = await fetch(\`${BASE}/api/agents/\${agentId}/run\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AgentHub-Key': '${exampleKey}',
    },
    body: JSON.stringify({ message }),
  })
  const result = await res.json()
  if (result.status === 'waiting_hitl') return handleHITL(result)
  return result.output
}`} />
          </div>
        )}

        {active === 'hitl' && (
          <div>
            <H2>Human-in-the-Loop</H2>
            <P>When an agent has a HITL checkpoint, execution pauses and returns <Pill>waiting_hitl</Pill>. Your app resumes it after human review.</P>
            <H3>Paused response shape</H3>
            <CodeBlock lang="json" code={`{
  "runId": "run_abc123",
  "status": "waiting_hitl",
  "output": {
    "message": "Waiting for human approval",
    "checkpoint": "hitl-node-id",
    "partial": "The agent's work so far..."
  }
}`} />
            <H3>Resume a paused run</H3>
            <CodeBlock lang="bash" code={`POST ${BASE}/api/runs/:runId/resume

# Approve with no notes
curl -X POST ${BASE}/api/runs/RUN_ID/resume \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${exampleKey}" \\
  -d '{}'

# Approve with reviewer notes
curl -X POST ${BASE}/api/runs/RUN_ID/resume \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ${exampleKey}" \\
  -d '{"feedback": "Looks good, tone it down slightly"}'`} />
            <CodeBlock lang="javascript" code={`async function handleHITL(pausedResult) {
  const { runId, output } = pausedResult
  // Show output.partial to your reviewer UI
  const feedback = await yourReviewUI(output.partial)

  const res = await fetch(\`${BASE}/api/runs/\${runId}/resume\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AgentHub-Key': '${exampleKey}',
    },
    body: JSON.stringify({ feedback }),
  })
  const final = await res.json()
  return final.output
}`} />
          </div>
        )}

        {active === 'models' && (
          <div>
            <H2>Model Providers</H2>
            <P>AgentHub supports any LLM. Configure providers in the Models tab inside Config Studio on the builder page.</P>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              {[
                { name: 'Google Gemini', provider: 'google', models: 'gemini-2.5-flash, gemini-2.0-pro', key: 'GEMINI_API_KEY (env)', url: 'Built-in — no URL needed' },
                { name: 'OpenAI', provider: 'openai-compatible', models: 'gpt-4o, gpt-4o-mini, gpt-3.5-turbo', key: 'Your OpenAI key', url: 'https://api.openai.com' },
                { name: 'Anthropic', provider: 'anthropic', models: 'claude-sonnet-4-6, claude-opus-4-6', key: 'Your Anthropic key', url: 'https://api.anthropic.com' },
                { name: 'Groq (Fast inference)', provider: 'openai-compatible', models: 'llama-3.3-70b, mixtral-8x7b', key: 'Your Groq key', url: 'https://api.groq.com/openai' },
                { name: 'Ollama (Local)', provider: 'openai-compatible', models: 'llama3, mistral, phi-3', key: 'ollama (no key needed)', url: 'http://localhost:11434' },
                { name: 'LM Studio', provider: 'openai-compatible', models: 'Any local model', key: 'lm-studio', url: 'http://localhost:1234' },
              ].map(p => (
                <div key={p.name} style={{ padding: '20px 24px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '3px 10px', borderRadius: 6, background: 'rgba(124,111,240,0.1)', color: 'var(--blue)', border: '1px solid var(--border)' }}>{p.provider}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text3)' }}>Models: </span><span style={{ color: 'var(--text2)' }}>{p.models}</span></div>
                    <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text3)' }}>API Key: </span><span style={{ color: 'var(--text2)' }}>{p.key}</span></div>
                    <div style={{ fontSize: 12, gridColumn: '1 / -1' }}><span style={{ color: 'var(--text3)' }}>Base URL: </span><span style={{ fontFamily: 'monospace', color: 'var(--cyan)' }}>{p.url}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {active === 'quickstart' && (
          <div>
            <H2>Quick Start</H2>
            <P>Drop-in clients for JavaScript and Python.</P>
            <H3>agentHub.js</H3>
            <CodeBlock lang="javascript" code={`class AgentHub {
  constructor(apiKey, baseUrl = '${BASE}') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.headers = {
      'Content-Type': 'application/json',
      'X-AgentHub-Key': apiKey,
    }
  }

  async listAgents() {
    const r = await fetch(\`\${this.baseUrl}/api/agents\`, { headers: this.headers })
    return r.json()
  }

  async run(agentId, message) {
    const r = await fetch(\`\${this.baseUrl}/api/agents/\${agentId}/run\`, {
      method: 'POST', headers: this.headers,
      body: JSON.stringify({ message }),
    })
    return r.json()
  }

  async resume(runId, feedback) {
    const r = await fetch(\`\${this.baseUrl}/api/runs/\${runId}/resume\`, {
      method: 'POST', headers: this.headers,
      body: JSON.stringify({ feedback }),
    })
    return r.json()
  }

  async runWithHITL(agentId, message, onReview) {
    let result = await this.run(agentId, message)
    while (result.status === 'waiting_hitl') {
      const feedback = await onReview(result.output)
      result = await this.resume(result.runId, feedback)
    }
    return result
  }
}

// Usage
const hub = new AgentHub('${exampleKey}')
const result = await hub.run('AGENT_ID', 'Summarise this week in AI')
console.log(result.output)`} />

            <H3>agent_hub.py</H3>
            <CodeBlock lang="python" code={`import requests
from typing import Callable, Optional

class AgentHub:
    def __init__(self, api_key: str, base_url: str = '${BASE}'):
        self.base_url = base_url.rstrip('/')
        self.headers = {
            'Content-Type': 'application/json',
            'X-AgentHub-Key': api_key,
        }

    def list_agents(self):
        return requests.get(f'{self.base_url}/api/agents', headers=self.headers).json()

    def run(self, agent_id: str, message: str):
        return requests.post(
            f'{self.base_url}/api/agents/{agent_id}/run',
            headers=self.headers, json={'message': message}
        ).json()

    def resume(self, run_id: str, feedback: Optional[str] = None):
        return requests.post(
            f'{self.base_url}/api/runs/{run_id}/resume',
            headers=self.headers, json={'feedback': feedback}
        ).json()

    def run_with_hitl(self, agent_id, message, on_review: Callable):
        result = self.run(agent_id, message)
        while result['status'] == 'waiting_hitl':
            feedback = on_review(result['output'])
            result = self.resume(result['runId'], feedback)
        return result

# Usage
hub = AgentHub('${exampleKey}')
result = hub.run('AGENT_ID', 'What are the top AI papers this week?')
print(result['output'])`} />
          </div>
        )}
      </div>
    </div>
  )
}
