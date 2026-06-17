import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BG   = '#f0eeea'
const INK  = '#111111'
const MID  = '#888888'
const LINE = '#d0cdc8'
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

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
      <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, color: INK, display: 'flex', flexDirection: 'column' }}>
        <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: INK, textDecoration: 'none' }}>SONAR©</Link>
        </nav>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: MID, textTransform: 'uppercase', marginBottom: 24 }}>✓ Account created</p>
            <h2 style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: INK, marginBottom: 16 }}>Check your inbox.</h2>
            <p style={{ fontSize: 14, color: MID, lineHeight: 1.7, marginBottom: 32 }}>
              We sent a confirmation link to <strong style={{ color: INK }}>{email}</strong>.<br />
              Click it to activate your account, then sign in.
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

      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: INK, textDecoration: 'none' }}>SONAR©</Link>
        <Link to="/login" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: MID, textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = INK}
          onMouseLeave={e => e.currentTarget.style.color = MID}
        >Sign in</Link>
      </nav>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>

        {/* Left */}
        <div style={{ padding: '64px 48px', borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: MID, textTransform: 'uppercase', marginBottom: 32 }}>① Get started</p>
          <h1 style={{ fontSize: 'clamp(48px, 6.5vw, 88px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 0.95, color: INK, marginBottom: 24 }}>
            Start.<br />Scale.<br />Win.
          </h1>
          <p style={{ fontSize: 14, color: MID, lineHeight: 1.65, maxWidth: 300 }}>
            The signal intelligence platform for modern B2B sales teams.
          </p>
        </div>

        {/* Right — form */}
        <div style={{ padding: '64px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflowY: 'auto' }}>
          <div style={{ maxWidth: 360 }}>
            <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: INK, marginBottom: 32 }}>Create account.</h2>

            {error && (
              <div style={{ padding: '10px 14px', border: `1px solid rgba(184,50,50,0.3)`, background: 'rgba(184,50,50,0.06)', borderRadius: 4, fontSize: 12, color: '#b83232', marginBottom: 20, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Full name">
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Your name" required style={inp} />
              </Field>
              <Field label="Email">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required style={inp} />
              </Field>
              <Field label="Password">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" required style={inp} />
                {password && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{ flex: 1, height: 2, background: i <= strength.score ? strength.color : LINE, transition: 'background 0.2s' }} />
                      ))}
                    </div>
                    {strength.label && <p style={{ fontSize: 10, color: strength.color, letterSpacing: '0.06em' }}>{strength.label}</p>}
                  </div>
                )}
              </Field>
              <Field label="Confirm password">
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password" required
                  style={{ ...inp, borderColor: confirm && confirm !== password ? '#b83232' : LINE }} />
                {confirm && confirm !== password && (
                  <p style={{ fontSize: 10, color: '#b83232', marginTop: 3, letterSpacing: '0.04em' }}>Passwords do not match</p>
                )}
              </Field>
              <button type="submit" disabled={loading || (confirm && confirm !== password)} style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '13px 24px', background: INK, color: BG,
                border: 'none', borderRadius: 4, cursor: 'pointer',
                opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 4,
              }}>
                <span>{loading ? 'Creating account…' : 'Create account'}</span>
                <span>→</span>
              </button>
            </form>

            <p style={{ marginTop: 20, fontSize: 12, color: MID }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: INK, fontWeight: 700, borderBottom: `1px solid ${LINE}` }}>Sign in</Link>
            </p>
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

const inp = {
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
