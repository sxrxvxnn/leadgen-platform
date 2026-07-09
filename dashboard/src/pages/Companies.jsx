import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import {
  getCompanies,
  updateCompany,
  deleteCompany,
  bulkDeleteCompanies,
  getCompanyLeads,
  checkCompliance,
  autofillCompanyLinkedIn,
  analyzeCompany,
  enrichPipeline,
  getCompanySignals,
  fetchCompanyFunding,
  deepEnrichCompany,
  bulkDeepEnrichCompanies,
  findLookalikesForCompany,
  generateLinkedInDM,
  getCompanyActivities,
  createCompanyActivity,
  deleteCompanyActivity,
  findDuplicateCompanies,
  mergeCompanies,
  getCompanyAlerts,
  markCompanyAlertSeen,
  refreshCompanyAlerts,
  listCompanySegments,
  createCompanySegment,
  deleteCompanySegment,
  bulkCreateCompanies,
  invalidateCache,
  listJobs,
  getJob,
} from '../services/api'
import CompanySignals from '../components/CompanySignals'
import { useBulkOps } from '../context/BulkOpsContext'
import { useFeatureFlags } from '../context/FeatureFlagContext'
import { syncToDirectory } from '../services/companyDirectory'
import DMFinder from '../components/DMFinder'
import AddCompanyModal from '../components/AddCompanyModal'
import BulkAddModal from '../components/BulkAddModal'
import CompaniesSpreadsheet from '../components/CompaniesSpreadsheet'
import { SkeletonCard } from '../components/Skeleton'
import { CardContainer, CardBody, CardItem } from '../components/ThreeDCard'

const CLASSIFICATIONS = [
  'Unclassified',
  'Fintech',
  'Healthtech',
  'SaaS',
  'Cybersecurity',
  'IT Services',
  'E-commerce',
  'Edtech',
  'Logistics',
  'Manufacturing',
  'Banking',
  'Insurance',
  'VC / Investment',
  'Media',
  'Consulting',
  'Retail',
  'Real Estate',
  'Government',
  'Non-profit',
  'Other',
  'Custom...',
]

const PROSPECT_STATUSES = [
  'To Review',
  'Prospect',
  'Not a Fit',
  'Contacted',
  'In Progress',
  'Closed Won',
  'Closed Lost',
]

const classificationColors = {
  Fintech: '#5b8db8',
  Healthtech: '#4a7c59',
  SaaS: '#7b6bae',
  Cybersecurity: '#b83232',
  'IT Services': '#8b7bbe',
  'E-commerce': '#a86448',
  Edtech: '#4a8c6b',
  Logistics: '#6b7e8c',
  Manufacturing: '#7a7060',
  Banking: '#5c6b7e',
  Insurance: '#6b7060',
  'VC / Investment': '#a05050',
  Media: '#a05880',
  Consulting: '#5878a0',
  Retail: '#a0904a',
  'Real Estate': '#6a904a',
  Government: '#6b7070',
  'Non-profit': '#4a7c59',
  Unclassified: '#a1a1a1',
  Other: '#a1a1a1',
}

const prospectColors = {
  'To Review': '#a1a1a1',
  Prospect: '#4a7c59',
  'Not a Fit': '#b83232',
  Contacted: '#a86448',
  'In Progress': '#5b8db8',
  'Closed Won': '#4a7c59',
  'Closed Lost': '#a1a1a1',
}

function getTypeBadge(type) {
  if (!type) return null
  const map = {
    Product: { bg: 'rgba(91,141,184,0.10)', color: '#5b8db8', border: 'rgba(91,141,184,0.25)' },
    Service: { bg: 'rgba(168,100,72,0.10)', color: '#a86448', border: 'rgba(168,100,72,0.25)' },
    Services: { bg: 'rgba(168,100,72,0.10)', color: '#a86448', border: 'rgba(168,100,72,0.25)' },
    Hybrid: { bg: 'rgba(123,107,174,0.10)', color: '#7b6bae', border: 'rgba(123,107,174,0.25)' },
  }
  const st = map[type]
  if (!st) return null
  return {
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    padding: '2px 7px',
    borderRadius: '4px',
    background: st.bg,
    color: st.color,
    border: `1px solid ${st.border}`,
  }
}

function toggleSelect(id) {
  setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
}

async function handleBulkDelete() {
  if (!window.confirm(`Delete ${selectedIds.length} companies?`)) return
  try {
    await Promise.all(selectedIds.map((id) => deleteCompany(id)))
    setCompanies((prev) => prev.filter((c) => !selectedIds.includes(c.id)))
    setSelectedIds([])
  } catch (e) {
    console.error(e)
  }
}

function classifyCompany(company) {
  const text = [company.name, company.industry, company.description, company.products_or_services]
    .join(' ')
    .toLowerCase()
  if (/fintech|payment|lending|neobank|wallet|crypto|blockchain|insurtech/.test(text))
    return 'Fintech'
  if (/health|medical|pharma|clinic|hospital|biotech|telemedicine|healthcare/.test(text))
    return 'Healthtech'
  if (/cyber|security|vapt|penetration|vulnerability|soc\b|siem/.test(text)) return 'Cybersecurity'
  if (/\bit services\b|it consulting|managed service|msp|tech support/.test(text))
    return 'IT Services'
  if (/\bsaas\b|cloud platform|cloud-based|software-as|subscription.{0,10}software/.test(text))
    return 'SaaS'
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
  if (/3d|animation|visual|render|graphic|design|ar\b|vr\b|augmented|virtual reality/.test(text))
    return 'Other'
  if (/software|platform|application|app\b|mobile app|web app/.test(text)) return 'SaaS'
  if (/development|engineer|coding|programming|outsourc/.test(text)) return 'IT Services'
  return 'Unclassified'
}

const KEY_FIELDS = [
  { key: 'website', label: 'website' },
  { key: 'linkedin_url', label: 'LinkedIn' },
  { key: 'headquarters', label: 'HQ' },
  { key: 'size', label: 'size' },
  { key: 'description', label: 'description' },
]

function getMissingFields(company) {
  return KEY_FIELDS.filter((f) => !company[f.key] || !String(company[f.key]).trim()).map(
    (f) => f.label
  )
}

function parseFollowers(str) {
  if (!str) return 0
  const clean = str
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/followers?/g, '')
    .trim()
  if (clean.includes('k')) return parseFloat(clean) * 1000
  if (clean.includes('m')) return parseFloat(clean) * 1000000
  return parseInt(clean) || 0
}

// ─── EDITABLE WEBSITE FIELD ───────────────────────────────────

function EditableWebsite({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')
  useEffect(() => {
    setVal(value || '')
  }, [value])

  if (editing) {
    return (
      <input
        type="text"
        value={val}
        autoFocus
        placeholder="https://company.com"
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          onSave(val)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSave(val)
            setEditing(false)
          }
          if (e.key === 'Escape') {
            setVal(value || '')
            setEditing(false)
          }
        }}
        style={{
          width: '100%',
          background: 'var(--bg)',
          border: '1px solid var(--accent)',
          borderRadius: '4px',
          padding: '2px 6px',
          fontSize: '12px',
          color: 'var(--text)',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
    )
  }

  if (val) {
    const href = val.startsWith('http') ? val : 'https://' + val
    const display = val.replace('https://', '').replace('http://', '').split('/')[0]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          {display}
        </a>
        <button
          onClick={() => setEditing(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '11px',
            padding: '0 2px',
            lineHeight: 1,
          }}
        >
          ✎
        </button>
      </div>
    )
  }

  return (
    <span
      style={{
        fontSize: '12px',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        fontStyle: 'italic',
      }}
      onClick={() => setEditing(true)}
    >
      Add website…
    </span>
  )
}

// ─── COMPANY LOGO ─────────────────────────────────────────────

function CompanyLogo({ domain, altDomain, name, size = 52 }) {
  const initials =
    (name || '')
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  const hue = (name || 'A').charCodeAt(0) % 360
  const [stage, setStage] = useState(0)

  // Build ordered list of (src, imgSize) to try
  const alt = altDomain && altDomain !== domain ? altDomain : null
  const srcs = [
    [`https://logo.clearbit.com/${domain}`, Math.round(size * 0.7)],
    ...(alt ? [[`https://logo.clearbit.com/${alt}`, Math.round(size * 0.7)]] : []),
    [`https://www.google.com/s2/favicons?domain=${domain}&sz=64`, Math.round(size * 0.55)],
    ...(alt
      ? [[`https://www.google.com/s2/favicons?domain=${alt}&sz=64`, Math.round(size * 0.55)]]
      : []),
  ]

  const r = Math.round(size * 0.22)
  if (!domain || stage >= srcs.length) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: r,
          background: `hsl(${hue},40%,22%)`,
          border: `1px solid hsl(${hue},40%,32%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: Math.round(size * 0.33),
            fontWeight: 700,
            color: `hsl(${hue},65%,72%)`,
          }}
        >
          {initials}
        </span>
      </div>
    )
  }

  const [src, imgSize] = srcs[stage]
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: '#F8F8F8',
        border: '1px solid rgba(196,193,189,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <img
        src={src}
        alt={name}
        style={{ width: imgSize, height: imgSize, objectFit: 'contain' }}
        onError={() => setStage((s) => s + 1)}
      />
    </div>
  )
}

// ─── COMPANY CARD ─────────────────────────────────────────────

const COMPANY_EDIT_FIELDS = [
  { key: 'name', label: 'Company Name', type: 'text' },
  {
    key: 'tagline',
    label: 'Tagline',
    type: 'text',
    placeholder: 'e.g. Unlocking Innovation, Empowering Enterprises',
  },
  { key: 'website', label: 'Website', type: 'text', placeholder: 'https://company.com' },
  {
    key: 'linkedin_url',
    label: 'LinkedIn URL',
    type: 'text',
    placeholder: 'https://linkedin.com/company/…',
  },
  {
    key: 'headquarters',
    label: 'HQ / Location',
    type: 'text',
    placeholder: 'City, State, Country',
  },
  { key: 'size', label: 'Employees', type: 'text', placeholder: 'e.g. 200 employees' },
  { key: 'followers', label: 'Followers', type: 'text', placeholder: 'e.g. 12,500 followers' },
  { key: 'phone', label: 'Phone', type: 'text', placeholder: 'e.g. +91 471 123 4567' },
  { key: 'revenue', label: 'Revenue', type: 'text', placeholder: 'e.g. $5M ARR' },
  { key: 'compliance', label: 'Compliance', type: 'text', placeholder: 'ISO 27001, SOC 2, …' },
  { key: 'founded', label: 'Founded', type: 'text', placeholder: 'e.g. 2018' },
  { key: 'industry', label: 'Industry', type: 'text', placeholder: 'e.g. Computer Software' },
  {
    key: 'specialties',
    label: 'Specialties',
    type: 'text',
    placeholder: 'e.g. AI/ML, SaaS, Cloud',
  },
  {
    key: 'company_type',
    label: 'Type',
    type: 'select',
    options: ['', 'Product', 'Service', 'Hybrid'],
  },
  { key: 'is_saas', label: 'SaaS', type: 'select', options: ['', 'true', 'false'] },
  { key: 'description', label: 'Description', type: 'textarea' },
]

// ─── ACCURACY CHECK ───────────────────────────────────────────
const ACCURACY_GENERIC = new Set([
  'pvt',
  'ltd',
  'inc',
  'llc',
  'corp',
  'private',
  'limited',
  'the',
  'and',
  'for',
  'with',
  'india',
  'global',
  'group',
  'company',
  'business',
  'technology',
  'technologies',
  'solutions',
  'services',
  'systems',
  'digital',
  'software',
  'enterprise',
  'consulting',
  'management',
  'international',
  'national',
  'associates',
  'partners',
  'infotech',
  'infosystems',
  'corporation',
  'ventures',
  'holdings',
])

function _nameWords(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !ACCURACY_GENERIC.has(w))
}

function _domainOf(url) {
  try {
    const u = url.includes('://') ? url : 'https://' + url
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

// Rule-based ICP fit score for a company (0–100) using enrichment signals
function scoreCompanyICP(company) {
  let score = 30 // base
  // Classification
  if (company.classification === 'Product') score += 15
  else if (company.classification === 'Hybrid') score += 8
  // Size — mid-market sweet spot 51–5000
  const sizeNums = (company.size || '').replace(/,/g, '').match(/\d+/g)
  if (sizeNums) {
    const emp =
      sizeNums.length >= 2
        ? (parseInt(sizeNums[0]) + parseInt(sizeNums[1])) / 2
        : parseInt(sizeNums[0])
    if (emp >= 51 && emp <= 5000) score += 15
    else if (emp > 5000) score += 8
  }
  // Revenue estimate present
  if (company.revenue_estimate) score += 5
  // Tech stack signals: enterprise buyers use sales/marketing tools
  const stack = Array.isArray(company.tech_stack) ? company.tech_stack : []
  const enterpriseTech = [
    'Salesforce',
    'HubSpot',
    'Marketo',
    'Intercom',
    'Zendesk',
    'Segment',
    'Stripe',
    'Braintree',
  ]
  if (stack.some((t) => enterpriseTech.includes(t))) score += 10
  if (stack.length >= 5) score += 5
  // Reviews on G2/Capterra = legit software company
  const reviews = company.review_presence || {}
  if (Object.keys(reviews).length > 0) score += 10
  // Active hiring = growing company
  const jobs = Array.isArray(company.job_openings) ? company.job_openings : []
  if (jobs.length >= 3) score += 5
  else if (jobs.length >= 1) score += 3
  // Social presence
  const socials = company.social_profiles || {}
  if (Object.keys(socials).length >= 2) score += 3
  // Traffic
  if (company.traffic_estimate) score += 2
  return Math.min(score, 100)
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
      const initials = words.map((w) => w[0]).join('')
      const hit =
        words.some((w) => domainCore.includes(w)) ||
        domainCore === initials ||
        domainCore.startsWith(initials) ||
        initials.startsWith(domainCore)
      if (!hit) issues.push('website')
    } catch {}
  }

  if (company.linkedin_url) {
    const m = (company.linkedin_url || '').match(/linkedin\.com\/company\/([a-zA-Z0-9_-]+)/i)
    if (m) {
      const slug = m[1].toLowerCase().replace(/-/g, '')
      const initials = words.map((w) => w[0]).join('')
      // Also check slug against stored website domain core for extra precision
      let domainCore = ''
      if (company.website) {
        try {
          const u = company.website.includes('://') ? company.website : 'https://' + company.website
          domainCore = new URL(u).hostname
            .replace(/^www\./, '')
            .split('.')[0]
            .toLowerCase()
        } catch {}
      }
      const hit =
        words.some((w) => slug.includes(w)) ||
        slug === initials ||
        slug.startsWith(initials) ||
        initials.startsWith(slug) ||
        (domainCore.length > 2 && (slug.includes(domainCore) || domainCore.includes(slug)))
      if (!hit) issues.push('linkedin')
    }
  }

  return {
    confidence: issues.length === 0 ? 'high' : issues.length === 1 ? 'medium' : 'low',
    issues,
  }
}

function CompanyCard({
  company,
  onUpdate,
  onDelete,
  onViewLeads,
  selected,
  onToggle,
  accuracy,
  isEnabled,
  onRefresh,
}) {
  const [classification, setClassification] = useState(
    company.classification || classifyCompany(company)
  )
  const [prospectStatus, setProspectStatus] = useState(company.prospect_status || 'To Review')
  const [watchlisted, setWatchlisted] = useState(company.watchlisted || false)
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
  const [showDM, setShowDM] = useState(false)
  const [dmText, setDmText] = useState('')
  const [generatingDM, setGeneratingDM] = useState(false)
  const [dmCopied, setDmCopied] = useState(false)
  const [showLookalikes, setShowLookalikes] = useState(false)
  const [lookalikes, setLookalikes] = useState(null)
  const [loadingLookalikes, setLoadingLookalikes] = useState(false)
  const [addingLookalike, setAddingLookalike] = useState(null)
  const [addedLookalikes, setAddedLookalikes] = useState(new Set())
  const [showActivity, setShowActivity] = useState(false)
  const [activities, setActivities] = useState(null)
  const [activityNote, setActivityNote] = useState('')
  const [activityType, setActivityType] = useState('note')
  const [savingActivity, setSavingActivity] = useState(false)
  const [deepEnriching, setDeepEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState(null)
  const [showEnrichCards, setShowEnrichCards] = useState(
    !!(
      company.tech_stack?.length ||
      company.job_openings?.length ||
      company.email_pattern ||
      company.recent_news?.length ||
      company.revenue_estimate ||
      company.social_profiles ||
      company.traffic_estimate ||
      company.review_presence
    )
  )
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const actionsMenuRef = useRef(null)

  useEffect(() => {
    getCompanySignals(company.id)
      .then((r) => {
        if (r.data.signals?.length) setCachedSignals(r.data.signals)
      })
      .catch(() => {})
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

  useEffect(() => {
    if (!showActionsMenu) return
    function handleClickOutside(e) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) {
        setShowActionsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showActionsMenu])

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

  function handleWatchlist() {
    const next = !watchlisted
    setWatchlisted(next)
    onUpdate(company.id, { watchlisted: next })
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
      setAnalyzeResult({
        ok: false,
        msg: e.response?.data?.detail || e.message || 'Analysis failed',
      })
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
        const patch = {
          ...update,
          linkedin_url: update.linkedin_url || linkedin_url || company.linkedin_url,
        }
        // Apply backend-resolved classification immediately
        if (newClass) {
          patch.classification = newClass
          setClassification(newClass)
        } else {
          // Frontend fallback: re-run classifier on enriched company
          const enriched = { ...company, ...patch }
          const autoClass = classifyCompany(enriched)
          if (
            autoClass !== 'Unclassified' &&
            (company.classification || 'Unclassified') === 'Unclassified'
          ) {
            patch.classification = autoClass
            setClassification(autoClass)
          }
        }
        onUpdate(company.id, patch)
        setFillResult({ ok: true, filled })
      } else {
        // Check if fields are actually empty — if so, LinkedIn scraping likely failed
        const hasGaps = !company.website || !company.headquarters || !company.followers
        setFillResult({
          ok: false,
          msg: hasGaps
            ? 'LinkedIn scraping blocked — try again or add details manually'
            : 'All fields already filled',
        })
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
        const patch = {
          ...update,
          linkedin_url: update.linkedin_url || linkedin_url || company.linkedin_url,
        }
        if (update.website) updatedWebsite = update.website
        if (newClass) {
          patch.classification = newClass
          setClassification(newClass)
        } else {
          const enriched = { ...company, ...patch }
          const autoClass = classifyCompany(enriched)
          if (
            autoClass !== 'Unclassified' &&
            (company.classification || 'Unclassified') === 'Unclassified'
          ) {
            patch.classification = autoClass
            setClassification(autoClass)
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
      setAnalyzeResult({
        ok: false,
        msg: e.response?.data?.detail || e.message || 'Analysis failed',
      })
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

  async function handleDeepEnrich() {
    setDeepEnriching(true)
    setEnrichResult(null)
    try {
      const res = await deepEnrichCompany(company.id)
      const { enriched, errors } = res.data
      if (enriched && Object.keys(enriched).length) {
        onUpdate(company.id, enriched)
        setEnrichResult({ ok: true, count: Object.keys(enriched).length })
        setShowEnrichCards(true)
      } else {
        setEnrichResult({ ok: false, msg: 'No enrichment data found' })
      }
    } catch (e) {
      setEnrichResult({ ok: false, msg: e.response?.data?.detail || e.message || 'Enrich failed' })
    } finally {
      setDeepEnriching(false)
    }
  }

  async function handleFullEnrich() {
    await handleFillAndAnalyze()
    await handleEnrichPipeline()
    if (isEnabled('deep_enrich')) await handleDeepEnrich()
  }

  async function handleGenerateDM() {
    setGeneratingDM(true)
    setShowDM(true)
    setDmText('')
    try {
      const res = await generateLinkedInDM(company.id)
      setDmText(res.data.message || '')
    } catch (e) {
      setDmText('Failed to generate message.')
    } finally {
      setGeneratingDM(false)
    }
  }

  async function handleLoadLookalikes(forceRefresh = false) {
    setShowLookalikes(true)
    if (lookalikes !== null && !forceRefresh) return
    setLoadingLookalikes(true)
    try {
      const res = await findLookalikesForCompany(company.id, forceRefresh)
      setLookalikes(res.data.lookalikes || [])
    } catch {
      setLookalikes([])
    } finally {
      setLoadingLookalikes(false)
    }
  }

  async function handleAddLookalike(l) {
    if (addingLookalike === l.linkedin_url || addedLookalikes.has(l.linkedin_url)) return
    setAddingLookalike(l.linkedin_url)
    try {
      await bulkCreateCompanies([
        {
          name: l.name,
          linkedin_url: l.linkedin_url,
          industry: l.industry || '',
          company_type: l.company_type || '',
        },
      ])
      setAddedLookalikes((prev) => new Set([...prev, l.linkedin_url]))
      onRefresh?.()
    } catch {
    } finally {
      setAddingLookalike(null)
    }
  }

  async function handleLoadActivities() {
    setShowActivity((v) => !v)
    if (activities !== null) return
    try {
      const res = await getCompanyActivities(company.id)
      setActivities(res.data.activities || [])
    } catch {
      setActivities([])
    }
  }

  async function handleLogActivity() {
    if (!activityNote.trim()) return
    setSavingActivity(true)
    try {
      const res = await createCompanyActivity(company.id, {
        type: activityType,
        note: activityNote.trim(),
      })
      setActivities((prev) => [res.data.activity, ...(prev || [])])
      setActivityNote('')
    } catch {
    } finally {
      setSavingActivity(false)
    }
  }

  async function handleDeleteActivity(id) {
    await deleteCompanyActivity(id)
    setActivities((prev) => (prev || []).filter((a) => a.id !== id))
  }

  async function handleEnrichPipeline() {
    setPipelining(true)
    setPipelineSteps([])
    try {
      await enrichPipeline(company.id, (_, __, result) => {
        if (result?.step) {
          setPipelineSteps((prev) => {
            const idx = prev.findIndex((s) => s.step === result.step)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = result
              return next
            }
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
    } catch (e) {
      console.error(e)
    } finally {
      setPipelining(false)
    }
  }

  function openEdit() {
    setEditForm({
      name: company.name || '',
      tagline: company.tagline || '',
      website: company.website || '',
      linkedin_url: company.linkedin_url || '',
      headquarters: company.headquarters || '',
      size: company.size || '',
      followers: company.followers || '',
      phone: company.phone || '',
      revenue: company.revenue || '',
      compliance: company.compliance || '',
      founded: company.founded || '',
      industry: company.industry || '',
      company_type: company.company_type || '',
      specialties: company.specialties || '',
      is_saas: company.is_saas === true ? 'true' : company.is_saas === false ? 'false' : '',
      description: company.description || '',
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
  const domain = company.website ? company.website.replace(/^https?:\/\//, '').split('/')[0] : null
  const accentColor =
    missingFields.length > 0
      ? 'rgba(168,100,72,0.6)'
      : isSuspicious
        ? 'rgba(217,119,6,0.7)'
        : classColor
  const followersDisplay = company.followers
    ? String(company.followers)
        .replace(/\s*followers?\s*/gi, '')
        .trim()
    : '—'

  // Only show ICP score when we have enrichment data to base it on
  const hasEnrichmentData = !!(
    company.tech_stack?.length ||
    company.revenue_estimate ||
    company.review_presence ||
    company.job_openings?.length
  )
  const icpScore = hasEnrichmentData ? scoreCompanyICP(company) : null
  const icpColor = icpScore >= 70 ? '#059669' : icpScore >= 45 ? '#d97706' : '#6b7280'

  const enrichedAgo = (() => {
    if (!company.enriched_at) return null
    const diff = Math.floor((Date.now() - new Date(company.enriched_at).getTime()) / 86400000)
    if (diff === 0) return 'Enriched today'
    if (diff === 1) return 'Enriched yesterday'
    return `Enriched ${diff}d ago`
  })()

  const field = (label, value) =>
    value ? (
      <div>
        <p style={card.fieldLabel}>{label}</p>
        <p style={card.fieldValue}>{value}</p>
      </div>
    ) : null

  // One-liner summary: tagline → structured sentence → description fallback
  const cleanTagline = (() => {
    // 1. Use tagline if it's a real sentence (not a LinkedIn post date)
    const tl = (company.tagline || '')
      .replace(/^[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}\s*[·•·]\s*/i, '')
      .trim()
    if (tl && tl.length >= 12 && tl.length <= 140) return tl

    // 2. Build a structured sentence from available fields
    const name = company.name || ''
    const industry = (company.industry || '').trim()
    const isSaas = company.is_saas
    const ctRaw = (company.company_type || '').split('·')[0].trim().toLowerCase()
    const rawSpecs = typeof company.specialties === 'string' ? company.specialties : ''
    const specs = rawSpecs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3)

    if (name && (industry || specs.length)) {
      let s = name + ' is'
      if (isSaas === true) s += ' a SaaS'
      else if (ctRaw) s += ` a ${ctRaw}`
      else s += ' a'
      s += industry ? ` ${industry.toLowerCase()} company` : ' company'
      if (specs.length === 1) s += ` focused on ${specs[0]}`
      else if (specs.length === 2) s += ` specializing in ${specs[0]} and ${specs[1]}`
      else if (specs.length >= 3) s += ` specializing in ${specs[0]}, ${specs[1]}, and ${specs[2]}`
      return s + '.'
    }

    // 3. Fall back: first sentence of description
    const desc = (company.description || '')
      .replace(/^[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}\s*[·•·]\s*/i, '')
      .trim()
    if (!desc) return null
    const sentence = desc.split(/(?<=[.!?])\s+/)[0] || desc
    return sentence.length > 4
      ? sentence.length > 120
        ? sentence.substring(0, 118) + '…'
        : sentence
      : null
  })()

  // Format employee count: "1547 employees" → "1,547" / "1001-5000" → "1,001–5,000"
  const formatEmployees = (s) => {
    if (!s) return null
    const clean = String(s)
      .replace(/\s*employees?\s*/gi, '')
      .trim()
    if (/^\d+$/.test(clean.replace(/,/g, ''))) {
      return parseInt(clean.replace(/,/g, ''), 10).toLocaleString()
    }
    const range = clean.match(/^(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)$/)
    if (range)
      return `${parseInt(range[1].replace(/,/g, ''), 10).toLocaleString()}–${parseInt(range[2].replace(/,/g, ''), 10).toLocaleString()}`
    return clean
  }

  const empCount = formatEmployees(company.size)

  return (
    <>
      <div style={{ ...card.wrapper, borderLeft: `4px solid ${accentColor}` }}>
        {/* ── Header ── */}
        <div
          style={{ display: 'flex', alignItems: 'flex-start', padding: '18px 22px 14px', gap: 14 }}
        >
          <CompanyLogo
            domain={domain}
            altDomain={
              company.linkedin_website
                ? company.linkedin_website.replace(/^https?:\/\//, '').split('/')[0]
                : null
            }
            name={company.name}
            size={58}
          />

          {/* Name + domain + tagline */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--text)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                  margin: 0,
                }}
              >
                {company.name}
              </h3>
              {domain && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>· {domain}</span>
              )}
              {isSuspicious && (
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: '#92400e',
                    letterSpacing: '0.04em',
                  }}
                >
                  ⊘ mismatch
                </span>
              )}
              {icpScore !== null && isEnabled('icp_scoring') && (
                <span
                  title="Fit score based on enrichment data — tech stack, size, reviews, hiring activity"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    padding: '2px 7px',
                    background: `${icpColor}12`,
                    border: `1px solid ${icpColor}35`,
                    borderRadius: 4,
                    color: icpColor,
                    letterSpacing: '0.04em',
                    userSelect: 'none',
                  }}
                >
                  Fit {icpScore}
                </span>
              )}
              {enrichedAgo && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.01em' }}>
                  · {enrichedAgo}
                </span>
              )}
            </div>
            {cleanTagline && (
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  margin: '5px 0 0',
                  lineHeight: 1.45,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {cleanTagline}
              </p>
            )}
            {/* Inline result lines — no boxes */}
            {fillResult && (
              <p
                style={{
                  fontSize: 11,
                  margin: '6px 0 0',
                  color: fillResult.ok ? '#4a7c59' : 'var(--accent)',
                }}
              >
                {fillResult.ok
                  ? `✓ Filled: ${fillResult.filled.join(', ')}`
                  : `⚠ ${fillResult.msg}`}
              </p>
            )}
            {analyzeResult && (
              <p
                style={{
                  fontSize: 11,
                  margin: '4px 0 0',
                  color: analyzeResult.ok ? '#4a7c59' : 'var(--accent)',
                }}
              >
                {analyzeResult.ok
                  ? [
                      analyzeResult.analysis.company_type,
                      analyzeResult.analysis.company_type_confidence
                        ? `(${analyzeResult.analysis.company_type_confidence})`
                        : null,
                      analyzeResult.analysis.compliance?.length
                        ? `· ${analyzeResult.analysis.compliance.join(', ')}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' ')
                  : `⚠ ${analyzeResult.msg}`}
              </p>
            )}
            {enrichResult && !enrichResult.ok && (
              <p style={{ fontSize: 11, margin: '4px 0 0', color: 'var(--accent)' }}>
                ⚠ {enrichResult.msg}
              </p>
            )}
          </div>

          {/* Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={handleWatchlist}
              title={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                padding: '2px 4px',
                color: watchlisted ? '#f59e0b' : 'var(--border)',
                transition: 'color 0.15s',
              }}
            >
              {watchlisted ? '★' : '☆'}
            </button>
            <input
              type="checkbox"
              checked={selected || false}
              onChange={() => onToggle(company.id)}
              onClick={(e) => e.stopPropagation()}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 14, height: 14 }}
            />
            <select
              value={prospectStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{ ...card.statusSelect, color: statusColor, borderColor: `${statusColor}40` }}
            >
              {PROSPECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {(() => {
              const BAD_INDUSTRIES = [
                'private company',
                'privately held',
                'public company',
                'partnership',
                'sole proprietorship',
              ]
              const ind = (company.industry || '').trim()
              const show = ind && !BAD_INDUSTRIES.includes(ind.toLowerCase())
              return show ? (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.04em',
                    color: classColor,
                    border: `1px solid ${classColor}40`,
                    borderRadius: 5,
                    padding: '4px 10px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 180,
                  }}
                  title={ind}
                >
                  {ind}
                </span>
              ) : null
            })()}
            {/* ── Actions dropdown ── */}
            <div ref={actionsMenuRef} style={{ position: 'relative' }}>
              <button
                style={{
                  ...card.actionBtn,
                  color: 'var(--text)',
                  borderColor: showActionsMenu ? 'var(--accent)' : 'var(--border)',
                  background: showActionsMenu ? 'rgba(168,100,72,0.08)' : 'transparent',
                }}
                onClick={() => setShowActionsMenu((v) => !v)}
              >
                {fillingLI || analyzing || pipelining || deepEnriching ? 'Running…' : 'Actions ▾'}
              </button>
              {showActionsMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    zIndex: 200,
                    minWidth: 180,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    disabled={fillingLI || analyzing || pipelining || deepEnriching}
                    onClick={() => {
                      setShowActionsMenu(false)
                      handleFullEnrich()
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 14px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color:
                        fillingLI || analyzing || pipelining || deepEnriching
                          ? 'var(--text-muted)'
                          : 'var(--accent)',
                      cursor:
                        fillingLI || analyzing || pipelining || deepEnriching
                          ? 'default'
                          : 'pointer',
                      opacity: fillingLI || analyzing || pipelining || deepEnriching ? 0.5 : 1,
                    }}
                  >
                    {fillingLI
                      ? 'Filling…'
                      : analyzing
                        ? 'Analyzing…'
                        : pipelining
                          ? `Enriching ${pipelineSteps.filter((s) => s.status === 'done').length}/3…`
                          : deepEnriching
                            ? 'Deep Enriching…'
                            : enrichResult?.ok
                              ? `✓ ${enrichResult.count} fields`
                              : 'Enrich'}
                  </button>
                  <button
                    onClick={() => {
                      setShowActionsMenu(false)
                      setShowSignals((v) => !v)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 14px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: cachedSignals?.length || showSignals ? '#a86448' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {cachedSignals?.length ? `${cachedSignals.length} Signals` : 'Signals'}
                  </button>
                  <button
                    onClick={() => {
                      setShowActionsMenu(false)
                      setShowNotes((v) => !v)
                      if (!showNotes) setEditingNotes(false)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 14px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom:
                        isEnabled('linkedin_dm') ||
                        isEnabled('activity_timeline') ||
                        isEnabled('lookalike_finder')
                          ? '1px solid var(--border)'
                          : 'none',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: showNotes || notes ? 'var(--text)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    Notes
                  </button>
                  {isEnabled('linkedin_dm') && (
                    <button
                      onClick={() => {
                        setShowActionsMenu(false)
                        handleGenerateDM()
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '9px 14px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom:
                          isEnabled('activity_timeline') || isEnabled('lookalike_finder')
                            ? '1px solid var(--border)'
                            : 'none',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: showDM ? '#0369a1' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {generatingDM ? 'Writing DM…' : 'LinkedIn DM'}
                    </button>
                  )}
                  {isEnabled('activity_timeline') && (
                    <button
                      onClick={() => {
                        setShowActionsMenu(false)
                        handleLoadActivities()
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '9px 14px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: isEnabled('lookalike_finder')
                          ? '1px solid var(--border)'
                          : 'none',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: showActivity ? 'var(--text)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Activity Log
                    </button>
                  )}
                  {isEnabled('lookalike_finder') && (
                    <button
                      onClick={() => {
                        setShowActionsMenu(false)
                        handleLoadLookalikes()
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '9px 14px',
                        background: 'transparent',
                        border: 'none',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: showLookalikes ? '#059669' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Find Similar
                    </button>
                  )}
                </div>
              )}
            </div>
            <button style={card.primaryBtn} onClick={() => onViewLeads(company)}>
              Leads →
            </button>
            <button style={card.editCardBtn} onClick={openEdit} title="Edit">
              ✎
            </button>
            <button style={card.deleteBtn} onClick={() => onDelete(company.id)} title="Remove">
              ✕
            </button>
          </div>
        </div>

        {/* ── Info grid ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '14px 32px',
            padding: '14px 22px 18px',
            borderTop: '1px solid var(--border)',
          }}
        >
          {field('Industry', company.industry)}
          {company.company_type ? (
            <div>
              <p style={card.fieldLabel}>Type</p>
              <p style={card.fieldValue}>
                {company.company_type}
                {company.is_saas !== null &&
                  company.is_saas !== undefined &&
                  ` · ${company.is_saas ? 'SaaS' : 'Non-SaaS'}`}
              </p>
            </div>
          ) : (
            field('Type', null)
          )}

          {field('HQ', company.headquarters)}
          {followersDisplay !== '—' ? (
            <div>
              <p style={card.fieldLabel}>Followers</p>
              <p style={card.fieldValue}>{followersDisplay}</p>
            </div>
          ) : null}
          {empCount ? (
            <div>
              <p style={card.fieldLabel}>Employees</p>
              <p style={card.fieldValue}>{empCount}</p>
            </div>
          ) : null}
          {company.website && (
            <div>
              <p style={card.fieldLabel}>Website</p>
              <EditableWebsite
                value={company.website}
                onSave={(v) => onUpdate(company.id, { website: v })}
              />
            </div>
          )}
          {company.specialties ? (
            <div>
              <p style={card.fieldLabel}>Specialties</p>
              <p style={card.fieldValue}>
                {company.specialties
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .join(', ')}
              </p>
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
              {COMPANY_EDIT_FIELDS.map((f) => (
                <div key={f.key} style={{ gridColumn: f.type === 'textarea' ? '1 / -1' : 'auto' }}>
                  <label style={card.editLabel}>{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea
                      value={editForm[f.key] || ''}
                      onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      style={{ ...card.editInput, height: 64, resize: 'vertical' }}
                      placeholder="Description…"
                    />
                  ) : f.type === 'select' ? (
                    <select
                      value={editForm[f.key] || ''}
                      onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      style={card.editInput}
                    >
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o || '—'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={editForm[f.key] || ''}
                      onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder || ''}
                      style={card.editInput}
                    />
                  )}
                </div>
              ))}
            </div>
            <div style={card.editFooter}>
              <button onClick={() => setShowEdit(false)} style={card.editCancelBtn}>
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                style={{ ...card.editSaveBtn, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}

        {/* ── Notes ── */}
        {(showNotes || editingNotes) && (
          <div
            style={{
              padding: '12px 22px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <p style={card.fieldLabel}>Notes</p>
              <button
                style={card.editBtn}
                onClick={() => (editingNotes ? handleSaveNotes() : setEditingNotes(true))}
              >
                {editingNotes ? 'Save' : 'Edit'}
              </button>
            </div>
            {editingNotes ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={card.textarea}
                placeholder="Add notes…"
                rows={2}
                autoFocus
              />
            ) : (
              <p style={{ ...card.notesText, fontSize: 13 }}>{notes || 'No notes yet.'}</p>
            )}
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
          <div
            style={{
              padding: '10px 22px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#0a66c2">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            <a
              href={company.linkedin_url}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 12,
                color: '#0a66c2',
                textDecoration: 'none',
                fontWeight: 500,
                letterSpacing: '0.01em',
              }}
            >
              View on LinkedIn ↗
            </a>
          </div>
        )}
      </div>

      {/* ── Deep Intelligence card — gated by feature flag ── */}
      {showEnrichCards && isEnabled('company_enrich_cards') && (
        <div
          style={{
            marginTop: 8,
            background: 'var(--bg)',
            border: '1px solid rgba(196,193,189,0.55)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {/* Card header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 18px',
              borderBottom: '1px solid rgba(196,193,189,0.4)',
              background: 'var(--surface)',
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Deep Intelligence
            </span>
          </div>

          {/* Sections — each row is a horizontal band */}
          {/* Email Pattern */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 18px',
              borderBottom: '1px solid rgba(196,193,189,0.3)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-muted)',
                minWidth: 110,
                paddingTop: 2,
              }}
            >
              Email Pattern
            </span>
            {company.email_pattern ? (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#b45309',
                }}
              >
                {company.email_pattern}@{domain || '…'}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Run Deep Enrich to detect.
              </span>
            )}
          </div>

          {/* Revenue + Traffic side by side */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              borderBottom: '1px solid rgba(196,193,189,0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 18px',
                borderRight: '1px solid rgba(196,193,189,0.3)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  minWidth: 110,
                  paddingTop: 2,
                }}
              >
                Revenue
              </span>
              {company.revenue_estimate ? (
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#059669',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {company.revenue_estimate}
                </span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  —
                </span>
              )}
            </div>
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 18px' }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  minWidth: 90,
                  paddingTop: 2,
                }}
              >
                Web Traffic
              </span>
              {company.traffic_estimate ? (
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#0284c7',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {company.traffic_estimate}
                </span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  —
                </span>
              )}
            </div>
          </div>

          {/* Tech Stack */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 18px',
              borderBottom: '1px solid rgba(196,193,189,0.3)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-muted)',
                minWidth: 110,
                paddingTop: 2,
                flexShrink: 0,
              }}
            >
              Tech Stack
            </span>
            {company.tech_stack?.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(Array.isArray(company.tech_stack) ? company.tech_stack : [])
                  .slice(0, 14)
                  .map((t) => (
                    <span
                      key={t}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        padding: '2px 7px',
                        background: 'rgba(124,58,237,0.07)',
                        border: '1px solid rgba(124,58,237,0.2)',
                        borderRadius: 4,
                        color: '#7c3aed',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                {company.tech_stack.length > 14 && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    +{company.tech_stack.length - 14} more
                  </span>
                )}
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Run Deep Enrich to detect.
              </span>
            )}
          </div>

          {/* Social Profiles + Reviews side by side */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              borderBottom: '1px solid rgba(196,193,189,0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 18px',
                borderRight: '1px solid rgba(196,193,189,0.3)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  minWidth: 110,
                  paddingTop: 2,
                  flexShrink: 0,
                }}
              >
                Social
              </span>
              {company.social_profiles && Object.keys(company.social_profiles).length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(company.social_profiles).map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12,
                        color: '#db2777',
                        textDecoration: 'none',
                        fontWeight: 500,
                        textTransform: 'capitalize',
                      }}
                    >
                      {platform} ↗
                    </a>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  —
                </span>
              )}
            </div>
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 18px' }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  minWidth: 90,
                  paddingTop: 2,
                  flexShrink: 0,
                }}
              >
                Reviews
              </span>
              {company.review_presence && Object.keys(company.review_presence).length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(company.review_presence).map(([platform, data]) => (
                    <a
                      key={platform}
                      href={data.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12,
                        color: '#d97706',
                        textDecoration: 'none',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span style={{ textTransform: 'capitalize' }}>{platform}</span>
                      {data.rating && (
                        <span style={{ color: 'var(--text)', fontWeight: 700 }}>
                          ★ {data.rating}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  —
                </span>
              )}
            </div>
          </div>

          {/* Open Roles */}
          {company.job_openings?.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 18px',
                borderBottom: '1px solid rgba(196,193,189,0.3)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  minWidth: 110,
                  paddingTop: 2,
                  flexShrink: 0,
                }}
              >
                Open Roles{' '}
                <span
                  style={{
                    background: 'rgba(3,105,161,0.1)',
                    color: '#0369a1',
                    borderRadius: 3,
                    padding: '0 4px',
                  }}
                >
                  {company.job_openings.length}
                </span>
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {company.job_openings.slice(0, 6).map((job, idx) => (
                  <a
                    key={idx}
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 11,
                      color: '#0369a1',
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    {job.title}
                    {idx < Math.min(company.job_openings.length, 6) - 1 ? ' ·' : ''}
                  </a>
                ))}
                {company.job_openings.length > 6 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    +{company.job_openings.length - 6} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Recent News */}
          {company.recent_news?.length > 0 && (
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 18px' }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  minWidth: 110,
                  paddingTop: 2,
                  flexShrink: 0,
                }}
              >
                Recent News
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {company.recent_news.slice(0, 3).map((item, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 12,
                          color: '#6d28d9',
                          textDecoration: 'none',
                          fontWeight: 600,
                          lineHeight: 1.4,
                        }}
                      >
                        {item.title}
                      </a>
                      {item.date && (
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {item.date}
                        </span>
                      )}
                    </div>
                    {item.snippet && (
                      <p
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          margin: '2px 0 0',
                          lineHeight: 1.4,
                        }}
                      >
                        {item.snippet}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Funding */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 18px',
              borderTop: '1px solid rgba(196,193,189,0.3)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-muted)',
                minWidth: 110,
                paddingTop: 2,
                flexShrink: 0,
              }}
            >
              Funding
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {company.revenue || fundingResult?.ok ? (
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#16a34a',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {fundingResult?.ok ? fundingResult.value : company.revenue}
                </span>
              ) : fundingResult?.ok === false ? (
                <span style={{ fontSize: 12, color: 'var(--accent)' }}>{fundingResult.msg}</span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Not available
                </span>
              )}
              <button
                onClick={handleFetchFunding}
                disabled={fetchingFunding}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  padding: '3px 8px',
                  background: 'transparent',
                  border: '1px solid rgba(22,163,74,0.35)',
                  borderRadius: 4,
                  color: fetchingFunding ? 'var(--text-muted)' : '#16a34a',
                  cursor: fetchingFunding ? 'default' : 'pointer',
                  opacity: fetchingFunding ? 0.6 : 1,
                  letterSpacing: '0.04em',
                }}
              >
                {fetchingFunding ? 'Fetching...' : 'Fetch Funding'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LinkedIn DM panel ── */}
      {showDM && (
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid rgba(3,105,161,0.25)',
            borderLeft: '4px solid #0369a1',
            borderRadius: 8,
            padding: '14px 18px',
            marginTop: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              LinkedIn DM
            </span>
            <button
              onClick={() => setShowDM(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>
          {generatingDM ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Writing personalised message…
            </p>
          ) : dmText ? (
            <>
              <textarea
                value={dmText}
                onChange={(e) => setDmText(e.target.value)}
                style={{
                  width: '100%',
                  fontSize: 13,
                  lineHeight: 1.5,
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  resize: 'vertical',
                  minHeight: 80,
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(dmText)
                    setDmCopied(true)
                    setTimeout(() => setDmCopied(false), 2000)
                  }}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    padding: '5px 12px',
                    background: dmCopied ? '#059669' : '#0369a1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 5,
                    cursor: 'pointer',
                  }}
                >
                  {dmCopied ? '✓ Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleGenerateDM}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    padding: '5px 12px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  Regenerate
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── Activity timeline ── */}
      {showActivity && (
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderLeft: '4px solid var(--text-muted)',
            borderRadius: 8,
            padding: '14px 18px',
            marginTop: 8,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text)',
              margin: '0 0 10px',
            }}
          >
            Activity Log
          </p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                padding: '4px 8px',
                border: '1px solid var(--border)',
                borderRadius: 5,
                background: 'var(--surface)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              {['note', 'call', 'email', 'meeting', 'linkedin'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={activityNote}
              onChange={(e) => setActivityNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogActivity()}
              placeholder="Log a note, call, meeting…"
              style={{
                flex: 1,
                fontSize: 12,
                padding: '4px 10px',
                border: '1px solid var(--border)',
                borderRadius: 5,
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
            />
            <button
              onClick={handleLogActivity}
              disabled={savingActivity || !activityNote.trim()}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                padding: '4px 12px',
                background: 'var(--text)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: 5,
                cursor: 'pointer',
                opacity: !activityNote.trim() ? 0.4 : 1,
              }}
            >
              Log
            </button>
          </div>
          {activities === null ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Loading…
            </p>
          ) : activities.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No activity yet.
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {activities.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '6px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      padding: '2px 6px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      marginTop: 1,
                    }}
                  >
                    {a.type}
                  </span>
                  <p
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: 'var(--text)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {a.note}
                  </p>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDeleteActivity(a.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Lookalike companies ── */}
      {showLookalikes && (
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid rgba(5,150,105,0.25)',
            borderLeft: '4px solid #059669',
            borderRadius: 8,
            padding: '14px 18px',
            marginTop: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              Similar companies to {company.name}
            </span>
            <button
              onClick={() => setShowLookalikes(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            {company.industry && (
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  margin: 0,
                  letterSpacing: '0.04em',
                }}
              >
                {company.industry}
                {company.company_type ? ` · ${company.company_type}` : ''}
                {company.is_saas != null ? ` · ${company.is_saas ? 'SaaS' : 'Non-SaaS'}` : ''}
              </p>
            )}
            {lookalikes !== null && !loadingLookalikes && (
              <button
                onClick={() => handleLoadLookalikes(true)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  padding: '3px 8px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                ↻ Refresh
              </button>
            )}
          </div>
          {loadingLookalikes ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Searching LinkedIn for similar companies…
            </p>
          ) : !lookalikes?.length ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No similar companies found.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lookalikes.map((l, i) => {
                const added = addedLookalikes.has(l.linkedin_url)
                const adding = addingLookalike === l.linkedin_url
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                      >
                        <a
                          href={l.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#059669',
                            textDecoration: 'none',
                          }}
                        >
                          {l.name}
                        </a>
                        {l.company_type && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 9,
                              padding: '1px 5px',
                              background: 'rgba(99,102,241,0.08)',
                              border: '1px solid rgba(99,102,241,0.2)',
                              borderRadius: 3,
                              color: '#6366f1',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {l.company_type}
                          </span>
                        )}
                        {(l.business_model || l.is_saas != null) && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 9,
                              padding: '1px 5px',
                              background: 'rgba(234,179,8,0.08)',
                              border: '1px solid rgba(234,179,8,0.25)',
                              borderRadius: 3,
                              color: '#a16207',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {[
                              l.business_model,
                              l.is_saas != null ? (l.is_saas ? 'SaaS' : 'Non-SaaS') : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                        {l.rating && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 9,
                              padding: '1px 5px',
                              background: 'rgba(5,150,105,0.08)',
                              border: '1px solid rgba(5,150,105,0.2)',
                              borderRadius: 3,
                              color: '#059669',
                              letterSpacing: '0.04em',
                            }}
                          >
                            ★ {l.rating} G2
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginTop: 3,
                          flexWrap: 'wrap',
                        }}
                      >
                        {l.employees && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10,
                              color: 'var(--text-muted)',
                            }}
                          >
                            👥 {l.employees} emp
                          </span>
                        )}
                        {l.followers > 0 && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10,
                              color: 'var(--text-muted)',
                            }}
                          >
                            ◆{' '}
                            {l.followers >= 1000
                              ? `${(l.followers / 1000).toFixed(l.followers >= 10000 ? 0 : 1)}K`
                              : l.followers}{' '}
                            followers
                          </span>
                        )}
                      </div>
                      {l.snippet && (
                        <p
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            margin: '3px 0 0',
                            lineHeight: 1.4,
                          }}
                        >
                          {l.snippet}
                        </p>
                      )}
                    </div>
                    <button
                      disabled={added || adding}
                      onClick={() => handleAddLookalike(l)}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        padding: '4px 10px',
                        background: added ? 'rgba(5,150,105,0.1)' : 'transparent',
                        border: `1px solid ${added ? '#059669' : 'var(--border)'}`,
                        borderRadius: 5,
                        color: added ? '#059669' : 'var(--text-muted)',
                        cursor: added ? 'default' : 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {adding ? 'Adding…' : added ? '✓ Added' : '+ Add'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
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
    <a
      href={`https://www.linkedin.com/company/${slug}/people/`}
      style={{
        color: 'var(--accent)',
        fontSize: '13px',
        fontWeight: '500',
        display: 'block',
        marginTop: '12px',
      }}
    >
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
        setLeads(res.data?.leads || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [company.id])

  return (
    <div style={modal.overlay} onClick={onClose}>
      <div style={modal.box} onClick={(e) => e.stopPropagation()}>
        <div style={modal.header}>
          <div>
            <p style={modal.eyebrow}>COMPANY LEADS</p>
            <h2 style={modal.title}>{company.name}</h2>
          </div>
          <button style={modal.closeBtn} onClick={onClose}>
            ✕ Close
          </button>
        </div>
        {loading ? (
          <p style={modal.empty}>Loading leads…</p>
        ) : leads.length === 0 ? (
          <div style={modal.emptyState}>
            <p style={modal.emptyTitle}>No leads found</p>
            <p style={modal.emptyText}>
              Visit the company LinkedIn people page and use the extension to extract leads.
            </p>
            <EmptyLeadsLink company={company} />
          </div>
        ) : (
          <div style={modal.leadsGrid}>
            {leads.map((lead) => (
              <div key={lead.id} style={modal.leadCard}>
                <p style={modal.leadName}>{lead.name}</p>
                <p style={modal.leadTitle}>{lead.title || '—'}</p>
                <p style={modal.leadLocation}>{lead.location || '—'}</p>
                {lead.profile_url && (
                  <a
                    href={lead.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    style={modal.leadLink}
                  >
                    View Profile →
                  </a>
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
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(29,27,27,0.5)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '88vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(29,27,27,0.14)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                fontWeight: '600',
                letterSpacing: '0.14em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '5px',
              }}
            >
              Website Analysis
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                fontWeight: '400',
                letterSpacing: '-0.04em',
                color: 'var(--text)',
                lineHeight: 1,
              }}
            >
              {company.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '5px 10px',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {analysis.error ? (
            <div
              style={{
                padding: '12px 14px',
                background: 'rgba(184,50,50,0.05)',
                border: '1px solid rgba(184,50,50,0.18)',
                borderRadius: '7px',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--red)',
                  letterSpacing: '0.02em',
                }}
              >
                {analysis.error}
              </p>
            </div>
          ) : (
            <>
              {/* Stats gap-px grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1px',
                  background: 'var(--border-strong)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                }}
              >
                {[
                  { label: 'Company Type', value: analysis.company_type || '—' },
                  {
                    label: 'Is SaaS',
                    value:
                      analysis.is_saas === true ? 'Yes' : analysis.is_saas === false ? 'No' : '—',
                  },
                  { label: 'Target Market', value: analysis.target_market || '—' },
                  {
                    label: 'Has Login',
                    value:
                      analysis.has_login === true
                        ? 'Yes'
                        : analysis.has_login === false
                          ? 'No'
                          : '—',
                  },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--bg)', padding: '14px 16px' }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        fontWeight: '600',
                        letterSpacing: '0.12em',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        marginBottom: '6px',
                      }}
                    >
                      {label}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '18px',
                        fontWeight: '400',
                        letterSpacing: '-0.03em',
                        color: 'var(--text)',
                        lineHeight: 1,
                      }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {analysis.compliance?.length > 0 && (
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      fontWeight: '600',
                      letterSpacing: '0.14em',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      marginBottom: '8px',
                    }}
                  >
                    Compliance
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {analysis.compliance.map((c) => (
                      <span
                        key={c}
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          fontWeight: '600',
                          letterSpacing: '0.04em',
                          padding: '4px 10px',
                          background: 'rgba(74,124,89,0.08)',
                          color: '#4a7c59',
                          border: '1px solid rgba(74,124,89,0.22)',
                          borderRadius: '4px',
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.products_or_services?.length > 0 && (
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      fontWeight: '600',
                      letterSpacing: '0.14em',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      marginBottom: '8px',
                    }}
                  >
                    Products / Services
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {analysis.products_or_services.map((p) => (
                      <span
                        key={p}
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          letterSpacing: '0.02em',
                          padding: '4px 10px',
                          background: 'var(--surface)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                        }}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.website_summary && (
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      fontWeight: '600',
                      letterSpacing: '0.14em',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      marginBottom: '8px',
                    }}
                  >
                    Summary
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.8,
                      letterSpacing: '0.01em',
                    }}
                  >
                    {analysis.website_summary}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px',
              background: 'var(--text)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '7px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              fontWeight: '600',
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPANIES PAGE ──────────────────────────────────────

export default function Companies() {
  const {
    autofill,
    analyze,
    maps,
    runAutofill,
    runAnalyze,
    runMapsEnrich,
    registerLive,
    drainPending,
  } = useBulkOps()
  const { isEnabled } = useFeatureFlags()

  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [watchlistOnly, setWatchlistOnly] = useState(false)
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
  const [bulkEnriching, setBulkEnriching] = useState(false)
  const [bulkEnrichProgress, setBulkEnrichProgress] = useState(null)
  const [activeJob, setActiveJob] = useState(null)

  // Poll active SQS jobs — picks up background jobs even after page refresh
  const [dismissedJobId, setDismissedJobId] = useState(null)
  useEffect(() => {
    let timer
    async function pollJobs() {
      try {
        const res = await listJobs()
        const STALE_MS = 30 * 60 * 1000
        const running = (res.data || []).find((j) => {
          if (j.status !== 'running' && j.status !== 'queued') return false
          if (j.id === dismissedJobId) return false
          const age = Date.now() - new Date(j.created_at).getTime()
          return age < STALE_MS
        })
        if (running) {
          setActiveJob(running)
          timer = setTimeout(async () => {
            try {
              const jr = await getJob(running.id)
              setActiveJob(jr.data)
              if (jr.data?.status === 'completed' || jr.data?.status === 'failed') {
                setTimeout(() => setActiveJob(null), 5000)
              }
            } catch {}
          }, 3000)
        } else {
          setActiveJob(null)
        }
      } catch {}
    }
    pollJobs()
    const interval = setInterval(pollJobs, 8000)
    return () => {
      clearInterval(interval)
      clearTimeout(timer)
    }
  }, [dismissedJobId])

  const [showBulkMenu, setShowBulkMenu] = useState(false)
  const bulkMenuRef = useRef(null)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'kanban'
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const [alerts, setAlerts] = useState([])
  const [showAlerts, setShowAlerts] = useState(false)
  const [refreshingAlerts, setRefreshingAlerts] = useState(false)
  const [dupeGroups, setDupeGroups] = useState(null)
  const [showDupes, setShowDupes] = useState(false)
  const [findingDupes, setFindingDupes] = useState(false)
  const [segments, setSegments] = useState([])
  const [showSegmentSave, setShowSegmentSave] = useState(false)
  const [segmentName, setSegmentName] = useState('')

  // Register with BulkOpsContext while mounted so streaming results update local state live.
  // On unmount the context buffers results; on remount drainPending() catches up.
  useEffect(() => {
    registerLive((result) => {
      setCompanies((prev) => {
        const next = [...prev]
        const idx = next.findIndex((c) => c.id === result.id)
        if (idx !== -1) next[idx] = { ...next[idx], ...result.update }
        return next
      })
    })
    return () => registerLive(null)
  }, [])

  useEffect(() => {
    fetchCompanies()
    getCompanyAlerts()
      .then((r) => setAlerts(r.data.alerts || []))
      .catch(() => {})
    listCompanySegments()
      .then((r) => setSegments(r.data.segments || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!showBulkMenu) return
    function handleClickOutside(e) {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target)) setShowBulkMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showBulkMenu])

  async function fetchCompanies() {
    try {
      invalidateCache('/companies')
      const res = await getCompanies()
      const fresh = res.data?.companies || []
      const missed = drainPending()
      const merged = Object.keys(missed).length
        ? fresh.map((c) => (missed[c.id] ? { ...c, ...missed[c.id] } : c))
        : fresh
      setCompanies(merged)
      syncToDirectory(merged)
    } catch (e) {
      console.error(e)
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(id, data) {
    try {
      await updateCompany(id, data)
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)))
    } catch (e) {
      console.error(e)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this company?')) return
    try {
      await deleteCompany(id)
      setCompanies((prev) => prev.filter((c) => c.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  function runAccuracyCheck() {
    const map = {}
    for (const c of companies) map[c.id] = checkCompanyAccuracy(c)
    setAccuracyMap(map)
  }

  const filtered = companies.filter((c) => {
    const ms =
      search === '' ||
      [c.name, c.industry, c.headquarters].join(' ').toLowerCase().includes(search.toLowerCase())
    const mc =
      classFilter === 'all' ||
      c.classification === classFilter ||
      (!c.classification && classFilter === 'Unclassified')
    const ms2 = statusFilter === 'all' || c.prospect_status === statusFilter
    const mf = followerFilter === 'all' || parseFollowers(c.followers) >= parseInt(followerFilter)
    const ct = c.company_type === 'Services' ? 'Service' : c.company_type
    const mt = typeFilter === 'all' || ct === typeFilter
    const missing = getMissingFields(c).length
    const acc = accuracyMap[c.id]
    const isSusp = acc?.confidence === 'low' || acc?.confidence === 'medium'
    const mfill =
      fillFilter === 'all' ||
      (fillFilter === 'complete' && missing === 0) ||
      (fillFilter === 'incomplete' && missing > 0) ||
      (fillFilter === 'suspicious' && isSusp) ||
      (fillFilter === 'accurate' && acc?.confidence === 'high')
    const mwatch = !watchlistOnly || c.watchlisted
    return ms && mc && ms2 && mf && mt && mfill && mwatch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [search, classFilter, statusFilter, followerFilter, typeFilter, fillFilter, watchlistOnly])

  const prospectCount = companies.filter((c) => c.prospect_status === 'Prospect').length
  const notFitCount = companies.filter((c) => c.prospect_status === 'Not a Fit').length
  const needsDataCount = companies.filter((c) => getMissingFields(c).length > 0).length

  function exportCompaniesCSV() {
    import('xlsx-js-style')
      .then((mod) => {
        const XLSX = mod.default || mod

        const scalar = (v) => {
          if (v === null || v === undefined) return ''
          if (typeof v === 'object') {
            if (Array.isArray(v))
              return v
                .map((item) =>
                  typeof item === 'object' ? item.title || item.url || JSON.stringify(item) : item
                )
                .join('; ')
            return Object.entries(v)
              .map(([k, val]) => `${k}: ${typeof val === 'object' ? JSON.stringify(val) : val}`)
              .join('; ')
          }
          return String(v)
        }

        // ── Sort ──────────────────────────────────────────────────────
        const STATUS_RANK = { qualified: 0, contacted: 1, new: 2 }
        const CLASS_RANK = { Target: 0, Potential: 1, Monitor: 2 }
        const sorted = [...companies].sort((a, b) => {
          const sr = (STATUS_RANK[a.prospect_status] ?? 9) - (STATUS_RANK[b.prospect_status] ?? 9)
          if (sr !== 0) return sr
          const cr = (CLASS_RANK[a.classification] ?? 9) - (CLASS_RANK[b.classification] ?? 9)
          if (cr !== 0) return cr
          const fb = (Number(b.followers) || 0) - (Number(a.followers) || 0)
          if (fb !== 0) return fb
          return (a.name || '').localeCompare(b.name || '')
        })

        // ── Column definitions ────────────────────────────────────────
        const COLS = [
          { label: 'Name', key: 'name', w: 32 },
          { label: 'Classification', key: 'classification', w: 16 },
          { label: 'Status', key: 'prospect_status', w: 14 },
          { label: 'Industry', key: 'industry', w: 22 },
          { label: 'Type', key: 'company_type', w: 14 },
          { label: 'HQ', key: 'headquarters', w: 24 },
          { label: 'Employees', key: 'size', w: 12 },
          { label: 'Followers', key: 'followers', w: 12 },
          { label: 'Website', key: 'website', w: 34 },
          { label: 'LinkedIn URL', key: 'linkedin_url', w: 34 },
          { label: 'Compliance', key: 'compliance', w: 14 },
          { label: 'Revenue/Funding', key: 'revenue', w: 18 },
          { label: 'Email Pattern', key: 'email_pattern', w: 18 },
          { label: 'Tech Stack', key: 'tech_stack', w: 32 },
          { label: 'Description', key: 'description', w: 52 },
          { label: 'Notes', key: 'notes', w: 30 },
          { label: 'Enriched At', key: 'enriched_at', w: 18 },
        ]

        // ── Style helpers ─────────────────────────────────────────────
        const HDR_S = {
          fill: { fgColor: { rgb: 'E7000B' }, patternType: 'solid' },
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
          border: {
            bottom: { style: 'medium', color: { rgb: '9D0010' } },
            right: { style: 'thin', color: { rgb: 'CC0000' } },
          },
        }
        const DATA_S = (stripe) => ({
          fill: stripe
            ? { fgColor: { rgb: 'F5F5F5' }, patternType: 'solid' }
            : { fgColor: { rgb: 'FFFFFF' }, patternType: 'solid' },
          font: { sz: 10, name: 'Calibri' },
          alignment: { vertical: 'center', wrapText: false },
          border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } },
        })
        const CLASS_S = {
          Target: {
            fill: { fgColor: { rgb: 'FDE8E8' }, patternType: 'solid' },
            font: { bold: true, color: { rgb: '9D0010' }, sz: 10, name: 'Calibri' },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } },
          },
          Potential: {
            fill: { fgColor: { rgb: 'FFF3CD' }, patternType: 'solid' },
            font: { bold: true, color: { rgb: '92400E' }, sz: 10, name: 'Calibri' },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } },
          },
          Monitor: {
            fill: { fgColor: { rgb: 'E8F5E9' }, patternType: 'solid' },
            font: { bold: true, color: { rgb: '166534' }, sz: 10, name: 'Calibri' },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } },
          },
        }

        // ── Build Companies sheet ─────────────────────────────────────
        const ws1Data = [COLS.map((c) => c.label)]
        sorted.forEach((c) => ws1Data.push(COLS.map((col) => scalar(c[col.key]))))

        const ws1 = XLSX.utils.aoa_to_sheet(ws1Data)
        ws1['!cols'] = COLS.map((c) => ({ wch: c.w }))
        ws1['!rows'] = [{ hpt: 22 }, ...sorted.map(() => ({ hpt: 15 }))]
        ws1['!freeze'] = { xSplit: 1, ySplit: 1 }
        ws1['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(COLS.length - 1)}1` }

        // Apply header styles
        COLS.forEach((_, ci) => {
          const addr = XLSX.utils.encode_cell({ r: 0, c: ci })
          if (ws1[addr]) ws1[addr].s = HDR_S
        })

        // Apply data row styles
        sorted.forEach((company, ri) => {
          const stripe = ri % 2 === 1
          COLS.forEach((col, ci) => {
            const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci })
            if (!ws1[addr]) ws1[addr] = { t: 's', v: '' }
            if (ci === 1 && CLASS_S[company.classification]) {
              ws1[addr].s = CLASS_S[company.classification]
            } else {
              ws1[addr].s = DATA_S(stripe)
            }
          })
        })

        // ── Build Summary sheet ───────────────────────────────────────
        const total = sorted.length
        const enriched = sorted.filter((c) => c.enriched_at).length
        const withEmail = sorted.filter((c) => c.email_pattern).length

        const count = (arr, key, fallback = '(none)') => {
          const m = {}
          arr.forEach((c) => {
            const k = c[key] || fallback
            m[k] = (m[k] || 0) + 1
          })
          return Object.entries(m).sort((a, b) => b[1] - a[1])
        }

        const SHDR = {
          fill: { fgColor: { rgb: 'E7000B' }, patternType: 'solid' },
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
          alignment: { vertical: 'center' },
        }
        const SR = (stripe) => ({
          fill: { fgColor: { rgb: stripe ? 'F5F5F5' : 'FFFFFF' }, patternType: 'solid' },
          font: { sz: 10 },
          alignment: { vertical: 'center' },
        })
        const SRB = (stripe) => ({
          ...SR(stripe),
          font: { sz: 10, bold: true },
          alignment: { horizontal: 'right', vertical: 'center' },
        })

        const ss2Rows = []
        const ss2Styles = []
        const addSH = (label) => {
          ss2Rows.push([label, ''])
          ss2Styles.push(['hdr', ''])
        }
        const addSR = (label, val, stripe) => {
          ss2Rows.push([label, val])
          ss2Styles.push([stripe ? 'stripe' : 'plain', stripe ? 'stripe' : 'plain'])
        }
        const addBlank = () => {
          ss2Rows.push(['', ''])
          ss2Styles.push(['', ''])
        }

        addSH('Pipeline Overview')
        addSR('Total companies', total, false)
        addSR('Enriched', enriched, true)
        addSR('With email pattern', withEmail, false)
        addSR('Exported on', new Date().toLocaleDateString(), true)
        addBlank()
        addSH('Classification Breakdown')
        count(sorted, 'classification').forEach(([k, v], i) => addSR(k, v, i % 2 === 1))
        addBlank()
        addSH('Top Industries')
        count(sorted, 'industry', '(unknown)')
          .slice(0, 10)
          .forEach(([k, v], i) => addSR(k, v, i % 2 === 1))
        addBlank()
        addSH('Pipeline Status')
        count(sorted, 'prospect_status').forEach(([k, v], i) => addSR(k, v, i % 2 === 1))
        addBlank()
        addSH('Top Locations')
        const hqMap = {}
        sorted.forEach((c) => {
          const k = (c.headquarters || '').split(',').pop().trim() || '(unknown)'
          hqMap[k] = (hqMap[k] || 0) + 1
        })
        Object.entries(hqMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([k, v], i) => addSR(k, v, i % 2 === 1))

        const ws2 = XLSX.utils.aoa_to_sheet(ss2Rows)
        ws2['!cols'] = [{ wch: 28 }, { wch: 14 }]
        ss2Rows.forEach((_, ri) => {
          const [ls, vs] = ss2Styles[ri]
          const a1 = XLSX.utils.encode_cell({ r: ri, c: 0 })
          const a2 = XLSX.utils.encode_cell({ r: ri, c: 1 })
          if (!ws2[a1]) ws2[a1] = { t: 's', v: '' }
          if (!ws2[a2]) ws2[a2] = { t: 's', v: '' }
          if (ls === 'hdr') {
            ws2[a1].s = SHDR
            ws2[a2].s = SHDR
          } else if (ls === 'stripe') {
            ws2[a1].s = SR(true)
            ws2[a2].s = SRB(true)
          } else if (ls === 'plain') {
            ws2[a1].s = SR(false)
            ws2[a2].s = SRB(false)
          }
        })

        // ── Write workbook ────────────────────────────────────────────
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws1, 'Companies')
        XLSX.utils.book_append_sheet(wb, ws2, 'Summary')
        XLSX.writeFile(wb, `sonar-companies-${new Date().toISOString().split('T')[0]}.xlsx`)
      })
      .catch((err) => {
        console.error('Excel export failed:', err)
        alert('Export failed: ' + (err?.message || err))
      })
  }

  function isIncomplete(c) {
    return (
      !c.website || !c.linkedin_url || !c.headquarters || !c.size || !c.followers || !c.description
    )
  }

  function handleBulkAutofill(incompleteOnly = false) {
    if (autofill.running) return
    const pool = selectedIds.length
      ? companies.filter((c) => selectedIds.includes(c.id))
      : companies
    const targetIds = incompleteOnly
      ? pool.filter(isIncomplete).map((c) => c.id)
      : pool.map((c) => c.id)
    if (!targetIds.length) return
    runAutofill(targetIds)
  }

  function handleBulkAnalyze() {
    if (analyze.running) return
    const targetIds = selectedIds.length ? selectedIds : companies.map((c) => c.id)
    if (!targetIds.length) return
    runAnalyze(targetIds)
  }

  function handleBulkMapsEnrich() {
    const targetIds = selectedIds.length ? selectedIds : companies.map((c) => c.id)
    if (!targetIds.length) return
    runMapsEnrich(targetIds)
  }

  async function handleBulkDeepEnrich() {
    if (bulkEnriching) return
    const targetIds = selectedIds.length ? selectedIds : companies.map((c) => c.id)
    if (!targetIds.length) return
    setBulkEnriching(true)
    setBulkEnrichProgress({ completed: 0, total: targetIds.length })
    try {
      await bulkDeepEnrichCompanies(targetIds, (_, __, result) => {
        if (result?._progress) setBulkEnrichProgress(result._progress)
        if (result?.id && result?.fields?.length) {
          // Refetch the updated company from server to get fresh enriched data
          getCompanies()
            .then((r) => {
              const fresh = r.data.companies.find((c) => c.id === result.id)
              if (fresh)
                setCompanies((prev) =>
                  prev.map((c) => (c.id === result.id ? { ...c, ...fresh } : c))
                )
            })
            .catch(() => {})
        }
      })
    } catch (e) {
      console.error(e)
    } finally {
      setBulkEnriching(false)
      setBulkEnrichProgress(null)
      fetchCompanies()
    }
  }

  async function handleBulkFullEnrich(incompleteOnly = false) {
    if (autofill.running || analyze.running || bulkEnriching) return
    const pool = selectedIds.length
      ? companies.filter((c) => selectedIds.includes(c.id))
      : companies
    const targetIds = incompleteOnly
      ? pool.filter(isIncomplete).map((c) => c.id)
      : pool.map((c) => c.id)
    if (!targetIds.length) return
    await runAutofill(targetIds)
    await runAnalyze(targetIds)
    if (isEnabled('bulk_deep_enrich')) await handleBulkDeepEnrich()
  }

  async function handleRefreshAlerts() {
    setRefreshingAlerts(true)
    try {
      await refreshCompanyAlerts()
      const r = await getCompanyAlerts()
      setAlerts(r.data.alerts || [])
    } catch {
    } finally {
      setRefreshingAlerts(false)
    }
  }

  async function handleMarkAlertSeen(id) {
    await markCompanyAlertSeen(id).catch(() => {})
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, seen: true } : a)))
  }

  async function handleFindDupes() {
    setFindingDupes(true)
    setShowDupes(true)
    try {
      const r = await findDuplicateCompanies()
      setDupeGroups(r.data.groups || [])
    } catch {
      setDupeGroups([])
    } finally {
      setFindingDupes(false)
    }
  }

  async function handleMerge(keepId, deleteId) {
    await mergeCompanies(keepId, deleteId)
    setCompanies((prev) => prev.filter((c) => c.id !== deleteId))
    setDupeGroups((prev) =>
      (prev || []).map((g) => g.filter((c) => c.id !== deleteId)).filter((g) => g.length > 1)
    )
  }

  async function handleSaveSegment() {
    if (!segmentName.trim()) return
    const filters = { search, classFilter, statusFilter, followerFilter, typeFilter, fillFilter }
    const r = await createCompanySegment(segmentName.trim(), filters)
    setSegments((prev) => [r.data.segment, ...prev])
    setSegmentName('')
    setShowSegmentSave(false)
  }

  function handleLoadSegment(seg) {
    const f = seg.filters || {}
    if (f.search !== undefined) setSearch(f.search)
    if (f.classFilter) setClassFilter(f.classFilter)
    if (f.statusFilter) setStatusFilter(f.statusFilter)
    if (f.followerFilter) setFollowerFilter(f.followerFilter)
    if (f.typeFilter) setTypeFilter(f.typeFilter)
    if (f.fillFilter) setFillFilter(f.fillFilter)
  }

  async function handleDeleteSegment(id) {
    await deleteCompanySegment(id)
    setSegments((prev) => prev.filter((s) => s.id !== id))
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} companies?`)) return
    const ids = [...selectedIds]
    setCompanies((prev) => prev.filter((c) => !ids.includes(c.id)))
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
      <motion.div
        style={{
          ...s.hero,
          position: 'relative',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          overflow: 'hidden',
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div style={{ position: 'relative' }}>
          <p style={s.eyebrow}>Company Intelligence</p>
          <h1 style={s.heroTitle}>
            {filtered.length}
            <span style={s.heroUnit}> companies</span>
          </h1>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#4a7c59' }}>
              {prospectCount} prospects
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--text-muted)',
              }}
            >
              ·
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)' }}>
              {notFitCount} not a fit
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--text-muted)',
              }}
            >
              ·
            </span>
            <button
              onClick={() => setFillFilter((f) => (f === 'incomplete' ? 'all' : 'incomplete'))}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: needsDataCount > 0 ? '#a86448' : '#4a7c59',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                letterSpacing: '0.02em',
              }}
            >
              {needsDataCount > 0 ? `${needsDataCount} need data` : 'all filled ✓'}
            </button>
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View toggle */}
          {isEnabled('kanban_view') && (
            <div
              style={{
                display: 'flex',
                border: '1px solid var(--border)',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setViewMode('list')}
                style={{
                  ...s.heroBtn,
                  border: 'none',
                  borderRadius: 0,
                  background: viewMode === 'list' ? 'var(--text)' : 'transparent',
                  color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                  padding: '6px 12px',
                }}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                style={{
                  ...s.heroBtn,
                  border: 'none',
                  borderRadius: 0,
                  background: viewMode === 'kanban' ? 'var(--text)' : 'transparent',
                  color: viewMode === 'kanban' ? '#fff' : 'var(--text-muted)',
                  padding: '6px 12px',
                }}
              >
                Kanban
              </button>
            </div>
          )}
          {/* Alert bell */}
          {isEnabled('company_alerts') && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowAlerts((v) => !v)}
                style={{ ...s.heroBtn, position: 'relative' }}
              >
                🔔
                {alerts.filter((a) => !a.seen).length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 8,
                      height: 8,
                      background: '#E7000B',
                      borderRadius: '50%',
                      display: 'block',
                    }}
                  />
                )}
              </button>
              {showAlerts && (
                <div
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    width: 340,
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    zIndex: 100,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span
                      style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}
                    >
                      Company Alerts
                    </span>
                    <button
                      onClick={handleRefreshAlerts}
                      disabled={refreshingAlerts}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        padding: '3px 8px',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {refreshingAlerts ? 'Scanning…' : 'Refresh'}
                    </button>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {alerts.length === 0 ? (
                      <p
                        style={{
                          padding: '16px',
                          fontSize: 13,
                          color: 'var(--text-muted)',
                          textAlign: 'center',
                        }}
                      >
                        No alerts yet — click Refresh to scan your Prospects.
                      </p>
                    ) : (
                      alerts.map((a) => {
                        const co = companies.find((c) => c.id === a.company_id)
                        return (
                          <div
                            key={a.id}
                            onClick={() => handleMarkAlertSeen(a.id)}
                            style={{
                              padding: '10px 16px',
                              borderBottom: '1px solid var(--border)',
                              background: a.seen ? 'transparent' : 'rgba(231,0,11,0.03)',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                              {!a.seen && (
                                <span
                                  style={{
                                    width: 6,
                                    height: 6,
                                    background: '#E7000B',
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                    marginTop: 5,
                                  }}
                                />
                              )}
                              <div style={{ flex: 1 }}>
                                <p
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'var(--text)',
                                    margin: 0,
                                  }}
                                >
                                  {co?.name || 'Company'} — {a.type}
                                </p>
                                <a
                                  href={a.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--accent)',
                                    textDecoration: 'none',
                                  }}
                                >
                                  {a.title}
                                </a>
                                {a.body && (
                                  <p
                                    style={{
                                      fontSize: 11,
                                      color: 'var(--text-muted)',
                                      margin: '2px 0 0',
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    {a.body.substring(0, 100)}…
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <button onClick={() => setShowBulkAdd(true)} style={s.heroBtn}>
            Bulk Add
          </button>
          <button onClick={() => setShowSpreadsheet(true)} style={s.heroBtn}>
            Spreadsheet
          </button>
        </div>
      </motion.div>

      <div style={s.container}>
        {/* Action toolbar — left-aligned chips */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginBottom: '10px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button onClick={() => setShowAddModal(true)} style={s.primaryBtn}>
            + Add Company
          </button>
          {isEnabled('find_dms') && (
            <button onClick={() => setShowDMFinder(true)} style={s.secondaryBtn}>
              Find DMs
            </button>
          )}
          <span
            style={{
              width: '1px',
              height: '18px',
              background: 'var(--border)',
              margin: '0 2px',
              flexShrink: 0,
            }}
          />
          {/* ── Bulk Enrich dropdown ── */}
          {(() => {
            const busy = autofill.running || analyze.running || bulkEnriching
            const pool = selectedIds.length
              ? companies.filter((c) => selectedIds.includes(c.id))
              : companies
            const incompleteCount = pool.filter(isIncomplete).length
            const suffix = selectedIds.length ? ` (${selectedIds.length})` : ''
            const label = busy
              ? autofill.running
                ? `Filling… ${autofill.msg?.match(/\d+\/\d+/)?.[0] || ''}`
                : analyze.running
                  ? `Analyzing…`
                  : bulkEnrichProgress
                    ? `Enriching… ${bulkEnrichProgress.completed}/${bulkEnrichProgress.total}`
                    : 'Running…'
              : `↯ Enrich All${suffix}`
            return (
              <div ref={bulkMenuRef} style={{ position: 'relative' }}>
                <button
                  disabled={busy}
                  onClick={() => setShowBulkMenu((v) => !v)}
                  style={{
                    ...s.secondaryBtn,
                    color: busy ? 'var(--text-muted)' : 'var(--accent)',
                    borderColor: showBulkMenu ? 'var(--accent)' : 'rgba(168,100,72,0.3)',
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  {label} {!busy && '▾'}
                </button>
                {showBulkMenu && !busy && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 4,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                      zIndex: 300,
                      minWidth: 200,
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowBulkMenu(false)
                        handleBulkFullEnrich(false)
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '9px 14px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom:
                          incompleteCount > 0 && incompleteCount < pool.length
                            ? '1px solid var(--border)'
                            : 'none',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--accent)',
                        cursor: 'pointer',
                      }}
                    >
                      Enrich All{suffix}
                    </button>
                    {incompleteCount > 0 && incompleteCount < pool.length && (
                      <button
                        onClick={() => {
                          setShowBulkMenu(false)
                          handleBulkFullEnrich(true)
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '9px 14px',
                          background: 'transparent',
                          border: 'none',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        Enrich Incomplete ({incompleteCount})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
          <button
            onClick={runAccuracyCheck}
            disabled={companies.length === 0}
            style={{
              ...s.secondaryBtn,
              color: '#92400e',
              borderColor: 'rgba(217,119,6,0.3)',
              opacity: companies.length === 0 ? 0.4 : 1,
            }}
          >
            ⊘ Check Accuracy
          </button>
          {isEnabled('duplicate_detection') && (
            <button
              onClick={handleFindDupes}
              disabled={findingDupes}
              style={{
                ...s.secondaryBtn,
                color: findingDupes ? 'var(--text-muted)' : '#b45309',
                borderColor: findingDupes ? 'var(--border)' : 'rgba(180,83,9,0.3)',
                opacity: findingDupes ? 0.6 : 1,
              }}
            >
              {findingDupes ? 'Scanning…' : '⊕ Find Dupes'}
            </button>
          )}
          {isEnabled('saved_segments') && (
            <button
              onClick={() => setShowSegmentSave((v) => !v)}
              style={{
                ...s.secondaryBtn,
                color: showSegmentSave ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              ⊞ Save Filter
            </button>
          )}
          <button
            onClick={exportCompaniesCSV}
            disabled={companies.length === 0}
            style={{
              ...s.secondaryBtn,
              color: 'var(--text-muted)',
              opacity: companies.length === 0 ? 0.4 : 1,
            }}
          >
            ↓ Export Excel
          </button>
          <label
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.04em',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            <input
              type="checkbox"
              checked={selectedIds.length === filtered.length && filtered.length > 0}
              onChange={() =>
                setSelectedIds(
                  selectedIds.length === filtered.length ? [] : filtered.map((c) => c.id)
                )
              }
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            Select all
          </label>
        </div>

        {/* Segment save bar */}
        {showSegmentSave && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '8px 0',
              marginBottom: 4,
            }}
          >
            <input
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveSegment()}
              placeholder="Segment name (e.g. SaaS 51-200 US)…"
              style={{
                flex: 1,
                fontSize: 12,
                padding: '6px 10px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
            />
            <button
              onClick={handleSaveSegment}
              disabled={!segmentName.trim()}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                padding: '6px 14px',
                background: 'var(--text)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        )}
        {/* Saved segments chips */}
        {segments.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {segments.map((seg) => (
              <div
                key={seg.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  fontSize: 11,
                  color: 'var(--text)',
                }}
              >
                <button
                  onClick={() => handleLoadSegment(seg)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text)',
                    fontSize: 11,
                    padding: 0,
                  }}
                >
                  {seg.name}
                </button>
                <button
                  onClick={() => handleDeleteSegment(seg.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Duplicates modal */}
        {showDupes && (
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid rgba(180,83,9,0.25)',
              borderRadius: 10,
              padding: '16px 20px',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
                Duplicate Companies
              </span>
              <button
                onClick={() => setShowDupes(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                ✕
              </button>
            </div>
            {findingDupes ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Scanning…
              </p>
            ) : !dupeGroups?.length ? (
              <p style={{ fontSize: 13, color: '#4a7c59' }}>✓ No duplicates found.</p>
            ) : (
              dupeGroups.map((group, gi) => (
                <div
                  key={gi}
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    background: 'rgba(180,83,9,0.04)',
                    border: '1px solid rgba(180,83,9,0.15)',
                    borderRadius: 8,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: '#b45309',
                      margin: '0 0 8px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    DUPLICATE GROUP
                  </p>
                  {group.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '6px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{c.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                          {c.website}
                        </p>
                      </div>
                      {group[0].id !== c.id && (
                        <button
                          onClick={() => handleMerge(group[0].id, c.id)}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            padding: '4px 10px',
                            background: '#b45309',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 5,
                            cursor: 'pointer',
                          }}
                        >
                          Merge into {group[0].name.split(' ')[0]}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* Filters row */}
        <div style={s.filters}>
          <div style={s.searchBox}>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', paddingLeft: '12px' }}>
              ⌕
            </span>
            <input
              type="text"
              placeholder="Search companies…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={s.searchInput}
            />
          </div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            style={s.select}
          >
            <option value="all">All types</option>
            {CLASSIFICATIONS.filter((c) => c !== 'Custom...').map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={s.select}
          >
            <option value="all">All statuses</option>
            {PROSPECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={() => setWatchlistOnly((w) => !w)}
            style={{
              ...s.select,
              background: watchlistOnly ? 'rgba(245,158,11,0.12)' : 'var(--surface)',
              border: `1px solid ${watchlistOnly ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
              color: watchlistOnly ? '#f59e0b' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: watchlistOnly ? 700 : 400,
            }}
          >
            ★ Watchlist{watchlistOnly ? ` (${companies.filter((c) => c.watchlisted).length})` : ''}
          </button>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={s.select}
          >
            <option value="all">All · Product / Service</option>
            <option value="Product">Product</option>
            <option value="Service">Service</option>
            <option value="Hybrid">Hybrid</option>
          </select>
          <select
            value={followerFilter}
            onChange={(e) => setFollowerFilter(e.target.value)}
            style={s.select}
          >
            <option value="all">All followers</option>
            <option value="1000">1K+</option>
            <option value="5000">5K+</option>
            <option value="10000">10K+</option>
            <option value="50000">50K+</option>
            <option value="100000">100K+</option>
          </select>
          <select
            value={fillFilter}
            onChange={(e) => setFillFilter(e.target.value)}
            style={{
              ...s.select,
              color:
                fillFilter === 'incomplete'
                  ? 'var(--accent)'
                  : fillFilter === 'complete'
                    ? '#4a7c59'
                    : fillFilter === 'suspicious'
                      ? '#92400e'
                      : fillFilter === 'accurate'
                        ? '#4a7c59'
                        : 'var(--text-secondary)',
              borderColor:
                fillFilter !== 'all'
                  ? fillFilter === 'incomplete'
                    ? 'rgba(168,100,72,0.35)'
                    : fillFilter === 'suspicious'
                      ? 'rgba(217,119,6,0.35)'
                      : 'rgba(74,124,89,0.35)'
                  : 'var(--border)',
            }}
          >
            <option value="all">All · Data</option>
            <option value="complete">✓ Complete</option>
            <option value="incomplete">⚠ Needs data</option>
            <option value="accurate">✓ Accurate</option>
            <option value="suspicious">⊘ Suspicious</option>
          </select>
        </div>

        {autofill.msg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              background: autofill.running ? 'rgba(168,100,72,0.05)' : 'rgba(74,124,89,0.06)',
              border: `1px solid ${autofill.running ? 'rgba(168,100,72,0.2)' : 'rgba(74,124,89,0.2)'}`,
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            {autofill.running && (
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  border: '2px solid var(--accent)',
                  borderTopColor: 'transparent',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.02em',
                color: autofill.running ? 'var(--accent)' : '#4a7c59',
                fontWeight: '500',
              }}
            >
              {autofill.msg}
            </span>
          </div>
        )}
        {analyze.msg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              background: analyze.running ? 'rgba(123,107,174,0.05)' : 'rgba(74,124,89,0.06)',
              border: `1px solid ${analyze.running ? 'rgba(123,107,174,0.2)' : 'rgba(74,124,89,0.2)'}`,
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            {analyze.running && (
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  border: '2px solid #7b6bae',
                  borderTopColor: 'transparent',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.02em',
                color: analyze.running ? '#7b6bae' : '#4a7c59',
                fontWeight: '500',
              }}
            >
              {analyze.msg}
            </span>
          </div>
        )}
        {maps.msg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              background: maps.running ? 'rgba(74,124,89,0.05)' : 'rgba(74,124,89,0.06)',
              border: `1px solid rgba(74,124,89,0.2)`,
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            {maps.running && (
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  border: '2px solid #4a7c59',
                  borderTopColor: 'transparent',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.02em',
                color: '#4a7c59',
                fontWeight: '500',
              }}
            >
              {maps.msg}
            </span>
          </div>
        )}

        {activeJob && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              background: 'rgba(231,0,11,0.04)',
              border: '1px solid rgba(231,0,11,0.2)',
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            {(activeJob.status === 'running' || activeJob.status === 'queued') && (
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  border: '2px solid var(--accent)',
                  borderTopColor: 'transparent',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.02em',
                color:
                  activeJob.status === 'completed'
                    ? '#4a7c59'
                    : activeJob.status === 'failed'
                      ? 'var(--accent)'
                      : 'var(--accent)',
                fontWeight: '500',
              }}
            >
              {activeJob.status === 'queued' &&
                `Background job queued — ${activeJob.type.replace(/_/g, ' ')} (${activeJob.total} companies)`}
              {activeJob.status === 'running' &&
                `Background job running — ${activeJob.completed ?? 0}/${activeJob.total} ${activeJob.type.replace(/_/g, ' ')}`}
              {activeJob.status === 'completed' &&
                `Background job done — ${activeJob.completed}/${activeJob.total} ${activeJob.type.replace(/_/g, ' ')}`}
              {activeJob.status === 'failed' &&
                `Background job failed — ${activeJob.error_message || activeJob.type}`}
            </span>
            <button
              onClick={() => {
                setDismissedJobId(activeJob.id)
                setActiveJob(null)
              }}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 14,
                lineHeight: 1,
                padding: '0 2px',
                flexShrink: 0,
              }}
            >
              ×
            </button>
            {activeJob.status === 'running' && activeJob.total > 0 && (
              <div
                style={{
                  flex: 1,
                  height: '4px',
                  background: 'rgba(231,0,11,0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round((activeJob.completed / activeJob.total) * 100)}%`,
                    background: 'var(--accent)',
                    borderRadius: '2px',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {Object.keys(accuracyMap).length > 0 &&
          (() => {
            const vals = Object.values(accuracyMap)
            const suspicious = vals.filter(
              (a) => a.confidence === 'low' || a.confidence === 'medium'
            ).length
            const accurate = vals.filter((a) => a.confidence === 'high').length
            const unverifiable = vals.filter((a) => a.confidence === 'none').length
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  background: 'rgba(217,119,6,0.05)',
                  border: '1px solid rgba(217,119,6,0.2)',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  onClick={() => setFillFilter('accurate')}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: '#4a7c59',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    letterSpacing: '0.02em',
                    textDecoration: 'underline',
                  }}
                >
                  ✓ {accurate} accurate
                </button>
                {suspicious > 0 && (
                  <>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      ·
                    </span>
                    <button
                      onClick={() => setFillFilter('suspicious')}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: '#92400e',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        letterSpacing: '0.02em',
                        textDecoration: 'underline',
                      }}
                    >
                      ⊘ {suspicious} suspicious
                    </button>
                  </>
                )}
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}
                >
                  ·
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}
                >
                  {unverifiable} unverifiable
                </span>
                <button
                  onClick={() => {
                    setAccuracyMap({})
                    setFillFilter((f) => (f === 'suspicious' || f === 'accurate' ? 'all' : f))
                  }}
                  style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    padding: '2px 8px',
                    letterSpacing: '0.04em',
                  }}
                >
                  ✕ clear
                </button>
              </div>
            )
          })()}

        {selectedIds.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              marginBottom: '16px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.06em',
                color: 'var(--text)',
                fontWeight: '600',
              }}
            >
              {selectedIds.length} selected
            </span>
            <button
              onClick={handleBulkDelete}
              style={{
                padding: '5px 12px',
                background: 'var(--red)',
                border: 'none',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: '600',
                letterSpacing: '0.04em',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
            <button
              onClick={() => setShowDMFinder(true)}
              style={{
                padding: '5px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.04em',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              Find DMs
            </button>
            <button
              onClick={() => setSelectedIds([])}
              style={{
                padding: '5px 10px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>
        )}

        {loading ? (
          <div style={s.grid}>
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={s.emptyState}>
            <p style={s.emptyTitle}>No companies yet</p>
            <p style={s.emptyText}>
              Use the extension on LinkedIn company search to extract companies, or click{' '}
              <strong>+ Add Company</strong> above.
            </p>
          </div>
        ) : viewMode === 'kanban' ? (
          /* ── Kanban view ── */
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
            {PROSPECT_STATUSES.map((status) => {
              const col = filtered.filter((c) => (c.prospect_status || 'To Review') === status)
              return (
                <div
                  key={status}
                  style={{
                    minWidth: 260,
                    flexShrink: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text)',
                      }}
                    >
                      {status}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        background: 'var(--surface)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {col.length}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: 10,
                      maxHeight: '70vh',
                      overflowY: 'auto',
                    }}
                  >
                    {col.map((company) => {
                      const dom = company.website
                        ? company.website.replace(/^https?:\/\//, '').split('/')[0]
                        : null
                      const clr = classificationColors[company.classification] || '#a1a1a1'
                      return (
                        <div
                          key={company.id}
                          style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            borderLeft: `3px solid ${clr}`,
                            borderRadius: 8,
                            padding: '10px 12px',
                            cursor: 'default',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginBottom: 4,
                            }}
                          >
                            <CompanyLogo
                              domain={dom}
                              altDomain={
                                company.linkedin_website
                                  ? company.linkedin_website
                                      .replace(/^https?:\/\//, '')
                                      .split('/')[0]
                                  : null
                              }
                              name={company.name}
                              size={28}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p
                                style={{
                                  fontFamily: 'var(--font-display)',
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: 'var(--text)',
                                  margin: 0,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {company.name}
                              </p>
                              {dom && (
                                <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>
                                  {dom}
                                </p>
                              )}
                            </div>
                          </div>
                          {company.industry && (
                            <p
                              style={{
                                fontSize: 10,
                                color: 'var(--text-muted)',
                                margin: '0 0 6px',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {company.industry}
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {PROSPECT_STATUSES.filter((s) => s !== status).map((s) => (
                              <button
                                key={s}
                                onClick={() => handleUpdate(company.id, { prospect_status: s })}
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 9,
                                  padding: '2px 7px',
                                  border: '1px solid var(--border)',
                                  borderRadius: 4,
                                  background: 'transparent',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                }}
                              >
                                → {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                    {col.length === 0 && (
                      <p
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          textAlign: 'center',
                          padding: '20px 0',
                          fontStyle: 'italic',
                        }}
                      >
                        Empty
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── List view ── */
          <motion.div
            key={safePage}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={s.grid}
          >
            {paged.map((company, i) => (
              <React.Fragment key={company.id}>
                {i > 0 && (
                  <div
                    style={{ height: '1px', background: 'var(--border-strong)', margin: '8px 0' }}
                  />
                )}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: Math.min(i * 0.05, 0.6),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%' }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '28px',
                      fontWeight: '700',
                      color: 'var(--border-strong)',
                      lineHeight: 1,
                      paddingTop: '22px',
                      minWidth: '36px',
                      textAlign: 'right',
                      letterSpacing: '-0.03em',
                      userSelect: 'none',
                    }}
                  >
                    {(safePage - 1) * PAGE_SIZE + i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <CompanyCard
                      company={company}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onViewLeads={setSelectedCompany}
                      selected={selectedIds.includes(company.id)}
                      onToggle={(id) =>
                        setSelectedIds((prev) =>
                          prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                        )
                      }
                      accuracy={accuracyMap[company.id]}
                      isEnabled={isEnabled}
                      onRefresh={fetchCompanies}
                    />
                  </div>
                </motion.div>
              </React.Fragment>
            ))}
            {/* ── Pagination controls ── */}
            {totalPages > 1 &&
              (() => {
                // Build windowed page list with ellipsis
                const WINDOW = 2
                const pages = []
                for (let p = 1; p <= totalPages; p++) {
                  if (
                    p === 1 ||
                    p === totalPages ||
                    (p >= safePage - WINDOW && p <= safePage + WINDOW)
                  ) {
                    pages.push(p)
                  } else if (pages[pages.length - 1] !== '…') {
                    pages.push('…')
                  }
                }
                const btnBase = {
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  height: 32,
                  minWidth: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  padding: '0 10px',
                }
                return (
                  <motion.div
                    key="pagination"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '24px 0 8px',
                      width: '100%',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      style={{
                        ...btnBase,
                        background: 'transparent',
                        color: safePage <= 1 ? 'var(--text-muted)' : 'var(--text)',
                        opacity: safePage <= 1 ? 0.35 : 1,
                        cursor: safePage <= 1 ? 'default' : 'pointer',
                      }}
                    >
                      ← Prev
                    </button>
                    {pages.map((p, i) =>
                      p === '…' ? (
                        <span
                          key={`ellipsis-${i}`}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            padding: '0 4px',
                            userSelect: 'none',
                          }}
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          style={{
                            ...btnBase,
                            background: p === safePage ? 'var(--accent)' : 'transparent',
                            borderColor: p === safePage ? 'var(--accent)' : 'var(--border)',
                            color: p === safePage ? '#fff' : 'var(--text-muted)',
                            fontWeight: p === safePage ? 700 : 400,
                            transform: p === safePage ? 'scale(1.05)' : 'scale(1)',
                          }}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      style={{
                        ...btnBase,
                        background: 'transparent',
                        color: safePage >= totalPages ? 'var(--text-muted)' : 'var(--text)',
                        opacity: safePage >= totalPages ? 0.35 : 1,
                        cursor: safePage >= totalPages ? 'default' : 'pointer',
                      }}
                    >
                      Next →
                    </button>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        marginLeft: 8,
                      }}
                    >
                      {safePage} / {totalPages}
                    </span>
                  </motion.div>
                )
              })()}
          </motion.div>
        )}
      </div>

      {showAddModal && (
        <AddCompanyModal
          onClose={() => setShowAddModal(false)}
          onRefresh={fetchCompanies}
          onAdded={(company) => setCompanies((prev) => [company, ...prev])}
        />
      )}
      {showBulkAdd && (
        <BulkAddModal
          onClose={() => setShowBulkAdd(false)}
          onRefresh={fetchCompanies}
          initialTab={typeof showBulkAdd === 'string' ? showBulkAdd : 'manual'}
        />
      )}
      {showSpreadsheet && (
        <CompaniesSpreadsheet
          companies={companies}
          onClose={() => setShowSpreadsheet(false)}
          onRefresh={fetchCompanies}
        />
      )}
      {selectedCompany && (
        <LeadsModal company={selectedCompany} onClose={() => setSelectedCompany(null)} />
      )}
      {showDMFinder && (
        <DMFinder
          companies={
            selectedIds.length > 0 ? companies.filter((c) => selectedIds.includes(c.id)) : filtered
          }
          onClose={() => setShowDMFinder(false)}
        />
      )}
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────

const s = {
  page: { minHeight: '100vh', background: 'var(--surface-raised)' },
  hero: {
    padding: '64px 48px 40px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  eyebrow: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '0.14em',
    color: 'var(--text-muted)',
    marginBottom: '14px',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(64px, 9vw, 112px)',
    fontWeight: '900',
    color: 'var(--text)',
    letterSpacing: '-0.05em',
    lineHeight: 1,
    marginBottom: '0',
  },
  heroUnit: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(32px, 4.5vw, 56px)',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '-0.03em',
  },
  heroStats: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  heroBtn: {
    padding: '8px 14px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    fontSize: '10px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
    letterSpacing: '0.04em',
  },
  container: { padding: '20px 48px' },
  filters: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    flex: 1,
    minWidth: '200px',
  },
  searchInput: {
    flex: 1,
    padding: '9px 12px',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: '12px',
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.02em',
  },
  select: {
    padding: '8px 12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    fontSize: '10px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    outline: 'none',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    letterSpacing: '0.04em',
  },
  primaryBtn: {
    padding: '9px 16px',
    background: 'var(--text)',
    border: 'none',
    borderRadius: '7px',
    fontSize: '10px',
    fontWeight: '600',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
    letterSpacing: '0.04em',
  },
  secondaryBtn: {
    padding: '9px 16px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    fontSize: '10px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
    letterSpacing: '0.04em',
  },
  grid: { display: 'flex', flexDirection: 'column', gap: '16px' },
  empty: { padding: '40px 0', fontSize: '13px', color: 'var(--text-muted)' },
  emptyState: { padding: '80px 0', textAlign: 'center' },
  emptyTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '24px',
    fontWeight: '400',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
    letterSpacing: '-0.03em',
  },
  emptyText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-muted)',
    lineHeight: 1.7,
  },
}

const card = {
  wrapper: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '14px 16px 10px',
    gap: '10px',
  },
  headerLeft: { flex: 1 },
  headerRight: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  name: {
    fontFamily: 'var(--font-display)',
    fontSize: '18px',
    fontWeight: '400',
    color: 'var(--text)',
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
  },
  industry: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-muted)',
    marginTop: '4px',
    letterSpacing: '0.02em',
  },
  select: {
    fontFamily: 'var(--font-mono)',
    padding: '5px 9px',
    background: 'var(--surface)',
    border: '1px solid',
    borderRadius: '5px',
    fontSize: '10px',
    fontWeight: '600',
    outline: 'none',
    cursor: 'pointer',
    letterSpacing: '0.04em',
  },
  editCardBtn: {
    fontFamily: 'var(--font-mono)',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '5px',
    color: 'var(--text-muted)',
    fontSize: '11px',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    padding: '5px 9px',
    lineHeight: 1,
  },
  deleteBtn: {
    fontFamily: 'var(--font-mono)',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '4px',
    opacity: 0.5,
  },
  editPanel: {
    padding: '14px 16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  editGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' },
  editLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: '4px',
  },
  editInput: {
    width: '100%',
    padding: '7px 10px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '12px',
    color: 'var(--text)',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  editFooter: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  editCancelBtn: {
    fontFamily: 'var(--font-mono)',
    padding: '7px 14px',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '10px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  editSaveBtn: {
    fontFamily: 'var(--font-mono)',
    padding: '7px 16px',
    background: 'var(--text)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '10px',
    fontWeight: '600',
    color: '#FFFFFF',
    cursor: 'pointer',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    borderTop: '1px solid rgba(196,193,189,0.5)',
    borderBottom: '1px solid rgba(196,193,189,0.5)',
    background: 'rgba(196,193,189,0.35)',
    gap: '1px',
  },
  infoItem: { padding: '9px 14px', background: 'var(--bg)' },
  infoLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '8px',
    fontWeight: '600',
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
    marginBottom: '3px',
    textTransform: 'uppercase',
  },
  infoValue: { fontSize: '12px', color: 'var(--text)', fontWeight: '400', margin: 0 },
  fieldLabel: { fontSize: 12, color: 'var(--text-muted)', margin: '0 0 4px', fontWeight: 400 },
  fieldValue: { fontSize: 15, color: 'var(--text)', fontWeight: 500, margin: 0, lineHeight: 1.3 },
  complianceSection: { padding: '8px 14px', borderBottom: '1px solid rgba(196,193,189,0.4)' },
  complianceBadge: {
    padding: '2px 7px',
    border: '1px solid rgba(74,124,89,0.3)',
    borderRadius: '3px',
    fontSize: '9px',
    fontWeight: '600',
    color: '#4a7c59',
    letterSpacing: '0.5px',
    background: 'rgba(74,124,89,0.07)',
    fontFamily: 'var(--font-mono)',
  },
  description: {
    padding: '8px 14px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    borderBottom: '1px solid rgba(196,193,189,0.4)',
  },
  notesSection: { padding: '8px 14px', borderBottom: '1px solid rgba(196,193,189,0.4)', flex: 1 },
  notesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '5px',
  },
  editBtn: {
    fontFamily: 'var(--font-mono)',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text-muted)',
    fontSize: '9px',
    fontWeight: '500',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    padding: '2px 7px',
  },
  notesText: { fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 },
  textarea: {
    width: '100%',
    padding: '7px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '11px',
    color: 'var(--text)',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: 'auto',
  },
  statusSelect: {
    fontFamily: 'var(--font-mono)',
    padding: '5px 9px',
    background: 'var(--surface)',
    border: '1px solid',
    borderRadius: '5px',
    fontSize: '10px',
    fontWeight: '600',
    outline: 'none',
    cursor: 'pointer',
    letterSpacing: '0.04em',
  },
  actionBtn: {
    fontFamily: 'var(--font-mono)',
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '5px',
    fontSize: '10px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },
  linkedinBtn: {
    fontFamily: 'var(--font-mono)',
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '5px',
    fontSize: '10px',
    fontWeight: '500',
    color: 'var(--text-muted)',
    textDecoration: 'none',
    letterSpacing: '0.04em',
  },
  primaryBtn: {
    fontFamily: 'var(--font-mono)',
    padding: '8px 18px',
    background: 'var(--text)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#FFFFFF',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },
}

const modal = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(29,27,27,0.4)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
  },
  box: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '800px',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px 28px',
    borderBottom: '1px solid var(--border)',
  },
  eyebrow: {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
    marginBottom: '5px',
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '20px',
    fontWeight: '400',
    letterSpacing: '-0.04em',
    color: 'var(--text)',
  },
  closeBtn: {
    padding: '7px 14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    fontSize: '10px',
    letterSpacing: '0.04em',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
  },
  empty: { padding: '32px 28px', fontSize: '13px', color: 'var(--text-muted)' },
  emptyState: { padding: '48px 28px', textAlign: 'center' },
  emptyTitle: {
    fontSize: '15px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
  },
  emptyText: { fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 },
  leadsGrid: {
    padding: '20px 28px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '10px',
    overflowY: 'auto',
  },
  leadCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  leadName: { fontSize: '13px', fontWeight: '600', color: 'var(--text)' },
  leadTitle: { fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 },
  leadLocation: { fontSize: '11px', color: 'var(--text-muted)' },
  leadLink: {
    fontSize: '11px',
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: '500',
    marginTop: '4px',
  },
}
