import React, { useState, useEffect } from 'react'
import { getLeads } from '../services/api'
import { getPersonas, createPersona, deletePersona } from '../services/api'
import Navbar from '../components/Navbar'

const ROLES = [
  'CTO',
  'CEO',
  'VP Engineering',
  'VP Sales',
  'Head of Security',
  'CISO',
  'Product Manager',
  'Engineering Manager',
  'Founder',
  'Co-Founder',
  'Director of Engineering',
  'DevOps Lead',
]
const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
const STATUSES = ['new', 'contacted', 'qualified', 'disqualified']
const LOCATIONS = [
  'India',
  'United States',
  'United Kingdom',
  'Singapore',
  'Australia',
  'Canada',
  'Germany',
  'UAE',
]

const statusStyles = {
  new: { color: '#4a7c59', background: 'rgba(74,124,89,0.10)', border: 'rgba(74,124,89,0.22)' },
  contacted: {
    color: '#a86448',
    background: 'rgba(168,100,72,0.10)',
    border: 'rgba(168,100,72,0.22)',
  },
  qualified: {
    color: '#5b8db8',
    background: 'rgba(91,141,184,0.10)',
    border: 'rgba(91,141,184,0.22)',
  },
  disqualified: {
    color: '#a1a1a1',
    background: 'rgba(161,161,161,0.10)',
    border: 'rgba(161,161,161,0.22)',
  },
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        background: active ? 'var(--accent)' : 'var(--surface)',
        border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '500',
        color: active ? 'var(--bg)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

function LeadCard({ lead }) {
  const st = statusStyles[lead.status] || statusStyles.new
  return (
    <div style={lc.card}>
      <div style={lc.top}>
        <div>
          <p style={lc.name}>{lead.name || '—'}</p>
          <p style={lc.title}>{lead.title || '—'}</p>
        </div>
        <span
          style={{
            fontSize: '10px',
            fontWeight: '500',
            padding: '2px 8px',
            borderRadius: '4px',
            color: st.color,
            background: st.background,
            border: `1px solid ${st.border}`,
            whiteSpace: 'nowrap',
          }}
        >
          {lead.status || 'new'}
        </span>
      </div>
      <div style={lc.bottom}>
        <span style={lc.meta}>{lead.company || '—'}</span>
        <span style={lc.dot} />
        <span style={lc.meta}>{lead.location || '—'}</span>
      </div>
      {lead.profile_url && (
        <a href={lead.profile_url} style={lc.link}>
          View profile →
        </a>
      )}
    </div>
  )
}

export default function Persona() {
  const [leads, setLeads] = useState([])
  const [personas, setPersonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    roles: [],
    sizes: [],
    statuses: [],
    locations: [],
    keyword: '',
  })
  const [personaName, setPersonaName] = useState('')
  const [savingPersona, setSavingPersona] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [activePersona, setActivePersona] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [lr, pr] = await Promise.all([getLeads(), getPersonas()])
        setLeads(lr.data.leads)
        setPersonas(pr.data.personas)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function toggleFilter(key, value) {
    setFilters((prev) => {
      const arr = prev[key]
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      }
    })
    setActivePersona(null)
  }

  function clearFilters() {
    setFilters({ roles: [], sizes: [], statuses: [], locations: [], keyword: '' })
    setActivePersona(null)
  }

  function applyPersona(persona) {
    setFilters({
      ...{ roles: [], sizes: [], statuses: [], locations: [], keyword: '' },
      ...persona.filters,
    })
    setActivePersona(persona.id)
  }

  async function saveAsPersona() {
    if (!personaName.trim()) return
    setSavingPersona(true)
    try {
      const res = await createPersona({ name: personaName, filters })
      setPersonas((prev) => [res.data.persona, ...prev])
      setPersonaName('')
      setShowSaveForm(false)
      setActivePersona(res.data.persona.id)
    } catch (e) {
      console.error(e)
    } finally {
      setSavingPersona(false)
    }
  }

  async function handleDeletePersona(id) {
    try {
      await deletePersona(id)
      setPersonas((prev) => prev.filter((p) => p.id !== id))
      if (activePersona === id) setActivePersona(null)
    } catch (e) {
      console.error(e)
    }
  }

  const filtered = leads.filter((lead) => {
    const kw = filters.keyword.toLowerCase()
    const matchKw =
      kw === '' ||
      [lead.name, lead.title, lead.company, lead.location].join(' ').toLowerCase().includes(kw)
    const matchRole =
      filters.roles.length === 0 ||
      filters.roles.some((r) => (lead.title || '').toLowerCase().includes(r.toLowerCase()))
    const matchStatus = filters.statuses.length === 0 || filters.statuses.includes(lead.status)
    const matchLocation =
      filters.locations.length === 0 ||
      filters.locations.some((l) => (lead.location || '').toLowerCase().includes(l.toLowerCase()))
    return matchKw && matchRole && matchStatus && matchLocation
  })

  const activeFilterCount =
    filters.roles.length +
    filters.sizes.length +
    filters.statuses.length +
    filters.locations.length +
    (filters.keyword ? 1 : 0)

  return (
    <div style={s.page}>
      <Navbar />

      <div style={s.hero}>
        <div>
          <p style={s.eyebrow}>Persona Engine</p>
          <h1 style={s.heroTitle}>
            {filtered.length}
            <span style={s.heroUnit}> matches</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {activeFilterCount > 0 && (
            <button style={s.clearBtn} onClick={clearFilters}>
              Clear filters ({activeFilterCount})
            </button>
          )}
          <button style={s.saveBtn} onClick={() => setShowSaveForm(!showSaveForm)}>
            {showSaveForm ? 'Cancel' : 'Save as Persona'}
          </button>
        </div>
      </div>

      <div style={s.layout}>
        {/* Left — filters */}
        <div style={s.sidebar}>
          {personas.length > 0 && (
            <div style={s.filterSection}>
              <p style={s.filterLabel}>Saved Personas</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {personas.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      ...s.personaRow,
                      background:
                        activePersona === p.id ? 'var(--surface-raised)' : 'var(--surface)',
                      borderColor:
                        activePersona === p.id ? 'var(--border-strong)' : 'var(--border)',
                    }}
                  >
                    <button style={s.personaBtn} onClick={() => applyPersona(p)}>
                      {p.name}
                    </button>
                    <button style={s.personaDelete} onClick={() => handleDeletePersona(p.id)}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={s.filterSection}>
            <p style={s.filterLabel}>Keyword</p>
            <input
              type="text"
              placeholder="Search name, title, company..."
              value={filters.keyword}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, keyword: e.target.value }))
                setActivePersona(null)
              }}
              style={s.filterInput}
            />
          </div>

          <div style={s.filterSection}>
            <p style={s.filterLabel}>Target Roles</p>
            <div style={s.chips}>
              {ROLES.map((r) => (
                <FilterChip
                  key={r}
                  label={r}
                  active={filters.roles.includes(r)}
                  onClick={() => toggleFilter('roles', r)}
                />
              ))}
            </div>
          </div>

          <div style={s.filterSection}>
            <p style={s.filterLabel}>Status</p>
            <div style={s.chips}>
              {STATUSES.map((st) => (
                <FilterChip
                  key={st}
                  label={st}
                  active={filters.statuses.includes(st)}
                  onClick={() => toggleFilter('statuses', st)}
                />
              ))}
            </div>
          </div>

          <div style={s.filterSection}>
            <p style={s.filterLabel}>Location</p>
            <div style={s.chips}>
              {LOCATIONS.map((l) => (
                <FilterChip
                  key={l}
                  label={l}
                  active={filters.locations.includes(l)}
                  onClick={() => toggleFilter('locations', l)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right — results */}
        <div style={s.results}>
          {showSaveForm && (
            <div style={s.saveForm}>
              <p style={s.saveFormLabel}>Save current filters as Persona</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="e.g. SaaS CTOs India"
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  style={{ ...s.filterInput, flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveAsPersona()
                  }}
                />
                <button style={s.saveBtn} onClick={saveAsPersona} disabled={savingPersona}>
                  {savingPersona ? 'Saving...' : 'Save →'}
                </button>
              </div>
            </div>
          )}

          <div style={s.resultsHeader}>
            <p style={s.resultsCount}>
              {filtered.length} target{filtered.length !== 1 ? 's' : ''} matched
              {activePersona && (
                <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontWeight: '400' }}>
                  via {personas.find((p) => p.id === activePersona)?.name}
                </span>
              )}
            </p>
          </div>

          {loading ? (
            <p style={s.empty}>Loading leads...</p>
          ) : filtered.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>No matches found</p>
              <p style={s.emptyText}>
                Try adjusting your filters or extract more leads from LinkedIn.
              </p>
            </div>
          ) : (
            <div style={s.grid}>
              {filtered.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: '48px 32px 32px',
    borderBottom: '1px solid var(--border)',
  },
  eyebrow: {
    fontSize: '11px',
    fontWeight: '500',
    letterSpacing: '2px',
    color: 'var(--text-muted)',
    marginBottom: '12px',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(40px, 5vw, 64px)',
    fontWeight: '400',
    letterSpacing: '-1.5px',
    color: 'var(--text)',
    lineHeight: 1,
  },
  heroUnit: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(20px, 2.5vw, 32px)',
    fontWeight: '400',
    color: 'var(--text-muted)',
    letterSpacing: '-0.5px',
  },
  clearBtn: {
    padding: '9px 16px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '7px',
    fontSize: '12px',
    fontWeight: '400',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    padding: '9px 18px',
    background: 'var(--text)',
    border: 'none',
    borderRadius: '7px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--bg)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  layout: { display: 'flex', minHeight: 'calc(100vh - 200px)' },
  sidebar: {
    width: '280px',
    flexShrink: 0,
    borderRight: '1px solid var(--border)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    overflowY: 'auto',
  },
  filterSection: {},
  filterLabel: {
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '2px',
    color: 'var(--text-muted)',
    marginBottom: '10px',
    textTransform: 'uppercase',
  },
  filterInput: {
    width: '100%',
    padding: '9px 12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--text)',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  personaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    border: '1px solid',
    borderRadius: '8px',
    transition: 'all 0.15s',
  },
  personaBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    flex: 1,
  },
  personaDelete: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  results: { flex: 1, padding: '24px 32px', overflowY: 'auto' },
  saveForm: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '18px',
    marginBottom: '24px',
  },
  saveFormLabel: {
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '1.5px',
    color: 'var(--text-muted)',
    marginBottom: '12px',
    textTransform: 'uppercase',
  },
  resultsHeader: { marginBottom: '20px' },
  resultsCount: { fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '14px',
  },
  empty: { fontSize: '13px', color: 'var(--text-muted)', padding: '40px 0' },
  emptyState: { padding: '80px 0', textAlign: 'center' },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
  },
  emptyText: { fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 },
}

const lc = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    transition: 'border-color 0.15s',
  },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  name: { fontSize: '13px', fontWeight: '500', color: 'var(--text)', marginBottom: '3px' },
  title: { fontSize: '12px', color: 'var(--text-secondary)' },
  bottom: { display: 'flex', alignItems: 'center', gap: '8px' },
  meta: { fontSize: '11px', color: 'var(--text-muted)' },
  dot: {
    width: '3px',
    height: '3px',
    borderRadius: '50%',
    background: 'var(--border-strong)',
    flexShrink: 0,
  },
  link: {
    fontSize: '11px',
    fontWeight: '500',
    color: 'var(--accent)',
    textDecoration: 'none',
    alignSelf: 'flex-start',
  },
}
