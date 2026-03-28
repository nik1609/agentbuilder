'use client'
import { useEffect, useState } from 'react'
import { KeyRound, Plus, Copy, CheckCircle, Trash2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'

interface ApiKey {
  id: string; name: string; key_prefix: string; is_active: boolean
  total_calls: number; last_used?: string; created_at: string
  key?: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set())
  const [snippetLang, setSnippetLang] = useState<'curl' | 'python' | 'javascript'>('curl')
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)

  useEffect(() => { setOrigin(window.location.origin) }, [])

  useEffect(() => {
    fetch('/api/keys').then(r => r.text()).then(t => { const d = (() => { try { return JSON.parse(t) } catch { return [] } })()
      setKeys(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const createKey = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName }),
    })
    const data = await res.text().then(t => { try { return JSON.parse(t) } catch { return {} } })
    setNewKey(data.key)
    setKeys(k => [{ ...data, key_prefix: data.keyPrefix, is_active: true, total_calls: 0, created_at: new Date().toISOString() }, ...k])
    setNewKeyName('')
    setShowForm(false)
    setCreating(false)
  }

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this key? All requests using it will fail immediately.')) return
    await fetch('/api/keys', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setKeys(k => k.map(x => x.id === id ? { ...x, is_active: false } : x))
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ padding: '48px', maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 48 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>API Keys</h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>Authenticate requests to your agent endpoints</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 20px', borderRadius: 12,
          background: 'var(--blue)', color: '#fff',
          fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
        }}>
          <Plus size={15} /> Generate Key
        </button>
      </div>

      {/* New key reveal */}
      {newKey && (
        <div style={{ marginBottom: 24, padding: 24, borderRadius: 16, background: 'rgba(34,215,154,0.05)', border: '1px solid rgba(34,215,154,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <CheckCircle size={18} color="var(--green)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>API key created — copy it now, it won&apos;t be shown again</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <code style={{ fontSize: 13, fontFamily: 'monospace', flex: 1, color: 'var(--text)', wordBreak: 'break-all' }}>{newKey}</code>
            <button onClick={() => copy(newKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              {copied ? <CheckCircle size={16} color="var(--green)" /> : <Copy size={16} color="var(--text3)" />}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>
            ✓ I&apos;ve saved my key
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div style={{ marginBottom: 24, padding: 24, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Name this key</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createKey()}
              placeholder="e.g. Production, My App, Staging…"
              autoFocus
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 14,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text)', outline: 'none',
              }}
            />
            <button onClick={createKey} disabled={creating} style={{
              padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              background: 'var(--blue)', color: '#fff', border: 'none', cursor: 'pointer',
              opacity: creating ? 0.6 : 1,
            }}>
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} style={{
              padding: '10px 16px', borderRadius: 10, fontSize: 14,
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)', fontSize: 14 }}>Loading…</div>
      ) : keys.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 40px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(124,111,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <KeyRound size={24} color="var(--blue)" />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No API keys yet</p>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Generate a key to start calling your agents</p>
        </div>
      ) : (
        <div style={{ borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 40 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 110px 90px 80px', padding: '12px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            {['Name', 'Key prefix', 'Calls', 'Last used', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {keys.map(key => (
            <div key={key.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 110px 90px 80px', padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border2)', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{key.name}</span>
              <code style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)' }}>{key.key_prefix}…</code>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{key.total_calls}</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                background: key.is_active ? 'rgba(34,215,154,0.1)' : 'rgba(232,85,85,0.1)',
                color: key.is_active ? 'var(--green)' : 'var(--red)',
                width: 'fit-content',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                {key.is_active ? 'Active' : 'Revoked'}
              </span>
              <div>
                {key.is_active && (
                  <button onClick={() => revokeKey(key.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Trash2 size={12} /> Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage examples */}
      {(() => {
        const runUrl = `${origin}/api/agents/{AGENT_ID}/run`
        const base = origin

        const snippets: Record<'curl' | 'python' | 'javascript', { title: string; description: string; code: string }[]> = {
          curl: [
            {
              title: 'Basic run',
              description: 'Send a message and get the output immediately.',
              code: `curl -s -X POST "${runUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ahk_..." \\
  -d '{"message": "Hello!"}'`,
            },
            {
              title: 'Clarify flow',
              description: 'Agent pauses with "waiting_clarify" — send your answer to continue.',
              code: `# Step 1: start the run
RESPONSE=$(curl -s -X POST "${runUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ahk_..." \\
  -d '{"message": "Hello!"}')
RUN_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['runId'])")

# Step 2: reply with your answer
curl -s -X POST "${base}/api/runs/$RUN_ID/clarify" \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ahk_..." \\
  -d '{"answer": "Your answer here"}'`,
            },
            {
              title: 'HITL flow',
              description: 'Agent pauses with "waiting_hitl" — approve or reject to continue.',
              code: `# Step 1: start the run
RESPONSE=$(curl -s -X POST "${runUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ahk_..." \\
  -d '{"message": "Hello!"}')
RUN_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['runId'])")

# Step 2: approve (set approved: false to reject)
curl -s -X POST "${base}/api/runs/$RUN_ID/resume" \\
  -H "Content-Type: application/json" \\
  -H "X-AgentHub-Key: ahk_..." \\
  -d '{"approved": true, "feedback": "Looks good."}'`,
            },
            {
              title: 'Chat loop (save as chat.sh)',
              description: 'Full terminal chat session — handles Clarify and HITL pauses automatically.',
              code: `#!/usr/bin/env bash
BASE_URL="${origin}"
AGENT_ID="{AGENT_ID}"   # find this in the builder URL or agent list
API_KEY="ahk_..."

echo ""; echo "  AgentHub Chat — type 'exit' to quit"; echo ""

_j() { python3 - "$1" "$2" <<'PYEOF'
import sys, json
raw, field = sys.argv[1], sys.argv[2]
try:
  d = json.loads(raw)
  v = d.get(field)
  if v is None: print(''); sys.exit(0)
  if isinstance(v, str): print(v); sys.exit(0)
  if isinstance(v, dict):
    for k in ('text','content','message','output','answer','result','question','summary'):
      if k in v and isinstance(v[k], str) and v[k].strip(): print(v[k]); sys.exit(0)
    parts = [str(x) for x in v.values() if isinstance(x, str) and str(x).strip()]
    print(' | '.join(parts) if parts else json.dumps(v, ensure_ascii=False))
  elif isinstance(v, list):
    parts = []
    for item in v:
      if isinstance(item, str): parts.append(item)
      elif isinstance(item, dict):
        for k in ('text','content','message','output'):
          if k in item and isinstance(item[k], str): parts.append(item[k]); break
    print(' '.join(parts) if parts else json.dumps(v, ensure_ascii=False))
  else: print(str(v))
except Exception: print('')
PYEOF
}
_q() { python3 - "$1" <<'PYEOF'
import sys, json
try:
  d = json.loads(sys.argv[1])
  for key in ('question','clarifyQuestion','prompt'):
    v = d.get(key)
    if isinstance(v, str) and v.strip(): print(v); sys.exit(0)
  out = d.get('output')
  if isinstance(out, dict):
    for k in ('question','text','content','message','prompt'):
      if k in out and isinstance(out[k], str) and out[k].strip(): print(out[k]); sys.exit(0)
  print('Please provide more information.')
except Exception: print('Please provide more information.')
PYEOF
}
_hitl_partial() { python3 - "$1" <<'PYEOF'
import sys, json
try:
  d = json.loads(sys.argv[1])
  out = d.get('output', {})
  if not isinstance(out, dict): print(''); sys.exit(0)
  p = out.get('partial')
  if p is None: print(''); sys.exit(0)
  if isinstance(p, str): print(p)
  elif isinstance(p, dict):
    for k in ('text','content','message','output','answer','result'):
      if k in p and isinstance(p[k], str) and p[k].strip(): print(p[k]); sys.exit(0)
    print(json.dumps(p, ensure_ascii=False))
  else: print(str(p))
except Exception: print('')
PYEOF
}

while true; do
  printf "\\033[1;36mYou:\\033[0m "; read -r MSG
  [ "$MSG" = "exit" ] || [ "$MSG" = "quit" ] && echo "Bye." && break
  [ -z "$MSG" ] && continue
  printf "\\033[2m  thinking...\\033[0m\\r"
  RAW=$(curl -s -X POST "$BASE_URL/api/agents/$AGENT_ID/run" \\
    -H "Content-Type: application/json" -H "X-AgentHub-Key: $API_KEY" \\
    -d "{\\"message\\": \\"$MSG\\"}")
  printf "                 \\r"
  STATUS=$(_j "$RAW" status); RUN_ID=$(_j "$RAW" runId)

  while [ "$STATUS" = "waiting_clarify" ]; do
    QUESTION=$(_q "$RAW")
    printf "\\033[1;35mAgent:\\033[0m %s\\n" "$QUESTION"
    printf "\\033[1;36mYou:\\033[0m "; read -r ANSWER
    [ -z "$ANSWER" ] && continue
    printf "\\033[2m  thinking...\\033[0m\\r"
    RAW=$(curl -s -X POST "$BASE_URL/api/runs/$RUN_ID/clarify" \\
      -H "Content-Type: application/json" -H "X-AgentHub-Key: $API_KEY" \\
      -d "{\\"answer\\": \\"$ANSWER\\"}")
    printf "                 \\r"
    STATUS=$(_j "$RAW" status); RUN_ID=$(_j "$RAW" runId)
  done

  while [ "$STATUS" = "waiting_hitl" ]; do
    printf "\\n  \\033[1;33m[HITL]\\033[0m Human review required.\\n"
    PREVIEW=$(_hitl_partial "$RAW")
    [ -n "$PREVIEW" ] && printf "  Preview: %s\\n" "$PREVIEW"
    printf "  Approve? [y/n]: "; read -r CHOICE
    APPROVED="true"; [ "$CHOICE" != "y" ] && APPROVED="false"
    printf "  Feedback (optional, Enter to skip): "; read -r FB
    printf "\\033[2m  resuming...\\033[0m\\r"
    RAW=$(curl -s -X POST "$BASE_URL/api/runs/$RUN_ID/resume" \\
      -H "Content-Type: application/json" -H "X-AgentHub-Key: $API_KEY" \\
      -d "{\\"approved\\": $APPROVED, \\"feedback\\": \\"$FB\\"}")
    printf "                 \\r"
    STATUS=$(_j "$RAW" status); RUN_ID=$(_j "$RAW" runId)
  done

  OUTPUT=$(_j "$RAW" output); ERR=$(_j "$RAW" error)
  if [ -n "$OUTPUT" ]; then printf "\\033[1;35mAgent:\\033[0m\\n%s\\n\\n" "$OUTPUT"
  elif [ -n "$ERR" ]; then printf "\\033[1;31mError:\\033[0m %s\\n\\n" "$ERR"
  else printf "\\033[2mAgent: [status=%s — no output]\\033[0m\\n\\n" "$STATUS"; fi
done`,
            },
          ],
          python: [
            {
              title: 'Basic run',
              description: 'Send a message and get the output. pip install requests',
              code: `import requests

response = requests.post(
    "${runUrl}",
    headers={"X-AgentHub-Key": "ahk_..."},
    json={"message": "Hello!"}
)
print(response.json()["output"])`,
            },
            {
              title: 'Clarify flow',
              description: 'Handle agents that pause to ask clarifying questions.',
              code: `import requests

HEADERS = {"X-AgentHub-Key": "ahk_..."}

res = requests.post("${runUrl}", headers=HEADERS,
    json={"message": "Hello!"}).json()

while res.get("status") == "waiting_clarify":
    question = res.get("output", {}).get("question", "Please clarify:")
    answer = input(f"Agent: {question}\\nYou: ")
    res = requests.post(
        f"${base}/api/runs/{res['runId']}/clarify",
        headers=HEADERS, json={"answer": answer}
    ).json()

print(res["output"])`,
            },
            {
              title: 'HITL flow',
              description: 'Handle agents that pause for human approval.',
              code: `import requests

HEADERS = {"X-AgentHub-Key": "ahk_..."}

res = requests.post("${runUrl}", headers=HEADERS,
    json={"message": "Hello!"}).json()

while res.get("status") == "waiting_hitl":
    partial = res.get("output", {}).get("partial", "")
    if partial:
        print(f"\\nReview:\\n{partial}\\n")
    approved = input("Approve? [y/n]: ").lower() == "y"
    feedback = input("Feedback (optional): ").strip() or None
    res = requests.post(
        f"${base}/api/runs/{res['runId']}/resume",
        headers=HEADERS,
        json={"approved": approved, "feedback": feedback}
    ).json()

print(res["output"])`,
            },
            {
              title: 'Chat loop (save as chat.py)',
              description: 'Full interactive chat — handles clarify + HITL, keeps looping. Run: python3 chat.py',
              code: `# chat.py — run with: python3 chat.py
import requests

BASE_URL = "${origin}"
AGENT_ID = "{AGENT_ID}"   # find in the builder URL or agent list
API_KEY  = "ahk_..."
HEADERS  = {"X-AgentHub-Key": API_KEY}

def send(message):
    res = requests.post(
        f"{BASE_URL}/api/agents/{AGENT_ID}/run",
        headers=HEADERS, json={"message": message}
    ).json()
    while res.get("status") in ("waiting_clarify", "waiting_hitl"):
        run_id = res["runId"]
        if res["status"] == "waiting_clarify":
            question = res.get("output", {}).get("question", "Please clarify:")
            answer = input(f"Agent: {question}\\nYou: ")
            res = requests.post(f"{BASE_URL}/api/runs/{run_id}/clarify",
                headers=HEADERS, json={"answer": answer}).json()
        else:
            partial = res.get("output", {}).get("partial", "")
            if partial:
                print(f"\\nReview:\\n{partial}\\n")
            approved = input("Approve? [y/n]: ").lower() == "y"
            feedback = input("Feedback (optional): ").strip() or None
            res = requests.post(f"{BASE_URL}/api/runs/{run_id}/resume",
                headers=HEADERS, json={"approved": approved, "feedback": feedback}).json()
    if res.get("status") == "failed":
        raise RuntimeError(res.get("error", "Agent failed"))
    return res.get("output", "")

print("\\n  AgentHub Chat — type 'exit' to quit\\n")
while True:
    msg = input("You: ").strip()
    if msg.lower() in ("exit", "quit"):
        print("Bye."); break
    if not msg:
        continue
    try:
        print(f"\\nAgent: {send(msg)}\\n")
    except Exception as e:
        print(f"\\nError: {e}\\n")`,
            },
          ],
          javascript: [
            {
              title: 'Basic run',
              description: 'Send a message and get the output. Works in Node.js and the browser.',
              code: `const response = await fetch("${runUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-AgentHub-Key": "ahk_...",
  },
  body: JSON.stringify({ message: "Hello!" }),
});

const data = await response.json();
console.log(data.output);`,
            },
            {
              title: 'Clarify flow',
              description: 'Handle agents that pause to ask clarifying questions.',
              code: `const HEADERS = { "Content-Type": "application/json", "X-AgentHub-Key": "ahk_..." };

let res = await fetch("${runUrl}", {
  method: "POST", headers: HEADERS,
  body: JSON.stringify({ message: "Hello!" }),
}).then(r => r.json());

while (res.status === "waiting_clarify") {
  const question = res.output?.question ?? "Please clarify:";
  const answer = prompt(question); // replace with your UI
  res = await fetch(\`${base}/api/runs/\${res.runId}/clarify\`, {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ answer }),
  }).then(r => r.json());
}

console.log(res.output);`,
            },
            {
              title: 'HITL flow',
              description: 'Handle agents that pause for human approval.',
              code: `const HEADERS = { "Content-Type": "application/json", "X-AgentHub-Key": "ahk_..." };

let res = await fetch("${runUrl}", {
  method: "POST", headers: HEADERS,
  body: JSON.stringify({ message: "Hello!" }),
}).then(r => r.json());

while (res.status === "waiting_hitl") {
  if (res.output?.partial) console.log("Review:", res.output.partial);
  const approved = confirm("Approve?"); // replace with your UI
  const feedback = approved ? prompt("Feedback (optional):") : undefined;
  res = await fetch(\`${base}/api/runs/\${res.runId}/resume\`, {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ approved, feedback }),
  }).then(r => r.json());
}

console.log(res.output);`,
            },
            {
              title: 'Chat loop (save as chat.mjs)',
              description: 'Full interactive chat — handles clarify + HITL, keeps looping. Run: node chat.mjs',
              code: `// chat.mjs — run with: node chat.mjs
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const BASE_URL = "${origin}";
const AGENT_ID = "{AGENT_ID}"; // find in the builder URL or agent list
const API_KEY  = "ahk_...";
const HEADERS  = { "Content-Type": "application/json", "X-AgentHub-Key": API_KEY };
const rl = readline.createInterface({ input: stdin, output: stdout });

async function send(message) {
  let res = await fetch(\`\${BASE_URL}/api/agents/\${AGENT_ID}/run\`, {
    method: "POST", headers: HEADERS, body: JSON.stringify({ message }),
  }).then(r => r.json());

  while (res.status === "waiting_clarify" || res.status === "waiting_hitl") {
    if (res.status === "waiting_clarify") {
      const question = res.output?.question ?? "Please clarify:";
      const answer = await rl.question(\`Agent: \${question}\\nYou: \`);
      res = await fetch(\`\${BASE_URL}/api/runs/\${res.runId}/clarify\`,
        { method: "POST", headers: HEADERS, body: JSON.stringify({ answer }) }
      ).then(r => r.json());
    } else {
      if (res.output?.partial) console.log("\\nReview:", res.output.partial, "\\n");
      const choice = await rl.question("Approve? [y/n]: ");
      const approved = choice.trim().toLowerCase() === "y";
      const feedback = approved ? (await rl.question("Feedback (optional): ")) || undefined : undefined;
      res = await fetch(\`\${BASE_URL}/api/runs/\${res.runId}/resume\`,
        { method: "POST", headers: HEADERS, body: JSON.stringify({ approved, feedback }) }
      ).then(r => r.json());
    }
  }
  if (res.status === "failed") throw new Error(res.error ?? "Agent failed");
  return res.output;
}

console.log("\\n  AgentHub Chat — type 'exit' to quit\\n");
while (true) {
  const msg = (await rl.question("You: ")).trim();
  if (msg === "exit" || msg === "quit") { console.log("Bye."); rl.close(); break; }
  if (!msg) continue;
  try {
    const output = await send(msg);
    console.log(\`\\nAgent: \${typeof output === "string" ? output : JSON.stringify(output)}\\n\`);
  } catch (e) { console.log(\`\\nError: \${e.message}\\n\`); }
}`,
            },
          ],
        }

        const tabs: { id: 'curl' | 'python' | 'javascript'; label: string }[] = [
          { id: 'curl', label: 'cURL' },
          { id: 'python', label: 'Python' },
          { id: 'javascript', label: 'JavaScript / Node' },
        ]

        const steps = snippets[snippetLang]

        return (
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <AlertCircle size={13} color="var(--text3)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>How to call your agents</span>
            </div>

            {/* Language tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setSnippetLang(tab.id)} style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: 'none', border: 'none',
                  borderBottom: snippetLang === tab.id ? '2px solid var(--blue)' : '2px solid transparent',
                  color: snippetLang === tab.id ? 'var(--blue)' : 'var(--text3)',
                  marginBottom: -1,
                }}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {steps.map((step, i) => {
                const key = `${snippetLang}-${i}`
                const isOpen = openSteps.has(key)
                const toggle = () => setOpenSteps(prev => {
                  const next = new Set(prev)
                  isOpen ? next.delete(key) : next.add(key)
                  return next
                })
                return (
                  <div key={key} style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <button onClick={toggle} style={{
                      width: '100%', padding: '9px 14px', background: isOpen ? 'var(--surface2)' : 'var(--surface)',
                      borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                      borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left',
                    }}>
                      {isOpen ? <ChevronDown size={12} color="var(--text3)" /> : <ChevronRight size={12} color="var(--text3)" />}
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{step.title}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{step.description}</span>
                    </button>
                    {isOpen && (
                      <div style={{ position: 'relative' }}>
                        <pre style={{
                          margin: 0, padding: '12px 14px', fontSize: 11, fontFamily: 'monospace',
                          lineHeight: 1.65, background: 'var(--bg)', color: 'var(--text)',
                          overflowX: 'auto', whiteSpace: 'pre',
                        }}>{step.code}</pre>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(step.code)
                            setCopiedSnippet(key)
                            setTimeout(() => setCopiedSnippet(null), 2000)
                          }}
                          style={{
                            position: 'absolute', top: 8, right: 8,
                            background: 'var(--surface2)',
                            border: `1px solid ${copiedSnippet === key ? 'var(--green)' : 'var(--border)'}`,
                            borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                            color: copiedSnippet === key ? 'var(--green)' : 'var(--text3)', fontSize: 10,
                            display: 'flex', alignItems: 'center', gap: 4,
                            transition: 'color 0.15s, border-color 0.15s',
                          }}>
                          {copiedSnippet === key ? <CheckCircle size={9} color="var(--green)" /> : <Copy size={9} />}
                          {copiedSnippet === key ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
