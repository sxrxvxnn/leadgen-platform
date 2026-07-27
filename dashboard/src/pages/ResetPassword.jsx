import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'

const BG = '#FFFFFF'
const SURF = '#F9FAFB'
const BORDER = '#E5E7EB'
const INK = '#0A0A0A'
const STEEL = '#6B7280'
const ACCENT = '#E7000B'

const SANS = "'Host Grotesk', 'Roboto', sans-serif"
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

const focusIn = (e) => {
  e.target.style.borderColor = ACCENT
}
const focusOut = (e) => {
  e.target.style.borderColor = BORDER
}

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: BORDER }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const map = [
    { label: '', color: BORDER },
    { label: 'Weak', color: '#EF4444' },
    { label: 'Fair', color: '#F59E0B' },
    { label: 'Good', color: '#84CC16' },
    { label: 'Strong', color: '#22C55E' },
    { label: 'Strong', color: '#22C55E' },
  ]
  return { score, ...map[score] }
}

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const strength = passwordStrength(password)

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const type = params.get('type')
    const tk = params.get('access_token')
    if (type !== 'recovery' || !tk) {
      setInvalid(true)
      return
    }
    setToken(tk)
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
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

  const NavLogo = () => (
    <Link
      to="/"
      style={{
        fontFamily: DISPLAY,
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: INK,
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          background: '#E7000B',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.5" />
          <circle cx="8" cy="8" r="4" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.85" />
          <circle cx="8" cy="8" r="1.5" fill="#FFFFFF" />
          <line
            x1="9.1"
            y1="6.9"
            x2="13"
            y2="3"
            stroke="#FFFFFF"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      Sonar
    </Link>
  )

  const Shell = ({ children }) => (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        fontFamily: SANS,
        color: INK,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <nav
        style={{
          borderBottom: `1px solid ${BORDER}`,
          padding: '0 40px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          background: BG,
        }}
      >
        <NavLogo />
      </nav>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        {children}
      </div>
    </div>
  )

  if (invalid) {
    return (
      <Shell>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <p
            style={{
              fontFamily: SANS,
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.1em',
              color: STEEL,
              textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            ① Password reset
          </p>
          <h2
            style={{
              fontFamily: DISPLAY,
              fontSize: 'clamp(40px, 5vw, 60px)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              color: INK,
              marginBottom: 16,
              lineHeight: 1.0,
            }}
          >
            Invalid link.
          </h2>
          <p style={{ fontSize: 13, color: STEEL, lineHeight: 1.7, marginBottom: 32 }}>
            This link is invalid or has already been used.
            <br />
            Reset links expire after 1 hour.
          </p>
          <Link
            to="/forgot-password"
            style={{
              fontFamily: SANS,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: ACCENT,
            }}
          >
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
          <div
            style={{
              display: 'inline-block',
              width: 40,
              height: 40,
              border: `1px solid rgba(34,197,94,0.4)`,
              background: 'rgba(34,197,94,0.08)',
              lineHeight: '40px',
              fontSize: 16,
              color: '#22C55E',
              marginBottom: 24,
            }}
          >
            ✓
          </div>
          <h2
            style={{
              fontFamily: DISPLAY,
              fontSize: 'clamp(40px, 5vw, 60px)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              color: INK,
              marginBottom: 16,
              lineHeight: 1.0,
            }}
          >
            You're all set.
          </h2>
          <p style={{ fontSize: 13, color: STEEL, lineHeight: 1.7, marginBottom: 32 }}>
            Your password has been changed. Redirecting to sign in…
          </p>
          <Link
            to="/login"
            style={{
              fontFamily: SANS,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: ACCENT,
            }}
          >
            Sign in now →
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <motion.div
        style={{ width: '100%', maxWidth: 420 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <p
          style={{
            fontFamily: SANS,
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.1em',
            color: STEEL,
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          ① Password reset
        </p>
        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            color: INK,
            marginBottom: 32,
            lineHeight: 1.0,
          }}
        >
          Set a new password.
        </h2>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              border: `1px solid rgba(239,68,68,0.35)`,
              background: 'rgba(239,68,68,0.06)',
              borderRadius: 0,
              fontSize: 12,
              color: '#EF4444',
              marginBottom: 20,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontFamily: SANS,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: STEEL,
              }}
            >
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              autoFocus
              style={inp}
              onFocus={focusIn}
              onBlur={focusOut}
            />
            {password && (
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 2,
                        background: i <= strength.score ? strength.color : BORDER,
                        borderRadius: 0,
                        transition: 'background 0.2s',
                      }}
                    />
                  ))}
                </div>
                {strength.label && (
                  <p
                    style={{
                      fontSize: 10,
                      color: strength.color,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {strength.label}
                  </p>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label
              style={{
                fontFamily: SANS,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: STEEL,
              }}
            >
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              required
              style={{ ...inp, borderColor: confirm && confirm !== password ? '#EF4444' : BORDER }}
              onFocus={focusIn}
              onBlur={focusOut}
            />
            {confirm && confirm !== password && (
              <p style={{ fontSize: 10, color: '#EF4444', marginTop: 2, letterSpacing: '0.04em' }}>
                Passwords do not match
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !token || !!(confirm && confirm !== password)}
            style={{
              fontFamily: SANS,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '11px 20px',
              background: ACCENT,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 0,
              cursor: loading || !token ? 'default' : 'pointer',
              opacity: loading || !token ? 0.6 : 1,
              transition: 'background 0.15s, box-shadow 0.2s',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 4,
            }}
            onMouseEnter={(e) => {
              if (!loading && token) {
                e.currentTarget.style.background = '#C50009'
                e.currentTarget.style.boxShadow = '0 0 16px rgba(231,0,11,0.2)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = ACCENT
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <span>{loading ? 'Updating…' : 'Update password'}</span>
            <span>→</span>
          </button>
        </form>
      </motion.div>
    </Shell>
  )
}
