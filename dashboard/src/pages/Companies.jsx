import React, { useState, useEffect } from 'react'
import { getCompanies, updateCompany, deleteCompany, getCompanyLeads, checkCompliance } from '../services/api'
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
  'Fintech': '#00d4ff', 'Healthtech': 'var(--green)', 'SaaS': 'var(--amber)',
  'Cybersecurity': '#ff2d2d', 'IT Services': '#a78bfa', 'E-commerce': '#fb923c',
  'Edtech': '#34d399', 'Logistics': '#94a3b8', 'Manufacturing': '#94a3b8',
  'Banking': 'var(--gray-4)', 'Insurance': 'var(--gray-4)', 'VC / Investment': '#ff2d2d',
  'Media': '#f472b6', 'Consulting': '#60a5fa', 'Retail': '#fbbf24',
  'Real Estate': '#a3e635', 'Government': 'var(--gray-4)', 'Non-profit': 'var(--green)',
  'Unclassified': 'var(--gray-3)', 'Other': 'var(--gray-4)',
}

const prospectColors = {
  'To Review': 'var(--gray-4)', 'Prospect': 'var(--green)', 'Not a Fit': '#ff2d2d',
  'Contacted': 'var(--amber)', 'In Progress': '#00d4ff',
  'Closed Won': 'var(--green)', 'Closed Lost': 'var(--gray-4)',
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

function CompanyCard({ company, onUpdate, onDelete, onViewLeads }) {
  const [classification, setClassification] = useState(company.classification || classifyCompany(company))
  const [prospectStatus, setProspectStatus] = useState(company.prospect_status || 'To Review')
  const [notes, setNotes] = useState(company.notes || '')
  const [editingNotes, setEditingNotes] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [checkingCompliance, setCheckingCompliance] = useState(false)
  const [complianceResult, setComplianceResult] = useState(null)

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
    const groqKey = localStorage.getItem('groqKey')
    if (!groqKey) {
      alert('Please add your Groq API key in Settings first. It\'s free at console.groq.com')
      return
    }
    setCheckingCompliance(true)
    setComplianceResult(null)
    try {
      const res = await checkCompliance(company.id, groqKey)
      setComplianceResult(res.data)
      onUpdate(company.id, { compliance: res.data.compliance })
    } catch (e) {
      setComplianceResult({ error: 'Check failed. Verify your Groq API key in Settings.' })
    } finally {
      setCheckingCompliance(false)
    }
  }

  const classColor = classificationColors[classification] || 'var(--gray-4)'
  const statusColor = prospectColors[prospectStatus] || 'var(--gray-4)'

  return (
    <div style={{ ...card.wrapper, borderLeft: '3px solid ' + classColor }}>
      {/* Header */}
      <div style={card.header}>
        <div style={card.headerLeft}>
          <h3 style={card.name}>{company.name}</h3>
          <p style={card.industry}>{company.industry || 'Industry unknown'}</p>
        </div>
        <div style={card.headerRight}>
          {showCustomInput ? (
            <input
              type="text" placeholder="Type industry..." autoFocus
              style={{ ...card.select, width: '130px', color: 'var(--white)', borderColor: 'var(--amber)' }}
              onBlur={(e) => { const val = e.target.value.trim(); if (val) handleClassificationChange(val); setShowCustomInput(false) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { const val = e.target.value.trim(); if (val) handleClassificationChange(val); setShowCustomInput(false) }
                if (e.key === 'Escape') setShowCustomInput(false)
              }}
            />
          ) : (
            <select
              value={classification}
              onChange={(e) => { if (e.target.value === 'Custom...') { setShowCustomInput(true) } else { handleClassificationChange(e.target.value) } }}
              style={{ ...card.select, color: classColor, borderColor: classColor }}
            >
              {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <button style={card.deleteBtn} onClick={() => onDelete(company.id)}>✕</button>
        </div>
      </div>

      {/* Info grid */}
      <div style={card.infoGrid}>
        {[
          { label: 'SIZE', value: company.size },
          { label: 'HQ', value: company.headquarters },
          { label: 'WEBSITE', value: company.website, isLink: true },
          { label: 'FOLLOWERS', value: company.followers },
        ].map(({ label, value, isLink }) => (
          <div key={label} style={card.infoItem}>
            <p style={card.infoLabel}>{label}</p>
            {isLink && value
              ? <a href={value} style={card.infoLink}>{value.replace('https://', '')}</a>
              : <p style={card.infoValue}>{value || '—'}</p>
            }
          </div>
        ))}
      </div>

      {/* Compliance badges */}
      {company.compliance && (
        <div style={card.complianceSection}>
          <p style={card.infoLabel}>COMPLIANCE</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {company.compliance.split(',').map(c => c.trim()).filter(Boolean).map(cert => (
              <span key={cert} style={card.complianceBadge}>{cert}</span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {company.description && (
        <p style={card.description}>{company.description.substring(0, 150)}{company.description.length > 150 ? '...' : ''}</p>
      )}

      {/* Notes */}
      <div style={card.notesSection}>
        <div style={card.notesHeader}>
          <p style={card.infoLabel}>NOTES</p>
          <button style={card.editBtn} onClick={() => editingNotes ? handleSaveNotes() : setEditingNotes(true)}>
            {editingNotes ? 'SAVE' : 'EDIT'}
          </button>
        </div>
        {editingNotes
          ? <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={card.textarea} placeholder="Add notes..." rows={2} autoFocus />
          : <p style={card.notesText}>{notes || 'No notes yet.'}</p>
        }
      </div>

      {/* AI Compliance Result */}
      {complianceResult && (
        <div style={{ padding: '12px 20px', background: complianceResult.error ? 'rgba(255,45,45,0.06)' : 'rgba(0,230,118,0.06)', borderTop: '1px solid var(--gray-2)' }}>
          {complianceResult.error
            ? <p style={{ fontSize: '12px', color: '#ff2d2d' }}>{complianceResult.error}</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--green)', letterSpacing: '1px' }}>✓ AI COMPLIANCE CHECK COMPLETE</p>
                <p style={{ fontSize: '12px', color: 'var(--gray-5)' }}>Certifications: <strong style={{ color: 'var(--white)' }}>{complianceResult.compliance}</strong></p>
                <p style={{ fontSize: '12px', color: 'var(--gray-5)' }}>Security Team: <strong style={{ color: 'var(--white)' }}>{complianceResult.has_security_team}</strong></p>
                <p style={{ fontSize: '11px', color: 'var(--gray-4)', fontStyle: 'italic' }}>{complianceResult.security_notes}</p>
                <p style={{ fontSize: '10px', color: 'var(--gray-4)' }}>Confidence: {complianceResult.confidence}</p>
              </div>
            )
          }
        </div>
      )}

      {/* Footer */}
      <div style={card.footer}>
        <select value={prospectStatus} onChange={(e) => handleStatusChange(e.target.value)}
          style={{ ...card.statusSelect, color: statusColor, borderColor: statusColor }}>
          {PROSPECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            style={{ ...card.complianceBtn, opacity: checkingCompliance ? 0.6 : 1 }}
            onClick={handleCheckCompliance}
            disabled={checkingCompliance}
          >
            {checkingCompliance ? '⏳ Checking...' : '🔍 Check Compliance'}
          </button>
          {company.linkedin_url && (
            <a href={company.linkedin_url} style={card.linkedinBtn}>LinkedIn →</a>
          )}
          <button style={card.findBtn} onClick={() => onViewLeads(company)}>
            View Leads →
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyLeadsLink({ company }) {
  const url = company.linkedin_url || ''
  const parts = url.split('/company/')
  const companySlug = parts[1] ? parts[1].split('/')[0] : ''
  const peopleUrl = 'https://www.linkedin.com/company/' + companySlug + '/people/'
  if (!companySlug) return null
  return (
    <a href={peopleUrl} style={{ color: 'var(--green)', fontSize: '13px', fontWeight: '600', display: 'block', marginTop: '12px' }}>
      Open {company.name} People Page →
    </a>
  )
}

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
    <div style={modal.overlay}>
      <div style={modal.box}>
        <div style={modal.header}>
          <div>
            <p style={modal.eyebrow}>COMPANY LEADS</p>
            <h2 style={modal.title}>{company.name}</h2>
          </div>
          <button style={modal.closeBtn} onClick={onClose}>✕ Close</button>
        </div>
        {loading ? (
          <p style={modal.empty}>Loading leads...</p>
        ) : leads.length === 0 ? (
          <div style={modal.emptyState}>
            <p style={modal.emptyTitle}>No leads found for this company</p>
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
                {lead.profile_url && <a href={lead.profile_url} style={modal.leadLink}>View Profile →</a>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [followerFilter, setFollowerFilter] = useState('all')
  const [selectedCompany, setSelectedCompany] = useState(null)

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

  const filtered = companies.filter(c => {
    const ms = search === '' || [c.name, c.industry, c.headquarters].join(' ').toLowerCase().includes(search.toLowerCase())
    const mc = classFilter === 'all' || c.classification === classFilter || (!c.classification && classFilter === 'Unclassified')
    const ms2 = statusFilter === 'all' || c.prospect_status === statusFilter
    const mf = followerFilter === 'all' || parseFollowers(c.followers) >= parseInt(followerFilter)
    return ms && mc && ms2 && mf
  })

  const prospectCount = companies.filter(c => c.prospect_status === 'Prospect').length
  const notFitCount = companies.filter(c => c.prospect_status === 'Not a Fit').length

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.hero}>
        <div>
          <p style={s.eyebrow}>COMPANY INTELLIGENCE</p>
          <h1 style={s.heroTitle}>{filtered.length}<span style={s.heroUnit}> companies</span></h1>
          <div style={s.heroStats}>
            <span style={{ color: 'var(--green)', fontSize: '12px', fontWeight: '600' }}>{prospectCount} prospects</span>
            <span style={{ color: 'var(--gray-4)', fontSize: '12px' }}>·</span>
            <span style={{ color: '#ff2d2d', fontSize: '12px', fontWeight: '600' }}>{notFitCount} not a fit</span>
          </div>
        </div>
      </div>

      <div style={s.container}>
        <div style={s.filters}>
          <div style={s.searchBox}>
            <span style={s.searchIcon}>↗</span>
            <input type="text" placeholder="Search companies..." value={search} onChange={(e) => setSearch(e.target.value)} style={s.searchInput} />
          </div>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={s.select}>
            <option value="all">All types</option>
            {CLASSIFICATIONS.filter(c => c !== 'Custom...').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={s.select}>
            <option value="all">All statuses</option>
            {PROSPECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={followerFilter} onChange={(e) => setFollowerFilter(e.target.value)} style={s.select}>
            <option value="all">All followers</option>
            <option value="1000">1K+ followers</option>
            <option value="5000">5K+ followers</option>
            <option value="10000">10K+ followers</option>
            <option value="50000">50K+ followers</option>
            <option value="100000">100K+ followers</option>
          </select>
        </div>

        {loading ? (
          <p style={s.empty}>Loading companies...</p>
        ) : filtered.length === 0 ? (
          <div style={s.emptyState}>
            <p style={s.emptyTitle}>No companies yet</p>
            <p style={s.emptyText}>Use the extension on LinkedIn company search to extract companies.</p>
          </div>
        ) : (
          <div style={s.grid}>
            {filtered.map(company => (
              <CompanyCard key={company.id} company={company} onUpdate={handleUpdate} onDelete={handleDelete} onViewLeads={setSelectedCompany} />
            ))}
          </div>
        )}
      </div>

      {selectedCompany && <LeadsModal company={selectedCompany} onClose={() => setSelectedCompany(null)} />}
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: 'var(--black)' },
  hero: { padding: '48px 32px 32px', borderBottom: '1px solid var(--gray-2)' },
  eyebrow: { fontSize: '11px', fontWeight: '600', letterSpacing: '4px', color: 'var(--gray-4)', marginBottom: '12px' },
  heroTitle: { fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: '900', letterSpacing: '-2px', color: 'var(--white)', lineHeight: 1 },
  heroUnit: { fontSize: 'clamp(20px, 2.5vw, 32px)', fontWeight: '300', color: 'var(--gray-4)', letterSpacing: '-1px' },
  heroStats: { display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px' },
  container: { padding: '24px 32px' },
  filters: { display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', flex: 1, minWidth: '200px' },
  searchIcon: { padding: '0 14px', color: 'var(--gray-4)', fontSize: '16px' },
  searchInput: { flex: 1, padding: '11px 14px 11px 0', background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--white)' },
  select: { padding: '10px 14px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '12px', color: 'var(--white)', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' },
  empty: { padding: '40px 0', fontSize: '13px', color: 'var(--gray-4)' },
  emptyState: { padding: '80px 0', textAlign: 'center' },
  emptyTitle: { fontSize: '18px', fontWeight: '700', color: 'var(--gray-3)', marginBottom: '8px' },
  emptyText: { fontSize: '13px', color: 'var(--gray-4)', lineHeight: 1.6 },
}

const card = {
  wrapper: { background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 20px 12px', gap: '12px' },
  headerLeft: { flex: 1 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  name: { fontSize: '16px', fontWeight: '700', color: 'var(--white)', marginBottom: '4px', letterSpacing: '-0.3px' },
  industry: { fontSize: '11px', color: 'var(--gray-4)', letterSpacing: '0.5px' },
  select: { padding: '4px 8px', background: 'var(--black)', border: '1px solid', borderRadius: '3px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' },
  deleteBtn: { background: 'none', border: 'none', color: 'var(--gray-4)', fontSize: '13px', cursor: 'pointer', padding: '4px', fontWeight: '700' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', borderTop: '1px solid var(--gray-2)', borderBottom: '1px solid var(--gray-2)' },
  infoItem: { padding: '10px 20px', borderRight: '1px solid var(--gray-2)' },
  infoLabel: { fontSize: '8px', fontWeight: '700', letterSpacing: '2px', color: 'var(--gray-4)', marginBottom: '4px' },
  infoValue: { fontSize: '12px', color: 'var(--white)', fontWeight: '500' },
  infoLink: { fontSize: '12px', color: '#00d4ff', textDecoration: 'none' },
  complianceSection: { padding: '12px 20px', borderBottom: '1px solid var(--gray-2)' },
  complianceBadge: { padding: '2px 8px', border: '1px solid var(--green)', borderRadius: '2px', fontSize: '9px', fontWeight: '700', color: 'var(--green)', letterSpacing: '0.5px' },
  description: { padding: '12px 20px', fontSize: '12px', color: 'var(--gray-4)', lineHeight: 1.5, borderBottom: '1px solid var(--gray-2)' },
  notesSection: { padding: '12px 20px', borderBottom: '1px solid var(--gray-2)' },
  notesHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  editBtn: { background: 'none', border: '1px solid var(--gray-3)', borderRadius: '3px', color: 'var(--gray-4)', fontSize: '8px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer', padding: '2px 8px', fontFamily: 'inherit' },
  notesText: { fontSize: '12px', color: 'var(--gray-4)', lineHeight: 1.5 },
  textarea: { width: '100%', padding: '8px', background: 'var(--black)', border: '1px solid var(--gray-2)', borderRadius: '3px', fontSize: '12px', color: 'var(--white)', outline: 'none', fontFamily: 'inherit', resize: 'vertical' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', flexWrap: 'wrap', gap: '8px' },
  statusSelect: { padding: '4px 10px', background: 'var(--black)', border: '1px solid', borderRadius: '3px', fontSize: '11px', fontWeight: '600', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' },
  complianceBtn: { padding: '6px 12px', background: 'transparent', border: '1px solid var(--gray-2)', borderRadius: '3px', fontSize: '11px', color: 'var(--gray-4)', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit' },
  linkedinBtn: { padding: '6px 12px', background: 'transparent', border: '1px solid var(--gray-2)', borderRadius: '3px', fontSize: '11px', color: 'var(--gray-4)', textDecoration: 'none', fontWeight: '600' },
  findBtn: { padding: '6px 14px', background: 'var(--white)', border: 'none', borderRadius: '3px', fontSize: '11px', fontWeight: '700', color: 'var(--black)', cursor: 'pointer', fontFamily: 'inherit' },
}

const modal = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' },
  box: { background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '8px', width: '100%', maxWidth: '800px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 28px', borderBottom: '1px solid var(--gray-2)' },
  eyebrow: { fontSize: '9px', fontWeight: '700', letterSpacing: '3px', color: 'var(--gray-4)', marginBottom: '6px' },
  title: { fontSize: '22px', fontWeight: '900', letterSpacing: '-1px', color: 'var(--white)' },
  closeBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '12px', color: 'var(--gray-4)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' },
  empty: { padding: '32px 28px', fontSize: '13px', color: 'var(--gray-4)' },
  emptyState: { padding: '48px 28px', textAlign: 'center' },
  emptyTitle: { fontSize: '16px', fontWeight: '700', color: 'var(--gray-3)', marginBottom: '8px' },
  emptyText: { fontSize: '13px', color: 'var(--gray-4)', lineHeight: 1.6 },
  leadsGrid: { padding: '20px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', overflowY: 'auto' },
  leadCard: { background: 'var(--black)', border: '1px solid var(--gray-2)', borderRadius: '4px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' },
  leadName: { fontSize: '13px', fontWeight: '700', color: 'var(--white)' },
  leadTitle: { fontSize: '11px', color: 'var(--gray-4)', lineHeight: 1.4 },
  leadLocation: { fontSize: '11px', color: 'var(--gray-4)' },
  leadLink: { fontSize: '10px', color: '#00d4ff', textDecoration: 'none', fontWeight: '700', marginTop: '4px' },
}