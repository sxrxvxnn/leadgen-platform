import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: PLUM }}>{label}</label>
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
      <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 40px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: INK, textDecoration: 'none' }}>Sonar</Link>
        <Link to="/signup" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: MID, textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = INK}
          onMouseLeave={e => e.currentTarget.style.color = MID}
        >Create account</Link>
      </nav>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>

        {/* Left — editorial */}
        <div style={{ padding: '64px 56px', borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: SURF }}>
          <p style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MID, textTransform: 'uppercase', marginBottom: 32 }}>① Sign in</p>
          <h1 style={{ margin: 0, lineHeight: 1.05, marginBottom: 24 }}>
            <motion.span initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0 }} style={{ display: 'block', fontFamily: SERIF, fontSize: 'clamp(40px, 5.5vw, 72px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: INK }}>
              Find.
            </motion.span>
            <motion.span initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} style={{ display: 'block', fontFamily: SERIF, fontSize: 'clamp(40px, 5.5vw, 72px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: INK }}>
              Target.
            </motion.span>
            <motion.span initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.3 }} style={{ display: 'block', fontFamily: SANS, fontSize: 'clamp(32px, 4.5vw, 60px)', fontWeight: 700, letterSpacing: '-0.03em', color: PLUM }}>
              Close.
            </motion.span>
          </h1>
          <p style={{ fontFamily: SANS, fontSize: 14, color: MID, lineHeight: 1.7, maxWidth: 300 }}>
            The signal intelligence platform for modern B2B sales teams.
          </p>
        </div>

        {/* Right — form */}
        <div style={{ padding: '64px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <motion.div
            style={{ maxWidth: 380 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <h2 style={{ fontFamily: SANS, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: INK, marginBottom: 8 }}>Welcome back.</h2>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MID, marginBottom: 32 }}>Sign in to your Sonar account.</p>

            {error && (
              <div style={{ padding: '10px 14px', border: `1px solid rgba(184,50,50,0.3)`, background: 'rgba(184,50,50,0.05)', borderRadius: 6, fontSize: 13, color: '#b83232', marginBottom: 20, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Email address">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required style={inp}
                  onFocus={e => { e.target.style.borderColor = '#6f63b7'; e.target.style.boxShadow = '0 0 0 3px rgba(71,57,130,0.12)' }}
                  onBlur={e => { e.target.style.borderColor = LINE; e.target.style.boxShadow = 'rgba(71, 57, 130, 0.06) 0px 0px 0px 1px inset' }}
                />
              </Field>
              <Field label="Password">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required style={inp}
                  onFocus={e => { e.target.style.borderColor = '#6f63b7'; e.target.style.boxShadow = '0 0 0 3px rgba(71,57,130,0.12)' }}
                  onBlur={e => { e.target.style.borderColor = LINE; e.target.style.boxShadow = 'rgba(71, 57, 130, 0.06) 0px 0px 0px 1px inset' }}
                />
              </Field>
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
                <span>{loading ? 'Signing in…' : 'Sign in'}</span>
                <span>→</span>
              </button>
            </form>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MID }}>
              <span>No account?{' '}
                <Link to="/signup" style={{ color: PLUM, fontWeight: 600, borderBottom: `1px solid ${LINE}` }}>Create one</Link>
              </span>
              <Link to="/forgot-password" style={{ color: MID, borderBottom: `1px solid ${LINE}` }}>Forgot password?</Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
