import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'

const BG      = '#FFFFFF'
const SURF    = '#F9FAFB'
const BORDER  = '#E5E7EB'
const INK     = '#0A0A0A'
const STEEL   = '#6B7280'
const ACCENT  = '#E7000B'

const SANS    = "'Host Grotesk', 'Roboto', sans-serif"
const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif"

const inp = {
  padding: '10px 14px',
  background: '#FFFFFF',
  border: `1px solid ${BORDER}`,
  borderRadius: 0,
  fontSize: 13,
  color: INK,
  outline: 'none',
  fontFamily: SANS,
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: STEEL }}>{label}</label>
      {children}
    </div>
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
    <div style={{ minHeight: '100vh', background: BG, fontFamily: SANS, color: INK, display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${BORDER}`, padding: '0 40px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: BG }}>
        <Link to="/" style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, background: '#FFFF00', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#121212" strokeWidth="1.3"/>
              <circle cx="7" cy="7" r="3.2" stroke="#121212" strokeWidth="1.3"/>
              <circle cx="7" cy="7" r="1" fill="#121212"/>
              <line x1="7" y1="1" x2="7" y2="3" stroke="#121212" strokeWidth="1.1"/>
              <line x1="7" y1="11" x2="7" y2="13" stroke="#121212" strokeWidth="1.1"/>
              <line x1="1" y1="7" x2="3" y2="7" stroke="#121212" strokeWidth="1.1"/>
              <line x1="11" y1="7" x2="13" y2="7" stroke="#121212" strokeWidth="1.1"/>
            </svg>
          </div>
          Sonar
        </Link>
        <Link to="/signup" style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: STEEL, textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = INK}
          onMouseLeave={e => e.currentTarget.style.color = STEEL}
        >Create account</Link>
      </nav>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>

        {/* Left — dark editorial panel */}
        <div style={{
          padding: '64px 56px',
          borderRight: `1px solid ${BORDER}`,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          background: '#0A0A0A',
          backgroundImage: 'radial-gradient(#2A2A2A 1.5px, transparent 1.5px)',
          backgroundSize: '28px 28px',
          position: 'relative',
        }}>
          <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', color: '#5B6670', textTransform: 'uppercase', marginBottom: 32 }}>① Sign in</p>
          <h1 style={{ margin: '0 0 24px', lineHeight: 0.95 }}>
            {['Find.', 'Target.', 'Close.'].map((word, i) => (
              <motion.span key={word}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.12 }}
                style={{ display: 'block', fontFamily: DISPLAY, fontSize: 'clamp(48px, 6vw, 80px)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', color: i < 2 ? '#F5F5F5' : ACCENT }}
              >
                {word}
              </motion.span>
            ))}
          </h1>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#5B6670', lineHeight: 1.7, maxWidth: 280 }}>
            The signal intelligence platform for modern B2B sales teams.
          </p>
        </div>

        {/* Right — form panel */}
        <div style={{ padding: '64px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: SURF }}>
          <motion.div
            style={{ maxWidth: 380 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <h2 style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, color: INK, marginBottom: 6 }}>Welcome back.</h2>
            <p style={{ fontFamily: SANS, fontSize: 13, color: STEEL, marginBottom: 32 }}>Sign in to your Sonar account.</p>

            {error && (
              <div style={{ padding: '10px 14px', border: `1px solid rgba(239,68,68,0.35)`, background: 'rgba(239,68,68,0.06)', borderRadius: 0, fontSize: 12, color: '#EF4444', marginBottom: 20, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Email address">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required style={inp}
                  onFocus={e => { e.target.style.borderColor = ACCENT }}
                  onBlur={e => { e.target.style.borderColor = BORDER }}
                />
              </Field>
              <Field label="Password">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required style={inp}
                  onFocus={e => { e.target.style.borderColor = ACCENT }}
                  onBlur={e => { e.target.style.borderColor = BORDER }}
                />
              </Field>
              <button type="submit" disabled={loading} style={{
                fontFamily: SANS, fontSize: 12, fontWeight: 500,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '11px 20px', background: ACCENT, color: '#FFFFFF',
                border: 'none', borderRadius: 0, cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'background 0.15s, box-shadow 0.2s',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 4,
              }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#C50009'; e.currentTarget.style.boxShadow = '0 0 16px rgba(231,0,11,0.2)' } }}
                onMouseLeave={e => { e.currentTarget.style.background = ACCENT; e.currentTarget.style.boxShadow = 'none' }}
              >
                <span>{loading ? 'Signing in…' : 'Sign in'}</span>
                <span>→</span>
              </button>
            </form>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: STEEL }}>
              <span>No account?{' '}
                <Link to="/signup" style={{ color: INK, fontWeight: 600 }}>Create one</Link>
              </span>
              <Link to="/forgot-password" style={{ color: STEEL }}>Forgot password?</Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
