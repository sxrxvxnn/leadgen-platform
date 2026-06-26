import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { getLeads, updateLead, deleteLead, bulkDeleteLeads, bulkScoreLeads, bulkEnrichLeads, starLead, updateConnectionStatus, scoreLeadICP, draftEmail, importLeadsCSV, exportLeadsCSV, listSequences, enrollInSequence, listSegments, createSegment, deleteSegment, bulkVerifyEmails, getUnverifiedCount } from '../services/api'
import SpreadsheetView from '../components/SpreadsheetView'
import { SkeletonRow } from '../components/Skeleton'
import LeadDrawer from '../components/LeadDrawer'
import PipelineView from '../components/PipelineView'

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

function BulkActionBar({ count, totalFiltered, onClearSelection, onSelectAll, onDelete, onExport, onStatusChange, onConnectionChange, onEnrollSequence, onScoreICP, onFindEmails, onVerifyEmails, loading, loadingLabel }) {
  const [showStatus, setShowStatus] = useState(false)
  const [showConnection, setShowConnection] = useState(false)
  const [showSequences, setShowSequences] = useState(false)
  const [sequences, setSequences] = useState([])

  const closeAll = () => { setShowStatus(false); setShowConnection(false); setShowSequences(false) }

  async function openSequences() {
    if (!sequences.length) {
      const r = await listSequences().catch(() => ({ data: [] }))
      setSequences(r.data || [])
    }
    setShowSequences(s => !s)
    setShowStatus(false)
    setShowConnection(false)
  }

  const btn = (extra = {}) => ({ ...bulk.actionBtn, ...(loading ? { opacity: 0.45, pointerEvents: 'none' } : {}), ...extra })

  return (
    <div style={bulk.bar}>
      <div style={bulk.left}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#E7000B', flexShrink: 0 }} />
        <span style={bulk.count}>{count} selected</span>
        {count < totalFiltered && (
          <button style={bulk.selectAllBtn} onClick={onSelectAll}>
            Select all {totalFiltered}
          </button>
        )}
        <button style={bulk.clearBtn} onClick={onClearSelection}>Clear</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={bulk.spinner} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{loadingLabel}</span>
        </div>
      ) : (
        <div style={bulk.actions}>
          <button style={btn()} onClick={onExport}>Export CSV</button>

          <button style={btn()} onClick={onScoreICP}>Score ICP</button>
          <button style={btn()} onClick={onFindEmails}>Find Emails</button>
          <button style={btn({ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' })} onClick={onVerifyEmails}>Verify Emails</button>

          <div style={{ position: 'relative' }}>
            <button style={btn()} onClick={openSequences}>Sequence ↓</button>
            {showSequences && (
              <div style={{ ...bulk.dropdown, minWidth: 210, bottom: '100%', top: 'auto', marginBottom: 6 }}>
                {sequences.length === 0
                  ? <div style={{ ...bulk.dropdownItem, color: 'var(--text-muted)', cursor: 'default' }}>No sequences yet</div>
                  : sequences.map(seq => (
                      <button key={seq.id} style={bulk.dropdownItem}
                        onClick={() => { onEnrollSequence(seq.id); closeAll() }}>
                        {seq.name}
                      </button>
                    ))}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button style={btn()} onClick={() => { setShowStatus(s => !s); setShowConnection(false); setShowSequences(false) }}>Status ↓</button>
            {showStatus && (
              <div style={{ ...bulk.dropdown, bottom: '100%', top: 'auto', marginBottom: 6 }}>
                {STATUS_OPTIONS.map(s => (
                  <button key={s} style={bulk.dropdownItem} onClick={() => { onStatusChange(s); closeAll() }}>{s.toUpperCase()}</button>
                ))}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button style={btn()} onClick={() => { setShowConnection(s => !s); setShowStatus(false); setShowSequences(false) }}>Connection ↓</button>
            {showConnection && (
              <div style={{ ...bulk.dropdown, width: 220, bottom: '100%', top: 'auto', marginBottom: 6 }}>
                {CONNECTION_STATUSES.map(s => (
                  <button key={s} style={bulk.dropdownItem} onClick={() => { onConnectionChange(s); closeAll() }}>{s}</button>
                ))}
              </div>
            )}
          </div>

          <button style={btn({ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' })} onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
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

function EngagementBadge({ score }) {
  if (!score || score <= 0) return null
  const color  = score >= 50 ? '#4a7c59' : score >= 10 ? '#ca8a04' : '#888'
  const bg     = score >= 50 ? 'rgba(74,124,89,0.10)' : score >= 10 ? 'rgba(234,179,8,0.10)' : 'rgba(161,161,161,0.08)'
  const border = score >= 50 ? 'rgba(74,124,89,0.3)' : score >= 10 ? 'rgba(234,179,8,0.3)' : 'rgba(161,161,161,0.25)'
  return React.createElement(
    'span',
    { title: `Engagement score: ${score}`, style: { fontSize: '9px', fontWeight: '700', padding: '2px 5px', borderRadius: '4px', color, background: bg, border: `1px solid ${border}`, letterSpacing: '0.04em', whiteSpace: 'nowrap' } },
    `🔥${score}`
  )
}

const EMAIL_STATUS_META = {
  valid:      { label: '✓ valid',      color: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)' },
  risky:      { label: '⚠ risky',      color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
  unknown:    { label: '? unknown',    color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)' },
  role:       { label: '⊘ role',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' },
  disposable: { label: '✕ disposable', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  },
  invalid:    { label: '✕ invalid',    color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  },
  catch_all:  { label: '~ catch-all',  color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
}

function EmailVerificationBadge({ status, score, reason }) {
  if (!status) return null
  const m = EMAIL_STATUS_META[status] || EMAIL_STATUS_META.unknown
  return (
    <span
      title={reason ? `${reason}${score != null ? ` · ${score}% deliverability` : ''}` : score != null ? `${score}% deliverability` : ''}
      style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, flexShrink: 0, letterSpacing: '0.04em', cursor: 'default', whiteSpace: 'nowrap', color: m.color, background: m.bg, border: `1px solid ${m.border}` }}
    >
      {m.label}
    </span>
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

function LeadRow({ lead, columns, editingCell, editValue, setEditValue, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onEnrich, onStar, onConnectionStatus, enrichingId, isSelected, onToggleSelect, onScore, onDraft, scoringId, draftingId, onRowClick }) {
  const isEnriching = enrichingId === lead.id
  const isScoring   = scoringId === lead.id
  const isDrafting  = draftingId === lead.id
  const isDecisionMaker = DECISION_MAKER_KEYWORDS.test(lead.title || '')
  const isSecurity = SECURITY_KEYWORDS.test(lead.title || '')

  return (
    <div style={{ ...s.trow, background: isSelected ? 'rgba(168,100,72,0.07)' : 'transparent', borderLeft: isSelected ? '2px solid var(--accent)' : lead.starred ? '2px solid var(--accent)' : '2px solid transparent', outline: isSelected ? '1px solid rgba(168,100,72,0.18)' : 'none', outlineOffset: -1 }}>
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
        <EngagementBadge score={lead.engagement_score} />
      </div>
      {columns.map((col) => {
        const isEditing = editingCell && editingCell.leadId === lead.id && editingCell.field === col.key
        return (
          <div key={col.key} style={{ ...s.td, flex: col.flex, cursor: col.key === 'name' && onRowClick ? 'pointer' : 'text' }} onClick={() => col.key === 'name' && onRowClick ? onRowClick(lead) : onStartEdit(lead.id, col.key, lead[col.key])}>
            {isEditing && col.key === 'status' && <CellSelect value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => onSaveEdit(lead.id)} />}
            {isEditing && col.key !== 'status' && <CellInput value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => onSaveEdit(lead.id)} onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(lead.id); if (e.key === 'Escape') onCancelEdit() }} />}
            {!isEditing && col.key === 'status' && <StatusBadge status={lead.status} />}
            {!isEditing && col.key === 'name' && <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '500', textDecoration: onRowClick ? 'underline' : 'none', textDecorationColor: 'var(--border-strong)', textUnderlineOffset: 3 }}>{lead.name || '—'}</span>}
            {!isEditing && col.key === 'email' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email || '—'}</span>
                  {lead.email && lead.email_provider && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                      background: lead.email_provider === 'web'  ? 'rgba(139,92,246,0.12)'
                                : lead.email_provider === 'smtp' ? 'rgba(16,185,129,0.12)'
                                : lead.email_provider === 'site' ? 'rgba(59,130,246,0.12)'
                                : 'rgba(107,114,128,0.12)',
                      color:      lead.email_provider === 'web'  ? '#8b5cf6'
                                : lead.email_provider === 'smtp' ? '#10b981'
                                : lead.email_provider === 'site' ? '#3b82f6'
                                : '#6b7280',
                    }}>{lead.email_provider}</span>
                  )}
                </div>
                {lead.email && <EmailVerificationBadge status={lead.email_status} score={lead.email_score} />}
              </div>
            )}
            {!isEditing && col.key !== 'status' && col.key !== 'name' && col.key !== 'email' && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{lead[col.key] || '—'}</span>}
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

// inject @keyframes spin once
if (typeof document !== 'undefined' && !document.getElementById('sonar-spin-kf')) {
  const st = document.createElement('style'); st.id = 'sonar-spin-kf'
  st.textContent = '@keyframes spin{to{transform:rotate(360deg)}}'
  document.head.appendChild(st)
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
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkLabel, setBulkLabel] = useState('')
  const [segments, setSegments] = useState([])
  const [activeSegmentId, setActiveSegmentId] = useState(null)
  const [savingSegment, setSavingSegment] = useState(false)
  const [segmentNameInput, setSegmentNameInput] = useState('')
  const [showSegmentInput, setShowSegmentInput] = useState(false)
  const [showSegEnrollPicker, setShowSegEnrollPicker] = useState(false)
  const [segEnrolling, setSegEnrolling] = useState(false)
  const [sequences, setSequences] = useState([])

  // Advanced filters
  const [filterSeniority, setFilterSeniority]   = useState('')
  const [filterConnection, setFilterConnection] = useState('')
  const [filterMinScore, setFilterMinScore]     = useState(0)
  const [filterEmailStatus, setFilterEmailStatus] = useState('')
  const [sortBy, setSortBy] = useState('default') // 'default' | 'hottest'
  const [showAdvanced, setShowAdvanced]         = useState(false)
  const [unverifiedCount, setUnverifiedCount]   = useState(0)
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false)
  const [scoringAll, setScoringAll] = useState(false)
  const [scoreMsg, setScoreMsg] = useState('')
  const [selectedLead, setSelectedLead] = useState(null)
  const [viewMode, setViewMode] = useState('table') // 'table' | 'pipeline'
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const csvInputRef = useRef(null)

  useEffect(() => { fetchLeads(); fetchSegments(); fetchSequences() }, [])

  async function fetchSequences() {
    try {
      const r = await listSequences().catch(() => ({ data: [] }))
      setSequences(r.data || [])
    } catch {}
  }

  async function fetchSegments() {
    try {
      const res = await listSegments()
      setSegments(res.data.segments || [])
    } catch {}
  }

  async function fetchLeads() {
    try {
      const res = await getLeads()
      setLeads(res.data?.leads || [])
      getUnverifiedCount().then(r => setUnverifiedCount(r.data?.count || 0)).catch(() => {})
    } catch (e) {
      console.error(e)
      setLeads([])
    }
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
    if (!window.confirm(`Delete ${selected.length} lead${selected.length !== 1 ? 's' : ''}? This cannot be undone.`)) return
    const ids = [...selected]
    setLeads(prev => prev.filter(l => !ids.includes(l.id)))
    setSelected([])
    try {
      await bulkDeleteLeads(ids)
    } catch (e) { console.error(e); fetchLeads() }
  }

  async function handleBulkStatus(status) {
    setBulkLoading(true); setBulkLabel(`Setting status to ${status}…`)
    try {
      await Promise.all(selected.map(id => updateLead(id, { status })))
      setLeads(prev => prev.map(l => selected.includes(l.id) ? { ...l, status } : l))
      setSelected([])
    } catch (e) { console.error(e) }
    finally { setBulkLoading(false); setBulkLabel('') }
  }

  async function handleBulkConnectionStatus(connection_status) {
    setBulkLoading(true); setBulkLabel(`Updating connection status…`)
    try {
      await Promise.all(selected.map(id => updateConnectionStatus(id, connection_status)))
      setLeads(prev => prev.map(l => selected.includes(l.id) ? { ...l, connection_status } : l))
      setSelected([])
    } catch (e) { console.error(e) }
    finally { setBulkLoading(false); setBulkLabel('') }
  }

  async function handleBulkEnrollSequence(seqId) {
    setBulkLoading(true); setBulkLabel(`Enrolling ${selected.length} leads…`)
    try {
      await enrollInSequence(seqId, selected)
      setImportMsg(`Enrolled ${selected.length} lead${selected.length !== 1 ? 's' : ''} in sequence.`)
      setSelected([])
      setTimeout(() => setImportMsg(''), 4000)
    } catch (e) { console.error(e) }
    finally { setBulkLoading(false); setBulkLabel('') }
  }

  async function handleBulkScoreICP() {
    setBulkLoading(true); setBulkLabel(`Scoring ${selected.length} leads against ICP…`)
    try {
      const res = await bulkScoreLeads(selected)
      const results = res.data.results || []
      setLeads(prev => prev.map(l => {
        const hit = results.find(r => r.id === l.id)
        return hit ? { ...l, icp_score: hit.score, icp_score_reason: hit.reason } : l
      }))
      setImportMsg(`Scored ${results.length} lead${results.length !== 1 ? 's' : ''}.`)
      setSelected([])
      setTimeout(() => setImportMsg(''), 4000)
    } catch (e) { console.error(e); setImportMsg('Scoring failed.') }
    finally { setBulkLoading(false); setBulkLabel('') }
  }

  function currentFilters() {
    return { search, statusFilter, viewFilter, starredOnly, filterSeniority, filterConnection, filterMinScore }
  }

  function applySegment(seg) {
    const f = seg.filters || {}
    setSearch(f.search || '')
    setStatusFilter(f.statusFilter || 'all')
    setViewFilter(f.viewFilter || 'all')
    setStarredOnly(f.starredOnly || false)
    setFilterSeniority(f.filterSeniority || '')
    setFilterConnection(f.filterConnection || '')
    setFilterMinScore(f.filterMinScore || 0)
    setActiveSegmentId(seg.id)
  }

  function clearSegment() {
    setShowSegEnrollPicker(false)
    setActiveSegmentId(null)
    setSearch('')
    setStatusFilter('all')
    setViewFilter('all')
    setStarredOnly(false)
    setFilterSeniority('')
    setFilterConnection('')
    setFilterMinScore(0)
  }

  async function handleSaveSegment() {
    const name = segmentNameInput.trim()
    if (!name) return
    setSavingSegment(true)
    try {
      const res = await createSegment(name, currentFilters())
      const seg = res.data.segment
      setSegments(prev => [...prev, seg])
      setActiveSegmentId(seg.id)
      setShowSegmentInput(false)
      setSegmentNameInput('')
    } catch {}
    finally { setSavingSegment(false) }
  }

  async function handleSegEnrollSequence(seqId, seqName) {
    setSegEnrolling(true)
    setShowSegEnrollPicker(false)
    try {
      await enrollInSequence(seqId, filtered.map(l => l.id))
      setImportMsg(`Enrolled ${filtered.length} lead${filtered.length !== 1 ? 's' : ''} in ${seqName}.`)
      setTimeout(() => setImportMsg(''), 3000)
    } catch (e) { console.error(e); setImportMsg('Enrollment failed.') }
    finally { setSegEnrolling(false) }
  }

  async function handleDeleteSegment(id, e) {
    e.stopPropagation()
    try {
      await deleteSegment(id)
      setSegments(prev => prev.filter(s => s.id !== id))
      if (activeSegmentId === id) clearSegment()
    } catch {}
  }

  const hasActiveFilters = search || statusFilter !== 'all' || viewFilter !== 'all' || starredOnly || filterSeniority || filterConnection || filterMinScore

  async function handleBulkFindEmails() {
    const needEmail = selected.filter(id => !leads.find(l => l.id === id)?.email)
    if (!needEmail.length) { setImportMsg('All selected leads already have emails.'); setTimeout(() => setImportMsg(''), 3000); return }
    setBulkLoading(true); setBulkLabel(`Finding emails for ${needEmail.length} leads…`)
    try {
      const res = await bulkEnrichLeads(needEmail)
      const { enriched } = res.data
      if (enriched > 0) { await fetchLeads() }
      setImportMsg(`Found ${enriched} email${enriched !== 1 ? 's' : ''} out of ${needEmail.length} attempted.`)
      setSelected([])
      setTimeout(() => setImportMsg(''), 5000)
    } catch (e) { console.error(e); setImportMsg('Email enrichment failed.') }
    finally { setBulkLoading(false); setBulkLabel('') }
  }

  async function handleBulkVerifyEmails(ids) {
    const targets = (ids || selected).filter(id => leads.find(l => l.id === id)?.email)
    if (!targets.length) { setImportMsg('No emails to verify in selection.'); setTimeout(() => setImportMsg(''), 3000); return }
    setBulkLoading(true); setBulkLabel(`Verifying ${targets.length} emails…`)
    try {
      const res = await bulkVerifyEmails(targets)
      const { summary } = res.data
      ;(res.data.results || []).forEach(r => {
        if (r.status !== 'skipped' && r.status !== 'error') {
          setLeads(prev => prev.map(l => l.id === r.lead_id ? { ...l, email_status: r.status, email_score: r.score } : l))
        }
      })
      setImportMsg(`Verified ${summary.verified}: ${summary.valid} valid · ${summary.risky} risky · ${summary.invalid} invalid · ${summary.role} role`)
      setUnverifiedCount(prev => Math.max(0, prev - summary.verified))
      setSelected([])
      setTimeout(() => setImportMsg(''), 8000)
    } catch (e) { console.error(e); setImportMsg('Verification failed.') }
    finally { setBulkLoading(false); setBulkLabel('') }
  }

  async function handleImportCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg('')
    try {
      const text = await file.text()
      const r = await importLeadsCSV(text)
      const { created, skipped } = r.data
      setImportMsg(`Imported ${created} lead${created !== 1 ? 's' : ''}${skipped ? `, ${skipped} skipped (duplicates)` : ''}.`)
      fetchLeads()
    } catch (e) {
      setImportMsg('Import failed — check the CSV format.')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleExportCSV() {
    try {
      const r = await exportLeadsCSV()
      const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url; a.download = 'sonar-leads.csv'; a.click()
      URL.revokeObjectURL(url)
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

  async function handleScoreAll() {
    setScoringAll(true)
    setScoreMsg('')
    try {
      const { default: api } = await import('../services/api')
      const res = await api.post('/leads/score', { rescore: false })
      const { scored } = res.data
      setScoreMsg(scored > 0 ? `Scored ${scored} leads` : 'All leads already scored')
      await fetchLeads()
    } catch { setScoreMsg('Scoring failed') }
    finally { setScoringAll(false) }
  }

  const SENIORITY_MAP = {
    'c-suite':    /\b(ceo|cto|cfo|coo|cro|cpo|ciso|chief)\b/i,
    'vp':         /\b(vp|vice president|svp|evp)\b/i,
    'director':   /\b(director|head of)\b/i,
    'manager':    /\b(manager|lead|senior manager)\b/i,
    'individual': /\b(engineer|developer|analyst|specialist|associate)\b/i,
  }

  const filtered = leads.filter((l) => {
    const ms = search === '' || [l.name, l.title, l.company, l.location].join(' ').toLowerCase().includes(search.toLowerCase())
    const mf = statusFilter === 'all' || l.status === statusFilter
    const mstar = !starredOnly || l.starred
    const titleText = (l.title || '').toLowerCase()
    const mv = viewFilter === 'all' ||
      (viewFilter === 'decision-makers' && DECISION_MAKER_KEYWORDS.test(titleText)) ||
      (viewFilter === 'security' && SECURITY_KEYWORDS.test(titleText))
    const msen = !filterSeniority || (SENIORITY_MAP[filterSeniority] && SENIORITY_MAP[filterSeniority].test(l.title || ''))
    const mconn = !filterConnection || l.connection_status === filterConnection
    const mscore = !filterMinScore || (l.icp_score != null && l.icp_score >= filterMinScore)
    const memail = !filterEmailStatus ||
      (filterEmailStatus === 'unverified' ? !l.email_status && l.email : l.email_status === filterEmailStatus)
    return ms && mf && mstar && mv && msen && mconn && mscore && memail
  })
  if (sortBy === 'hottest') {
    filtered.sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
  }

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
      <motion.div style={s.hero} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
        <div style={{ position: 'relative' }}>
          <p style={s.eyebrow}>Lead Intelligence</p>
          <h1 style={s.heroTitle}>
            {filtered.length}
            <span style={s.heroUnit}>{' targets'}</span>
          </h1>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {(enrichMsg || scoreMsg) && <span style={{ fontSize: '12px', color: '#4a7c59', fontWeight: '500' }}>{scoreMsg || enrichMsg}</span>}
          <button
            style={{ ...s.starFilterBtn, background: starredOnly ? 'var(--accent)' : 'transparent', color: starredOnly ? 'var(--bg)' : 'var(--accent)', borderColor: 'rgba(168,100,72,0.4)' }}
            onClick={() => setStarredOnly(!starredOnly)}
          >
            ★ {starredCount} starred
          </button>
          <button
            onClick={handleScoreAll}
            disabled={scoringAll}
            style={{ padding: '7px 14px', background: scoringAll ? 'var(--surface)' : '#1d1b1b', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: '#fff', cursor: scoringAll ? 'default' : 'pointer', opacity: scoringAll ? 0.6 : 1 }}
          >
            {scoringAll ? 'Scoring…' : 'Score All'}
          </button>
          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
            {['table', 'pipeline'].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '7px 14px', background: viewMode === mode ? 'var(--text)' : 'transparent', color: viewMode === mode ? 'var(--bg)' : 'var(--text-muted)', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s' }}>
                {mode === 'table' ? 'Table' : 'Pipeline'}
              </button>
            ))}
          </div>
          <button style={s.spreadsheetBtn} onClick={() => setShowSpreadsheet(true)}>Spreadsheet</button>
          <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
          <button style={s.exportBtn} onClick={() => csvInputRef.current?.click()} disabled={importing}>
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <button style={s.exportBtn} onClick={handleExportCSV}>Export CSV →</button>
        </div>
        {importMsg && (
          <div style={{ padding: '8px 24px', background: importMsg.includes('failed') ? 'rgba(231,0,11,0.08)' : 'rgba(74,124,89,0.1)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: importMsg.includes('failed') ? '#E7000B' : '#4a7c59' }}>{importMsg}</span>
          </div>
        )}
      </motion.div>

      <div style={s.container}>

        {selected.length > 0 && (
          <BulkActionBar
            count={selected.length}
            totalFiltered={filtered.length}
            onClearSelection={() => setSelected([])}
            onSelectAll={() => setSelected(filtered.map(l => l.id))}
            onDelete={handleBulkDelete}
            onExport={() => handleExport(filtered.filter(l => selected.includes(l.id)))}
            onStatusChange={handleBulkStatus}
            onConnectionChange={handleBulkConnectionStatus}
            onEnrollSequence={handleBulkEnrollSequence}
            onScoreICP={handleBulkScoreICP}
            onFindEmails={handleBulkFindEmails}
            onVerifyEmails={() => handleBulkVerifyEmails()}
            loading={bulkLoading}
            loadingLabel={bulkLabel}
          />
        )}

        {/* Unverified emails banner */}
        {unverifiedCount > 0 && !verifyBannerDismissed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', marginBottom: 14, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', flex: 1 }}>
              <strong>{unverifiedCount}</strong> lead{unverifiedCount !== 1 ? 's have' : ' has'} an email with no verification status
            </span>
            <button
              onClick={() => {
                const ids = leads.filter(l => l.email && !l.email_status).map(l => l.id)
                handleBulkVerifyEmails(ids.slice(0, 200))
              }}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, padding: '5px 12px', background: '#10b981', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Verify all{unverifiedCount > 200 ? ' (first 200)' : ''}
            </button>
            <button onClick={() => setVerifyBannerDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', padding: '2px 4px' }}>✕</button>
          </div>
        )}

        {/* Data quality bar — only show when there are leads with emails */}
        {leads.length > 0 && leads.some(l => l.email) && (() => {
          const withEmail = leads.filter(l => l.email)
          const valid     = withEmail.filter(l => l.email_status === 'valid').length
          const risky     = withEmail.filter(l => l.email_status === 'risky').length
          const invalid   = withEmail.filter(l => l.email_status === 'invalid').length
          const role      = withEmail.filter(l => l.email_status === 'role').length
          const unverif   = withEmail.filter(l => !l.email_status).length
          const total     = withEmail.length
          const score     = total > 0 ? Math.round((valid * 1 + risky * 0.5) / total * 100) : 0
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', marginBottom: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Data Quality</span>
              <div style={{ flex: 1, height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${valid / total * 100}%`, background: '#4a7c59', height: '100%' }} />
                <div style={{ width: `${risky / total * 100}%`, background: '#b07d2e', height: '100%' }} />
                <div style={{ width: `${invalid / total * 100}%`, background: '#e07070', height: '100%' }} />
                <div style={{ width: `${role / total * 100}%`, background: '#5b8db8', height: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                {[
                  { label: 'Valid',   val: valid,   color: '#4a7c59' },
                  { label: 'Risky',   val: risky,   color: '#b07d2e' },
                  { label: 'Invalid', val: invalid,  color: '#e07070' },
                  { label: 'Role',    val: role,     color: '#5b8db8' },
                  { label: 'Unknown', val: unverif,  color: 'var(--text-muted)' },
                ].map(({ label, val, color }) => val > 0 ? (
                  <span key={label} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, fontWeight: 600 }}>{val} {label}</span>
                ) : null)}
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: score >= 70 ? '#4a7c59' : score >= 40 ? '#b07d2e' : '#e07070', flexShrink: 0 }}>{score}%</span>
            </div>
          )
        })()}

        <div style={{ ...s.viewTabs, justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Built-in tabs */}
            {[
              { key: 'all', label: 'All leads', count: leads.length },
              { key: 'decision-makers', label: 'Decision Makers', count: decisionMakerCount },
              { key: 'security', label: 'Security', count: securityCount },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => { setViewFilter(tab.key); setActiveSegmentId(null) }}
                style={{ ...s.viewTab, ...(viewFilter === tab.key && !activeSegmentId ? s.viewTabActive : {}) }}>
                {tab.label}
                <span style={{ ...s.viewTabCount, background: viewFilter === tab.key && !activeSegmentId ? 'rgba(29,27,27,0.10)' : 'var(--surface-raised)', color: viewFilter === tab.key && !activeSegmentId ? 'var(--bg)' : 'var(--text-muted)' }}>
                  {tab.count}
                </span>
              </button>
            ))}

            {/* Divider */}
            {segments.length > 0 && <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />}

            {/* Saved segments */}
            {segments.map(seg => (
              <button key={seg.id}
                onClick={() => activeSegmentId === seg.id ? clearSegment() : applySegment(seg)}
                style={{ ...s.viewTab, ...(activeSegmentId === seg.id ? s.viewTabActive : {}), display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 8 }}>◆</span>
                {seg.name}
                <span
                  onClick={(e) => handleDeleteSegment(seg.id, e)}
                  style={{ fontSize: 9, opacity: 0.5, cursor: 'pointer', marginLeft: 2, lineHeight: 1 }}
                  title="Delete segment">✕</span>
              </button>
            ))}

            {/* Segment enroll button */}
            {activeSegmentId && (
              <div style={{ position: 'relative', marginLeft: 6 }}>
                <button
                  onClick={() => setShowSegEnrollPicker(v => !v)}
                  disabled={segEnrolling || filtered.length === 0}
                  style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(168,100,72,0.4)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: segEnrolling ? 'var(--text-muted)' : 'var(--accent)', cursor: segEnrolling || filtered.length === 0 ? 'default' : 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.04em', opacity: segEnrolling ? 0.6 : 1 }}>
                  {segEnrolling ? 'Enrolling…' : `Enroll segment in sequence →`}
                </button>
                {showSegEnrollPicker && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 300, minWidth: 210, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
                    {sequences.length === 0
                      ? <div style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>No sequences yet</div>
                      : sequences.map(seq => (
                          <button key={seq.id}
                            onClick={() => handleSegEnrollSequence(seq.id, seq.name)}
                            style={{ padding: '9px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--text)', fontSize: 10, fontWeight: 500, letterSpacing: '0.04em', cursor: 'pointer', textAlign: 'left' }}>
                            {seq.name}
                          </button>
                        ))}
                    <div style={{ padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                      {filtered.length} lead{filtered.length !== 1 ? 's' : ''} will be enrolled
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Save segment button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {showSegmentInput ? (
              <>
                <input
                  autoFocus
                  value={segmentNameInput}
                  onChange={e => setSegmentNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveSegment(); if (e.key === 'Escape') { setShowSegmentInput(false); setSegmentNameInput('') } }}
                  placeholder="Segment name…"
                  style={{ padding: '5px 10px', background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', outline: 'none', width: 160 }}
                />
                <button onClick={handleSaveSegment} disabled={savingSegment || !segmentNameInput.trim()}
                  style={{ padding: '5px 12px', background: 'var(--accent)', border: 'none', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: savingSegment || !segmentNameInput.trim() ? 0.5 : 1 }}>
                  {savingSegment ? '…' : 'Save'}
                </button>
                <button onClick={() => { setShowSegmentInput(false); setSegmentNameInput('') }}
                  style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </>
            ) : (
              hasActiveFilters && (
                <button onClick={() => setShowSegmentInput(true)}
                  style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                  + Save as segment
                </button>
              )
            )}
          </div>
        </div>

        <div style={s.filters}>
          <div style={s.searchBox}>
            <span style={s.searchIcon}>↗</span>
            <input type="text" placeholder="Search by name, title, company…" value={search} onChange={(e) => setSearch(e.target.value)} style={s.searchInput} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={s.filterTabs}>
              {['all', ...STATUS_OPTIONS].map((f) => (
                <button key={f} onClick={() => setStatusFilter(f)} style={{ ...s.filterTab, ...(statusFilter === f ? s.filterTabActive : {}) }}>
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${showAdvanced || filterSeniority || filterConnection || filterMinScore ? 'var(--accent)' : 'var(--border)'}`, background: 'transparent', fontFamily: 'var(--font-mono)', fontSize: 11, color: showAdvanced ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              Filters {(filterSeniority || filterConnection || filterMinScore) ? '(active)' : ''}
            </button>
            <button
              onClick={() => setSortBy(s => s === 'hottest' ? 'default' : 'hottest')}
              style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${sortBy === 'hottest' ? 'rgba(202,138,4,0.5)' : 'var(--border)'}`, background: sortBy === 'hottest' ? 'rgba(234,179,8,0.08)' : 'transparent', fontFamily: 'var(--font-mono)', fontSize: 11, color: sortBy === 'hottest' ? '#ca8a04' : 'var(--text-muted)', cursor: 'pointer', fontWeight: sortBy === 'hottest' ? 700 : 400 }}
            >
              {sortBy === 'hottest' ? '🔥 Hottest' : 'Hottest'}
            </button>
          </div>
        </div>

        {showAdvanced && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Seniority</label>
              <select value={filterSeniority} onChange={e => setFilterSeniority(e.target.value)}
                style={{ padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', outline: 'none' }}>
                <option value="">All levels</option>
                <option value="c-suite">C-Suite</option>
                <option value="vp">VP / SVP</option>
                <option value="director">Director</option>
                <option value="manager">Manager / Lead</option>
                <option value="individual">Individual Contributor</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Connection</label>
              <select value={filterConnection} onChange={e => setFilterConnection(e.target.value)}
                style={{ padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', outline: 'none' }}>
                <option value="">Any status</option>
                {CONNECTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Min ICP Score</label>
              <select value={filterMinScore} onChange={e => setFilterMinScore(Number(e.target.value))}
                style={{ padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', outline: 'none' }}>
                <option value={0}>Any score</option>
                <option value={40}>40+ (Fair)</option>
                <option value={60}>60+ (Good)</option>
                <option value={70}>70+ (Strong)</option>
                <option value={85}>85+ (Excellent)</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Email status</label>
              <select value={filterEmailStatus} onChange={e => setFilterEmailStatus(e.target.value)}
                style={{ padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', outline: 'none' }}>
                <option value="">Any</option>
                <option value="unverified">Unverified (has email)</option>
                <option value="valid">✓ Valid</option>
                <option value="risky">⚠ Risky</option>
                <option value="unknown">? Unknown</option>
                <option value="role">⊘ Role address</option>
                <option value="catch_all">~ Catch-all</option>
                <option value="invalid">✕ Invalid</option>
                <option value="disposable">✕ Disposable</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={() => { setFilterSeniority(''); setFilterConnection(''); setFilterMinScore(0); setFilterEmailStatus('') }}
                style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
                Clear filters
              </button>
            </div>
          </div>
        )}

        {viewMode === 'pipeline' && (
          <PipelineView
            leads={filtered}
            onLeadClick={setSelectedLead}
            onLeadsUpdate={setLeads}
          />
        )}

        {viewMode === 'table' && <div style={s.table}>
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
                onRowClick={setSelectedLead}
              />
            </motion.div>
          ))}
        </div>}
      </div>

      {selectedLead && (
        <LeadDrawer
          lead={leads.find(l => l.id === selectedLead.id) || selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={(id, data) => setLeads(prev => prev.map(l => l.id === id ? { ...l, ...data } : l))}
          onDelete={(id) => { setLeads(prev => prev.filter(l => l.id !== id)); setSelectedLead(null) }}
        />
      )}

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
    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px',
    background: 'var(--bg)',
    border: '1px solid var(--border-strong)',
    borderRadius: '10px',
    gap: '14px',
    zIndex: 200,
    boxShadow: '0 8px 32px rgba(0,0,0,0.22), 0 0 0 1px rgba(168,100,72,0.18)',
    minWidth: 480, maxWidth: '90vw',
    backdropFilter: 'blur(8px)',
  },
  left: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  count: { fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '700', color: 'var(--text)', letterSpacing: '0.04em' },
  selectAllBtn: {
    background: 'none', border: '1px solid rgba(168,100,72,0.3)', borderRadius: 5,
    fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '10px',
    letterSpacing: '0.04em', cursor: 'pointer', padding: '3px 8px', fontWeight: '600',
  },
  clearBtn: {
    background: 'none', border: 'none', fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.04em', cursor: 'pointer', padding: '2px 4px',
  },
  actions: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' },
  actionBtn: {
    padding: '6px 11px', background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600',
    letterSpacing: '0.04em', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'border-color 0.15s, color 0.15s',
  },
  dropdown: {
    position: 'absolute', left: 0,
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '8px', zIndex: 300, minWidth: '160px',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  },
  dropdownItem: {
    padding: '9px 14px', background: 'none', border: 'none',
    fontFamily: 'var(--font-mono)', color: 'var(--text)', fontSize: '10px', fontWeight: '500',
    letterSpacing: '0.04em', cursor: 'pointer', textAlign: 'left',
    borderBottom: '1px solid var(--border)',
  },
  spinner: {
    width: 14, height: 14, border: '2px solid var(--border)',
    borderTopColor: 'var(--accent)', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite', flexShrink: 0,
  },
}
