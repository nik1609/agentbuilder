'use client'
import { useState } from 'react'
import { Info, Wrench, Cpu, FileText, Database, Shield, GitBranch } from 'lucide-react'
import AgentInfoTab from './tabs/AgentInfoTab'
import ToolsTab from './tabs/ToolsTab'
import ModelsTab from './tabs/ModelsTab'
import PromptsTab from './tabs/PromptsTab'
import MemoryTab from './tabs/MemoryTab'
import GuardrailsTab from './tabs/GuardrailsTab'
import OrchestratorTab from './tabs/OrchestratorTab'

const TABS = [
  { id: 'Agent',        label: 'Agent',        icon: Info },
  { id: 'Tools',        label: 'Tools',        icon: Wrench },
  { id: 'Models',       label: 'Models',       icon: Cpu },
  { id: 'Prompts',      label: 'Prompts',      icon: FileText },
  { id: 'Memory',       label: 'Memory',       icon: Database },
  { id: 'Guardrails',   label: 'Guardrails',   icon: Shield },
  { id: 'Orchestrator', label: 'Orchestrator', icon: GitBranch },
] as const

type Tab = typeof TABS[number]['id']

interface ConfigStudioProps {
  currentAgentId?: string
  currentAgentName?: string
}

function TabButton({ id, label, icon: Icon, active, onClick }: {
  id: string; label: string; icon: React.ElementType; active: boolean; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 40, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'rgba(124,111,240,0.18)' : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
          color: active ? 'var(--blue)' : hovered ? 'var(--text2)' : 'var(--text3)',
          transition: 'all 0.15s',
          position: 'relative',
        }}
      >
        {active && (
          <div style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            width: 2, height: 20, borderRadius: '0 2px 2px 0', background: 'var(--blue)',
          }} />
        )}
        <Icon size={16} />
      </button>
      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute', left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '4px 10px',
          fontSize: 11, fontWeight: 600, color: 'var(--text)',
          whiteSpace: 'nowrap', zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {label}
          {/* Arrow */}
          <div style={{
            position: 'absolute', left: -5, top: '50%', transform: 'translateY(-50%)',
            width: 8, height: 8, background: 'var(--surface2)',
            border: '1px solid var(--border)', borderRight: 'none', borderTop: 'none',
            rotate: '45deg',
          }} />
        </div>
      )}
    </div>
  )
}

export default function ConfigStudio({ currentAgentId, currentAgentName }: ConfigStudioProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Tools')

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

      {/* Vertical tab strip */}
      <div style={{
        width: 56, flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 10, gap: 2, background: 'var(--surface2)',
      }}>
        {TABS.map(({ id, label, icon }) => (
          <TabButton
            key={id}
            id={id}
            label={label}
            icon={icon}
            active={activeTab === id}
            onClick={() => setActiveTab(id as Tab)}
          />
        ))}
      </div>

      {/* Content panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Header */}
        <div style={{
          height: 48, display: 'flex', alignItems: 'center', padding: '0 16px',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
          gap: 10,
        }}>
          {(() => { const Tab = TABS.find(t => t.id === activeTab)!; return <Tab.icon size={13} style={{ color: 'var(--blue)' }} /> })()}
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.01em' }}>
            {TABS.find(t => t.id === activeTab)?.label}
          </span>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'Agent'        && <AgentInfoTab agentId={currentAgentId ?? ''} agentName={currentAgentName ?? ''} />}
          {activeTab === 'Tools'        && <ToolsTab />}
          {activeTab === 'Models'       && <ModelsTab />}
          {activeTab === 'Prompts'      && <PromptsTab />}
          {activeTab === 'Memory'       && <MemoryTab />}
          {activeTab === 'Guardrails'   && <GuardrailsTab />}
          {activeTab === 'Orchestrator' && <OrchestratorTab agentId={currentAgentId ?? ''} />}
        </div>
      </div>
    </div>
  )
}
