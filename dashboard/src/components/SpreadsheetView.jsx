import React, { useState, useEffect, useRef } from 'react'
import { spreadsheetUpdateLead, autofillBulk } from '../services/api'

const CONNECTION_STATUSES = [
  'Not Requested', 'Connection Request Sent', 'First Message Sent',
  'Follow-up 1', 'Follow-up 2', 'Follow-up 3', 'Connected',
  'Not Interested', 'No Response', 'Transferred to Rahul', 'Transferred to Rejah',
]

const SECURITY_OPTIONS = ['Unknown', 'Yes', 'No']
const APPOINTMENT_OPTIONS = ['Unknown', 'Yes', 'No']
const COMPLIANCE_OPTIONS = ['', 'ISO 27001', 'SOC 2', 'GDPR', 'HIPAA', 'PCI DSS',
  'ISO + SOC2', 'ISO + GDPR', 'Multiple', 'OWASP', 'CERT-In', 'DPDP Act', 'RBI Guidelines', 'SEBI Guidelines']
const ORG_SIZE_OPTIONS = ['', '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']

const COLUMNS = [
  { key: '_serial', label: '#', width: 50, type: 'serial' },
  { key: 'created_at', label: 'Date Added', width: 110, type: 'date' },
  { key: 'first_name', label: 'First Name', width: 130, type: 'text' },
  { key: 'last_name', label: 'Last Name', width: 130, type: 'text' },
  { key: 'title', label: 'Title', width: 200, type: 'text' },
  { key: 'company', label: 'Company', width: 160, type: 'text' },
  { key: 'profile_url', label: 'LinkedIn URL', width: 180, type: 'url' },
  { key: 'employee_count', label: 'Employees', width: 110, type: 'text' },
  { key: 'org_size', label: 'Org Size', width: 120, type: 'select', options: ORG_SIZE_OPTIONS },
  { key: 'website', label: 'Website', width: 160, type: 'url' },
  { key: 'followers_count', label: 'Followers', width: 110, type: 'text' },
  { key: 'revenue', label: 'Revenue (USD M)', width: 140, type: 'text' },
  { key: 'has_security_team', label: 'Security Team?', width: 130, type: 'select', options: SECURITY_OPTIONS },
  { key: 'compliance', label: 'Compliance', width: 150, type: 'select', options: COMPLIANCE_OPTIONS },
  { key: 'appointment', label: 'Appointment', width: 130, type: 'select', options: APPOINTMENT_OPTIONS },
  { key: 'account_manager', label: 'Account Manager', width: 150, type: 'text' },
  { key: 'linkedin_status_rejah', label: 'LinkedIn (Rejah)', width: 190, type: 'select', options: CONNECTION_STATUSES },
  { key: 'linkedin_status_rahul', label: 'LinkedIn (Rahul)', width: 190, type: 'select', options: CONNECTION_STATUSES },
  { key: 'email', label: 'Email ID', width: 190, type: 'text' },
  { key: 'phone', label: 'Phone Number', width: 150, type: 'text' },
  { key: 'remarks', label: 'Remarks', width: 220, type: 'text' },
]

function getCellValue(lead, key) {
  if (key === '_serial') return ''
  if (key === 'created_at') {
    if (!lead.created_at) return ''
    return new Date(lead.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
  }
  return lead[key] || ''
}

function getStatusColor(status) {
  if (!status || status === 'Not Requested') return 'var(--text-muted)'
  if (status === 'Connected') return '#4a7c59'
  if (status === 'Not Interested' || status === 'No Response') return 'var(--text-muted)'
  if (status.includes('Transferred')) return '#5b8db8'
  return 'var(--accent)'
}

function EditableCell({ lead, col, onSave, isEditing, onStartEdit, onStopEdit }) {
  const [val, setVal] = useState(getCellValue(lead, col.key))
  const inputRef = useRef(null)

  useEffect(() => { setVal(getCellValue(lead, col.key)) }, [lead[col.key]])
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current.select) inputRef.current.select()
    }
  }, [isEditing])

  function handleSave() {
    const original = getCellValue(lead, col.key)
    if (val !== original) onSave(lead.id, col.key, val)
    onStopEdit()
  }

  if (col.type === 'serial') return React.createElement('div', { style: cell.readonly }, '')
  if (col.type === 'date') return React.createElement('div', { style: cell.readonly }, getCellValue(lead, col.key))

  if (col.type === 'url') {
    if (isEditing) {
      return React.createElement('input', {
        ref: inputRef, value: val,
        onChange: (e) => setVal(e.target.value),
        onBlur: handleSave,
        onKeyDown: (e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setVal(getCellValue(lead, col.key)); onStopEdit() } },
        style: cell.input,
      })
    }
    const displayVal = getCellValue(lead, col.key)
    if (!displayVal) return React.createElement('div', { style: cell.empty, onClick: onStartEdit }, '—')
    const shortUrl = displayVal.replace('https://www.linkedin.com/in/', '').replace('https://', '').split('/')[0]
    return React.createElement('a', { href: displayVal, style: cell.link, onClick: (e) => e.stopPropagation() }, shortUrl)
  }

  if (col.type === 'select') {
    if (isEditing) {
      return React.createElement('select', {
        ref: inputRef, value: val,
        onChange: (e) => { setVal(e.target.value); onSave(lead.id, col.key, e.target.value); onStopEdit() },
        onBlur: onStopEdit,
        style: cell.select,
      }, (col.options || []).map((opt) => React.createElement('option', { key: opt, value: opt }, opt || '—')))
    }
    const displayVal = getCellValue(lead, col.key)
    const isStatusCol = col.key.includes('linkedin_status')
    const isSecTeam = col.key === 'has_security_team'
    const isAppt = col.key === 'appointment'
    let color = 'var(--gray-5)'
    if (isStatusCol) color = getStatusColor(displayVal)
    else if ((isSecTeam || isAppt) && displayVal === 'Yes') color = 'var(--green)'
    else if ((isSecTeam || isAppt) && displayVal === 'No') color = 'var(--red)'
    return React.createElement('div', { style: { ...cell.text, color, cursor: 'pointer' }, onClick: onStartEdit }, displayVal || '—')
  }

  if (isEditing) {
    return React.createElement('input', {
      ref: inputRef, value: val,
      onChange: (e) => setVal(e.target.value),
      onBlur: handleSave,
      onKeyDown: (e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setVal(getCellValue(lead, col.key)); onStopEdit() } },
      style: cell.input,
    })
  }

  const displayVal = getCellValue(lead, col.key)
  return React.createElement('div', { style: { ...cell.text, cursor: 'text' }, onClick: onStartEdit },
    displayVal || React.createElement('span', { style: { color: 'var(--gray-3)' } }, '—')
  )
}

function ResizableHeader({ col, colIndex, onResize }) {
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  function handleMouseDown(e) {
    e.preventDefault(); e.stopPropagation()
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = col.width
    function onMouseMove(e) {
      if (!isResizing.current) return
      onResize(colIndex, Math.max(60, startWidth.current + e.clientX - startX.current))
    }
    function onMouseUp() {
      isResizing.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return React.createElement(
    'th',
    { style: { ...th, width: col.width + 'px', minWidth: col.width + 'px', position: 'sticky', top: 0, zIndex: 10 } },
    col.label,
    col.type !== 'serial' && React.createElement('div', {
      onMouseDown: handleMouseDown,
      onDoubleClick: () => onResize(colIndex, Math.max(80, col.label.length * 9 + 40)),
      style: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', background: 'transparent', zIndex: 1 },
      onMouseEnter: (e) => { e.target.style.background = 'var(--accent)' },
      onMouseLeave: (e) => { e.target.style.background = 'transparent' },
    })
  )
}

export default function SpreadsheetView({ leads, onClose, onLeadUpdate, onRefresh }) {
  const [localLeads, setLocalLeads] = useState(() => leads.map(l => ({ ...l })))
  const [columns, setColumns] = useState(COLUMNS)
  const [editingCell, setEditingCell] = useState(null)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [saving, setSaving] = useState(null)
  const [selected, setSelected] = useState([])
  const [viewFilter, setViewFilter] = useState('all')
  const [autofilling, setAutofilling] = useState(false)
  const [autofillMsg, setAutofillMsg] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const accountManager = localStorage.getItem('fullName') || ''

  useEffect(() => { setLocalLeads(leads.map(l => ({ ...l }))) }, [leads])

  useEffect(() => {
    if (!accountManager) return
    localLeads.forEach(lead => {
      if (!lead.account_manager) handleSave(lead.id, 'account_manager', accountManager)
    })
  }, [])

  function handleResize(colIndex, newWidth) {
    setColumns(prev => prev.map((col, i) => i === colIndex ? { ...col, width: newWidth } : col))
  }

  const companies = ['all', ...new Set(leads.map(l => l.company).filter(Boolean))]

  const DM_TITLES_SS = ['ceo', 'cto', 'cpo', 'ciso', 'vp', 'director', 'head of', 'founder', 'co-founder', 'president', 'managing director', 'general manager']
  const isDecisionMakerSS = (lead) => DM_TITLES_SS.some(t => (lead.title || '').toLowerCase().includes(t))
  const isSecuritySS = (lead) => ['ciso', 'security engineer', 'security analyst', 'infosec', 'information security', 'security'].some(t => (lead.title || '').toLowerCase().includes(t))

  const filtered = localLeads.filter(l => {
    const ms = search === '' || [l.name, l.first_name, l.last_name, l.title, l.company].join(' ').toLowerCase().includes(search.toLowerCase())
    const mc = companyFilter === 'all' || l.company === companyFilter
    if (viewFilter === 'dm' && !isDecisionMakerSS(l)) return false
    if (viewFilter === 'security' && !isSecuritySS(l)) return false
    if (viewFilter === 'starred' && !l.starred) return false
    return ms && mc
  })

  async function handleSave(leadId, field, value) {
    setSaving(leadId)
    try {
      await spreadsheetUpdateLead(leadId, { [field]: value })
      setLocalLeads(prev => prev.map(l => l.id === leadId ? { ...l, [field]: value } : l))
      if (onLeadUpdate) onLeadUpdate(leadId, { [field]: value })
    } catch (e) { console.error('Save failed:', e) }
    finally { setSaving(null) }
  }

  async function handleAutofill() {
    const toFill = selected.length > 0
      ? filtered.filter(l => selected.includes(l.id)).map(l => l.id)
      : filtered.map(l => l.id)
    if (toFill.length === 0) return
    setAutofilling(true)
    setAutofillMsg('Starting autofill...')
    const token = localStorage.getItem('token')
    const allUpdates = {}
    let batchStart = 0
    let totalProcessed = 0
    let hasMore = true
    while (hasMore) {
      try {
        const response = await fetch('http://localhost:8000/api/leads/autofill-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({
            lead_ids: toFill,
            batch_start: batchStart
          })
        })
        const data = await response.json()
        totalProcessed += data.processed || 0
        hasMore = data.has_more || false
        batchStart = data.next_batch_start || (batchStart + 20)
        setAutofillMsg('Processing ' + Math.min(batchStart, toFill.length) + '/' + toFill.length + '...')
        if (data.results && data.results.length > 0) {
          data.results.forEach(r => {
            if (r.data && Object.keys(r.data).length > 0) {
              allUpdates[r.lead_id] = { ...(allUpdates[r.lead_id] || {}), ...r.data }
            }
          })
        }
        if (hasMore) await new Promise(resolve => setTimeout(resolve, 1500))
      } catch (e) {
        console.error('Autofill batch error:', e)
        hasMore = false
      }
    }
    if (Object.keys(allUpdates).length > 0) {
      setLocalLeads(prev => [...prev.map(l => allUpdates[l.id] ? { ...l, ...allUpdates[l.id] } : l)])
      setTimeout(() => {
        Object.entries(allUpdates).forEach(([leadId, upd]) => {
          if (onLeadUpdate) onLeadUpdate(leadId, upd)
        })
        if (onRefresh) onRefresh()
      }, 200)
    }
    setAutofillMsg('Done — ' + totalProcessed + ' leads updated')
    setAutofilling(false)
    setTimeout(() => setAutofillMsg(''), 6000)
  }

  async function handleRefresh() {
    if (!onRefresh) return
    setRefreshing(true)
    setAutofillMsg('Refreshing...')
    try {
      await onRefresh()
    } catch (e) {
      console.error('Refresh failed:', e)
    } finally {
      setRefreshing(false)
      setAutofillMsg('')
    }
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    setSelected(selected.length === filtered.length ? [] : filtered.map(l => l.id))
  }

  function handleExport() {
    const toExport = selected.length ? filtered.filter(l => selected.includes(l.id)) : filtered
    const headers = columns.filter(c => c.key !== '_serial').map(c => c.label)
    const rows = toExport.map(lead => columns.filter(c => c.key !== '_serial').map(c => getCellValue(lead, c.key)))
    const csv = [headers, ...rows].map(r => r.map(v => '"' + (v || '') + '"').join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'leads_spreadsheet.csv'
    a.click()
  }

  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0) + 60

  return React.createElement(
    'div',
    { style: overlay, 'data-spreadsheet': 'true' },
    React.createElement(
      'div',
      { style: modal },

      // Header
      React.createElement(
        'div',
        { style: hdr.bar },
        React.createElement(
          'div',
          { style: hdr.left },
          React.createElement('p', { style: hdr.label }, 'SPREADSHEET VIEW'),
          React.createElement('h2', { style: hdr.title },
            filtered.length,
            React.createElement('span', { style: hdr.unit }, ' leads')
          )
        ),
        React.createElement(
          'div',
          { style: hdr.right },
          saving && React.createElement('span', { style: hdr.saving }, '● SAVING'),
          autofillMsg && React.createElement('span', {
            style: {
              fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em',
              color: autofillMsg.startsWith('Done') ? '#4a7c59' : autofillMsg.startsWith('Refresh') ? 'rgba(253,253,253,0.4)' : 'var(--accent)',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }
          }, autofillMsg),
          React.createElement('p', { style: { fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: 'rgba(253,253,253,0.3)', whiteSpace: 'nowrap' } },
            selected.length > 0 ? selected.length + ' selected' : 'Drag edge to resize'
          ),
          React.createElement('input', {
            type: 'text', placeholder: 'Search leads...',
            value: search, onChange: (e) => setSearch(e.target.value),
            style: hdr.input,
          }),
          React.createElement('select', {
            value: companyFilter,
            onChange: (e) => setCompanyFilter(e.target.value),
            style: hdr.select,
          }, companies.map(c => React.createElement('option', { key: c, value: c }, c === 'all' ? 'All companies' : c))),
          ...['all', 'dm', 'security', 'starred'].map(f =>
            React.createElement('button', {
              key: f,
              onClick: () => setViewFilter(f),
              style: {
                padding: '6px 12px',
                background: viewFilter === f ? 'rgba(253,253,253,0.15)' : 'transparent',
                border: `1px solid ${viewFilter === f ? 'rgba(253,253,253,0.2)' : 'rgba(253,253,253,0.1)'}`,
                borderRadius: '7px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: viewFilter === f ? '600' : '400',
                letterSpacing: '0.04em',
                color: viewFilter === f ? '#fdfdfd' : 'rgba(253,253,253,0.45)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }
            }, f === 'all' ? 'All' : f === 'dm' ? 'Decision Makers' : f === 'security' ? 'Security' : '★ Starred')
          ),
          React.createElement('button', {
            style: { ...hdr.autofillBtn, opacity: autofilling ? 0.6 : 1, cursor: autofilling ? 'not-allowed' : 'pointer' },
            onClick: handleAutofill,
            disabled: autofilling,
          }, autofilling ? 'Filling...' : 'Auto-fill'),
          React.createElement('button', {
            style: { ...hdr.closeBtn, color: 'var(--green)', borderColor: 'var(--green)', opacity: refreshing ? 0.6 : 1 },
            onClick: handleRefresh,
            disabled: refreshing,
          }, refreshing ? '...' : '↺ Refresh'),
          React.createElement('button', { style: hdr.exportBtn, onClick: handleExport },
            'Export ' + (selected.length > 0 ? '(' + selected.length + ')' : 'all') + ' →'
          ),
          React.createElement('button', { style: hdr.closeBtn, onClick: onClose }, '✕ Close')
        )
      ),

      // Table
      React.createElement(
        'div',
        { style: { overflowX: 'auto', overflowY: 'auto', flex: 1 } },
        React.createElement(
          'table',
          { style: { width: totalWidth + 'px', borderCollapse: 'collapse', tableLayout: 'fixed' } },
          React.createElement(
            'thead', null,
            React.createElement(
              'tr', null,
              React.createElement('th', { style: { ...th, width: '44px', position: 'sticky', top: 0, zIndex: 10 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: selected.length === filtered.length && filtered.length > 0,
                  onChange: toggleSelectAll,
                  style: { accentColor: 'var(--accent)', cursor: 'pointer' }
                })
              ),
              ...columns.map((col, colIndex) =>
                React.createElement(ResizableHeader, { key: col.key, col, colIndex, onResize: handleResize })
              )
            )
          ),
          React.createElement(
            'tbody', null,
            filtered.map((lead, rowIndex) =>
              React.createElement(
                'tr',
                {
                  key: lead.id,
                  style: {
                    background: selected.includes(lead.id)
                      ? 'rgba(168,100,72,0.06)'
                      : rowIndex % 2 === 0 ? 'var(--bg)' : 'var(--surface)',
                    borderLeft: lead.starred ? '3px solid var(--accent)' : '3px solid transparent',
                  }
                },
                React.createElement('td', { style: { ...td, width: '44px', textAlign: 'center' } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: selected.includes(lead.id),
                    onChange: () => toggleSelect(lead.id),
                    style: { accentColor: 'var(--accent)', cursor: 'pointer' }
                  })
                ),
                ...columns.map(col =>
                  React.createElement('td', {
                    key: col.key,
                    style: { ...td, width: col.width + 'px', minWidth: col.width + 'px' },
                  },
                    col.key === '_serial'
                      ? React.createElement('div', { style: cell.serial }, rowIndex + 1)
                      : React.createElement(EditableCell, {
                          lead, col,
                          onSave: handleSave,
                          isEditing: editingCell === lead.id + '_' + col.key,
                          onStartEdit: () => setEditingCell(lead.id + '_' + col.key),
                          onStopEdit: () => setEditingCell(null),
                        })
                  )
                )
              )
            )
          )
        )
      )
    )
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(29,27,27,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', flexDirection: 'column' }
const modal = { background: 'var(--bg)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }

const hdr = {
  bar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid rgba(253,253,253,0.08)', background: '#1d1b1b', flexShrink: 0, gap: '10px', flexWrap: 'wrap' },
  left: {},
  label: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'rgba(253,253,253,0.35)', marginBottom: '4px', textTransform: 'uppercase' },
  title: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '400', letterSpacing: '-0.04em', color: 'rgba(253,253,253,0.95)', lineHeight: 1 },
  unit: { fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '400', color: 'rgba(253,253,253,0.35)' },
  right: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  saving: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', fontWeight: '600', letterSpacing: '0.08em' },
  input: { padding: '7px 12px', background: 'rgba(253,253,253,0.07)', border: '1px solid rgba(253,253,253,0.12)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(253,253,253,0.85)', outline: 'none', width: '160px' },
  select: { padding: '7px 10px', background: 'rgba(253,253,253,0.07)', border: '1px solid rgba(253,253,253,0.12)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(253,253,253,0.75)', outline: 'none', cursor: 'pointer', letterSpacing: '0.04em' },
  autofillBtn: { padding: '7px 14px', background: 'var(--accent)', border: 'none', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', color: '#fdfdfd', whiteSpace: 'nowrap', cursor: 'pointer', letterSpacing: '0.04em' },
  exportBtn: { padding: '7px 14px', background: 'rgba(253,253,253,0.9)', border: 'none', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', color: '#1d1b1b', cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.04em' },
  closeBtn: { padding: '7px 12px', background: 'transparent', border: '1px solid rgba(253,253,253,0.15)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '400', color: 'rgba(253,253,253,0.5)', cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.04em' },
}

const th = { padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.1em', color: 'var(--text-muted)', background: 'var(--surface)', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap', userSelect: 'none', position: 'relative', textTransform: 'uppercase' }
const td = { padding: '0', borderBottom: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)', height: '40px', verticalAlign: 'middle', overflow: 'hidden' }

const cell = {
  text: { padding: '0 12px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', height: '40px', display: 'flex', alignItems: 'center' },
  readonly: { padding: '0 12px', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', height: '40px', display: 'flex', alignItems: 'center' },
  serial: { padding: '0 12px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', height: '40px' },
  empty: { padding: '0 12px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'text', height: '40px', display: 'flex', alignItems: 'center' },
  input: { width: '100%', height: '40px', padding: '0 12px', background: 'rgba(168,100,72,0.06)', border: 'none', borderTop: '2px solid var(--accent)', borderBottom: '2px solid var(--accent)', outline: 'none', fontSize: '12px', color: 'var(--text)', fontFamily: 'inherit' },
  select: { width: '100%', height: '40px', padding: '0 12px', background: 'rgba(168,100,72,0.06)', border: 'none', borderTop: '2px solid var(--accent)', borderBottom: '2px solid var(--accent)', outline: 'none', fontSize: '12px', color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer' },
  link: { padding: '0 12px', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', height: '40px', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
}