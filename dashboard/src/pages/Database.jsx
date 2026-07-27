import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'

const SANS = "var(--font-sans,'Host Grotesk',sans-serif)"
const MONO = "var(--font-mono,'IBM Plex Mono',monospace)"

const INPUT_STYLE = {
  padding: '9px 12px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontFamily: MONO,
  fontSize: 12,
  color: 'var(--text)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}
const LABEL_STYLE = {
  fontFamily: MONO,
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.12em',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 5,
}

function StatCard({ label, value, sub }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '18px 20px',
      }}
    >
      <p
        style={{
          fontFamily: MONO,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.12em',
          color: 'var(--text-muted)',
          margin: '0 0 6px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: MONO,
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--text)',
          margin: '0 0 3px',
          letterSpacing: '-1px',
        }}
      >
        {value?.toLocaleString() ?? '—'}
      </p>
      {sub && (
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function ContactRow({ contact, onAdd, addedIds }) {
  const isAdded = addedIds.has(contact.id)
  const name = contact.full_name || '—'
  const initials =
    name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  const hue = name.charCodeAt(0) % 360

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 160px 190px 100px 110px',
        gap: 12,
        alignItems: 'center',
        padding: '11px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            flexShrink: 0,
            background: `hsl(${hue},45%,22%)`,
            border: `1px solid hsl(${hue},45%,32%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 700,
              color: `hsl(${hue},70%,65%)`,
            }}
          >
            {initials}
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </p>
          <p
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: 'var(--text-muted)',
              margin: '2px 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {[contact.job_title, contact.job_company_name].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </div>

      {/* Location */}
      <p
        style={{
          fontFamily: MONO,
          fontSize: 11,
          color: 'var(--text-muted)',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {[contact.location_locality, contact.location_country].filter(Boolean).join(', ') || '—'}
      </p>

      {/* Email */}
      <p
        style={{
          fontFamily: MONO,
          fontSize: 11,
          color: contact.email ? 'var(--text)' : 'var(--text-muted)',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {contact.email || '—'}
      </p>

      {/* Source badge */}
      <div>
        {contact.source === 'github' && contact.github_url ? (
          <a
            href={contact.github_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.08em',
              padding: '3px 8px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text-muted)',
              textDecoration: 'none',
            }}
          >
            GITHUB
          </a>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)' }}>
            {contact.source || '—'}
          </span>
        )}
      </div>

      {/* Add button */}
      <button
        onClick={() => !isAdded && onAdd(contact)}
        disabled={isAdded}
        style={{
          fontFamily: MONO,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.07em',
          padding: '5px 12px',
          background: isAdded ? 'var(--surface)' : 'var(--text)',
          color: isAdded ? 'var(--text-muted)' : 'var(--bg)',
          border: isAdded ? '1px solid var(--border)' : 'none',
          borderRadius: 5,
          cursor: isAdded ? 'default' : 'pointer',
        }}
      >
        {isAdded ? 'Added' : 'Add'}
      </button>
    </div>
  )
}

export default function Database() {
  const [scraping, setScraping] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState('')
  const [stats, setStats] = useState(null)
  const [contacts, setContacts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [addedIds, setAddedIds] = useState(new Set())

  // Continuous mode state
  const [continuous, setContinuous] = useState(false)
  const [sessionScraped, setSessionScraped] = useState(0)
  const [sessionAdded, setSessionAdded] = useState(0)
  const [roundsDone, setRoundsDone] = useState(0)
  const loopRef = useRef(false)

  const [q, setQ] = useState('')
  const [company, setCompany] = useState('')
  const [domain, setDomain] = useState('')
  const [location, setLocation] = useState('')

  useEffect(() => {
    api
      .get('/database/stats')
      .then((r) => setStats(r.data))
      .catch(() => {})
  }, [])

  async function runOnce() {
    setScraping(true)
    setScrapeMsg('')
    try {
      const res = await api.post('/database/scrape', {}, { timeout: 180000 })
      const { upserted = 0, scraped = 0 } = res.data
      setScrapeMsg(`Done — scraped ${scraped}, added ${upserted} new contacts.`)
      api
        .get('/database/stats')
        .then((r) => setStats(r.data))
        .catch(() => {})
    } catch (e) {
      setScrapeMsg(e?.response?.data?.detail || 'Scrape failed — check logs.')
    } finally {
      setScraping(false)
    }
  }

  async function startContinuous() {
    loopRef.current = true
    setContinuous(true)
    setScrapeMsg('')
    setSessionScraped(0)
    setSessionAdded(0)
    setRoundsDone(0)

    while (loopRef.current) {
      setScraping(true)
      try {
        const res = await api.post('/database/scrape', {}, { timeout: 180000 })
        const { upserted = 0, scraped = 0 } = res.data
        setSessionScraped((prev) => prev + scraped)
        setSessionAdded((prev) => prev + upserted)
        setRoundsDone((prev) => prev + 1)
        api
          .get('/database/stats')
          .then((r) => setStats(r.data))
          .catch(() => {})
      } catch (e) {
        setScrapeMsg(e?.response?.data?.detail || 'Scrape failed — stopping.')
        loopRef.current = false
        break
      } finally {
        setScraping(false)
      }
      if (!loopRef.current) break
      // Brief pause between rounds to avoid hammering the API
      await new Promise((r) => setTimeout(r, 3000))
    }

    setContinuous(false)
    loopRef.current = false
  }

  function stopContinuous() {
    loopRef.current = false
    setContinuous(false)
    setScrapeMsg(`Stopped after ${roundsDone} rounds — ${sessionAdded} new contacts collected.`)
  }

  const search = useCallback(
    async (p = 1) => {
      setLoading(true)
      setPage(p)
      try {
        const res = await api.post('/database/search', {
          q,
          company,
          domain,
          location,
          page: p,
          per_page: 25,
        })
        setContacts(res.data.contacts || [])
        setTotal(res.data.total || 0)
        setTotalPages(res.data.total_pages || 1)
        setSearched(true)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    },
    [q, company, domain, location]
  )

  async function handleAdd(contact) {
    try {
      await api.post('/prospect/add-lead', {
        person: {
          full_name: contact.full_name,
          first_name: contact.first_name,
          last_name: contact.last_name,
          work_email: contact.email,
          job_title: contact.job_title,
          job_company_name: contact.job_company_name,
          linkedin_url: contact.linkedin_url,
          github_url: contact.github_url,
          location_locality: contact.location_locality,
          location_country: contact.location_country,
        },
      })
      setAddedIds((prev) => new Set([...prev, contact.id]))
    } catch {
      /* ignore */
    }
  }

  const isRunning = scraping || continuous

  return (
    <div style={{ padding: '36px 40px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h1
            style={{
              fontFamily: SANS,
              fontSize: 26,
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
              letterSpacing: '-0.5px',
            }}
          >
            Sonar Database
          </h1>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: '#E7000B',
              background: 'rgba(231,0,11,0.08)',
              border: '1px solid rgba(231,0,11,0.2)',
              borderRadius: 5,
              padding: '3px 8px',
            }}
          >
            PROPRIETARY
          </span>
        </div>
        <p style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Your own contact database — built from GitHub + company sites. Grows daily via cron.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 14,
            marginBottom: 28,
          }}
        >
          <StatCard label="Total contacts" value={stats.total} sub="across all sources" />
          <StatCard
            label="With email"
            value={stats.with_email}
            sub={
              stats.total ? `${Math.round((stats.with_email / stats.total) * 100)}% coverage` : ''
            }
          />
          <StatCard label="GitHub profiles" value={stats.by_source?.github} sub="from GitHub API" />

          {/* Scraper control card */}
          <div
            style={{
              background: 'var(--surface)',
              border: `1px solid ${continuous ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '18px 20px',
              transition: 'border-color 0.2s',
            }}
          >
            <p
              style={{
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
                margin: '0 0 6px',
                textTransform: 'uppercase',
              }}
            >
              Scraper
            </p>

            {/* Status dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: continuous ? '#f59e0b' : scraping ? '#f59e0b' : '#22c55e',
                  boxShadow: `0 0 6px ${continuous || scraping ? '#f59e0b' : '#22c55e'}`,
                  animation: continuous || scraping ? 'pulse 1.2s infinite' : 'none',
                }}
              />
              <span
                style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}
              >
                {continuous ? `Round ${roundsDone + 1}…` : scraping ? 'Scraping…' : 'Idle'}
              </span>
            </div>

            {/* Continuous progress */}
            {continuous && (
              <div
                style={{
                  marginBottom: 8,
                  padding: '8px 10px',
                  background: 'rgba(245,158,11,0.06)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 6,
                }}
              >
                <p
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: '#f59e0b',
                    margin: '0 0 2px',
                    fontWeight: 600,
                  }}
                >
                  {roundsDone} rounds complete
                </p>
                <p
                  style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', margin: 0 }}
                >
                  {sessionScraped} scraped · {sessionAdded} new
                </p>
              </div>
            )}

            {/* Last run info */}
            {!continuous && stats.scrape_state?.last_run && (
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  margin: '0 0 8px',
                }}
              >
                Last: {new Date(stats.scrape_state.last_run).toLocaleString()}
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {!continuous ? (
                <>
                  <button
                    onClick={runOnce}
                    disabled={isRunning}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--bg)',
                      color: isRunning ? 'var(--text-muted)' : 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontFamily: MONO,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.07em',
                      cursor: isRunning ? 'default' : 'pointer',
                    }}
                  >
                    {scraping ? 'Running…' : 'Run once'}
                  </button>
                  <button
                    onClick={startContinuous}
                    disabled={isRunning}
                    style={{
                      padding: '6px 12px',
                      background: isRunning ? 'var(--bg)' : 'var(--text)',
                      color: isRunning ? 'var(--text-muted)' : 'var(--bg)',
                      border: 'none',
                      borderRadius: 6,
                      fontFamily: MONO,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      cursor: isRunning ? 'default' : 'pointer',
                    }}
                  >
                    ▶ Run continuously
                  </button>
                </>
              ) : (
                <button
                  onClick={stopContinuous}
                  style={{
                    padding: '6px 14px',
                    background: '#b83232',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    cursor: 'pointer',
                  }}
                >
                  ■ Stop
                </button>
              )}
            </div>

            {scrapeMsg && !continuous && (
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color:
                    scrapeMsg.includes('fail') || scrapeMsg.includes('Stop')
                      ? 'var(--text-muted)'
                      : '#22c55e',
                  margin: '8px 0 0',
                  lineHeight: 1.5,
                }}
              >
                {scrapeMsg}
              </p>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* Search */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 22,
          marginBottom: 22,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: 14,
            marginBottom: 16,
          }}
        >
          <div>
            <label style={LABEL_STYLE}>Name or email</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search(1)}
              placeholder="John Smith…"
              style={INPUT_STYLE}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Company</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search(1)}
              placeholder="Stripe…"
              style={INPUT_STYLE}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Domain</label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase())}
              onKeyDown={(e) => e.key === 'Enter' && search(1)}
              placeholder="stripe.com"
              style={INPUT_STYLE}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search(1)}
              placeholder="India, USA…"
              style={INPUT_STYLE}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => search(1)}
            disabled={loading}
            style={{
              padding: '10px 28px',
              background: 'var(--text)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: 8,
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Searching…' : 'Search database'}
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)',
            }}
          >
            <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
              {total > 0 ? `${total.toLocaleString()} contacts found` : 'No results'}
            </p>
            {addedIds.size > 0 && (
              <span style={{ fontFamily: MONO, fontSize: 11, color: '#4a7c59' }}>
                {addedIds.size} added to leads
              </span>
            )}
          </div>

          {contacts.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 160px 190px 100px 110px',
                gap: 12,
                padding: '9px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg)',
              }}
            >
              {['Person', 'Location', 'Email', 'Source', 'Action'].map((h) => (
                <p
                  key={h}
                  style={{
                    fontFamily: MONO,
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    margin: 0,
                  }}
                >
                  {h}
                </p>
              ))}
            </div>
          )}

          {contacts.length === 0 && !loading && (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ fontFamily: MONO, fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                No contacts found. Try broader filters.
              </p>
            </div>
          )}

          {contacts.map((c) => (
            <ContactRow key={c.id} contact={c} onAdd={handleAdd} addedIds={addedIds} />
          ))}

          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <button
                onClick={() => search(page - 1)}
                disabled={page <= 1 || loading}
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  padding: '6px 16px',
                  background: 'transparent',
                  color: page <= 1 ? 'var(--text-muted)' : 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: page <= 1 ? 'default' : 'pointer',
                }}
              >
                Prev
              </button>
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => search(page + 1)}
                disabled={page >= totalPages || loading}
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  padding: '6px 16px',
                  background: 'transparent',
                  color: page >= totalPages ? 'var(--text-muted)' : 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: page >= totalPages ? 'default' : 'pointer',
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {!searched && !loading && (
        <div style={{ textAlign: 'center', padding: '70px 20px' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
          <p
            style={{
              fontFamily: SANS,
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text)',
              margin: '0 0 6px',
            }}
          >
            Search your database
          </p>
          <p
            style={{
              fontFamily: MONO,
              fontSize: 12,
              color: 'var(--text-muted)',
              margin: '0 0 20px',
            }}
          >
            {stats?.total
              ? `${stats.total.toLocaleString()} contacts available — growing daily via GitHub cron.`
              : 'Database is being built — cron runs daily at 2am UTC.'}
          </p>
        </div>
      )}
    </div>
  )
}
