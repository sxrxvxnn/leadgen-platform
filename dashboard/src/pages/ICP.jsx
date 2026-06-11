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
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ padding: '40px 32px 24px', borderBottom: '1px solid var(--border)' }}>
        <p style={lbl}>Ideal Customer Profile</p>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: '400', letterSpacing: '-1px', color: 'var(--text)', lineHeight: 1 }}>ICP Filter</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>Filter your leads by ideal customer criteria and find the best matches.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 'calc(100vh - 180px)' }}>

        {/* Left panel — filters */}
        <div style={{ padding: '24px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>

          <div>
            <p style={lbl}>Decision Maker Title</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {DM_TITLES.map(t => (
                <button key={t} onClick={() => toggle(selectedTitles, setSelectedTitles, t)}
                  style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    background: selectedTitles.includes(t) ? 'var(--accent)' : 'var(--surface)',
                    color: selectedTitles.includes(t) ? 'var(--bg)' : 'var(--text-secondary)',
                    border: `1px solid ${selectedTitles.includes(t) ? 'var(--accent)' : 'var(--border)'}` }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={lbl}>Org Size</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {ORG_SIZES.map(s => (
                <button key={s} onClick={() => toggle(selectedSizes, setSelectedSizes, s)}
                  style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    background: selectedSizes.includes(s) ? 'var(--accent)' : 'var(--surface)',
                    color: selectedSizes.includes(s) ? 'var(--bg)' : 'var(--text-secondary)',
                    border: `1px solid ${selectedSizes.includes(s) ? 'var(--accent)' : 'var(--border)'}` }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={lbl}>Location</p>
            <input
              type="text" value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              placeholder="e.g. India, Kerala, USA"
              style={{ width: '100%', marginTop: '8px', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <p style={lbl}>Requirements</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '8px' }}>
              <input type="checkbox" checked={requireSecurity} onChange={e => setRequireSecurity(e.target.checked)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Has security team</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '8px' }}>
              <input type="checkbox" checked={requireProduct} onChange={e => setRequireProduct(e.target.checked)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Product company only</span>
            </label>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            {showSaveForm ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={icpName} onChange={e => setIcpName(e.target.value)} placeholder="ICP name..." autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveICP(); if (e.key === 'Escape') setShowSaveForm(false) }}
                  style={{ flex: 1, padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '12px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={saveICP} style={{ padding: '8px 12px', background: 'var(--text)', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '500', color: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
              </div>
            ) : (
              <button onClick={() => setShowSaveForm(true)} disabled={!hasFilters}
                style={{ width: '100%', padding: '9px', background: hasFilters ? 'var(--surface)' : 'transparent', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: hasFilters ? 'var(--text-secondary)' : 'var(--text-muted)', cursor: hasFilters ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontWeight: '400' }}>
                + Save this ICP
              </button>
            )}
          </div>

          {savedICPs.length > 0 && (
            <div>
              <p style={lbl}>Saved ICPs</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {savedICPs.map(icp => (
                  <div key={icp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <button onClick={() => loadICP(icp)} style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>{icp.name}</button>
                    <button onClick={() => deleteICP(icp.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — results */}
        <div style={{ padding: '24px', overflowY: 'auto' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total Leads', value: leads.length, color: 'var(--text)' },
              { label: 'ICP Matches', value: matched.length, color: '#4a7c59' },
              { label: 'Decision Makers', value: dmMatched.length, color: 'var(--accent)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <p style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{label}</p>
                <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '32px', fontWeight: '400', color, letterSpacing: '-1px', lineHeight: 1 }}>{value}</p>
              </div>
            ))}
          </div>

          {hasFilters && leads.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>Match Rate</span>
                <span style={{ fontSize: '11px', color: '#4a7c59', fontWeight: '600' }}>{Math.round(matched.length / leads.length * 100)}%</span>
              </div>
              <div style={{ height: '5px', background: 'var(--surface-raised)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(matched.length / leads.length * 100)}%`, background: '#4a7c59', borderRadius: '3px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          {!hasFilters ? (
            <div style={{ padding: '80px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '16px' }}>🎯</p>
              <p style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>Set your ICP criteria</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '320px', margin: '0 auto' }}>
                Select decision maker titles, org sizes, and requirements on the left to see which leads match your ideal customer profile.
              </p>
            </div>
          ) : loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading leads...</p>
          ) : matched.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>No matches found</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Try broadening your ICP criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Matched Leads</p>
              {matched.map(lead => {
                const isDM = isDecisionMaker(lead)
                return (
                  <div key={lead.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto auto', gap: '12px', alignItems: 'center', padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${isDM ? 'rgba(168,100,72,0.25)' : 'var(--border)'}`, borderRadius: '10px', borderLeft: `3px solid ${isDM ? 'var(--accent)' : 'transparent'}` }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)', marginBottom: '2px' }}>{lead.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lead.company || '—'}</p>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{lead.title || '—'}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
                      {isDM && <span style={{ fontSize: '9px', fontWeight: '600', color: 'var(--accent)', background: 'rgba(168,100,72,0.10)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(168,100,72,0.2)' }}>DM</span>}
                      {lead.has_security_team === 'Yes' && <span style={{ fontSize: '9px', fontWeight: '600', color: '#4a7c59', background: 'rgba(74,124,89,0.10)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(74,124,89,0.2)' }}>SEC</span>}
                    </div>
                    {lead.profile_url
                      ? <a href={lead.profile_url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', fontWeight: '500', whiteSpace: 'nowrap' }}>View →</a>
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

const lbl = { fontSize: '10px', fontWeight: '600', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }
