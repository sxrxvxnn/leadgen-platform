import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { getCompanies, updateCompany, deleteCompany, bulkDeleteCompanies, getCompanyLeads, checkCompliance, autofillCompanyLinkedIn, analyzeCompany, enrichPipeline, getCompanySignals, fetchCompanyFunding } from '../services/api'
import CompanySignals from '../components/CompanySignals'
import { useBulkOps } from '../context/BulkOpsContext'
import { syncToDirectory } from '../services/companyDirectory'
import DMFinder from '../components/DMFinder'
import AddCompanyModal from '../components/AddCompanyModal'
import BulkAddModal from '../components/BulkAddModal'
import CompaniesSpreadsheet from '../components/CompaniesSpreadsheet'
import { SkeletonCard } from '../components/Skeleton'
import { CardContainer, CardBody, CardItem } from '../components/ThreeDCard'

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
    'Service':  { bg: 'rgba(168,100,72,0.10)',  color: '#a86448', border: 'rgba(168,100,72,0.25)' },
    'Services': { bg: 'rgba(168,100,72,0.10)',  color: '#a86448', border: 'rgba(168,100,72,0.25)' },
    'Hybrid':   { bg: 'rgba(123,107,174,0.10)', color: '#7b6bae', border: 'rgba(123,107,174,0.25)' },
  }
  const st = map[type]
  if (!st) return null
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
  const text = [company.name, company.industry, company.description, company.products_or_services].join(' ').toLowerCase()
  if (/fintech|payment|lending|neobank|wallet|crypto|blockchain|insurtech/.test(text)) return 'Fintech'
  if (/health|medical|pharma|clinic|hospital|biotech|telemedicine|healthcare/.test(text)) return 'Healthtech'
  if (/cyber|security|vapt|penetration|vulnerability|soc\b|siem/.test(text)) return 'Cybersecurity'
  if (/\bit services\b|it consulting|managed service|msp|tech support/.test(text)) return 'IT Services'
  if (/\bsaas\b|cloud platform|cloud-based|software-as|subscription.{0,10}software/.test(text)) return 'SaaS'
  if (/ecommerce|e-commerce|retail|shopping|marketplace/.test(text)) return 'E-commerce'
  if (/edtech|education tech|learning management|lms|e-learning/.test(text)) return 'Edtech'
  if (/logistics|supply chain|shipping|freight|transport|warehouse/.test(text)) return 'Logistics'
  if (/manufactur|factory|industrial|hardware/.test(text)) return 'Manufacturing'
  if (/\bbank|banking/.test(text)) return 'Banking'
  if (/insurance|insurer/.test(text)) return 'Insurance'
  if (/venture|capital|investment|fund|private equity/.test(text)) return 'VC / Investment'
  if (/media|news|publishing|broadcast|content creation/.test(text)) return 'Media'
  if (/consult|advisory/.test(text)) return 'Consulting'
  if (/government|ministry|department|public sector/.test(text)) return 'Government'
  if (/3d|animation|visual|render|graphic|design|ar\b|vr\b|augmented|virtual reality/.test(text)) return 'Other'
  if (/software|platform|application|app\b|mobile app|web app/.test(text)) return 'SaaS'
  if (/development|engineer|coding|programming|outsourc/.test(text)) return 'IT Services'
  return 'Unclassified'
}

const KEY_FIELDS = [
  { key: 'website',      label: 'website' },
  { key: 'linkedin_url', label: 'LinkedIn' },
  { key: 'headquarters', label: 'HQ' },
  { key: 'size',         label: 'size' },
  { key: 'description',  label: 'description' },
]

function getMissingFields(company) {
  return KEY_FIELDS.filter(f => !company[f.key] || !String(company[f.key]).trim()).map(f => f.label)
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

// ─── COMPANY LOGO ─────────────────────────────────────────────

function CompanyLogo({ domain, name, size = 52 }) {
  const initials = (name || '').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
  const hue = (name || 'A').charCodeAt(0) % 360
  const [stage, setStage] = useState(0)

  const r = Math.round(size * 0.22)
  if (!domain || stage === 2) {
    return (
      <div style={{ width: size, height: size, borderRadius: r, background: `hsl(${hue},40%,22%)`, border: `1px solid hsl(${hue},40%,32%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: Math.round(size * 0.33), fontWeight: 700, color: `hsl(${hue},65%,72%)` }}>{initials}</span>
      </div>
    )
  }

  const src = stage === 0
    ? `https://logo.clearbit.com/${domain}`
    : `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

  return (
    <div style={{ width: size, height: size, borderRadius: r, background: '#F8F8F8', border: '1px solid rgba(196,193,189,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
      <img
        src={src} alt={name}
        style={{ width: stage === 0 ? Math.round(size * 0.7) : Math.round(size * 0.55), height: stage === 0 ? Math.round(size * 0.7) : Math.round(size * 0.55), objectFit: 'contain' }}
        onError={() => setStage(s => s + 1)}
      />
    </div>
  )
}

// ─── COMPANY CARD ─────────────────────────────────────────────

const COMPANY_EDIT_FIELDS = [
  { key: 'name',         label: 'Company Name',  type: 'text' },
  { key: 'tagline',     label: 'Tagline',        type: 'text', placeholder: 'e.g. Unlocking Innovation, Empowering Enterprises' },
  { key: 'website',      label: 'Website',        type: 'text', placeholder: 'https://company.com' },
  { key: 'linkedin_url', label: 'LinkedIn URL',   type: 'text', placeholder: 'https://linkedin.com/company/…' },
  { key: 'headquarters', label: 'HQ / Location',  type: 'text', placeholder: 'City, State, Country' },
  { key: 'size',         label: 'Employees',      type: 'text', placeholder: 'e.g. 200 employees' },
  { key: 'followers',    label: 'Followers',      type: 'text', placeholder: 'e.g. 12,500 followers' },
  { key: 'phone',        label: 'Phone',          type: 'text', placeholder: 'e.g. +91 471 123 4567' },
  { key: 'revenue',      label: 'Revenue',        type: 'text', placeholder: 'e.g. $5M ARR' },
  { key: 'compliance',   label: 'Compliance',     type: 'text', placeholder: 'ISO 27001, SOC 2, …' },
  { key: 'founded',      label: 'Founded',        type: 'text', placeholder: 'e.g. 2018' },
  { key: 'industry',     label: 'Industry',       type: 'text', placeholder: 'e.g. Computer Software' },
  { key: 'specialties',  label: 'Specialties',    type: 'text', placeholder: 'e.g. AI/ML, SaaS, Cloud' },
  { key: 'company_type', label: 'Type',           type: 'select', options: ['', 'Product', 'Service', 'Hybrid'] },
  { key: 'is_saas',      label: 'SaaS',           type: 'select', options: ['', 'true', 'false'] },
  { key: 'description',  label: 'Description',    type: 'textarea' },
]

// ─── ACCURACY CHECK ───────────────────────────────────────────
const ACCURACY_GENERIC = new Set([
  'pvt','ltd','inc','llc','corp','private','limited','the','and','for','with',
  'india','global','group','company','business','technology','technologies',
  'solutions','services','systems','digital','software','enterprise','consulting',
  'management','international','national','associates','partners','infotech',
  'infosystems','corporation','ventures','holdings',
])

function _nameWords(name) {
  return (name || '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter(w => w.length > 2 && !ACCURACY_GENERIC.has(w))
}

function _domainOf(url) {
  try {
    const u = url.includes('://') ? url : 'https://' + url
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase()
  } catch { return null }
}

function checkCompanyAccuracy(company) {
  // ── Tier 1: domain comparison (most reliable) ──────────────────────────────
  // linkedin_website = website that LinkedIn's own company page lists.
  // Saved by Fill LI every time it runs. If it matches our stored website,
  // we know the LinkedIn URL is pointing to the right entity.
  if (company.linkedin_website !== undefined && company.linkedin_website !== null) {
    // Empty string sentinel means "Fill LI ran but LinkedIn listed no website"
    if (company.linkedin_website === '') {
      // Can't do domain comparison — fall through to slug check below
    } else if (company.website) {
      const d1 = _domainOf(company.website)
      const d2 = _domainOf(company.linkedin_website)
      if (d1 && d2) {
        return d1 === d2
          ? { confidence: 'high', issues: [] }
          : { confidence: 'low', issues: ['linkedin-website-mismatch'] }
      }
    }
  }

  // ── Tier 2: slug ↔ name/domain keyword match (heuristic fallback) ──────────
  const words = _nameWords(company.name)
  const issues = []
  if (words.length === 0 || !(company.website || company.linkedin_url)) {
    return { confidence: 'none', issues: [] }
  }

  if (company.website) {
    try {
      const url = company.website.includes('://') ? company.website : 'https://' + company.website
      const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
      const domainCore = hostname.split('.')[0]
      const initials = words.map(w => w[0]).join('')
      const hit = words.some(w => domainCore.includes(w)) ||
                  domainCore === initials || domainCore.startsWith(initials) || initials.startsWith(domainCore)
      if (!hit) issues.push('website')
    } catch {}
  }

  if (company.linkedin_url) {
    const m = (company.linkedin_url || '').match(/linkedin\.com\/company\/([a-zA-Z0-9_-]+)/i)
    if (m) {
      const slug = m[1].toLowerCase().replace(/-/g, '')
      const initials = words.map(w => w[0]).join('')
      // Also check slug against stored website domain core for extra precision
      let domainCore = ''
      if (company.website) {
        try {
          const u = company.website.includes('://') ? company.website : 'https://' + company.website
          domainCore = new URL(u).hostname.replace(/^www\./, '').split('.')[0].toLowerCase()
        } catch {}
      }
      const hit = words.some(w => slug.includes(w)) ||
                  slug === initials || slug.startsWith(initials) || initials.startsWith(slug) ||
                  (domainCore.length > 2 && (slug.includes(domainCore) || domainCore.includes(slug)))
      if (!hit) issues.push('linkedin')
    }
  }

  return {
    confidence: issues.length === 0 ? 'high' : issues.length === 1 ? 'medium' : 'low',
    issues,
  }
}

function CompanyCard({ company, index, onUpdate, onDelete, onViewLeads, selected, onToggle, accuracy }) {
  const [classification, setClassification] = useState(company.classification || classifyCompany(company))
  const [prospectStatus, setProspectStatus] = useState(company.prospect_status || 'To Review')
  const [notes, setNotes] = useState(company.notes || '')
  const [editingNotes, setEditingNotes] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState(null)
  const [fillingLI, setFillingLI] = useState(false)
  const [fillResult, setFillResult] = useState(null)
  const [pipelining, setPipelining] = useState(false)
  const [pipelineSteps, setPipelineSteps] = useState([])
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [showSignals, setShowSignals] = useState(false)
  const [cachedSignals, setCachedSignals] = useState(null)
  const [showNotes, setShowNotes] = useState(false)
  const [fetchingFunding, setFetchingFunding] = useState(false)
  const [fundingResult, setFundingResult] = useState(null)

  useEffect(() => {
    getCompanySignals(company.id).then(r => {
      if (r.data.signals?.length) setCachedSignals(r.data.signals)
    }).catch(() => {})
  }, [company.id])

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

  async function handleAnalyze() {
    setAnalyzing(true)
    setAnalyzeResult(null)
    try {
      const res = await analyzeCompany(company.id, {
        website: company.website,
      })
      const data = res.data
      if (data.success && data.analysis) {
        const a = data.analysis
        const patch = {}
        if (a.company_type) patch.company_type = a.company_type
        if (a.compliance?.length) patch.compliance = a.compliance.join(', ')
        if (a.website_summary && !company.description) patch.description = a.website_summary
        if (a.is_saas !== undefined && a.is_saas !== null) patch.is_saas = a.is_saas
        const currentClass = company.classification || 'Unclassified'
        if (currentClass === 'Unclassified') {
          const enriched = {
            ...company,
            description: a.website_summary || company.description || '',
            products_or_services: (a.products_or_services || []).join(' '),
          }
          const autoClass = classifyCompany(enriched)
          if (autoClass !== 'Unclassified') {
            patch.classification = autoClass
            setClassification(autoClass)
          }
        }
        if (Object.keys(patch).length) onUpdate(company.id, patch)
        setAnalyzeResult({ ok: true, analysis: a })
      } else {
        setAnalyzeResult({ ok: false, msg: data.detail || 'Analysis failed' })
      }
    } catch (e) {
      setAnalyzeResult({ ok: false, msg: e.response?.data?.detail || e.message || 'Analysis failed' })
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleFillLinkedIn() {
    setFillingLI(true)
    setFillResult(null)
    try {
      const res = await autofillCompanyLinkedIn(company.id)
      const { success, update, filled, linkedin_url, message, classification: newClass } = res.data
      if (success === false) {
        setFillResult({ ok: false, msg: message || 'Could not find LinkedIn data' })
      } else if (filled.length > 0) {
        const patch = { ...update, linkedin_url: update.linkedin_url || linkedin_url || company.linkedin_url }
        // Apply backend-resolved classification immediately
        if (newClass) {
          patch.classification = newClass
          setClassification(newClass)
        } else {
          // Frontend fallback: re-run classifier on enriched company
          const enriched = { ...company, ...patch }
          const autoClass = classifyCompany(enriched)
          if (autoClass !== 'Unclassified' && (company.classification || 'Unclassified') === 'Unclassified') {
            patch.classification = autoClass
            setClassification(autoClass)
          }
        }
        onUpdate(company.id, patch)
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

  async function handleFillAndAnalyze() {
    let updatedWebsite = company.website

    // Step 1: Fill from LinkedIn
    setFillingLI(true)
    setFillResult(null)
    try {
      const res = await autofillCompanyLinkedIn(company.id)
      const { success, update, filled, linkedin_url, message, classification: newClass } = res.data
      if (success !== false && filled.length > 0) {
        const patch = { ...update, linkedin_url: update.linkedin_url || linkedin_url || company.linkedin_url }
        if (update.website) updatedWebsite = update.website
        if (newClass) { patch.classification = newClass; setClassification(newClass) }
        else {
          const enriched = { ...company, ...patch }
          const autoClass = classifyCompany(enriched)
          if (autoClass !== 'Unclassified' && (company.classification || 'Unclassified') === 'Unclassified') {
            patch.classification = autoClass; setClassification(autoClass)
          }
        }
        onUpdate(company.id, patch)
        setFillResult({ ok: true, filled })
      } else {
        setFillResult({ ok: false, msg: message || 'Could not find LinkedIn data' })
      }
    } catch (e) {
      setFillResult({ ok: false, msg: e.response?.data?.detail || e.message || 'Fill failed' })
    } finally {
      setFillingLI(false)
    }

    // Step 2: Analyze website
    setAnalyzing(true)
    setAnalyzeResult(null)
    try {
      const res = await analyzeCompany(company.id, { website: updatedWebsite })
      const data = res.data
      if (data.success && data.analysis) {
        const a = data.analysis
        const patch = {}
        if (a.company_type) patch.company_type = a.company_type
        if (a.compliance?.length) patch.compliance = a.compliance.join(', ')
        if (a.website_summary && !company.description) patch.description = a.website_summary
        if (a.is_saas !== undefined && a.is_saas !== null) patch.is_saas = a.is_saas
        const currentClass = company.classification || 'Unclassified'
        if (currentClass === 'Unclassified') {
          const enriched = { ...company, description: a.website_summary || company.description || '', products_or_services: (a.products_or_services || []).join(' ') }
          const autoClass = classifyCompany(enriched)
          if (autoClass !== 'Unclassified') { patch.classification = autoClass; setClassification(autoClass) }
        }
        if (Object.keys(patch).length) onUpdate(company.id, patch)
        setAnalyzeResult({ ok: true, analysis: a })
      } else {
        setAnalyzeResult({ ok: false, msg: data.detail || 'Analysis failed' })
      }
    } catch (e) {
      setAnalyzeResult({ ok: false, msg: e.response?.data?.detail || e.message || 'Analysis failed' })
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleFetchFunding() {
    setFetchingFunding(true)
    setFundingResult(null)
    try {
      const res = await fetchCompanyFunding(company.id)
      const { success, funding, message } = res.data
      if (success && funding) {
        onUpdate(company.id, { revenue: funding })
        setFundingResult({ ok: true, value: funding })
      } else {
        setFundingResult({ ok: false, msg: message || 'No funding data found' })
      }
    } catch (e) {
      setFundingResult({ ok: false, msg: e.response?.data?.detail || e.message || 'Fetch failed' })
    } finally {
      setFetchingFunding(false)
    }
  }

  async function handleEnrichPipeline() {
    setPipelining(true)
    setPipelineSteps([])
    try {
      await enrichPipeline(company.id, (_, __, result) => {
        if (result?.step) {
          setPipelineSteps(prev => {
            const idx = prev.findIndex(s => s.step === result.step)
            if (idx >= 0) { const next = [...prev]; next[idx] = result; return next }
            return [...prev, result]
          })
          if (result.step === 'done' && result.fields_updated?.length) {
            // refresh the card with updated data
            const patch = {}
            // The pipeline already saved to DB; trigger parent refresh
            onUpdate(company.id, {})
          }
        }
      })
    } catch (e) { console.error(e) }
    finally { setPipelining(false) }
  }

  function openEdit() {
    setEditForm({
      name:         company.name || '',
      tagline:      company.tagline || '',
      website:      company.website || '',
      linkedin_url: company.linkedin_url || '',
      headquarters: company.headquarters || '',
      size:         company.size || '',
      followers:    company.followers || '',
      phone:        company.phone || '',
      revenue:      company.revenue || '',
      compliance:   company.compliance || '',
      founded:      company.founded || '',
      industry:     company.industry || '',
      company_type: company.company_type || '',
      specialties:  company.specialties || '',
      is_saas:      company.is_saas === true ? 'true' : company.is_saas === false ? 'false' : '',
      description:  company.description || '',
    })
    setShowEdit(true)
  }

  async function saveEdit() {
    setSaving(true)
    const cleaned = Object.fromEntries(Object.entries(editForm).filter(([, v]) => v !== undefined))
    if (cleaned.is_saas === 'true') cleaned.is_saas = true
    else if (cleaned.is_saas === 'false') cleaned.is_saas = false
    else delete cleaned.is_saas
    await onUpdate(company.id, cleaned)
    setShowEdit(false)
    setSaving(false)
  }

  const classColor = classificationColors[classification] || '#a1a1a1'
  const statusColor = prospectColors[prospectStatus] || '#a1a1a1'
  const typeBadgeStyle = getTypeBadge(company.company_type)
  const missingFields = getMissingFields(company)
  const isSuspicious = accuracy?.confidence === 'low' || accuracy?.confidence === 'medium'
  const domain = company.website
    ? company.website.replace(/^https?:\/\//, '').split('/')[0]
    : null
  const accentColor = missingFields.length > 0 ? 'rgba(168,100,72,0.6)' : isSuspicious ? 'rgba(217,119,6,0.7)' : classColor
  const followersDisplay = company.followers
    ? String(company.followers).replace(/\s*followers?\s*/gi, '').trim()
    : '—'

  const field = (label, value) => value ? (
    <div>
      <p style={card.fieldLabel}>{label}</p>
      <p style={card.fieldValue}>{value}</p>
    </div>
  ) : null

  // Strip LinkedIn date-prefixed posts ("Oct 7, 2025 · …") and truncate to one sentence
  const cleanTagline = (() => {
    const raw = company.tagline || company.description || ''
    if (!raw) return null
    const stripped = raw.replace(/^[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}\s*[·•·]\s*/i, '').trim()
    const sentence = stripped.split(/(?<=[.!?])\s+/)[0] || stripped
    return sentence.length > 4 ? (sentence.length > 110 ? sentence.substring(0, 108) + '…' : sentence) : null
  })()

  // Format employee count: "1547 employees" → "1,547" / "1001-5000" → "1,001–5,000"
  const formatEmployees = (s) => {
    if (!s) return null
    const clean = String(s).replace(/\s*employees?\s*/gi, '').trim()
    if (/^\d+$/.test(clean.replace(/,/g, ''))) {
      return parseInt(clean.replace(/,/g, ''), 10).toLocaleString()
    }
    const range = clean.match(/^(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)$/)
    if (range) return `${parseInt(range[1].replace(/,/g, ''), 10).toLocaleString()}–${parseInt(range[2].replace(/,/g, ''), 10).toLocaleString()}`
    return clean
  }

  const empCount = formatEmployees(company.size)

  return (
  <>
    <div style={{ ...card.wrapper, borderLeft: `4px solid ${accentColor}` }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '18px 22px 14px', gap: 14 }}>
        {index !== undefined && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', minWidth: '22px', paddingTop: '6px', opacity: 0.5, letterSpacing: '0.04em' }}>
            {String(index + 1).padStart(2, '0')}
          </span>
        )}
        <CompanyLogo domain={domain} name={company.name} size={58} />

        {/* Name + domain + tagline */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>{company.name}</h3>
            {domain && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>· {domain}</span>}
            {isSuspicious && <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 600, color: '#92400e', letterSpacing: '0.04em' }}>⊘ mismatch</span>}
          </div>
          {cleanTagline && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: '4px 0 0', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {cleanTagline}
            </p>
          )}
          {/* Inline result lines — no boxes */}
          {fillResult && (
            <p style={{ fontSize: 11, margin: '6px 0 0', color: fillResult.ok ? '#4a7c59' : 'var(--accent)' }}>
              {fillResult.ok ? `✓ Filled: ${fillResult.filled.join(', ')}` : `⚠ ${fillResult.msg}`}
            </p>
          )}
          {analyzeResult && (
            <p style={{ fontSize: 11, margin: '4px 0 0', color: analyzeResult.ok ? '#4a7c59' : 'var(--accent)' }}>
              {analyzeResult.ok
                ? [
                    analyzeResult.analysis.company_type,
                    analyzeResult.analysis.company_type_confidence ? `(${analyzeResult.analysis.company_type_confidence})` : null,
                    analyzeResult.analysis.compliance?.length ? `· ${analyzeResult.analysis.compliance.join(', ')}` : null,
                  ].filter(Boolean).join(' ')
                : `⚠ ${analyzeResult.msg}`}
            </p>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <input type="checkbox" checked={selected || false} onChange={() => onToggle(company.id)}
            onClick={e => e.stopPropagation()}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 14, height: 14 }} />
          <select value={prospectStatus} onChange={e => handleStatusChange(e.target.value)}
            style={{ ...card.statusSelect, color: statusColor, borderColor: `${statusColor}40` }}>
            {PROSPECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {showCustomInput ? (
            <input type="text" placeholder="Category…" autoFocus
              style={{ ...card.select, width: 110, color: 'var(--text)', borderColor: 'var(--accent)' }}
              onBlur={e => { const v = e.target.value.trim(); if (v) handleClassificationChange(v); setShowCustomInput(false) }}
              onKeyDown={e => {
                if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) handleClassificationChange(v); setShowCustomInput(false) }
                if (e.key === 'Escape') setShowCustomInput(false)
              }}
            />
          ) : (
            <select value={classification}
              onChange={e => { if (e.target.value === 'Custom...') setShowCustomInput(true); else handleClassificationChange(e.target.value) }}
              style={{ ...card.select, color: classColor, borderColor: `${classColor}40` }}>
              {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <button
            style={{ ...card.actionBtn, color: (fillingLI || analyzing) ? 'var(--text-muted)' : 'var(--accent)', borderColor: (fillingLI || analyzing) ? 'var(--border)' : 'rgba(168,100,72,0.3)', opacity: (fillingLI || analyzing) ? 0.5 : 1 }}
            onClick={handleFillAndAnalyze}
            disabled={fillingLI || analyzing}
            title="Fill from LinkedIn, then analyze website">
            {fillingLI ? 'Filling…' : analyzing ? 'Analyzing…' : 'Fill + Analyze'}
          </button>
          <button
            style={{ ...card.actionBtn, color: pipelining ? 'var(--text-muted)' : '#5b8db8', borderColor: pipelining ? 'var(--border)' : 'rgba(91,141,184,0.35)', opacity: pipelining ? 0.6 : 1 }}
            onClick={handleEnrichPipeline} disabled={pipelining} title="Website analysis + compliance + maps enrich">
            {pipelining ? `${pipelineSteps.filter(s => s.status === 'done').length}/3…` : 'Enrich'}
          </button>
          <button
            style={{ ...card.actionBtn, color: (cachedSignals?.length || showSignals) ? '#a86448' : 'var(--text-muted)', borderColor: cachedSignals?.length ? 'rgba(168,100,72,0.3)' : 'var(--border)' }}
            onClick={() => setShowSignals(v => !v)}>
            {cachedSignals?.length ? `${cachedSignals.length} Signals` : 'Signals'}
          </button>
          <button style={{ ...card.actionBtn, color: (showNotes || notes) ? 'var(--text)' : 'var(--text-muted)' }}
            onClick={() => { setShowNotes(v => !v); if (!showNotes) setEditingNotes(false) }}>
            Notes
          </button>
          <button style={card.primaryBtn} onClick={() => onViewLeads(company)}>Leads →</button>
          <button style={card.editCardBtn} onClick={openEdit} title="Edit">✎</button>
          <button style={card.deleteBtn} onClick={() => onDelete(company.id)} title="Remove">✕</button>
        </div>
      </div>

      {/* ── Info grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 32px', padding: '14px 22px 18px', borderTop: '1px solid var(--border)' }}>
        {field('Industry', company.industry)}
        {company.company_type ? (
          <div>
            <p style={card.fieldLabel}>Type</p>
            <p style={card.fieldValue}>
              {company.company_type}
              {company.is_saas !== null && company.is_saas !== undefined && ` · ${company.is_saas ? 'SaaS' : 'Non-SaaS'}`}
            </p>
          </div>
        ) : field('Type', null)}
        {field('Founded', company.founded)}
        {field('HQ', company.headquarters)}
        {followersDisplay !== '—' ? field('Followers', followersDisplay) : null}
        {company.website && (
          <div>
            <p style={card.fieldLabel}>Website</p>
            <EditableWebsite value={company.website} onSave={v => onUpdate(company.id, { website: v })} />
          </div>
        )}
        {company.specialties ? (
          <div>
            <p style={card.fieldLabel}>Specialties</p>
            <p style={card.fieldValue}>{company.specialties.split(',').map(s => s.trim()).filter(Boolean).join(', ')}</p>
          </div>
        ) : null}
        {company.compliance ? (
          <div>
            <p style={card.fieldLabel}>Compliance</p>
            <p style={card.fieldValue}>{company.compliance}</p>
          </div>
        ) : null}
      </div>

      {/* ── Edit panel ── */}
      {showEdit && (
        <div style={{ ...card.editPanel, borderTop: '1px solid var(--border)' }}>
          <div style={card.editGrid}>
            {COMPANY_EDIT_FIELDS.map(f => (
              <div key={f.key} style={{ gridColumn: f.type === 'textarea' ? '1 / -1' : 'auto' }}>
                <label style={card.editLabel}>{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ ...card.editInput, height: 64, resize: 'vertical' }} placeholder="Description…" />
                ) : f.type === 'select' ? (
                  <select value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} style={card.editInput}>
                    {f.options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                  </select>
                ) : (
                  <input type="text" value={editForm[f.key] || ''} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder || ''} style={card.editInput} />
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

      {/* ── Notes ── */}
      {(showNotes || editingNotes) && (
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <p style={card.fieldLabel}>Notes</p>
            <button style={card.editBtn} onClick={() => editingNotes ? handleSaveNotes() : setEditingNotes(true)}>
              {editingNotes ? 'Save' : 'Edit'}
            </button>
          </div>
          {editingNotes
            ? <textarea value={notes} onChange={e => setNotes(e.target.value)} style={card.textarea} placeholder="Add notes…" rows={2} autoFocus />
            : <p style={{ ...card.notesText, fontSize: 13 }}>{notes || 'No notes yet.'}</p>
          }
        </div>
      )}

      {/* ── Signals ── */}
      {showSignals && (
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)' }}>
          <CompanySignals companyId={company.id} initialSignals={cachedSignals} compact={false} />
        </div>
      )}

      {/* ── LinkedIn link footer ── */}
      {company.linkedin_url && (
        <div style={{ padding: '10px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#0a66c2">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          <a href={company.linkedin_url} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: '#0a66c2', textDecoration: 'none', fontWeight: 500, letterSpacing: '0.01em' }}>
            View on LinkedIn ↗
          </a>
        </div>
      )}

    </div>

    {/* ── Sub-cards: Employee Count + Funding ── */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>

      {/* Employee Count */}
      <div style={{ background: 'var(--bg)', border: '1px solid rgba(196,193,189,0.55)', borderLeft: '4px solid #0d9488', borderRadius: 8, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Employee count</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
          Headcount data for <strong style={{ color: 'var(--text)' }}>{domain || company.name}</strong>.
        </p>
        {empCount
          ? <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#0d9488', margin: 0, letterSpacing: '-0.03em' }}>{empCount}</p>
          : <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>Not available — run Fill LI to populate.</p>
        }
      </div>

      {/* Company Funding */}
      <div style={{ background: 'var(--bg)', border: '1px solid rgba(196,193,189,0.55)', borderLeft: '4px solid #16a34a', borderRadius: 8, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Company funding</span>
          </div>
          <button
            onClick={handleFetchFunding}
            disabled={fetchingFunding}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px', background: 'transparent', border: '1px solid rgba(22,163,74,0.35)', borderRadius: 5, color: fetchingFunding ? 'var(--text-muted)' : '#16a34a', cursor: fetchingFunding ? 'default' : 'pointer', opacity: fetchingFunding ? 0.6 : 1, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            {fetchingFunding ? 'Fetching…' : 'Fetch Funding'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
          Funding rounds, amounts, and participating investors.
        </p>
        {(company.revenue || fundingResult?.ok)
          ? <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#16a34a', margin: 0, letterSpacing: '-0.03em' }}>{fundingResult?.ok ? fundingResult.value : company.revenue}</p>
          : fundingResult?.ok === false
            ? <p style={{ fontSize: 12, color: 'var(--accent)', margin: 0 }}>{fundingResult.msg}</p>
            : <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>Not available — click Fetch Funding or enter via Edit.</p>
        }
      </div>

    </div>
  </>
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(29,27,27,0.5)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', maxWidth: '520px', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(29,27,27,0.14)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '5px' }}>Website Analysis</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1 }}>{company.name}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px 10px', letterSpacing: '0.04em', flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {analysis.error ? (
            <div style={{ padding: '12px 14px', background: 'rgba(184,50,50,0.05)', border: '1px solid rgba(184,50,50,0.18)', borderRadius: '7px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', letterSpacing: '0.02em' }}>{analysis.error}</p>
            </div>
          ) : (
            <>
              {/* Stats gap-px grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-strong)', border: '1px solid var(--border-strong)', borderRadius: '6px', overflow: 'hidden' }}>
                {[
                  { label: 'Company Type',  value: analysis.company_type || '—' },
                  { label: 'Is SaaS',       value: analysis.is_saas === true ? 'Yes' : analysis.is_saas === false ? 'No' : '—' },
                  { label: 'Target Market', value: analysis.target_market || '—' },
                  { label: 'Has Login',     value: analysis.has_login === true ? 'Yes' : analysis.has_login === false ? 'No' : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--bg)', padding: '14px 16px' }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '400', letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1 }}>{value}</p>
                  </div>
                ))}
              </div>

              {analysis.compliance?.length > 0 && (
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Compliance</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {analysis.compliance.map(c => (
                      <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', padding: '4px 10px', background: 'rgba(74,124,89,0.08)', color: '#4a7c59', border: '1px solid rgba(74,124,89,0.22)', borderRadius: '4px' }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.products_or_services?.length > 0 && (
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Products / Services</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {analysis.products_or_services.map(p => (
                      <span key={p} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.02em', padding: '4px 10px', background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '4px' }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.website_summary && (
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Summary</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.8, letterSpacing: '0.01em' }}>{analysis.website_summary}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: '100%', padding: '10px', background: 'var(--text)', color: '#FFFFFF', border: 'none', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPANIES PAGE ──────────────────────────────────────

export default function Companies() {
  const { autofill, analyze, maps, runAutofill, runAnalyze, runMapsEnrich, registerLive, drainPending } = useBulkOps()

  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [followerFilter, setFollowerFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [fillFilter, setFillFilter] = useState('all')
  const [accuracyMap, setAccuracyMap] = useState({})
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [showDMFinder, setShowDMFinder] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [showSpreadsheet, setShowSpreadsheet] = useState(false)

  // Register with BulkOpsContext while mounted so streaming results update local state live.
  // On unmount the context buffers results; on remount drainPending() catches up.
  useEffect(() => {
    registerLive(result => {
      setCompanies(prev => {
        const next = [...prev]
        const idx = next.findIndex(c => c.id === result.id)
        if (idx !== -1) next[idx] = { ...next[idx], ...result.update }
        return next
      })
    })
    return () => registerLive(null)
  }, [])

  useEffect(() => { fetchCompanies() }, [])

  async function fetchCompanies() {
    try {
      const res = await getCompanies()
      const fresh = res.data.companies
      // Apply any updates that arrived while this component was unmounted
      const missed = drainPending()
      const merged = Object.keys(missed).length
        ? fresh.map(c => missed[c.id] ? { ...c, ...missed[c.id] } : c)
        : fresh
      setCompanies(merged)
      syncToDirectory(merged)
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

  function runAccuracyCheck() {
    const map = {}
    for (const c of companies) map[c.id] = checkCompanyAccuracy(c)
    setAccuracyMap(map)
  }

  const filtered = companies.filter(c => {
    const ms = search === '' || [c.name, c.industry, c.headquarters].join(' ').toLowerCase().includes(search.toLowerCase())
    const mc = classFilter === 'all' || c.classification === classFilter || (!c.classification && classFilter === 'Unclassified')
    const ms2 = statusFilter === 'all' || c.prospect_status === statusFilter
    const mf = followerFilter === 'all' || parseFollowers(c.followers) >= parseInt(followerFilter)
    const ct = c.company_type === 'Services' ? 'Service' : c.company_type
    const mt = typeFilter === 'all' || ct === typeFilter
    const missing = getMissingFields(c).length
    const acc = accuracyMap[c.id]
    const isSusp = acc?.confidence === 'low' || acc?.confidence === 'medium'
    const mfill = fillFilter === 'all' || (fillFilter === 'complete' && missing === 0) || (fillFilter === 'incomplete' && missing > 0) || (fillFilter === 'suspicious' && isSusp) || (fillFilter === 'accurate' && acc?.confidence === 'high')
    return ms && mc && ms2 && mf && mt && mfill
  })

  const prospectCount = companies.filter(c => c.prospect_status === 'Prospect').length
  const notFitCount = companies.filter(c => c.prospect_status === 'Not a Fit').length
  const needsDataCount = companies.filter(c => getMissingFields(c).length > 0).length

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

  function isIncomplete(c) {
    return !c.website || !c.linkedin_url || !c.headquarters || !c.size || !c.followers || !c.description
  }

  function handleBulkAutofill(incompleteOnly = false) {
    if (autofill.running) return
    const pool = selectedIds.length ? companies.filter(c => selectedIds.includes(c.id)) : companies
    const targetIds = incompleteOnly ? pool.filter(isIncomplete).map(c => c.id) : pool.map(c => c.id)
    if (!targetIds.length) return
    runAutofill(targetIds)
  }

  function handleBulkAnalyze() {
    if (analyze.running) return
    const targetIds = selectedIds.length ? selectedIds : companies.map(c => c.id)
    if (!targetIds.length) return
    runAnalyze(targetIds)
  }

  function handleBulkMapsEnrich() {
    const targetIds = selectedIds.length ? selectedIds : companies.map(c => c.id)
    if (!targetIds.length) return
    runMapsEnrich(targetIds)
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} companies?`)) return
    const ids = [...selectedIds]
    setCompanies(prev => prev.filter(c => !ids.includes(c.id)))
    setSelectedIds([])
    try {
      await bulkDeleteCompanies(ids)
    } catch (e) {
      console.error('Bulk delete failed:', e)
      fetchCompanies()
    }
  }

  return (
    <div style={s.page}>
      <motion.div style={{ ...s.hero, position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', overflow: 'hidden' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
        <div style={{ position: 'relative' }}>
          <p style={s.eyebrow}>Company Intelligence</p>
          <h1 style={s.heroTitle}>
            {filtered.length}
            <span style={s.heroUnit}> companies</span>
          </h1>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#4a7c59' }}>{prospectCount} prospects</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>·</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)' }}>{notFitCount} not a fit</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>·</span>
            <button
              onClick={() => setFillFilter(f => f === 'incomplete' ? 'all' : 'incomplete')}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: needsDataCount > 0 ? '#a86448' : '#4a7c59', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.02em' }}>
              {needsDataCount > 0 ? `${needsDataCount} need data` : 'all filled ✓'}
            </button>
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setShowBulkAdd(true)} style={s.heroBtn}>Bulk Add</button>
          <button onClick={() => setShowSpreadsheet(true)} style={s.heroBtn}>Spreadsheet</button>
          <button onClick={exportCompaniesCSV} style={{ ...s.heroBtn, background: 'var(--text)', color: '#FFFFFF', border: 'none' }}>Export →</button>
        </div>
      </motion.div>

      <div style={s.container}>
        {/* Action toolbar — left-aligned chips */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowAddModal(true)} style={s.primaryBtn}>+ Add Company</button>
          <button onClick={() => setShowDMFinder(true)} style={s.secondaryBtn}>Find DMs</button>
          <span style={{ width: '1px', height: '18px', background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
          <button onClick={() => handleBulkAutofill(false)} disabled={autofill.running || analyze.running}
            style={{ ...s.secondaryBtn, color: 'var(--accent)', borderColor: 'rgba(168,100,72,0.3)', opacity: autofill.running || analyze.running ? 0.5 : 1 }}>
            {autofill.running ? 'Filling…' : `↯ Fill All${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
          </button>
          {(() => {
            const pool = selectedIds.length ? companies.filter(c => selectedIds.includes(c.id)) : companies
            const incompleteCount = pool.filter(isIncomplete).length
            return incompleteCount > 0 && incompleteCount < pool.length ? (
              <button onClick={() => handleBulkAutofill(true)} disabled={autofill.running || analyze.running}
                style={{ ...s.secondaryBtn, color: 'var(--accent)', borderColor: 'rgba(168,100,72,0.3)', opacity: autofill.running || analyze.running ? 0.5 : 1 }}>
                {autofill.running ? 'Filling…' : `↯ Fill Incomplete (${incompleteCount})`}
              </button>
            ) : null
          })()}
          <button onClick={handleBulkAnalyze} disabled={analyze.running || autofill.running}
            style={{ ...s.secondaryBtn, color: '#7b6bae', borderColor: 'rgba(123,107,174,0.3)', opacity: analyze.running || autofill.running ? 0.5 : 1 }}>
            {analyze.running ? 'Analyzing…' : `⬡ Analyze All${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
          </button>
          <button onClick={runAccuracyCheck} disabled={companies.length === 0}
            style={{ ...s.secondaryBtn, color: '#92400e', borderColor: 'rgba(217,119,6,0.3)', opacity: companies.length === 0 ? 0.4 : 1 }}>
            ⊘ Check Accuracy
          </button>
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={selectedIds.length === filtered.length && filtered.length > 0}
              onChange={() => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(c => c.id))}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            Select all
          </label>
        </div>

        {/* Filters row */}
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
            <option value="all">All · Product / Service</option>
            <option value="Product">Product</option>
            <option value="Service">Service</option>
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
          <select value={fillFilter} onChange={e => setFillFilter(e.target.value)} style={{ ...s.select, color: fillFilter === 'incomplete' ? 'var(--accent)' : fillFilter === 'complete' ? '#4a7c59' : fillFilter === 'suspicious' ? '#92400e' : fillFilter === 'accurate' ? '#4a7c59' : 'var(--text-secondary)', borderColor: fillFilter !== 'all' ? (fillFilter === 'incomplete' ? 'rgba(168,100,72,0.35)' : fillFilter === 'suspicious' ? 'rgba(217,119,6,0.35)' : 'rgba(74,124,89,0.35)') : 'var(--border)' }}>
            <option value="all">All · Data</option>
            <option value="complete">✓ Complete</option>
            <option value="incomplete">⚠ Needs data</option>
            <option value="accurate">✓ Accurate</option>
            <option value="suspicious">⊘ Suspicious</option>
          </select>
        </div>

        {autofill.msg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: autofill.running ? 'rgba(168,100,72,0.05)' : 'rgba(74,124,89,0.06)', border: `1px solid ${autofill.running ? 'rgba(168,100,72,0.2)' : 'rgba(74,124,89,0.2)'}`, borderRadius: '8px', marginBottom: '12px' }}>
            {autofill.running && <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.02em', color: autofill.running ? 'var(--accent)' : '#4a7c59', fontWeight: '500' }}>{autofill.msg}</span>
          </div>
        )}
        {analyze.msg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: analyze.running ? 'rgba(123,107,174,0.05)' : 'rgba(74,124,89,0.06)', border: `1px solid ${analyze.running ? 'rgba(123,107,174,0.2)' : 'rgba(74,124,89,0.2)'}`, borderRadius: '8px', marginBottom: '12px' }}>
            {analyze.running && <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid #7b6bae', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.02em', color: analyze.running ? '#7b6bae' : '#4a7c59', fontWeight: '500' }}>{analyze.msg}</span>
          </div>
        )}
        {maps.msg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: maps.running ? 'rgba(74,124,89,0.05)' : 'rgba(74,124,89,0.06)', border: `1px solid rgba(74,124,89,0.2)`, borderRadius: '8px', marginBottom: '12px' }}>
            {maps.running && <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid #4a7c59', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.02em', color: '#4a7c59', fontWeight: '500' }}>{maps.msg}</span>
          </div>
        )}

        {Object.keys(accuracyMap).length > 0 && (() => {
          const vals = Object.values(accuracyMap)
          const suspicious = vals.filter(a => a.confidence === 'low' || a.confidence === 'medium').length
          const accurate   = vals.filter(a => a.confidence === 'high').length
          const unverifiable = vals.filter(a => a.confidence === 'none').length
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => setFillFilter('accurate')} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#4a7c59', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.02em', textDecoration: 'underline' }}>
                ✓ {accurate} accurate
              </button>
              {suspicious > 0 && <>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>·</span>
                <button onClick={() => setFillFilter('suspicious')} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.02em', textDecoration: 'underline' }}>
                  ⊘ {suspicious} suspicious
                </button>
              </>}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>·</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{unverifiable} unverifiable</span>
              <button onClick={() => { setAccuracyMap({}); setFillFilter(f => f === 'suspicious' || f === 'accurate' ? 'all' : f) }}
                style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px', letterSpacing: '0.04em' }}>✕ clear</button>
            </div>
          )
        })()}

        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em', color: 'var(--text)', fontWeight: '600' }}>{selectedIds.length} selected</span>
            <button onClick={handleBulkDelete} style={{ padding: '5px 12px', background: 'var(--red)', border: 'none', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: '#fff', cursor: 'pointer' }}>Delete</button>
            <button onClick={() => setShowDMFinder(true)} style={{ padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: 'var(--text)', cursor: 'pointer' }}>Find DMs</button>
            <button onClick={() => setSelectedIds([])} style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: 'var(--text-muted)', cursor: 'pointer' }}>Clear</button>
          </div>
        )}

        {loading ? (
          <div style={s.grid}>
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={s.emptyState}>
            <p style={s.emptyTitle}>No companies yet</p>
            <p style={s.emptyText}>Use the extension on LinkedIn company search to extract companies, or click <strong>+ Add Company</strong> above.</p>
          </div>
        ) : (
          <div style={s.grid}>
            {filtered.map((company, i) => (
              <React.Fragment key={company.id}>
                {i > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-strong)' }} />
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.6), ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: '100%' }}
                >
                  <CompanyCard
                    company={company}
                    index={i}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onViewLeads={setSelectedCompany}
                    selected={selectedIds.includes(company.id)}
                    onToggle={id => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
                    accuracy={accuracyMap[company.id]}
                  />
                </motion.div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {showAddModal && <AddCompanyModal onClose={() => setShowAddModal(false)} onRefresh={fetchCompanies} />}
      {showBulkAdd && <BulkAddModal onClose={() => setShowBulkAdd(false)} onRefresh={fetchCompanies} initialTab={typeof showBulkAdd === 'string' ? showBulkAdd : 'manual'} />}
      {showSpreadsheet && <CompaniesSpreadsheet companies={companies} onClose={() => setShowSpreadsheet(false)} onRefresh={fetchCompanies} />}
      {selectedCompany && <LeadsModal company={selectedCompany} onClose={() => setSelectedCompany(null)} />}
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
  page: { minHeight: '100vh', background: 'var(--surface-raised)' },
  hero: { padding: '64px 48px 40px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' },
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' },
    heroTitle: { fontFamily: 'var(--font-display)', fontSize: 'clamp(64px, 9vw, 112px)', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.05em', lineHeight: 1, marginBottom: '0' },
  heroUnit: { fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4.5vw, 56px)', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '-0.03em' },
  heroStats: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  heroBtn: { padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '10px', fontWeight: '500', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', letterSpacing: '0.04em' },
  container: { padding: '20px 48px' },
  filters: { display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', flex: 1, minWidth: '200px' },
  searchInput: { flex: 1, padding: '9px 12px', background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: 'var(--text)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' },
  select: { padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '10px', fontWeight: '500', color: 'var(--text-secondary)', outline: 'none', fontFamily: 'var(--font-mono)', cursor: 'pointer', letterSpacing: '0.04em' },
  primaryBtn: { padding: '9px 16px', background: 'var(--text)', border: 'none', borderRadius: '7px', fontSize: '10px', fontWeight: '600', color: '#FFFFFF', cursor: 'pointer', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', letterSpacing: '0.04em' },
  secondaryBtn: { padding: '9px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '10px', fontWeight: '500', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', letterSpacing: '0.04em' },
  grid: { display: 'flex', flexDirection: 'column', gap: '16px' },
  empty: { padding: '40px 0', fontSize: '13px', color: 'var(--text-muted)' },
  emptyState: { padding: '80px 0', textAlign: 'center' },
  emptyTitle: { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '400', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '-0.03em' },
  emptyText: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 },
}

const card = {
  wrapper: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03)',
    display: 'flex', flexDirection: 'column',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 16px 10px', gap: '10px' },
  headerLeft: { flex: 1 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  name: { fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '400', color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1 },
  industry: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.02em' },
  select: { fontFamily: 'var(--font-mono)', padding: '5px 9px', background: 'var(--surface)', border: '1px solid', borderRadius: '5px', fontSize: '10px', fontWeight: '600', outline: 'none', cursor: 'pointer', letterSpacing: '0.04em' },
  editCardBtn: { fontFamily: 'var(--font-mono)', background: 'none', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.04em', cursor: 'pointer', padding: '5px 9px', lineHeight: 1 },
  deleteBtn: { fontFamily: 'var(--font-mono)', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', padding: '4px', opacity: 0.5 },
  editPanel: { padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' },
  editGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' },
  editLabel: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' },
  editInput: { width: '100%', padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  editFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  editCancelBtn: { fontFamily: 'var(--font-mono)', padding: '7px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer' },
  editSaveBtn: { fontFamily: 'var(--font-mono)', padding: '7px 16px', background: 'var(--text)', border: 'none', borderRadius: '6px', fontSize: '10px', fontWeight: '600', color: '#FFFFFF', cursor: 'pointer' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid rgba(196,193,189,0.5)', borderBottom: '1px solid rgba(196,193,189,0.5)', background: 'rgba(196,193,189,0.35)', gap: '1px' },
  infoItem: { padding: '9px 14px', background: 'var(--bg)' },
  infoLabel: { fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase' },
  infoValue: { fontSize: '12px', color: 'var(--text)', fontWeight: '400', margin: 0 },
  fieldLabel: { fontSize: 12, color: 'var(--text-muted)', margin: '0 0 4px', fontWeight: 400 },
  fieldValue: { fontSize: 15, color: 'var(--text)', fontWeight: 500, margin: 0, lineHeight: 1.3 },
  complianceSection: { padding: '8px 14px', borderBottom: '1px solid rgba(196,193,189,0.4)' },
  complianceBadge: { padding: '2px 7px', border: '1px solid rgba(74,124,89,0.3)', borderRadius: '3px', fontSize: '9px', fontWeight: '600', color: '#4a7c59', letterSpacing: '0.5px', background: 'rgba(74,124,89,0.07)', fontFamily: 'var(--font-mono)' },
  description: { padding: '8px 14px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, borderBottom: '1px solid rgba(196,193,189,0.4)' },
  notesSection: { padding: '8px 14px', borderBottom: '1px solid rgba(196,193,189,0.4)', flex: 1 },
  notesHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' },
  editBtn: { fontFamily: 'var(--font-mono)', background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '9px', fontWeight: '500', letterSpacing: '0.04em', cursor: 'pointer', padding: '2px 7px' },
  notesText: { fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 },
  textarea: { width: '100%', padding: '7px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', flexWrap: 'wrap', gap: '6px', marginTop: 'auto' },
  statusSelect: { fontFamily: 'var(--font-mono)', padding: '5px 9px', background: 'var(--surface)', border: '1px solid', borderRadius: '5px', fontSize: '10px', fontWeight: '600', outline: 'none', cursor: 'pointer', letterSpacing: '0.04em' },
  actionBtn: { fontFamily: 'var(--font-mono)', padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '10px', fontWeight: '500', color: 'var(--text-secondary)', cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  linkedinBtn: { fontFamily: 'var(--font-mono)', padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '10px', fontWeight: '500', color: 'var(--text-muted)', textDecoration: 'none', letterSpacing: '0.04em' },
  primaryBtn: { fontFamily: 'var(--font-mono)', padding: '8px 18px', background: 'var(--text)', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#FFFFFF', cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
}

const modal = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(29,27,27,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' },
  box: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', maxWidth: '800px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 28px', borderBottom: '1px solid var(--border)' },
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' },
  title: { fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)' },
  closeBtn: { padding: '7px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '10px', letterSpacing: '0.04em', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-mono)' },
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
