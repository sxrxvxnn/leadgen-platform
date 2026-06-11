import React, { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { getLeads, getPersonas, createPersona, deletePersona } from '../services/api'

const ORG_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
const DM_ROLES = ['CEO', 'CTO', 'CPO', 'CISO', 'VP', 'Head of', 'Director', 'Founder', 'Co-Founder', 'Product Manager', 'Engineering Manager']
const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'disqualified']
const LOCATIONS = ['India', 'United States', 'United Kingdom', 'Singapore', 'Australia', 'Canada', 'Germany', 'UAE']

const STATUS_COLORS = {
  new:          { color: '#4a7c59', bg: 'rgba(74,124,89,0.10)',   border: 'rgba(74,124,89,0.22)' },
  contacted:    { color: '#a86448', bg: 'rgba(168,100,72,0.10)',  border: 'rgba(168,100,72,0.22)' },
  qualified:    { color: '#5b8db8', bg: 'rgba(91,141,184,0.10)',  border: 'rgba(91,141,184,0.22)' },
  disqualified: { color: '#a1a1a1', bg: 'rgba(161,161,161,0.10)', border: 'rgba(161,161,161,0.22)' },
}

const DEFAULT_FILTERS = {
  orgSizes: [],
  requireSecurity: false,
  requireProduct: false,
  roles: [],
  statuses: [],
  locations: [],
  keyword: '',
}

function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '500',
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
      background: active ? 'var(--accent)' : 'var(--surface)',
      color: active ? 'var(--bg)' : 'var(--text-secondary)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    }}>{label}</button>
  )
}

export default function Targeting() {
  const [leads, setLeads] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [activeProfile, setActiveProfile] = useState(null)
  const [showSave, setShowSave] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [lr, pr] = await Promise.all([getLeads(), getPersonas()])
        setLeads(lr.data.leads || [])
        setProfiles(pr.data.personas || [])
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  function toggle(key, val) {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(val) ? prev[key].filter(v => v !== val) : [...prev[key], val],
    }))
    setActiveProfile(null)
  }

  function matchesCompany(lead) {
    if (filters.orgSizes.length > 0 && !filters.orgSizes.includes(lead.org_size)) return false
    if (filters.requireSecurity && lead.has_security_team !== 'Yes') return false
    if (filters.requireProduct && lead.company_type !== 'Product') return false
    return true
  }

  function matchesPerson(lead) {
    if (filters.roles.length > 0) {
      const title = (lead.title || '').toLowerCase()
      if (!filters.roles.some(r => title.includes(r.toLowerCase()))) return false
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(lead.status)) return false
    if (filters.locations.length > 0) {
      if (!filters.locations.some(l => (lead.location || '').toLowerCase().includes(l.toLowerCase()))) return false
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase()
      if (![lead.name, lead.title, lead.company, lead.location].join(' ').toLowerCase().includes(kw)) return false
    }
    return true
  }

  const hasCompanyFilters = filters.orgSizes.length > 0 || filters.requireSecurity || filters.requireProduct
  const hasPersonFilters = filters.roles.length > 0 || filters.statuses.length > 0 || filters.locations.length > 0 || !!filters.keyword
  const hasAnyFilters = hasCompanyFilters || hasPersonFilters

  const companyMatchCount = hasCompanyFilters ? leads.filter(matchesCompany).length : null
  const personMatchCount = hasPersonFilters ? leads.filter(matchesPerson).length : null
  const bestFits = leads.filter(l => matchesCompany(l) && matchesPerson(l))

  let displayLeads
  if (hasCompanyFilters && hasPersonFilters) {
    displayLeads = bestFits
  } else if (hasCompanyFilters) {
    displayLeads = leads.filter(matchesCompany)
  } else if (hasPersonFilters) {
    displayLeads = leads.filter(matchesPerson)
  } else {
    displayLeads = leads
  }

  const totalFilterCount = filters.orgSizes.length + filters.roles.length + filters.statuses.length +
    filters.locations.length + (filters.requireSecurity ? 1 : 0) + (filters.requireProduct ? 1 : 0) + (filters.keyword ? 1 : 0)

  async function saveProfile() {
    if (!profileName.trim()) return
    setSaving(true)
    try {
      const res = await createPersona({ name: profileName, filters })
      setProfiles(prev => [res.data.persona, ...prev])
      setActiveProfile(res.data.persona.id)
      setProfileName('')
      setShowSave(false)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  async function handleDeleteProfile(id) {
    try {
      await deletePersona(id)
      setProfiles(prev => prev.filter(p => p.id !== id))
      if (activeProfile === id) setActiveProfile(null)
    } catch (e) { console.error(e) }
  }

  function applyProfile(profile) {
    setFilters({ ...DEFAULT_FILTERS, ...profile.filters })
    setActiveProfile(profile.id)
  }

  function exportCSV() {
    const headers = ['Name', 'Title', 'Company', 'Location', 'Status', 'Org Size', 'Company Type', 'Security Team', 'Profile URL']
    const rows = displayLeads.map(l => [
      l.name, l.title, l.company, l.location, l.status,
      l.org_size, l.company_type, l.has_security_team, l.profile_url,
    ].map(v => `"${(v || '').replace(/"/g, '""')}"`))
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'targeted-leads.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const bothActive = hasCompanyFilters && hasPersonFilters

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Hero */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '40px 32px 28px', borderBottom: '1px solid var(--border)' }}>
        <div>
          <p style={lbl}>Targeting Engine</p>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(36px, 4.5vw, 56px)', fontWeight: '400', letterSpacing: '-1.5px', color: 'var(--text)', lineHeight: 1 }}>
            {displayLeads.length}
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(18px, 2vw, 28px)', fontWeight: '400', color: 'var(--text-muted)', letterSpacing: '-0.5px' }}> targets</span>
          </h1>
          {bothActive && (
            <p style={{ fontSize: '11px', color: '#5b8db8', fontWeight: '500', marginTop: '6px', letterSpacing: '0.3px' }}>
              ICP + Persona active — showing best fits only
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {totalFilterCount > 0 && (
            <button onClick={() => { setFilters(DEFAULT_FILTERS); setActiveProfile(null) }}
              style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear all ({totalFilterCount})
            </button>
          )}
          {displayLeads.length > 0 && (
            <button onClick={exportCSV}
              style={{ padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Export CSV
            </button>
          )}
          <button onClick={() => setShowSave(!showSave)}
            style={{ padding: '8px 16px', background: 'var(--text)', border: 'none', borderRadius: '7px', fontSize: '11px', fontWeight: '500', color: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {showSave ? 'Cancel' : 'Save Profile'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 205px)' }}>

        {/* Sidebar */}
        <div style={{ width: '280px', flexShrink: 0, borderRight: '1px solid var(--border)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>

          {/* Saved profiles */}
          {profiles.length > 0 && (
            <div>
              <p style={lbl}>Saved Profiles</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {profiles.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: activeProfile === p.id ? 'var(--surface-raised)' : 'var(--surface)', border: `1px solid ${activeProfile === p.id ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: '8px', transition: 'all 0.15s' }}>
                    <button onClick={() => applyProfile(p)} style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>{p.name}</button>
                    <button onClick={() => handleDeleteProfile(p.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', padding: '0 2px' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Company criteria (ICP) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <p style={{ ...lbl, margin: 0 }}>Company Criteria</p>
              {hasCompanyFilters && <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--accent)', background: 'rgba(168,100,72,0.10)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(168,100,72,0.2)', letterSpacing: '0.5px' }}>ON</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <p style={sub}>Org Size</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {ORG_SIZES.map(s => <Chip key={s} label={s} active={filters.orgSizes.includes(s)} onClick={() => toggle('orgSizes', s)} />)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.requireSecurity}
                    onChange={e => { setFilters(prev => ({ ...prev, requireSecurity: e.target.checked })); setActiveProfile(null) }}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Has security team</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.requireProduct}
                    onChange={e => { setFilters(prev => ({ ...prev, requireProduct: e.target.checked })); setActiveProfile(null) }}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Product company only</span>
                </label>
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border)' }} />

          {/* Contact criteria (Persona) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <p style={{ ...lbl, margin: 0 }}>Contact Criteria</p>
              {hasPersonFilters && <span style={{ fontSize: '9px', fontWeight: '700', color: '#4a7c59', background: 'rgba(74,124,89,0.10)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(74,124,89,0.2)', letterSpacing: '0.5px' }}>ON</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <p style={sub}>Keyword</p>
                <input type="text" value={filters.keyword}
                  onChange={e => { setFilters(prev => ({ ...prev, keyword: e.target.value })); setActiveProfile(null) }}
                  placeholder="Name, title, company..."
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <p style={sub}>Title / Role</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {DM_ROLES.map(r => <Chip key={r} label={r} active={filters.roles.includes(r)} onClick={() => toggle('roles', r)} />)}
                </div>
              </div>
              <div>
                <p style={sub}>Status</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {LEAD_STATUSES.map(st => <Chip key={st} label={st} active={filters.statuses.includes(st)} onClick={() => toggle('statuses', st)} />)}
                </div>
              </div>
              <div>
                <p style={sub}>Location</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {LOCATIONS.map(l => <Chip key={l} label={l} active={filters.locations.includes(l)} onClick={() => toggle('locations', l)} />)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main panel */}
        <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
            {[
              { label: 'Total Leads',    value: leads.length,           color: 'var(--text)',   dim: false },
              { label: 'Company Match',  value: companyMatchCount ?? '—', color: 'var(--accent)', dim: !hasCompanyFilters },
              { label: 'Contact Match',  value: personMatchCount ?? '—',  color: '#4a7c59',       dim: !hasPersonFilters },
              { label: 'Best Fits',      value: bothActive ? bestFits.length : '—', color: '#5b8db8', dim: !bothActive },
            ].map(({ label, value, color, dim }) => (
              <div key={label} style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <p style={{ fontSize: '9px', fontWeight: '600', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>{label}</p>
                <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '28px', fontWeight: '400', color: dim ? 'var(--text-muted)' : color, letterSpacing: '-1px', lineHeight: 1 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Save form */}
          {showSave && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '18px', marginBottom: '20px' }}>
              <p style={lbl}>Save targeting profile</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveProfile() }}
                  placeholder="e.g. SaaS CTOs India" autoFocus
                  style={{ flex: 1, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '12px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={saveProfile} disabled={saving}
                  style={{ padding: '8px 16px', background: 'var(--text)', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '500', color: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {saving ? 'Saving...' : 'Save →'}
                </button>
              </div>
            </div>
          )}

          {/* Match rate bar */}
          {hasAnyFilters && leads.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>Match Rate</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: bothActive ? '#5b8db8' : '#4a7c59' }}>
                  {Math.round(displayLeads.length / leads.length * 100)}%
                </span>
              </div>
              <div style={{ height: '5px', background: 'var(--surface-raised)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(displayLeads.length / leads.length * 100)}%`, background: bothActive ? '#5b8db8' : '#4a7c59', borderRadius: '3px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          {/* Results */}
          {!hasAnyFilters ? (
            <div style={{ padding: '80px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '16px' }}>🎯</p>
              <p style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>Build your targeting profile</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.8, maxWidth: '400px', margin: '0 auto' }}>
                Use <strong style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Company Criteria</strong> to filter by org size and type,
                and <strong style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Contact Criteria</strong> to filter by role, status, and location.
                Enable both to find your Best Fits — leads that match everything.
              </p>
            </div>
          ) : loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</p>
          ) : displayLeads.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>No matches found</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Try broadening your criteria.</p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' }}>
                {bothActive ? 'Best Fits' : 'Matched Leads'} · {displayLeads.length}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {displayLeads.map(lead => {
                  const st = STATUS_COLORS[lead.status] || STATUS_COLORS.new
                  const isBestFit = bothActive && matchesCompany(lead) && matchesPerson(lead)
                  return (
                    <div key={lead.id} style={{ background: 'var(--surface)', border: `1px solid ${isBestFit ? 'rgba(91,141,184,0.4)' : 'var(--border)'}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', transition: 'border-color 0.15s' }}>
                      {isBestFit && (
                        <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '9px', fontWeight: '700', color: '#5b8db8', background: 'rgba(91,141,184,0.12)', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(91,141,184,0.25)', letterSpacing: '0.3px' }}>BEST FIT</div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '40px' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name || '—'}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.title || '—'}</p>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '500', padding: '2px 8px', borderRadius: '4px', color: st.color, background: st.bg, border: `1px solid ${st.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>{lead.status || 'new'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.company || '—'}</span>
                        {lead.location && <>
                          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--border-strong)', flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.location}</span>
                        </>}
                      </div>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {lead.has_security_team === 'Yes' && (
                          <span style={{ fontSize: '9px', fontWeight: '600', color: '#4a7c59', background: 'rgba(74,124,89,0.10)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(74,124,89,0.2)' }}>SEC</span>
                        )}
                        {lead.company_type === 'Product' && (
                          <span style={{ fontSize: '9px', fontWeight: '600', color: 'var(--accent)', background: 'rgba(168,100,72,0.10)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(168,100,72,0.2)' }}>PRODUCT</span>
                        )}
                        {lead.org_size && (
                          <span style={{ fontSize: '9px', fontWeight: '500', color: 'var(--text-muted)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: '3px' }}>{lead.org_size}</span>
                        )}
                      </div>
                      {lead.profile_url && (
                        <a href={lead.profile_url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', fontWeight: '500', alignSelf: 'flex-start' }}>View profile →</a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const lbl = { fontSize: '10px', fontWeight: '600', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }
const sub = { fontSize: '10px', color: 'var(--text-muted)', marginBottom: '7px', fontWeight: '500', letterSpacing: '0.5px' }
