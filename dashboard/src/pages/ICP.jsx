import React, { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { getLeads } from '../services/api'

const DM_TITLES = ['CEO', 'CTO', 'CPO', 'CISO', 'VP', 'Director', 'Head of', 'Founder', 'Co-Founder', 'President', 'Managing Director', 'General Manager']
const ORG_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']

export default function ICP() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTitles, setSelectedTitles] = useState([])
  const [selectedSizes, setSelectedSizes] = useState([])
  const [requireSecurity, setRequireSecurity] = useState(false)
  const [requireProduct, setRequireProduct] = useState(false)
  const [locationFilter, setLocationFilter] = useState('')
  const [savedICPs, setSavedICPs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('savedICPs') || '[]') } catch { return [] }
  })
  const [icpName, setIcpName] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await getLeads()
        setLeads(res.data.leads || [])
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  function toggle(list, setList, val) {
    setList(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  function isDecisionMaker(lead) {
    const title = (lead.title || '').toLowerCase()
    return DM_TITLES.some(t => title.includes(t.toLowerCase()))
  }

  const hasFilters = selectedTitles.length > 0 || selectedSizes.length > 0 || requireSecurity || requireProduct || locationFilter

  function matchesICP(lead) {
    if (selectedTitles.length > 0) {
      const title = (lead.title || '').toLowerCase()
      if (!selectedTitles.some(t => title.includes(t.toLowerCase()))) return false
    }
    if (selectedSizes.length > 0 && !selectedSizes.includes(lead.org_size)) return false
    if (requireSecurity && lead.has_security_team !== 'Yes') return false
    if (requireProduct && lead.company_type !== 'Product') return false
    if (locationFilter && !(lead.location || '').toLowerCase().includes(locationFilter.toLowerCase())) return false
    return true
  }

  const matched = hasFilters ? leads.filter(matchesICP) : []
  const dmMatched = matched.filter(isDecisionMaker)

  function saveICP() {
    if (!icpName.trim()) return
    const icp = { id: Date.now(), name: icpName, titles: selectedTitles, sizes: selectedSizes, requireSecurity }
    const updated = [...savedICPs, icp]
    setSavedICPs(updated)
    localStorage.setItem('savedICPs', JSON.stringify(updated))
    setIcpName('')
    setShowSaveForm(false)
  }

  function loadICP(icp) {
    setSelectedTitles(icp.titles || [])
    setSelectedSizes(icp.sizes || [])
    setRequireSecurity(icp.requireSecurity || false)
  }

  function deleteICP(id) {
    const updated = savedICPs.filter(i => i.id !== id)
    setSavedICPs(updated)
    localStorage.setItem('savedICPs', JSON.stringify(updated))
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
      <Navbar />
      <div style={{ padding: '40px 32px 24px', borderBottom: '1px solid var(--gray-2)' }}>
        <p style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '4px', color: 'var(--gray-4)', marginBottom: '8px' }}>IDEAL CUSTOMER PROFILE</p>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: '900', letterSpacing: '-2px', color: 'var(--white)', lineHeight: 1 }}>ICP Filter</h1>
        <p style={{ fontSize: '13px', color: 'var(--gray-4)', marginTop: '8px' }}>Filter your leads by ideal customer criteria and find the best matches.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 'calc(100vh - 180px)' }}>

        {/* Left panel — filters */}
        <div style={{ padding: '24px', borderRight: '1px solid var(--gray-2)', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>

          <div>
            <p style={lbl}>DECISION MAKER TITLE</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {DM_TITLES.map(t => (
                <button key={t} onClick={() => toggle(selectedTitles, setSelectedTitles, t)} style={{ padding: '4px 10px', borderRadius: '3px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', background: selectedTitles.includes(t) ? 'var(--amber)' : 'var(--gray-1)', color: selectedTitles.includes(t) ? 'var(--black)' : 'var(--gray-4)', border: `1px solid ${selectedTitles.includes(t) ? 'var(--amber)' : 'var(--gray-2)'}` }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={lbl}>ORG SIZE</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {ORG_SIZES.map(s => (
                <button key={s} onClick={() => toggle(selectedSizes, setSelectedSizes, s)} style={{ padding: '4px 10px', borderRadius: '3px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', background: selectedSizes.includes(s) ? 'var(--amber)' : 'var(--gray-1)', color: selectedSizes.includes(s) ? 'var(--black)' : 'var(--gray-4)', border: `1px solid ${selectedSizes.includes(s) ? 'var(--amber)' : 'var(--gray-2)'}` }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={lbl}>LOCATION</p>
            <input
              type="text" value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              placeholder="e.g. India, Kerala, USA"
              style={{ width: '100%', marginTop: '8px', padding: '8px 10px', background: 'var(--black)', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '12px', color: 'var(--white)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <p style={lbl}>REQUIREMENTS</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '8px' }}>
              <input type="checkbox" checked={requireSecurity} onChange={e => setRequireSecurity(e.target.checked)} style={{ accentColor: 'var(--amber)', cursor: 'pointer' }} />
              <span style={{ fontSize: '12px', color: 'var(--gray-4)' }}>Has security team</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '8px' }}>
              <input type="checkbox" checked={requireProduct} onChange={e => setRequireProduct(e.target.checked)} style={{ accentColor: 'var(--amber)', cursor: 'pointer' }} />
              <span style={{ fontSize: '12px', color: 'var(--gray-4)' }}>Product company only</span>
            </label>
          </div>

          <div style={{ borderTop: '1px solid var(--gray-2)', paddingTop: '16px' }}>
            {showSaveForm ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={icpName} onChange={e => setIcpName(e.target.value)} placeholder="ICP name..." autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveICP(); if (e.key === 'Escape') setShowSaveForm(false) }}
                  style={{ flex: 1, padding: '8px 10px', background: 'var(--black)', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '12px', color: 'var(--white)', outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={saveICP} style={{ padding: '8px 12px', background: 'var(--amber)', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '700', color: 'var(--black)', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
              </div>
            ) : (
              <button onClick={() => setShowSaveForm(true)} disabled={!hasFilters}
                style={{ width: '100%', padding: '10px', background: hasFilters ? 'var(--gray-1)' : 'transparent', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '12px', color: hasFilters ? 'var(--white)' : 'var(--gray-3)', cursor: hasFilters ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontWeight: '600' }}>
                + Save this ICP
              </button>
            )}
          </div>

          {savedICPs.length > 0 && (
            <div>
              <p style={lbl}>SAVED ICPS</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {savedICPs.map(icp => (
                  <div key={icp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--gray-1)', borderRadius: '4px', border: '1px solid var(--gray-2)' }}>
                    <button onClick={() => loadICP(icp)} style={{ flex: 1, background: 'none', border: 'none', color: 'var(--white)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>{icp.name}</button>
                    <button onClick={() => deleteICP(icp.id)} style={{ background: 'none', border: 'none', color: 'var(--gray-4)', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — results */}
        <div style={{ padding: '24px', overflowY: 'auto' }}>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total Leads', value: leads.length, color: 'var(--white)' },
              { label: 'ICP Matches', value: matched.length, color: 'var(--green)' },
              { label: 'Decision Makers', value: dmMatched.length, color: 'var(--amber)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '16px 20px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '6px' }}>
                <p style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '2px', color: 'var(--gray-4)', marginBottom: '8px' }}>{label.toUpperCase()}</p>
                <p style={{ fontSize: '32px', fontWeight: '900', color, letterSpacing: '-1px', lineHeight: 1 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Match rate bar */}
          {hasFilters && leads.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--gray-4)', fontWeight: '700', letterSpacing: '1px' }}>MATCH RATE</span>
                <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: '700' }}>{Math.round(matched.length / leads.length * 100)}%</span>
              </div>
              <div style={{ height: '6px', background: 'var(--gray-2)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(matched.length / leads.length * 100)}%`, background: 'var(--green)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          {!hasFilters ? (
            <div style={{ padding: '80px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '40px', marginBottom: '16px' }}>🎯</p>
              <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--gray-3)', marginBottom: '8px' }}>Set your ICP criteria</p>
              <p style={{ fontSize: '13px', color: 'var(--gray-4)', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto' }}>
                Select decision maker titles, org sizes, and requirements on the left to see which leads match your ideal customer profile.
              </p>
            </div>
          ) : loading ? (
            <p style={{ color: 'var(--gray-4)', fontSize: '13px' }}>Loading leads...</p>
          ) : matched.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--gray-3)', marginBottom: '8px' }}>No matches found</p>
              <p style={{ fontSize: '13px', color: 'var(--gray-4)' }}>Try broadening your ICP criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '2px', color: 'var(--gray-4)', marginBottom: '4px' }}>MATCHED LEADS</p>
              {matched.map(lead => {
                const isDM = isDecisionMaker(lead)
                return (
                  <div key={lead.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto auto', gap: '12px', alignItems: 'center', padding: '12px 16px', background: 'var(--gray-1)', border: `1px solid ${isDM ? 'rgba(255,171,0,0.3)' : 'var(--gray-2)'}`, borderRadius: '6px', borderLeft: `3px solid ${isDM ? 'var(--amber)' : 'transparent'}` }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--white)', marginBottom: '2px' }}>{lead.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--gray-4)' }}>{lead.company || '—'}</p>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--gray-4)', lineHeight: 1.4 }}>{lead.title || '—'}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
                      {isDM && <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--amber)', background: 'rgba(255,171,0,0.1)', padding: '2px 6px', borderRadius: '2px' }}>DM</span>}
                      {lead.has_security_team === 'Yes' && <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--green)', background: 'rgba(0,230,118,0.1)', padding: '2px 6px', borderRadius: '2px' }}>SEC</span>}
                    </div>
                    {lead.profile_url
                      ? <a href={lead.profile_url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#00d4ff', textDecoration: 'none', fontWeight: '600', whiteSpace: 'nowrap' }}>View →</a>
                      : <span />
                    }
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const lbl = { fontSize: '9px', fontWeight: '700', letterSpacing: '2px', color: 'var(--gray-4)' }
