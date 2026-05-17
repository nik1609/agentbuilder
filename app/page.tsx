'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  Zap, ArrowRight, Code2, Globe, Shield, MessageSquare, BookOpen,
  GitBranch, Cpu, RefreshCw, UserCheck, CheckCircle, X,
  Mail, Lock, Eye, EyeOff, Loader2, ChevronRight, Sun, Moon, HelpCircle,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Theme tokens
// ─────────────────────────────────────────────────────────────────────────────
const DARK_T = {
  pageBg:'#050505', navBg:'rgba(5,5,5,0.92)', surface:'#0B0B0B', surface2:'#111111', surface3:'#171717',
  border:'rgba(255,255,255,0.08)', border2:'rgba(255,255,255,0.04)', borderHi:'rgba(255,255,255,0.15)',
  text:'#FFFFFF', text2:'#A1A1AA', text3:'#71717A', accentLt:'#60A5FA',
  btnBg:'#FFFFFF', btnText:'#000000',
  secBg:'rgba(255,255,255,0.06)', secBorder:'rgba(255,255,255,0.08)', secText:'#A1A1AA',
  secHoverBg:'rgba(255,255,255,0.1)', secHoverBorder:'rgba(255,255,255,0.15)',
  modalBg:'#111111', modalInputBg:'#050505', modalDivider:'rgba(255,255,255,0.04)',
  modalGoogleBg:'rgba(255,255,255,0.04)', modalGoogleBorder:'rgba(255,255,255,0.08)',
  modalGoogleHoverBg:'rgba(255,255,255,0.07)', modalGoogleHoverBorder:'rgba(255,255,255,0.15)',
  inputBorder:'rgba(255,255,255,0.1)', inputBg:'#0A0A0A',
  errColor:'#DC2626', errBg:'rgba(220,38,38,0.08)', errBorder:'rgba(220,38,38,0.2)',
}
const LIGHT_T = {
  pageBg:'#FFFFFF', navBg:'rgba(255,255,255,0.92)', surface:'#F7F7F8', surface2:'#EFEFEF', surface3:'#E5E5E5',
  border:'rgba(0,0,0,0.08)', border2:'rgba(0,0,0,0.04)', borderHi:'rgba(0,0,0,0.15)',
  text:'#0D0D0D', text2:'#6B6B6B', text3:'#9B9B9B', accentLt:'#2563EB',
  btnBg:'#000000', btnText:'#FFFFFF',
  secBg:'rgba(0,0,0,0.04)', secBorder:'rgba(0,0,0,0.1)', secText:'#6B6B6B',
  secHoverBg:'rgba(0,0,0,0.08)', secHoverBorder:'rgba(0,0,0,0.2)',
  modalBg:'#FFFFFF', modalInputBg:'#F7F7F8', modalDivider:'rgba(0,0,0,0.06)',
  modalGoogleBg:'rgba(0,0,0,0.03)', modalGoogleBorder:'rgba(0,0,0,0.1)',
  modalGoogleHoverBg:'rgba(0,0,0,0.06)', modalGoogleHoverBorder:'rgba(0,0,0,0.2)',
  inputBorder:'rgba(0,0,0,0.12)', inputBg:'#F7F7F8',
  errColor:'#DC2626', errBg:'rgba(220,38,38,0.06)', errBorder:'rgba(220,38,38,0.15)',
}
const DC = { bg:'#0E0E0E', border:'rgba(255,255,255,0.08)', text:'#A1A1AA', text3:'#71717A' }

const PROVIDERS = ['OpenAI','Gemini','Claude','Groq','Mistral','Llama','Ollama','Any OpenAI-compatible API']
const PCOLORS:Record<string,string> = { OpenAI:'#10a37f',Gemini:'#4285F4',Claude:'#d97706',Groq:'#f55036',Mistral:'#ff7000',Llama:'#A1A1AA',Ollama:'#A1A1AA','Any OpenAI-compatible API':'#71717A' }

const NODE_TYPES = [
  { name:'AI Step',      color:'#7C3AED', desc:'Call any language model with a system prompt' },
  { name:'Action',       color:'#0891B2', desc:'HTTP calls, code execution, web search' },
  { name:'Branch',       color:'#16A34A', desc:'Binary yes/no routing evaluated by AI' },
  { name:'Switch',       color:'#D97706', desc:'Multi-way routing for 3+ branches' },
  { name:'Loop',         color:'#EA580C', desc:'Repeat until exit condition is met' },
  { name:'Fork / Join',  color:'#9333EA', desc:'Parallel execution, merge results' },
  { name:'Human Review', color:'#DB2777', desc:'Pause for human approval mid-run' },
  { name:'Ask User',     color:'#DC2626', desc:'Ask user a question mid-run' },
]
const FEATURE_CHIPS = ['LLM Agents','Visual Builder','REST APIs','Loops + Parallel','Human-in-the-Loop','Guardrails','MCP Connectors','Full Observability']

const CODE_TABS = ['JavaScript','Python','cURL'] as const
type CodeTab = typeof CODE_TABS[number]

// ─────────────────────────────────────────────────────────────────────────────
// Sonar dot
// ─────────────────────────────────────────────────────────────────────────────
function SonarDot({ color='#22C55E', size=7 }: { color?:string; size?:number }) {
  return (
    <span style={{ position:'relative', display:'inline-block', width:size, height:size, flexShrink:0 }}>
      <span style={{ position:'absolute', inset:-(size*0.5), borderRadius:'50%', border:`1.5px solid ${color}`, animation:'sonar 2s ease-out infinite', opacity:0 }}/>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:color }}/>
    </span>
  )
}

const GitHubIcon = ({ size=16 }:{ size?:number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
)
const LinkedInIcon = ({ size=16 }:{ size?:number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
)

// ─────────────────────────────────────────────────────────────────────────────
// Draggable SVG DAG (WorkflowPanel)
// ─────────────────────────────────────────────────────────────────────────────
function WorkflowPanel() {
  const NW=138, NH=34, VW=346, VH=274
  const F = `"Inter",-apple-system,BlinkMacSystemFont,sans-serif`

  type Pos = { cx:number; y:number }
  const [pos, setPos] = useState<Record<string,Pos>>({
    in:   {cx:173, y:10 },
    llm:  {cx:72,  y:80 },
    tool: {cx:274, y:80 },
    cond: {cx:173, y:152},
    out:  {cx:173, y:220},
  })

  const nodeData: Record<string,{col:string; label:string; sub:string; state:'done'|'running'|'waiting'|'pending'}> = {
    in:   {col:'#374151', label:'Input',              sub:'message: "Research..."',   state:'done'   },
    llm:  {col:'#7C3AED', label:'AI Step · Claude',    sub:'reasoning + planning',    state:'done'   },
    tool: {col:'#0891B2', label:'Action · Search',     sub:'retrieving sources...',   state:'running'},
    cond: {col:'#16A34A', label:'Branch · Quality',    sub:'score threshold check',   state:'waiting'},
    out:  {col:'#6B7280', label:'Output · REST API',   sub:'return structured JSON',  state:'pending'},
  }

  const edgeDefs:[string,string,boolean][] = [
    ['in','llm',false],['in','tool',true],
    ['llm','cond',false],['tool','cond',true],
    ['cond','out',false],
  ]

  const dragRef = useRef<{id:string; ox:number; oy:number}|null>(null)
  const svgRef  = useRef<SVGSVGElement>(null)

  const toSvg = (e:React.MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x:(e.clientX-r.left)*(VW/r.width), y:(e.clientY-r.top)*(VH/r.height) }
  }
  const onDown = (e:React.MouseEvent, id:string) => {
    e.preventDefault(); e.stopPropagation()
    const {x,y}=toSvg(e), p=pos[id]
    dragRef.current={id, ox:x-(p.cx-NW/2), oy:y-p.y}
  }
  const onMove = (e:React.MouseEvent<SVGSVGElement>) => {
    if (!dragRef.current||!svgRef.current) return
    const {x,y}=toSvg(e), {id,ox,oy}=dragRef.current
    setPos(p=>({...p,[id]:{cx:x-ox+NW/2, y:y-oy}}))
  }
  const onUp = () => { dragRef.current=null }

  const bez = (x1:number,y1:number,x2:number,y2:number) => {
    const m=(y1+y2)/2; return `M${x1} ${y1} C${x1} ${m} ${x2} ${m} ${x2} ${y2}`
  }

  const edges = edgeDefs.map(([from,to,active])=>{
    const fp=pos[from], tp=pos[to]
    return { path:bez(fp.cx, fp.y+NH, tp.cx, tp.y), col:nodeData[from].col, active }
  })

  return (
    <div style={{ border:`1px solid ${DC.border}`, borderRadius:20, overflow:'hidden', background:'#070707', animation:'floatPanel 7s ease-in-out infinite' }}>
      {/* Chrome */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 13px', borderBottom:'1px solid rgba(255,255,255,0.04)', background:'#0A0A0A' }}>
        <span style={{width:8,height:8,borderRadius:'50%',background:'#FF5F57'}}/><span style={{width:8,height:8,borderRadius:'50%',background:'#FEBC2E'}}/><span style={{width:8,height:8,borderRadius:'50%',background:'#28C840'}}/>
        <span style={{ marginLeft:8, fontSize:10, fontFamily:F, color:'#AAAACC', letterSpacing:'-0.01em' }}>research-agent.flow</span>
        <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:9, color:'#9898BA', fontFamily:F }}>Step 2/4 · tool running</span>
          <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:9.5, fontWeight:600, color:'#22C55E', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.16)', padding:'2px 9px', borderRadius:20, fontFamily:F }}>
            <SonarDot color="#22C55E" size={5}/> Executing
          </span>
        </span>
      </div>

      {/* Draggable SVG canvas */}
      <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} style={{ width:'100%', display:'block', cursor:dragRef.current?'grabbing':'default' }}
        onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
        <defs>
          <pattern id="dp" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="0.8" cy="0.8" r="0.55" fill="rgba(255,255,255,0.05)"/>
          </pattern>
          <filter id="eg" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <rect width={VW} height={VH} fill="url(#dp)"/>

        {/* Edges — recomputed from live positions */}
        {edges.map((e,i)=>(
          <g key={i} style={{ pointerEvents:'none' }}>
            {e.active&&<path d={e.path} stroke={e.col} strokeWidth="4" fill="none" opacity="0.1" filter="url(#eg)"/>}
            <path d={e.path} stroke={e.active?e.col:'#1E1E2E'} strokeWidth={e.active?1.4:0.9} fill="none"
              strokeDasharray={e.active?'7 3.5':undefined}
              style={e.active?{animation:'flowEdge 1s linear infinite'}:undefined}/>
          </g>
        ))}

        {/* Nodes — draggable */}
        {Object.entries(nodeData).map(([id,node])=>{
          const p = pos[id]
          return (
            <g key={id} transform={`translate(${p.cx-NW/2},${p.y})`}
              style={{ cursor:'grab' }}
              onMouseDown={e=>onDown(e,id)}>
              {node.state==='running'&&<rect width={NW} height={NH} rx="7" fill={node.col} opacity="0.07" style={{animation:'nodePulse 1.8s ease-in-out infinite'}}/>}
              <rect width={NW} height={NH} rx="6" fill="#111111"
                stroke={`${node.col}${node.state==='running'?'88':node.state==='done'?'44':'1A'}`}
                strokeWidth={node.state==='running'?1.2:0.8}/>
              {/* Header tint */}
              <rect width={NW} height={17} rx="6" fill={`${node.col}0E`}/>
              <rect y="11" width={NW} height="6" fill={`${node.col}0E`}/>
              {/* Status indicators */}
              {node.state==='done'    &&<><circle cx="12" cy="8.5" r="3" fill={node.col} opacity="0.9"/><path d="M10 8.5 L11.8 10.3 L15.5 7" stroke="#fff" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>}
              {node.state==='running' &&<><circle cx="12" cy="8.5" r="2.8" fill={node.col}/><circle cx="12" cy="8.5" r="4.5" fill="none" stroke={node.col} strokeWidth="0.7" opacity="0.5" style={{animation:'sonar 1.4s ease-out infinite'}}/></>}
              {node.state==='waiting' &&<circle cx="12" cy="8.5" r="2.8" fill={node.col} opacity="0.4"/>}
              {node.state==='pending' &&<circle cx="12" cy="8.5" r="2.5" fill="none" stroke={node.col} strokeWidth="0.7" opacity="0.22"/>}
              {/* Label */}
              <text x="21" y="12" fontSize="7" fontWeight="600" fill={node.state==='pending'?'#7878A0':'#F0F0F8'} fontFamily={F} letterSpacing="-0.2">{node.label}</text>
              {/* Sub */}
              <text x="10" y="26.5" fontSize="6.5" fill={node.state==='pending'?'#6868A0':'#9898BA'} fontFamily={F} letterSpacing="-0.1">{node.sub}</text>
              {/* Connection handles */}
              {id!=='in' &&<circle cx={NW/2} cy="0" r="2.8" fill={node.col} stroke="#070707" strokeWidth="1" opacity={node.state==='pending'?0.18:0.85}/>}
              {id!=='out'&&<circle cx={NW/2} cy={NH} r="2.8" fill={node.col} stroke="#070707" strokeWidth="1" opacity={node.state==='pending'?0.18:0.85}/>}
            </g>
          )
        })}
      </svg>

      {/* API bar */}
      <div style={{ margin:'0 12px', height:1, background:'rgba(255,255,255,0.04)' }}/>
      <div style={{ margin:'8px 12px 10px', background:'#040404', border:'1px solid rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 11px' }}>
        <div style={{ fontSize:9, fontFamily:F, color:'#9898BA', marginBottom:4, letterSpacing:'-0.01em' }}>POST /api/agents/abc123/run  stream: true</div>
        <div style={{ fontSize:9, fontFamily:'monospace', lineHeight:1.8 }}>
          <span style={{color:'#9898BA'}}>{'{ '}</span><span style={{color:'#60A5FA'}}>&quot;status&quot;</span><span style={{color:'#9898BA'}}>: </span><span style={{color:'#FCD34D'}}>&quot;running&quot;</span><span style={{color:'#9898BA'}}>, </span><span style={{color:'#60A5FA'}}>&quot;step&quot;</span><span style={{color:'#9898BA'}}>: </span><span style={{color:'#FB923C'}}>2</span><span style={{color:'#9898BA'}}>, </span><span style={{color:'#60A5FA'}}>&quot;tokens&quot;</span><span style={{color:'#9898BA'}}>: </span><span style={{color:'#FB923C'}}>127</span><span style={{color:'#9898BA'}}> {'}'}</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature cards with lift motion
// ─────────────────────────────────────────────────────────────────────────────
function FCardLg({ icon:Icon, title, desc, tag, T, iconColor }: { icon:React.ElementType; title:string; desc:string; tag:string; T:typeof DARK_T; iconColor?:string }) {
  const ic = iconColor || T.text2
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:20, padding:'36px', transition:'border-color 0.2s,background 0.2s,transform 0.25s ease,box-shadow 0.25s', height:'100%', boxSizing:'border-box' }}
      onMouseEnter={e=>{ const el=e.currentTarget; el.style.borderColor=iconColor?`${iconColor}40`:T.borderHi; el.style.background=T.surface2; el.style.transform='translateY(-5px)'; el.style.boxShadow=`0 24px 48px ${iconColor?iconColor+'18':'rgba(0,0,0,0.18)'}` }}
      onMouseLeave={e=>{ const el=e.currentTarget; el.style.borderColor=T.border; el.style.background=T.surface; el.style.transform='translateY(0)'; el.style.boxShadow='none' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28 }}>
        <div style={{ width:44, height:44, borderRadius:13, background:iconColor?`${iconColor}12`:T.surface2, border:`1px solid ${iconColor?iconColor+'28':T.border}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={19} color={ic} strokeWidth={1.5}/>
        </div>
        <span style={{ fontSize:10, fontWeight:600, color:T.text3, background:T.surface2, border:`1px solid ${T.border}`, padding:'3px 10px', borderRadius:20 }}>{tag}</span>
      </div>
      <h3 style={{ fontSize:20, fontWeight:700, color:T.text, letterSpacing:'-0.02em', marginBottom:12 }}>{title}</h3>
      <p style={{ fontSize:14, color:T.text2, lineHeight:1.7 }}>{desc}</p>
    </div>
  )
}
function FCardSm({ icon:Icon, title, desc, T, iconColor }: { icon:React.ElementType; title:string; desc:string; T:typeof DARK_T; iconColor?:string }) {
  const ic = iconColor || T.text2
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:'22px', transition:'border-color 0.2s,background 0.2s,transform 0.25s ease,box-shadow 0.25s', height:'100%', boxSizing:'border-box' }}
      onMouseEnter={e=>{ const el=e.currentTarget; el.style.borderColor=iconColor?`${iconColor}40`:T.borderHi; el.style.background=T.surface2; el.style.transform='translateY(-4px)'; el.style.boxShadow=`0 16px 32px ${iconColor?iconColor+'18':'rgba(0,0,0,0.14)'}` }}
      onMouseLeave={e=>{ const el=e.currentTarget; el.style.borderColor=T.border; el.style.background=T.surface; el.style.transform='translateY(0)'; el.style.boxShadow='none' }}>
      <div style={{ width:36, height:36, borderRadius:10, background:iconColor?`${iconColor}12`:T.surface2, border:`1px solid ${iconColor?iconColor+'28':T.border}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
        <Icon size={15} color={ic} strokeWidth={1.5}/>
      </div>
      <h3 style={{ fontSize:14, fontWeight:700, color:T.text, letterSpacing:'-0.01em', marginBottom:7 }}>{title}</h3>
      <p style={{ fontSize:12, color:T.text2, lineHeight:1.65 }}>{desc}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Icon
// ─────────────────────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

// ─────────────────────────────────────────────────────────────────────────────
// Auth modal
// ─────────────────────────────────────────────────────────────────────────────
function AuthModal({ mode, onClose, onSwitch, T }: { mode:'signin'|'signup'; onClose:()=>void; onSwitch:()=>void; T:typeof DARK_T }) {
  const router = useRouter()
  const [email,setEmail]=useState(''); const [pwd,setPwd]=useState(''); const [showPwd,setShow]=useState(false)
  const [loading,setLoad]=useState(false); const [gLoad,setGLoad]=useState(false)
  const [error,setError]=useState(''); const [done,setDone]=useState(false)
  const isSignIn = mode==='signin'

  const signInWithGoogle = async () => {
    setGLoad(true); setError('')
    try {
      const { error:e } = await createSupabaseBrowserClient().auth.signInWithOAuth({ provider:'google', options:{ redirectTo:`${window.location.origin}/api/auth/callback` } })
      if (e) { setError(e.message); setGLoad(false) }
    } catch(err) { setError(err instanceof Error?err.message:'Connection error'); setGLoad(false) }
  }
  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault(); if(!email.trim()||!pwd) return
    setLoad(true); setError('')
    const sb = createSupabaseBrowserClient()
    if (isSignIn) {
      const { error:err } = await sb.auth.signInWithPassword({ email:email.trim(), password:pwd })
      if (err) { setError(err.message==='Invalid login credentials'?'Incorrect email or password. Try Continue with Google if you signed up that way.':err.message); setLoad(false) }
      else { router.push('/dashboard'); router.refresh() }
    } else {
      const { error:err } = await sb.auth.signUp({ email:email.trim(), password:pwd })
      if (err) { setError(err.message); setLoad(false) } else { setDone(true); setLoad(false) }
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' }}/>
      <div style={{ position:'relative', zIndex:1, background:T.modalBg, border:`1px solid ${T.border}`, borderRadius:20, padding:32, width:'100%', maxWidth:420, margin:'0 24px', boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:T.secBg, border:`1px solid ${T.secBorder}`, borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.text3 }}><X size={15}/></button>
        {done ? (
          <div style={{ textAlign:'center', padding:'16px 0' }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}><CheckCircle size={22} color="#22C55E"/></div>
            <h2 style={{ fontSize:20, fontWeight:700, color:T.text, marginBottom:10, letterSpacing:'-0.02em' }}>Check your email</h2>
            <p style={{ fontSize:14, color:T.text3, lineHeight:1.6 }}>Confirmation link sent to <strong style={{color:T.text2}}>{email}</strong>.<br/>Click it to activate your account.</p>
            <button onClick={onClose} style={{ marginTop:24, padding:'9px 20px', borderRadius:9, background:T.btnBg, color:T.btnText, border:'none', fontSize:14, fontWeight:600, cursor:'pointer' }}>Got it</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom:24 }}>
              <p style={{ fontSize:11, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>AgentHub</p>
              <h2 style={{ fontFamily:'var(--font-playfair,"Playfair Display",Georgia,serif)', fontSize:26, fontWeight:700, color:T.text, letterSpacing:'-0.02em', lineHeight:1.15, marginBottom:8 }}>{isSignIn?'Welcome back.':'Create your account.'}</h2>
              <p style={{ fontSize:13, color:T.text3, lineHeight:1.6 }}>{isSignIn?'Sign in to access your agents.':'Free to start. Bring your own API keys.'}</p>
            </div>
            <button onClick={signInWithGoogle} disabled={gLoad||loading}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'11px 20px', borderRadius:10, border:`1px solid ${T.modalGoogleBorder}`, background:T.modalGoogleBg, color:T.text, fontSize:14, fontWeight:500, cursor:gLoad?'not-allowed':'pointer', marginBottom:20, transition:'all 0.15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.modalGoogleHoverBorder; e.currentTarget.style.background=T.modalGoogleHoverBg }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.modalGoogleBorder; e.currentTarget.style.background=T.modalGoogleBg }}>
              {gLoad?<Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/>:<GoogleIcon/>}
              {gLoad?'Redirecting...':'Continue with Google'}
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
              <div style={{ flex:1, height:1, background:T.modalDivider }}/><span style={{ fontSize:12, color:T.text3 }}>or with email</span><div style={{ flex:1, height:1, background:T.modalDivider }}/>
            </div>
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ position:'relative' }}>
                <Mail size={13} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:T.text3, pointerEvents:'none' }}/>
                <input type="email" placeholder="Email address" value={email} required onChange={e=>{ setEmail(e.target.value); setError('') }} className="modal-input"
                  style={{ width:'100%', padding:'10px 12px 10px 36px', borderRadius:8, border:`1px solid ${T.border}`, background:T.modalInputBg, color:T.text, fontSize:14, outline:'none', boxSizing:'border-box' }}/>
              </div>
              <div style={{ position:'relative' }}>
                <Lock size={13} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:T.text3, pointerEvents:'none' }}/>
                <input type={showPwd?'text':'password'} placeholder="Password" value={pwd} required onChange={e=>{ setPwd(e.target.value); setError('') }} className="modal-input"
                  style={{ width:'100%', padding:'10px 38px 10px 36px', borderRadius:8, border:`1px solid ${T.border}`, background:T.modalInputBg, color:T.text, fontSize:14, outline:'none', boxSizing:'border-box' }}/>
                <button type="button" onClick={()=>setShow(v=>!v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:T.text3, display:'flex', padding:0 }}>
                  {showPwd?<EyeOff size={13}/>:<Eye size={13}/>}
                </button>
              </div>
              {error&&<div style={{ fontSize:12, color:T.errColor, padding:'8px 12px', borderRadius:8, background:T.errBg, border:`1px solid ${T.errBorder}`, lineHeight:1.5 }}>{error}</div>}
              <button type="submit" disabled={loading||gLoad||!email||!pwd}
                style={{ width:'100%', padding:'11px', borderRadius:10, border:'none', background:T.btnBg, color:T.btnText, fontSize:14, fontWeight:600, cursor:loading||!email||!pwd?'not-allowed':'pointer', opacity:loading||!email||!pwd?0.5:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:4 }}>
                {loading&&<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>}
                {loading?(isSignIn?'Signing in...':'Creating account...'):(isSignIn?'Sign in':'Create account')}
              </button>
            </form>
            <p style={{ fontSize:13, color:T.text3, textAlign:'center', marginTop:20 }}>
              {isSignIn?"Don't have an account? ":"Already have an account? "}
              <button onClick={onSwitch} style={{ color:T.accentLt, fontWeight:600, background:'none', border:'none', cursor:'pointer', fontSize:13 }}>{isSignIn?'Create one':'Sign in'}</button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Code snippets
// ─────────────────────────────────────────────────────────────────────────────
const CODE:Record<CodeTab,React.ReactNode> = {
  JavaScript:(
    <pre style={{ margin:0, padding:'22px', fontSize:12, fontFamily:'monospace', lineHeight:1.85, overflowX:'auto', color:DC.text }}>
      <span style={{color:DC.text3}}>// JavaScript (fetch)</span>{'\n'}
      <span style={{color:'#60A5FA'}}>const</span>{' res = '}<span style={{color:'#60A5FA'}}>await</span>{' fetch('}<span style={{color:'#4ADE80'}}>{'"https://app.com/api/agents/'}</span><span style={{color:'#FB923C'}}>ID</span><span style={{color:'#4ADE80'}}>{'/run"'}</span>{', {'}{'\n'}
      {'  method:'}<span style={{color:'#4ADE80'}}>"POST"</span>{','}{'\n'}
      {'  headers:{ '}<span style={{color:'#4ADE80'}}>"X-AgentHub-Key"</span>{':'}<span style={{color:'#4ADE80'}}>"ahk_xxxx"</span>{' },'}{'\n'}
      {'  body: JSON.stringify({ message:'}<span style={{color:'#4ADE80'}}>"Summarise this..."</span>{' })'}{'\n'}
      {'});\n'}<span style={{color:'#60A5FA'}}>const</span>{' data = '}<span style={{color:'#60A5FA'}}>await</span>{' res.json();'}{'\n'}
      <span style={{color:DC.text3}}>{`// { status:"completed", tokens:342 }`}</span>
    </pre>
  ),
  Python:(
    <pre style={{ margin:0, padding:'22px', fontSize:12, fontFamily:'monospace', lineHeight:1.85, overflowX:'auto', color:DC.text }}>
      <span style={{color:DC.text3}}># Python (requests)</span>{'\n'}
      <span style={{color:'#60A5FA'}}>import</span>{' requests\n\n'}
      {'r = requests.post('}{'\n'}
      {'    '}<span style={{color:'#4ADE80'}}>{'"https://app.com/api/agents/'}</span><span style={{color:'#FB923C'}}>ID</span><span style={{color:'#4ADE80'}}>{'/run"'}</span>{','}{'\n'}
      {'    headers={'}<span style={{color:'#4ADE80'}}>"X-AgentHub-Key"</span>{':'}<span style={{color:'#4ADE80'}}>"ahk_xxxx"</span>{'}},'}{'\n'}
      {'    json={"message":'}<span style={{color:'#4ADE80'}}>"Summarise this..."</span>{'}'}{'\n'}
      {')\nprint(r.json())\n'}
      <span style={{color:DC.text3}}>{`# { "status":"completed", "tokens":342 }`}</span>
    </pre>
  ),
  cURL:(
    <pre style={{ margin:0, padding:'22px', fontSize:12, fontFamily:'monospace', lineHeight:1.85, overflowX:'auto', color:DC.text }}>
      <span style={{color:DC.text3}}># cURL</span>{'\n'}
      {'curl -X POST '}<span style={{color:'#4ADE80'}}>https://app.com</span>{'/api/agents/'}<span style={{color:'#FB923C'}}>ID</span>{'/run \\'}{'\n'}
      {'  -H '}<span style={{color:'#4ADE80'}}>{'"X-AgentHub-Key: ahk_xxxx"'}</span>{' \\'}{'\n'}
      {'  -H '}<span style={{color:'#4ADE80'}}>{'"Content-Type: application/json"'}</span>{' \\'}{'\n'}
      {"  -d '"}<span style={{color:'#60A5FA'}}>{`{"message":"Summarise..."}`}</span>{"'\n\n"}
      <span style={{color:DC.text3}}>{`# { "status":"completed", "tokens":342 }`}</span>
    </pre>
  ),
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const [isDark,setIsDark]       = useState(true)
  const [authModal,setAuthModal] = useState<null|'signin'|'signup'>(null)
  const [isLoggedIn,setIsLoggedIn] = useState(false)
  const [codeTab,setCodeTab]     = useState<CodeTab>('JavaScript')
  const [cName,setCName]         = useState('')
  const [cEmail,setCEmail]       = useState('')
  const [cMsg,setCMsg]           = useState('')
  const [cSending,setCSending]   = useState(false)
  const [cSent,setCSent]         = useState(false)
  const [cError,setCError]       = useState('')
  const mouseRef   = useRef({ x: -9999, y: -9999 })
  const animRef    = useRef(0)
  const isDarkRef  = useRef(isDark)
  const T = isDark ? DARK_T : LIGHT_T

  useEffect(()=>{
    createSupabaseBrowserClient().auth.getSession().then(({ data:{ session } })=>{
      if (session) setIsLoggedIn(true)
    })
  },[])
  useEffect(()=>{
    const s=localStorage.getItem('agenthub-landing-dark')
    if(s!==null) setIsDark(s==='true')
    else setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
  },[])
  const toggleTheme = () => setIsDark(d=>{ localStorage.setItem('agenthub-landing-dark',String(!d)); return !d })
  const openAuth = (mode:'signin'|'signup') => { if (isLoggedIn) { router.push('/dashboard') } else { setAuthModal(mode) } }
  useEffect(()=>{ const h=(e:KeyboardEvent)=>{ if(e.key==='Escape') setAuthModal(null) }; document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h) },[])
  useEffect(()=>{ document.body.style.background = T.pageBg; isDarkRef.current = isDark },[isDark])
  useEffect(()=>{
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;'
    document.body.prepend(canvas)
    const ctx = canvas.getContext('2d')!

    // Each particle has a fixed home it always springs back to
    type P = { ox:number; oy:number; x:number; y:number; vx:number; vy:number }
    let particles: P[] = []

    const seed = () => {
      particles = Array.from({ length: 60 }, () => {
        const ox = Math.random() * canvas.width
        const oy = Math.random() * canvas.height
        return { ox, oy, x:ox, y:oy, vx:0, vy:0 }
      })
    }
    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      seed()
    }
    resize()
    window.addEventListener('resize', resize)

    const ATTRACT_R = 140   // cursor attracts particles within this radius
    const DAMPING   = 0.98  // very gentle damping — particles keep drifting
    const PULL      = 0.18  // cursor pull strength

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const dark  = isDarkRef.current
      const rgb   = dark ? '255,255,255' : '0,0,0'
      // Dark: --dark-text2 (#A1A1AA) feel — bright enough to see on #050505
      // Light: barely-there gray on white — texture only
      const dotA  = dark ? 0.5  : 0.13
      const lineA = dark ? 0.03 : 0.08
      const mouse = mouseRef.current

      for (const p of particles) {
        // cursor pull
        if (mouse.x !== -9999) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y
          const d  = Math.sqrt(dx*dx + dy*dy)
          if (d < ATTRACT_R && d > 1) {
            p.vx += (dx / d) * PULL
            p.vy += (dy / d) * PULL
          }
        }

        // random drift — always wandering
        p.vx += (Math.random() - 0.5) * 0.02
        p.vy += (Math.random() - 0.5) * 0.02

        // speed cap so they don't fly off
        const spd = Math.sqrt(p.vx*p.vx + p.vy*p.vy)
        if (spd > 1.5) { p.vx = p.vx/spd*1.5; p.vy = p.vy/spd*1.5 }

        p.vx *= DAMPING
        p.vy *= DAMPING
        p.x  += p.vx
        p.y  += p.vy

        // wrap edges — particles reappear on the other side
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width)  p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        // draw dot
        ctx.beginPath()
        ctx.arc(p.x, p.y, dark ? 0.85 : 1.3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb},${dotA})`
        ctx.fill()

        // line to cursor when attracted
        if (mouse.x !== -9999) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y
          const d  = Math.sqrt(dx*dx + dy*dy)
          if (d < ATTRACT_R) {
            ctx.strokeStyle = `rgba(${rgb},${(1 - d / ATTRACT_R) * lineA})`
            ctx.lineWidth   = 0.7
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke()
          }
        }
      }

      animRef.current = requestAnimationFrame(draw)
    }
    draw()

    const onMove  = (e:MouseEvent) => { mouseRef.current = { x:e.clientX, y:e.clientY } }
    const onLeave = () => { mouseRef.current = { x:-9999, y:-9999 } }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(animRef.current)
      canvas.remove()
    }
  },[])

  const sendContact = async (e:React.FormEvent) => {
    e.preventDefault(); if(!cEmail.trim()||!cMsg.trim()) return
    setCSending(true); setCError('')
    try {
      await fetch('/api/contact',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:cName, email:cEmail, message:cMsg }) })
      setCSent(true)
    } catch { window.location.href=`mailto:hello@agenthub.dev?subject=AgentHub from ${cName}&body=${encodeURIComponent(cMsg)}`; setCSent(true) }
    finally { setCSending(false) }
  }

  const navA = (label:string, href:string) => (
    <a key={label} href={href}
      style={{ fontSize:13, padding:'6px 10px', color:T.text3, textDecoration:'none', fontWeight:500, borderRadius:7, transition:'color 0.15s' }}
      onMouseEnter={e=>(e.currentTarget.style.color=T.text2)}
      onMouseLeave={e=>(e.currentTarget.style.color=T.text3)}>
      {label}
    </a>
  )

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "AgentHub",
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "Web",
        "description": "AgentHub is a visual AI agent builder that lets engineers build, deploy, and integrate AI agents without writing boilerplate. Connect AI Step, Action, Branch, Switch, Loop, Fork, Join, Human Review, and Ask User nodes on a drag-and-drop canvas. Every agent is automatically exposed as a live REST API.",
        "featureList": [
          "Visual drag-and-drop AI agent canvas",
          "AI Step nodes for calling any LLM (OpenAI, Gemini, Claude, Groq, Ollama)",
          "Action nodes for HTTP calls, web search, web scraping, code execution, and datatables",
          "Branch and Switch nodes for conditional routing",
          "Loop nodes for iterative refinement",
          "Fork and Join nodes for parallel execution",
          "Human Review nodes for human-in-the-loop approval",
          "Ask User nodes for mid-run clarification",
          "Automatic REST API deployment for every agent",
          "Real-time SSE streaming",
          "Execution trace and waterfall chart per run",
          "Memory configs for conversation history",
          "Guardrails for input/output safety",
          "Prompts library for reusable system prompts",
          "Datatables for structured data import/export",
          "Orchestrator for smart clarify routing",
          "API key management",
          "Multi-provider LLM support",
        ],
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "url": "https://agenthub.nik10x.com",
      },
      {
        "@type": "WebSite",
        "name": "AgentHub",
        "url": "https://agenthub.nik10x.com",
        "description": "Visual AI agent builder. Build multi-step AI pipelines on a canvas and deploy them as REST APIs.",
        "potentialAction": { "@type": "SearchAction", "target": "https://agenthub.nik10x.com/docs" },
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": "What is AgentHub?", "acceptedAnswer": { "@type": "Answer", "text": "AgentHub is a visual AI agent builder. You connect nodes on a canvas — AI Step (LLM), Action (tools), Branch, Switch, Loop, Fork, Join, Human Review, Ask User — and every agent is automatically deployed as a REST API." } },
          { "@type": "Question", "name": "What LLM providers does AgentHub support?", "acceptedAnswer": { "@type": "Answer", "text": "AgentHub supports Google Gemini, OpenAI, Anthropic Claude, Groq, Ollama, and any OpenAI-compatible API endpoint including LM Studio and Mistral." } },
          { "@type": "Question", "name": "How do I call an AgentHub agent from my application?", "acceptedAnswer": { "@type": "Answer", "text": "Every agent is available as a REST API. Send a POST request to /api/agents/{agentId}/run with your message and X-AgentHub-Key header. The response includes the output, token count, and execution trace." } },
          { "@type": "Question", "name": "What is a Human Review node?", "acceptedAnswer": { "@type": "Answer", "text": "A Human Review (HITL) node pauses the agent pipeline and waits for a human to approve, request revision, or reject before the agent continues. Useful for content approval, compliance checks, or any irreversible action." } },
          { "@type": "Question", "name": "Can agents run in parallel?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Fork nodes split execution into multiple parallel branches that all run simultaneously. A Join node collects the results and merges them as an array, object, or concatenated text." } },
        ],
      },
    ],
  }

  return (
    <div style={{ minHeight:'100vh', background:'transparent', color:T.text, fontFamily:'var(--font-sans,Inter,sans-serif)', transition:'color 0.3s' }}>

      {/* JSON-LD structured data — invisible to users, readable by crawlers */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Visually hidden semantic content block — for crawlers */}
      <div aria-hidden="false" style={{ position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0,0,0,0)', whiteSpace:'nowrap' }}>
        <h1>AgentHub — Visual AI Agent Builder</h1>
        <p>Build multi-step AI agent pipelines on a visual drag-and-drop canvas. Connect AI Step nodes (LLMs), Action nodes (tools, web search, code execution), Branch and Switch nodes for routing, Loop nodes for iteration, Fork and Join nodes for parallel execution, Human Review nodes for human-in-the-loop approval, and Ask User nodes for mid-run clarification. Deploy every agent as a live REST API with one click.</p>
        <h2>Node Types</h2>
        <ul>
          <li>AI Step: call any language model (OpenAI GPT-4o, Google Gemini, Anthropic Claude, Groq Llama, Ollama) with a system prompt and conversation memory.</li>
          <li>Action: run tools including HTTP API calls, web search (DuckDuckGo, Tavily, Serper), web scraping (Jina Reader), Python/JavaScript/Bash code execution, and datatable operations.</li>
          <li>Branch: binary yes/no conditional routing evaluated by an AI model.</li>
          <li>Switch: multi-way routing for 3 or more branches using LLM classification.</li>
          <li>Loop: repeat a section of the pipeline until an exit condition is met or a maximum iteration count is reached.</li>
          <li>Fork and Join: split execution into parallel branches that run simultaneously, then merge results.</li>
          <li>Human Review: pause the pipeline for human approval, revision request, or rejection before continuing.</li>
          <li>Ask User: pause and ask the user a clarifying question, then continue with their answer.</li>
          <li>Transform: pass data through with optional template transformations.</li>
          <li>Start and End: required entry and exit points for every agent pipeline.</li>
        </ul>
        <h2>Key Features</h2>
        <ul>
          <li>Visual canvas: drag, drop, and connect nodes to build AI pipelines.</li>
          <li>REST API deployment: every agent is immediately available as a POST endpoint.</li>
          <li>Real-time streaming: SSE streaming with token-by-token output.</li>
          <li>Execution trace: waterfall chart and step-by-step trace for every run.</li>
          <li>Memory: sliding window, full history, or AI-summarized conversation memory.</li>
          <li>Guardrails: input and output safety rules with keyword and pattern matching.</li>
          <li>Prompts library: reusable system prompts with template variable support.</li>
          <li>Datatables: structured data tables for import (LLM context) and export (structured output).</li>
          <li>Orchestrator: smart clarify routing that classifies user messages during agent pauses.</li>
          <li>Multi-provider LLM: OpenAI, Google Gemini, Anthropic, Groq, Ollama, and any OpenAI-compatible endpoint.</li>
        </ul>
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav style={{ position:'sticky', top:0, zIndex:100, background:T.navBg, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:`1px solid ${T.border}` }}>
        <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 40px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Zap size={20} color="#2563EB" strokeWidth={2.5}/>
            <div>
              <div style={{ fontWeight:700, fontSize:15, color:T.text, letterSpacing:'-0.02em', lineHeight:1 }}>AgentHub</div>
              <div style={{ fontSize:8.5, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.12em', marginTop:3 }}>Built for engineers who ship</div>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:2 }}>
            {/* Why? */}
            <a href="#lp-why"
              style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, padding:'5px 10px', borderRadius:8, color:T.text3, textDecoration:'none', fontWeight:500, background:'transparent', transition:'background 0.15s,color 0.15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.background=T.secBg; e.currentTarget.style.color=T.text2 }}
              onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color=T.text3 }}>
              <HelpCircle size={13} strokeWidth={1.8}/> Why?
            </a>
            {/* Contact */}
            <a href="#lp-contact"
              style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, padding:'5px 10px', borderRadius:8, color:T.text3, textDecoration:'none', fontWeight:500, background:'transparent', transition:'background 0.15s,color 0.15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.background=T.secBg; e.currentTarget.style.color=T.text2 }}
              onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color=T.text3 }}>
              Contact
            </a>
            {/* Divider */}
            <div style={{ width:1, height:18, background:T.border, margin:'0 6px' }}/>
            {/* Theme toggle */}
            <button onClick={toggleTheme} title={isDark?'Light mode':'Dark mode'}
              style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:32, height:32, borderRadius:8, background:'transparent', border:'none', cursor:'pointer', color:T.text3, transition:'background 0.15s,color 0.15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.background=T.secBg; e.currentTarget.style.color=T.text2 }}
              onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color=T.text3 }}>
              {isDark?<Sun size={15}/>:<Moon size={15}/>}
            </button>
            {/* Get started */}
            <button onClick={()=>openAuth('signup')}
              style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:13, padding:'7px 16px', borderRadius:9, fontWeight:600, background:T.btnBg, color:T.btnText, border:'none', cursor:'pointer', transition:'transform 0.15s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform='translateY(-1px)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform='translateY(0)'}}>
              <Zap size={12} strokeWidth={2.5}/> {isLoggedIn ? 'Go to dashboard' : 'Get started'}
            </button>
            {/* Sign in — hidden when logged in */}
            {!isLoggedIn && (
              <button onClick={()=>setAuthModal('signin')}
                style={{ fontSize:13, padding:'7px 16px', borderRadius:9, fontWeight:500, color:T.secText, background:'none', border:`1px solid ${T.border}`, cursor:'pointer', transition:'all 0.15s' }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.borderHi; e.currentTarget.style.color=T.text }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.secText }}>
                Sign in
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section id="lp-hero" style={{ maxWidth:1400, margin:'0 auto', padding:'72px 40px 60px', position:'relative', zIndex:1 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:72, alignItems:'center' }}>
          <div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:28 }}>
              <SonarDot color="#22C55E" size={8}/>
              <span style={{ fontSize:11, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.1em' }}>
                Visual AI Agent Builder · Bring Your Own API Keys
              </span>
            </div>
            <h1 style={{ fontFamily:'var(--font-playfair,"Playfair Display",Georgia,serif)', fontSize:'clamp(42px,4.2vw,64px)', fontWeight:700, lineHeight:1.07, letterSpacing:'-0.02em', color:T.text, marginBottom:24 }}>
              Build AI agents<br/>visually.{' '}<em style={{ fontStyle:'italic', color:T.text2 }}>Deploy as<br/>REST APIs.</em>
            </h1>
            <p style={{ fontSize:15, lineHeight:1.7, color:T.text2, maxWidth:480, marginBottom:24 }}>
              Production-grade AI agent infrastructure. Orchestrate LLMs, tools, and MCP servers with parallel execution, conditional routing, memory, and human oversight. Every agent ships as a REST API.
            </p>
            {/* Live feature badges */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:28 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'4px 13px', borderRadius:20, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)' }}>
                <SonarDot color="#22C55E" size={5}/>
                <span style={{ fontSize:11, fontWeight:600, color:'#22C55E' }}>Build via Chat · now live</span>
              </div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'4px 13px', borderRadius:20, background:T.surface2, border:`1px solid ${T.border}` }}>
                <span style={{ fontSize:11, fontWeight:600, color:T.text3 }}>Multi-agent systems · built in</span>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28 }}>
              <a href="/docs" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 22px', borderRadius:10, fontWeight:600, fontSize:14, background:T.btnBg, color:T.btnText, textDecoration:'none', boxShadow:'0 0 32px rgba(37,99,235,0.2)', transition:'transform 0.2s ease,box-shadow 0.2s ease' }}
                onMouseEnter={e=>{ const el=e.currentTarget as HTMLElement; el.style.transform='translateY(-2px)'; el.style.boxShadow='0 0 50px rgba(37,99,235,0.4)' }}
                onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.transform='translateY(0)'; el.style.boxShadow='0 0 32px rgba(37,99,235,0.2)' }}>
                <BookOpen size={14}/> View Docs
              </a>
              <a href="#lp-contact" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 22px', borderRadius:10, fontWeight:500, fontSize:14, color:T.secText, background:T.secBg, border:`1px solid ${T.secBorder}`, textDecoration:'none', transition:'all 0.15s' }}
                onMouseEnter={e=>{ e.currentTarget.style.background=T.secHoverBg; e.currentTarget.style.borderColor=T.secHoverBorder }}
                onMouseLeave={e=>{ e.currentTarget.style.background=T.secBg; e.currentTarget.style.borderColor=T.secBorder }}>
                <MessageSquare size={14}/> Contact Us
              </a>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
              {['Free to start','No credit card','Your own API keys','No vendor lock-in'].map(item=>(
                <div key={item} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:T.text3 }}>
                  <CheckCircle size={11} color="#22C55E"/>{item}
                </div>
              ))}
            </div>
          </div>
          <WorkflowPanel/>
        </div>
      </section>

      {/* ── Provider marquee ────────────────────────────────────────── */}
      <div style={{ borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, background:T.surface, padding:'20px 0', overflow:'hidden', position:'relative', zIndex:1 }}>
        <p style={{ textAlign:'center', fontSize:10, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:14 }}>
          Works with any LLM. Bring your own API keys.
        </p>
        <div style={{ display:'flex', gap:9, animation:'marquee 28s linear infinite', width:'max-content', paddingLeft:40 }}>
          {[...PROVIDERS,...PROVIDERS,...PROVIDERS].map((p,i)=>{ const col=PCOLORS[p]||'#71717A'; return <span key={i} style={{ fontSize:12, fontWeight:500, padding:'6px 18px', borderRadius:24, background:`${col}10`, border:`1px solid ${col}25`, color:col, whiteSpace:'nowrap', flexShrink:0 }}>{p}</span> })}
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section id="lp-features" style={{ maxWidth:1400, margin:'0 auto', padding:'90px 40px', position:'relative', zIndex:1 }}>
        <div style={{ marginBottom:44 }}>
          <p style={{ fontSize:11, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>Everything you need</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'start', marginBottom:24 }}>
            <h2 style={{ fontFamily:'var(--font-playfair,"Playfair Display",Georgia,serif)', fontSize:'clamp(30px,3vw,44px)', fontWeight:700, color:T.text, letterSpacing:'-0.02em', lineHeight:1.1, margin:0 }}>
              Every building block<br/><em style={{ fontStyle:'italic', color:T.text2 }}>for serious AI systems.</em>
            </h2>
            <p style={{ fontSize:15, color:T.text2, lineHeight:1.7, margin:0 }}>
              AgentHub gives you the primitives to build production-grade AI workflows without writing orchestration logic from scratch.
            </p>
          </div>
          <div style={{ display:'flex', flexWrap:'nowrap', gap:7, overflowX:'auto' }}>
            {FEATURE_CHIPS.map(chip=>(<span key={chip} style={{ fontSize:11, fontWeight:500, padding:'4px 12px', borderRadius:20, background:T.surface2, color:T.text3, whiteSpace:'nowrap', flexShrink:0 }}>{chip}</span>))}
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:14, marginBottom:14 }}>
          <FCardLg T={T} icon={Code2} iconColor="#7C3AED" title="Visual DAG Builder" desc="Build complex multi-step AI pipelines by connecting nodes on a drag-and-drop canvas. Each node does exactly one thing, making agents easy to debug, extend, and understand." tag="Core"/>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <FCardSm T={T} icon={Globe}     iconColor="#2563EB" title="Instant REST API"   desc="Every agent auto-gets a live POST endpoint. No deployment steps. Call from anywhere in seconds."/>
            <FCardSm T={T} icon={Cpu}       iconColor="#0891B2" title="Any LLM Provider"  desc="Bring your own keys for OpenAI, Gemini, Claude, Groq, Mistral, or any compatible endpoint."/>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:14 }}>
          <FCardSm T={T} icon={GitBranch} iconColor="#16A34A" title="Conditional Routing" desc="Branch and Switch nodes route based on what the model finds at runtime."/>
          <FCardSm T={T} icon={RefreshCw} iconColor="#EA580C" title="Loops + Parallel"    desc="Loop until quality passes. Fork/Join runs branches simultaneously."/>
          <FCardSm T={T} icon={UserCheck} iconColor="#DB2777" title="Human-in-the-Loop"   desc="Human Review nodes pause for human approval before the agent continues."/>
          <FCardSm T={T} icon={Shield}    iconColor="#9333EA" title="Guardrails"          desc="Block bad input and filter unsafe output per-node, not globally."/>
        </div>
      </section>

      {/* ── Code section ────────────────────────────────────────────── */}
      <section id="lp-api" style={{ background:T.surface, borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1400, margin:'0 auto', padding:'90px 40px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:72, alignItems:'start' }}>
          <div style={{ paddingTop:8 }}>
            <p style={{ fontSize:11, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:18 }}>Build here. Integrate anywhere.</p>
            <h2 style={{ fontFamily:'var(--font-playfair,"Playfair Display",Georgia,serif)', fontSize:'clamp(24px,2.6vw,38px)', fontWeight:700, color:T.text, letterSpacing:'-0.02em', lineHeight:1.1, marginBottom:18 }}>
              Build your agent once.<br/>Call it from any system.
            </h2>
            <p style={{ fontSize:15, color:T.text2, lineHeight:1.7, marginBottom:32 }}>
              Every agent you build instantly becomes a REST endpoint. Drop it into any product, backend service, or automation pipeline. JavaScript, Python, cURL, or any HTTP client. One POST call is all it takes.
            </p>
            <button onClick={()=>openAuth('signup')} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 20px', borderRadius:10, fontWeight:600, fontSize:14, background:T.btnBg, color:T.btnText, border:'none', cursor:'pointer', transition:'transform 0.15s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform='translateY(-2px)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform='translateY(0)'}}>
              Get your API key <ChevronRight size={14}/>
            </button>
          </div>
          <div style={{ background:DC.bg, border:`1px solid ${DC.border}`, borderRadius:16, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', borderBottom:`1px solid ${DC.border}` }}>
              {CODE_TABS.map(tab=>(
                <button key={tab} onClick={()=>setCodeTab(tab)}
                  style={{ padding:'9px 18px', fontSize:11, fontWeight:500, background:'none', border:'none', cursor:'pointer', color:tab===codeTab?'#FFFFFF':DC.text3, borderBottom:tab===codeTab?'2px solid #FFFFFF':'2px solid transparent', transition:'color 0.15s', marginBottom:-1 }}>
                  {tab}
                </button>
              ))}
              <div style={{ flex:1 }}/>
              <div style={{ display:'flex', gap:5, padding:'0 14px' }}>
                <span style={{width:9,height:9,borderRadius:'50%',background:'#FF5F57'}}/><span style={{width:9,height:9,borderRadius:'50%',background:'#FEBC2E'}}/><span style={{width:9,height:9,borderRadius:'50%',background:'#28C840'}}/>
              </div>
            </div>
            {CODE[codeTab]}
          </div>
        </div>
      </section>

      {/* ── How it works + Contact (merged 2-col) ───────────────────── */}
      <section id="lp-how" style={{ maxWidth:1400, margin:'0 auto', padding:'90px 40px', position:'relative', zIndex:1 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'start' }}>

          {/* Left: numbered steps */}
          <div>
            <p style={{ fontSize:11, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:18 }}>How it works</p>
            <h2 style={{ fontFamily:'var(--font-playfair,"Playfair Display",Georgia,serif)', fontSize:'clamp(26px,2.8vw,40px)', fontWeight:700, color:T.text, letterSpacing:'-0.02em', lineHeight:1.1, marginBottom:48 }}>
              Three steps from idea<br/>to running API.
            </h2>
            <div style={{ display:'flex', flexDirection:'column' }}>
              {[
                { n:'01', title:'Design on the canvas', desc:'Drag nodes onto the canvas and connect them. Each node does one thing: call an LLM, run a tool, check a condition, or wait for approval.' },
                { n:'02', title:'Pick any LLM',         desc:'Configure your own API keys for OpenAI, Gemini, Claude, Groq, Mistral, or any OpenAI-compatible endpoint including self-hosted Ollama.' },
                { n:'03', title:'Call it instantly',    desc:'Every agent is immediately available as a REST API. One POST request and your agent runs. Tools fire, LLMs respond, results return.' },
              ].map((step,i,arr)=>(
                <div key={step.n} style={{ display:'flex', gap:20 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:32, flexShrink:0 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', border:`1.5px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center', background:T.surface2, flexShrink:0, transition:'border-color 0.2s,background 0.2s' }}>
                      <span style={{ fontSize:10, fontWeight:700, color:T.text3, fontFamily:'monospace' }}>{step.n}</span>
                    </div>
                    {i < arr.length-1 && <div style={{ width:1, flex:1, background:T.border, margin:'8px 0', minHeight:28 }}/>}
                  </div>
                  <div style={{ paddingBottom: i < arr.length-1 ? 36 : 0, paddingTop:6 }}>
                    <h3 style={{ fontSize:16, fontWeight:700, color:T.text, marginBottom:8, letterSpacing:'-0.01em' }}>{step.title}</h3>
                    <p style={{ fontSize:13, color:T.text2, lineHeight:1.7 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: compact contact form */}
          <div id="lp-contact" style={{ position:'sticky', top:84 }}>
            <p style={{ fontSize:11, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:18 }}>Get in touch</p>
            <h2 style={{ fontFamily:'var(--font-playfair,"Playfair Display",Georgia,serif)', fontSize:'clamp(22px,2.2vw,32px)', fontWeight:700, color:T.text, letterSpacing:'-0.02em', marginBottom:10 }}>
              Have a question or<br/>feature request?
            </h2>
            <p style={{ fontSize:14, color:T.text2, lineHeight:1.65, marginBottom:28 }}>
              Drop us a line. We read every message and respond within 24 hours.
            </p>
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:'24px' }}>
              {cSent ? (
                <div style={{ textAlign:'center', padding:'20px 0' }}>
                  <CheckCircle size={32} color="#22C55E" style={{ margin:'0 auto 16px', display:'block' }}/>
                  <h3 style={{ fontSize:17, fontWeight:700, color:T.text, marginBottom:6 }}>Message sent!</h3>
                  <p style={{ fontSize:13, color:T.text2 }}>We will get back to you within 24 hours.</p>
                  <button onClick={()=>{ setCSent(false); setCName(''); setCEmail(''); setCMsg('') }}
                    style={{ marginTop:16, fontSize:12, color:T.accentLt, background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                    Send another
                  </button>
                </div>
              ) : (
                <form onSubmit={sendContact} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={{ fontSize:10, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Name</label>
                      <input type="text" placeholder="Your name" value={cName} onChange={e=>setCName(e.target.value)}
                        className="lp-input" style={{ width:'100%', padding:'9px 11px', borderRadius:8, border:`1px solid ${T.inputBorder}`, background:T.inputBg, color:T.text, fontSize:13, outline:'none', boxSizing:'border-box' }}/>
                    </div>
                    <div>
                      <label style={{ fontSize:10, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Email <span style={{color:T.errColor}}>*</span></label>
                      <input type="email" placeholder="you@example.com" value={cEmail} required onChange={e=>{ setCEmail(e.target.value); setCError('') }}
                        className="lp-input" style={{ width:'100%', padding:'9px 11px', borderRadius:8, border:`1px solid ${T.inputBorder}`, background:T.inputBg, color:T.text, fontSize:13, outline:'none', boxSizing:'border-box' }}/>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Message <span style={{color:T.errColor}}>*</span></label>
                    <textarea placeholder="Feature request, bug report, or just say hello." value={cMsg} onChange={e=>{ setCMsg(e.target.value); setCError('') }} required rows={4}
                      className="lp-input" style={{ width:'100%', padding:'9px 11px', borderRadius:8, border:`1px solid ${T.inputBorder}`, background:T.inputBg, color:T.text, fontSize:13, outline:'none', boxSizing:'border-box', resize:'vertical', lineHeight:1.6, fontFamily:'inherit' }}/>
                  </div>
                  {cError&&<div style={{ fontSize:11, color:T.errColor, padding:'7px 11px', borderRadius:8, background:T.errBg, border:`1px solid ${T.errBorder}` }}>{cError}</div>}
                  <button type="submit" disabled={cSending||!cEmail||!cMsg}
                    style={{ width:'100%', padding:'11px', borderRadius:10, border:'none', background:T.btnBg, color:T.btnText, fontSize:13, fontWeight:600, cursor:cSending||!cEmail||!cMsg?'not-allowed':'pointer', opacity:cSending||!cEmail||!cMsg?0.5:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, transition:'transform 0.15s,opacity 0.15s' }}>
                    {cSending?<Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>:<MessageSquare size={14}/>}
                    {cSending?'Sending...':'Send message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Observability ───────────────────────────────────────────── */}
      <section style={{ maxWidth:1400, margin:'0 auto', padding:'90px 40px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:72, alignItems:'center', position:'relative', zIndex:1 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 }}>
          {[
            { label:'Tokens used',    val:'1,204',   sub:'this run',    col:'#7C3AED' },
            { label:'Latency',        val:'1.2s',    sub:'end-to-end',  col:'#0891B2' },
            { label:'Cost estimate',  val:'$0.0024', sub:'per run',     col:'#22C55E' },
            { label:'Nodes executed', val:'4/4',     sub:'all passed',  col:'#F59E0B' },
          ].map(({ label,val,sub,col })=>(
            <div key={label} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:'18px 20px', transition:'transform 0.2s,box-shadow 0.2s,border-color 0.25s', position:'relative', overflow:'hidden' }}
              onMouseEnter={e=>{ const el=e.currentTarget; el.style.transform='translateY(-3px)'; el.style.boxShadow=`0 14px 32px ${col}18`; el.style.borderColor=`${col}40` }}
              onMouseLeave={e=>{ const el=e.currentTarget; el.style.transform='translateY(0)'; el.style.boxShadow='none'; el.style.borderColor=T.border }}>
              {/* Colored sonar indicator */}
              <div style={{ position:'absolute', top:16, right:16 }}><SonarDot color={col} size={8}/></div>
              <div style={{ fontSize:10, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>{label}</div>
              <div style={{ fontSize:26, fontWeight:700, color:T.text, letterSpacing:'-0.04em', marginBottom:4 }}>{val}</div>
              <div style={{ fontSize:11, color:col, fontWeight:500 }}>{sub}</div>
            </div>
          ))}
        </div>
        <div>
          <p style={{ fontSize:11, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:18 }}>Full observability</p>
          <h2 style={{ fontFamily:'var(--font-playfair,"Playfair Display",Georgia,serif)', fontSize:'clamp(26px,2.8vw,38px)', fontWeight:700, color:T.text, letterSpacing:'-0.02em', lineHeight:1.1, marginBottom:18 }}>
            Every run is logged.<br/>Nothing is a black box.
          </h2>
          <p style={{ fontSize:15, color:T.text2, lineHeight:1.7, marginBottom:22 }}>
            Token usage, latency, cost attribution, full execution trace, and node-level outputs, all stored and searchable.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            {['Per-node token and latency breakdown','Cost per run with model attribution','Full execution trace with timestamps','Filter, search, and export run history'].map(item=>(
              <div key={item} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, color:T.text2 }}>
                <CheckCircle size={13} color="#22C55E"/>{item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why AgentHub — always dark editorial ────────────────────── */}
      <section id="lp-why" style={{ background:T.surface, borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1400, margin:'0 auto', padding:'90px 40px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'start' }}>
          {/* Left */}
          <div style={{ position:'sticky', top:84 }}>
            <p style={{ fontSize:11, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:24 }}>Why AgentHub exists</p>
            <h2 style={{ fontFamily:'var(--font-playfair,"Playfair Display",Georgia,serif)', fontSize:'clamp(34px,3.5vw,52px)', fontWeight:700, color:T.text, letterSpacing:'-0.02em', lineHeight:1.06, marginBottom:28 }}>
              Most AI tooling today<br/><em style={{ fontStyle:'italic', color:T.text2 }}>is shallow.</em>
            </h2>
            <p style={{ fontSize:15, color:T.text2, lineHeight:1.75, marginBottom:32 }}>
              We built AgentHub because production AI systems need real infrastructure, not drag-and-drop prompt chains dressed up as agents.
            </p>
            <div style={{ padding:'20px', background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.18)', borderRadius:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <SonarDot color="#22C55E" size={6}/>
                <span style={{ fontSize:11, fontWeight:700, color:'#22C55E', textTransform:'uppercase', letterSpacing:'0.08em' }}>Already here</span>
              </div>
              <div style={{ fontSize:14, fontWeight:600, color:T.text, marginBottom:6 }}>Multi-agent Systems · built in</div>
              <p style={{ fontSize:13, color:T.text2, lineHeight:1.65 }}>
                Every pipeline is a multi-agent system. Each node runs with its own LLM, tools, and memory. Connect any topology on the same visual canvas.
              </p>
            </div>
          </div>

          {/* Right: 4 principles */}
          <div style={{ display:'flex', flexDirection:'column' }}>
            {[
              { n:'01', title:'Agents should be composable', body:'Every complex workflow breaks down into simple, testable nodes. Build small, compose big. Swap out any part without breaking the whole.' },
              { n:'02', title:'Bring your own everything',   body:'Your API keys, your models, your tools. No lock-in. No hidden costs. No surprises. AgentHub is infrastructure, not a platform moat.' },
              { n:'03', title:'Observability is not optional', body:'Production agents need full trace logs, token counts, cost attribution, and error reporting. Not as an afterthought. By default.' },
              { n:'04', title:'Humans stay in control',      body:'The best AI systems know when to pause and ask. HITL checkpoints and approval gates make that a first-class primitive, not an edge case.' },
            ].map(({ n,title,body },i,arr)=>(
              <div key={n} style={{ display:'flex', gap:20, padding:'28px 0', borderBottom:i<arr.length-1?`1px solid ${T.border}`:'none', cursor:'default' }}>
                <span style={{ fontSize:11, fontWeight:700, color:T.text3, fontFamily:'monospace', width:28, flexShrink:0, paddingTop:3 }}>{n}</span>
                <div>
                  <h3 style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:8, lineHeight:1.3, letterSpacing:'-0.01em' }}>{title}</h3>
                  <p style={{ fontSize:13, color:T.text2, lineHeight:1.7 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer style={{ borderTop:`1px solid ${T.border}`, background:T.surface, position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1400, margin:'0 auto', padding:'32px 40px 28px' }}>

          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:40, marginBottom:40 }}>
            {/* Brand */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <Zap size={18} color="#2563EB" strokeWidth={2.5}/>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:T.text, lineHeight:1 }}>AgentHub</div>
                  <div style={{ fontSize:8.5, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.1em', marginTop:3 }}>Built for engineers who ship</div>
                </div>
              </div>
              <p style={{ fontSize:12, color:T.text2, lineHeight:1.75, maxWidth:260, marginBottom:20 }}>
                Visual AI agent builder. Design pipelines on a canvas, deploy as REST APIs, bring your own LLM keys.
              </p>
              {/* Founder card — compact, content-width */}
              <div style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'10px 14px', background:T.surface3, border:`1px solid ${T.border}`, borderRadius:10 }}>
                <img src="/nikhil.jpeg" alt="Nikhil Kumar"
                  style={{ width:30, height:30, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:`1.5px solid ${T.border}` }}/>
                <div>
                  <p style={{ fontSize:9, fontWeight:600, color:T.text3, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>Built by</p>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:T.text, letterSpacing:'-0.01em', whiteSpace:'nowrap' }}>Nikhil Kumar</span>
                    <a href="https://github.com/nik1609" target="_blank" rel="noreferrer"
                      style={{ color:T.text3, display:'flex', transition:'color 0.15s' }}
                      onMouseEnter={e=>(e.currentTarget.style.color=T.text)} onMouseLeave={e=>(e.currentTarget.style.color=T.text3)}>
                      <GitHubIcon size={12}/>
                    </a>
                    <a href="https://www.linkedin.com/in/nikhil-kumar-dev/" target="_blank" rel="noreferrer"
                      style={{ color:'#0A66C2', display:'flex', transition:'opacity 0.15s' }}
                      onMouseEnter={e=>(e.currentTarget.style.opacity='0.7')} onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
                      <LinkedInIcon size={12}/>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Product */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:T.text3, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:16 }}>Product</div>
              <a href="/docs" style={{ display:'block', fontSize:12, color:T.text2, textDecoration:'none', marginBottom:9, transition:'color 0.1s' }}
                onMouseEnter={e=>(e.currentTarget.style.color=T.text)} onMouseLeave={e=>(e.currentTarget.style.color=T.text2)}>API Docs</a>
              <a href="https://github.com/nik1609/agentbuilder" target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:T.text2, textDecoration:'none', marginBottom:9, transition:'color 0.1s' }}
                onMouseEnter={e=>(e.currentTarget.style.color=T.text)} onMouseLeave={e=>(e.currentTarget.style.color=T.text2)}>
                <GitHubIcon size={12}/> GitHub
              </a>
            </div>

            {/* Node types with colored dots */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:T.text3, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:16 }}>Node types</div>
              {NODE_TYPES.map(({ name, color })=>(
                <div key={name} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0, boxShadow:`0 0 4px ${color}60` }}/>
                  <span style={{ fontSize:11, color:T.text2, fontFamily:'monospace' }}>{name}</span>
                </div>
              ))}
            </div>

            {/* Company */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:T.text3, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:16 }}>Company</div>
              <button onClick={()=>openAuth('signup')} style={{ display:'block', fontSize:12, color:T.text2, background:'none', border:'none', cursor:'pointer', padding:0, marginBottom:9, textAlign:'left', transition:'color 0.1s' }}
                onMouseEnter={e=>(e.currentTarget.style.color=T.text)} onMouseLeave={e=>(e.currentTarget.style.color=T.text2)}>Sign up</button>
              <button onClick={()=>openAuth('signin')} style={{ display:'block', fontSize:12, color:T.text2, background:'none', border:'none', cursor:'pointer', padding:0, marginBottom:9, textAlign:'left', transition:'color 0.1s' }}
                onMouseEnter={e=>(e.currentTarget.style.color=T.text)} onMouseLeave={e=>(e.currentTarget.style.color=T.text2)}>Sign in</button>
              <a href="#lp-contact" style={{ display:'block', fontSize:12, color:T.text2, textDecoration:'none', marginBottom:9, transition:'color 0.1s' }}
                onMouseEnter={e=>(e.currentTarget.style.color=T.text)} onMouseLeave={e=>(e.currentTarget.style.color=T.text2)}>Contact us</a>
              <a href="#lp-why" style={{ display:'block', fontSize:12, color:T.text2, textDecoration:'none', marginBottom:9, transition:'color 0.1s' }}
                onMouseEnter={e=>(e.currentTarget.style.color=T.text)} onMouseLeave={e=>(e.currentTarget.style.color=T.text2)}>Why AgentHub</a>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:20, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <p style={{ fontSize:11, color:T.text3 }}>© {new Date().getFullYear()} AgentHub</p>
              <span style={{ fontSize:11, color:T.text3 }}>·</span>
              <p style={{ fontSize:11, color:T.text3 }}>Built for engineers who move fast.</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#22C55E', background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)', padding:'3px 10px', borderRadius:20 }}>
              <SonarDot color="#22C55E" size={5}/>
              All systems operational
            </div>
          </div>
        </div>
      </footer>

      {authModal&&<AuthModal mode={authModal} T={T} onClose={()=>setAuthModal(null)} onSwitch={()=>setAuthModal(p=>p==='signin'?'signup':'signin')}/>}

      <style>{`
        [id] { scroll-margin-top: 80px; }
        @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes sonar     { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(2.4);opacity:0} }
        @keyframes marquee   { 0%{transform:translateX(0)} 100%{transform:translateX(-33.333%)} }
        @keyframes flowEdge  { from{stroke-dashoffset:21} to{stroke-dashoffset:0} }
        @keyframes nodePulse { 0%,100%{opacity:0.07} 50%{opacity:0.2} }
        @keyframes floatPanel{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 40px rgba(37,99,235,0.25)} 50%{box-shadow:0 0 70px rgba(37,99,235,0.5)} }
        .modal-input:focus   { border-color:rgba(96,165,250,0.5)!important; box-shadow:0 0 0 3px rgba(96,165,250,0.08)!important; }
        .modal-input::placeholder,.lp-input::placeholder { color:#9B9B9B; }
        .lp-input:focus      { border-color:rgba(37,99,235,0.4)!important; box-shadow:0 0 0 3px rgba(37,99,235,0.06)!important; outline:none; }
      `}</style>
    </div>
  )
}
