import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'var(--border)' }
  let score = 0
  if (pw.length >= 8)             score++
  if (/[A-Z]/.test(pw))          score++
  if (/[a-z]/.test(pw))          score++
  if (/[0-9]/.test(pw))          score++
  if (/[^A-Za-z0-9]/.test(pw))  score++
  const map = [
    { label: '',       color: 'var(--border)' },
    { label: 'Weak',   color: '#c0392b' },
    { label: 'Fair',   color: '#e67e22' },
    { label: 'Good',   color: '#f1c40f' },
    { label: 'Strong', color: '#27ae60' },
    { label: 'Strong', color: '#27ae60' },
  ]
  return { score, ...map[score] }
}

export default function ResetPassword() {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [token,     setToken]     = useState('')
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [invalid,   setInvalid]   = useState(false)
  const { resetPassword } = useAuth()
  const navigate = useNavigate()

  const strength = passwordStrength(password)

  // Extract recovery token from URL hash (#access_token=xxx&type=recovery)
  useEffect(() => {
    const hash   = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const type   = params.get('type')
    const tk     = params.get('access_token')

    if (type !== 'recovery' || !tk) {
      setInvalid(true)
      return
    }
    setToken(tk)
    // Clear token from URL bar so it can't be bookmarked/shared
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

  if (invalid) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <p style={s.eyebrow}>Password reset</p>
          <h2 style={s.title}>Invalid reset link</h2>
          <p style={{ ...s.body, marginTop: '12px' }}>
            This link is invalid or has already been used. Reset links expire after 1 hour.
          </p>
          <Link to="/forgot-password" style={s.backLink}>Request a new link →</Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(74,124,89,0.12)', border: '1px solid rgba(74,124,89,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>✓</div>
          <h2 style={s.title}>Password updated</h2>
          <p style={{ ...s.body, marginTop: '12px' }}>Your password has been changed. Redirecting to sign in…</p>
          <Link to="/login" style={s.backLink}>Sign in now →</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ marginBottom: '24px' }}>
          <p style={s.eyebrow}>Password reset</p>
          <h2 style={s.title}>Set a new password</h2>
        </div>

        {error && (
          <div style={s.errorBox}>
            <span style={s.errorDot} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={s.label}>New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={s.input}
              placeholder="Min. 8 characters"
              required
              autoFocus
            />
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
                {strength.label && <p style={{ fontSize: '11px', color: strength.color, margin: 0 }}>{strength.label}</p>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={s.label}>Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              style={{ ...s.input, borderColor: confirm && confirm !== password ? '#c0392b' : undefined }}
              placeholder="Repeat password"
              required
            />
            {confirm && confirm !== password && (
              <p style={{ fontSize: '11px', color: '#c0392b', margin: '4px 0 0' }}>Passwords do not match</p>
            )}
          </div>
          <button
            type="submit"
            style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}
            disabled={loading || !token || (confirm && confirm !== password)}>
            <span>{loading ? 'Updating…' : 'Update password'}</span>
            <span>→</span>
          </button>
        </form>
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
  errorBox: { display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'var(--red-dim)', border: '1px solid rgba(184,50,50,0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--red)', marginBottom: '14px', lineHeight: 1.5 },
  errorDot: { width: '5px', height: '5px', borderRadius: '50%', background: 'var(--red)', flexShrink: 0, marginTop: '4px' },
}
