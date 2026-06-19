import { useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const { forgotPassword } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try { await forgotPassword(email) } catch { /* enumeration prevention */ }
    finally { setSent(true); setLoading(false) }
  }

  const NavLogo = () => (
    <Link to="/" style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 26, height: 26, background: '#E7000B', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.5"/>
          <circle cx="8" cy="8" r="4" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.85"/>
          <circle cx="8" cy="8" r="1.5" fill="#FFFFFF"/>
          <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
      Sonar
    </Link>
  )

  const Shell = ({ children }) => (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: SANS, color: INK, display: 'flex', flexDirection: 'column' }}>
      <nav style={{ borderBottom: `1px solid ${BORDER}`, padding: '0 40px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: BG }}>
        <NavLogo />
        <Link to="/login" style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: STEEL, textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = INK}
          onMouseLeave={e => e.currentTarget.style.color = STEEL}
        >Sign in</Link>
      </nav>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        {children}
      </div>
    </div>
  )

  if (sent) {
    return (
      <Shell>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: 40, height: 40, border: `1px solid rgba(34,197,94,0.4)`, background: 'rgba(34,197,94,0.08)', lineHeight: '40px', fontSize: 16, color: '#22C55E', marginBottom: 24 }}>✓</div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 'clamp(40px, 5vw, 60px)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', color: INK, marginBottom: 16, lineHeight: 1.0 }}>Check your inbox.</h2>
          <p style={{ fontSize: 13, color: STEEL, lineHeight: 1.7, marginBottom: 32 }}>
            If <strong style={{ color: INK }}>{email}</strong> is registered, we've sent a reset link.<br />
            Check your inbox and spam folder — the link expires in 1 hour.
          </p>
          <Link to="/login" style={{ fontFamily: SANS, fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: ACCENT }}>
            Back to sign in →
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <motion.div style={{ width: '100%', maxWidth: 420 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', color: STEEL, textTransform: 'uppercase', marginBottom: 16 }}>① Password reset</p>
        <h2 style={{ fontFamily: DISPLAY, fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', color: INK, marginBottom: 12, lineHeight: 1.0 }}>
          Forgot your password?
        </h2>
        <p style={{ fontSize: 13, color: STEEL, lineHeight: 1.65, marginBottom: 32 }}>
          Enter your email and we'll send a reset link if an account exists.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: STEEL }}>Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com" required autoFocus style={inp}
              onFocus={e => { e.target.style.borderColor = ACCENT }}
              onBlur={e => { e.target.style.borderColor = BORDER }}
            />
          </div>
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
            <span>{loading ? 'Sending…' : 'Send reset link'}</span>
            <span>→</span>
          </button>
        </form>

        <p style={{ marginTop: 24, fontSize: 12, color: STEEL }}>
          Remember it?{' '}
          <Link to="/login" style={{ color: INK, fontWeight: 600 }}>Sign in</Link>
        </p>
      </motion.div>
    </Shell>
  )
}
