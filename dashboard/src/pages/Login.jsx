import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BG   = '#f0eeea'
const INK  = '#111111'
const MID  = '#888888'
const LINE = '#d0cdc8'
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

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
    <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, color: INK, display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: INK, textDecoration: 'none' }}>SONAR©</Link>
        <Link to="/signup" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: MID, textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = INK}
          onMouseLeave={e => e.currentTarget.style.color = MID}
        >Create account</Link>
      </nav>

      {/* Body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>

        {/* Left — editorial headline */}
        <div style={{ padding: '64px 48px', borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: MID, textTransform: 'uppercase', marginBottom: 32 }}>① Sign in</p>
          <h1 style={{
            fontSize: 'clamp(48px, 6.5vw, 88px)',
            fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 0.95,
            color: INK, marginBottom: 24,
          }}>
            Find.<br />Target.<br />Close.
          </h1>
          <p style={{ fontSize: 14, color: MID, lineHeight: 1.65, maxWidth: 300 }}>
            The signal intelligence platform for modern B2B sales teams.
          </p>
        </div>

        {/* Right — form */}
        <div style={{ padding: '64px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ maxWidth: 360 }}>
            <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: INK, marginBottom: 32 }}>Welcome back.</h2>

            {error && (
              <div style={{ padding: '10px 14px', border: `1px solid rgba(184,50,50,0.3)`, background: 'rgba(184,50,50,0.06)', borderRadius: 4, fontSize: 12, color: '#b83232', marginBottom: 20, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Email">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required style={input} />
              </Field>
              <Field label="Password">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required style={input} />
              </Field>
              <button type="submit" disabled={loading} style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '13px 24px', background: INK, color: BG,
                border: 'none', borderRadius: 4, cursor: 'pointer',
                opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{loading ? 'Signing in…' : 'Sign in'}</span>
                <span>→</span>
              </button>
            </form>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MID }}>
              <span>No account?{' '}
                <Link to="/signup" style={{ color: INK, fontWeight: 700, borderBottom: `1px solid ${LINE}` }}>Create one</Link>
              </span>
              <Link to="/forgot-password" style={{ color: MID, borderBottom: `1px solid ${LINE}` }}>Forgot password?</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888' }}>{label}</label>
      {children}
    </div>
  )
}

const input = {
  padding: '11px 14px',
  background: '#e8e5e0',
  border: `1px solid #d0cdc8`,
  borderRadius: 4,
  fontSize: 13,
  color: '#111',
  outline: 'none',
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  width: '100%',
  boxSizing: 'border-box',
}
