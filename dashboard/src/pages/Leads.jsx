import React, { useState, useEffect } from 'react'
import { getLeads, updateLead, deleteLead } from '../services/api'
import Navbar from '../components/Navbar'

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'disqualified']

const statusColors = {
  new: 'var(--white)',
  contacted: 'var(--amber)',
  qualified: 'var(--green)',
  disqualified: 'var(--gray-4)',
}

function ViewLink({ url }) {
  return React.createElement(
    'a',
    { href: url, style: sub.link, onClick: (e) => e.stopPropagation() },
    'VIEW →'
  )
}

function StatusBadge({ status }) {
  const color = statusColors[status] || 'var(--white)'
  return React.createElement(
    'span',
    { style: { ...sub.badge, color, borderColor: color } },
    (status || 'new').toUpperCase()
  )
}

function CellInput({ value, onChange, onBlur, onKeyDown }) {
  return React.createElement('input', {
    value, onChange, onBlur, onKeyDown,
    autoFocus: true,
    style: sub.cellInput,
  })
}

function CellSelect({ value, onChange, onBlur }) {
  return React.createElement(
    'select',
    { value, onChange, onBlur, autoFocus: true, style: sub.cellSelect },
    STATUS_OPTIONS.map((s) => React.createElement('option', { key: s, value: s }, s))
  )
}

function LeadRow({ lead, columns, editingCell, editValue, setEditValue, onStartEdit, onSaveEdit, onCancelEdit, onDelete, isSelected, onToggleSelect }) {
  return (
    <div style={{ ...s.trow, background: isSelected ? 'var(--gray-1)' : 'transparent' }}>
      <div style={{ width: '40px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <input type="checkbox" checked={isSelected} onChange={onToggleSelect} style={sub.checkbox} onClick={(e) => e.stopPropagation()} />
      </div>
      {columns.map((col) => {
        const isEditing = editingCell && editingCell.leadId === lead.id && editingCell.field === col.key
        return (
          <div key={col.key} style={{ ...s.td, flex: col.flex, cursor: 'text' }} onClick={() => onStartEdit(lead.id, col.key, lead[col.key])}>
            {isEditing && col.key === 'status' && (
              <CellSelect value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => onSaveEdit(lead.id)} />
            )}
            {isEditing && col.key !== 'status' && (
              <CellInput
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => onSaveEdit(lead.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(lead.id); if (e.key === 'Escape') onCancelEdit() }}
              />
            )}
            {!isEditing && col.key === 'status' && <StatusBadge status={lead.status} />}
            {!isEditing && col.key === 'name' && (
              <span style={{ fontSize: '13px', color: 'var(--white)', fontWeight: '500' }}>{lead.name || '—'}</span>
            )}
            {!isEditing && col.key !== 'status' && col.key !== 'name' && (
              <span style={{ fontSize: '13px', color: 'var(--gray-5)' }}>{lead[col.key] || '—'}</span>
            )}
          </div>
        )
      })}
      <div style={{ width: '80px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
        {lead.profile_url && <ViewLink url={lead.profile_url} />}
        <button style={sub.deleteBtn} onClick={(e) => { e.stopPropagation(); onDelete(lead.id) }}>✕</button>
      </div>
    </div>
  )
}

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [selected, setSelected] = useState([])

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    try {
      const res = await getLeads()
      setLeads(res.data.leads)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function startEdit(leadId, field, value) { setEditingCell({ leadId, field }); setEditValue(value || '') }

  async function saveEdit(leadId) {
    if (!editingCell) return
    try {
      await updateLead(leadId, { [editingCell.field]: editValue })
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, [editingCell.field]: editValue } : l))
    } catch (e) { console.error(e) }
    finally { setEditingCell(null) }
  }

  async function handleDelete(leadId) {
    if (!window.confirm('Delete this lead?')) return
    try {
      await deleteLead(leadId)
      setLeads((prev) => prev.filter((l) => l.id !== leadId))
      setSelected((prev) => prev.filter((id) => id !== leadId))
    } catch (e) { console.error(e) }
  }

  function toggleSelect(id) { setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]) }
  function toggleSelectAll() { setSelected(selected.length === filtered.length ? [] : filtered.map((l) => l.id)) }

  function handleExport() {
    const rows = (selected.length ? filtered.filter((l) => selected.includes(l.id)) : filtered)
      .map((l) => [l.name, l.title, l.company, l.location, l.email, l.status, l.profile_url])
    const csv = [['Name', 'Title', 'Company', 'Location', 'Email', 'Status', 'Profile URL'], ...rows]
      .map((r) => r.map((v) => '"' + (v || '') + '"').join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'leads.csv'
    a.click()
  }

  const filtered = leads.filter((l) => {
    const ms = search === '' || [l.name, l.title, l.company, l.location].join(' ').toLowerCase().includes(search.toLowerCase())
    const mf = statusFilter === 'all' || l.status === statusFilter
    return ms && mf
  })

  const columns = [
    { key: 'name', label: 'TARGET', flex: 2 },
    { key: 'title', label: 'ROLE', flex: 2 },
    { key: 'company', label: 'COMPANY', flex: 2 },
    { key: 'location', label: 'LOCATION', flex: 2 },
    { key: 'email', label: 'EMAIL', flex: 2 },
    { key: 'status', label: 'STATUS', flex: 1 },
  ]

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.hero}>
        <div>
          <p style={s.eyebrow}>LEAD INTELLIGENCE</p>
          <h1 style={s.heroTitle}>
            {filtered.length}
            <span style={s.heroUnit}> targets{selected.length > 0 ? ', ' + selected.length + ' selected' : ''}</span>
          </h1>
        </div>
        <button style={s.exportBtn} onClick={handleExport} data-hover="true">
          Export {selected.length > 0 ? '(' + selected.length + ')' : 'all'} →
        </button>
      </div>

      <div style={s.container}>
        <div style={s.filters}>
          <div style={s.searchBox}>
            <span style={s.searchIcon}>↗</span>
            <input
              type="text"
              placeholder="Search targets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={s.searchInput}
              data-hover="true"
            />
          </div>
          <div style={s.filterTabs}>
            {['all', ...STATUS_OPTIONS].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{ ...s.filterTab, ...(statusFilter === f ? s.filterTabActive : {}) }}
                data-hover="true"
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={s.table}>
          <div style={s.thead}>
            <div style={{ width: '40px', flexShrink: 0 }}>
              <input type="checkbox" onChange={toggleSelectAll} checked={selected.length === filtered.length && filtered.length > 0} style={sub.checkbox} />
            </div>
            {columns.map((col) => (
              <span key={col.key} style={{ ...s.th, flex: col.flex }}>{col.label}</span>
            ))}
            <span style={{ ...s.th, width: '80px', flexShrink: 0 }}>ACTIONS</span>
          </div>

          {loading && <p style={s.empty}>Loading...</p>}
          {!loading && filtered.length === 0 && <p style={s.empty}>No targets found.</p>}
          {!loading && filtered.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              columns={columns}
              editingCell={editingCell}
              editValue={editValue}
              setEditValue={setEditValue}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={() => setEditingCell(null)}
              onDelete={handleDelete}
              isSelected={selected.includes(lead.id)}
              onToggleSelect={() => toggleSelect(lead.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: 'var(--black)' },
  hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '48px 32px 32px', borderBottom: '1px solid var(--gray-2)' },
  eyebrow: { fontSize: '11px', fontWeight: '600', letterSpacing: '4px', color: 'var(--gray-4)', marginBottom: '12px' },
  heroTitle: { fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: '900', letterSpacing: '-2px', color: 'var(--white)', lineHeight: 1 },
  heroUnit: { fontSize: 'clamp(20px, 2.5vw, 32px)', fontWeight: '300', color: 'var(--gray-4)', letterSpacing: '-1px' },
  exportBtn: { padding: '12px 24px', background: 'var(--white)', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '700', color: 'var(--black)', cursor: 'none' },
  container: { padding: '24px 32px' },
  filters: { display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', flex: 1, minWidth: '200px' },
  searchIcon: { padding: '0 14px', color: 'var(--gray-4)', fontSize: '16px' },
  searchInput: { flex: 1, padding: '11px 14px 11px 0', background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--white)' },
  filterTabs: { display: 'flex', gap: '4px' },
  filterTab: { padding: '8px 14px', background: 'transparent', border: '1px solid var(--gray-2)', borderRadius: '4px', color: 'var(--gray-4)', fontSize: '10px', fontWeight: '600', letterSpacing: '1px', cursor: 'none' },
  filterTabActive: { background: 'var(--white)', color: 'var(--black)', border: '1px solid var(--white)' },
  table: { background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', overflow: 'hidden' },
  thead: { display: 'flex', padding: '10px 24px', background: 'var(--black)', borderBottom: '1px solid var(--gray-2)', alignItems: 'center' },
  th: { fontSize: '9px', fontWeight: '600', letterSpacing: '2px', color: 'var(--gray-4)' },
  trow: { display: 'flex', padding: '0 24px', borderTop: '1px solid var(--gray-2)', alignItems: 'center', minHeight: '52px', transition: 'background 0.15s' },
  td: { padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center' },
  empty: { padding: '40px 24px', fontSize: '13px', color: 'var(--gray-4)' },
}

const sub = {
  link: { fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: 'var(--gray-4)', textDecoration: 'none' },
  badge: { fontSize: '9px', fontWeight: '700', letterSpacing: '1px', border: '1px solid', padding: '2px 8px', borderRadius: '2px' },
  deleteBtn: { fontSize: '11px', color: 'var(--gray-4)', background: 'transparent', border: 'none', cursor: 'none', fontWeight: '700', padding: '2px 4px' },
  checkbox: { cursor: 'pointer', accentColor: 'var(--white)' },
  cellInput: { width: '100%', padding: '4px 8px', border: '1px solid var(--gray-3)', borderRadius: '2px', fontSize: '12px', outline: 'none', background: 'var(--gray-2)', color: 'var(--white)' },
  cellSelect: { padding: '4px 8px', border: '1px solid var(--gray-3)', borderRadius: '2px', fontSize: '12px', outline: 'none', background: 'var(--gray-2)', color: 'var(--white)' },
}