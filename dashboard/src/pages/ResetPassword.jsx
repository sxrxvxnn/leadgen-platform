import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
    } finally {
      setLoading(false)
    }
  }

  const Shell = ({ children }) => (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: FONT, color: INK, display: 'flex', flexDirection: 'column' }}>
      <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 24px', height: 48, display: 'flex', alignItems: 'center' }}>
        <Link to="/" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: INK, textDecoration: 'none' }}>SONAR©</Link>
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
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: MID, textTransform: 'uppercase', marginBottom: 24 }}>① Password reset</p>
          <h2 style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: INK, marginBottom: 16 }}>Invalid link.</h2>
          <p style={{ fontSize: 14, color: MID, lineHeight: 1.7, marginBottom: 32 }}>
            This link is invalid or has already been used.<br />Reset links expire after 1 hour.
          </p>
          <Link to="/forgot-password" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK, borderBottom: `1px solid ${LINE}` }}>
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
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#2e7d4f', textTransform: 'uppercase', marginBottom: 24 }}>✓ Password updated</p>
          <h2 style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: INK, marginBottom: 16 }}>You're all set.</h2>
          <p style={{ fontSize: 14, color: MID, lineHeight: 1.7, marginBottom: 32 }}>
            Your password has been changed. Redirecting to sign in…
          </p>
          <Link to="/login" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK, borderBottom: `1px solid ${LINE}` }}>
            Sign in now →
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: MID, textTransform: 'uppercase', marginBottom: 20 }}>① Password reset</p>
        <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: INK, marginBottom: 32 }}>Set a new<br />password.</h2>

        {error && (
          <div style={{ padding: '10px 14px', border: `1px solid rgba(184,50,50,0.3)`, background: 'rgba(184,50,50,0.06)', borderRadius: 4, fontSize: 12, color: '#b83232', marginBottom: 20, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MID }}>New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              autoFocus
              style={inp}
            />
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
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MID }}>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              required
              style={{ ...inp, borderColor: confirm && confirm !== password ? '#b83232' : LINE }}
            />
            {confirm && confirm !== password && (
              <p style={{ fontSize: 10, color: '#b83232', marginTop: 3, letterSpacing: '0.04em' }}>Passwords do not match</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !token || (confirm && confirm !== password)}
            style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '13px 24px', background: INK, color: BG,
              border: 'none', borderRadius: 4, cursor: 'pointer',
              opacity: loading || !token ? 0.6 : 1, transition: 'opacity 0.15s',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 4,
            }}>
            <span>{loading ? 'Updating…' : 'Update password'}</span>
            <span>→</span>
          </button>
        </form>
      </div>
    </Shell>
  )
}
