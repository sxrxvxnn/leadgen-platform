import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
      <rect x="0"  y="0"  width="8" height="8" rx="1.5" fill="rgba(253,253,253,0.9)" />
      <rect x="10" y="0"  width="8" height="8" rx="1.5" fill="rgba(253,253,253,0.9)" />
      <rect x="0"  y="10" width="8" height="8" rx="1.5" fill="rgba(253,253,253,0.9)" />
      <rect x="10" y="10" width="8" height="8" rx="1.5" fill="rgba(253,253,253,0.9)" />
    </svg>
  )
}

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'var(--border)' }
  let score = 0
  if (pw.length >= 8)              score++
  if (/[A-Z]/.test(pw))           score++
  if (/[a-z]/.test(pw))           score++
  if (/[0-9]/.test(pw))           score++
  if (/[^A-Za-z0-9]/.test(pw))   score++
  const map = [
    { label: '',        color: 'var(--border)' },
    { label: 'Weak',    color: '#c0392b' },
    { label: 'Fair',    color: '#e67e22' },
    { label: 'Good',    color: '#f1c40f' },
    { label: 'Strong',  color: '#27ae60' },
    { label: 'Strong',  color: '#27ae60' },
  ]
  return { score, ...map[score] }
}

export default function Signup() {
  const [fullName,   setFullName]   = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [error,      setError]      = useState('')
  const [done,       setDone]       = useState(false)
  const [loading,    setLoading]    = useState(false)
  const { signup } = useAuth()

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
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={s.page}>
        <div style={{ ...s.card, maxWidth: '480px', padding: '64px 48px', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(74,124,89,0.12)', border: '1px solid rgba(74,124,89,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>✉</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', margin: 0 }}>Check your inbox</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
            We've sent a confirmation link to <strong>{email}</strong>.<br />
            Click it to activate your account, then come back to sign in.
          </p>
          <Link to="/login" style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)', fontWeight: '500', textDecoration: 'none', borderBottom: '1px solid var(--accent)' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.left}>
          <div style={s.brandMark}><LogoMark /></div>
          <h1 style={s.bigTitle}>Start.<br />Scale.<br />Win.</h1>
          <p style={s.tagline}>The intelligence platform for modern B2B sales teams.</p>
          <div style={s.stats}>
            {[['10k+', 'Leads extracted daily'], ['3 min', 'Average setup time'], ['100%', 'Live LinkedIn data']].map(([val, label]) => (
              <div key={val}>
                <p style={s.statVal}>{val}</p>
                <p style={s.statLabel}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={s.right}>
          <div style={s.formHeader}>
            <p style={s.formEyebrow}>Create account</p>
            <h2 style={s.formTitle}>Get started.</h2>
          </div>

          {error && (
            <div style={s.errorBox}>
              <span style={s.errorDot} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={s.formInner}>
            <div style={s.field}>
              <label style={s.label}>Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                style={s.input} placeholder="Your name" required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={s.input} placeholder="you@company.com" required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={s.input} placeholder="Min. 8 characters" required />
              {password && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{
                        flex: 1, height: '3px', borderRadius: '2px',
                        background: i <= strength.score ? strength.color : 'var(--border)',
                        transition: 'background 0.2s',
                      }} />
                    ))}
                  </div>
                  {strength.label && (
                    <p style={{ fontSize: '11px', color: strength.color, margin: 0 }}>{strength.label}</p>
                  )}
                </div>
              )}
            </div>
            <div style={s.field}>
              <label style={s.label}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                style={{
                  ...s.input,
                  borderColor: confirm && confirm !== password ? '#c0392b' : undefined,
                }}
                placeholder="Repeat password" required />
              {confirm && confirm !== password && (
                <p style={{ fontSize: '11px', color: '#c0392b', margin: '4px 0 0' }}>Passwords do not match</p>
              )}
            </div>
            <button type="submit"
              style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}
              disabled={loading || (confirm && confirm !== password)}>
              <span>{loading ? 'Creating account…' : 'Create account'}</span>
              <span>→</span>
            </button>
          </form>

          <p style={s.switchText}>
            Already have an account?{' '}
            <Link to="/login" style={s.switchLink}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const s = {
  page:       { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' },
  card:       { display: 'flex', width: '100%', maxWidth: '860px', minHeight: '560px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 40px rgba(29,27,27,0.08)' },
  left:       { flex: 1, padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'var(--text)', color: 'var(--bg)' },
  brandMark:  { display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'auto' },
  bigTitle:   { fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: '400', lineHeight: 1.05, letterSpacing: '-0.05em', color: 'rgba(253,253,253,0.95)', marginBottom: '20px' },
  tagline:    { fontSize: '13px', color: 'rgba(253,253,253,0.55)', lineHeight: 1.7, maxWidth: '280px', marginBottom: '28px' },
  stats:      { display: 'flex', gap: '28px', borderTop: '1px solid rgba(253,253,253,0.12)', paddingTop: '24px' },
  statVal:    { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '400', color: 'rgba(253,253,253,0.9)', marginBottom: '3px', letterSpacing: '-0.04em' },
  statLabel:  { fontSize: '11px', color: 'rgba(253,253,253,0.45)', lineHeight: 1.4 },
  right:      { width: '380px', padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--bg)' },
  formHeader: { marginBottom: '24px' },
  formEyebrow:{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' },
  formTitle:  { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1 },
  errorBox:   { display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'var(--red-dim)', border: '1px solid rgba(184,50,50,0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--red)', marginBottom: '16px', lineHeight: 1.5 },
  errorDot:   { width: '5px', height: '5px', borderRadius: '50%', background: 'var(--red)', flexShrink: 0, marginTop: '4px' },
  formInner:  { display: 'flex', flexDirection: 'column', gap: '14px' },
  field:      { display: 'flex', flexDirection: 'column', gap: '5px' },
  label:      { fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)' },
  input:      { padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' },
  btn:        { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--text)', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', color: 'var(--bg)', cursor: 'pointer', marginTop: '4px', fontFamily: 'var(--font-mono)' },
  switchText: { marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)' },
  switchLink: { color: 'var(--text)', fontWeight: '500', borderBottom: '1px solid var(--border)' },
}
