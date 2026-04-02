import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

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

  const t = { transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)' }

  return (
    <div style={s.page}>
      <div style={s.left}>
        <div style={{ ...s.leftInner, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', ...t }}>
          <p style={s.eyebrow}>LEADGEN ENGINE</p>
          <h1 style={s.bigTitle}>Start.<br />Scale.<br />Win.</h1>
          <p style={s.tagline}>Join thousands of sales operators using LeadGen Engine to find and close their best leads.</p>
          <div style={s.stats}>
            {[['10k+', 'Leads extracted daily'], ['3min', 'Average setup time'], ['100%', 'Live LinkedIn data']].map(([val, label]) => (
              <div key={val} style={s.stat}>
                <p style={s.statVal}>{val}</p>
                <p style={s.statLabel}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={s.right}>
        <div style={{ ...s.form, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', ...t, transitionDelay: '0.1s' }}>
          <div style={s.formHeader}>
            <p style={s.formEyebrow}>CREATE ACCOUNT</p>
            <h2 style={s.formTitle}>Get started.</h2>
          </div>
          {error && (
            <div style={s.errorBox}>
              <span style={s.dot} />
              {error}
            </div>
          )}
          {success && (
            <div style={s.successBox}>
              <span style={{ ...s.dot, background: 'var(--green)' }} />
              {success}
            </div>
          )}
          <form onSubmit={handleSubmit} style={s.formInner}>
            {[
              { label: 'Full Name', type: 'text', val: fullName, set: setFullName, ph: 'Your name' },
              { label: 'Email', type: 'email', val: email, set: setEmail, ph: 'you@company.com' },
              { label: 'Password', type: 'password', val: password, set: setPassword, ph: 'Min. 8 characters' },
            ].map(({ label, type, val, set, ph }) => (
              <div key={label} style={s.field}>
                <label style={s.label}>{label}</label>
                <input type={type} value={val} onChange={(e) => set(e.target.value)} style={s.input} placeholder={ph} required data-hover="true" />
              </div>
            ))}
            <button type="submit" style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} disabled={loading} data-hover="true">
              <span>{loading ? 'Creating account...' : 'Create account'}</span>
              <span style={s.btnArrow}>→</span>
            </button>
          </form>
          <p style={s.switchText}>
            Already have an account?{' '}
            <Link to="/login" style={s.switchLink} data-hover="true">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { display: 'flex', minHeight: '100vh', background: 'var(--black)' },
  left: { flex: 1, background: 'var(--gray-1)', borderRight: '1px solid var(--gray-2)', display: 'flex', alignItems: 'flex-end', padding: '60px', overflow: 'hidden' },
  leftInner: { width: '100%' },
  eyebrow: { fontSize: '11px', fontWeight: '600', letterSpacing: '4px', color: 'var(--gray-4)', marginBottom: '32px' },
  bigTitle: { fontSize: 'clamp(56px, 6vw, 88px)', fontWeight: '900', lineHeight: 0.95, letterSpacing: '-3px', color: 'var(--white)', marginBottom: '32px' },
  tagline: { fontSize: '14px', color: 'var(--gray-5)', lineHeight: 1.7, maxWidth: '340px', marginBottom: '48px' },
  stats: { display: 'flex', gap: '40px', borderTop: '1px solid var(--gray-2)', paddingTop: '32px' },
  stat: {},
  statVal: { fontSize: '28px', fontWeight: '900', letterSpacing: '-1px', color: 'var(--white)', marginBottom: '4px' },
  statLabel: { fontSize: '11px', color: 'var(--gray-4)', letterSpacing: '1px' },
  right: { width: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' },
  form: { width: '100%' },
  formHeader: { marginBottom: '40px' },
  formEyebrow: { fontSize: '11px', fontWeight: '600', letterSpacing: '4px', color: 'var(--gray-4)', marginBottom: '12px' },
  formTitle: { fontSize: '36px', fontWeight: '900', letterSpacing: '-1.5px', color: 'var(--white)', lineHeight: 1 },
  errorBox: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: '4px', padding: '12px 16px', fontSize: '13px', color: 'var(--red)', marginBottom: '24px' },
  successBox: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--green-dim)', border: '1px solid var(--green)', borderRadius: '4px', padding: '12px 16px', fontSize: '13px', color: 'var(--green)', marginBottom: '24px' },
  dot: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)', flexShrink: 0 },
  formInner: { display: 'flex', flexDirection: 'column', gap: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '11px', fontWeight: '600', letterSpacing: '2px', color: 'var(--gray-4)', textTransform: 'uppercase' },
  input: { padding: '14px 16px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '14px', color: 'var(--white)', outline: 'none' },
  btn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--white)', border: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: '700', color: 'var(--black)', cursor: 'none', marginTop: '8px' },
  btnArrow: { fontSize: '18px' },
  switchText: { marginTop: '32px', fontSize: '13px', color: 'var(--gray-4)' },
  switchLink: { color: 'var(--white)', fontWeight: '600', borderBottom: '1px solid var(--gray-3)' },
}