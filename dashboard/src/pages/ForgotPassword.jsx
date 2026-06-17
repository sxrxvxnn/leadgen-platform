import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const { forgotPassword } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch {
      // Always show success to prevent email enumeration
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ marginBottom: '28px' }}>
          <p style={s.eyebrow}>Password reset</p>
          <h2 style={s.title}>{sent ? 'Check your email.' : 'Forgot your password?'}</h2>
        </div>

        {sent ? (
          <>
            <p style={s.body}>
              If <strong>{email}</strong> is registered, we've sent a reset link. Check your inbox (and spam folder).
            </p>
            <p style={{ ...s.body, marginTop: '16px' }}>
              The link expires in <strong>1 hour</strong>.
            </p>
            <Link to="/login" style={s.backLink}>← Back to sign in</Link>
          </>
        ) : (
          <>
            <p style={s.body}>Enter your email and we'll send a reset link if an account exists.</p>
            {error && (
              <div style={s.errorBox}>
                <span style={s.errorDot} />
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={s.label}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={s.input}
                  placeholder="you@company.com"
                  required
                  autoFocus
                />
              </div>
              <button type="submit" style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
                <span>{loading ? 'Sending…' : 'Send reset link'}</span>
                <span>→</span>
              </button>
            </form>
            <Link to="/login" style={s.backLink}>← Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  page:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' },
  card:     { width: '100%', maxWidth: '400px', padding: '48px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: '0 4px 24px rgba(29,27,27,0.06)' },
  eyebrow:  { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', margin: '0 0 8px' },
  title:    { fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', margin: 0 },
  body:     { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 },
  label:    { fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)' },
  input:    { padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' },
  btn:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#1d1b1b', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', color: '#fdfdfd', cursor: 'pointer', fontFamily: 'var(--font-mono)' },
  backLink: { display: 'inline-block', marginTop: '24px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none', borderBottom: '1px solid var(--border-subtle)' },
  errorBox: { display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'var(--red-dim)', border: '1px solid rgba(184,50,50,0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--red)', marginTop: '12px', lineHeight: 1.5 },
  errorDot: { width: '5px', height: '5px', borderRadius: '50%', background: 'var(--red)', flexShrink: 0, marginTop: '4px' },
}
