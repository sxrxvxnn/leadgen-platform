import React, { useState, useRef, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { prefillCompany, createCompany } from '../services/api'

export default function CompanyDiscovery() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSugg, setShowSugg] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  // Selected company being previewed / enriched
  const [selected, setSelected] = useState(null)   // { name, domain, logo }
  const [enriching, setEnriching] = useState(false)
  const [enriched, setEnriched] = useState(null)   // prefill response

  // Per-domain add state: 'idle' | 'adding' | 'added'
  const [addState, setAddState] = useState({})

  const debounceRef = useRef(null)
  const suggRef = useRef(null)
  const inputRef = useRef(null)

  // ── Clearbit autocomplete ──────────────────────────────────
  function handleQueryChange(e) {
    const val = e.target.value
    setQuery(val)
    setActiveIdx(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setSuggestions([]); setShowSugg(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(val.trim())}`)
        const data = await res.json()
        setSuggestions(data.slice(0, 8))
        setShowSugg(data.length > 0)
      } catch { setSuggestions([]); setShowSugg(false) }
    }, 280)
  }

  function handleKeyDown(e) {
    if (!showSugg || suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pickSuggestion(suggestions[activeIdx]) }
    else if (e.key === 'Escape') { setShowSugg(false) }
  }

  useEffect(() => {
    function onClick(e) { if (suggRef.current && !suggRef.current.contains(e.target)) setShowSugg(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // ── Pick a suggestion → enrich ─────────────────────────────
  async function pickSuggestion(s) {
    setShowSugg(false)
    setQuery(s.name)
    setSuggestions([])
    setSelected(s)
    setEnriched(null)
    setEnriching(true)
    try {
      const websiteUrl = s.domain ? `https://${s.domain}` : ''
      const res = await prefillCompany(s.name, websiteUrl)
      setEnriched(res.data)
    } catch {
      setEnriched({ name: s.name, website_url: s.domain ? `https://${s.domain}` : '', linkedin_data: {} })
    } finally {
      setEnriching(false)
    }
  }

  // ── Add to pipeline ────────────────────────────────────────
  async function addToPipeline() {
    if (!enriched) return
    const key = selected?.domain || enriched.name
    setAddState(p => ({ ...p, [key]: 'adding' }))
    try {
      const li = enriched.linkedin_data || {}
      await createCompany({
        name: enriched.name || selected?.name,
        website: enriched.website_url || (selected?.domain ? `https://${selected.domain}` : null),
        linkedin_url: enriched.linkedin_url || null,
        headquarters: li.location || null,
        followers: li.followers || null,
        size: li.employee_count ? String(li.employee_count) : null,
        description: li.description || null,
      })
      setAddState(p => ({ ...p, [key]: 'added' }))
    } catch (e) {
      const msg = e.response?.data?.detail || 'Failed to add'
      setAddState(p => ({ ...p, [key]: 'idle' }))
      alert(msg.includes('duplicate') || msg.includes('already') ? 'Already in your pipeline.' : msg)
    }
  }

  const addKey = selected?.domain || enriched?.name
  const addStatus = addState[addKey] || 'idle'

  // ── Helpers ────────────────────────────────────────────────
  function fmtNumber(n) {
    if (!n) return null
    const num = parseInt(String(n).replace(/,/g, ''), 10)
    if (isNaN(num)) return String(n)
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    return String(num)
  }

  const li = enriched?.linkedin_data || {}

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 55% 90% at 5% 50%, rgba(168,100,72,0.07) 0%, transparent 70%)' }} />

      <Navbar />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '720px', margin: '0 auto', padding: '72px 32px 80px' }}>

        {/* Hero */}
        <p style={s.eyebrow}>Company Discovery</p>
        <h1 style={s.heroTitle}>Find your<br />next target.</h1>
        <p style={s.heroSub}>
          Search millions of companies. Preview their LinkedIn data, headcount, and HQ.
          Add the ones you want straight to your pipeline.
        </p>

        {/* Search */}
        <div style={{ position: 'relative', marginTop: '40px' }} ref={suggRef}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>↗</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSugg(true)}
              placeholder="Search any company — Stripe, Sequantix, Beagle Security…"
              style={s.searchInput}
              autoComplete="off"
            />
            {query && (
              <button onClick={() => { setQuery(''); setSuggestions([]); setShowSugg(false); setSelected(null); setEnriched(null); inputRef.current?.focus() }}
                style={s.clearBtn}>✕</button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSugg && suggestions.length > 0 && (
            <div style={s.dropdown}>
              {suggestions.map((c, i) => (
                <div key={c.domain || c.name} onMouseDown={() => pickSuggestion(c)}
                  style={{ ...s.suggItem, background: i === activeIdx ? 'var(--surface)' : 'transparent' }}>
                  {c.logo
                    ? <img src={c.logo} alt="" style={s.logo} onError={e => { e.target.style.display = 'none' }} />
                    : <div style={s.logoPlaceholder}>{c.name[0]}</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={s.suggName}>{c.name}</p>
                    {c.domain && <p style={s.suggDomain}>{c.domain}</p>}
                  </div>
                  <span style={s.suggArrow}>→</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Result card */}
        {selected && (
          <div style={{ marginTop: '28px' }}>

            {/* Enriching state */}
            {enriching && (
              <div style={s.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {selected.logo
                    ? <img src={selected.logo} alt="" style={s.cardLogo} onError={e => { e.target.style.display = 'none' }} />
                    : <div style={s.cardLogoPlaceholder}>{selected.name[0]}</div>
                  }
                  <div>
                    <p style={s.cardName}>{selected.name}</p>
                    {selected.domain && <p style={s.cardDomain}>{selected.domain}</p>}
                  </div>
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', letterSpacing: '0.08em', fontWeight: '600', marginTop: '20px' }}>
                  Enriching with LinkedIn data…
                </p>
              </div>
            )}

            {/* Enriched result */}
            {!enriching && enriched && (
              <div style={s.card}>
                {/* Top row: logo + name + add button */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {selected?.logo
                      ? <img src={selected.logo} alt="" style={s.cardLogo} onError={e => { e.target.style.display = 'none' }} />
                      : <div style={s.cardLogoPlaceholder}>{(enriched.name || selected?.name || '?')[0]}</div>
                    }
                    <div>
                      <p style={s.cardName}>{enriched.name || selected?.name}</p>
                      <p style={s.cardDomain}>{selected?.domain || enriched.website_url?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</p>
                    </div>
                  </div>

                  {addStatus === 'added' ? (
                    <div style={s.addedBadge}>✓ Added to pipeline</div>
                  ) : (
                    <button onClick={addToPipeline} disabled={addStatus === 'adding'} style={{ ...s.addBtn, opacity: addStatus === 'adding' ? 0.6 : 1 }}>
                      {addStatus === 'adding' ? 'Adding…' : 'Add to Pipeline →'}
                    </button>
                  )}
                </div>

                {/* Stats grid */}
                {(li.followers || li.employee_count || li.location || enriched.linkedin_url) && (
                  <div style={s.statsGrid}>
                    {li.followers && (
                      <div style={s.statCell}>
                        <p style={s.statValue}>{fmtNumber(String(li.followers).replace(/[^0-9]/g, ''))}</p>
                        <p style={s.statLabel}>Followers</p>
                      </div>
                    )}
                    {li.employee_count && (
                      <div style={s.statCell}>
                        <p style={s.statValue}>{fmtNumber(li.employee_count)}</p>
                        <p style={s.statLabel}>Employees</p>
                      </div>
                    )}
                    {li.location && (
                      <div style={s.statCell}>
                        <p style={{ ...s.statValue, fontSize: '13px' }}>{li.location}</p>
                        <p style={s.statLabel}>Headquarters</p>
                      </div>
                    )}
                    {enriched.linkedin_url && (
                      <div style={s.statCell}>
                        <a href={enriched.linkedin_url} target="_blank" rel="noreferrer"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', letterSpacing: '0.04em', fontWeight: '600', textDecoration: 'none' }}>
                          View page ↗
                        </a>
                        <p style={s.statLabel}>LinkedIn</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                {li.description && (
                  <p style={s.description}>{li.description}</p>
                )}

                {/* No data found */}
                {!li.followers && !li.employee_count && !li.location && !enriched.linkedin_url && !li.description && (
                  <div style={{ padding: '16px 0', borderTop: '1px dashed var(--border-dash)' }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
                      No LinkedIn data found automatically — you can still add this company and fill in details manually.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!selected && (
          <div style={{ marginTop: '64px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: '#c4c1bd', border: '1px solid #c4c1bd', borderRadius: '8px', overflow: 'hidden' }}>
            {[
              { value: '250M+', label: 'Companies indexed' },
              { value: 'Free',  label: 'No API key needed' },
              { value: 'Live',  label: 'Real-time search' },
            ].map(({ value, label }) => (
              <div key={label} style={{ background: 'var(--bg)', padding: '24px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1, marginBottom: '6px' }}>{value}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

const s = {
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '14px' },
  heroTitle: { fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 7vw, 72px)', fontWeight: '400', letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1.05, marginBottom: '16px' },
  heroSub: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.8, maxWidth: '480px', letterSpacing: '0.02em' },

  searchWrap: { display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 16px', boxShadow: '0 2px 12px rgba(29,27,27,0.06)', transition: 'border-color 0.15s' },
  searchIcon: { fontFamily: 'var(--font-mono)', fontSize: '16px', color: 'var(--text-muted)', marginRight: '10px', flexShrink: 0 },
  searchInput: { flex: 1, padding: '16px 0', border: 'none', background: 'transparent', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text)', outline: 'none', letterSpacing: '0.01em' },
  clearBtn: { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', padding: '4px 6px', marginLeft: '4px' },

  dropdown: { position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 32px rgba(29,27,27,0.10)', zIndex: 50, overflow: 'hidden' },
  suggItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px', cursor: 'pointer', transition: 'background 0.1s' },
  logo: { width: '28px', height: '28px', borderRadius: '6px', objectFit: 'contain', flexShrink: 0, border: '1px solid var(--border)' },
  logoPlaceholder: { width: '28px', height: '28px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', flexShrink: 0 },
  suggName: { fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text)', fontWeight: '500' },
  suggDomain: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px', letterSpacing: '0.02em' },
  suggArrow: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 },

  card: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 16px rgba(29,27,27,0.06)' },
  cardLogo: { width: '44px', height: '44px', borderRadius: '8px', objectFit: 'contain', border: '1px solid var(--border)', flexShrink: 0 },
  cardLogoPlaceholder: { width: '44px', height: '44px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text-muted)', flexShrink: 0 },
  cardName: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1 },
  cardDomain: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', letterSpacing: '0.02em' },

  addBtn: { padding: '9px 16px', background: '#1d1b1b', border: 'none', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: '#fdfdfd', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
  addedBadge: { padding: '9px 14px', background: 'rgba(74,124,89,0.08)', border: '1px solid rgba(74,124,89,0.25)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: '#4a7c59', whiteSpace: 'nowrap', flexShrink: 0 },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '1px', background: '#c4c1bd', border: '1px solid #c4c1bd', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' },
  statCell: { background: 'var(--bg)', padding: '14px 16px' },
  statValue: { fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1, marginBottom: '4px' },
  statLabel: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' },
  description: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.8, letterSpacing: '0.01em', paddingTop: '14px', borderTop: '1px dashed var(--border-dash)' },
}
