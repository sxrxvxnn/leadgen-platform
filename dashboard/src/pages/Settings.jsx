import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'

export default function Settings() {
  const { user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [hunterKey, setHunterKey] = useState('')
  const [apolloKey, setApolloKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [darkMode, setDarkMode] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    setDarkMode(saved !== 'light')
    const savedName = localStorage.getItem('fullName')
    if (savedName) setFullName(savedName)
    const savedHunter = localStorage.getItem('hunterKey')
    if (savedHunter) setHunterKey(savedHunter)
    const savedApollo = localStorage.getItem('apolloKey')
    if (savedApollo) setApolloKey(savedApollo)
    const savedGroq = localStorage.getItem('groqKey')
    if (savedGroq) setGroqKey(savedGroq)
  }, [])

  function handleSaveName(e) {
    e.preventDefault()
    setSaving(true)
    localStorage.setItem('fullName', fullName)
    window.dispatchEvent(new Event('nameUpdated'))
    setTimeout(() => {
      setSaving(false)
      setMsg('name')
      setTimeout(() => setMsg(''), 3000)
    }, 400)
  }

  function handleSaveKeys(e) {
    e.preventDefault()
    localStorage.setItem('hunterKey', hunterKey)
    localStorage.setItem('apolloKey', apolloKey)
    localStorage.setItem('groqKey', groqKey)
    setMsg('keys')
    setTimeout(() => setMsg(''), 3000)
  }

  function toggleTheme() {
    const newMode = !darkMode
    setDarkMode(newMode)
    const theme = newMode ? 'dark' : 'light'
    localStorage.setItem('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.hero}>
        <p style={s.eyebrow}>SETTINGS</p>
        <h1 style={s.heroTitle}>Account<span style={s.heroUnit}> preferences</span></h1>
      </div>

      <div style={s.container}>

        {/* Profile */}
        <div style={s.section}>
          <p style={s.sectionLabel}>PROFILE</p>
          <div style={s.sectionBody}>
            <div style={s.avatar}>
              <span style={s.avatarText}>{(fullName || user?.email || 'U')[0].toUpperCase()}</span>
            </div>
            <div>
              <p style={s.profileName}>{fullName || user?.email?.split('@')[0] || 'User'}</p>
              <p style={s.profileEmail}>{user?.email}</p>
            </div>
          </div>
          <form onSubmit={handleSaveName} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>DISPLAY NAME</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" style={s.input} data-hover="true" />
            </div>
            <button type="submit" style={s.saveBtn} disabled={saving} data-hover="true">
              <span>{saving ? 'Saving...' : 'Save name'}</span>
              <span>→</span>
            </button>
            {msg === 'name' && <p style={s.msgText}>Name updated.</p>}
          </form>
        </div>

        {/* Appearance */}
        <div style={s.section}>
          <p style={s.sectionLabel}>APPEARANCE</p>
          <div style={s.themeRow}>
            <div>
              <p style={s.themeTitle}>{darkMode ? 'Dark mode' : 'Light mode'}</p>
              <p style={s.themeSub}>Switch between dark and light interface</p>
            </div>
            <button onClick={toggleTheme} style={{ ...s.toggle, background: darkMode ? 'var(--white)' : 'var(--gray-2)' }} data-hover="true">
              <span style={{ ...s.toggleKnob, transform: darkMode ? 'translateX(24px)' : 'translateX(2px)', background: darkMode ? 'var(--black)' : 'var(--gray-4)' }} />
            </button>
          </div>
        </div>

        {/* API Keys */}
        <div style={s.section}>
          <p style={s.sectionLabel}>API KEYS</p>
          <p style={s.sectionDesc}>Add your API keys to enable enrichment and AI compliance checking. Keys are stored locally on your device only.</p>
          <form onSubmit={handleSaveKeys} style={{ ...s.form, marginTop: '20px' }}>

            <div style={s.field}>
              <label style={s.label}>GROQ API KEY</label>
              <input type="password" value={groqKey} onChange={(e) => setGroqKey(e.target.value)} placeholder="gsk_..." style={s.input} data-hover="true" />
              <p style={s.fieldHint}>
                Free at console.groq.com — powers AI compliance checking. No credit card needed.
              </p>
            </div>

            <div style={s.divider} />

            <div style={s.field}>
              <label style={s.label}>HUNTER.IO API KEY</label>
              <input type="password" value={hunterKey} onChange={(e) => setHunterKey(e.target.value)} placeholder="Enter your Hunter.io API key" style={s.input} data-hover="true" />
              <p style={s.fieldHint}>Get a free key at hunter.io — 25 email lookups/month free</p>
            </div>

            <div style={s.field}>
              <label style={s.label}>APOLLO.IO API KEY</label>
              <input type="password" value={apolloKey} onChange={(e) => setApolloKey(e.target.value)} placeholder="Enter your Apollo.io API key" style={s.input} data-hover="true" />
              <p style={s.fieldHint}>Get a free key at apollo.io — 50 credits/month free</p>
            </div>

            <button type="submit" style={s.saveBtn} data-hover="true">
              <span>Save API keys</span>
              <span>→</span>
            </button>
            {msg === 'keys' && <p style={s.msgText}>API keys saved locally.</p>}
          </form>
        </div>

        {/* Account info */}
        <div style={s.section}>
          <p style={s.sectionLabel}>ACCOUNT</p>
          <div style={s.infoGrid}>
            {[
              { label: 'EMAIL', value: user?.email },
              { label: 'PLAN', value: 'FREE' },
              { label: 'STATUS', value: 'ACTIVE' },
              { label: 'GROQ KEY', value: groqKey ? '••••' + groqKey.slice(-4) : 'Not set' },
              { label: 'HUNTER KEY', value: hunterKey ? '••••' + hunterKey.slice(-4) : 'Not set' },
              { label: 'APOLLO KEY', value: apolloKey ? '••••' + apolloKey.slice(-4) : 'Not set' },
            ].map(({ label, value }) => (
              <div key={label} style={s.infoItem}>
                <p style={s.infoLabel}>{label}</p>
                <p style={{ ...s.infoValue, color: value === 'ACTIVE' ? 'var(--green)' : value === 'Not set' ? 'var(--gray-3)' : 'var(--white)' }}>{value || '—'}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: 'var(--black)' },
  hero: { padding: '48px 32px 32px', borderBottom: '1px solid var(--gray-2)' },
  eyebrow: { fontSize: '11px', fontWeight: '600', letterSpacing: '4px', color: 'var(--gray-4)', marginBottom: '12px' },
  heroTitle: { fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: '900', letterSpacing: '-2px', color: 'var(--white)', lineHeight: 1 },
  heroUnit: { fontSize: 'clamp(20px, 2.5vw, 32px)', fontWeight: '300', color: 'var(--gray-4)', letterSpacing: '-1px' },
  container: { padding: '32px', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '24px' },
  section: { background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', padding: '28px' },
  sectionLabel: { fontSize: '9px', fontWeight: '700', letterSpacing: '3px', color: 'var(--gray-4)', marginBottom: '20px' },
  sectionDesc: { fontSize: '12px', color: 'var(--gray-4)', lineHeight: 1.6, marginTop: '-12px', marginBottom: '4px' },
  sectionBody: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--gray-2)' },
  avatar: { width: '56px', height: '56px', borderRadius: '50%', background: 'var(--gray-2)', border: '1px solid var(--gray-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: '20px', fontWeight: '900', color: 'var(--white)' },
  profileName: { fontSize: '16px', fontWeight: '700', color: 'var(--white)', marginBottom: '4px', letterSpacing: '-0.3px' },
  profileEmail: { fontSize: '12px', color: 'var(--gray-4)' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '9px', fontWeight: '700', letterSpacing: '2px', color: 'var(--gray-4)' },
  fieldHint: { fontSize: '11px', color: 'var(--gray-4)', marginTop: '2px' },
  input: { padding: '12px 14px', background: 'var(--black)', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '13px', color: 'var(--white)', outline: 'none', fontFamily: 'inherit' },
  divider: { height: '1px', background: 'var(--gray-2)', margin: '4px 0' },
  saveBtn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'var(--white)', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '700', color: 'var(--black)', cursor: 'pointer', maxWidth: '200px' },
  msgText: { fontSize: '12px', color: 'var(--green)', fontWeight: '600' },
  themeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  themeTitle: { fontSize: '14px', fontWeight: '600', color: 'var(--white)', marginBottom: '4px' },
  themeSub: { fontSize: '12px', color: 'var(--gray-4)' },
  toggle: { width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 },
  toggleKnob: { position: 'absolute', top: '3px', width: '20px', height: '20px', borderRadius: '50%', transition: 'transform 0.2s' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  infoItem: { padding: '14px', background: 'var(--black)', border: '1px solid var(--gray-2)', borderRadius: '4px' },
  infoLabel: { fontSize: '9px', fontWeight: '700', letterSpacing: '2px', color: 'var(--gray-4)', marginBottom: '8px' },
  infoValue: { fontSize: '13px', fontWeight: '600', color: 'var(--white)' },
}