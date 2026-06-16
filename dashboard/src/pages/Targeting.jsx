import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getLeads, getCompanies, createLead, searchCompanyPeople } from '../services/api'

const DM_ROLES = [
  'CEO', 'CTO', 'CISO', 'CPO', 'CFO', 'COO', 'CMO', 'CRO',
  'VP Engineering', 'VP Product', 'VP Sales', 'VP Marketing',
  'Head of Engineering', 'Head of Product', 'Head of Security', 'Head of IT',
  'Director of Engineering', 'Director of Product', 'Director of Sales',
  'Founder', 'Co-Founder', 'Managing Director', 'General Manager',
  'Engineering Manager', 'Product Manager', 'Security Manager',
]

const STATUS_COLORS = {
  new:          { color: '#4a7c59', bg: 'rgba(74,124,89,0.10)',   border: 'rgba(74,124,89,0.22)' },
  contacted:    { color: '#a86448', bg: 'rgba(168,100,72,0.10)',  border: 'rgba(168,100,72,0.22)' },
  qualified:    { color: '#5b8db8', bg: 'rgba(91,141,184,0.10)',  border: 'rgba(91,141,184,0.22)' },
  disqualified: { color: '#a1a1a1', bg: 'rgba(161,161,161,0.10)', border: 'rgba(161,161,161,0.22)' },
}

// ── Company search dropdown ────────────────────────────────────
function CompanyPicker({ companies, selected, onSelect }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (selected) setQuery(selected.name)
  }, [selected])

  const filtered = query
    ? companies.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : companies

  function pick(c) { onSelect(c); setQuery(c.name); setOpen(false) }
  function clear() { onSelect(null); setQuery(''); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text" value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onSelect(null) }}
          onFocus={() => setOpen(true)}
          placeholder="Search your pipeline…"
          style={{ width: '100%', padding: '10px 36px 10px 12px', background: 'var(--bg)', border: `1px solid ${open ? 'rgba(29,27,27,0.28)' : 'var(--border)'}`, borderRadius: open && filtered.length > 0 ? '7px 7px 0 0' : '7px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.02em', transition: 'border-color 0.1s' }}
        />
        {query && (
          <button onClick={clear} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '2px 4px' }}>✕</button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: 'var(--bg)', border: '1px solid rgba(29,27,27,0.18)', borderTop: 'none', borderRadius: '0 0 7px 7px', boxShadow: '0 10px 30px rgba(29,27,27,0.10)', maxHeight: '240px', overflowY: 'auto' }}>
          {filtered.map(c => (
            <button key={c.id} onClick={() => pick(c)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: selected?.id === c.id ? 'rgba(168,100,72,0.06)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              {c.logo ? (
                <img src={c.logo} alt="" style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'contain', background: '#fff', flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
              ) : (
                <div style={{ width: '22px', height: '22px', borderRadius: '4px', background: 'var(--surface)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700' }}>{(c.name || '?')[0].toUpperCase()}</span>
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: selected?.id === c.id ? 'var(--accent)' : 'var(--text)', fontWeight: selected?.id === c.id ? '600' : '400', letterSpacing: '0.02em', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                {c.classification && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', margin: 0, letterSpacing: '0.04em' }}>{c.classification}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Role chip row ──────────────────────────────────────────────
function RoleChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '5px 10px', borderRadius: '5px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: active ? '600' : '400', cursor: 'pointer', background: active ? '#1d1b1b' : 'transparent', color: active ? '#fdfdfd' : 'var(--text-muted)', border: `1px solid ${active ? '#1d1b1b' : 'var(--border)'}`, letterSpacing: '0.04em', transition: 'all 0.1s', whiteSpace: 'nowrap' }}>{label}</button>
  )
}

// ── Person card ────────────────────────────────────────────────
function PersonCard({ person, addState, onAdd, existingLead }) {
  const name = person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || '—'
  const isAdded = addState === 'added' || !!existingLead
  const isAdding = addState === 'adding'

  return (
    <div style={{ background: 'var(--bg)', border: `1px solid ${isAdded ? 'rgba(74,124,89,0.3)' : 'var(--border)'}`, borderRadius: '9px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        {person.photo_url ? (
          <img src={person.photo_url} alt="" style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} onError={e => { e.target.style.display = 'none' }} />
        ) : (
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--surface)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--text-muted)' }}>{name[0]}</span>
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '400', letterSpacing: '-0.02em', color: 'var(--text)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', fontWeight: '500', letterSpacing: '0.02em', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.title || '—'}</p>
        </div>
      </div>

      {person.location && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', margin: 0, letterSpacing: '0.02em' }}>{person.location}</p>
      )}

      <div style={{ display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap' }}>
        {person.linkedin_url && (
          <a href={person.linkedin_url} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#5b8db8', textDecoration: 'none', fontWeight: '600', letterSpacing: '0.04em' }}>LinkedIn →</a>
        )}
        {isAdded ? (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', color: '#4a7c59', letterSpacing: '0.04em', marginLeft: 'auto' }}>✓ In leads</span>
        ) : (
          <button onClick={onAdd} disabled={isAdding} style={{ marginLeft: 'auto', padding: '5px 12px', background: isAdding ? 'var(--surface)' : '#1d1b1b', color: isAdding ? 'var(--text-muted)' : '#fdfdfd', border: 'none', borderRadius: '5px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', cursor: isAdding ? 'default' : 'pointer', letterSpacing: '0.04em' }}>
            {isAdding ? 'Adding…' : 'Add to Leads'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export default function Targeting() {
  const [companies, setCompanies] = useState([])
  const [existingLeads, setExistingLeads] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedCompany, setSelectedCompany] = useState(null)
  const [selectedRoles, setSelectedRoles] = useState([])

  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null) // null = not searched yet
  const [searchError, setSearchError] = useState('')

  // per-person add state: { [linkedin_url|name]: 'idle'|'adding'|'added' }
  const [addStates, setAddStates] = useState({})

  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const [cr, lr] = await Promise.all([getCompanies(), getLeads()])
        setCompanies(cr.data.companies || [])
        setExistingLeads(lr.data.leads || [])
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // Reset results when company changes
  useEffect(() => {
    setSearchResults(null)
    setSearchError('')
    setAddStates({})
  }, [selectedCompany])

  function toggleRole(role) {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
  }

  // Leads already in DB for the selected company
  const companyLeads = useMemo(() => {
    if (!selectedCompany) return []
    return existingLeads.filter(l => (l.company || '').toLowerCase() === (selectedCompany.name || '').toLowerCase())
  }, [selectedCompany, existingLeads])

  // Existing lead lookup by linkedin_url or full name
  const existingLeadKeys = useMemo(() => {
    const keys = new Set()
    existingLeads.forEach(l => {
      if (l.profile_url) keys.add(l.profile_url.toLowerCase().replace(/\/$/, ''))
      const n = `${l.first_name || ''} ${l.last_name || ''} ${l.company || ''}`.trim().toLowerCase()
      if (n) keys.add(n)
    })
    return keys
  }, [existingLeads])

  function isAlreadyLead(person) {
    const url = (person.linkedin_url || '').toLowerCase().replace(/\/$/, '')
    if (url && existingLeadKeys.has(url)) return true
    const n = `${person.first_name || ''} ${person.last_name || ''} ${person.company || ''}`.trim().toLowerCase()
    return existingLeadKeys.has(n)
  }

  function personKey(p) {
    return (p.linkedin_url || p.name || `${p.first_name} ${p.last_name}`).toLowerCase()
  }

  async function handleSearch() {
    if (!selectedCompany) return
    setSearching(true)
    setSearchError('')
    setSearchResults(null)
    try {
      const domain = selectedCompany.website
        ? selectedCompany.website.replace(/https?:\/\//, '').replace(/\/.*/, '').trim()
        : ''
      const res = await searchCompanyPeople(selectedCompany.name, domain, selectedRoles)
      setSearchResults(res.data.people || [])
    } catch (e) {
      setSearchError(e.response?.data?.detail || 'Search failed. Try again.')
    } finally {
      setSearching(false)
    }
  }

  async function handleAddLead(person) {
    const key = personKey(person)
    setAddStates(prev => ({ ...prev, [key]: 'adding' }))
    try {
      await createLead({
        first_name: person.first_name,
        last_name: person.last_name,
        name: person.name,
        title: person.title,
        company: person.company || selectedCompany?.name,
        location: person.location,
        email: person.email || '',
        profile_url: person.linkedin_url || '',
        status: 'new',
      })
      setAddStates(prev => ({ ...prev, [key]: 'added' }))
      // Add to local leads list so isAlreadyLead reflects immediately
      setExistingLeads(prev => [...prev, {
        first_name: person.first_name, last_name: person.last_name,
        name: person.name, title: person.title,
        company: person.company || selectedCompany?.name,
        location: person.location, profile_url: person.linkedin_url || '',
        status: 'new',
      }])
    } catch (e) {
      setAddStates(prev => ({ ...prev, [key]: 'idle' }))
    }
  }

  const isEmpty = companies.length === 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Hero */}
      <div style={{ position: 'relative', padding: '52px 48px 32px', borderBottom: '1px dashed var(--border-dash)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 90% at 5% 50%, rgba(168,100,72,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <p style={lbl}>Targeting Engine</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px,7vw,80px)', fontWeight: '400', letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1, marginBottom: '8px' }}>
            Find decision makers
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.03em', lineHeight: 1.7, maxWidth: '520px' }}>
            Pick a company from your pipeline, filter by role, then find and add decision makers directly to your leads list.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 208px)' }}>

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <div style={{ width: '280px', flexShrink: 0, borderRight: '1px dashed var(--border-dash)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', background: 'var(--bg)' }}>

          {/* Step 1 */}
          <div>
            <p style={stepLbl}><span style={stepNum}>1</span>Select Company</p>
            <div style={{ marginTop: '10px' }}>
              {isEmpty ? (
                <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px dashed var(--border-dash)', borderRadius: '7px' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>No companies in pipeline.</p>
                  <button onClick={() => navigate('/directory')} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: '600', letterSpacing: '0.04em' }}>Go to Discovery →</button>
                </div>
              ) : (
                <CompanyPicker companies={companies} selected={selectedCompany} onSelect={setSelectedCompany} />
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px dashed var(--border-dash)' }} />

          {/* Step 2 */}
          <div>
            <p style={stepLbl}><span style={stepNum}>2</span>Filter by Role</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '10px', letterSpacing: '0.04em' }}>Leave blank to find all members</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {DM_ROLES.map(r => (
                <RoleChip key={r} label={r} active={selectedRoles.includes(r)} onClick={() => toggleRole(r)} />
              ))}
            </div>
            {selectedRoles.length > 0 && (
              <button onClick={() => setSelectedRoles([])} style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.04em' }}>Clear roles</button>
            )}
          </div>

          <div style={{ borderTop: '1px dashed var(--border-dash)' }} />

          {/* Step 3 — search button */}
          <div>
            <p style={stepLbl}><span style={stepNum}>3</span>Find Contacts</p>
            <div style={{ marginTop: '10px' }}>
              <button
                onClick={handleSearch}
                disabled={!selectedCompany || searching}
                style={{ width: '100%', padding: '10px 16px', background: selectedCompany ? '#1d1b1b' : 'var(--surface)', color: selectedCompany ? '#fdfdfd' : 'var(--text-muted)', border: 'none', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '600', cursor: selectedCompany ? 'pointer' : 'default', letterSpacing: '0.06em', transition: 'background 0.15s' }}
              >
                {searching ? 'Searching…' : selectedCompany ? `Find at ${selectedCompany.name}` : 'Select a company first'}
              </button>
              {searchError && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#c0392b', marginTop: '6px', letterSpacing: '0.02em' }}>{searchError}</p>}
            </div>
          </div>

        </div>

        {/* ── Main Panel ──────────────────────────────────────── */}
        <div style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>

          {!selectedCompany ? (
            /* No company selected */
            <div style={{ padding: '80px 0', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', marginBottom: '10px' }}>
                {isEmpty ? 'No companies in pipeline yet' : 'Select a company to begin'}
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.9, maxWidth: '380px', margin: '0 auto 20px', letterSpacing: '0.02em' }}>
                {isEmpty
                  ? 'Use Discovery to find and add companies first, then come back here to find their key contacts.'
                  : 'Pick a company from your pipeline on the left, optionally filter by role, then click "Find Contacts" to search for decision makers via Apollo.'}
              </p>
              {isEmpty && (
                <button onClick={() => navigate('/directory')} style={{ padding: '10px 22px', background: '#1d1b1b', color: '#fdfdfd', border: 'none', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', letterSpacing: '0.06em' }}>
                  Go to Discovery →
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Company header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px dashed var(--border-dash)' }}>
                {selectedCompany.logo ? (
                  <img src={selectedCompany.logo} alt="" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'contain', background: '#fff', border: '1px solid var(--border)', padding: '4px' }} onError={e => { e.target.style.display = 'none' }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--text-muted)' }}>{(selectedCompany.name || '?')[0]}</span>
                  </div>
                )}
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', margin: 0 }}>{selectedCompany.name}</h2>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0', letterSpacing: '0.04em' }}>
                    {[selectedCompany.classification, selectedCompany.size, selectedCompany.headquarters].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>

              {/* Existing leads section */}
              {companyLeads.length > 0 && (
                <div style={{ marginBottom: '36px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <p style={sectionLbl}>Already in leads</p>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '700', padding: '2px 7px', borderRadius: '3px', background: 'rgba(74,124,89,0.10)', color: '#4a7c59', border: '1px solid rgba(74,124,89,0.22)' }}>{companyLeads.length}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                    {companyLeads.map(lead => {
                      const st = STATUS_COLORS[lead.status] || STATUS_COLORS.new
                      const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.name || '—'
                      return (
                        <div key={lead.id} style={{ background: 'var(--bg)', border: '1px solid rgba(74,124,89,0.22)', borderRadius: '9px', padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', letterSpacing: '-0.02em', color: 'var(--text)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.title || '—'}</p>
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', padding: '2px 7px', borderRadius: '3px', color: st.color, background: st.bg, border: `1px solid ${st.border}`, flexShrink: 0, marginLeft: '8px' }}>{lead.status}</span>
                          </div>
                          {lead.profile_url && (
                            <a href={lead.profile_url} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#5b8db8', textDecoration: 'none', fontWeight: '600', letterSpacing: '0.04em', alignSelf: 'flex-start' }}>LinkedIn →</a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Search results */}
              {searchResults === null && !searching ? (
                <div style={{ padding: '48px 0', textAlign: 'center', border: '1px dashed var(--border-dash)', borderRadius: '10px' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '400', letterSpacing: '-0.03em', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Ready to search
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
                    {selectedRoles.length > 0
                      ? `Will search for ${selectedRoles.join(', ')} at ${selectedCompany.name}`
                      : `Will find all contacts at ${selectedCompany.name}`}
                  </p>
                </div>
              ) : searching ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>Searching Hunter + LinkedIn for people at {selectedCompany.name}…</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: '48px 0', textAlign: 'center', border: '1px dashed var(--border-dash)', borderRadius: '10px' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', letterSpacing: '-0.03em', color: 'var(--text-secondary)', marginBottom: '6px' }}>No contacts found</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>Try removing role filters or searching by a different company name.</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <p style={sectionLbl}>Found via Apollo</p>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '700', padding: '2px 7px', borderRadius: '3px', background: 'rgba(91,141,184,0.10)', color: '#5b8db8', border: '1px solid rgba(91,141,184,0.22)' }}>{searchResults.length}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))', gap: '10px' }}>
                    {searchResults.map(person => {
                      const key = personKey(person)
                      const alreadyLead = isAlreadyLead(person)
                      return (
                        <PersonCard
                          key={key}
                          person={person}
                          addState={addStates[key] || 'idle'}
                          existingLead={alreadyLead}
                          onAdd={() => handleAddLead(person)}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const lbl = { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase' }
const stepLbl = { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '7px', margin: 0 }
const stepNum = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: '#1d1b1b', color: '#fdfdfd', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '700', flexShrink: 0 }
const sectionLbl = { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase' }
