import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BG   = '#f0eeea'
const INK  = '#111111'
const MID  = '#888888'
const LINE = '#d0cdc8'
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const inp = {
  padding: '11px 14px',
  background: '#e8e5e0',
  border: `1px solid ${LINE}`,
  borderRadius: 4,
  fontSize: 13,
  color: INK,
  outline: 'none',
  fontFamily: FONT,
  width: '100%',
  boxSizing: 'border-box',
}

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const { forgotPassword } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword(email)
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setSent(true)
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, color: INK, display: 'flex', flexDirection: 'column' }}>
        <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: INK, textDecoration: 'none' }}>SONAR©</Link>
        </nav>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: MID, textTransform: 'uppercase', marginBottom: 24 }}>✓ Link sent</p>
            <h2 style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: INK, marginBottom: 16 }}>Check your inbox.</h2>
            <p style={{ fontSize: 14, color: MID, lineHeight: 1.7, marginBottom: 32 }}>
              If <strong style={{ color: INK }}>{email}</strong> is registered, we've sent a reset link.<br />
              Check your inbox and spam folder — the link expires in 1 hour.
            </p>
            <Link to="/login" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK, borderBottom: `1px solid ${LINE}` }}>
              Back to sign in →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, color: INK, display: 'flex', flexDirection: 'column' }}>

      <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: INK, textDecoration: 'none' }}>SONAR©</Link>
        <Link to="/login" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: MID, textDecoration: 'none' }}
          onMouseEnter={e => e.currentTarget.style.color = INK}
          onMouseLeave={e => e.currentTarget.style.color = MID}
        >Sign in</Link>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: MID, textTransform: 'uppercase', marginBottom: 20 }}>① Password reset</p>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: INK, marginBottom: 12 }}>Forgot your<br />password?</h2>
          <p style={{ fontSize: 14, color: MID, lineHeight: 1.65, marginBottom: 32 }}>
            Enter your email and we'll send a reset link if an account exists.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MID }}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
                style={inp}
              />
            </div>
            <button type="submit" disabled={loading} style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '13px 24px', background: INK, color: BG,
              border: 'none', borderRadius: 4, cursor: 'pointer',
              opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 4,
            }}>
              <span>{loading ? 'Sending…' : 'Send reset link'}</span>
              <span>→</span>
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: 12, color: MID }}>
            Remember it?{' '}
            <Link to="/login" style={{ color: INK, fontWeight: 700, borderBottom: `1px solid ${LINE}` }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
