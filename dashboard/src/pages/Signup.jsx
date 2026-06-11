import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await signup(email, password, fullName)
      setSuccess('Account created. Redirecting...')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.left}>
          <div style={s.brandMark}><LogoMark /></div>
          <h1 style={s.bigTitle}>Start.<br />Scale.<br />Win.</h1>
          <p style={s.tagline}>Join thousands of sales operators using LeadGen to find and close their best leads.</p>
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
          {success && (
            <div style={s.successBox}>
              <span style={{ ...s.errorDot, background: '#4a7c59' }} />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={s.formInner}>
            <div style={s.field}>
              <label style={s.label}>Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={s.input} placeholder="Your name" required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={s.input} placeholder="you@company.com" required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={s.input} placeholder="Min. 8 characters" required />
            </div>
            <button type="submit" style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
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
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' },
  card: { display: 'flex', width: '100%', maxWidth: '860px', minHeight: '540px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 40px rgba(29,27,27,0.08)' },
  left: { flex: 1, padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'var(--text)', color: 'var(--bg)' },
  brandMark: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'auto' },
  bigTitle: { fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: '400', lineHeight: 1.05, letterSpacing: '-0.05em', color: 'rgba(253,253,253,0.95)', marginBottom: '20px' },
  tagline: { fontSize: '13px', color: 'rgba(253,253,253,0.55)', lineHeight: 1.7, maxWidth: '280px', marginBottom: '28px' },
  stats: { display: 'flex', gap: '28px', borderTop: '1px solid rgba(253,253,253,0.12)', paddingTop: '24px' },
  statVal: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '400', color: 'rgba(253,253,253,0.9)', marginBottom: '3px', letterSpacing: '-0.04em' },
  statLabel: { fontSize: '11px', color: 'rgba(253,253,253,0.45)', lineHeight: 1.4 },
  right: { width: '380px', padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--bg)' },
  formHeader: { marginBottom: '28px' },
  formEyebrow: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' },
  formTitle: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1 },
  errorBox: { display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'var(--red-dim)', border: '1px solid rgba(184,50,50,0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--red)', marginBottom: '16px', lineHeight: 1.5 },
  successBox: { display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(74,124,89,0.08)', border: '1px solid rgba(74,124,89,0.25)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#4a7c59', marginBottom: '16px', lineHeight: 1.5 },
  errorDot: { width: '5px', height: '5px', borderRadius: '50%', background: 'var(--red)', flexShrink: 0, marginTop: '4px' },
  formInner: { display: 'flex', flexDirection: 'column', gap: '14px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)' },
  input: { padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' },
  btn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--text)', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', color: 'var(--bg)', cursor: 'pointer', marginTop: '4px', fontFamily: 'var(--font-mono)' },
  switchText: { marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)' },
  switchLink: { color: 'var(--text)', fontWeight: '500', borderBottom: '1px solid var(--border)' },
}
