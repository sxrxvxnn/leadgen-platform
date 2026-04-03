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

  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Check your credentials.')
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.grid} />
      <div style={{ ...s.card, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)' }}>
        <div style={s.left}>
          <p style={s.eyebrow}>LEADGEN ENGINE</p>
          <h1 style={s.bigTitle}>Find.<br />Target.<br />Close.</h1>
          <p style={s.tagline}>The intelligence platform for modern sales teams. Extract, enrich and track leads — all in one place.</p>
          <div style={s.ticker}>
            <div style={s.tickerInner}>
              {['LINKEDIN SCRAPING', 'LEAD ENRICHMENT', 'ICP BUILDING', 'PERSONA ENGINE', 'CSV EXPORT', 'LIVE DATABASE', 'LINKEDIN SCRAPING', 'LEAD ENRICHMENT', 'ICP BUILDING', 'PERSONA ENGINE', 'CSV EXPORT', 'LIVE DATABASE'].map((t, i) => (
                <span key={i} style={s.tickerItem}>{t} &nbsp;/&nbsp; </span>
              ))}
            </div>
          </div>
        </div>

        <div style={s.right}>
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
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={s.input} placeholder="you@company.com" required data-hover="true" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={s.input} placeholder="••••••••" required data-hover="true" />
            </div>
            <button type="submit" style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} disabled={loading} data-hover="true">
              <span>{loading ? 'Signing in...' : 'Sign in'}</span>
              <span style={s.btnArrow}>→</span>
            </button>
          </form>

          <p style={s.switchText}>
            No account?{' '}
            <Link to="/signup" style={s.switchLink} data-hover="true">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--black)', position: 'relative', overflow: 'hidden' },
  grid: { position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--gray-2) 1px, transparent 1px), linear-gradient(90deg, var(--gray-2) 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.4 },
  card: { display: 'flex', width: '100%', maxWidth: '900px', minHeight: '560px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '8px', overflow: 'hidden', position: 'relative' },
  left: { flex: 1, padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRight: '1px solid var(--gray-2)', overflow: 'hidden' },
  eyebrow: { fontSize: '11px', fontWeight: '600', letterSpacing: '4px', color: 'var(--gray-4)', marginBottom: '24px' },
  bigTitle: { fontSize: 'clamp(40px, 5vw, 72px)', fontWeight: '900', lineHeight: 0.95, letterSpacing: '-3px', color: 'var(--white)', marginBottom: '24px' },
  tagline: { fontSize: '13px', color: 'var(--gray-5)', lineHeight: 1.7, maxWidth: '300px', marginBottom: '48px' },
  ticker: { overflow: 'hidden', borderTop: '1px solid var(--gray-2)', paddingTop: '16px' },
  tickerInner: { display: 'flex', animation: 'ticker 20s linear infinite', whiteSpace: 'nowrap' },
  tickerItem: { fontSize: '10px', fontWeight: '600', letterSpacing: '2px', color: 'var(--gray-4)', paddingRight: '8px' },
  right: { width: '380px', padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  formHeader: { marginBottom: '32px' },
  formEyebrow: { fontSize: '10px', fontWeight: '600', letterSpacing: '4px', color: 'var(--gray-4)', marginBottom: '10px' },
  formTitle: { fontSize: '28px', fontWeight: '900', letterSpacing: '-1px', color: 'var(--white)', lineHeight: 1 },
  errorBox: { display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(255,45,45,0.08)', border: '1px solid #ff2d2d', borderRadius: '4px', padding: '12px 14px', fontSize: '12px', color: '#ff2d2d', marginBottom: '20px', lineHeight: 1.5 },
  errorDot: { width: '6px', height: '6px', borderRadius: '50%', background: '#ff2d2d', flexShrink: 0, marginTop: '3px' },
  formInner: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '10px', fontWeight: '600', letterSpacing: '2px', color: 'var(--gray-4)', textTransform: 'uppercase' },
  input: { padding: '12px 14px', background: 'var(--black)', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '13px', color: 'var(--white)', outline: 'none' },
  btn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--white)', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '700', color: 'var(--black)', cursor: 'pointer', marginTop: '4px' },
  btnArrow: { fontSize: '16px' },
  switchText: { marginTop: '24px', fontSize: '12px', color: 'var(--gray-4)' },
  switchLink: { color: 'var(--white)', fontWeight: '600', borderBottom: '1px solid var(--gray-3)' },
}