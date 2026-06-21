import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
const DISPLAY  = "var(--font-display, 'Barlow Condensed', sans-serif)"
const MONO     = "var(--font-mono, 'IBM Plex Mono', monospace)"

export default function BookingPage() {
  const { slug }  = useParams()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    axios.get(`${BASE_URL}/public/book/${slug}`)
      .then(r => setData(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div style={s.page}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div style={s.spinner} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div style={s.page}>
        <div style={s.center}>
          <p style={s.eyebrow}>404</p>
          <h1 style={{ ...s.title, fontSize: 48 }}>Booking page not found.</h1>
          <p style={s.sub}>This link may have expired or the slug is incorrect.</p>
          <a href="https://sonarleads.vercel.app" style={s.link}>Go to Sonar →</a>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
          <div style={s.logoBox}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
              <circle cx="8" cy="8" r="4" stroke="#fff" strokeWidth="1.2" opacity="0.85" />
              <circle cx="8" cy="8" r="1.5" fill="#fff" />
              <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Sonar</span>
        </div>

        {/* Content */}
        <p style={s.eyebrow}>Meeting request</p>
        <h1 style={s.title}>Book a time with<br />{data.full_name}.</h1>
        <p style={s.sub}>Pick a time that works for you — it only takes 30 seconds.</p>

        <a
          href={data.cal_link}
          target="_blank"
          rel="noreferrer"
          style={s.cta}
          onMouseEnter={e => e.currentTarget.style.background = '#c40009'}
          onMouseLeave={e => e.currentTarget.style.background = '#E7000B'}
        >
          Open calendar →
        </a>

        <p style={s.footer}>
          Powered by <a href="https://sonarleads.vercel.app" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Sonar</a>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        :root {
          --bg: #0e0e0e;
          --surface: #161616;
          --border: rgba(196,193,189,0.12);
          --text: #f0ede8;
          --text-secondary: #c4c1bd;
          --text-muted: #888580;
          --accent: #E7000B;
          --font-display: 'Barlow Condensed', sans-serif;
          --font-mono: 'IBM Plex Mono', monospace;
          --font-sans: 'Host Grotesk', sans-serif;
        }
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=IBM+Plex+Mono:wght@400;500;600;700&family=Host+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); }
      `}</style>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0e0e0e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    padding: '48px 40px',
    background: '#161616',
    border: '1px solid rgba(196,193,189,0.12)',
    borderRadius: 16,
  },
  center: {
    textAlign: 'center',
    maxWidth: 400,
  },
  logoBox: {
    width: 26,
    height: 26,
    background: '#E7000B',
    borderRadius: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  eyebrow: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#888580',
    marginBottom: 14,
  },
  title: {
    fontFamily: DISPLAY,
    fontSize: 'clamp(36px,6vw,52px)',
    fontWeight: 900,
    letterSpacing: '-0.03em',
    color: '#f0ede8',
    lineHeight: 1.05,
    marginBottom: 14,
  },
  sub: {
    fontFamily: MONO,
    fontSize: 12,
    color: '#888580',
    lineHeight: 1.7,
    marginBottom: 32,
  },
  cta: {
    display: 'inline-block',
    padding: '14px 28px',
    background: '#E7000B',
    color: '#fff',
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textDecoration: 'none',
    borderRadius: 8,
    transition: 'background 0.15s',
    marginBottom: 32,
  },
  footer: {
    fontFamily: MONO,
    fontSize: 10,
    color: '#888580',
  },
  link: {
    fontFamily: MONO,
    fontSize: 12,
    color: '#E7000B',
    textDecoration: 'none',
    display: 'block',
    marginTop: 16,
  },
  spinner: {
    width: 24,
    height: 24,
    border: '2px solid rgba(255,255,255,0.1)',
    borderTop: '2px solid #E7000B',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
}
