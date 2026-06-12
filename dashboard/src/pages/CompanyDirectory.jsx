import React, { useState, useEffect, useMemo } from 'react'
import Navbar from '../components/Navbar'
import { getDirectory } from '../services/companyDirectory'

export default function CompanyDirectory() {
  const [query, setQuery] = useState('')
  const [directory, setDirectory] = useState([])

  useEffect(() => {
    const dir = getDirectory()
    dir.sort((a, b) => (b._savedAt || '') > (a._savedAt || '') ? 1 : -1)
    setDirectory(dir)
  }, [])

  const results = useMemo(() => {
    if (!query.trim()) return directory
    const q = query.toLowerCase()
    return directory.filter(c =>
      [c.name, c.website, c.industry, c.headquarters, c.description,
       c.classification, c.prospect_status, c.size]
        .join(' ').toLowerCase().includes(q)
    )
  }, [query, directory])

  function fmtFollowers(n) {
    if (!n) return null
    const num = parseInt(n, 10)
    if (isNaN(num)) return null
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    return String(num)
  }

  function cleanDomain(url) {
    if (!url) return null
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Hero */}
      <div style={{ position: 'relative', padding: '64px 48px 48px', borderBottom: '1px dashed var(--border-dash)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 90% at 5% 50%, rgba(168,100,72,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <p style={s.eyebrow}>Local Directory</p>
          <h1 style={s.heroTitle}>
            {directory.length}
            <span style={s.heroUnit}> companies</span>
          </h1>
          <p style={s.heroSub}>Every company you've ever tracked — saved locally, searchable offline.</p>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '32px 48px 0', borderBottom: '1px dashed var(--border-dash)' }}>
        <div style={{ position: 'relative', maxWidth: '640px', marginBottom: '32px' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: 'var(--text-muted)', pointerEvents: 'none', lineHeight: 1 }}>⌕</span>
          <input
            autoFocus
            type="text"
            placeholder="Search by name, industry, location, classification…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%', padding: '13px 120px 13px 44px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)', fontSize: '12px',
              color: 'var(--text)', outline: 'none',
              boxSizing: 'border-box', letterSpacing: '0.02em',
            }}
          />
          <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.1em', color: query ? 'var(--text-secondary)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
            {query ? `${results.length} of ${directory.length}` : `${directory.length} total`}
          </span>
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: '0 48px 80px' }}>
        {directory.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <p style={s.emptyTitle}>Nothing saved yet.</p>
            <p style={s.emptyText}>Open the Companies page and let it load — every company syncs here automatically.</p>
          </div>
        ) : results.length === 0 ? (
          <div style={{ padding: '64px 0', textAlign: 'center' }}>
            <p style={s.emptyTitle}>No results.</p>
            <p style={s.emptyText}>Try a different search term.</p>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div style={s.colHeader}>
              <span style={{ ...s.colLabel, flex: 3 }}>Company</span>
              <span style={{ ...s.colLabel, flex: 2 }}>Industry / Location</span>
              <span style={{ ...s.colLabel, width: '120px', flexShrink: 0 }}>Followers</span>
              <span style={{ ...s.colLabel, flex: 2 }}>Website</span>
              <span style={{ ...s.colLabel, width: '80px', flexShrink: 0 }}>Links</span>
            </div>
            {results.map((company, i) => (
              <div key={company.id || company.name + i} style={s.row}>
                {/* Name + badges */}
                <div style={{ flex: 3, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={s.companyName}>{company.name}</span>
                    {company.classification && (
                      <span style={s.badge}>{company.classification}</span>
                    )}
                    {company.prospect_status && company.prospect_status !== 'New' && (
                      <span style={{ ...s.badge, background: 'rgba(91,141,184,0.08)', color: '#5b8db8', borderColor: 'rgba(91,141,184,0.22)' }}>{company.prospect_status}</span>
                    )}
                  </div>
                  {company.size && (
                    <p style={s.rowSub}>{company.size}</p>
                  )}
                </div>

                {/* Industry / HQ */}
                <div style={{ flex: 2, minWidth: 0 }}>
                  {company.industry && <p style={s.rowText}>{company.industry}</p>}
                  {company.headquarters && <p style={s.rowSub}>{company.headquarters}</p>}
                </div>

                {/* Followers */}
                <div style={{ width: '120px', flexShrink: 0 }}>
                  {(company.followers_count || company.followers) && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
                      {fmtFollowers(company.followers_count || company.followers)}
                    </span>
                  )}
                </div>

                {/* Website */}
                <div style={{ flex: 2, minWidth: 0 }}>
                  {company.website && (
                    <a
                      href={company.website.startsWith('http') ? company.website : 'https://' + company.website}
                      target="_blank" rel="noreferrer"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', textDecoration: 'none', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                    >
                      {cleanDomain(company.website)}
                    </a>
                  )}
                </div>

                {/* LinkedIn link */}
                <div style={{ width: '80px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                  {company.linkedin_url && (
                    <a href={company.linkedin_url} target="_blank" rel="noreferrer"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', padding: '3px 8px', border: '1px solid rgba(168,100,72,0.3)', borderRadius: '4px', color: 'var(--accent)', textDecoration: 'none', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                      LI →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  eyebrow:     { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' },
  heroTitle:   { fontFamily: 'var(--font-display)', fontSize: 'clamp(64px, 9vw, 112px)', fontWeight: '400', letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1, marginBottom: '12px' },
  heroUnit:    { fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4.5vw, 56px)', fontWeight: '400', color: 'var(--text-muted)' },
  heroSub:     { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.02em' },
  emptyTitle:  { fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text-secondary)', marginBottom: '8px' },
  emptyText:   { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 },
  colHeader:   { display: 'flex', padding: '12px 0', borderBottom: '1px solid rgba(196,193,189,0.5)', alignItems: 'center', marginTop: '24px' },
  colLabel:    { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' },
  row:         { display: 'flex', padding: '16px 0', borderBottom: '1px solid rgba(196,193,189,0.35)', alignItems: 'center', gap: '16px' },
  companyName: { fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '400', letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1.2 },
  rowText:     { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' },
  rowSub:      { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' },
  badge:       { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', padding: '2px 7px', borderRadius: '3px', background: 'rgba(168,100,72,0.08)', color: 'var(--accent)', border: '1px solid rgba(168,100,72,0.2)', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
}
