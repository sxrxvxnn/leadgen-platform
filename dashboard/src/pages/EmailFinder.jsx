import { useState } from 'react'
import api from '../services/api'

const SANS = "var(--font-sans,'Host Grotesk',sans-serif)"
const MONO = "var(--font-mono,'IBM Plex Mono',monospace)"

const INPUT_STYLE = {
  width: '100%',
  padding: '10px 13px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontFamily: MONO,
  fontSize: 12,
  color: 'var(--text)',
  outline: 'none',
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
  marginBottom: 6,
}

const PROVIDER_LABELS = {
  web_search: { label: 'Found via web search', color: '#22c55e' },
  site_pattern: { label: 'Pattern from company site', color: '#3b82f6' },
  smtp: { label: 'SMTP verified', color: '#22c55e' },
  pattern: { label: 'Best-guess pattern', color: '#f59e0b' },
  web: { label: 'Found via web', color: '#22c55e' },
  site: { label: 'Found on company site', color: '#3b82f6' },
}

function ScoreBar({ score }) {
  const pct = Math.min(score || 0, 100)
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#3b82f6' : pct >= 20 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          flex: 1,
          height: 4,
          background: 'var(--border)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 2,
            transition: 'width 0.4s',
          }}
        />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color, minWidth: 28 }}>
        {pct}%
      </span>
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      onClick={copy}
      style={{
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        padding: '3px 8px',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 5,
        color: copied ? '#22c55e' : 'var(--text-muted)',
        cursor: 'pointer',
      }}
    >
      {copied ? 'COPIED' : 'COPY'}
    </button>
  )
}

export default function EmailFinder() {
  const [form, setForm] = useState({ first_name: '', last_name: '', domain: '', company: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // Domain contacts search
  const [dcDomain, setDcDomain] = useState('')
  const [dcLoading, setDcLoading] = useState(false)
  const [dcContacts, setDcContacts] = useState(null)
  const [dcError, setDcError] = useState('')

  function set(k, v) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  async function findEmail(e) {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.domain) {
      setError('First name, last name and domain are required.')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await api.post('/prospect/find-email', form)
      setResult(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Search failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function findDomainContacts(e) {
    e.preventDefault()
    if (!dcDomain) return
    setDcLoading(true)
    setDcError('')
    setDcContacts(null)
    try {
      const res = await api.post('/prospect/domain-contacts', {
        domain: dcDomain.replace(/^https?:\/\//, '').split('/')[0],
      })
      setDcContacts(res.data)
    } catch (err) {
      setDcError(err?.response?.data?.detail || 'Search failed.')
    } finally {
      setDcLoading(false)
    }
  }

  const providerMeta = result?.provider
    ? PROVIDER_LABELS[result.provider] || { label: result.provider, color: 'var(--text-muted)' }
    : null

  return (
    <div style={{ padding: '36px 40px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
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
            Email Finder
          </h1>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: '#22c55e',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 5,
              padding: '3px 8px',
            }}
          >
            PROPRIETARY
          </span>
        </div>
        <p style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Find anyone's work email — web search · company site scraping · SMTP verification · no
          external APIs
        </p>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}
      >
        {/* ── Email finder form ── */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h2
            style={{
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text)',
              margin: '0 0 20px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Find email by name
          </h2>
          <form onSubmit={findEmail}>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}
            >
              <div>
                <label style={LABEL_STYLE}>First name</label>
                <input
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  placeholder="John"
                  style={INPUT_STYLE}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Last name</label>
                <input
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                  placeholder="Smith"
                  style={INPUT_STYLE}
                />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL_STYLE}>Company domain</label>
              <input
                value={form.domain}
                onChange={(e) =>
                  set('domain', e.target.value.replace(/^https?:\/\//, '').split('/')[0])
                }
                placeholder="stripe.com"
                style={INPUT_STYLE}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={LABEL_STYLE}>Company name (optional)</label>
              <input
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
                placeholder="Stripe"
                style={INPUT_STYLE}
              />
            </div>
            {error && (
              <p style={{ fontFamily: MONO, fontSize: 11, color: '#E7000B', margin: '0 0 14px' }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px',
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
              {loading ? 'Searching…' : 'Find Email'}
            </button>
          </form>
        </div>

        {/* ── Result panel ── */}
        <div>
          {result ? (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 24,
              }}
            >
              {result.found ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: '#22c55e',
                        background: 'rgba(34,197,94,0.1)',
                        border: '1px solid rgba(34,197,94,0.25)',
                        borderRadius: 5,
                        padding: '3px 8px',
                      }}
                    >
                      EMAIL FOUND
                    </span>
                    {providerMeta && (
                      <span style={{ fontFamily: MONO, fontSize: 10, color: providerMeta.color }}>
                        {providerMeta.label}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '14px 16px',
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--text)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {result.email}
                    </span>
                    <CopyButton text={result.email} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <p
                      style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        color: 'var(--text-muted)',
                        margin: '0 0 8px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Confidence score
                    </p>
                    <ScoreBar score={result.score} />
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <p
                    style={{
                      fontFamily: MONO,
                      fontSize: 13,
                      color: 'var(--text-muted)',
                      margin: '0 0 8px',
                    }}
                  >
                    No email found
                  </p>
                  <p
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      margin: 0,
                    }}
                  >
                    Try domain contacts search or add manually.
                  </p>
                </div>
              )}

              {result.patterns && result.patterns.length > 0 && (
                <div>
                  <p
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      color: 'var(--text-muted)',
                      margin: '0 0 10px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Likely patterns to try
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.patterns.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 11,
                            color: i === 0 ? 'var(--text)' : 'var(--text-muted)',
                          }}
                        >
                          {p}
                        </span>
                        <CopyButton text={p} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : !loading ? (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 32,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text)',
                  margin: '0 0 6px',
                }}
              >
                Enter details to find an email
              </p>
              <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                Uses web search, site scraping, and SMTP verification
              </p>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 32,
                textAlign: 'center',
              }}
            >
              <p style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Searching across web, company site, and SMTP…
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Domain contacts (Hunter domain search replacement) ── */}
      <div
        style={{
          marginTop: 32,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h2
            style={{
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Domain contacts
          </h2>
          <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)' }}>
            — find all emails at a company
          </span>
        </div>
        <p
          style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px' }}
        >
          Scrapes team, about, contact, and leadership pages. No API credits used.
        </p>
        <form onSubmit={findDomainContacts} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <input
            value={dcDomain}
            onChange={(e) => setDcDomain(e.target.value)}
            placeholder="e.g. stripe.com"
            style={{ ...INPUT_STYLE, flex: 1 }}
          />
          <button
            type="submit"
            disabled={dcLoading || !dcDomain}
            style={{
              padding: '10px 20px',
              background: 'var(--text)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: 8,
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.07em',
              cursor: dcLoading || !dcDomain ? 'default' : 'pointer',
              opacity: dcLoading || !dcDomain ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {dcLoading ? 'Scraping…' : 'Find contacts'}
          </button>
        </form>

        {dcError && (
          <p style={{ fontFamily: MONO, fontSize: 11, color: '#E7000B', margin: '0 0 12px' }}>
            {dcError}
          </p>
        )}

        {dcContacts &&
          (dcContacts.total === 0 ? (
            <p style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              No public emails found on {dcContacts.domain}. Try the email finder above.
            </p>
          ) : (
            <>
              <p style={{ fontFamily: MONO, fontSize: 11, color: '#22c55e', margin: '0 0 12px' }}>
                {dcContacts.total} email{dcContacts.total !== 1 ? 's' : ''} found at{' '}
                {dcContacts.domain}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 8,
                }}
              >
                {dcContacts.contacts.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 7,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 12,
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.email}
                    </span>
                    <CopyButton text={c.email} />
                  </div>
                ))}
              </div>
            </>
          ))}
      </div>

      {/* How it works */}
      <div
        style={{
          marginTop: 24,
          padding: '18px 20px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
        }}
      >
        <p
          style={{
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
            margin: '0 0 12px',
            textTransform: 'uppercase',
          }}
        >
          How it works
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            ['01', 'Web search', 'Searches web for publicly mentioned emails'],
            ['02', 'Site scrape', 'Crawls company pages for real email addresses'],
            ['03', 'Pattern match', 'Detects company email format from scraped data'],
            ['04', 'SMTP check', 'Verifies the mailbox exists via SMTP handshake'],
          ].map(([n, title, desc]) => (
            <div key={n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#E7000B' }}>
                  {n}
                </span>
                <span
                  style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: 'var(--text)' }}
                >
                  {title}
                </span>
              </div>
              <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
