'use client'
import { useState, useEffect } from 'react'
import { Plus, Trash2, Database, Key, Check, X, ChevronDown, RefreshCw, Search, Pencil, Download } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import SectionLayout from '@/components/ui/SectionLayout'
import { ConfirmModal } from '@/components/ui/Modal'
import { Bot, Brain, Wrench, KeyRound, FileText, Shield } from 'lucide-react'

const AGENTS_NAV = [
  { href: '/agents',     label: 'Agents',     icon: Bot,      match: (p: string) => p === '/agents' || p.startsWith('/agents/') || p.startsWith('/builder/') },
  { href: '/models',     label: 'Models',     icon: Brain,    match: (p: string) => p.startsWith('/models') },
  { href: '/tools',      label: 'Tools',      icon: Wrench,   match: (p: string) => p.startsWith('/tools') },
  { href: '/prompts',    label: 'Prompts',    icon: FileText, match: (p: string) => p.startsWith('/prompts') },
  { href: '/memory',     label: 'Memory',     icon: Database, match: (p: string) => p.startsWith('/memory') },
  { href: '/guardrails', label: 'Guardrails', icon: Shield,   match: (p: string) => p.startsWith('/guardrails') },
  { href: '/datatables', label: 'Datatables', icon: Database, match: (p: string) => p.startsWith('/datatables') },
  { href: '/api-keys',   label: 'API Keys',   icon: KeyRound, match: (p: string) => p.startsWith('/api-keys') },
]

interface DatatableCol { name: string; type: 'text' | 'number' | 'boolean' | 'date'; isPrimaryKey?: boolean; required?: boolean }
interface Datatable { id: string; name: string; description: string; columns: DatatableCol[]; created_at: string }
interface DatatableRow { id: string; datatable_id: string; data: Record<string, unknown>; created_at: string }

const COL_TYPES = ['text', 'number', 'boolean', 'date'] as const
const TABLE_COLORS = ['#2563EB','#7C3AED','#0891B2','#16A34A','#D97706','#DB2777','#9333EA','#EA580C']
const tableColor = (name: string) => TABLE_COLORS[name.charCodeAt(0) % TABLE_COLORS.length]

const inputStyle: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 10px', borderRadius: 7, fontSize: 12,
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', cursor: 'pointer' }

// ── Row Modal (Add or Edit with Delete) ───────────────────────────────────────
function RowModal({ columns, existingRow, onSave, onDelete, onClose }: {
  columns: DatatableCol[]; existingRow?: DatatableRow | null
  onSave: (data: Record<string, string>) => void
  onDelete?: () => void; onClose: () => void
}) {
  const isEdit = !!existingRow
  const [rowData, setRowData] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {}
    for (const c of columns) d[c.name] = existingRow ? String(existingRow.data[c.name] ?? '') : ''
    return d
  })
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 520, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-xl)', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: isEdit ? 'var(--accent-light)' : 'rgba(22,163,74,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isEdit ? <Pencil size={13} color="var(--accent)" /> : <Plus size={14} color="var(--success)" />}
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{isEdit ? 'Edit Row' : 'Add Row'}</span>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
            <X size={13} />
          </button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 18 }}>
            {columns.map(c => (
              <div key={c.name}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {c.isPrimaryKey && <Key size={9} color="var(--accent)" />}
                  {c.name}<span style={{ opacity: 0.5, fontWeight: 400 }}>({c.type})</span>
                  {c.required && <span style={{ color: 'var(--error)', fontSize: 10 }}>*</span>}
                </div>
                {c.type === 'boolean' ? (
                  <div style={{ position: 'relative' }}>
                    <select value={rowData[c.name] ?? 'false'} onChange={e => setRowData(d => ({ ...d, [c.name]: e.target.value }))} style={selectStyle}>
                      <option value="false">false</option><option value="true">true</option>
                    </select>
                    <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                  </div>
                ) : (
                  <input value={rowData[c.name] ?? ''} onChange={e => setRowData(d => ({ ...d, [c.name]: e.target.value }))} style={inputStyle}
                    placeholder={c.type === 'number' ? '0' : c.type === 'date' ? 'YYYY-MM-DD' : ''} type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onSave(rowData)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Check size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />{isEdit ? 'Update' : 'Save Row'}
            </button>
            {isEdit && onDelete && (
              <button onClick={onDelete} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--error-border)', background: 'var(--error-bg)', color: 'var(--error)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={12} /> Delete
              </button>
            )}
            <button onClick={onClose} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Column Modal (Edit schema column with Delete) ─────────────────────────────
function ColModal({ col, onSave, onDelete, onClose }: {
  col: DatatableCol; onSave: (c: DatatableCol) => void; onDelete: () => void; onClose: () => void
}) {
  const [form, setForm] = useState<DatatableCol>({ ...col })
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 400, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Key size={13} color="var(--accent)" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Edit Column</span>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}><X size={13} /></button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Name</div>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} autoFocus />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Type</div>
            <div style={{ position: 'relative' }}>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as DatatableCol['type'] }))} style={selectStyle}>
                {(['text','number','boolean','date'] as const).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button onClick={() => setForm(f => ({ ...f, isPrimaryKey: !f.isPrimaryKey }))} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${form.isPrimaryKey ? 'var(--accent)' : 'var(--border)'}`, background: form.isPrimaryKey ? 'var(--accent-light)' : 'var(--surface2)', color: form.isPrimaryKey ? 'var(--accent)' : 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Primary Key
            </button>
            <button onClick={() => setForm(f => ({ ...f, required: !f.required }))} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${form.required ? 'var(--success)' : 'var(--border)'}`, background: form.required ? 'var(--success-bg)' : 'var(--surface2)', color: form.required ? 'var(--success)' : 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Required
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onSave(form)} disabled={!form.name.trim()} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !form.name.trim() ? 0.5 : 1 }}>
              <Check size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />Update
            </button>
            <button onClick={onDelete} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--error-border)', background: 'var(--error-bg)', color: 'var(--error)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Trash2 size={12} /> Delete
            </button>
            <button onClick={onClose} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DatatablesPage() {
  const { items: datatables, loading, saving, create, update, remove } = useRegistry<Datatable>('/api/datatables')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [activeTab, setActiveTab]   = useState<'schema' | 'data'>('schema')
  const [search, setSearch]         = useState('')

  // New datatable form
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCols, setNewCols] = useState<DatatableCol[]>([{ name: '', type: 'text', isPrimaryKey: false, required: false }])

  // Add column to existing table
  const [addingCol, setAddingCol]   = useState(false)
  const [addColForm, setAddColForm] = useState<DatatableCol>({ name: '', type: 'text', isPrimaryKey: false, required: false })
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null)
  const [editColForm, setEditColForm]     = useState<DatatableCol>({ name: '', type: 'text', isPrimaryKey: false, required: false })

  // Rows
  const [rows, setRows]               = useState<DatatableRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [deleteRowId, setDeleteRowId]   = useState<string | null>(null)
  const [showAddRow, setShowAddRow]     = useState(false)
  const [editingRow, setEditingRow]     = useState<DatatableRow | null>(null)
  const [editingColModal, setEditingColModal] = useState<{ col: DatatableCol; idx: number } | null>(null)

  const selected = datatables.find(d => d.id === selectedId)
  const filtered = datatables.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()))

  const loadRows = (id: string) => {
    setRowsLoading(true)
    fetch(`/api/datatables/${id}/rows`).then(r => r.json())
      .then((data: DatatableRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setRowsLoading(false))
  }

  useEffect(() => { if (!selectedId) { setRows([]); return } loadRows(selectedId) }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const addColToSchema = () => setNewCols(c => [...c, { name: '', type: 'text', isPrimaryKey: false, required: false }])
  const removeNewCol   = (i: number) => setNewCols(c => c.filter((_, idx) => idx !== i))
  const updateNewCol   = (i: number, patch: Partial<DatatableCol>) => setNewCols(c => c.map((col, idx) => idx === i ? { ...col, ...patch } : col))
  const setPK          = (i: number) => setNewCols(c => c.map((col, idx) => ({ ...col, isPrimaryKey: idx === i })))

  const createDatatable = async () => {
    const validCols = newCols.filter(c => c.name.trim())
    if (!newName.trim() || validCols.length === 0) return
    const dt = await create({ name: newName.trim(), description: newDesc.trim(), columns: validCols })
    setSelectedId(dt.id); setShowForm(false)
    setNewName(''); setNewDesc('')
    setNewCols([{ name: '', type: 'text', isPrimaryKey: false, required: false }])
    setActiveTab('schema')
  }

  const addColumnToExisting = async () => {
    if (!selected || !addColForm.name.trim()) return
    const updatedCols = [...selected.columns, addColForm]
    await update(selected.id, { name: selected.name, description: selected.description, columns: updatedCols } as never)
    setAddingCol(false); setAddColForm({ name: '', type: 'text', isPrimaryKey: false, required: false })
  }

  const saveColEdit = async () => {
    if (!selected || editingColIdx === null || !editColForm.name.trim()) return
    const updatedCols = selected.columns.map((c, i) => i === editingColIdx ? editColForm : c)
    await update(selected.id, { name: selected.name, description: selected.description, columns: updatedCols } as never)
    setEditingColIdx(null)
  }

  const saveColModal = async (newCol: DatatableCol) => {
    if (!selected || !editingColModal) return
    const updatedCols = selected.columns.map((c, i) => i === editingColModal.idx ? newCol : c)
    await update(selected.id, { name: selected.name, description: selected.description, columns: updatedCols } as never)
    setEditingColModal(null)
  }

  const deleteColumn = async () => {
    if (!selected || !editingColModal) return
    const updatedCols = selected.columns.filter((_, i) => i !== editingColModal.idx)
    await update(selected.id, { name: selected.name, description: selected.description, columns: updatedCols } as never)
    setEditingColModal(null)
  }

  const exportCsv = () => {
    if (!selected || rows.length === 0) return
    const headers = selected.columns.map(c => c.name)
    const escape = (v: string) => v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v
    const csvRows = rows.map(row => headers.map(h => escape(String(row.data[h] ?? ''))).join(','))
    const csv = [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${selected.name}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const parseRowData = (rowData: Record<string, string>, columns: DatatableCol[]) => {
    const data: Record<string, unknown> = {}
    for (const c of columns) {
      const val = rowData[c.name] ?? ''
      data[c.name] = c.type === 'number' ? (parseFloat(val) || 0) : c.type === 'boolean' ? (val === 'true') : val
    }
    return data
  }

  const saveRow = async (rowData: Record<string, string>) => {
    if (!selectedId || !selected) return
    const data = parseRowData(rowData, selected.columns)
    const pk = selected.columns.find(c => c.isPrimaryKey)
    if (pk && !data[pk.name]) return
    const res = await fetch(`/api/datatables/${selectedId}/rows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) })
    if (res.ok) { const row: DatatableRow = await res.json(); setRows(r => [...r, row]); setShowAddRow(false) }
  }

  const updateRow = async (rowData: Record<string, string>) => {
    if (!selectedId || !selected || !editingRow) return
    const data = parseRowData(rowData, selected.columns)
    const res = await fetch(`/api/datatables/${selectedId}/rows`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingRow.id, data }) })
    if (res.ok) {
      const updated: DatatableRow = await res.json()
      setRows(r => r.map(row => row.id === updated.id ? updated : row))
      setEditingRow(null)
    }
  }

  const deleteRow = async (rowId: string) => {
    if (!selectedId) return
    await fetch(`/api/datatables/${selectedId}/rows`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rowId }) })
    setRows(r => r.filter(row => row.id !== rowId)); setDeleteRowId(null)
  }

  return (
    <SectionLayout nav={AGENTS_NAV}>
      <style>{`
        @keyframes dash-shimmer { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>

      {showAddRow && selected && (
        <RowModal columns={selected.columns} onSave={saveRow} onClose={() => setShowAddRow(false)} />
      )}
      {editingRow && selected && (
        <RowModal columns={selected.columns} existingRow={editingRow} onSave={updateRow}
          onDelete={() => { setEditingRow(null); setDeleteRowId(editingRow.id) }}
          onClose={() => setEditingRow(null)} />
      )}
      {editingColModal && (
        <ColModal col={editingColModal.col} onSave={saveColModal} onDelete={deleteColumn} onClose={() => setEditingColModal(null)} />
      )}

      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* ── Left panel ── */}
        <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface2)' }}>
          {/* Header */}
          <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Database size={14} color="var(--accent)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Datatables</span>
              </div>
              <button onClick={() => { setShowForm(true); setSelectedId(null) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={10} strokeWidth={2.5} /> New
              </button>
            </div>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tables…"
                style={{ width: '100%', height: 28, paddingLeft: 26, paddingRight: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {loading ? (
              [0,1,2,3].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, marginBottom: 2, opacity: 1 - i * 0.2 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface3)', flexShrink: 0, animation: 'dash-shimmer 1.4s ease-in-out infinite' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 11, width: '70%', borderRadius: 3, background: 'var(--surface3)', marginBottom: 4 }} />
                    <div style={{ height: 9, width: '40%', borderRadius: 3, background: 'var(--surface3)' }} />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                {search ? `No tables match "${search}"` : 'No datatables yet'}
              </div>
            ) : filtered.map(dt => {
              const color = tableColor(dt.name)
              const letter = dt.name.trim()[0]?.toUpperCase() ?? '?'
              const isSelected = selectedId === dt.id
              return (
                <div key={dt.id} onClick={() => { setSelectedId(dt.id); setShowForm(false); setActiveTab('schema'); setAddingCol(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8, marginBottom: 2, cursor: 'pointer', background: isSelected ? `${color}12` : 'transparent', border: `1px solid ${isSelected ? `${color}30` : 'transparent'}`, transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--surface3)' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}18`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700, color }}>
                    {letter}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? color : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dt.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{dt.columns.length} col{dt.columns.length !== 1 ? 's' : ''}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setDeleteId(dt.id) }}
                    style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.3, transition: 'opacity 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.3')}>
                    <Trash2 size={10} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* New datatable form */}
          {showForm && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>
              <div style={{ maxWidth: 520 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 22, letterSpacing: '-0.3px' }}>New Datatable</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Name</div>
                  <input value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle} placeholder="e.g. Users, Orders, Leads" autoFocus />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Description (optional)</div>
                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)} style={inputStyle} placeholder="What is this table for?" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Columns</div>
                  <button onClick={addColToSchema} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text3)', cursor: 'pointer', fontSize: 11 }}>
                    <Plus size={10} /> Add column
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 48px 60px 28px', gap: 6, marginBottom: 6, padding: '0 2px' }}>
                  {['Name', 'Type', 'PK', 'Required', ''].map(h => (
                    <div key={h} style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                  ))}
                </div>

                {newCols.map((col, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 48px 60px 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <input value={col.name} onChange={e => updateNewCol(i, { name: e.target.value })} style={{ ...inputStyle, height: 32 }} placeholder={`col_${i + 1}`} />
                    <div style={{ position: 'relative' }}>
                      <select value={col.type} onChange={e => updateNewCol(i, { type: e.target.value as DatatableCol['type'] })} style={{ ...selectStyle, height: 32, fontSize: 11 }}>
                        {COL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown size={9} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button onClick={() => setPK(i)} style={{ width: 28, height: 28, borderRadius: 5, border: `1px solid ${col.isPrimaryKey ? 'var(--accent)' : 'var(--border)'}`, background: col.isPrimaryKey ? 'var(--accent-light)' : 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Key size={11} color={col.isPrimaryKey ? 'var(--accent)' : 'var(--text3)'} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button onClick={() => updateNewCol(i, { required: !col.required })} style={{ width: 28, height: 28, borderRadius: 5, border: `1px solid ${col.required ? 'var(--success)' : 'var(--border)'}`, background: col.required ? 'var(--success-bg)' : 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {col.required ? <Check size={11} color="var(--success)" /> : <span style={{ width: 10, height: 10, borderRadius: 2, border: '1.5px solid var(--border)', display: 'inline-block' }} />}
                      </button>
                    </div>
                    <button onClick={() => removeNewCol(i)} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={11} />
                    </button>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
                  <button onClick={createDatatable} disabled={saving} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontWeight: 600, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Creating…' : 'Create Datatable'}
                  </button>
                  <button onClick={() => setShowForm(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Selected datatable */}
          {selected && !showForm && (
            <>
              {/* Header + tabs */}
              <div style={{ padding: '16px 24px 0', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--card-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${tableColor(selected.name)}18`, border: `1px solid ${tableColor(selected.name)}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: tableColor(selected.name), flexShrink: 0 }}>
                    {selected.name.trim()[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>{selected.name}</div>
                    {selected.description && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{selected.description}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 0 }}>
                  {(['schema', 'data'] as const).map(tab => (
                    <button key={tab} onClick={() => { setActiveTab(tab); setAddingCol(false) }} style={{ padding: '7px 18px', border: 'none', marginBottom: -1, borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`, background: 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schema tab — fixed header + scrollable rows */}
              {activeTab === 'schema' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 24px 0' }}>
                  {/* Fixed column header */}
                  <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 90px 64px 72px', gap: 0, padding: '7px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px 10px 0 0', borderBottom: 'none' }}>
                    {['Column', 'Type', 'PK', 'Required'].map(h => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
                    ))}
                  </div>
                  {/* Scrollable rows */}
                  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, borderRadius: '0 0 10px 10px', border: '1px solid var(--border)', borderTop: 'none', background: 'var(--card-bg)' }}>
                    {selected.columns.map((col, i) => (
                        /* Click row → ColModal */
                        <div key={i} onClick={() => setEditingColModal({ col, idx: i })}
                          style={{ display: 'grid', gridTemplateColumns: '1fr 90px 64px 72px', gap: 0, padding: '10px 14px', borderBottom: i < selected.columns.length - 1 ? '1px solid var(--border2)' : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {col.isPrimaryKey && <Key size={10} color="var(--accent)" style={{ flexShrink: 0 }} />}
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{col.name}</span>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text3)', padding: '2px 7px', borderRadius: 5, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'inline-block', width: 'fit-content' }}>{col.type}</span>
                          <span style={{ fontSize: 13, color: col.isPrimaryKey ? 'var(--accent)' : 'var(--text3)' }}>{col.isPrimaryKey ? '✓' : '—'}</span>
                          <span style={{ fontSize: 13, color: col.required ? 'var(--success)' : 'var(--text3)' }}>{col.required ? '✓' : '—'}</span>
                        </div>
                    ))}

                    {/* Add column inline form */}
                    {addingCol && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 64px 72px', gap: 8, padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', alignItems: 'center' }}>
                        <input value={addColForm.name} onChange={e => setAddColForm(f => ({ ...f, name: e.target.value }))} style={{ ...inputStyle, height: 28, fontSize: 11 }} placeholder="column_name" autoFocus />
                        <div style={{ position: 'relative' }}>
                          <select value={addColForm.type} onChange={e => setAddColForm(f => ({ ...f, type: e.target.value as DatatableCol['type'] }))} style={{ ...selectStyle, height: 28, fontSize: 11 }}>
                            {COL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <ChevronDown size={9} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button onClick={() => setAddColForm(f => ({ ...f, isPrimaryKey: !f.isPrimaryKey }))} style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid ${addColForm.isPrimaryKey ? 'var(--accent)' : 'var(--border)'}`, background: addColForm.isPrimaryKey ? 'var(--accent-light)' : 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Key size={10} color={addColForm.isPrimaryKey ? 'var(--accent)' : 'var(--text3)'} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button onClick={() => setAddColForm(f => ({ ...f, required: !f.required }))} style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid ${addColForm.required ? 'var(--success)' : 'var(--border)'}`, background: addColForm.required ? 'var(--success-bg)' : 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {addColForm.required ? <Check size={10} color="var(--success)" /> : <span style={{ width: 9, height: 9, borderRadius: 2, border: '1.5px solid var(--border)', display: 'inline-block' }} />}
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={addColumnToExisting} disabled={!addColForm.name.trim() || saving} style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !addColForm.name.trim() || saving ? 0.5 : 1 }}>
                            <Check size={11} />
                          </button>
                          <button onClick={() => setAddingCol(false)} style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add Column button — fixed at bottom */}
                  {!addingCol && (
                    <div style={{ flexShrink: 0, padding: '10px 0 16px' }}>
                      <button onClick={() => setAddingCol(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text3)' }}>
                        <Plus size={12} /> Add Column
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Data tab — sticky header, rows scroll, header+rows scroll together horizontally */}
              {activeTab === 'data' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 24px 0' }}>
                  {/* Toolbar — fixed */}
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12, gap: 7 }}>
                    {rows.length > 0 && (
                      <button onClick={exportCsv} title="Export as CSV" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                        <Download size={11} /> Export CSV
                      </button>
                    )}
                    <button onClick={() => selectedId && loadRows(selectedId)} style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text2)', fontSize: 11, cursor: 'pointer' }}>
                      <RefreshCw size={11} style={rowsLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
                    </button>
                    <button onClick={() => setShowAddRow(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      <Plus size={11} /> Add Row
                    </button>
                  </div>

                  {/* Table — single scroll container, sticky thead */}
                  {rowsLoading ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>Loading rows…</div>
                  ) : rows.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Database size={18} color="var(--text3)" />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>No rows yet</p>
                      <button onClick={() => setShowAddRow(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        <Plus size={12} /> Add Row
                      </button>
                    </div>
                  ) : (
                    <div style={{ flex: 1, minHeight: 0, borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr style={{ background: 'var(--surface2)' }}>
                            {selected.columns.map(c => (
                              <th key={c.name} style={{ textAlign: 'left', padding: '8px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {c.isPrimaryKey && <Key size={9} color="var(--accent)" />}
                                  {c.name}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, ri) => (
                            /* Click row → RowModal with edit+delete */
                            <tr key={row.id} onClick={() => setEditingRow(row)}
                              style={{ borderBottom: ri < rows.length - 1 ? '1px solid var(--border2)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              {selected.columns.map(c => (
                                <td key={c.name} style={{ padding: '9px 14px', color: c.isPrimaryKey ? 'var(--accent)' : 'var(--text)', fontWeight: c.isPrimaryKey ? 600 : 400, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {String(row.data[c.name] ?? '—')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {!selected && !showForm && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Database size={22} color="var(--text3)" />
              </div>
              <div style={{ color: 'var(--text3)', fontSize: 13, fontWeight: 500 }}>Select a datatable or create a new one</div>
              <button onClick={() => setShowForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={12} /> New Datatable
              </button>
            </div>
          )}
        </div>

        <ConfirmModal open={!!deleteId} title="Delete datatable?" message="All rows will be permanently deleted. Agents using this datatable will fail." danger
          onConfirm={() => { if (deleteId) { remove(deleteId); if (selectedId === deleteId) setSelectedId(null) } }}
          onClose={() => setDeleteId(null)} />

        <ConfirmModal open={!!deleteRowId} title="Delete row?" message="This row will be permanently removed." danger
          onConfirm={() => { if (deleteRowId) deleteRow(deleteRowId) }}
          onClose={() => setDeleteRowId(null)} />
      </div>
    </SectionLayout>
  )
}
