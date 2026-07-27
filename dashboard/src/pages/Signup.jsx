import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase-client'

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

function Field({ label, children }) {
  return (
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
        {label}
      </label>
      {children}
    </div>
  )
}

const focusIn = (e) => {
  e.target.style.borderColor = ACCENT
}
const focusOut = (e) => {
  e.target.style.borderColor = BORDER
}

const CALLBACK_URL = `${window.location.origin}/auth/callback`

function signInWithOAuth(provider) {
  return supabase.auth.signInWithOAuth({ provider, options: { redirectTo: CALLBACK_URL } })
}

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signup, login } = useAuth()
  const navigate = useNavigate()
  const strength = passwordStrength(password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await signup(email, password, fullName)
      // Supabase auto-confirms accounts — attempt immediate login
      try {
        await login(email, password)
        navigate('/dashboard')
        return
      } catch {
        // Email confirmation required (or other issue) — fall through to inbox screen
        setDone(true)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
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
                background: '#FFFF00',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="#121212" strokeWidth="1.3" />
                <circle cx="7" cy="7" r="3.2" stroke="#121212" strokeWidth="1.3" />
                <circle cx="7" cy="7" r="1" fill="#121212" />
                <line x1="7" y1="1" x2="7" y2="3" stroke="#121212" strokeWidth="1.1" />
                <line x1="7" y1="11" x2="7" y2="13" stroke="#121212" strokeWidth="1.1" />
                <line x1="1" y1="7" x2="3" y2="7" stroke="#121212" strokeWidth="1.1" />
                <line x1="11" y1="7" x2="13" y2="7" stroke="#121212" strokeWidth="1.1" />
              </svg>
            </div>
            Sonar
          </Link>
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
                fontSize: 'clamp(40px, 5vw, 64px)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '-0.01em',
                color: INK,
                marginBottom: 16,
                lineHeight: 1.0,
              }}
            >
              Check your inbox.
            </h2>
            <p style={{ fontSize: 13, color: STEEL, lineHeight: 1.7, marginBottom: 32 }}>
              We sent a confirmation link to <strong style={{ color: INK }}>{email}</strong>.<br />
              Click it to activate your account, then sign in.
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
              Back to sign in →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
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
      {/* Nav */}
      <nav
        style={{
          borderBottom: `1px solid ${BORDER}`,
          padding: '0 40px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: BG,
        }}
      >
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
        <Link
          to="/login"
          style={{
            fontFamily: SANS,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: STEEL,
            textDecoration: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = INK)}
          onMouseLeave={(e) => (e.currentTarget.style.color = STEEL)}
        >
          Sign in
        </Link>
      </nav>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
        {/* Left — dark editorial panel */}
        <div
          style={{
            padding: '64px 56px',
            borderRight: `1px solid ${BORDER}`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            background: '#0A0A0A',
            backgroundImage: 'radial-gradient(#2A2A2A 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px',
            position: 'relative',
          }}
        >
          <p
            style={{
              fontFamily: SANS,
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.1em',
              color: '#5B6670',
              textTransform: 'uppercase',
              marginBottom: 32,
            }}
          >
            ① Get started
          </p>
          <h1 style={{ margin: '0 0 24px', lineHeight: 0.95 }}>
            {['Start.', 'Scale.', 'Win.'].map((word, i) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.12 }}
                style={{
                  display: 'block',
                  fontFamily: DISPLAY,
                  fontSize: 'clamp(48px, 6vw, 80px)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.01em',
                  color: i < 2 ? '#F5F5F5' : ACCENT,
                }}
              >
                {word}
              </motion.span>
            ))}
          </h1>
          <p
            style={{
              fontFamily: SANS,
              fontSize: 13,
              color: '#5B6670',
              lineHeight: 1.7,
              maxWidth: 280,
            }}
          >
            The signal intelligence platform for modern B2B sales teams.
          </p>
        </div>

        {/* Right — form panel */}
        <div
          style={{
            padding: '48px 56px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflowY: 'auto',
            background: SURF,
          }}
        >
          <motion.div
            style={{ maxWidth: 380 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <h2
              style={{
                fontFamily: SANS,
                fontSize: 22,
                fontWeight: 700,
                color: INK,
                marginBottom: 6,
              }}
            >
              Create account.
            </h2>
            <p style={{ fontFamily: SANS, fontSize: 13, color: STEEL, marginBottom: 22 }}>
              Start for free — no credit card required.
            </p>

            {/* Social OAuth buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => signInWithOAuth('google')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: '#FFFFFF',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 0,
                  cursor: 'pointer',
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: 500,
                  color: INK,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#9CA3AF'
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = BORDER
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </button>
              <button
                type="button"
                onClick={() => signInWithOAuth('linkedin_oidc')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: '#FFFFFF',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 0,
                  cursor: 'pointer',
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: 500,
                  color: INK,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#9CA3AF'
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = BORDER
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                Continue with LinkedIn
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
              <span
                style={{
                  fontFamily: SANS,
                  fontSize: 10,
                  color: STEEL,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                or continue with email
              </span>
              <div style={{ flex: 1, height: 1, background: BORDER }} />
            </div>

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

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <Field label="Full name">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  required
                  style={inp}
                  onFocus={focusIn}
                  onBlur={focusOut}
                />
              </Field>
              <Field label="Email address">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  style={inp}
                  onFocus={focusIn}
                  onBlur={focusOut}
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
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
              </Field>
              <Field label="Confirm password">
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  required
                  style={{
                    ...inp,
                    borderColor: confirm && confirm !== password ? '#EF4444' : BORDER,
                  }}
                  onFocus={focusIn}
                  onBlur={focusOut}
                />
                {confirm && confirm !== password && (
                  <p
                    style={{
                      fontSize: 10,
                      color: '#EF4444',
                      marginTop: 2,
                      letterSpacing: '0.04em',
                    }}
                  >
                    Passwords do not match
                  </p>
                )}
              </Field>
              <button
                type="submit"
                disabled={loading || !!(confirm && confirm !== password)}
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
                  cursor: loading ? 'default' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  transition: 'background 0.15s, box-shadow 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 4,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = '#C50009'
                    e.currentTarget.style.boxShadow = '0 0 16px rgba(231,0,11,0.2)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = ACCENT
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <span>{loading ? 'Creating account…' : 'Create account'}</span>
                <span>→</span>
              </button>
            </form>

            <p style={{ marginTop: 20, fontSize: 12, color: STEEL }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: INK, fontWeight: 600 }}>
                Sign in
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
