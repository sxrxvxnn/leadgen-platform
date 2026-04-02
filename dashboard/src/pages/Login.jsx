import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setTimeout(() => setMounted(true), 50)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      {/* Left panel */}
      <div style={s.left}>
        <div style={{ ...s.leftInner, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)' }}>
          <p style={s.eyebrow}>LEADGEN ENGINE</p>
          <h1 style={s.bigTitle}>Find.<br />Target.<br />Close.</h1>
          <p style={s.tagline}>
            The intelligence platform for modern sales teams.
            Extract, enrich and track leads — all in one place.
          </p>
          <div style={s.ticker}>
            <div style={s.tickerInner}>
              {['LINKEDIN SCRAPING', 'LEAD ENRICHMENT', 'ICP BUILDING', 'PERSONA ENGINE', 'CSV EXPORT', 'LIVE DATABASE', 'LINKEDIN SCRAPING', 'LEAD ENRICHMENT', 'ICP BUILDING', 'PERSONA ENGINE', 'CSV EXPORT', 'LIVE DATABASE'].map((t, i) => (
                <span key={i} style={s.tickerItem}>{t} &nbsp;/&nbsp; </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={s.right}>
        <div style={{ ...s.form, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s' }}>
          <div style={s.formHeader}>
            <p style={s.formEyebrow}>SIGN IN</p>
            <h2 style={s.formTitle}>Welcome back.</h2>
          </div>

          {error && (
            <div style={s.errorBox}>
              <span style={s.errorDot} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={s.formInner}>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={s.input}
                placeholder="you@company.com"
                required
                data-hover="true"
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={s.input}
                placeholder="••••••••"
                required
                data-hover="true"
              />
            </div>

            <button
              type="submit"
              style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}
              disabled={loading}
              data-hover="true"
            >
              <span>{loading ? 'Signing in...' : 'Sign in'}</span>
              <span style={s.btnArrow}>→</span>
            </button>
          </form>

          <p style={s.switchText}>
            No account?{' '}
            <Link to="/signup" style={s.switchLink} data-hover="true">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--black)',
  },
  left: {
    flex: 1,
    background: 'var(--gray-1)',
    borderRight: '1px solid var(--gray-2)',
    display: 'flex',
    alignItems: 'flex-end',
    padding: '60px',
    position: 'relative',
    overflow: 'hidden',
  },
  leftInner: {
    width: '100%',
  },
  eyebrow: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '4px',
    color: 'var(--gray-4)',
    marginBottom: '32px',
  },
  bigTitle: {
    fontSize: 'clamp(56px, 6vw, 88px)',
    fontWeight: '900',
    lineHeight: 0.95,
    letterSpacing: '-3px',
    color: 'var(--white)',
    marginBottom: '32px',
  },
  tagline: {
    fontSize: '14px',
    color: 'var(--gray-5)',
    lineHeight: 1.7,
    maxWidth: '340px',
    marginBottom: '60px',
  },
  ticker: {
    overflow: 'hidden',
    borderTop: '1px solid var(--gray-2)',
    paddingTop: '20px',
  },
  tickerInner: {
    display: 'flex',
    animation: 'ticker 20s linear infinite',
    whiteSpace: 'nowrap',
  },
  tickerItem: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '2px',
    color: 'var(--gray-4)',
    paddingRight: '8px',
  },
  right: {
    width: '480px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
  },
  form: {
    width: '100%',
  },
  formHeader: {
    marginBottom: '40px',
  },
  formEyebrow: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '4px',
    color: 'var(--gray-4)',
    marginBottom: '12px',
  },
  formTitle: {
    fontSize: '36px',
    fontWeight: '900',
    letterSpacing: '-1.5px',
    color: 'var(--white)',
    lineHeight: 1,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--red-dim)',
    border: '1px solid var(--red)',
    borderRadius: '4px',
    padding: '12px 16px',
    fontSize: '13px',
    color: 'var(--red)',
    marginBottom: '24px',
  },
  errorDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--red)',
    flexShrink: 0,
  },
  formInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '2px',
    color: 'var(--gray-4)',
    textTransform: 'uppercase',
  },
  input: {
    padding: '14px 16px',
    background: 'var(--gray-1)',
    border: '1px solid var(--gray-2)',
    borderRadius: '4px',
    fontSize: '14px',
    color: 'var(--white)',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    background: 'var(--white)',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--black)',
    cursor: 'none',
    marginTop: '8px',
    transition: 'opacity 0.2s',
  },
  btnArrow: {
    fontSize: '18px',
  },
  switchText: {
    marginTop: '32px',
    fontSize: '13px',
    color: 'var(--gray-4)',
  },
  switchLink: {
    color: 'var(--white)',
    fontWeight: '600',
    borderBottom: '1px solid var(--gray-3)',
  },
}