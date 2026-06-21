import React, { useState, useRef, useEffect, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { prefillCompany, createCompany, mapsDiscover, bulkCreateCompanies } from '../services/api'

// Leaflet default icon fix for bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Nominatim geocoder — converts location string to lat/lng (no API key needed)
async function geocodeLocation(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {}
  return null
}

function makeMarkerIcon(color, selected) {
  const size = selected ? 14 : 10
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px; height:${size}px; border-radius:50%;
      background:${color}; border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.35);
      transition:width 0.15s,height 0.15s;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function DiscoverMap({ results, selected, onToggle, locationStr, searching }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const markersRef   = useRef([])   // [{ key, marker }]
  const geocodedRef  = useRef(false)

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    mapRef.current = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      center: [20, 78],   // fallback: India
      zoom: 5,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current)
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      geocodedRef.current = false
    }
  }, [])

  // Fly to searched location (once per search string)
  useEffect(() => {
    if (!mapRef.current || !locationStr || geocodedRef.current) return
    geocodedRef.current = true
    geocodeLocation(locationStr).then(pos => {
      if (pos && mapRef.current) mapRef.current.flyTo([pos.lat, pos.lng], 11, { duration: 1.2 })
    })
  }, [locationStr])

  // Sync markers with results
  useEffect(() => {
    if (!mapRef.current) return

    // Remove stale markers
    const resultKeys = new Set(results.map(r => r.domain || r.name))
    markersRef.current = markersRef.current.filter(({ key, marker }) => {
      if (!resultKeys.has(key)) { marker.remove(); return false }
      return true
    })

    const existing = new Map(markersRef.current.map(m => [m.key, m.marker]))
    const bounds = []

    results.forEach((r, i) => {
      if (!r.lat || !r.lng) return
      const key = r.domain || r.name
      const isSel = selected.has(key)
      const color = isSel ? '#4a7c59' : '#a86448'

      if (existing.has(key)) {
        // Update icon if selection changed
        existing.get(key).setIcon(makeMarkerIcon(color, isSel))
      } else {
        const marker = L.marker([r.lat, r.lng], { icon: makeMarkerIcon(color, isSel) })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="font-family:monospace;font-size:11px;line-height:1.5;min-width:160px">
              <strong style="font-size:12px">${r.name}</strong><br/>
              ${r.address ? `<span style="color:#6e6e6e">📍 ${r.address}</span><br/>` : ''}
              ${r.domain  ? `<span style="color:#5b8db8">🌐 ${r.domain}</span><br/>` : ''}
              ${r.rating  ? `<span style="color:#a08030">★ ${r.rating} (${r.rating_count})</span>` : ''}
            </div>
          `, { maxWidth: 240 })
        marker.on('click', () => { onToggle(key); marker.openPopup() })
        markersRef.current.push({ key, marker })
        bounds.push([r.lat, r.lng])
      }
    })

    if (bounds.length && mapRef.current) {
      const allBounds = results.filter(r => r.lat).map(r => [r.lat, r.lng])
      if (allBounds.length > 1) mapRef.current.fitBounds(allBounds, { padding: [40, 40], maxZoom: 14 })
      else if (allBounds.length === 1) mapRef.current.setView(allBounds[0], 13)
    }
  }, [results, selected, onToggle])

  return (
    <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(29,27,27,0.06)' }}>
      <div ref={containerRef} style={{ height: '380px', width: '100%' }} />

      {/* Searching overlay */}
      {searching && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(253,253,253,0.82)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 4px 16px rgba(29,27,27,0.10)' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid #4a7c59', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Scanning…</span>
          </div>
        </div>
      )}

      {/* Result count badge */}
      {results.length > 0 && !searching && (
        <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 500, padding: '4px 10px', background: 'rgba(253,253,253,0.92)', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', color: 'var(--text)', letterSpacing: '0.04em', backdropFilter: 'blur(4px)' }}>
          {results.filter(r => r.lat).length} locations mapped
        </div>
      )}
    </div>
  )
}

export default function CompanyDiscovery() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSugg, setShowSugg] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [selected, setSelected] = useState(null)
  const [enriching, setEnriching] = useState(false)
  const [enriched, setEnriched] = useState(null)
  const [addState, setAddState] = useState({})

  const debounceRef = useRef(null)
  const suggRef     = useRef(null)
  const inputRef    = useRef(null)

  const [mode, setMode] = useState('search')

  // Discover state
  const [discQuery,    setDiscQuery]    = useState('')
  const [discLocation, setDiscLocation] = useState('')
  const [discRadius,   setDiscRadius]   = useState(50)
  const [discLoading,  setDiscLoading]  = useState(false)
  const [discError,    setDiscError]    = useState('')
  const [discResults,  setDiscResults]  = useState([])
  const [discSelected, setDiscSelected] = useState(new Set())
  const [discAdding,   setDiscAdding]   = useState(false)
  const [discMsg,      setDiscMsg]      = useState('')

  // ── Clearbit autocomplete ──────────────────────────────────────
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
    if (!showSugg || !suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pickSuggestion(suggestions[activeIdx]) }
    else if (e.key === 'Escape') setShowSugg(false)
  }

  useEffect(() => {
    function onClick(e) { if (suggRef.current && !suggRef.current.contains(e.target)) setShowSugg(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function pickSuggestion(s) {
    setShowSugg(false); setQuery(s.name); setSuggestions([])
    setSelected(s); setEnriched(null); setEnriching(true)
    try {
      const res = await prefillCompany(s.name, s.domain ? `https://${s.domain}` : '')
      setEnriched(res.data)
    } catch {
      setEnriched({ name: s.name, website_url: s.domain ? `https://${s.domain}` : '', linkedin_data: {} })
    } finally { setEnriching(false) }
  }

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

  // ── Discover ───────────────────────────────────────────────────
  async function handleDiscover() {
    if (!discQuery.trim()) { setDiscError('Enter a search query.'); return }
    setDiscLoading(true); setDiscError(''); setDiscResults([]); setDiscSelected(new Set())
    try {
      const res = await mapsDiscover({
        query: discQuery.trim(),
        location: discLocation.trim(),
        radius_km: discRadius,
        max_results: 20,
      })
      setDiscResults(res.data.results || [])
      if (!res.data.results?.length) setDiscError('No results — try a broader query or different location.')
    } catch (e) {
      setDiscError(e.response?.data?.detail || e.message || 'Search failed')
    } finally { setDiscLoading(false) }
  }

  const discToggle = useCallback((key) => {
    setDiscSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  async function discAddSelected() {
    const toAdd = discResults.filter(r => discSelected.has(r.domain || r.name))
    if (!toAdd.length) return
    setDiscAdding(true)
    try {
      const payload = toAdd.map(r => ({ name: r.name, website: r.website || null, headquarters: r.address || null }))
      const res = await bulkCreateCompanies(payload)
      const { inserted, updated } = res.data
      setDiscMsg(`✓ ${inserted} added${updated ? ` · ${updated} updated` : ''} — use Fill All to enrich.`)
      setDiscSelected(new Set())
    } catch (e) {
      setDiscMsg('Error: ' + e.message)
    } finally {
      setDiscAdding(false)
      setTimeout(() => setDiscMsg(''), 6000)
    }
  }

  function fmtNumber(n) {
    if (!n) return null
    const num = parseInt(String(n).replace(/,/g, ''), 10)
    if (isNaN(num)) return String(n)
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    return String(num)
  }

  const li = enriched?.linkedin_data || {}
  const addKey = selected?.domain || enriched?.name
  const addStatus = addState[addKey] || 'idle'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: mode === 'discover' ? '860px' : '720px', margin: '0 auto', padding: '72px 32px 80px', transition: 'max-width 0.3s' }}>

        <p style={s.eyebrow}>Company Discovery</p>
        <h1 style={s.heroTitle}>Find your<br />next target.</h1>
        <p style={s.heroSub}>
          Search millions of companies by name, or discover businesses on a live map using Google Maps.
        </p>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: '3px', marginTop: '32px', marginBottom: '32px', background: 'var(--surface)', borderRadius: '8px', padding: '3px', width: 'fit-content' }}>
          <button onClick={() => setMode('search')}
            style={{ ...s.modeBtn, background: mode === 'search' ? '#1d1b1b' : 'transparent', color: mode === 'search' ? '#fdfdfd' : 'var(--text-muted)' }}>
            Search by name
          </button>
          <button onClick={() => setMode('discover')}
            style={{ ...s.modeBtn, background: mode === 'discover' ? '#2a4a35' : 'transparent', color: mode === 'discover' ? '#fdfdfd' : '#4a7c59' }}>
            ⊕ Discover nearby
          </button>
        </div>

        {/* ── SEARCH MODE ── */}
        {mode === 'search' && (
          <>
            <div style={{ position: 'relative' }} ref={suggRef}>
              <div style={s.searchWrap}>
                <span style={s.searchIcon}>↗</span>
                <input ref={inputRef} type="text" value={query}
                  onChange={handleQueryChange} onKeyDown={handleKeyDown}
                  onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                  placeholder="Search any company — Stripe, Sequantix, Beagle Security…"
                  style={s.searchInput} autoComplete="off" />
                {query && (
                  <button onClick={() => { setQuery(''); setSuggestions([]); setShowSugg(false); setSelected(null); setEnriched(null); inputRef.current?.focus() }}
                    style={s.clearBtn}>✕</button>
                )}
              </div>

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

            {selected && (
              <div style={{ marginTop: '28px' }}>
                {enriching && (
                  <div style={s.card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {selected.logo
                        ? <img src={selected.logo} alt="" style={s.cardLogo} onError={e => { e.target.style.display = 'none' }} />
                        : <div style={s.cardLogoPlaceholder}>{selected.name[0]}</div>}
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

                {!enriching && enriched && (
                  <div style={s.card}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {selected?.logo
                          ? <img src={selected.logo} alt="" style={s.cardLogo} onError={e => { e.target.style.display = 'none' }} />
                          : <div style={s.cardLogoPlaceholder}>{(enriched.name || selected?.name || '?')[0]}</div>}
                        <div>
                          <p style={s.cardName}>{enriched.name || selected?.name}</p>
                          <p style={s.cardDomain}>{selected?.domain || enriched.website_url?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</p>
                        </div>
                      </div>
                      {addStatus === 'added'
                        ? <div style={s.addedBadge}>✓ Added to pipeline</div>
                        : <button onClick={addToPipeline} disabled={addStatus === 'adding'}
                            style={{ ...s.addBtn, opacity: addStatus === 'adding' ? 0.6 : 1 }}>
                            {addStatus === 'adding' ? 'Adding…' : 'Add to Pipeline →'}
                          </button>
                      }
                    </div>

                    {(li.followers || li.employee_count || li.location || enriched.linkedin_url) && (
                      <div style={s.statsGrid}>
                        {li.followers && <div style={s.statCell}><p style={s.statValue}>{fmtNumber(String(li.followers).replace(/[^0-9]/g, ''))}</p><p style={s.statLabel}>Followers</p></div>}
                        {li.employee_count && <div style={s.statCell}><p style={s.statValue}>{fmtNumber(li.employee_count)}</p><p style={s.statLabel}>Employees</p></div>}
                        {li.location && <div style={s.statCell}><p style={{ ...s.statValue, fontSize: '13px' }}>{li.location}</p><p style={s.statLabel}>Headquarters</p></div>}
                        {enriched.linkedin_url && (
                          <div style={s.statCell}>
                            <a href={enriched.linkedin_url} target="_blank" rel="noreferrer"
                              style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', letterSpacing: '0.04em', fontWeight: '600', textDecoration: 'none' }}>View page ↗</a>
                            <p style={s.statLabel}>LinkedIn</p>
                          </div>
                        )}
                      </div>
                    )}

                    {li.description && <p style={s.description}>{li.description}</p>}

                    {!li.followers && !li.employee_count && !li.location && !enriched.linkedin_url && !li.description && (
                      <div style={{ padding: '16px 0', borderTop: '1px solid var(--border)' }}>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
                          No LinkedIn data found — you can still add this company and fill details manually.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!selected && (
              <div style={{ marginTop: '64px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: '#c4c1bd', border: '1px solid #c4c1bd', borderRadius: '8px', overflow: 'hidden' }}>
                {[{ value: '250M+', label: 'Companies indexed' }, { value: 'Free', label: 'No API key needed' }, { value: 'Live', label: 'Real-time search' }].map(({ value, label }) => (
                  <div key={label} style={{ background: 'var(--bg)', padding: '24px', textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1, marginBottom: '6px' }}>{value}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── DISCOVER MODE ── */}
        {mode === 'discover' && (
          <>
            {/* Search form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={s.discLabel}>Industry / Query *</label>
                <input value={discQuery} onChange={e => setDiscQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDiscover()}
                  placeholder='e.g. "SaaS companies" or "cybersecurity firms"'
                  style={s.discInput} />
              </div>
              <div>
                <label style={s.discLabel}>Location</label>
                <input value={discLocation} onChange={e => setDiscLocation(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDiscover()}
                  placeholder='e.g. "Bangalore" or "Singapore"'
                  style={s.discInput} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <label style={{ ...s.discLabel, margin: 0, whiteSpace: 'nowrap' }}>
                Radius: <strong>{discRadius} km</strong>
              </label>
              <input type="range" min="5" max="200" step="5"
                value={discRadius} onChange={e => setDiscRadius(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#4a7c59', cursor: 'pointer' }} />
              <button onClick={handleDiscover} disabled={discLoading || !discQuery.trim()}
                style={{ ...s.addBtn, background: '#2a4a35', opacity: (discLoading || !discQuery.trim()) ? 0.5 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {discLoading ? 'Searching…' : 'Search ⊕'}
              </button>
            </div>


            {discError && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', marginBottom: '14px', padding: '10px 14px', background: 'rgba(184,50,50,0.06)', borderRadius: '7px', border: '1px solid rgba(184,50,50,0.15)' }}>
                {discError}
              </div>
            )}

            {/* Map — shown whenever discover mode is active */}
            <DiscoverMap
              results={discResults}
              selected={discSelected}
              onToggle={discToggle}
              locationStr={discLocation}
              searching={discLoading}
            />

            {/* Results list below map */}
            {discResults.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', flex: 1 }}>
                    {discResults.length} results · click map pins or list rows to select
                  </span>
                  {discSelected.size > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#4a7c59', fontWeight: '600' }}>
                      {discSelected.size} selected
                    </span>
                  )}
                  <button onClick={() => setDiscSelected(new Set(discResults.map(r => r.domain || r.name)))}
                    style={s.linkBtn}>Select all</button>
                  {discSelected.size > 0 && (
                    <button onClick={() => setDiscSelected(new Set())} style={s.linkBtn}>Clear</button>
                  )}
                </div>

                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                    {discResults.map((r, i) => {
                      const key = r.domain || r.name
                      const checked = discSelected.has(key)
                      return (
                        <div key={i} onClick={() => discToggle(key)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '10px',
                            padding: '10px 14px', cursor: 'pointer',
                            background: checked ? 'rgba(74,124,89,0.05)' : 'transparent',
                            borderBottom: '1px solid var(--border-subtle)',
                            borderRight: '1px solid var(--border-subtle)',
                            transition: 'background 0.1s',
                          }}>
                          <div style={{ width: '18px', flexShrink: 0, paddingTop: '2px', display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: checked ? '#4a7c59' : 'rgba(168,100,72,0.5)', flexShrink: 0 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '600', color: checked ? '#4a7c59' : 'var(--text)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.name}
                            </p>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {r.rating && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#a08030' }}>★ {r.rating}</span>}
                              {r.domain && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🌐 {r.domain}</span>}
                              {!r.lat && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(168,100,72,0.5)' }}>no coords</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {discMsg && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: discMsg.startsWith('✓') ? '#4a7c59' : 'var(--red)', padding: '8px 12px', background: discMsg.startsWith('✓') ? 'rgba(74,124,89,0.06)' : 'rgba(184,50,50,0.06)', borderRadius: '7px', border: `1px solid ${discMsg.startsWith('✓') ? 'rgba(74,124,89,0.2)' : 'rgba(184,50,50,0.15)'}`, marginBottom: '10px' }}>
                    {discMsg}
                  </div>
                )}

                <button onClick={discAddSelected} disabled={discSelected.size === 0 || discAdding}
                  style={{ ...s.addBtn, background: '#2a4a35', width: '100%', textAlign: 'center', opacity: (discSelected.size === 0 || discAdding) ? 0.45 : 1 }}>
                  {discAdding ? 'Adding…' : `Add ${discSelected.size || 0} to Pipeline →`}
                </button>
              </div>
            )}

            {/* Pre-search state */}
            {!discLoading && discResults.length === 0 && !discError && (
              <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: '#c4c1bd', border: '1px solid #c4c1bd', borderRadius: '8px', overflow: 'hidden' }}>
                {[{ value: 'Maps', label: 'Powered by Google' }, { value: '20', label: 'Results per search' }, { value: 'Live', label: 'Real map with pins' }].map(({ value, label }) => (
                  <div key={label} style={{ background: 'var(--bg)', padding: '24px', textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1, marginBottom: '6px' }}>{value}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '14px' },
    heroTitle: { fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 7vw, 72px)', fontWeight: '900', letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1.05, marginBottom: '16px' },
  heroSub: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.8, maxWidth: '520px', letterSpacing: '0.02em' },

  modeBtn: { padding: '7px 18px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', border: 'none', cursor: 'pointer', transition: 'all 0.15s' },

  searchWrap: { display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 16px', boxShadow: '0 2px 12px rgba(29,27,27,0.06)' },
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
  addBtn: { padding: '9px 18px', background: '#1d1b1b', border: 'none', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: '#fdfdfd', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
  addedBadge: { padding: '9px 14px', background: 'rgba(74,124,89,0.08)', border: '1px solid rgba(74,124,89,0.25)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: '#4a7c59', whiteSpace: 'nowrap', flexShrink: 0 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '1px', background: '#c4c1bd', border: '1px solid #c4c1bd', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' },
  statCell: { background: 'var(--bg)', padding: '14px 16px' },
  statValue: { fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1, marginBottom: '4px' },
  statLabel: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' },
  description: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.8, letterSpacing: '0.01em', paddingTop: '14px', borderTop: '1px solid var(--border)' },

  discLabel: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' },
  discInput: { width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.01em' },
  linkBtn: { background: 'none', border: 'none', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', cursor: 'pointer', padding: '2px 0', letterSpacing: '0.04em', fontWeight: '600' },
}
