import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
      <rect x="0"  y="0"  width="8" height="8" rx="1.5" fill="rgba(253,253,253,0.9)" />
      <rect x="10" y="0"  width="8" height="8" rx="1.5" fill="rgba(253,253,253,0.9)" />
      <rect x="0"  y="10" width="8" height="8" rx="1.5" fill="rgba(253,253,253,0.9)" />
      <rect x="10" y="10" width="8" height="8" rx="1.5" fill="rgba(253,253,253,0.9)" />
    </svg>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

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
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Left — dark brand panel */}
      <div style={{ position: 'relative', width: '45%', minWidth: '360px', background: '#1d1b1b', display: 'flex', flexDirection: 'column', padding: '48px', overflow: 'hidden' }}>
        {/* Ambient glow */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 20% 80%, rgba(168,100,72,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'auto' }}>
          <LogoMark />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'rgba(253,253,253,0.6)', letterSpacing: '-0.02em' }}>leadgen engine</span>
        </div>

        {/* Headline */}
        <div style={{ position: 'relative', marginTop: 'auto' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(52px, 5.5vw, 80px)', fontWeight: '400', lineHeight: 0.95, letterSpacing: '-0.05em', color: 'rgba(253,253,253,0.95)', marginBottom: '24px' }}>
            Find.<br />Target.<br />Close.
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(253,253,253,0.4)', lineHeight: 1.8, maxWidth: '300px', marginBottom: '36px' }}>
            The intelligence platform for modern sales teams. Extract, enrich and track leads.
          </p>

          {/* Feature dots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '28px', borderTop: '1px solid rgba(253,253,253,0.08)' }}>
            {['LinkedIn scraping', 'Lead enrichment', 'ICP targeting', 'Persona engine'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#a86448', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(253,253,253,0.45)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', borderLeft: '1px solid var(--border)' }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>Sign in</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1, marginBottom: '36px' }}>Welcome back.</h2>

          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'var(--red-dim)', border: '1px solid rgba(184,50,50,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--red)', marginBottom: '20px', lineHeight: 1.5 }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--red)', flexShrink: 0, marginTop: '4px' }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '500', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={inputStyle} placeholder="you@company.com" required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '500', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={inputStyle} placeholder="••••••••" required />
            </div>
            <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: '#1d1b1b', border: 'none', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '500', color: '#fdfdfd', cursor: 'pointer', opacity: loading ? 0.6 : 1, marginTop: '4px', transition: 'background 0.15s' }} disabled={loading}>
              <span>{loading ? 'Signing in…' : 'Sign in'}</span>
              <span>→</span>
            </button>
          </form>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>No account?{' '}
              <Link to="/signup" style={{ color: 'var(--text)', fontWeight: '500', borderBottom: '1px solid var(--border)' }}>Create one</Link>
            </span>
            <Link to="/forgot-password" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Forgot password?</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  padding: '11px 14px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '13px',
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
  width: '100%',
  boxSizing: 'border-box',
}
