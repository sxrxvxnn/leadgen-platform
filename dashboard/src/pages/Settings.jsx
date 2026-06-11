import React, { useState } from 'react'
import Navbar from '../components/Navbar'

export default function Settings() {
  const [fullName,      setFullName]      = useState(localStorage.getItem('fullName') || '')
  const [geminiKey,     setGeminiKey]     = useState(localStorage.getItem('geminiKey') || '')
  const [openaiKey,     setOpenaiKey]     = useState(localStorage.getItem('openaiKey') || '')
  const [groqKey,       setGroqKey]       = useState(localStorage.getItem('groqKey') || '')
  const [openrouterKey, setOpenrouterKey] = useState(localStorage.getItem('openrouterKey') || '')
  const [hunterKey,     setHunterKey]     = useState(localStorage.getItem('hunterKey') || '')
  const [apolloKey,     setApolloKey]     = useState(localStorage.getItem('apolloKey') || '')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    localStorage.setItem('fullName', fullName)
    localStorage.setItem('geminiKey', geminiKey)
    localStorage.setItem('openaiKey', openaiKey)
    localStorage.setItem('groqKey', groqKey)
    localStorage.setItem('openrouterKey', openrouterKey)
    localStorage.setItem('hunterKey', hunterKey)
    localStorage.setItem('apolloKey', apolloKey)
    window.dispatchEvent(new Event('nameUpdated'))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '48px 24px' }}>
        <p style={s.eyebrow}>Configuration</p>
        <h1 style={s.title}>Settings</h1>

        <section style={s.section}>
          <h2 style={s.sectionTitle}>Profile</h2>
          <Field label="Your name" hint="Used as account manager in spreadsheet view">
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" style={s.input} />
          </Field>
        </section>

        <section style={s.section}>
          <h2 style={s.sectionTitle}>AI Keys</h2>
          <p style={s.sectionHint}>Priority order: Gemini → OpenAI → Groq. Add at least one key to enable AI features.</p>

          <Field label="Google Gemini API Key" badge="Free · Best choice" badgeColor="green"
            hint={<>Most accurate free AI. Get free key at <ExtLink href="https://aistudio.google.com">aistudio.google.com</ExtLink></>}>
            <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="AIza…" style={s.input} />
            {geminiKey && <p style={s.keySet}>✓ Key saved</p>}
          </Field>

          <Field label="OpenAI API Key" badge="GPT-4o · Paid" badgeColor="blue"
            hint={<>Accurate, requires billing. Get from <ExtLink href="https://platform.openai.com/api-keys">platform.openai.com</ExtLink></>}>
            <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-…" style={s.input} />
            {openaiKey && <p style={s.keySet}>✓ Key saved</p>}
          </Field>

          <Field label="Groq API Key" badge="Llama · Free · Fast" badgeColor="amber"
            hint={<>Fast and free. Get free key at <ExtLink href="https://console.groq.com">console.groq.com</ExtLink></>}>
            <input type="password" value={groqKey} onChange={e => setGroqKey(e.target.value)} placeholder="gsk_…" style={s.input} />
            {groqKey && <p style={s.keySet}>✓ Key saved</p>}
          </Field>

          <Field label="OpenRouter API Key" badge="Qwen3 · Free tier" badgeColor="amber"
            hint="Used to extract LinkedIn URLs from company websites when regex fails.">
            <input type="password" value={openrouterKey} onChange={e => setOpenrouterKey(e.target.value)} placeholder="sk-or-…" style={s.input} />
            {openrouterKey && <p style={s.keySet}>✓ Key saved</p>}
          </Field>
        </section>

        <section style={s.section}>
          <h2 style={s.sectionTitle}>Enrichment Keys</h2>

          <Field label="Hunter.io API Key" hint="Email enrichment. Free at hunter.io">
            <input type="password" value={hunterKey} onChange={e => setHunterKey(e.target.value)} placeholder="Hunter API key…" style={s.input} />
            {hunterKey && <p style={s.keySet}>✓ Key saved</p>}
          </Field>

          <Field label="Apollo.io API Key" hint="Email and phone enrichment. Note: free plan has limited API access.">
            <input type="password" value={apolloKey} onChange={e => setApolloKey(e.target.value)} placeholder="Apollo API key…" style={s.input} />
            {apolloKey && <p style={s.keySet}>✓ Key saved</p>}
          </Field>
        </section>

        <button onClick={handleSave} style={{ ...s.saveBtn, background: saved ? '#4a7c59' : 'var(--text)' }}>
          {saved ? '✓ Saved successfully' : 'Save settings →'}
        </button>

        <div style={s.infoBox}>
          <p style={{ fontSize: '12px', fontWeight: '600', marginBottom: '12px', color: 'var(--text)' }}>How AI keys are used</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Gemini', color: 'green', text: 'Website analysis, login detection, compliance, product classification, auto-fill. Free with generous quota.' },
              { label: 'OpenAI', color: 'blue',  text: 'Same as Gemini but paid. Used if Gemini key not set.' },
              { label: 'Groq',   color: 'amber', text: 'Compliance checking, quick classification without website. Always free.' },
            ].map(({ label, color, text }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={s.badge[color]}>{label}</span>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, badge, badgeColor, hint, children }) {
  const badgeStyle = badge ? s.badge[badgeColor] || s.badge.amber : null
  return (
    <div style={s.field}>
      <label style={s.label}>
        {label}
        {badge && <span style={badgeStyle}>{badge}</span>}
      </label>
      {hint && <p style={s.hint}>{hint}</p>}
      {children}
    </div>
  )
}

function ExtLink({ href, children }) {
  return <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', textDecorationColor: 'rgba(168,100,72,0.3)' }}>{children}</a>
}

const s = {
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' },
  title: { fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '400', letterSpacing: '-0.04em', marginBottom: '36px', color: 'var(--text)' },
  section: { marginBottom: '36px', paddingBottom: '36px', borderBottom: '1px solid var(--border)' },
  sectionTitle: { fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text)', marginBottom: '6px' },
  sectionHint: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 },
  field: { marginBottom: '18px' },
  label: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '500', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' },
  hint: { fontSize: '11px', color: 'var(--text-muted)', marginBottom: '7px', lineHeight: 1.6 },
  input: { width: '100%', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s' },
  keySet: { fontSize: '11px', color: '#4a7c59', marginTop: '5px', fontWeight: '500' },
  saveBtn: { width: '100%', padding: '12px', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '500', color: 'var(--bg)', cursor: 'pointer', fontFamily: 'var(--font-mono)', marginBottom: '24px', transition: 'background 0.2s' },
  infoBox: { padding: '18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' },
  badge: {
    green: { fontSize: '9px', fontWeight: '600', background: 'rgba(74,124,89,0.10)', color: '#4a7c59', padding: '2px 7px', borderRadius: '3px', border: '1px solid rgba(74,124,89,0.22)', whiteSpace: 'nowrap' },
    blue:  { fontSize: '9px', fontWeight: '600', background: 'rgba(91,141,184,0.10)', color: '#5b8db8', padding: '2px 7px', borderRadius: '3px', border: '1px solid rgba(91,141,184,0.22)', whiteSpace: 'nowrap' },
    amber: { fontSize: '9px', fontWeight: '600', background: 'rgba(168,100,72,0.10)', color: '#a86448', padding: '2px 7px', borderRadius: '3px', border: '1px solid rgba(168,100,72,0.22)', whiteSpace: 'nowrap' },
  },
}
