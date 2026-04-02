import React, { useState, useEffect } from 'react'
import { getLeads } from '../services/api'
import { getPersonas, createPersona, deletePersona } from '../services/api'
import Navbar from '../components/Navbar'

const ROLES = ['CTO', 'CEO', 'VP Engineering', 'VP Sales', 'Head of Security', 'CISO', 'Product Manager', 'Engineering Manager', 'Founder', 'Co-Founder', 'Director of Engineering', 'DevOps Lead']
const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
const STATUSES = ['new', 'contacted', 'qualified', 'disqualified']
const LOCATIONS = ['India', 'United States', 'United Kingdom', 'Singapore', 'Australia', 'Canada', 'Germany', 'UAE']

function FilterChip({ label, active, onClick }) {
  return React.createElement(
    'button',
    {
      onClick,
      style: {
        padding: '6px 14px',
        background: active ? 'var(--white)' : 'transparent',
        border: '1px solid ' + (active ? 'var(--white)' : 'var(--gray-2)'),
        borderRadius: '2px',
        fontSize: '11px',
        fontWeight: '600',
        color: active ? 'var(--black)' : 'var(--gray-4)',
        cursor: 'none',
        letterSpacing: '0.5px',
        transition: 'all 0.15s',
        fontFamily: 'inherit',
      },
      'data-hover': 'true',
    },
    label
  )
}

function LeadCard({ lead }) {
  const statusColors = {
    new: 'var(--white)',
    contacted: 'var(--amber)',
    qualified: 'var(--green)',
    disqualified: 'var(--gray-4)',
  }
  const color = statusColors[lead.status] || 'var(--white)'

  return React.createElement(
    'div',
    { style: lc.card },
    React.createElement(
      'div',
      { style: lc.top },
      React.createElement(
        'div',
        null,
        React.createElement('p', { style: lc.name }, lead.name || '—'),
        React.createElement('p', { style: lc.title }, lead.title || '—')
      ),
      React.createElement(
        'span',
        {
          style: {
            fontSize: '9px', fontWeight: '700', letterSpacing: '1px',
            padding: '2px 8px', border: '1px solid ' + color,
            borderRadius: '2px', color,
          }
        },
        (lead.status || 'new').toUpperCase()
      )
    ),
    React.createElement(
      'div',
      { style: lc.bottom },
      React.createElement('span', { style: lc.meta }, lead.company || '—'),
      React.createElement('span', { style: lc.dot }),
      React.createElement('span', { style: lc.meta }, lead.location || '—')
    ),
    lead.profile_url && React.createElement(
      'a',
      { href: lead.profile_url, style: lc.link },
      'VIEW PROFILE →'
    )
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
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  function toggleFilter(key, value) {
    setFilters((prev) => {
      const arr = prev[key]
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      }
    })
    setActivePersona(null)
  }

  function clearFilters() {
    setFilters({ roles: [], sizes: [], statuses: [], locations: [], keyword: '' })
    setActivePersona(null)
  }

  function applyPersona(persona) {
    setFilters({ ...{ roles: [], sizes: [], statuses: [], locations: [], keyword: '' }, ...persona.filters })
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
    } catch (e) { console.error(e) }
    finally { setSavingPersona(false) }
  }

  async function handleDeletePersona(id) {
    try {
      await deletePersona(id)
      setPersonas((prev) => prev.filter((p) => p.id !== id))
      if (activePersona === id) setActivePersona(null)
    } catch (e) { console.error(e) }
  }

  const filtered = leads.filter((lead) => {
    const kw = filters.keyword.toLowerCase()
    const matchKw = kw === '' || [lead.name, lead.title, lead.company, lead.location].join(' ').toLowerCase().includes(kw)
    const matchRole = filters.roles.length === 0 || filters.roles.some((r) => (lead.title || '').toLowerCase().includes(r.toLowerCase()))
    const matchStatus = filters.statuses.length === 0 || filters.statuses.includes(lead.status)
    const matchLocation = filters.locations.length === 0 || filters.locations.some((l) => (lead.location || '').toLowerCase().includes(l.toLowerCase()))
    return matchKw && matchRole && matchStatus && matchLocation
  })

  const activeFilterCount = filters.roles.length + filters.sizes.length + filters.statuses.length + filters.locations.length + (filters.keyword ? 1 : 0)

  return (
    <div style={s.page}>
      <Navbar />

      <div style={s.hero}>
        <div>
          <p style={s.eyebrow}>PERSONA ENGINE</p>
          <h1 style={s.heroTitle}>
            {filtered.length}
            <span style={s.heroUnit}> matches</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {activeFilterCount > 0 && (
            <button style={s.clearBtn} onClick={clearFilters} data-hover="true">
              CLEAR FILTERS ({activeFilterCount})
            </button>
          )}
          <button style={s.saveBtn} onClick={() => setShowSaveForm(!showSaveForm)} data-hover="true">
            {showSaveForm ? 'Cancel' : 'Save as Persona'}
          </button>
        </div>
      </div>

      <div style={s.layout}>
        {/* Left — filters */}
        <div style={s.sidebar}>

          {/* Saved personas */}
          {personas.length > 0 && (
            <div style={s.filterSection}>
              <p style={s.filterLabel}>SAVED PERSONAS</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {personas.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      ...s.personaRow,
                      background: activePersona === p.id ? 'var(--gray-2)' : 'transparent',
                      borderColor: activePersona === p.id ? 'var(--gray-3)' : 'var(--gray-2)',
                    }}
                  >
                    <button
                      style={s.personaBtn}
                      onClick={() => applyPersona(p)}
                      data-hover="true"
                    >
                      {p.name}
                    </button>
                    <button
                      style={s.personaDelete}
                      onClick={() => handleDeletePersona(p.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keyword search */}
          <div style={s.filterSection}>
            <p style={s.filterLabel}>KEYWORD</p>
            <input
              type="text"
              placeholder="Search name, title, company..."
              value={filters.keyword}
              onChange={(e) => { setFilters((prev) => ({ ...prev, keyword: e.target.value })); setActivePersona(null) }}
              style={s.filterInput}
              data-hover="true"
            />
          </div>

          {/* Target roles */}
          <div style={s.filterSection}>
            <p style={s.filterLabel}>TARGET ROLES</p>
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

          {/* Status */}
          <div style={s.filterSection}>
            <p style={s.filterLabel}>STATUS</p>
            <div style={s.chips}>
              {STATUSES.map((st) => (
                <FilterChip
                  key={st}
                  label={st.toUpperCase()}
                  active={filters.statuses.includes(st)}
                  onClick={() => toggleFilter('statuses', st)}
                />
              ))}
            </div>
          </div>

          {/* Location */}
          <div style={s.filterSection}>
            <p style={s.filterLabel}>LOCATION</p>
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

          {/* Save persona form */}
          {showSaveForm && (
            <div style={s.saveForm}>
              <p style={s.saveFormLabel}>SAVE CURRENT FILTERS AS PERSONA</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Persona name e.g. SaaS CTOs India"
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  style={{ ...s.filterInput, flex: 1 }}
                  data-hover="true"
                  onKeyDown={(e) => { if (e.key === 'Enter') saveAsPersona() }}
                />
                <button
                  style={s.saveBtn}
                  onClick={saveAsPersona}
                  disabled={savingPersona}
                  data-hover="true"
                >
                  {savingPersona ? 'Saving...' : 'Save →'}
                </button>
              </div>
            </div>
          )}

          {/* Results header */}
          <div style={s.resultsHeader}>
            <p style={s.resultsCount}>
              {filtered.length} TARGET{filtered.length !== 1 ? 'S' : ''} MATCHED
              {activePersona && (
                <span style={{ color: 'var(--gray-4)', marginLeft: '8px' }}>
                  via {personas.find((p) => p.id === activePersona)?.name}
                </span>
              )}
            </p>
          </div>

          {/* Lead cards grid */}
          {loading ? (
            <p style={s.empty}>Loading leads...</p>
          ) : filtered.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>No matches found</p>
              <p style={s.emptyText}>Try adjusting your filters or extract more leads from LinkedIn.</p>
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
  page: { minHeight: '100vh', background: 'var(--black)' },
  hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '48px 32px 32px', borderBottom: '1px solid var(--gray-2)' },
  eyebrow: { fontSize: '11px', fontWeight: '600', letterSpacing: '4px', color: 'var(--gray-4)', marginBottom: '12px' },
  heroTitle: { fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: '900', letterSpacing: '-2px', color: 'var(--white)', lineHeight: 1 },
  heroUnit: { fontSize: 'clamp(20px, 2.5vw, 32px)', fontWeight: '300', color: 'var(--gray-4)', letterSpacing: '-1px' },
  clearBtn: { padding: '10px 18px', background: 'transparent', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '11px', fontWeight: '700', color: 'var(--gray-4)', cursor: 'none', letterSpacing: '1px', fontFamily: 'inherit' },
  saveBtn: { padding: '10px 20px', background: 'var(--white)', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '700', color: 'var(--black)', cursor: 'none', fontFamily: 'inherit' },
  layout: { display: 'flex', minHeight: 'calc(100vh - 200px)' },
  sidebar: { width: '300px', flexShrink: 0, borderRight: '1px solid var(--gray-2)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px', overflowY: 'auto' },
  filterSection: {},
  filterLabel: { fontSize: '9px', fontWeight: '700', letterSpacing: '3px', color: 'var(--gray-4)', marginBottom: '12px' },
  filterInput: { width: '100%', padding: '10px 14px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '12px', color: 'var(--white)', outline: 'none', fontFamily: 'inherit' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  personaRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid', borderRadius: '4px', transition: 'all 0.15s' },
  personaBtn: { background: 'none', border: 'none', color: 'var(--white)', fontSize: '12px', fontWeight: '600', cursor: 'none', fontFamily: 'inherit', textAlign: 'left', flex: 1 },
  personaDelete: { background: 'none', border: 'none', color: 'var(--gray-4)', fontSize: '11px', cursor: 'pointer', fontWeight: '700', padding: '0 4px' },
  results: { flex: 1, padding: '24px 32px', overflowY: 'auto' },
  saveForm: { background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', padding: '20px', marginBottom: '24px' },
  saveFormLabel: { fontSize: '9px', fontWeight: '700', letterSpacing: '2px', color: 'var(--gray-4)', marginBottom: '12px' },
  resultsHeader: { marginBottom: '20px' },
  resultsCount: { fontSize: '11px', fontWeight: '700', letterSpacing: '2px', color: 'var(--gray-4)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  empty: { fontSize: '13px', color: 'var(--gray-4)', padding: '40px 0' },
  emptyState: { padding: '80px 0', textAlign: 'center' },
  emptyTitle: { fontSize: '18px', fontWeight: '700', color: 'var(--gray-3)', marginBottom: '8px', letterSpacing: '-0.5px' },
  emptyText: { fontSize: '13px', color: 'var(--gray-4)', lineHeight: 1.6 },
}

const lc = {
  card: { background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'border-color 0.15s' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  name: { fontSize: '14px', fontWeight: '700', color: 'var(--white)', marginBottom: '4px', letterSpacing: '-0.3px' },
  title: { fontSize: '12px', color: 'var(--gray-4)' },
  bottom: { display: 'flex', alignItems: 'center', gap: '8px' },
  meta: { fontSize: '11px', color: 'var(--gray-4)' },
  dot: { width: '3px', height: '3px', borderRadius: '50%', background: 'var(--gray-3)', flexShrink: 0 },
  link: { fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: 'var(--gray-4)', textDecoration: 'none', borderBottom: '1px solid var(--gray-3)', alignSelf: 'flex-start' },
}