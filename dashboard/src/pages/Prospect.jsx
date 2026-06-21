import { useState, useCallback } from 'react'
import api from '../services/api'
import { invalidateCache } from '../services/api'

const SANS = "var(--font-sans,'Host Grotesk',sans-serif)"
const MONO = "var(--font-mono,'IBM Plex Mono',monospace)"

// PDL's exact company size bucket strings
const SIZE_OPTIONS = [
  { label: '1–10',    value: '1-10' },
  { label: '11–50',   value: '11-50' },
  { label: '51–200',  value: '51-200' },
  { label: '201–500', value: '201-500' },
  { label: '501–1k',  value: '501-1000' },
  { label: '1k–5k',   value: '1001-5000' },
  { label: '5k–10k',  value: '5001-10000' },
  { label: '10k+',    value: '10001+' },
]

const TITLE_SUGGESTIONS = [
  'CEO','CTO','CFO','COO','CMO','VP Sales','VP Engineering','VP Marketing',
  'Head of Sales','Head of Engineering','Director of Engineering',
  'Director of Sales','Sales Manager','Engineering Manager',
  'Product Manager','Founder','Co-Founder','Chief of Staff',
]

function TagInput({ value, onChange, placeholder, suggestions = [] }) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const add = (tag) => {
    const t = tag.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setInput('')
    setShowSuggestions(false)
  }

  const remove = (tag) => onChange(value.filter(v => v !== tag))

  const filtered = suggestions.filter(s =>
    input && s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)
  ).slice(0, 6)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, minHeight: 40, cursor: 'text' }}
        onClick={() => document.querySelector(`input[data-tag="${placeholder}"]`)?.focus()}>
        {value.map(t => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 20, fontFamily: MONO, fontSize: 11, color: 'var(--text)' }}>
            {t}
            <button onClick={() => remove(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 13 }}>×</button>
          </span>
        ))}
        <input
          data-tag={placeholder}
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true) }}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); add(input) }
            if (e.key === 'Backspace' && !input && value.length) remove(value[value.length - 1])
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={value.length === 0 ? placeholder : ''}
          style={{ flex: 1, minWidth: 120, background: 'transparent', border: 'none', outline: 'none', fontFamily: MONO, fontSize: 12, color: 'var(--text)' }}
        />
      </div>
      {showSuggestions && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', marginTop: 4 }}>
          {filtered.map(s => (
            <button key={s} onMouseDown={() => add(s)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontFamily: MONO, fontSize: 11, color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PersonRow({ person, onAdd, addedIds }) {
  const [revealing, setRevealing] = useState(false)
  const [revealedEmail, setRevealedEmail] = useState(null)
  const isAdded = addedIds.has(person.id)

  // PDL field names
  const name     = person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || '—'
  const title    = person.job_title || ''
  const company  = person.job_company_name || ''
  const city     = person.location_city || ''
  const country  = person.location_country || ''
  const liUrl    = person.linkedin_url ? (person.linkedin_url.startsWith('http') ? person.linkedin_url : `https://${person.linkedin_url}`) : null
  const workEmail = person.work_email || (person.emails || [])[0]?.address || null

  async function revealEmail() {
    if (workEmail) { setRevealedEmail(workEmail); return }
    setRevealing(true)
    try {
      const res = await api.post('/prospect/reveal-email', { linkedin_url: person.linkedin_url, person_id: person.id })
      setRevealedEmail(res.data.email || '—')
    } catch {
      setRevealedEmail('Not found')
    } finally {
      setRevealing(false)
    }
  }

  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  const hue = name.charCodeAt(0) % 360
  const displayEmail = workEmail || revealedEmail

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 190px 150px', gap: 12, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

      {/* Name + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: `hsl(${hue},45%,25%)`, border: `1px solid hsl(${hue},45%,35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: `hsl(${hue},70%,70%)` }}>{initials}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
          <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[title, company].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </div>

      {/* Location */}
      <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {[city, country].filter(Boolean).join(', ') || '—'}
      </p>

      {/* Email */}
      <div>
        {displayEmail
          ? <p style={{ fontFamily: MONO, fontSize: 11, color: displayEmail === '—' || displayEmail === 'Not found' ? 'var(--text-muted)' : 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayEmail}</p>
          : <button onClick={revealEmail} disabled={revealing}
              style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, padding: '4px 10px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 5, cursor: revealing ? 'default' : 'pointer', letterSpacing: '0.06em' }}>
              {revealing ? 'Finding…' : 'Reveal email'}
            </button>
        }
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {liUrl && (
          <a href={liUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: MONO, fontSize: 10, color: 'var(--accent)', textDecoration: 'none', padding: '4px 8px', border: '1px solid rgba(231,0,11,0.3)', borderRadius: 5 }}>
            LI
          </a>
        )}
        <button
          onClick={() => !isAdded && onAdd(person)}
          style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', padding: '5px 14px', background: isAdded ? 'var(--surface)' : 'var(--text)', color: isAdded ? 'var(--text-muted)' : 'var(--bg)', border: isAdded ? '1px solid var(--border)' : 'none', borderRadius: 5, cursor: isAdded ? 'default' : 'pointer' }}>
          {isAdded ? 'Added' : 'Add'}
        </button>
      </div>
    </div>
  )
}

export default function Prospect() {
  const [keywords, setKeywords]     = useState('')
  const [titles, setTitles]         = useState([])
  const [companies, setCompanies]   = useState([])
  const [locations, setLocations]   = useState([])
  const [sizes, setSizes]           = useState([])

  const [results, setResults]   = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError]       = useState('')
  const [addedIds, setAddedIds] = useState(new Set())

  const hasFilters = keywords || titles.length || companies.length || locations.length || sizes.length

  async function search(p = 1) {
    if (!hasFilters) { setError('Add at least one filter to search.'); return }
    setLoading(true); setError(''); setPage(p)
    try {
      const res = await api.post('/prospect/people-search', { keywords, titles, companies, locations, sizes, page: p })
      setResults(res.data.people || [])
      setTotal(res.data.total || 0)
      setTotalPages(res.data.total_pages || 1)
      setSearched(true)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Search failed — check your Apollo API key in Vercel.')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = useCallback(async (person) => {
    setAddedIds(prev => new Set([...prev, person.id]))
    try {
      await api.post('/prospect/add-lead', { person })
      invalidateCache('/leads')
    } catch {
      setAddedIds(prev => { const s = new Set(prev); s.delete(person.id); return s })
    }
  }, [])

  function toggleSize(v) {
    setSizes(prev => prev.includes(v) ? prev.filter(s => s !== v) : [...prev, v])
  }

  return (
    <div style={{ padding: '36px 40px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: SANS, fontSize: 26, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Prospect Search</h1>
        <p style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Search 800M+ verified contacts — find the right people, add them in one click. Results are cached for 1 hour.
        </p>
      </div>

      {/* Filter card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Keywords</label>
            <input
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search(1)}
              placeholder="e.g. machine learning, security, fintech…"
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: MONO, fontSize: 12, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Locations</label>
            <TagInput value={locations} onChange={setLocations} placeholder="Add country or city…" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Job Titles</label>
            <TagInput value={titles} onChange={setTitles} placeholder="Add title…" suggestions={TITLE_SUGGESTIONS} />
          </div>
          <div>
            <label style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Companies</label>
            <TagInput value={companies} onChange={setCompanies} placeholder="Add company name…" />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Company Size</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SIZE_OPTIONS.map(s => (
              <button key={s.value} onClick={() => toggleSize(s.value)}
                style={{ padding: '5px 12px', borderRadius: 20, fontFamily: MONO, fontSize: 11, fontWeight: 500, cursor: 'pointer', transition: 'all 0.12s', background: sizes.includes(s.value) ? 'var(--text)' : 'var(--bg)', color: sizes.includes(s.value) ? 'var(--bg)' : 'var(--text-muted)', border: sizes.includes(s.value) ? '1px solid var(--text)' : '1px solid var(--border)' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {error && <p style={{ fontFamily: MONO, fontSize: 11, color: '#E7000B', margin: 0 }}>{error}</p>}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => search(1)}
            disabled={loading || !hasFilters}
            style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', padding: '10px 28px', background: hasFilters ? 'var(--text)' : 'var(--surface)', color: hasFilters ? 'var(--bg)' : 'var(--text-muted)', border: 'none', borderRadius: 8, cursor: loading || !hasFilters ? 'default' : 'pointer' }}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Results header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
              {total > 0 ? `${total.toLocaleString()} people found` : 'No results'}
            </p>
            {addedIds.size > 0 && (
              <p style={{ fontFamily: MONO, fontSize: 11, color: '#4a7c59', margin: 0 }}>
                {addedIds.size} added to leads
              </p>
            )}
          </div>

          {/* Column headers */}
          {results.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 160px 160px', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
              {['Person', 'Location', 'Email', 'Actions'].map(h => (
                <p key={h} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>{h}</p>
              ))}
            </div>
          )}

          {results.length === 0 && !loading && (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ fontFamily: MONO, fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No results. Try broader filters.</p>
            </div>
          )}

          {results.map(person => (
            <PersonRow key={person.id} person={person} onAdd={handleAdd} addedIds={addedIds} />
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => search(page - 1)} disabled={page <= 1 || loading}
                style={{ fontFamily: MONO, fontSize: 11, padding: '6px 16px', background: 'transparent', color: page <= 1 ? 'var(--text-muted)' : 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: page <= 1 ? 'default' : 'pointer' }}>
                Prev
              </button>
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
              <button onClick={() => search(page + 1)} disabled={page >= totalPages || loading}
                style={{ fontFamily: MONO, fontSize: 11, padding: '6px 16px', background: 'transparent', color: page >= totalPages ? 'var(--text-muted)' : 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: page >= totalPages ? 'default' : 'pointer' }}>
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {!searched && !loading && (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>Start prospecting</p>
          <p style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Add job titles, companies, or locations — then hit Search.</p>
        </div>
      )}
    </div>
  )
}
