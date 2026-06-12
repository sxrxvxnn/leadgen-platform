import React, { useState, useEffect } from 'react'
import { getCompanies, updateCompany, deleteCompany, getCompanyLeads, checkCompliance, autofillCompanyLinkedIn, bulkAutofillCompanies } from '../services/api'
import DMFinder from '../components/DMFinder'
import AddCompanyModal from '../components/AddCompanyModal'
import BulkAddModal from '../components/BulkAddModal'
import CompaniesSpreadsheet from '../components/CompaniesSpreadsheet'
import Navbar from '../components/Navbar'

const CLASSIFICATIONS = [
  'Unclassified', 'Fintech', 'Healthtech', 'SaaS', 'Cybersecurity',
  'IT Services', 'E-commerce', 'Edtech', 'Logistics', 'Manufacturing',
  'Banking', 'Insurance', 'VC / Investment', 'Media', 'Consulting',
  'Retail', 'Real Estate', 'Government', 'Non-profit', 'Other', 'Custom...',
]

const PROSPECT_STATUSES = [
  'To Review', 'Prospect', 'Not a Fit', 'Contacted', 'In Progress', 'Closed Won', 'Closed Lost',
]

const classificationColors = {
  'Fintech':          '#5b8db8',
  'Healthtech':       '#4a7c59',
  'SaaS':             '#7b6bae',
  'Cybersecurity':    '#b83232',
  'IT Services':      '#8b7bbe',
  'E-commerce':       '#a86448',
  'Edtech':           '#4a8c6b',
  'Logistics':        '#6b7e8c',
  'Manufacturing':    '#7a7060',
  'Banking':          '#5c6b7e',
  'Insurance':        '#6b7060',
  'VC / Investment':  '#a05050',
  'Media':            '#a05880',
  'Consulting':       '#5878a0',
  'Retail':           '#a0904a',
  'Real Estate':      '#6a904a',
  'Government':       '#6b7070',
  'Non-profit':       '#4a7c59',
  'Unclassified':     '#a1a1a1',
  'Other':            '#a1a1a1',
}

const prospectColors = {
  'To Review':   '#a1a1a1',
  'Prospect':    '#4a7c59',
  'Not a Fit':   '#b83232',
  'Contacted':   '#a86448',
  'In Progress': '#5b8db8',
  'Closed Won':  '#4a7c59',
  'Closed Lost': '#a1a1a1',
}

function getTypeBadge(type) {
  if (!type) return null
  const map = {
    'Product':  { bg: 'rgba(91,141,184,0.10)', color: '#5b8db8', border: 'rgba(91,141,184,0.25)' },
    'Services': { bg: 'rgba(168,100,72,0.10)',  color: '#a86448', border: 'rgba(168,100,72,0.25)' },
    'Hybrid':   { bg: 'rgba(123,107,174,0.10)', color: '#7b6bae', border: 'rgba(123,107,174,0.25)' },
  }
  const st = map[type] || map['Hybrid']
  return {
    fontSize: '9px', fontWeight: '600', letterSpacing: '0.8px', textTransform: 'uppercase',
    padding: '2px 7px', borderRadius: '4px',
    background: st.bg, color: st.color, border: `1px solid ${st.border}`,
  }
}

function toggleSelect(id) {
  setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
}

async function handleBulkDelete() {
  if (!window.confirm(`Delete ${selectedIds.length} companies?`)) return
  try {
    await Promise.all(selectedIds.map(id => deleteCompany(id)))
    setCompanies(prev => prev.filter(c => !selectedIds.includes(c.id)))
    setSelectedIds([])
  } catch (e) { console.error(e) }
}

function classifyCompany(company) {
  const text = [company.name, company.industry, company.description].join(' ').toLowerCase()
  if (/fintech|payment|lending|neobank|wallet|crypto|blockchain|insurtech/.test(text)) return 'Fintech'
  if (/health|medical|pharma|clinic|hospital|biotech|telemedicine/.test(text)) return 'Healthtech'
  if (/cyber|security|vapt|penetration|vulnerability|compliance|soc|siem/.test(text)) return 'Cybersecurity'
  if (/it services|it consulting|information technology|managed service|msp/.test(text)) return 'IT Services'
  if (/saas|cloud platform|api|developer tools|devops/.test(text)) return 'SaaS'
  if (/ecommerce|e-commerce|retail|shopping|marketplace/.test(text)) return 'E-commerce'
  if (/edtech|education|learning|school|university|training/.test(text)) return 'Edtech'
  if (/logistics|supply chain|shipping|freight|transport/.test(text)) return 'Logistics'
  if (/manufactur|factory|industrial|hardware/.test(text)) return 'Manufacturing'
  if (/bank|banking/.test(text)) return 'Banking'
  if (/insurance|insurer/.test(text)) return 'Insurance'
  if (/venture|capital|investment|fund|private equity/.test(text)) return 'VC / Investment'
  if (/media|news|publishing|broadcast/.test(text)) return 'Media'
  if (/consult|advisory/.test(text)) return 'Consulting'
  if (/government|ministry|department|public sector/.test(text)) return 'Government'
  return 'Unclassified'
}

function parseFollowers(str) {
  if (!str) return 0
  const clean = str.toLowerCase().replace(/,/g, '').replace(/followers?/g, '').trim()
  if (clean.includes('k')) return parseFloat(clean) * 1000
  if (clean.includes('m')) return parseFloat(clean) * 1000000
  return parseInt(clean) || 0
}

// ─── EDITABLE WEBSITE FIELD ───────────────────────────────────

function EditableWebsite({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')
  useEffect(() => { setVal(value || '') }, [value])

  if (editing) {
    return (
      <input
        type="text" value={val} autoFocus placeholder="https://company.com"
        onChange={e => setVal(e.target.value)}
        onBlur={() => { onSave(val); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(val); setEditing(false) }
          if (e.key === 'Escape') { setVal(value || ''); setEditing(false) }
        }}
        style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: '4px', padding: '2px 6px', fontSize: '12px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
    )
  }

  if (val) {
    const href = val.startsWith('http') ? val : 'https://' + val
    const display = val.replace('https://', '').replace('http://', '').split('/')[0]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{display}</a>
        <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', padding: '0 2px', lineHeight: 1 }}>✎</button>
      </div>
    )
  }

  return (
    <span style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', fontStyle: 'italic' }} onClick={() => setEditing(true)}>
      Add website…
    </span>
  )
}

// ─── COMPANY CARD ─────────────────────────────────────────────

const COMPANY_EDIT_FIELDS = [
  { key: 'name',         label: 'Company Name',  type: 'text' },
  { key: 'website',      label: 'Website',        type: 'text', placeholder: 'https://company.com' },
  { key: 'linkedin_url', label: 'LinkedIn URL',   type: 'text', placeholder: 'https://linkedin.com/company/…' },
  { key: 'headquarters', label: 'HQ / Location',  type: 'text', placeholder: 'City, State, Country' },
  { key: 'size',         label: 'Employees',      type: 'text', placeholder: 'e.g. 200 employees' },
  { key: 'followers',    label: 'Followers',      type: 'text', placeholder: 'e.g. 12,500 followers' },
  { key: 'revenue',      label: 'Revenue',        type: 'text', placeholder: 'e.g. $5M ARR' },
  { key: 'compliance',   label: 'Compliance',     type: 'text', placeholder: 'ISO 27001, SOC 2, …' },
  { key: 'company_type', label: 'Type',           type: 'select', options: ['', 'Product', 'Services', 'Hybrid'] },
  { key: 'description',  label: 'Description',    type: 'textarea' },
]

function CompanyCard({ company, onUpdate, onDelete, onViewLeads, onAnalyzeWebsite, analyzingId, selected, onToggle }) {
  const [classification, setClassification] = useState(company.classification || classifyCompany(company))
  const [prospectStatus, setProspectStatus] = useState(company.prospect_status || 'To Review')
  const [notes, setNotes] = useState(company.notes || '')
  const [editingNotes, setEditingNotes] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [checkingCompliance, setCheckingCompliance] = useState(false)
  const [complianceResult, setComplianceResult] = useState(null)
  const [fillingLI, setFillingLI] = useState(false)
  const [fillResult, setFillResult] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!company.classification || company.classification === 'Unclassified') {
      const autoClass = classifyCompany(company)
      if (autoClass !== 'Unclassified') {
        setClassification(autoClass)
        onUpdate(company.id, { classification: autoClass })
      }
    }
  }, [])

  async function handleClassificationChange(val) {
    setClassification(val)
    onUpdate(company.id, { classification: val })
  }

  async function handleStatusChange(val) {
    setProspectStatus(val)
    onUpdate(company.id, { prospect_status: val })
  }

  async function handleSaveNotes() {
    onUpdate(company.id, { notes })
    setEditingNotes(false)
  }

  async function handleCheckCompliance() {
    const groqKey = localStorage.getItem('groqKey') || ''
    const geminiKey = localStorage.getItem('geminiKey') || ''
    if (!groqKey && !geminiKey) {
      alert('Please add your Gemini or Groq API key in Settings first.')
      return
    }
    setCheckingCompliance(true)
    setComplianceResult(null)
    try {
      const res = await checkCompliance(company.id, groqKey)
      setComplianceResult(res.data)
      if (res.data.compliance && res.data.compliance !== 'None detected') {
        onUpdate(company.id, { compliance: res.data.compliance })
      }
    } catch (e) {
      setComplianceResult({ error: 'Analysis failed: ' + (e.response?.data?.detail || e.message) })
    } finally {
      setCheckingCompliance(false)
    }
  }

  async function handleFillLinkedIn() {
    setFillingLI(true)
    setFillResult(null)
    try {
      const res = await autofillCompanyLinkedIn(company.id)
      const { success, update, filled, linkedin_url, message } = res.data
      if (success === false) {
        setFillResult({ ok: false, msg: message || 'Could not find LinkedIn data' })
      } else if (filled.length > 0) {
        onUpdate(company.id, { ...update, linkedin_url: update.linkedin_url || linkedin_url || company.linkedin_url })
        setFillResult({ ok: true, filled })
      } else {
        // Check if fields are actually empty — if so, LinkedIn scraping likely failed
        const hasGaps = !company.website || !company.headquarters || !company.followers
        setFillResult({ ok: false, msg: hasGaps ? 'LinkedIn scraping blocked — try again or add details manually' : 'All fields already filled' })
      }
    } catch (e) {
      setFillResult({ ok: false, msg: e.response?.data?.detail || e.message || 'Fill failed' })
    } finally {
      setFillingLI(false)
    }
  }

  function openEdit() {
    setEditForm({
      name:         company.name || '',
      website:      company.website || '',
      linkedin_url: company.linkedin_url || '',
      headquarters: company.headquarters || '',
      size:         company.size || '',
      followers:    company.followers || '',
      revenue:      company.revenue || '',
      compliance:   company.compliance || '',
      company_type: company.company_type || '',
      description:  company.description || '',
    })
    setShowEdit(true)
  }

  async function saveEdit() {
    setSaving(true)
    const cleaned = Object.fromEntries(Object.entries(editForm).filter(([, v]) => v !== undefined))
    await onUpdate(company.id, cleaned)
    setShowEdit(false)
    setSaving(false)
  }

  const classColor = classificationColors[classification] || '#a1a1a1'
  const statusColor = prospectColors[prospectStatus] || '#a1a1a1'
  const isAnalyzing = analyzingId === company.id
  const typeBadgeStyle = getTypeBadge(company.company_type)

  return (
    <div style={{ ...card.wrapper }}>

      {/* Classification accent strip */}
      <div style={{ height: '2px', background: classColor, opacity: 0.75 }} />

      {/* Header */}
      <div style={card.header}>
        <div style={card.headerLeft}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '2px' }}>
            <h3 style={card.name}>{company.name}</h3>
            {typeBadgeStyle && <span style={typeBadgeStyle}>{company.company_type}</span>}
          </div>
          <p style={card.industry}>{company.industry || 'Industry unknown'}</p>
        </div>
        <div style={card.headerRight}>
          {showCustomInput ? (
            <input
              type="text" placeholder="Type category…" autoFocus
              style={{ ...card.select, width: '120px', color: 'var(--text)', borderColor: 'var(--accent)' }}
              onBlur={e => { const v = e.target.value.trim(); if (v) handleClassificationChange(v); setShowCustomInput(false) }}
              onKeyDown={e => {
                if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) handleClassificationChange(v); setShowCustomInput(false) }
                if (e.key === 'Escape') setShowCustomInput(false)
              }}
            />
          ) : (
            <select
              value={classification}
              onChange={e => { if (e.target.value === 'Custom...') setShowCustomInput(true); else handleClassificationChange(e.target.value) }}
              style={{ ...card.select, color: classColor, borderColor: `${classColor}40` }}
            >
              {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <input
            type="checkbox" checked={selected || false}
            onChange={() => onToggle(company.id)}
            onClick={e => e.stopPropagation()}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
          />
          <button style={card.editCardBtn} onClick={openEdit} title="Edit">✎</button>
          <button style={card.deleteBtn} onClick={() => onDelete(company.id)} title="Remove">✕</button>
        </div>
      </div>

      {/* Edit panel */}
      {showEdit && (
        <div style={card.editPanel}>
          <div style={card.editGrid}>
            {COMPANY_EDIT_FIELDS.map(f => (
              <div key={f.key} style={{ gridColumn: f.type === 'textarea' ? '1 / -1' : 'auto' }}>
                <label style={card.editLabel}>{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea
                    value={editForm[f.key] || ''}
                    onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ ...card.editInput, height: '64px', resize: 'vertical' }}
                    placeholder="Description…"
                  />
                ) : f.type === 'select' ? (
                  <select
                    value={editForm[f.key] || ''}
                    onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={card.editInput}
                  >
                    {f.options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                  </select>
                ) : (
                  <input
                    type="text" value={editForm[f.key] || ''}
                    onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder || ''}
                    style={card.editInput}
                  />
                )}
              </div>
            ))}
          </div>
          <div style={card.editFooter}>
            <button onClick={() => setShowEdit(false)} style={card.editCancelBtn}>Cancel</button>
            <button onClick={saveEdit} disabled={saving} style={{ ...card.editSaveBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

      {/* Info grid */}
      <div style={card.infoGrid}>
        <div style={card.infoItem}>
          <p style={card.infoLabel}>SIZE</p>
          <p style={card.infoValue}>{company.size || '—'}</p>
        </div>
        <div style={card.infoItem}>
          <p style={card.infoLabel}>HQ</p>
          <p style={card.infoValue}>{company.headquarters || '—'}</p>
        </div>
        <div style={card.infoItem}>
          <p style={card.infoLabel}>WEBSITE</p>
          <EditableWebsite value={company.website} onSave={v => onUpdate(company.id, { website: v })} />
        </div>
        <div style={card.infoItem}>
          <p style={card.infoLabel}>FOLLOWERS</p>
          <p style={card.infoValue}>{company.followers || '—'}</p>
        </div>
      </div>

      {/* Compliance badges */}
      {company.compliance && (
        <div style={card.complianceSection}>
          <p style={card.infoLabel}>COMPLIANCE</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
            {company.compliance.split(',').map(c => c.trim()).filter(Boolean).map(cert => (
              <span key={cert} style={card.complianceBadge}>{cert}</span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {company.description && (
        <p style={card.description}>
          {company.description.substring(0, 150)}{company.description.length > 150 ? '…' : ''}
        </p>
      )}

      {/* Notes */}
      <div style={card.notesSection}>
        <div style={card.notesHeader}>
          <p style={card.infoLabel}>NOTES</p>
          <button style={card.editBtn} onClick={() => editingNotes ? handleSaveNotes() : setEditingNotes(true)}>
            {editingNotes ? 'Save' : 'Edit'}
          </button>
        </div>
        {editingNotes
          ? <textarea value={notes} onChange={e => setNotes(e.target.value)} style={card.textarea} placeholder="Add notes…" rows={2} autoFocus />
          : <p style={card.notesText}>{notes || 'No notes yet.'}</p>
        }
      </div>

      {/* LinkedIn fill result */}
      {fillResult && (
        <div style={{ padding: '8px 16px', background: fillResult.ok ? 'rgba(74,124,89,0.07)' : 'rgba(168,100,72,0.07)', borderTop: `1px solid ${fillResult.ok ? 'rgba(74,124,89,0.2)' : 'rgba(168,100,72,0.2)'}` }}>
          {fillResult.ok
            ? <p style={{ fontSize: '11px', color: '#4a7c59', fontWeight: '500' }}>✓ Filled: {fillResult.filled.join(', ')}</p>
            : <p style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '500' }}>⚠ {fillResult.msg}</p>
          }
        </div>
      )}

      {/* Compliance result */}
      {complianceResult && (
        <div style={{ padding: '10px 16px', background: complianceResult.error ? 'rgba(184,50,50,0.06)' : 'rgba(74,124,89,0.06)', borderTop: '1px solid var(--border)' }}>
          {complianceResult.error
            ? <p style={{ fontSize: '12px', color: 'var(--red)' }}>{complianceResult.error}</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#4a7c59' }}>Compliance check complete</p>
                <p style={{ fontSize: '12px', color: 'var(--text-soft)' }}>Certs: <strong style={{ color: 'var(--text)' }}>{complianceResult.compliance}</strong></p>
                <p style={{ fontSize: '12px', color: 'var(--text-soft)' }}>Security team: <strong style={{ color: 'var(--text)' }}>{complianceResult.has_security_team}</strong></p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{complianceResult.security_notes}</p>
              </div>
            )
          }
        </div>
      )}

      {/* Footer */}
      <div style={card.footer}>
        <select value={prospectStatus} onChange={e => handleStatusChange(e.target.value)}
          style={{ ...card.statusSelect, color: statusColor, borderColor: `${statusColor}40` }}>
          {PROSPECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={{ ...card.actionBtn, opacity: checkingCompliance ? 0.5 : 1 }} onClick={handleCheckCompliance} disabled={checkingCompliance}>
            {checkingCompliance ? 'Checking…' : 'Compliance'}
          </button>
          <button
            style={{ ...card.actionBtn, opacity: isAnalyzing ? 0.5 : 1 }}
            onClick={() => onAnalyzeWebsite(company)} disabled={isAnalyzing}>
            {isAnalyzing ? 'Analyzing…' : 'Analyze'}
          </button>
          <button
            style={{ ...card.actionBtn, color: fillingLI ? 'var(--text-muted)' : 'var(--accent)', borderColor: fillingLI ? 'var(--border)' : 'rgba(168,100,72,0.3)', opacity: fillingLI ? 0.5 : 1 }}
            onClick={handleFillLinkedIn} disabled={fillingLI}>
            {fillingLI ? 'Filling…' : '↯ Fill LI'}
          </button>
          {company.linkedin_url && (
            <a href={company.linkedin_url} target="_blank" rel="noreferrer" style={card.linkedinBtn}>LinkedIn ↗</a>
          )}
          <button style={card.primaryBtn} onClick={() => onViewLeads(company)}>Leads →</button>
        </div>
      </div>
    </div>
  )
}

// ─── EMPTY LEADS LINK ─────────────────────────────────────────

function EmptyLeadsLink({ company }) {
  const url = company.linkedin_url || ''
  const parts = url.split('/company/')
  const slug = parts[1] ? parts[1].split('/')[0] : ''
  if (!slug) return null
  return (
    <a href={`https://www.linkedin.com/company/${slug}/people/`} style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '500', display: 'block', marginTop: '12px' }}>
      Open {company.name} People Page →
    </a>
  )
}

// ─── LEADS MODAL ──────────────────────────────────────────────

function LeadsModal({ company, onClose }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await getCompanyLeads(company.id)
        setLeads(res.data.leads)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [company.id])

  return (
    <div style={modal.overlay} onClick={onClose}>
      <div style={modal.box} onClick={e => e.stopPropagation()}>
        <div style={modal.header}>
          <div>
            <p style={modal.eyebrow}>COMPANY LEADS</p>
            <h2 style={modal.title}>{company.name}</h2>
          </div>
          <button style={modal.closeBtn} onClick={onClose}>✕ Close</button>
        </div>
        {loading ? (
          <p style={modal.empty}>Loading leads…</p>
        ) : leads.length === 0 ? (
          <div style={modal.emptyState}>
            <p style={modal.emptyTitle}>No leads found</p>
            <p style={modal.emptyText}>Visit the company LinkedIn people page and use the extension to extract leads.</p>
            <EmptyLeadsLink company={company} />
          </div>
        ) : (
          <div style={modal.leadsGrid}>
            {leads.map(lead => (
              <div key={lead.id} style={modal.leadCard}>
                <p style={modal.leadName}>{lead.name}</p>
                <p style={modal.leadTitle}>{lead.title || '—'}</p>
                <p style={modal.leadLocation}>{lead.location || '—'}</p>
                {lead.profile_url && (
                  <a href={lead.profile_url} target="_blank" rel="noreferrer" style={modal.leadLink}>View Profile →</a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ANALYSIS MODAL ───────────────────────────────────────────

function AnalysisModal({ result, onClose }) {
  const { company, analysis } = result
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(29,27,27,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', maxWidth: '540px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', marginBottom: '3px' }}>{company.name}</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Website Analysis</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>✕</button>
        </div>

        {analysis.error ? (
          <div style={{ padding: '14px 16px', background: 'var(--red-dim)', borderRadius: '8px', marginBottom: '20px' }}>
            <p style={{ fontSize: '13px', color: 'var(--red)' }}>{analysis.error}</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {[
                { label: 'Company Type', value: analysis.company_type || '—' },
                { label: 'Is SaaS', value: analysis.is_saas === true ? 'Yes' : analysis.is_saas === false ? 'No' : '—' },
                { label: 'Target Market', value: analysis.target_market || '—' },
                { label: 'Has Login', value: analysis.has_login === true ? 'Yes' : analysis.has_login === false ? 'No' : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '10px' }}>
                  <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '1px', marginBottom: '5px', textTransform: 'uppercase' }}>{label}</p>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{value}</p>
                </div>
              ))}
            </div>

            {analysis.compliance?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Compliance</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {analysis.compliance.map(c => (
                    <span key={c} style={{ padding: '3px 10px', background: 'rgba(74,124,89,0.10)', color: '#4a7c59', borderRadius: '4px', fontSize: '12px', fontWeight: '600', border: '1px solid rgba(74,124,89,0.2)' }}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {analysis.products_or_services?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>Products / Services</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {analysis.products_or_services.map(p => (
                    <span key={p} style={{ padding: '3px 10px', background: 'var(--surface)', color: 'var(--text-secondary)', borderRadius: '4px', fontSize: '12px' }}>{p}</span>
                  ))}
                </div>
              </div>
            )}

            {analysis.website_summary && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>Summary</p>
                <p style={{ fontSize: '13px', color: 'var(--text-soft)', lineHeight: 1.6 }}>{analysis.website_summary}</p>
              </div>
            )}
          </>
        )}

        <button onClick={onClose} style={{ width: '100%', padding: '12px', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
          Close
        </button>
      </div>
    </div>
  )
}

// ─── MAIN COMPANIES PAGE ──────────────────────────────────────

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [followerFilter, setFollowerFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [analyzingId, setAnalyzingId] = useState(null)
  const [showDMFinder, setShowDMFinder] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [showSpreadsheet, setShowSpreadsheet] = useState(false)
  const [bulkFilling, setBulkFilling] = useState(false)
  const [bulkFillMsg, setBulkFillMsg] = useState('')

  useEffect(() => { fetchCompanies() }, [])

  async function fetchCompanies() {
    try {
      const res = await getCompanies()
      setCompanies(res.data.companies)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleUpdate(id, data) {
    try {
      await updateCompany(id, data)
      setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    } catch (e) { console.error(e) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this company?')) return
    try {
      await deleteCompany(id)
      setCompanies(prev => prev.filter(c => c.id !== id))
    } catch (e) { console.error(e) }
  }

  async function handleAnalyzeWebsite(company) {
    const geminiKey = localStorage.getItem('geminiKey') || ''
    const openaiKey = localStorage.getItem('openaiKey') || ''
    const groqKey = localStorage.getItem('groqKey') || ''
    if (!geminiKey && !openaiKey && !groqKey) {
      alert('Please add an AI key in Settings. Gemini is free at aistudio.google.com')
      return
    }
    if (!company.website && !groqKey) {
      alert("Add this company's website URL first, then click Analyze.")
      return
    }
    setAnalyzingId(company.id)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:8000/api/companies/${company.id}/analyze-website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ gemini_key: geminiKey, openai_key: openaiKey, groq_key: groqKey, website: company.website })
      })
      const data = await res.json()
      if (data.success && data.analysis) {
        setCompanies(prev => prev.map(c => {
          if (c.id !== company.id) return c
          return { ...c, classification: data.analysis.company_type || c.classification, compliance: data.analysis.compliance?.join(', ') || c.compliance, company_type: data.analysis.company_type || c.company_type }
        }))
        setAnalysisResult({ company, analysis: data.analysis })
      } else {
        alert('Analysis failed. Check your API key and website URL.')
      }
    } catch (e) {
      console.error('Analysis error:', e)
      alert('Analysis failed. Make sure the backend is running.')
    } finally {
      setAnalyzingId(null)
    }
  }

  const filtered = companies.filter(c => {
    const ms = search === '' || [c.name, c.industry, c.headquarters].join(' ').toLowerCase().includes(search.toLowerCase())
    const mc = classFilter === 'all' || c.classification === classFilter || (!c.classification && classFilter === 'Unclassified')
    const ms2 = statusFilter === 'all' || c.prospect_status === statusFilter
    const mf = followerFilter === 'all' || parseFollowers(c.followers) >= parseInt(followerFilter)
    const mt = typeFilter === 'all' || c.company_type === typeFilter
    return ms && mc && ms2 && mf && mt
  })

  const prospectCount = companies.filter(c => c.prospect_status === 'Prospect').length
  const notFitCount = companies.filter(c => c.prospect_status === 'Not a Fit').length

  function exportCompaniesCSV() {
    const cols = ['name', 'classification', 'prospect_status', 'website_url', 'linkedin_url', 'headquarters', 'size', 'followers', 'revenue', 'compliance', 'company_type', 'description', 'notes']
    const headers = ['Name', 'Classification', 'Status', 'Website', 'LinkedIn URL', 'HQ', 'Employees', 'Followers', 'Revenue', 'Compliance', 'Type', 'Description', 'Notes']
    const rows = companies.map(c => cols.map(k => { const v = (c[k] || '').toString(); return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v }).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `companies-${new Date().toISOString().split('T')[0]}.csv`
    link.click(); URL.revokeObjectURL(url)
  }

  async function handleBulkAutofill() {
    const targetIds = selectedIds.length ? selectedIds : companies.map(c => c.id)
    if (!targetIds.length) return
    setBulkFilling(true)
    setBulkFillMsg(`Autofilling ${targetIds.length} companies in parallel…`)
    try {
      const res = await bulkAutofillCompanies(targetIds)
      const { results, filled: filledCount, total } = res.data
      // Apply all updates to local state at once
      setCompanies(prev => {
        const updated = [...prev]
        for (const r of results) {
          if (r.success && r.update && Object.keys(r.update).length > 0) {
            const idx = updated.findIndex(c => c.id === r.id)
            if (idx !== -1) updated[idx] = { ...updated[idx], ...r.update }
          }
        }
        return updated
      })
      setBulkFillMsg(`Done — ${filledCount} of ${total} companies updated`)
    } catch (e) {
      setBulkFillMsg('Autofill failed — ' + (e.response?.data?.detail || e.message))
    } finally {
      setBulkFilling(false)
      setTimeout(() => setBulkFillMsg(''), 5000)
    }
  }

  function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} companies?`)) return
    Promise.all(selectedIds.map(id => deleteCompany(id)))
      .then(() => { setCompanies(prev => prev.filter(c => !selectedIds.includes(c.id))); setSelectedIds([]) })
      .catch(e => console.error(e))
  }

  return (
    <div style={s.page}>
      <Navbar />

      <div style={{ ...s.hero, position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 90% at 5% 50%, rgba(168,100,72,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <p style={s.eyebrow}>Company Intelligence</p>
          <h1 style={s.heroTitle}>
            {filtered.length}
            <span style={s.heroUnit}> companies</span>
          </h1>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#4a7c59' }}>{prospectCount} prospects</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>·</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)' }}>{notFitCount} not a fit</span>
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setShowBulkAdd(true)} style={s.heroBtn}>Bulk Add</button>
          <button onClick={() => setShowSpreadsheet(true)} style={s.heroBtn}>Spreadsheet</button>
          <button onClick={exportCompaniesCSV} style={{ ...s.heroBtn, background: '#1d1b1b', color: '#fdfdfd', border: 'none' }}>Export →</button>
        </div>
      </div>

      <div style={s.container}>
        {/* Filters */}
        <div style={s.filters}>
          <div style={s.searchBox}>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', paddingLeft: '12px' }}>⌕</span>
            <input type="text" placeholder="Search companies…" value={search} onChange={e => setSearch(e.target.value)} style={s.searchInput} />
          </div>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={s.select}>
            <option value="all">All types</option>
            {CLASSIFICATIONS.filter(c => c !== 'Custom...').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={s.select}>
            <option value="all">All statuses</option>
            {PROSPECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={s.select}>
            <option value="all">Product / Services</option>
            <option value="Product">Product</option>
            <option value="Services">Services</option>
            <option value="Hybrid">Hybrid</option>
          </select>
          <select value={followerFilter} onChange={e => setFollowerFilter(e.target.value)} style={s.select}>
            <option value="all">All followers</option>
            <option value="1000">1K+</option>
            <option value="5000">5K+</option>
            <option value="10000">10K+</option>
            <option value="50000">50K+</option>
            <option value="100000">100K+</option>
          </select>
          <button onClick={() => setShowAddModal(true)} style={s.primaryBtn}>+ Add Company</button>
          <button onClick={() => setShowDMFinder(true)} style={s.secondaryBtn}>Find DMs</button>
          <button onClick={handleBulkAutofill} disabled={bulkFilling}
            style={{ ...s.secondaryBtn, color: 'var(--accent)', borderColor: 'rgba(168,100,72,0.3)', opacity: bulkFilling ? 0.5 : 1, whiteSpace: 'nowrap' }}>
            {bulkFilling ? 'Filling…' : `↯ Fill All${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={selectedIds.length === filtered.length && filtered.length > 0}
              onChange={() => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(c => c.id))}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            Select all
          </label>
        </div>

        {bulkFillMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: bulkFilling ? 'rgba(168,100,72,0.05)' : 'rgba(74,124,89,0.06)', border: `1px solid ${bulkFilling ? 'rgba(168,100,72,0.2)' : 'rgba(74,124,89,0.2)'}`, borderRadius: '8px', marginBottom: '12px' }}>
            {bulkFilling && <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.02em', color: bulkFilling ? 'var(--accent)' : '#4a7c59', fontWeight: '500' }}>{bulkFillMsg}</span>
          </div>
        )}

        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em', color: 'var(--text)', fontWeight: '600' }}>{selectedIds.length} selected</span>
            <button onClick={handleBulkDelete} style={{ padding: '5px 12px', background: 'var(--red)', border: 'none', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: '#fff', cursor: 'pointer' }}>Delete</button>
            <button onClick={() => setShowDMFinder(true)} style={{ padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: 'var(--text)', cursor: 'pointer' }}>Find DMs</button>
            <button onClick={() => setSelectedIds([])} style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: 'var(--text-muted)', cursor: 'pointer' }}>Clear</button>
          </div>
        )}

        {loading ? (
          <p style={s.empty}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div style={s.emptyState}>
            <p style={s.emptyTitle}>No companies yet</p>
            <p style={s.emptyText}>Use the extension on LinkedIn company search to extract companies, or click <strong>+ Add Company</strong> above.</p>
          </div>
        ) : (
          <div style={s.grid}>
            {filtered.map(company => (
              <CompanyCard
                key={company.id}
                company={company}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onViewLeads={setSelectedCompany}
                onAnalyzeWebsite={handleAnalyzeWebsite}
                analyzingId={analyzingId}
                selected={selectedIds.includes(company.id)}
                onToggle={id => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
              />
            ))}
          </div>
        )}
      </div>

      {showAddModal && <AddCompanyModal onClose={() => setShowAddModal(false)} onRefresh={fetchCompanies} />}
      {showBulkAdd && <BulkAddModal onClose={() => setShowBulkAdd(false)} onRefresh={fetchCompanies} />}
      {showSpreadsheet && <CompaniesSpreadsheet companies={companies} onClose={() => setShowSpreadsheet(false)} onRefresh={fetchCompanies} />}
      {selectedCompany && <LeadsModal company={selectedCompany} onClose={() => setSelectedCompany(null)} />}
      {analysisResult && <AnalysisModal result={analysisResult} onClose={() => setAnalysisResult(null)} />}
      {showDMFinder && (
        <DMFinder
          companies={selectedIds.length > 0 ? companies.filter(c => selectedIds.includes(c.id)) : filtered}
          onClose={() => setShowDMFinder(false)}
        />
      )}
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  hero: { padding: '64px 48px 40px', borderBottom: '1px dashed var(--border-dash)' },
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' },
  heroTitle: { fontFamily: 'var(--font-display)', fontSize: 'clamp(64px, 9vw, 112px)', fontWeight: '400', color: 'var(--text)', letterSpacing: '-0.05em', lineHeight: 1, marginBottom: '0' },
  heroUnit: { fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4.5vw, 56px)', fontWeight: '400', color: 'var(--text-muted)', letterSpacing: '-0.03em' },
  heroStats: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  heroBtn: { padding: '9px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' },
  container: { padding: '20px 48px' },
  filters: { display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', flex: 1, minWidth: '200px' },
  searchInput: { flex: 1, padding: '9px 12px', background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' },
  select: { padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '10px', fontWeight: '500', color: 'var(--text-secondary)', outline: 'none', fontFamily: 'var(--font-mono)', cursor: 'pointer', letterSpacing: '0.04em' },
  primaryBtn: { padding: '9px 16px', background: '#1d1b1b', border: 'none', borderRadius: '7px', fontSize: '10px', fontWeight: '600', color: '#fdfdfd', cursor: 'pointer', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', letterSpacing: '0.04em' },
  secondaryBtn: { padding: '9px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '10px', fontWeight: '500', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', letterSpacing: '0.04em' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' },
  empty: { padding: '40px 0', fontSize: '13px', color: 'var(--text-muted)' },
  emptyState: { padding: '80px 0', textAlign: 'center' },
  emptyTitle: { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '400', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '-0.03em' },
  emptyText: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 },
}

const card = {
  wrapper: {
    background: 'var(--bg)', border: '1px solid rgba(196,193,189,0.6)',
    borderRadius: '8px', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 16px 10px', gap: '10px' },
  headerLeft: { flex: 1 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  name: { fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '400', color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1 },
  industry: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.02em' },
  select: { fontFamily: 'var(--font-mono)', padding: '3px 7px', background: 'var(--surface)', border: '1px solid', borderRadius: '4px', fontSize: '9px', fontWeight: '600', outline: 'none', cursor: 'pointer', letterSpacing: '0.04em' },
  editCardBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', padding: '3px 6px', lineHeight: 1 },
  deleteBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', padding: '4px', opacity: 0.5 },
  editPanel: { padding: '14px 16px', borderTop: '1px dashed var(--border-dash)', background: 'var(--surface)' },
  editGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' },
  editLabel: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' },
  editInput: { width: '100%', padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  editFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  editCancelBtn: { fontFamily: 'var(--font-mono)', padding: '7px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer' },
  editSaveBtn: { fontFamily: 'var(--font-mono)', padding: '7px 16px', background: '#1d1b1b', border: 'none', borderRadius: '6px', fontSize: '10px', fontWeight: '600', color: '#fdfdfd', cursor: 'pointer' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid rgba(196,193,189,0.5)', borderBottom: '1px solid rgba(196,193,189,0.5)', background: 'rgba(196,193,189,0.35)', gap: '1px' },
  infoItem: { padding: '9px 14px', background: 'var(--bg)' },
  infoLabel: { fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase' },
  infoValue: { fontSize: '12px', color: 'var(--text)', fontWeight: '400', margin: 0 },
  complianceSection: { padding: '8px 14px', borderBottom: '1px solid rgba(196,193,189,0.4)' },
  complianceBadge: { padding: '2px 7px', border: '1px solid rgba(74,124,89,0.3)', borderRadius: '3px', fontSize: '9px', fontWeight: '600', color: '#4a7c59', letterSpacing: '0.5px', background: 'rgba(74,124,89,0.07)', fontFamily: 'var(--font-mono)' },
  description: { padding: '8px 14px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, borderBottom: '1px solid rgba(196,193,189,0.4)' },
  notesSection: { padding: '8px 14px', borderBottom: '1px solid rgba(196,193,189,0.4)', flex: 1 },
  notesHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' },
  editBtn: { fontFamily: 'var(--font-mono)', background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '9px', fontWeight: '500', letterSpacing: '0.04em', cursor: 'pointer', padding: '2px 7px' },
  notesText: { fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 },
  textarea: { width: '100%', padding: '7px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', flexWrap: 'wrap', gap: '6px', marginTop: 'auto' },
  statusSelect: { fontFamily: 'var(--font-mono)', padding: '4px 8px', background: 'var(--surface)', border: '1px solid', borderRadius: '4px', fontSize: '9px', fontWeight: '600', outline: 'none', cursor: 'pointer', letterSpacing: '0.04em' },
  actionBtn: { fontFamily: 'var(--font-mono)', padding: '4px 9px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '9px', fontWeight: '500', color: 'var(--text-secondary)', cursor: 'pointer', letterSpacing: '0.04em' },
  linkedinBtn: { fontFamily: 'var(--font-mono)', padding: '4px 9px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '9px', fontWeight: '500', color: 'var(--text-muted)', textDecoration: 'none', letterSpacing: '0.04em' },
  primaryBtn: { fontFamily: 'var(--font-mono)', padding: '5px 12px', background: '#1d1b1b', border: 'none', borderRadius: '5px', fontSize: '10px', fontWeight: '600', color: '#fdfdfd', cursor: 'pointer', letterSpacing: '0.04em' },
}

const modal = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(29,27,27,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' },
  box: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 28px', borderBottom: '1px solid var(--border)' },
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' },
  title: { fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)' },
  closeBtn: { padding: '7px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-mono)' },
  empty: { padding: '32px 28px', fontSize: '13px', color: 'var(--text-muted)' },
  emptyState: { padding: '48px 28px', textAlign: 'center' },
  emptyTitle: { fontSize: '15px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' },
  emptyText: { fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 },
  leadsGrid: { padding: '20px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', overflowY: 'auto' },
  leadCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '3px' },
  leadName: { fontSize: '13px', fontWeight: '600', color: 'var(--text)' },
  leadTitle: { fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 },
  leadLocation: { fontSize: '11px', color: 'var(--text-muted)' },
  leadLink: { fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', fontWeight: '500', marginTop: '4px' },
}
