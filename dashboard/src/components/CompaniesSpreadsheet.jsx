import React, { useState, useEffect, useRef } from 'react'
import { updateCompany, autofillCompanyLinkedIn } from '../services/api'

const CLASSIFICATIONS = [
  '', 'Unclassified', 'Fintech', 'Healthtech', 'SaaS', 'Cybersecurity',
  'IT Services', 'E-commerce', 'Edtech', 'Logistics', 'Manufacturing',
  'Banking', 'Insurance', 'VC / Investment', 'Media', 'Consulting',
  'Retail', 'Real Estate', 'Government', 'Non-profit', 'Other',
]

const PROSPECT_STATUSES = [
  '', 'To Review', 'Prospect', 'Not a Fit', 'Contacted', 'In Progress', 'Closed Won', 'Closed Lost',
]

const COMPANY_TYPES = ['', 'Product', 'Services', 'Hybrid']

const COLUMNS = [
  { key: '_serial',        label: '#',              width: 48,  type: 'serial' },
  { key: 'name',           label: 'Name',           width: 200, type: 'text' },
  { key: 'classification', label: 'Classification', width: 150, type: 'select', options: CLASSIFICATIONS },
  { key: 'prospect_status',label: 'Status',         width: 130, type: 'select', options: PROSPECT_STATUSES },
  { key: 'website',        label: 'Website',        width: 170, type: 'url' },
  { key: 'linkedin_url',   label: 'LinkedIn URL',   width: 200, type: 'url' },
  { key: 'headquarters',   label: 'HQ',             width: 150, type: 'text' },
  { key: 'size',           label: 'Employees',      width: 130, type: 'text' },
  { key: 'followers',      label: 'Followers',      width: 120, type: 'text' },
  { key: 'revenue',        label: 'Revenue',        width: 120, type: 'text' },
  { key: 'compliance',     label: 'Compliance',     width: 150, type: 'text' },
  { key: 'type',           label: 'Type',           width: 110, type: 'select', options: COMPANY_TYPES },
  { key: 'description',    label: 'Description',    width: 280, type: 'text' },
  { key: 'notes',          label: 'Notes',          width: 220, type: 'text' },
]

function getProspectColor(status) {
  const map = {
    'Prospect':    '#4a7c59',
    'Not a Fit':   'var(--red)',
    'Contacted':   'var(--accent)',
    'In Progress': '#5b8db8',
    'Closed Won':  '#4a7c59',
    'Closed Lost': 'var(--text-muted)',
  }
  return map[status] || 'var(--text-muted)'
}

function getCellValue(company, key) {
  if (key === '_serial') return ''
  const val = company[key] || ''
  if (key === 'size') return typeof val === 'string' ? val.replace(/\s*employees?\s*/gi, '').trim() : val
  if (key === 'followers') return typeof val === 'string' ? val.replace(/\s*followers?\s*/gi, '').trim() : val
  return val
}

function EditableCell({ company, col, onSave, isEditing, onStartEdit, onStopEdit }) {
  const [val, setVal] = useState(getCellValue(company, col.key))
  const inputRef = useRef(null)

  useEffect(() => { setVal(getCellValue(company, col.key)) }, [company[col.key]])
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current.select) inputRef.current.select()
    }
  }, [isEditing])

  function handleSave() {
    const original = getCellValue(company, col.key)
    if (val !== original) onSave(company.id, col.key, val)
    onStopEdit()
  }

  if (col.type === 'serial') return <div style={cell.readonly} />

  if (col.type === 'url') {
    if (isEditing) {
      return (
        <input ref={inputRef} value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setVal(getCellValue(company, col.key)); onStopEdit() } }}
          style={cell.input}
        />
      )
    }
    const dv = getCellValue(company, col.key)
    if (!dv) return <div style={cell.empty} onClick={onStartEdit}>—</div>
    const short = dv.replace(/https?:\/\/(www\.)?/, '').split('/')[0]
    return <a href={dv} target="_blank" rel="noreferrer" style={cell.link} onClick={e => e.stopPropagation()}>{short}</a>
  }

  if (col.type === 'select') {
    if (isEditing) {
      return (
        <select ref={inputRef} value={val}
          onChange={e => { setVal(e.target.value); onSave(company.id, col.key, e.target.value); onStopEdit() }}
          onBlur={onStopEdit}
          style={cell.select}
        >
          {(col.options || []).map(opt => <option key={opt} value={opt}>{opt || '—'}</option>)}
        </select>
      )
    }
    const dv = getCellValue(company, col.key)
    let color = 'var(--text-muted)'
    if (col.key === 'prospect_status') color = getProspectColor(dv)
    if (col.key === 'classification' && dv && dv !== 'Unclassified') color = 'var(--text)'
    return <div style={{ ...cell.text, color, cursor: 'pointer' }} onClick={onStartEdit}>{dv || '—'}</div>
  }

  if (isEditing) {
    return (
      <input ref={inputRef} value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setVal(getCellValue(company, col.key)); onStopEdit() } }}
        style={cell.input}
      />
    )
  }

  const dv = getCellValue(company, col.key)
  return <div style={{ ...cell.text, cursor: 'text' }} onClick={onStartEdit}>{dv || <span style={{ color: 'var(--text-muted)' }}>—</span>}</div>
}

function ResizableHeader({ col, colIndex, onResize }) {
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  function handleMouseDown(e) {
    e.preventDefault(); e.stopPropagation()
    isResizing.current = true; startX.current = e.clientX; startWidth.current = col.width
    const onMove = e => { if (isResizing.current) onResize(colIndex, Math.max(60, startWidth.current + e.clientX - startX.current)) }
    const onUp = () => { isResizing.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = '' }
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  return (
    <th style={{ ...th, width: col.width + 'px', minWidth: col.width + 'px', position: 'sticky', top: 0, zIndex: 10 }}>
      {col.label}
      {col.type !== 'serial' && (
        <div onMouseDown={handleMouseDown}
          onDoubleClick={() => onResize(colIndex, Math.max(80, col.label.length * 9 + 40))}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', background: 'transparent', zIndex: 1 }}
          onMouseEnter={e => { e.target.style.background = 'var(--accent)' }}
          onMouseLeave={e => { e.target.style.background = 'transparent' }}
        />
      )}
    </th>
  )
}

export default function CompaniesSpreadsheet({ companies, onClose, onRefresh }) {
  const [local, setLocal] = useState(() => companies.map(c => ({ ...c })))
  const [columns, setColumns] = useState(COLUMNS)
  const [editingCell, setEditingCell] = useState(null) // { rowId, colKey }
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')
  const [autofilling, setAutofilling] = useState(false)
  const [autofillMsg, setAutofillMsg] = useState('')
  const [saving, setSaving] = useState(null)

  useEffect(() => { setLocal(companies.map(c => ({ ...c }))) }, [companies])

  function handleResize(colIndex, newWidth) {
    setColumns(prev => prev.map((c, i) => i === colIndex ? { ...c, width: newWidth } : c))
  }

  async function handleSave(id, key, value) {
    setSaving(id)
    const fieldMap = { size: 'size', website_url: 'website_url' }
    const payload = { [key]: value }
    try {
      await updateCompany(id, payload)
      setLocal(prev => prev.map(c => c.id === id ? { ...c, [key]: value } : c))
      onRefresh?.()
    } catch (e) { console.error('Save error:', e) }
    setSaving(null)
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  function toggleAll() {
    const filtered = filteredRows.map(c => c.id)
    const allSelected = filtered.every(id => selected.includes(id))
    setSelected(allSelected ? selected.filter(id => !filtered.includes(id)) : [...new Set([...selected, ...filtered])])
  }

  async function autofillSelected() {
    const targets = selected.length ? local.filter(c => selected.includes(c.id)) : local
    setAutofilling(true)
    setAutofillMsg(`Autofilling ${targets.length} companies…`)
    let done = 0
    for (const company of targets) {
      try {
        const res = await autofillCompanyLinkedIn(company.id)
        const updated = res.data?.company
        if (updated) setLocal(prev => prev.map(c => c.id === company.id ? { ...c, ...updated } : c))
        done++
        setAutofillMsg(`Autofilling… ${done}/${targets.length}`)
      } catch { /* skip */ }
    }
    setAutofilling(false)
    setAutofillMsg(`Done — ${done} updated`)
    onRefresh?.()
    setTimeout(() => setAutofillMsg(''), 3000)
  }

  function exportCSV() {
    const exportCols = COLUMNS.filter(c => c.type !== 'serial')
    const header = exportCols.map(c => c.label).join(',')
    const rows = local.map(company =>
      exportCols.map(col => {
        const v = company[col.key] || ''
        return typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))
          ? `"${v.replace(/"/g, '""')}"`
          : v
      }).join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `companies-${new Date().toISOString().split('T')[0]}.csv`
    link.click(); URL.revokeObjectURL(url)
  }

  function exportXLSX() {
    // Simple TSV download (opens cleanly in Excel)
    const exportCols = COLUMNS.filter(c => c.type !== 'serial')
    const header = exportCols.map(c => c.label).join('\t')
    const rows = local.map(company => exportCols.map(col => (company[col.key] || '')).join('\t'))
    const tsv = [header, ...rows].join('\n')
    const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `companies-${new Date().toISOString().split('T')[0]}.xls`
    link.click(); URL.revokeObjectURL(url)
  }

  const filteredRows = local.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (c.name || '').toLowerCase().includes(q) ||
           (c.classification || '').toLowerCase().includes(q) ||
           (c.headquarters || '').toLowerCase().includes(q)
  })

  const allSelected = filteredRows.length > 0 && filteredRows.every(c => selected.includes(c.id))

  return (
    <div style={s.overlay}>
      <div style={s.container}>

        {/* Toolbar */}
        <div style={s.toolbar}>
          <div>
            <p style={s.eyebrow}>COMPANIES</p>
            <h2 style={s.title}>{filteredRows.length}<span style={s.unit}> companies</span></h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…" style={s.searchInput}
            />

            {autofillMsg && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: autofillMsg.startsWith('Done') ? '#4a7c59' : 'var(--accent)', fontWeight: '600', whiteSpace: 'nowrap' }}>{autofillMsg}</span>}

            <button onClick={autofillSelected} disabled={autofilling} style={{ ...s.btn, opacity: autofilling ? 0.5 : 1 }}>
              ↯ Autofill{selected.length ? ` (${selected.length})` : ' All'}
            </button>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={exportCSV} style={s.exportBtn}>CSV ↓</button>
              <button onClick={exportXLSX} style={s.exportBtn}>XLS ↓</button>
            </div>

            <button onClick={onClose} style={s.closeBtn}>✕ Close</button>
          </div>
        </div>

        {/* Selected banner */}
        {selected.length > 0 && (
          <div style={s.selectedBanner}>
            {selected.length} selected ·{' '}
            <button onClick={() => setSelected([])} style={{ ...s.bannerAction, color: 'var(--text-muted)' }}>Clear</button>
          </div>
        )}

        {/* Table */}
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...th, width: '40px', position: 'sticky', top: 0, zIndex: 11 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                </th>
                {columns.map((col, i) => (
                  <ResizableHeader key={col.key} col={col} colIndex={i} onResize={handleResize} />
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((company, rowIdx) => {
                const isSelected = selected.includes(company.id)
                const isSaving = saving === company.id
                return (
                  <tr key={company.id} style={{
                    background: isSelected ? 'rgba(168,100,72,0.06)' : rowIdx % 2 === 0 ? 'var(--bg)' : 'var(--surface)',
                    borderBottom: '1px solid var(--border-subtle)',
                    opacity: isSaving ? 0.7 : 1,
                    transition: 'background 0.1s',
                  }}>
                    <td style={{ ...td, width: '40px', textAlign: 'center' }}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(company.id)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                    </td>
                    {columns.map(col => (
                      <td key={col.key} style={{ ...td, width: col.width + 'px', maxWidth: col.width + 'px' }}>
                        {col.type === 'serial' ? (
                          <div style={cell.readonly}>{rowIdx + 1}</div>
                        ) : (
                          <EditableCell
                            company={company} col={col}
                            onSave={handleSave}
                            isEditing={editingCell?.rowId === company.id && editingCell?.colKey === col.key}
                            onStartEdit={() => setEditingCell({ rowId: company.id, colKey: col.key })}
                            onStopEdit={() => setEditingCell(null)}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredRows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '400', letterSpacing: '-0.03em', color: 'var(--text-secondary)', marginBottom: '6px' }}>No companies match.</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>Clear your search to see all.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>Click any cell to edit · Drag header edge to resize · Double-click to auto-size</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{filteredRows.length} of {local.length} shown</span>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 900, display: 'flex', flexDirection: 'column' },
  container: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid rgba(253,253,253,0.08)', background: '#1d1b1b', flexShrink: 0, gap: '10px', flexWrap: 'wrap' },
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'rgba(253,253,253,0.35)', marginBottom: '4px', textTransform: 'uppercase' },
  title: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '400', color: 'rgba(253,253,253,0.95)', letterSpacing: '-0.04em', lineHeight: 1 },
  unit: { fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '400', color: 'rgba(253,253,253,0.35)' },
  searchInput: { padding: '7px 12px', background: 'rgba(253,253,253,0.07)', border: '1px solid rgba(253,253,253,0.12)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(253,253,253,0.85)', outline: 'none', width: '180px' },
  btn: { padding: '7px 14px', background: 'var(--accent)', border: 'none', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: '#fdfdfd', cursor: 'pointer', whiteSpace: 'nowrap' },
  exportBtn: { padding: '7px 12px', background: 'rgba(253,253,253,0.07)', border: '1px solid rgba(253,253,253,0.12)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.04em', color: 'rgba(253,253,253,0.55)', cursor: 'pointer' },
  closeBtn: { padding: '7px 14px', background: 'transparent', border: '1px solid rgba(253,253,253,0.15)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: 'rgba(253,253,253,0.45)', cursor: 'pointer' },
  selectedBanner: { padding: '7px 24px', background: 'rgba(168,100,72,0.06)', borderBottom: '1px solid rgba(168,100,72,0.15)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.04em', color: 'var(--text)', flexShrink: 0 },
  bannerAction: { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.04em', padding: 0 },
  tableWrap: { flex: 1, overflow: 'auto' },
  table: { borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 },
}

const th = {
  padding: '9px 12px', background: 'var(--surface)', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)',
  fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase',
  textAlign: 'left', userSelect: 'none', whiteSpace: 'nowrap', position: 'relative',
}

const td = { padding: 0, height: '40px', overflow: 'hidden', verticalAlign: 'middle', borderBottom: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)' }

const cell = {
  readonly: { padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', height: '40px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  text: { padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)', height: '40px', display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  input: { width: '100%', height: '40px', padding: '0 12px', border: 'none', borderTop: '2px solid var(--accent)', borderBottom: '2px solid var(--accent)', background: 'rgba(168,100,72,0.06)', fontFamily: 'inherit', fontSize: '12px', color: 'var(--text)', outline: 'none' },
  select: { width: '100%', height: '40px', padding: '0 12px', border: 'none', borderTop: '2px solid var(--accent)', borderBottom: '2px solid var(--accent)', background: 'rgba(168,100,72,0.06)', fontFamily: 'inherit', fontSize: '12px', color: 'var(--text)', outline: 'none', cursor: 'pointer' },
  link: { padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', height: '40px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  empty: { padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', height: '40px', display: 'flex', alignItems: 'center', cursor: 'pointer' },
}
