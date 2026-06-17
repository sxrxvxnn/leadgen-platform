import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'

const BG   = '#fffcfc'
const INK  = '#01011b'
const PLUM = '#31263b'
const MID  = '#717a94'
const LINE = '#dbd7da'
const SANS = "'IBM Plex Sans', 'DM Sans', sans-serif"
const SERIF = "'Cormorant Garamond', Georgia, serif"

const inp = {
  padding: '10px 14px',
  background: '#ffffff',
  border: `1px solid ${LINE}`,
  borderRadius: 6,
  fontSize: 14,
  color: INK,
  outline: 'none',
  fontFamily: SANS,
  width: '100%',
  boxSizing: 'border-box',
  boxShadow: 'rgba(71, 57, 130, 0.06) 0px 0px 0px 1px inset',
  transition: 'border-color 0.15s, box-shadow 0.15s',
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

  const Shell = ({ children }) => (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: SANS, color: INK, display: 'flex', flexDirection: 'column' }}>
      <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 40px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: INK, textDecoration: 'none' }}>Sonar</Link>
        <Link to="/login" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: MID, textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = INK}
          onMouseLeave={e => e.currentTarget.style.color = MID}
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
          <div style={{ display: 'inline-block', width: 40, height: 40, borderRadius: '50%', border: `1px solid rgba(46,125,79,0.4)`, background: 'rgba(46,125,79,0.08)', lineHeight: '40px', fontSize: 16, color: '#2e7d4f', marginBottom: 24 }}>✓</div>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: INK, marginBottom: 16, lineHeight: 1.1 }}>Check your inbox.</h2>
          <p style={{ fontSize: 14, color: MID, lineHeight: 1.7, marginBottom: 32 }}>
            If <strong style={{ color: INK }}>{email}</strong> is registered, we've sent a reset link.<br />
            Check your inbox and spam folder — the link expires in 1 hour.
          </p>
          <Link to="/login" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: PLUM, borderBottom: `1px solid ${LINE}` }}>
            Back to sign in →
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <motion.div style={{ width: '100%', maxWidth: 420 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <p style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MID, textTransform: 'uppercase', marginBottom: 16 }}>① Password reset</p>
        <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: INK, marginBottom: 12, lineHeight: 1.1 }}>
          Forgot your password?
        </h2>
        <p style={{ fontSize: 14, color: MID, lineHeight: 1.65, marginBottom: 32 }}>
          Enter your email and we'll send a reset link if an account exists.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: PLUM }}>Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com" required autoFocus style={inp}
              onFocus={e => { e.target.style.borderColor = '#6f63b7'; e.target.style.boxShadow = '0 0 0 3px rgba(71,57,130,0.12)' }}
              onBlur={e => { e.target.style.borderColor = LINE; e.target.style.boxShadow = 'rgba(71, 57, 130, 0.06) 0px 0px 0px 1px inset' }}
            />
          </div>
          <button type="submit" disabled={loading} style={{
            fontFamily: SANS, fontSize: 14, fontWeight: 500,
            padding: '10px 20px', background: '#ffffff', color: INK,
            border: `1px solid ${PLUM}`, borderRadius: 3, cursor: 'pointer',
            opacity: loading ? 0.6 : 1, transition: 'all 0.15s',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 4,
          }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = PLUM; e.currentTarget.style.color = BG } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = INK }}
          >
            <span>{loading ? 'Sending…' : 'Send reset link'}</span>
            <span>→</span>
          </button>
        </form>

        <p style={{ marginTop: 24, fontSize: 13, color: MID }}>
          Remember it?{' '}
          <Link to="/login" style={{ color: PLUM, fontWeight: 600, borderBottom: `1px solid ${LINE}` }}>Sign in</Link>
        </p>
      </motion.div>
    </Shell>
  )
}
