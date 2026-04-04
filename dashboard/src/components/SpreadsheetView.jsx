import React, { useState, useEffect, useRef, useCallback } from 'react'
import { spreadsheetUpdateLead } from '../services/api'

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

const SECURITY_OPTIONS = ['Unknown', 'Yes', 'No']
const COMPLIANCE_OPTIONS = ['', 'ISO 27001', 'SOC 2', 'GDPR', 'HIPAA', 'PCI DSS', 'ISO + SOC2', 'ISO + GDPR', 'Multiple']
const ORG_SIZE_OPTIONS = ['', '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']

const DEFAULT_COLUMNS = [
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
    return new Date(lead.created_at).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: '2-digit'
    })
  }
  return lead[key] || ''
}

function getStatusColor(status) {
  if (!status || status === 'Not Requested') return 'var(--gray-4)'
  if (status === 'Connected') return 'var(--green)'
  if (status === 'Not Interested' || status === 'No Response') return 'var(--gray-4)'
  if (status.includes('Transferred')) return '#00d4ff'
  return 'var(--amber)'
}

function EditableCell({ lead, col, onSave, isEditing, onStartEdit, onStopEdit }) {
  const [val, setVal] = useState(getCellValue(lead, col.key))
  const inputRef = useRef(null)

  useEffect(() => { setVal(getCellValue(lead, col.key)) }, [lead, col.key])
  useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus() }, [isEditing])

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
        onKeyDown: (e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onStopEdit() },
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
    const color = col.key.includes('linkedin_status') ? getStatusColor(displayVal) : 'var(--gray-5)'
    return React.createElement('div', { style: { ...cell.text, color, cursor: 'pointer' }, onClick: onStartEdit }, displayVal || '—')
  }

  if (isEditing) {
    return React.createElement('input', {
      ref: inputRef, value: val,
      onChange: (e) => setVal(e.target.value),
      onBlur: handleSave,
      onKeyDown: (e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onStopEdit() },
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
    e.preventDefault()
    e.stopPropagation()
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = col.width

    function onMouseMove(e) {
      if (!isResizing.current) return
      const diff = e.clientX - startX.current
      const newWidth = Math.max(60, startWidth.current + diff)
      onResize(colIndex, newWidth)
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

  function handleDoubleClick(e) {
    e.stopPropagation()
    // Auto-fit: set to a reasonable default based on label length
    const autoWidth = Math.max(80, col.label.length * 9 + 40)
    onResize(colIndex, autoWidth)
  }

  return React.createElement(
    'th',
    {
      style: {
        ...th,
        width: col.width + 'px',
        minWidth: col.width + 'px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }
    },
    col.label,
    col.type !== 'serial' && React.createElement(
      'div',
      {
        onMouseDown: handleMouseDown,
        onDoubleClick: handleDoubleClick,
        title: 'Drag to resize, double-click to auto-fit',
        style: {
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '5px',
          cursor: 'col-resize',
          background: 'transparent',
          zIndex: 1,
          transition: 'background 0.15s',
        },
        onMouseEnter: (e) => { e.target.style.background = 'var(--amber)' },
        onMouseLeave: (e) => { e.target.style.background = 'transparent' },
      }
    )
  )
}

export default function SpreadsheetView({ leads, onClose, onLeadUpdate }) {
  const [localLeads, setLocalLeads] = useState(leads)
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)
  const [editingCell, setEditingCell] = useState(null)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [saving, setSaving] = useState(null)
  const [selected, setSelected] = useState([])
  const accountManager = localStorage.getItem('fullName') || ''

  useEffect(() => { setLocalLeads(leads) }, [leads])

  useEffect(() => {
    if (!accountManager) return
    localLeads.forEach(lead => {
      if (!lead.account_manager) {
        handleSave(lead.id, 'account_manager', accountManager)
      }
    })
  }, [])

  function handleResize(colIndex, newWidth) {
    setColumns(prev => prev.map((col, i) => i === colIndex ? { ...col, width: newWidth } : col))
  }

  const companies = ['all', ...new Set(leads.map(l => l.company).filter(Boolean))]

  const filtered = localLeads.filter(l => {
    const ms = search === '' ||
      [l.name, l.first_name, l.last_name, l.title, l.company]
        .join(' ').toLowerCase()
        .includes(search.toLowerCase())
    const mc = companyFilter === 'all' || l.company === companyFilter
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
    { style: overlay },
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
          React.createElement('p', { style: { fontSize: '10px', color: 'var(--gray-4)', whiteSpace: 'nowrap' } },
            'Drag column edge to resize • Double-click to auto-fit'
          ),
          React.createElement('input', {
            type: 'text',
            placeholder: 'Search leads...',
            value: search,
            onChange: (e) => setSearch(e.target.value),
            style: hdr.input,
          }),
          React.createElement('select', {
            value: companyFilter,
            onChange: (e) => setCompanyFilter(e.target.value),
            style: hdr.select,
          }, companies.map(c => React.createElement('option', { key: c, value: c }, c === 'all' ? 'All companies' : c))),
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
            'thead',
            null,
            React.createElement(
              'tr',
              null,
              React.createElement('th', { style: { ...th, width: '44px', position: 'sticky', top: 0, zIndex: 10 } },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: selected.length === filtered.length && filtered.length > 0,
                  onChange: toggleSelectAll,
                  style: { accentColor: 'var(--white)', cursor: 'pointer' }
                })
              ),
              ...columns.map((col, colIndex) =>
                React.createElement(ResizableHeader, {
                  key: col.key,
                  col,
                  colIndex,
                  onResize: handleResize,
                })
              )
            )
          ),

          React.createElement(
            'tbody',
            null,
            filtered.map((lead, rowIndex) =>
              React.createElement(
                'tr',
                {
                  key: lead.id,
                  style: {
                    background: selected.includes(lead.id)
                      ? 'rgba(255,171,0,0.06)'
                      : rowIndex % 2 === 0 ? 'var(--black)' : 'rgba(255,255,255,0.02)',
                    borderLeft: lead.starred ? '3px solid var(--amber)' : '3px solid transparent',
                  }
                },
                React.createElement('td', { style: { ...td, width: '44px', textAlign: 'center' } },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: selected.includes(lead.id),
                    onChange: () => toggleSelect(lead.id),
                    style: { accentColor: 'var(--white)', cursor: 'pointer' }
                  })
                ),
                ...columns.map((col) =>
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

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.92)',
  zIndex: 1000, display: 'flex', flexDirection: 'column',
}

const modal = {
  background: 'var(--black)', flex: 1,
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
}

const hdr = {
  bar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 24px', borderBottom: '1px solid var(--gray-2)',
    background: 'var(--gray-1)', flexShrink: 0, gap: '12px', flexWrap: 'wrap',
  },
  left: {},
  label: { fontSize: '9px', fontWeight: '700', letterSpacing: '3px', color: 'var(--gray-4)', marginBottom: '4px' },
  title: { fontSize: '22px', fontWeight: '900', letterSpacing: '-1px', color: 'var(--white)', lineHeight: 1 },
  unit: { fontSize: '14px', fontWeight: '300', color: 'var(--gray-4)' },
  right: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  saving: { fontSize: '10px', color: 'var(--amber)', fontWeight: '700', letterSpacing: '2px' },
  input: {
    padding: '8px 14px', background: 'var(--black)',
    border: '1px solid var(--gray-2)', borderRadius: '4px',
    fontSize: '12px', color: 'var(--white)', outline: 'none',
    width: '180px', fontFamily: 'inherit',
  },
  select: {
    padding: '8px 12px', background: 'var(--black)',
    border: '1px solid var(--gray-2)', borderRadius: '4px',
    fontSize: '12px', color: 'var(--white)', outline: 'none',
    fontFamily: 'inherit', cursor: 'pointer',
  },
  exportBtn: {
    padding: '9px 18px', background: 'var(--white)', border: 'none',
    borderRadius: '4px', fontSize: '12px', fontWeight: '700',
    color: 'var(--black)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  closeBtn: {
    padding: '9px 16px', background: 'transparent',
    border: '1px solid var(--gray-2)', borderRadius: '4px',
    fontSize: '12px', fontWeight: '600', color: 'var(--gray-4)',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
}

const th = {
  padding: '10px 12px', fontSize: '10px', fontWeight: '700',
  letterSpacing: '0.5px', color: 'var(--gray-4)',
  background: 'var(--gray-1)', borderBottom: '2px solid var(--gray-2)',
  borderRight: '1px solid var(--gray-2)', textAlign: 'left',
  whiteSpace: 'nowrap', userSelect: 'none',
  position: 'relative',
}

const td = {
  padding: '0', borderBottom: '1px solid rgba(255,255,255,0.05)',
  borderRight: '1px solid rgba(255,255,255,0.04)',
  height: '44px', verticalAlign: 'middle', overflow: 'hidden',
}

const cell = {
  text: {
    padding: '0 12px', fontSize: '13px', color: 'var(--gray-5)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    height: '44px', display: 'flex', alignItems: 'center',
  },
  readonly: {
    padding: '0 12px', fontSize: '12px', color: 'var(--gray-4)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    height: '44px', display: 'flex', alignItems: 'center',
  },
  serial: {
    padding: '0 12px', fontSize: '12px', color: 'var(--gray-3)',
    display: 'flex', alignItems: 'center', height: '44px',
  },
  empty: {
    padding: '0 12px', fontSize: '13px', color: 'var(--gray-3)',
    cursor: 'text', height: '44px', display: 'flex', alignItems: 'center',
  },
  input: {
    width: '100%', height: '44px', padding: '0 12px',
    background: 'var(--gray-2)', border: 'none',
    borderTop: '2px solid var(--amber)', borderBottom: '2px solid var(--amber)',
    outline: 'none', fontSize: '13px', color: 'var(--white)', fontFamily: 'inherit',
  },
  select: {
    width: '100%', height: '44px', padding: '0 12px',
    background: 'var(--gray-2)', border: 'none',
    borderTop: '2px solid var(--amber)', borderBottom: '2px solid var(--amber)',
    outline: 'none', fontSize: '13px', color: 'var(--white)',
    fontFamily: 'inherit', cursor: 'pointer',
  },
  link: {
    padding: '0 12px', fontSize: '12px', color: '#00d4ff',
    textDecoration: 'none', height: '44px', display: 'flex', alignItems: 'center',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
}