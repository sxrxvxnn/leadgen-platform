import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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

const focusIn  = e => { e.target.style.borderColor = '#6f63b7'; e.target.style.boxShadow = '0 0 0 3px rgba(71,57,130,0.12)' }
const focusOut = e => { e.target.style.borderColor = LINE; e.target.style.boxShadow = 'rgba(71, 57, 130, 0.06) 0px 0px 0px 1px inset' }

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

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [token,    setToken]    = useState('')
  const [error,    setError]    = useState('')
  const [done,     setDone]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [invalid,  setInvalid]  = useState(false)
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const strength = passwordStrength(password)

  useEffect(() => {
    const hash   = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const type   = params.get('type')
    const tk     = params.get('access_token')
    if (type !== 'recovery' || !tk) { setInvalid(true); return }
    setToken(tk)
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setError('')
    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password. The link may have expired.')
    } finally { setLoading(false) }
  }

  const Shell = ({ children }) => (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: SANS, color: INK, display: 'flex', flexDirection: 'column' }}>
      <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 40px', height: 56, display: 'flex', alignItems: 'center' }}>
        <Link to="/" style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: INK, textDecoration: 'none' }}>Sonar</Link>
      </nav>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        {children}
      </div>
    </div>
  )

  if (invalid) {
    return (
      <Shell>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <p style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MID, textTransform: 'uppercase', marginBottom: 20 }}>① Password reset</p>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: INK, marginBottom: 16, lineHeight: 1.1 }}>Invalid link.</h2>
          <p style={{ fontSize: 14, color: MID, lineHeight: 1.7, marginBottom: 32 }}>
            This link is invalid or has already been used.<br />Reset links expire after 1 hour.
          </p>
          <Link to="/forgot-password" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: PLUM, borderBottom: `1px solid ${LINE}` }}>
            Request a new link →
          </Link>
        </div>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: 40, height: 40, borderRadius: '50%', border: `1px solid rgba(46,125,79,0.4)`, background: 'rgba(46,125,79,0.08)', lineHeight: '40px', fontSize: 16, color: '#2e7d4f', marginBottom: 24 }}>✓</div>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: INK, marginBottom: 16, lineHeight: 1.1 }}>You're all set.</h2>
          <p style={{ fontSize: 14, color: MID, lineHeight: 1.7, marginBottom: 32 }}>
            Your password has been changed. Redirecting to sign in…
          </p>
          <Link to="/login" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: PLUM, borderBottom: `1px solid ${LINE}` }}>
            Sign in now →
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <motion.div style={{ width: '100%', maxWidth: 420 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <p style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MID, textTransform: 'uppercase', marginBottom: 16 }}>① Password reset</p>
        <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: INK, marginBottom: 32, lineHeight: 1.1 }}>
          Set a new password.
        </h2>

        {error && (
          <div style={{ padding: '10px 14px', border: `1px solid rgba(184,50,50,0.3)`, background: 'rgba(184,50,50,0.05)', borderRadius: 6, fontSize: 13, color: '#b83232', marginBottom: 20, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: PLUM }}>New password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters" required autoFocus style={inp} onFocus={focusIn} onBlur={focusOut} />
            {password && (
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex: 1, height: 2, background: i <= strength.score ? strength.color : LINE, borderRadius: 2, transition: 'background 0.2s' }} />
                  ))}
                </div>
                {strength.label && <p style={{ fontSize: 11, color: strength.color }}>{strength.label}</p>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: PLUM }}>Confirm password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password" required
              style={{ ...inp, borderColor: confirm && confirm !== password ? '#b83232' : LINE }}
              onFocus={focusIn} onBlur={focusOut} />
            {confirm && confirm !== password && (
              <p style={{ fontSize: 11, color: '#b83232', marginTop: 2 }}>Passwords do not match</p>
            )}
          </div>
          <button type="submit" disabled={loading || !token || (confirm && confirm !== password)} style={{
            fontFamily: SANS, fontSize: 14, fontWeight: 500,
            padding: '10px 20px', background: '#ffffff', color: INK,
            border: `1px solid ${PLUM}`, borderRadius: 3, cursor: 'pointer',
            opacity: loading || !token ? 0.6 : 1, transition: 'all 0.15s',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 4,
          }}
            onMouseEnter={e => { if (!loading && token) { e.currentTarget.style.background = PLUM; e.currentTarget.style.color = BG } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = INK }}
          >
            <span>{loading ? 'Updating…' : 'Update password'}</span>
            <span>→</span>
          </button>
        </form>
      </motion.div>
    </Shell>
  )
}
