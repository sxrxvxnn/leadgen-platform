import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'

const BG   = '#fffcfc'
const INK  = '#01011b'
const PLUM = '#31263b'
const MID  = '#717a94'
const LINE = '#dbd7da'
const SURF = '#ecedf2'
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

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: LINE }
  let score = 0
  if (pw.length >= 8)           score++
  if (/[A-Z]/.test(pw))        score++
  if (/[a-z]/.test(pw))        score++
  if (/[0-9]/.test(pw))        score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const map = [
    { label: '',       color: LINE },
    { label: 'Weak',   color: '#b83232' },
    { label: 'Fair',   color: '#c87941' },
    { label: 'Good',   color: '#b8a832' },
    { label: 'Strong', color: '#2e7d4f' },
    { label: 'Strong', color: '#2e7d4f' },
  ]
  return { score, ...map[score] }
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: PLUM }}>{label}</label>
      {children}
    </div>
  )
}

const focusIn  = e => { e.target.style.borderColor = '#6f63b7'; e.target.style.boxShadow = '0 0 0 3px rgba(71,57,130,0.12)' }
const focusOut = e => { e.target.style.borderColor = LINE; e.target.style.boxShadow = 'rgba(71, 57, 130, 0.06) 0px 0px 0px 1px inset' }

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [done,     setDone]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const { signup } = useAuth()
  const strength = passwordStrength(password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      await signup(email, password, fullName)
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally { setLoading(false) }
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: BG, fontFamily: SANS, color: INK, display: 'flex', flexDirection: 'column' }}>
        <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 40px', height: 56, display: 'flex', alignItems: 'center' }}>
          <Link to="/" style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: INK, textDecoration: 'none' }}>Sonar</Link>
        </nav>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <div style={{ display: 'inline-block', width: 40, height: 40, borderRadius: '50%', border: `1px solid rgba(46,125,79,0.4)`, background: 'rgba(46,125,79,0.08)', lineHeight: '40px', fontSize: 16, color: '#2e7d4f', marginBottom: 24 }}>✓</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: INK, marginBottom: 16, lineHeight: 1.1 }}>Check your inbox.</h2>
            <p style={{ fontSize: 14, color: MID, lineHeight: 1.7, marginBottom: 32 }}>
              We sent a confirmation link to <strong style={{ color: INK }}>{email}</strong>.<br />
              Click it to activate your account, then sign in.
            </p>
            <Link to="/login" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: PLUM, borderBottom: `1px solid ${LINE}` }}>
              Back to sign in →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: SANS, color: INK, display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 40px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: INK, textDecoration: 'none' }}>Sonar</Link>
        <Link to="/login" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: MID, textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = INK}
          onMouseLeave={e => e.currentTarget.style.color = MID}
        >Sign in</Link>
      </nav>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>

        {/* Left */}
        <div style={{ padding: '64px 56px', borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: SURF, backgroundImage: `radial-gradient(${PLUM}22 1.5px, transparent 1.5px)`, backgroundSize: '28px 28px', position: 'relative' }}>
          <p style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MID, textTransform: 'uppercase', marginBottom: 32 }}>① Get started</p>
          <h1 style={{ margin: '0 0 24px', lineHeight: 1.05 }}>
            <motion.span initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0 }} style={{ display: 'block', fontFamily: SERIF, fontSize: 'clamp(40px, 5.5vw, 72px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: INK }}>
              Start.
            </motion.span>
            <motion.span initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} style={{ display: 'block', fontFamily: SERIF, fontSize: 'clamp(40px, 5.5vw, 72px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: INK }}>
              Scale.
            </motion.span>
            <motion.span initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.3 }} style={{ display: 'block', fontFamily: SANS, fontSize: 'clamp(32px, 4.5vw, 60px)', fontWeight: 700, letterSpacing: '-0.03em', color: PLUM }}>
              Win.
            </motion.span>
          </h1>
          <p style={{ fontFamily: SANS, fontSize: 14, color: MID, lineHeight: 1.7, maxWidth: 300 }}>
            The signal intelligence platform for modern B2B sales teams.
          </p>
        </div>

        {/* Right — form */}
        <div style={{ padding: '48px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflowY: 'auto' }}>
          <motion.div
            style={{ maxWidth: 380 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <h2 style={{ fontFamily: SANS, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: INK, marginBottom: 8 }}>Create account.</h2>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MID, marginBottom: 28 }}>Start for free — no credit card required.</p>

            {error && (
              <div style={{ padding: '10px 14px', border: `1px solid rgba(184,50,50,0.3)`, background: 'rgba(184,50,50,0.05)', borderRadius: 6, fontSize: 13, color: '#b83232', marginBottom: 20, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Full name">
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Your name" required style={inp} onFocus={focusIn} onBlur={focusOut} />
              </Field>
              <Field label="Email address">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required style={inp} onFocus={focusIn} onBlur={focusOut} />
              </Field>
              <Field label="Password">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" required style={inp} onFocus={focusIn} onBlur={focusOut} />
                {password && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{ flex: 1, height: 2, background: i <= strength.score ? strength.color : LINE, borderRadius: 2, transition: 'background 0.2s' }} />
                      ))}
                    </div>
                    {strength.label && <p style={{ fontSize: 11, color: strength.color, letterSpacing: '0.02em' }}>{strength.label}</p>}
                  </div>
                )}
              </Field>
              <Field label="Confirm password">
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password" required
                  style={{ ...inp, borderColor: confirm && confirm !== password ? '#b83232' : LINE }}
                  onFocus={focusIn} onBlur={focusOut} />
                {confirm && confirm !== password && (
                  <p style={{ fontSize: 11, color: '#b83232', marginTop: 2 }}>Passwords do not match</p>
                )}
              </Field>
              <button type="submit" disabled={loading || (confirm && confirm !== password)} style={{
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
                <span>{loading ? 'Creating account…' : 'Create account'}</span>
                <span>→</span>
              </button>
            </form>

            <p style={{ marginTop: 20, fontSize: 13, color: MID }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: PLUM, fontWeight: 600, borderBottom: `1px solid ${LINE}` }}>Sign in</Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
