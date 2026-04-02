import { useState, useEffect } from 'react'
import { getLeads, updateLead, deleteLead } from '../services/api'
import Navbar from '../components/Navbar'

const STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'disqualified']

const statusColors = {
  new: { background: '#eff6ff', color: '#2563eb' },
  contacted: { background: '#fefce8', color: '#854d0e' },
  qualified: { background: '#f0fdf4', color: '#166534' },
  disqualified: { background: '#f3f4f6', color: '#6b7280' },
}

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {
    try {
      const res = await getLeads()
      setLeads(res.data.leads)
    } catch (err) {
      console.error('Failed to fetch leads', err)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(leadId, field, value) {
    setEditingCell({ leadId, field })
    setEditValue(value || '')
  }

  async function saveEdit(leadId) {
    if (!editingCell) return
    try {
      await updateLead(leadId, { [editingCell.field]: editValue })
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, [editingCell.field]: editValue } : l
        )
      )
    } catch (err) {
      console.error('Failed to update lead', err)
    } finally {
      setEditingCell(null)
    }
  }

  async function handleDelete(leadId) {
    if (!window.confirm('Delete this lead?')) return
    try {
      await deleteLead(leadId)
      setLeads((prev) => prev.filter((l) => l.id !== leadId))
    } catch (err) {
      console.error('Failed to delete lead', err)
    }
  }

  function handleExport() {
    const headers = ['Name', 'Title', 'Company', 'Location', 'Email', 'Status', 'Profile URL']
    const rows = filtered.map((l) => [
      l.name, l.title, l.company, l.location,
      l.email, l.status, l.profile_url
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => '"' + (v || '') + '"').join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads.csv'
    a.click()
  }

  const filtered = leads.filter((l) => {
    const matchSearch =
      search === '' ||
      [l.name, l.title, l.company, l.location]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase())
    const matchStatus =
      statusFilter === 'all' || l.status === statusFilter
    return matchSearch && matchStatus
  })

  const columns = [
    { key: 'name', label: 'Name', flex: 2 },
    { key: 'title', label: 'Title', flex: 2 },
    { key: 'company', label: 'Company', flex: 2 },
    { key: 'location', label: 'Location', flex: 2 },
    { key: 'email', label: 'Email', flex: 2 },
    { key: 'status', label: 'Status', flex: 1 },
  ]

  function renderCell(lead, col) {
    const isEditing = editingCell && editingCell.leadId === lead.id && editingCell.field === col.key
    if (isEditing) {
      if (col.key === 'status') {
        return (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveEdit(lead.id)}
            autoFocus
            style={styles.cellSelect}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )
      }
      return (
        <input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveEdit(lead.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit(lead.id)
            if (e.key === 'Escape') setEditingCell(null)
          }}
          autoFocus
          style={styles.cellInput}
        />
      )
    }
    if (col.key === 'status') {
      const colors = statusColors[lead.status] || statusColors.new
      return (
        <span style={{ ...styles.badge, ...colors }}>
          {lead.status || 'new'}
        </span>
      )
    }
    return (
      <span style={styles.cellText}>{lead[col.key] || '—'}</span>
    )
  }

  function renderActions(lead) {
    const profileUrl = lead.profile_url
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {profileUrl && renderViewLink(profileUrl)}
        <button
          style={styles.deleteBtn}
          onClick={(e) => { e.stopPropagation(); handleDelete(lead.id) }}
        >
          Delete
        </button>
      </div>
    )
  }

  function renderViewLink(url) {
    const linkStyle = styles.actionLink
    const handleClick = (e) => e.stopPropagation()
    return (
      <a href={url} style={linkStyle} onClick={handleClick}>
        View
      </a>
    )
  }
  
  return (
    <div style={styles.page}>
      <Navbar />
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Leads</h1>
            <p style={styles.subtitle}>{filtered.length} leads found</p>
          </div>
          <button style={styles.exportBtn} onClick={handleExport}>
            Export CSV
          </button>
        </div>

        <div style={styles.filters}>
          <input
            type="text"
            placeholder="Search by name, title, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div style={styles.tableWrapper}>
          <div style={styles.tableHeader}>
            {columns.map((col) => (
              <span key={col.key} style={{ ...styles.headerCell, flex: col.flex }}>
                {col.label}
              </span>
            ))}
            <span style={{ ...styles.headerCell, flex: 1 }}>Actions</span>
          </div>

          {loading && <p style={styles.empty}>Loading leads...</p>}
          {!loading && filtered.length === 0 && (
            <p style={styles.empty}>No leads found.</p>
          )}
          {!loading && filtered.map((lead) => (
            <div key={lead.id} style={styles.tableRow}>
              {columns.map((col) => (
                <div
                  key={col.key}
                  style={{ ...styles.cell, flex: col.flex }}
                  onClick={() => startEdit(lead.id, col.key, lead[col.key])}
                >
                  {renderCell(lead, col)}
                </div>
              ))}
              <div style={{ ...styles.cell, flex: 1 }}>
                {renderActions(lead)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f9fafb' },
  container: { maxWidth: '1300px', margin: '0 auto', padding: '32px 24px' },
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: '24px',
  },
  title: { fontSize: '24px', fontWeight: '600', color: '#111827', margin: '0 0 4px' },
  subtitle: { fontSize: '13px', color: '#6b7280', margin: 0 },
  exportBtn: {
    padding: '8px 18px', background: '#2563eb', color: 'white',
    border: 'none', borderRadius: '8px', fontSize: '13px',
    fontWeight: '600', cursor: 'pointer',
  },
  filters: { display: 'flex', gap: '12px', marginBottom: '16px' },
  searchInput: {
    flex: 1, padding: '9px 14px', borderRadius: '8px',
    border: '1px solid #d1d5db', fontSize: '13px', outline: 'none',
  },
  select: {
    padding: '9px 14px', borderRadius: '8px',
    border: '1px solid #d1d5db', fontSize: '13px',
    background: 'white', outline: 'none', cursor: 'pointer',
  },
  tableWrapper: {
    background: '#ffffff', border: '1px solid #e5e7eb',
    borderRadius: '12px', overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex', padding: '10px 16px',
    background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
  },
  headerCell: {
    fontSize: '11px', fontWeight: '600',
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  tableRow: {
    display: 'flex', padding: '0 16px',
    borderBottom: '1px solid #f3f4f6', alignItems: 'center',
    minHeight: '48px',
  },
  cell: {
    padding: '4px 8px 4px 0',
    cursor: 'text', display: 'flex', alignItems: 'center',
  },
  cellText: { fontSize: '13px', color: '#111827' },
  cellInput: {
    width: '100%', padding: '4px 8px', border: '1px solid #2563eb',
    borderRadius: '4px', fontSize: '13px', outline: 'none',
  },
  cellSelect: {
    padding: '4px 8px', border: '1px solid #2563eb',
    borderRadius: '4px', fontSize: '13px', outline: 'none',
  },
  badge: {
    padding: '2px 10px', borderRadius: '99px',
    fontSize: '11px', fontWeight: '600',
  },
  actionLink: {
    fontSize: '12px', color: '#2563eb',
    textDecoration: 'none', fontWeight: '500',
  },
  deleteBtn: {
    fontSize: '12px', color: '#ef4444', background: 'transparent',
    border: 'none', cursor: 'pointer', fontWeight: '500',
  },
  empty: { color: '#9ca3af', fontSize: '13px', padding: '24px 16px' },
}