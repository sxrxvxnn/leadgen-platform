import React, { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { getLeads, updateLead, deleteLead, starLead, updateConnectionStatus, scoreLeadICP, draftEmail } from '../services/api'
import Navbar from '../components/Navbar'
import SpreadsheetView from '../components/SpreadsheetView'
import { SkeletonRow } from '../components/Skeleton'

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
  new:          { color: '#4a7c59', background: 'rgba(74,124,89,0.10)',  border: 'rgba(74,124,89,0.22)' },
  contacted:    { color: '#a86448', background: 'rgba(168,100,72,0.10)', border: 'rgba(168,100,72,0.22)' },
  qualified:    { color: '#5b8db8', background: 'rgba(91,141,184,0.10)', border: 'rgba(91,141,184,0.22)' },
  disqualified: { color: '#a1a1a1', background: 'rgba(161,161,161,0.10)', border: 'rgba(161,161,161,0.22)' },
}

const connectionStatusColors = {
  'Not Requested':           'var(--text-muted)',
  'Connection Request Sent': 'var(--accent)',
  'First Message Sent':      'var(--accent)',
  'Follow-up 1':             'var(--accent)',
  'Follow-up 2':             'var(--accent)',
  'Follow-up 3':             'var(--accent)',
  'Connected':               '#4a7c59',
  'Not Interested':          'var(--red)',
  'No Response':             'var(--text-muted)',
  'Transferred to Rahul':    '#5b8db8',
  'Transferred to Rejah':    '#5b8db8',
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
        { style: { ...bulk.actionBtn, color: 'var(--red)', borderColor: 'rgba(184,50,50,0.4)' }, onClick: onDelete },
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
        fontSize: '14px', color: starred ? 'var(--accent)' : 'var(--border-strong)',
        padding: '2px 4px', transition: 'color 0.15s', flexShrink: 0,
      }
    },
    starred ? '★' : '☆'
  )
}

function ConnectionStatusDropdown({ status, onChange }) {
  const color = connectionStatusColors[status] || 'var(--text-muted)'
  return React.createElement(
    'select',
    {
      value: status || 'Not Requested',
      onChange: (e) => onChange(e.target.value),
      onClick: (e) => e.stopPropagation(),
      style: {
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '5px', color, fontSize: '10px', fontWeight: '600',
        letterSpacing: '0.3px', padding: '3px 6px', cursor: 'pointer',
        fontFamily: 'inherit', maxWidth: '160px', outline: 'none',
      }
    },
    CONNECTION_STATUSES.map((s) => React.createElement('option', { key: s, value: s }, s))
  )
}

function ViewLink({ url }) {
  return React.createElement('a', { href: url, target: '_blank', rel: 'noopener noreferrer', style: sub.link, onClick: (e) => e.stopPropagation() }, 'VIEW →')
}

function EnrichProfileLink({ url }) {
  return React.createElement(
    'a',
    {
      href: url,
      target: '_blank',
      rel: 'noopener noreferrer',
      title: 'Open in LinkedIn — then click "Update this lead" in the Sonar extension',
      style: { ...sub.link, color: 'var(--accent)', borderColor: 'var(--accent-dim)' },
      onClick: (e) => e.stopPropagation()
    },
    'ENRICH ↗'
  )
}

function StatusBadge({ status }) {
  const st = statusColors[status] || statusColors.new
  return React.createElement('span', { style: { fontSize: '10px', fontWeight: '500', padding: '2px 8px', borderRadius: '4px', color: st.color, background: st.background, border: `1px solid ${st.border}` } }, status || 'new')
}

function IcpScoreBadge({ score, reason }) {
  if (score == null) return null
  const color = score >= 70 ? '#4a7c59' : score >= 40 ? '#a86448' : '#a1a1a1'
  const bg    = score >= 70 ? 'rgba(74,124,89,0.10)' : score >= 40 ? 'rgba(168,100,72,0.10)' : 'rgba(161,161,161,0.08)'
  const border= score >= 70 ? 'rgba(74,124,89,0.3)' : score >= 40 ? 'rgba(168,100,72,0.3)' : 'rgba(161,161,161,0.25)'
  return React.createElement(
    'span',
    { title: reason || '', style: { fontSize: '9px', fontWeight: '700', padding: '2px 5px', borderRadius: '4px', color, background: bg, border: `1px solid ${border}`, letterSpacing: '0.04em', cursor: reason ? 'help' : 'default', whiteSpace: 'nowrap' } },
    score
  )
}

function EmailDraftModal({ lead, draft, onClose }) {
  const [copied, setCopied] = React.useState(false)
  if (!draft) return null

  function copy(text) {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return React.createElement(
    'div',
    { style: { position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(29,27,27,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }, onClick: onClose },
    React.createElement(
      'div',
      { style: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '600px', padding: '28px', boxShadow: '0 20px 60px rgba(29,27,27,0.2)', maxHeight: '90vh', overflowY: 'auto' }, onClick: e => e.stopPropagation() },
      // Header
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' } },
        React.createElement('div', null,
          React.createElement('p', { style: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px' } }, 'Draft outreach'),
          React.createElement('p', { style: { fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '400', letterSpacing: '-0.02em', color: 'var(--text)' } }, lead.name || 'Lead')
        ),
        React.createElement('button', { onClick: onClose, style: { background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1, padding: '4px' } }, '✕')
      ),
      // Subject
      React.createElement('div', { style: { marginBottom: '16px' } },
        React.createElement('p', { style: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' } }, 'Subject'),
        React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          React.createElement('p', { style: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', flex: 1, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', margin: 0 } }, draft.subject),
          React.createElement('button', { onClick: () => copy(draft.subject), style: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' } }, 'Copy')
        )
      ),
      // Body
      React.createElement('div', { style: { marginBottom: '20px' } },
        React.createElement('p', { style: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' } }, 'Email body'),
        React.createElement('pre', { style: { fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text)', lineHeight: 1.7, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, draft.body)
      ),
      // Copy all button
      React.createElement('button', {
        onClick: () => copy(`Subject: ${draft.subject}\n\n${draft.body}`),
        style: { width: '100%', padding: '12px', background: copied ? '#4a7c59' : 'var(--text)', color: '#FFFFFF', border: 'none', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em', cursor: 'pointer', transition: 'background 0.2s' }
      }, copied ? '✓ Copied to clipboard' : 'Copy entire email')
    )
  )
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

function LeadRow({ lead, columns, editingCell, editValue, setEditValue, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onEnrich, onStar, onConnectionStatus, enrichingId, isSelected, onToggleSelect, onScore, onDraft, scoringId, draftingId }) {
  const isEnriching = enrichingId === lead.id
  const isScoring   = scoringId === lead.id
  const isDrafting  = draftingId === lead.id
  const isDecisionMaker = DECISION_MAKER_KEYWORDS.test(lead.title || '')
  const isSecurity = SECURITY_KEYWORDS.test(lead.title || '')

  return (
    <div style={{ ...s.trow, background: isSelected ? 'rgba(168,100,72,0.04)' : 'transparent', borderLeft: lead.starred ? '2px solid var(--accent)' : '2px solid transparent' }}>
      <div style={{ width: '32px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <input type="checkbox" checked={isSelected} onChange={onToggleSelect} style={sub.checkbox} onClick={(e) => e.stopPropagation()} />
      </div>
      <div style={{ width: '28px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <StarButton starred={lead.starred} onClick={(e) => { e.stopPropagation(); onStar(lead.id, !lead.starred) }} />
      </div>
      <div style={{ width: '80px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
        {isDecisionMaker && <span style={{ fontSize: '8px', fontWeight: '600', padding: '1px 5px', borderRadius: '3px', background: 'rgba(91,141,184,0.10)', color: '#5b8db8', border: '1px solid rgba(91,141,184,0.3)', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>DM</span>}
        {isSecurity && <span style={{ fontSize: '8px', fontWeight: '600', padding: '1px 5px', borderRadius: '3px', background: 'rgba(184,50,50,0.10)', color: 'var(--red)', border: '1px solid rgba(184,50,50,0.3)', letterSpacing: '0.3px' }}>SEC</span>}
        <IcpScoreBadge score={lead.icp_score} reason={lead.icp_score_reason} />
      </div>
      {columns.map((col) => {
        const isEditing = editingCell && editingCell.leadId === lead.id && editingCell.field === col.key
        return (
          <div key={col.key} style={{ ...s.td, flex: col.flex, cursor: 'text' }} onClick={() => onStartEdit(lead.id, col.key, lead[col.key])}>
            {isEditing && col.key === 'status' && <CellSelect value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => onSaveEdit(lead.id)} />}
            {isEditing && col.key !== 'status' && <CellInput value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => onSaveEdit(lead.id)} onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(lead.id); if (e.key === 'Escape') onCancelEdit() }} />}
            {!isEditing && col.key === 'status' && <StatusBadge status={lead.status} />}
            {!isEditing && col.key === 'name' && <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '500' }}>{lead.name || '—'}</span>}
            {!isEditing && col.key !== 'status' && col.key !== 'name' && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{lead[col.key] || '—'}</span>}
          </div>
        )
      })}
      <div style={{ width: '170px', flexShrink: 0, display: 'flex', alignItems: 'center', paddingRight: '8px' }}>
        <ConnectionStatusDropdown status={lead.connection_status || 'Not Requested'} onChange={(val) => onConnectionStatus(lead.id, val)} />
      </div>
      <div style={{ width: '190px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
        {lead.profile_url && !lead.about && <EnrichProfileLink url={lead.profile_url} />}
        {lead.profile_url && lead.about && <ViewLink url={lead.profile_url} />}
        {!lead.email && (
          <button style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: isEnriching ? 'var(--text-muted)' : 'var(--accent)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', padding: '2px 6px' }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEnrich(lead.id) }}>
            {isEnriching ? '…' : 'Email'}
          </button>
        )}
        <button
          title={lead.icp_score != null ? `ICP score: ${lead.icp_score} — click to refresh` : 'Score against ICP'}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: isScoring ? 'var(--text-muted)' : '#5b8db8', background: 'transparent', border: '1px solid rgba(91,141,184,0.3)', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', padding: '2px 6px' }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onScore(lead.id) }}>
          {isScoring ? '…' : 'Score'}
        </button>
        <button
          title="Draft outreach email"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: isDrafting ? 'var(--text-muted)' : '#4a7c59', background: 'transparent', border: '1px solid rgba(74,124,89,0.3)', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', padding: '2px 6px' }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDraft(lead.id) }}>
          {isDrafting ? '…' : 'Draft'}
        </button>
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
  const [scoringId, setScoringId] = useState(null)
  const [draftingId, setDraftingId] = useState(null)
  const [emailDraft, setEmailDraft] = useState(null)   // { lead, subject, body }


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
    // Optimistic: remove immediately, restore on failure
    setLeads(prev => prev.filter(l => l.id !== leadId))
    setSelected(prev => prev.filter(id => id !== leadId))
    try {
      await deleteLead(leadId)
    } catch (e) { console.error(e); fetchLeads() }
  }

  async function handleBulkDelete() {
    if (!window.confirm('Delete ' + selected.length + ' selected leads?')) return
    const ids = [...selected]
    // Optimistic: remove immediately, restore on failure
    setLeads(prev => prev.filter(l => !ids.includes(l.id)))
    setSelected([])
    try {
      await Promise.all(ids.map(id => deleteLead(id)))
    } catch (e) { console.error(e); fetchLeads() }
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
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, starred } : l))
    try {
      await starLead(leadId, starred)
    } catch (e) {
      console.error(e)
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, starred: !starred } : l))
    }
  }

  async function handleConnectionStatus(leadId, connection_status) {
    const prev_status = leads.find(l => l.id === leadId)?.connection_status
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, connection_status } : l))
    try {
      await updateConnectionStatus(leadId, connection_status)
    } catch (e) {
      console.error(e)
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, connection_status: prev_status } : l))
    }
  }

  async function handleEnrich(leadId) {
    setEnrichingId(leadId)
    setEnrichMsg('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:8000/api/leads/' + leadId + '/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({})
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

  async function handleScoreICP(leadId) {
    setScoringId(leadId)
    try {
      const res = await scoreLeadICP(leadId)
      const { score, reason } = res.data
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, icp_score: score, icp_score_reason: reason } : l))
    } catch (e) { console.error(e) }
    finally { setScoringId(null) }
  }

  async function handleDraftEmail(leadId) {
    setDraftingId(leadId)
    try {
      const lead = leads.find(l => l.id === leadId)
      const res = await draftEmail(leadId)
      setEmailDraft({ lead, subject: res.data.subject, body: res.data.body })
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, email_draft: res.data.body, email_draft_subject: res.data.subject } : l))
    } catch (e) { console.error(e) }
    finally { setDraftingId(null) }
  }

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

      <motion.div style={s.hero} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
        <div style={{ position: 'relative' }}>
          <p style={s.eyebrow}>Lead Intelligence</p>
          <h1 style={s.heroTitle}>
            {filtered.length}
            <span style={s.heroUnit}>{' targets'}</span>
          </h1>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: '10px', alignItems: 'center' }}>
          {enrichMsg && <span style={{ fontSize: '12px', color: '#4a7c59', fontWeight: '500' }}>{enrichMsg}</span>}
          <button
            style={{ ...s.starFilterBtn, background: starredOnly ? 'var(--accent)' : 'transparent', color: starredOnly ? 'var(--bg)' : 'var(--accent)', borderColor: 'rgba(168,100,72,0.4)' }}
            onClick={() => setStarredOnly(!starredOnly)}
          >
            ★ {starredCount} starred
          </button>
          <button style={s.spreadsheetBtn} onClick={() => setShowSpreadsheet(true)}>⊞ Spreadsheet</button>
          <button style={s.exportBtn} onClick={() => handleExport()}>Export all →</button>
        </div>
      </motion.div>

      <div style={s.container}>

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

        <div style={s.viewTabs}>
          {[
            { key: 'all', label: 'All leads', count: leads.length },
            { key: 'decision-makers', label: 'Decision Makers', count: decisionMakerCount },
            { key: 'security', label: 'Security', count: securityCount },
          ].map(tab => (
            <button key={tab.key} onClick={() => setViewFilter(tab.key)}
              style={{ ...s.viewTab, ...(viewFilter === tab.key ? s.viewTabActive : {}) }}>
              {tab.label}
              <span style={{ ...s.viewTabCount, background: viewFilter === tab.key ? 'rgba(29,27,27,0.10)' : 'var(--surface-raised)', color: viewFilter === tab.key ? 'var(--bg)' : 'var(--text-muted)' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div style={s.filters}>
          <div style={s.searchBox}>
            <span style={s.searchIcon}>↗</span>
            <input type="text" placeholder="Search targets..." value={search} onChange={(e) => setSearch(e.target.value)} style={s.searchInput} />
          </div>
          <div style={s.filterTabs}>
            {['all', ...STATUS_OPTIONS].map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)} style={{ ...s.filterTab, ...(statusFilter === f ? s.filterTabActive : {}) }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div style={s.table}>
          <div style={s.thead}>
            <div style={{ width: '32px', flexShrink: 0 }}>
              <input type="checkbox" onChange={toggleSelectAll} checked={selected.length === filtered.length && filtered.length > 0} style={sub.checkbox} />
            </div>
            <div style={{ width: '28px', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>★</span>
            </div>
            <div style={{ width: '80px', flexShrink: 0 }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px' }}>TYPE / ICP</span>
            </div>
            {columns.map((col) => (
              <span key={col.key} style={{ ...s.th, flex: col.flex }}>{col.label}</span>
            ))}
            <span style={{ ...s.th, width: '170px', flexShrink: 0 }}>CONNECTION</span>
            <span style={{ ...s.th, width: '190px', flexShrink: 0 }}>ACTIONS</span>
          </div>

          {loading && [...Array(8)].map((_, i) => <SkeletonRow key={i} cols={[0.3, 0.5, 2, 2, 2, 1.5, 1.5, 1]} />)}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '72px 20px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                {viewFilter === 'decision-makers' ? 'No decision makers.' :
                 viewFilter === 'security' ? 'No security leads.' :
                 starredOnly ? 'Nothing starred yet.' : 'No targets found.'}
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                {viewFilter !== 'all' ? 'Try switching to All leads or adjusting filters.' :
                 leads.length === 0 ? 'Use the Chrome extension on LinkedIn to extract your first leads.' :
                 'Clear your search to see all leads.'}
              </p>
            </div>
          )}
          {!loading && filtered.map((lead, i) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.035, 0.5), ease: 'easeOut' }}
            >
              <LeadRow
                lead={lead} columns={columns}
                editingCell={editingCell} editValue={editValue} setEditValue={setEditValue}
                onStartEdit={startEdit} onSaveEdit={saveEdit} onCancelEdit={() => setEditingCell(null)}
                onDelete={handleDelete} onStar={handleStar} onConnectionStatus={handleConnectionStatus}
                onEnrich={handleEnrich} enrichingId={enrichingId}
                onScore={handleScoreICP} scoringId={scoringId}
                onDraft={handleDraftEmail} draftingId={draftingId}
                isSelected={selected.includes(lead.id)} onToggleSelect={() => toggleSelect(lead.id)}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {emailDraft && (
        <EmailDraftModal
          lead={emailDraft.lead}
          draft={{ subject: emailDraft.subject, body: emailDraft.body }}
          onClose={() => setEmailDraft(null)}
        />
      )}

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
  page: { minHeight: '100vh', background: 'var(--bg)' },
  hero: { position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '64px 48px 40px', borderBottom: '1px solid var(--border)', overflow: 'hidden' },
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' },
    heroTitle: { fontFamily: 'var(--font-display)', fontSize: 'clamp(64px, 9vw, 112px)', fontWeight: '900', letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1 },
  heroUnit: { fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4.5vw, 56px)', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '-0.03em' },
  starFilterBtn: { padding: '8px 14px', border: '1px solid', borderRadius: '7px', fontSize: '10px', fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s', letterSpacing: '0.04em' },
  spreadsheetBtn: { padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '10px', fontWeight: '500', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' },
  exportBtn: { padding: '8px 14px', background: 'var(--text)', border: 'none', borderRadius: '7px', fontSize: '10px', fontWeight: '600', color: '#FFFFFF', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' },
  container: { padding: '20px 48px' },
  viewTabs: { display: 'flex', gap: '2px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' },
  viewTab: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'transparent', border: 'none', fontSize: '11px', fontWeight: '400', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'color 0.15s', borderRadius: '5px' },
  viewTabActive: { background: 'var(--text)', color: '#FFFFFF' },
  viewTabCount: { padding: '1px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: '600' },
  filters: { display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', flex: 1, minWidth: '200px' },
  searchIcon: { padding: '0 12px', color: 'var(--text-muted)', fontSize: '14px' },
  searchInput: { flex: 1, padding: '9px 12px 9px 0', background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' },
  filterTabs: { display: 'flex', gap: '2px' },
  filterTab: { padding: '6px 11px', background: 'transparent', border: '1px solid transparent', borderRadius: '5px', color: 'var(--text-muted)', fontSize: '10px', fontWeight: '500', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s', letterSpacing: '0.04em' },
  filterTabActive: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' },
  table: { background: 'var(--bg)', border: '1px solid rgba(196,193,189,0.5)', borderRadius: '0', overflow: 'hidden' },
  thead: { display: 'flex', padding: '10px 20px', background: 'var(--surface)', borderBottom: '1px solid rgba(196,193,189,0.4)', alignItems: 'center' },
  th: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' },
  trow: { display: 'flex', padding: '0 20px', borderTop: '1px solid rgba(196,193,189,0.35)', alignItems: 'center', minHeight: '50px', transition: 'background 0.1s' },
  td: { padding: '4px 8px 4px 0', display: 'flex', alignItems: 'center' },
  empty: { padding: '40px 20px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' },
}

const sub = {
  link: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.06em', color: 'var(--text-muted)', textDecoration: 'none' },
  deleteBtn: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '500', padding: '2px 4px' },
  checkbox: { cursor: 'pointer', accentColor: 'var(--accent)' },
  cellInput: { width: '100%', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: '5px', fontSize: '12px', outline: 'none', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' },
  cellSelect: { padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: '5px', fontSize: '12px', outline: 'none', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' },
}

const bulk = {
  bar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', background: 'var(--surface)', border: '1px solid rgba(168,100,72,0.3)',
    borderRadius: '7px', marginBottom: '16px', gap: '16px',
  },
  left: { display: 'flex', alignItems: 'center', gap: '12px' },
  count: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', color: 'var(--accent)', letterSpacing: '0.06em' },
  clearBtn: { background: 'none', border: 'none', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.04em', cursor: 'pointer' },
  actions: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  actionBtn: {
    padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)',
    borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '500',
    letterSpacing: '0.04em', color: 'var(--text-secondary)', cursor: 'pointer',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, marginTop: '4px',
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '8px', zIndex: 100, minWidth: '160px',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(29,27,27,0.08)',
  },
  dropdownItem: {
    padding: '9px 14px', background: 'none', border: 'none',
    fontFamily: 'var(--font-mono)', color: 'var(--text)', fontSize: '10px', fontWeight: '500',
    letterSpacing: '0.04em', cursor: 'pointer', textAlign: 'left',
    borderBottom: '1px solid var(--border)',
  },
}
