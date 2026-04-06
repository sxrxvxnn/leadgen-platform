import React, { useState } from 'react'

export default function Settings() {
  const [fullName, setFullName] = useState(localStorage.getItem('fullName') || '')
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('geminiKey') || '')
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('openaiKey') || '')
  const [groqKey, setGroqKey] = useState(localStorage.getItem('groqKey') || '')
  const [hunterKey, setHunterKey] = useState(localStorage.getItem('hunterKey') || '')
  const [apolloKey, setApolloKey] = useState(localStorage.getItem('apolloKey') || '')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    localStorage.setItem('fullName', fullName)
    localStorage.setItem('geminiKey', geminiKey)
    localStorage.setItem('openaiKey', openaiKey)
    localStorage.setItem('groqKey', groqKey)
    localStorage.setItem('hunterKey', hunterKey)
    localStorage.setItem('apolloKey', apolloKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px' }}>
      <p style={s.eyebrow}>CONFIGURATION</p>
      <h1 style={s.title}>Settings</h1>

      {/* Profile */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Profile</h2>
        <div style={s.field}>
          <label style={s.label}>YOUR NAME</label>
          <p style={s.hint}>Used as account manager in spreadsheet view</p>
          <input
            type="text" value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Your full name" style={s.input}
          />
        </div>
      </section>

      {/* AI Keys */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>AI Keys</h2>
        <p style={{ fontSize: '12px', color: 'var(--gray-4)', marginBottom: '20px', lineHeight: 1.6 }}>
          Priority order: Gemini → OpenAI → Groq. Add at least one key to enable AI features.
        </p>

        <div style={s.field}>
          <label style={s.label}>
            GOOGLE GEMINI API KEY
            <span style={s.badgeGreen}>Free · Best choice</span>
          </label>
          <p style={s.hint}>
            Most accurate free AI. Used for website analysis, auto-fill, product classification.
            Get free key at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: '#00d4ff' }}>aistudio.google.com</a>
          </p>
          <input
            type="password" value={geminiKey}
            onChange={e => setGeminiKey(e.target.value)}
            placeholder="AIza..." style={s.input}
          />
          {geminiKey && <p style={s.keySet}>✓ Key saved</p>}
        </div>

        <div style={s.field}>
          <label style={s.label}>
            OPENAI API KEY
            <span style={s.badgeBlue}>GPT-4o · Paid</span>
          </label>
          <p style={s.hint}>
            Most accurate but requires billing. Fallback if Gemini unavailable.
            Get from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: '#00d4ff' }}>platform.openai.com</a>
          </p>
          <input
            type="password" value={openaiKey}
            onChange={e => setOpenaiKey(e.target.value)}
            placeholder="sk-..." style={s.input}
          />
          {openaiKey && <p style={s.keySet}>✓ Key saved</p>}
        </div>

        <div style={s.field}>
          <label style={s.label}>
            GROQ API KEY
            <span style={s.badgeAmber}>Llama 70B · Free · Fast</span>
          </label>
          <p style={s.hint}>
            Fast and free. Used for compliance checking and as final fallback.
            Get free key at <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: '#00d4ff' }}>console.groq.com</a>
          </p>
          <input
            type="password" value={groqKey}
            onChange={e => setGroqKey(e.target.value)}
            placeholder="gsk_..." style={s.input}
          />
          {groqKey && <p style={s.keySet}>✓ Key saved</p>}
        </div>
      </section>

      {/* Enrichment Keys */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Enrichment Keys</h2>

        <div style={s.field}>
          <label style={s.label}>HUNTER.IO API KEY</label>
          <p style={s.hint}>Email enrichment. Works best when company website is known. Free at hunter.io</p>
          <input
            type="password" value={hunterKey}
            onChange={e => setHunterKey(e.target.value)}
            placeholder="Hunter API key..." style={s.input}
          />
          {hunterKey && <p style={s.keySet}>✓ Key saved</p>}
        </div>

        <div style={s.field}>
          <label style={s.label}>APOLLO.IO API KEY</label>
          <p style={s.hint}>Email and phone enrichment. Note: free plan has limited API access.</p>
          <input
            type="password" value={apolloKey}
            onChange={e => setApolloKey(e.target.value)}
            placeholder="Apollo API key..." style={s.input}
          />
          {apolloKey && <p style={s.keySet}>✓ Key saved</p>}
        </div>
      </section>

      <button onClick={handleSave} style={s.saveBtn}>
        {saved ? '✓ Saved successfully' : 'Save settings →'}
      </button>

      {/* Info box */}
      <div style={s.infoBox}>
        <p style={{ fontSize: '12px', fontWeight: '700', marginBottom: '12px', color: 'var(--white)' }}>
          How AI keys are used
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={s.infoRow}>
            <span style={s.badgeGreen}>Gemini</span>
            <p style={s.infoText}>Website analysis, login detection, compliance, product/service classification, auto-fill enrichment. Free with generous quota.</p>
          </div>
          <div style={s.infoRow}>
            <span style={s.badgeBlue}>OpenAI</span>
            <p style={s.infoText}>Same as Gemini but paid. Used if Gemini key not set.</p>
          </div>
          <div style={s.infoRow}>
            <span style={s.badgeAmber}>Groq</span>
            <p style={s.infoText}>Compliance checking on company cards, quick classification without website. Always free.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  eyebrow: { fontSize: '10px', fontWeight: '700', letterSpacing: '3px', color: 'var(--gray-4)', marginBottom: '8px' },
  title: { fontSize: '32px', fontWeight: '900', letterSpacing: '-1px', marginBottom: '40px', color: 'var(--white)' },
  section: { marginBottom: '40px', paddingBottom: '40px', borderBottom: '1px solid var(--gray-2)' },
  sectionTitle: { fontSize: '14px', fontWeight: '700', color: 'var(--white)', marginBottom: '16px', letterSpacing: '0.5px' },
  field: { marginBottom: '20px' },
  label: { fontSize: '10px', fontWeight: '700', letterSpacing: '2px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' },
  hint: { fontSize: '11px', color: 'var(--gray-3)', marginBottom: '8px', lineHeight: 1.6 },
  input: { width: '100%', padding: '12px 16px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '6px', fontSize: '13px', color: 'var(--white)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  keySet: { fontSize: '11px', color: 'var(--green)', marginTop: '6px', fontWeight: '600' },
  saveBtn: { width: '100%', padding: '14px', background: 'var(--white)', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '700', color: 'var(--black)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '24px' },
  badgeGreen: { fontSize: '9px', fontWeight: '700', letterSpacing: '1px', background: 'rgba(0,230,118,0.12)', color: 'var(--green)', padding: '2px 8px', borderRadius: '3px', border: '1px solid rgba(0,230,118,0.3)', whiteSpace: 'nowrap' },
  badgeBlue: { fontSize: '9px', fontWeight: '700', letterSpacing: '1px', background: 'rgba(0,212,255,0.12)', color: '#00d4ff', padding: '2px 8px', borderRadius: '3px', border: '1px solid rgba(0,212,255,0.3)', whiteSpace: 'nowrap' },
  badgeAmber: { fontSize: '9px', fontWeight: '700', letterSpacing: '1px', background: 'rgba(255,171,0,0.12)', color: 'var(--amber)', padding: '2px 8px', borderRadius: '3px', border: '1px solid rgba(255,171,0,0.3)', whiteSpace: 'nowrap' },
  infoBox: { padding: '20px', background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '8px' },
  infoRow: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  infoText: { fontSize: '12px', color: 'var(--gray-4)', lineHeight: 1.6, flex: 1 },
}