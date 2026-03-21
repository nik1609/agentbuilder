'use client'
import { useState, useEffect } from 'react'
import { Plus, Trash2, Database, Key, Check, X, ChevronDown, RefreshCw } from 'lucide-react'
import { useRegistry } from '@/lib/hooks/useRegistry'
import { ConfirmModal } from '@/components/ui/Modal'

interface DatatableCol { name: string; type: 'text' | 'number' | 'boolean' | 'date'; isPrimaryKey?: boolean; required?: boolean }
interface Datatable { id: string; name: string; description: string; columns: DatatableCol[]; created_at: string }
interface DatatableRow { id: string; datatable_id: string; data: Record<string, unknown>; created_at: string }

const COL_TYPES = ['text', 'number', 'boolean', 'date'] as const
const inputStyle: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', borderRadius: 7, fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', cursor: 'pointer' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  )
}

export default function DatatablesPage() {
  const { items: datatables, loading, saving, create, update, remove } = useRegistry<Datatable>('/api/datatables')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [activeTab, setActiveTab]   = useState<'schema' | 'data'>('schema')

  // New datatable form
  const [newName, setNewName]   = useState('')
  const [newDesc, setNewDesc]   = useState('')
  const [newCols, setNewCols]   = useState<DatatableCol[]>([{ name: '', type: 'text', isPrimaryKey: false, required: false }])

  // Rows state
  const [rows, setRows]         = useState<DatatableRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [deleteRowId, setDeleteRowId] = useState<string | null>(null)
  const [addingRow, setAddingRow]     = useState(false)
  const [newRowData, setNewRowData]   = useState<Record<string, string>>({})

  const selected = datatables.find(d => d.id === selectedId)

  const loadRows = (id: string) => {
    setRowsLoading(true)
    fetch(`/api/datatables/${id}/rows`)
      .then(r => r.json())
      .then((data: DatatableRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setRowsLoading(false))
  }

  // Load rows when selected datatable changes
  useEffect(() => {
    if (!selectedId) { setRows([]); return }
    loadRows(selectedId)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset new row form when datatable changes
  useEffect(() => {
    if (selected) {
      const initial: Record<string, string> = {}
      for (const c of selected.columns) initial[c.name] = ''
      setNewRowData(initial)
    }
  }, [selectedId, selected?.columns.length])

  const addCol = () => setNewCols(c => [...c, { name: '', type: 'text', isPrimaryKey: false, required: false }])
  const removeCol = (i: number) => setNewCols(c => c.filter((_, idx) => idx !== i))
  const updateCol = (i: number, patch: Partial<DatatableCol>) => setNewCols(c => c.map((col, idx) => idx === i ? { ...col, ...patch } : col))
  const setPK = (i: number) => setNewCols(c => c.map((col, idx) => ({ ...col, isPrimaryKey: idx === i })))

  const createDatatable = async () => {
    const validCols = newCols.filter(c => c.name.trim())
    if (!newName.trim() || validCols.length === 0) return
    const dt = await create({ name: newName.trim(), description: newDesc.trim(), columns: validCols })
    setSelectedId(dt.id)
    setShowForm(false)
    setNewName(''); setNewDesc('')
    setNewCols([{ name: '', type: 'text', isPrimaryKey: false, required: false }])
    setActiveTab('schema')
  }

  const addRow = async () => {
    if (!selectedId || !selected) return
    const data: Record<string, unknown> = {}
    for (const c of selected.columns) {
      const val = newRowData[c.name] ?? ''
      data[c.name] = c.type === 'number' ? (parseFloat(val) || 0) : c.type === 'boolean' ? (val === 'true') : val
    }
    const pk = selected.columns.find(c => c.isPrimaryKey)
    if (pk && !data[pk.name]) return
    const res = await fetch(`/api/datatables/${selectedId}/rows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) })
    if (res.ok) {
      const row: DatatableRow = await res.json()
      setRows(r => [...r, row])
      const initial: Record<string, string> = {}
      for (const c of selected.columns) initial[c.name] = ''
      setNewRowData(initial)
      setAddingRow(false)
    }
  }

  const deleteRow = async (rowId: string) => {
    if (!selectedId) return
    await fetch(`/api/datatables/${selectedId}/rows`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: rowId }) })
    setRows(r => r.filter(row => row.id !== rowId))
    setDeleteRowId(null)
  }

  const saveSchema = async () => {
    if (!selected) return
    await update(selected.id, { name: selected.name, description: selected.description, columns: selected.columns })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── Left panel ── */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={16} style={{ color: '#7c6ff0' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Datatables</span>
            </div>
            <button onClick={() => { setShowForm(true); setSelectedId(null) }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: 'none', background: '#7c6ff0', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={11} /> New
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Loading…</div>
          ) : datatables.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No datatables yet</div>
          ) : datatables.map(dt => (
            <div
              key={dt.id}
              onClick={() => { setSelectedId(dt.id); setShowForm(false); setActiveTab('schema') }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 7, marginBottom: 2, cursor: 'pointer', background: selectedId === dt.id ? 'rgba(124,111,240,0.12)' : 'transparent', border: `1px solid ${selectedId === dt.id ? 'rgba(124,111,240,0.3)' : 'transparent'}` }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dt.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{dt.columns.length} col{dt.columns.length !== 1 ? 's' : ''}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); setDeleteId(dt.id) }} style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* New datatable form */}
        {showForm && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
            <div style={{ maxWidth: 560 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>New Datatable</div>
              <Field label="Name">
                <input value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle} placeholder="e.g. Users, Orders, Leads" autoFocus />
              </Field>
              <Field label="Description (optional)">
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} style={inputStyle} placeholder="What is this table for?" />
              </Field>

              <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Columns</div>
                <button onClick={addCol} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text3)', cursor: 'pointer', fontSize: 10 }}>
                  <Plus size={10} /> Add column
                </button>
              </div>

              {/* Column header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 60px 60px 28px', gap: 6, marginBottom: 4, padding: '0 4px' }}>
                {['Name', 'Type', 'Primary Key', 'Required', ''].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                ))}
              </div>

              {newCols.map((col, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 60px 60px 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <input value={col.name} onChange={e => updateCol(i, { name: e.target.value })} style={{ ...inputStyle, height: 32 }} placeholder={`col_${i + 1}`} />
                  <div style={{ position: 'relative' }}>
                    <select value={col.type} onChange={e => updateCol(i, { type: e.target.value as DatatableCol['type'] })} style={{ ...selectStyle, height: 32, fontSize: 11 }}>
                      {COL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={10} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button onClick={() => setPK(i)} style={{ width: 28, height: 28, borderRadius: 5, border: `1px solid ${col.isPrimaryKey ? '#7c6ff0' : 'var(--border)'}`, background: col.isPrimaryKey ? 'rgba(124,111,240,0.15)' : 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Key size={11} style={{ color: col.isPrimaryKey ? '#7c6ff0' : 'var(--text3)' }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button onClick={() => updateCol(i, { required: !col.required })} style={{ width: 28, height: 28, borderRadius: 5, border: `1px solid ${col.required ? '#22d79a' : 'var(--border)'}`, background: col.required ? 'rgba(34,215,154,0.12)' : 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {col.required ? <Check size={11} style={{ color: '#22d79a' }} /> : <span style={{ width: 11, height: 11, borderRadius: 3, border: '1.5px solid var(--border)', display: 'inline-block' }} />}
                    </button>
                  </div>
                  <button onClick={() => removeCol(i)} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={11} />
                  </button>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button onClick={createDatatable} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#7c6ff0', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {saving ? 'Creating…' : 'Create Datatable'}
                </button>
                <button onClick={() => setShowForm(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Selected datatable detail */}
        {selected && !showForm && (
          <>
            {/* Detail header */}
            <div style={{ padding: '18px 24px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{selected.name}</div>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 0 }}>
                {(['schema', 'data'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '7px 18px', border: 'none', borderBottom: `2px solid ${activeTab === tab ? '#7c6ff0' : 'transparent'}`, background: 'transparent', color: activeTab === tab ? '#7c6ff0' : 'var(--text3)', cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Schema tab */}
            {activeTab === 'schema' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                <div style={{ maxWidth: 600 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px', gap: 8, marginBottom: 6, padding: '0 4px' }}>
                    {['Column Name', 'Type', 'Primary Key', 'Required'].map(h => (
                      <div key={h} style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                    ))}
                  </div>
                  {selected.columns.map((col, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px', gap: 8, marginBottom: 8, padding: '8px 10px', borderRadius: 7, background: col.isPrimaryKey ? 'rgba(124,111,240,0.07)' : 'var(--surface)', border: `1px solid ${col.isPrimaryKey ? 'rgba(124,111,240,0.25)' : 'var(--border)'}`, alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {col.isPrimaryKey && <Key size={10} style={{ color: '#7c6ff0', flexShrink: 0 }} />}
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{col.name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text3)', padding: '2px 8px', borderRadius: 4, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'inline-block' }}>{col.type}</span>
                      <span style={{ fontSize: 11, color: col.isPrimaryKey ? '#7c6ff0' : 'var(--text3)' }}>{col.isPrimaryKey ? '✓' : '—'}</span>
                      <span style={{ fontSize: 11, color: col.required ? '#22d79a' : 'var(--text3)' }}>{col.required ? '✓' : '—'}</span>
                    </div>
                  ))}
                  {selected.columns.length === 0 && (
                    <div style={{ color: 'var(--text3)', fontSize: 12, padding: 16 }}>No columns defined.</div>
                  )}
                </div>
              </div>
            )}

            {/* Data tab */}
            {activeTab === 'data' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{rows.length} row{rows.length !== 1 ? 's' : ''}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => selectedId && loadRows(selectedId)} title="Refresh rows" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 11, cursor: 'pointer' }}>
                      <RefreshCw size={11} style={rowsLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
                    </button>
                    <button onClick={() => setAddingRow(r => !r)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: 'none', background: addingRow ? 'var(--surface2)' : '#7c6ff0', color: addingRow ? 'var(--text2)' : '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {addingRow ? <><X size={11} /> Cancel</> : <><Plus size={11} /> Add Row</>}
                    </button>
                  </div>
                </div>

                {/* Add row form */}
                {addingRow && selected.columns.length > 0 && (
                  <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Row</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
                      {selected.columns.map(c => (
                        <div key={c.name}>
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
                            {c.isPrimaryKey && <Key size={9} style={{ color: '#7c6ff0' }} />}
                            {c.name} <span style={{ opacity: 0.6 }}>({c.type})</span>
                            {c.required && <span style={{ color: 'var(--red)' }}>*</span>}
                          </div>
                          {c.type === 'boolean' ? (
                            <select value={newRowData[c.name] ?? 'false'} onChange={e => setNewRowData(d => ({ ...d, [c.name]: e.target.value }))} style={{ ...selectStyle, height: 32, fontSize: 11 }}>
                              <option value="false">false</option>
                              <option value="true">true</option>
                            </select>
                          ) : (
                            <input value={newRowData[c.name] ?? ''} onChange={e => setNewRowData(d => ({ ...d, [c.name]: e.target.value }))} style={{ ...inputStyle, height: 32, fontSize: 11 }} placeholder={c.type === 'number' ? '0' : c.type === 'date' ? 'YYYY-MM-DD' : ''} type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'} />
                          )}
                        </div>
                      ))}
                    </div>
                    <button onClick={addRow} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#22d79a', color: '#080810', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      Save Row
                    </button>
                  </div>
                )}

                {rowsLoading ? (
                  <div style={{ color: 'var(--text3)', fontSize: 12, padding: 16 }}>Loading rows…</div>
                ) : rows.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 12, padding: 16 }}>No rows yet. Add the first row above.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          {selected.columns.map(c => (
                            <th key={c.name} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {c.isPrimaryKey && <Key size={9} style={{ color: '#7c6ff0' }} />}
                                {c.name}
                              </div>
                            </th>
                          ))}
                          <th style={{ width: 40, padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, ri) => (
                          <tr key={row.id} style={{ borderBottom: '1px solid var(--border2)', background: ri % 2 === 0 ? 'var(--bg)' : 'var(--surface)' }}>
                            {selected.columns.map(c => (
                              <td key={c.name} style={{ padding: '8px 12px', color: c.isPrimaryKey ? '#7c6ff0' : 'var(--text)', fontWeight: c.isPrimaryKey ? 600 : 400, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {String(row.data[c.name] ?? '—')}
                              </td>
                            ))}
                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                              <button onClick={() => setDeleteRowId(row.id)} style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trash2 size={10} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!selected && !showForm && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <Database size={36} style={{ color: 'var(--text3)', opacity: 0.4 }} />
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Select a datatable or create a new one</div>
            <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7c6ff0', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={12} /> New Datatable
            </button>
          </div>
        )}
      </div>

      {/* Confirm delete datatable */}
      <ConfirmModal
        open={!!deleteId}
        title="Delete datatable?"
        message="All rows will be permanently deleted. Agents using this datatable will fail."
        danger
        onConfirm={() => { if (deleteId) { remove(deleteId); if (selectedId === deleteId) setSelectedId(null) } }}
        onClose={() => setDeleteId(null)}
      />

      {/* Confirm delete row */}
      <ConfirmModal
        open={!!deleteRowId}
        title="Delete row?"
        message="This row will be permanently removed from the datatable."
        danger
        onConfirm={() => { if (deleteRowId) { deleteRow(deleteRowId) } }}
        onClose={() => setDeleteRowId(null)}
      />
    </div>
  )
}
