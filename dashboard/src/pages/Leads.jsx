import React, { useState, useEffect } from 'react'
import { getLeads, updateLead, deleteLead, starLead, updateConnectionStatus } from '../services/api'
import Navbar from '../components/Navbar'
import SpreadsheetView from '../components/SpreadsheetView'

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'disqualified']

const CONNECTION_STATUSES = [
  'Not Requested',
  'Connection Request Sent',
  'First Message Sent',
  'Follow-up 1',
  'Follow-up 2',
  'Follow-up 3',
  'Connected',
  'Not Interested',
  'No Response',
  'Transferred to Rahul',
  'Transferred to Rejah',
]

const DECISION_MAKER_KEYWORDS = /\b(ceo|cto|ciso|coo|cfo|founder|co-founder|cofounder|president|vice president|vp|director|head of|chief|managing director|md|partner|principal|owner|general manager|gm|svp|evp|senior vice|senior director)\b/i

const SECURITY_KEYWORDS = /\b(ciso|chief information security|cybersecurity|infosec|information security officer|grc manager|grc analyst|risk manager|compliance manager|compliance officer|vapt|penetration tester|penetration testing|vulnerability|security analyst|security engineer|security architect|security consultant|security manager|security director|security lead|soc analyst|siem|devsecops|cloud security engineer|network security|it security|cyber analyst|cyber engineer)\b/i

const statusColors = {
  new: 'var(--white)',
  contacted: 'var(--amber)',
  qualified: 'var(--green)',
  disqualified: 'var(--gray-4)',
}

const connectionStatusColors = {
  'Not Requested': 'var(--gray-4)',
  'Connection Request Sent': 'var(--amber)',
  'First Message Sent': 'var(--amber)',
  'Follow-up 1': 'var(--amber)',
  'Follow-up 2': 'var(--amber)',
  'Follow-up 3': 'var(--amber)',
  'Connected': 'var(--green)',
  'Not Interested': '#ff2d2d',
  'No Response': 'var(--gray-4)',
  'Transferred to Rahul': '#00d4ff',
  'Transferred to Rejah': '#00d4ff',
}

function BulkActionBar({ count, onClearSelection, onDelete, onExport, onStatusChange, onConnectionChange }) {
  const [showStatus, setShowStatus] = useState(false)
  const [showConnection, setShowConnection] = useState(false)

  return React.createElement(
    'div',
    { style: bulk.bar },
    React.createElement(
      'div',
      { style: bulk.left },
      React.createElement('span', { style: bulk.count }, count + ' selected'),
      React.createElement('button', { style: bulk.clearBtn, onClick: onClearSelection }, '✕ Clear')
    ),
    React.createElement(
      'div',
      { style: bulk.actions },
      React.createElement('button', { style: bulk.actionBtn, onClick: onExport }, 'Export →'),
      React.createElement(
        'div',
        { style: { position: 'relative' } },
        React.createElement(
          'button',
          { style: bulk.actionBtn, onClick: () => { setShowStatus(!showStatus); setShowConnection(false) } },
          'Set Status ↓'
        ),
        showStatus && React.createElement(
          'div',
          { style: bulk.dropdown },
          STATUS_OPTIONS.map(s =>
            React.createElement(
              'button',
              { key: s, style: bulk.dropdownItem, onClick: () => { onStatusChange(s); setShowStatus(false) } },
              s.toUpperCase()
            )
          )
        )
      ),
      React.createElement(
        'div',
        { style: { position: 'relative' } },
        React.createElement(
          'button',
          { style: bulk.actionBtn, onClick: () => { setShowConnection(!showConnection); setShowStatus(false) } },
          'Set Connection ↓'
        ),
        showConnection && React.createElement(
          'div',
          { style: { ...bulk.dropdown, width: '220px' } },
          CONNECTION_STATUSES.map(s =>
            React.createElement(
              'button',
              { key: s, style: bulk.dropdownItem, onClick: () => { onConnectionChange(s); setShowConnection(false) } },
              s
            )
          )
        )
      ),
      React.createElement(
        'button',
        { style: { ...bulk.actionBtn, color: '#ff2d2d', borderColor: '#ff2d2d' }, onClick: onDelete },
        'Delete Selected'
      )
    )
  )
}

function StarButton({ starred, onClick }) {
  return React.createElement(
    'button',
    {
      onClick,
      style: {
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '14px', color: starred ? 'var(--amber)' : 'var(--gray-3)',
        padding: '2px 4px', transition: 'color 0.15s', flexShrink: 0,
      }
    },
    starred ? '★' : '☆'
  )
}

function ConnectionStatusDropdown({ status, onChange }) {
  const color = connectionStatusColors[status] || 'var(--gray-4)'
  return React.createElement(
    'select',
    {
      value: status || 'Not Requested',
      onChange: (e) => onChange(e.target.value),
      onClick: (e) => e.stopPropagation(),
      style: {
        background: 'var(--gray-1)', border: '1px solid var(--gray-2)',
        borderRadius: '3px', color, fontSize: '10px', fontWeight: '600',
        letterSpacing: '0.5px', padding: '3px 6px', cursor: 'pointer',
        fontFamily: 'inherit', maxWidth: '160px', outline: 'none',
      }
    },
    CONNECTION_STATUSES.map((s) => React.createElement('option', { key: s, value: s }, s))
  )
}

function ViewLink({ url }) {
  return React.createElement('a', { href: url, style: sub.link, onClick: (e) => e.stopPropagation() }, 'VIEW →')
}

function StatusBadge({ status }) {
  const color = statusColors[status] || 'var(--white)'
  return React.createElement('span', { style: { ...sub.badge, color, borderColor: color } }, (status || 'new').toUpperCase())
}

function CellInput({ value, onChange, onBlur, onKeyDown }) {
  return React.createElement('input', { value, onChange, onBlur, onKeyDown, autoFocus: true, style: sub.cellInput })
}

function CellSelect({ value, onChange, onBlur }) {
  return React.createElement(
    'select',
    { value, onChange, onBlur, autoFocus: true, style: sub.cellSelect },
    STATUS_OPTIONS.map((s) => React.createElement('option', { key: s, value: s }, s))
  )
}

function LeadRow({ lead, columns, editingCell, editValue, setEditValue, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onEnrich, onStar, onConnectionStatus, enrichingId, isSelected, onToggleSelect }) {
  const isEnriching = enrichingId === lead.id
  const isDecisionMaker = DECISION_MAKER_KEYWORDS.test(lead.title || '')
  const isSecurity = SECURITY_KEYWORDS.test(lead.title || '')

  return (
    <div style={{ ...s.trow, background: isSelected ? 'rgba(255,255,255,0.03)' : 'transparent', borderLeft: lead.starred ? '2px solid var(--amber)' : '2px solid transparent' }}>
      <div style={{ width: '32px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <input type="checkbox" checked={isSelected} onChange={onToggleSelect} style={sub.checkbox} onClick={(e) => e.stopPropagation()} />
      </div>
      <div style={{ width: '28px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <StarButton starred={lead.starred} onClick={(e) => { e.stopPropagation(); onStar(lead.id, !lead.starred) }} />
      </div>
      <div style={{ width: '60px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
        {isDecisionMaker && <span style={{ fontSize: '8px', fontWeight: '700', padding: '1px 5px', borderRadius: '2px', background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid #00d4ff', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>DM</span>}
        {isSecurity && <span style={{ fontSize: '8px', fontWeight: '700', padding: '1px 5px', borderRadius: '2px', background: 'rgba(255,45,45,0.1)', color: '#ff2d2d', border: '1px solid #ff2d2d', letterSpacing: '0.5px' }}>SEC</span>}
      </div>
      {columns.map((col) => {
        const isEditing = editingCell && editingCell.leadId === lead.id && editingCell.field === col.key
        return (
          <div key={col.key} style={{ ...s.td, flex: col.flex, cursor: 'text' }} onClick={() => onStartEdit(lead.id, col.key, lead[col.key])}>
            {isEditing && col.key === 'status' && <CellSelect value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => onSaveEdit(lead.id)} />}
            {isEditing && col.key !== 'status' && <CellInput value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => onSaveEdit(lead.id)} onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(lead.id); if (e.key === 'Escape') onCancelEdit() }} />}
            {!isEditing && col.key === 'status' && <StatusBadge status={lead.status} />}
            {!isEditing && col.key === 'name' && <span style={{ fontSize: '13px', color: 'var(--white)', fontWeight: '500' }}>{lead.name || '—'}</span>}
            {!isEditing && col.key !== 'status' && col.key !== 'name' && <span style={{ fontSize: '12px', color: 'var(--gray-5)' }}>{lead[col.key] || '—'}</span>}
          </div>
        )
      })}
      <div style={{ width: '170px', flexShrink: 0, display: 'flex', alignItems: 'center', paddingRight: '8px' }}>
        <ConnectionStatusDropdown status={lead.connection_status || 'Not Requested'} onChange={(val) => onConnectionStatus(lead.id, val)} />
      </div>
      <div style={{ width: '100px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        {lead.profile_url && <ViewLink url={lead.profile_url} />}
        {!lead.email && (
          <button style={{ fontSize: '11px', color: isEnriching ? 'var(--gray-4)' : 'var(--amber)', background: 'transparent', border: '1px solid var(--gray-2)', borderRadius: '3px', cursor: 'pointer', fontWeight: '700', padding: '2px 6px' }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEnrich(lead.id) }}>
            {isEnriching ? '...' : 'Enrich'}
          </button>
        )}
        {lead.email && <span style={{ fontSize: '10px', color: 'var(--green)', fontWeight: '700' }}>✓</span>}
        <button style={sub.deleteBtn} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(lead.id) }}>✕</button>
      </div>
    </div>
  )
}

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewFilter, setViewFilter] = useState('all')
  const [starredOnly, setStarredOnly] = useState(false)
  const [showSpreadsheet, setShowSpreadsheet] = useState(false)
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [selected, setSelected] = useState([])
  const [enrichingId, setEnrichingId] = useState(null)
  const [enrichMsg, setEnrichMsg] = useState('')

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

  async function handleBulkDelete() {
    if (!window.confirm('Delete ' + selected.length + ' selected leads?')) return
    try {
      await Promise.all(selected.map(id => deleteLead(id)))
      setLeads((prev) => prev.filter((l) => !selected.includes(l.id)))
      setSelected([])
    } catch (e) { console.error(e) }
  }

  async function handleBulkStatus(status) {
    try {
      await Promise.all(selected.map(id => updateLead(id, { status })))
      setLeads((prev) => prev.map((l) => selected.includes(l.id) ? { ...l, status } : l))
      setSelected([])
    } catch (e) { console.error(e) }
  }

  async function handleBulkConnectionStatus(connection_status) {
    try {
      await Promise.all(selected.map(id => updateConnectionStatus(id, connection_status)))
      setLeads((prev) => prev.map((l) => selected.includes(l.id) ? { ...l, connection_status } : l))
      setSelected([])
    } catch (e) { console.error(e) }
  }

  async function handleStar(leadId, starred) {
    try {
      await starLead(leadId, starred)
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, starred } : l))
    } catch (e) { console.error(e) }
  }

  async function handleConnectionStatus(leadId, connection_status) {
    try {
      await updateConnectionStatus(leadId, connection_status)
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, connection_status } : l))
    } catch (e) { console.error(e) }
  }

  async function handleEnrich(leadId) {
    setEnrichingId(leadId)
    setEnrichMsg('')
    try {
      const token = localStorage.getItem('token')
      const hunterKey = localStorage.getItem('hunterKey') || ''
      const apolloKey = localStorage.getItem('apolloKey') || ''
      const res = await fetch('http://localhost:8000/api/leads/' + leadId + '/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ hunter_key: hunterKey, apollo_key: apolloKey })
      })
      const data = await res.json()
      if (data.lead) {
        setLeads((prev) => prev.map((l) => l.id === leadId ? data.lead : l))
        setEnrichMsg(data.enriched ? '✓ Email found' : data.message || 'Not found')
      }
    } catch (e) { console.error(e) }
    finally {
      setEnrichingId(null)
      setTimeout(() => setEnrichMsg(''), 5000)
    }
  }

  // Filtered leads - defined before functions that use it
  const filtered = leads.filter((l) => {
    const ms = search === '' || [l.name, l.title, l.company, l.location].join(' ').toLowerCase().includes(search.toLowerCase())
    const mf = statusFilter === 'all' || l.status === statusFilter
    const mstar = !starredOnly || l.starred
    const titleText = (l.title || '').toLowerCase()
    const mv = viewFilter === 'all' ||
      (viewFilter === 'decision-makers' && DECISION_MAKER_KEYWORDS.test(titleText)) ||
      (viewFilter === 'security' && SECURITY_KEYWORDS.test(titleText))
    return ms && mf && mstar && mv
  })

  function toggleSelect(id) { setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]) }
  function toggleSelectAll() { setSelected(selected.length === filtered.length ? [] : filtered.map((l) => l.id)) }

  function handleExport(leadsToExport) {
    const toExport = leadsToExport || (selected.length ? filtered.filter((l) => selected.includes(l.id)) : filtered)
    const headers = ['Name', 'Title', 'Company', 'Location', 'Email', 'Status', 'Connection Status', 'Starred', 'Profile URL']
    const rows = toExport.map((l) => [l.name, l.title, l.company, l.location, l.email, l.status, l.connection_status, l.starred ? 'Yes' : 'No', l.profile_url])
    const csv = [headers, ...rows].map((r) => r.map((v) => '"' + (v || '') + '"').join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'leads.csv'
    a.click()
  }

  const starredCount = leads.filter(l => l.starred).length
  const decisionMakerCount = leads.filter(l => DECISION_MAKER_KEYWORDS.test((l.title || '').toLowerCase())).length
  const securityCount = leads.filter(l => SECURITY_KEYWORDS.test((l.title || '').toLowerCase())).length

  const columns = [
    { key: 'name', label: 'TARGET', flex: 2 },
    { key: 'title', label: 'HEADLINE / ROLE', flex: 2 },
    { key: 'company', label: 'COMPANY', flex: 2 },
    { key: 'location', label: 'LOCATION', flex: 1 },
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
            <span style={s.heroUnit}>{' targets'}</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {enrichMsg && <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: '600' }}>{enrichMsg}</span>}
          <button
            style={{ ...s.starFilterBtn, background: starredOnly ? 'var(--amber)' : 'transparent', color: starredOnly ? 'var(--black)' : 'var(--amber)', borderColor: 'var(--amber)' }}
            onClick={() => setStarredOnly(!starredOnly)} data-hover="true"
          >
            ★ {starredCount} STARRED
          </button>
          <button style={s.spreadsheetBtn} onClick={() => setShowSpreadsheet(true)} data-hover="true">⊞ Spreadsheet</button>
          <button style={s.exportBtn} onClick={() => handleExport()} data-hover="true">Export all →</button>
        </div>
      </div>

      <div style={s.container}>

        {/* Bulk action bar — appears when leads are selected */}
        {selected.length > 0 && (
          <BulkActionBar
            count={selected.length}
            onClearSelection={() => setSelected([])}
            onDelete={handleBulkDelete}
            onExport={() => handleExport(filtered.filter(l => selected.includes(l.id)))}
            onStatusChange={handleBulkStatus}
            onConnectionChange={handleBulkConnectionStatus}
          />
        )}

        {/* View filter tabs */}
        <div style={s.viewTabs}>
          {[
            { key: 'all', label: 'ALL LEADS', count: leads.length },
            { key: 'decision-makers', label: 'DECISION MAKERS', count: decisionMakerCount },
            { key: 'security', label: 'SECURITY', count: securityCount },
          ].map(tab => (
            <button key={tab.key} onClick={() => setViewFilter(tab.key)}
              style={{ ...s.viewTab, ...(viewFilter === tab.key ? s.viewTabActive : {}) }} data-hover="true">
              {tab.label}
              <span style={{ ...s.viewTabCount, background: viewFilter === tab.key ? 'rgba(0,0,0,0.2)' : 'var(--gray-2)', color: viewFilter === tab.key ? 'var(--black)' : 'var(--gray-4)' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search and status filters */}
        <div style={s.filters}>
          <div style={s.searchBox}>
            <span style={s.searchIcon}>↗</span>
            <input type="text" placeholder="Search targets..." value={search} onChange={(e) => setSearch(e.target.value)} style={s.searchInput} data-hover="true" />
          </div>
          <div style={s.filterTabs}>
            {['all', ...STATUS_OPTIONS].map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)} style={{ ...s.filterTab, ...(statusFilter === f ? s.filterTabActive : {}) }} data-hover="true">
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={s.table}>
          <div style={s.thead}>
            <div style={{ width: '32px', flexShrink: 0 }}>
              <input type="checkbox" onChange={toggleSelectAll} checked={selected.length === filtered.length && filtered.length > 0} style={sub.checkbox} />
            </div>
            <div style={{ width: '28px', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', color: 'var(--gray-4)' }}>★</span>
            </div>
            <div style={{ width: '60px', flexShrink: 0 }}>
              <span style={{ fontSize: '9px', color: 'var(--gray-4)', letterSpacing: '1px' }}>TYPE</span>
            </div>
            {columns.map((col) => (
              <span key={col.key} style={{ ...s.th, flex: col.flex }}>{col.label}</span>
            ))}
            <span style={{ ...s.th, width: '170px', flexShrink: 0 }}>CONNECTION</span>
            <span style={{ ...s.th, width: '100px', flexShrink: 0 }}>ACTIONS</span>
          </div>

          {loading && <p style={s.empty}>Loading...</p>}
          {!loading && filtered.length === 0 && (
            <p style={s.empty}>
              {viewFilter === 'decision-makers' ? 'No decision makers found. Extract more leads or adjust filters.' :
               viewFilter === 'security' ? 'No security leads found.' :
               starredOnly ? 'No starred leads. Click ☆ to star a lead.' : 'No targets found.'}
            </p>
          )}
          {!loading && filtered.map((lead) => (
            <LeadRow
              key={lead.id} lead={lead} columns={columns}
              editingCell={editingCell} editValue={editValue} setEditValue={setEditValue}
              onStartEdit={startEdit} onSaveEdit={saveEdit} onCancelEdit={() => setEditingCell(null)}
              onDelete={handleDelete} onStar={handleStar} onConnectionStatus={handleConnectionStatus}
              onEnrich={handleEnrich} enrichingId={enrichingId}
              isSelected={selected.includes(lead.id)} onToggleSelect={() => toggleSelect(lead.id)}
            />
          ))}
        </div>
      </div>

      {showSpreadsheet && (
        <SpreadsheetView
          leads={leads}
          onClose={() => setShowSpreadsheet(false)}
          onRefresh={async () => {
            await fetchLeads()
            setShowSpreadsheet(false)
            setTimeout(() => setShowSpreadsheet(true), 150)
          }}
          onLeadUpdate={(id, data) => { setLeads(prev => prev.map(l => l.id === id ? { ...l, ...data } : l)) }}
        />
      )}
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: 'var(--black)' },
  hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '48px 32px 32px', borderBottom: '1px solid var(--gray-2)' },
  eyebrow: { fontSize: '11px', fontWeight: '600', letterSpacing: '4px', color: 'var(--gray-4)', marginBottom: '12px' },
  heroTitle: { fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: '900', letterSpacing: '-2px', color: 'var(--white)', lineHeight: 1 },
  heroUnit: { fontSize: 'clamp(20px, 2.5vw, 32px)', fontWeight: '300', color: 'var(--gray-4)', letterSpacing: '-1px' },
  starFilterBtn: { padding: '8px 16px', border: '1px solid', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', letterSpacing: '1px', fontFamily: 'inherit', transition: 'all 0.15s' },
  spreadsheetBtn: { padding: '10px 20px', background: 'transparent', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '13px', fontWeight: '600', color: 'var(--gray-4)', cursor: 'pointer', fontFamily: 'inherit' },
  exportBtn: { padding: '10px 24px', background: 'var(--white)', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '700', color: 'var(--black)', cursor: 'pointer' },
  container: { padding: '24px 32px' },
  viewTabs: { display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' },
  viewTab: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'transparent', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', color: 'var(--gray-4)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  viewTabActive: { background: 'var(--white)', color: 'var(--black)', border: '1px solid var(--white)' },
  viewTabCount: { padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' },
  filters: { display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', flex: 1, minWidth: '200px' },
  searchIcon: { padding: '0 14px', color: 'var(--gray-4)', fontSize: '16px' },
  searchInput: { flex: 1, padding: '11px 14px 11px 0', background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--white)' },
  filterTabs: { display: 'flex', gap: '4px' },
  filterTab: { padding: '8px 14px', background: 'transparent', border: '1px solid var(--gray-2)', borderRadius: '4px', color: 'var(--gray-4)', fontSize: '10px', fontWeight: '600', letterSpacing: '1px', cursor: 'pointer', fontFamily: 'inherit' },
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
  deleteBtn: { fontSize: '11px', color: 'var(--gray-4)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '700', padding: '2px 4px' },
  checkbox: { cursor: 'pointer', accentColor: 'var(--white)' },
  cellInput: { width: '100%', padding: '4px 8px', border: '1px solid var(--gray-3)', borderRadius: '2px', fontSize: '12px', outline: 'none', background: 'var(--gray-2)', color: 'var(--white)' },
  cellSelect: { padding: '4px 8px', border: '1px solid var(--gray-3)', borderRadius: '2px', fontSize: '12px', outline: 'none', background: 'var(--gray-2)', color: 'var(--white)' },
}

const bulk = {
  bar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 20px', background: 'var(--gray-1)', border: '1px solid var(--amber)',
    borderRadius: '4px', marginBottom: '16px', gap: '16px',
  },
  left: { display: 'flex', alignItems: 'center', gap: '12px' },
  count: { fontSize: '13px', fontWeight: '700', color: 'var(--amber)', letterSpacing: '0.5px' },
  clearBtn: { background: 'none', border: 'none', color: 'var(--gray-4)', fontSize: '11px', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit' },
  actions: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  actionBtn: {
    padding: '7px 14px', background: 'transparent', border: '1px solid var(--gray-2)',
    borderRadius: '4px', fontSize: '11px', fontWeight: '600', color: 'var(--white)',
    cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.5px',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, marginTop: '4px',
    background: 'var(--gray-1)', border: '1px solid var(--gray-2)',
    borderRadius: '4px', zIndex: 100, minWidth: '160px',
    display: 'flex', flexDirection: 'column',
  },
  dropdownItem: {
    padding: '10px 14px', background: 'none', border: 'none',
    color: 'var(--white)', fontSize: '11px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    borderBottom: '1px solid var(--gray-2)',
  },
}