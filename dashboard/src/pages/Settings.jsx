import React, { useState, useRef } from 'react'
import Navbar from '../components/Navbar'

const SECTIONS = [
  { id: 'profile',    num: '01', label: 'Profile' },
  { id: 'ai-keys',   num: '02', label: 'AI Keys' },
  { id: 'enrichment',num: '03', label: 'Enrichment' },
]

export default function Settings() {
  const [fullName,      setFullName]      = useState(localStorage.getItem('fullName') || '')
  const [geminiKey,     setGeminiKey]     = useState(localStorage.getItem('geminiKey') || '')
  const [openaiKey,     setOpenaiKey]     = useState(localStorage.getItem('openaiKey') || '')
  const [groqKey,       setGroqKey]       = useState(localStorage.getItem('groqKey') || '')
  const [openrouterKey, setOpenrouterKey] = useState(localStorage.getItem('openrouterKey') || '')
  const [hunterKey,     setHunterKey]     = useState(localStorage.getItem('hunterKey') || '')
  const [apolloKey,     setApolloKey]     = useState(localStorage.getItem('apolloKey') || '')
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')

  const sectionRefs = {
    profile:    useRef(null),
    'ai-keys':  useRef(null),
    enrichment: useRef(null),
  }

  function handleSave() {
    localStorage.setItem('fullName',      fullName)
    localStorage.setItem('geminiKey',     geminiKey)
    localStorage.setItem('openaiKey',     openaiKey)
    localStorage.setItem('groqKey',       groqKey)
    localStorage.setItem('openrouterKey', openrouterKey)
    localStorage.setItem('hunterKey',     hunterKey)
    localStorage.setItem('apolloKey',     apolloKey)
    window.dispatchEvent(new Event('nameUpdated'))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function scrollTo(id) {
    sectionRefs[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(id)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Hero */}
      <div style={{ position: 'relative', padding: '64px 48px 48px', borderBottom: '1px dashed var(--border-dash)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 90% at 5% 50%, rgba(168,100,72,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <p style={s.eyebrow}>Configuration</p>
          <h1 style={s.heroTitle}>Settings.</h1>
          <p style={s.heroSub}>API keys, profile, and enrichment configuration.</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', maxWidth: '1100px', margin: '0 auto', padding: '0 48px 80px' }}>

        {/* Sticky sidebar */}
        <aside style={{ width: '200px', flexShrink: 0, paddingTop: '48px', paddingRight: '40px' }}>
          <div style={{ position: 'sticky', top: '86px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {SECTIONS.map(sec => (
              <button
                key={sec.id}
                onClick={() => scrollTo(sec.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', background: 'none', border: 'none',
                  cursor: 'pointer', borderRadius: '6px', textAlign: 'left',
                  transition: 'background 0.15s',
                  background: activeSection === sec.id ? 'var(--surface)' : 'transparent',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: activeSection === sec.id ? 'var(--accent)' : 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.06em', flexShrink: 0 }}>
                  {sec.num}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: activeSection === sec.id ? 'var(--text)' : 'var(--text-secondary)', fontWeight: activeSection === sec.id ? '500' : '400' }}>
                  {sec.label}
                </span>
                {activeSection === sec.id && (
                  <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--accent)', marginLeft: 'auto', flexShrink: 0 }} />
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Form content */}
        <main style={{ flex: 1, paddingTop: '48px', minWidth: 0 }}>

          {/* 01 — Profile */}
          <section ref={sectionRefs.profile} style={s.section}>
            <SectionHeader num="01" title="Profile" />
            <Field label="Your name" hint="Shown as account manager in the spreadsheet view">
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Your full name" style={s.input} />
            </Field>
          </section>

          {/* 02 — AI Keys */}
          <section ref={sectionRefs['ai-keys']} style={s.section}>
            <SectionHeader num="02" title="AI Keys" />
            <p style={s.sectionHint}>Priority: Gemini → OpenAI → Groq. Add at least one to enable AI features.</p>

            <Field label="Google Gemini" badge="Free · Best choice" badgeColor="green"
              hint={<>Most accurate. Get a free key at <ExtLink href="https://aistudio.google.com">aistudio.google.com</ExtLink></>}>
              <KeyInput value={geminiKey} onChange={setGeminiKey} placeholder="AIza…" set={!!geminiKey} />
            </Field>

            <Field label="OpenAI" badge="GPT-4o · Paid" badgeColor="blue"
              hint={<>Requires billing. Get from <ExtLink href="https://platform.openai.com/api-keys">platform.openai.com</ExtLink></>}>
              <KeyInput value={openaiKey} onChange={setOpenaiKey} placeholder="sk-…" set={!!openaiKey} />
            </Field>

            <Field label="Groq" badge="Llama · Free · Fast" badgeColor="amber"
              hint={<>Always free. Get key at <ExtLink href="https://console.groq.com">console.groq.com</ExtLink></>}>
              <KeyInput value={groqKey} onChange={setGroqKey} placeholder="gsk_…" set={!!groqKey} />
            </Field>

            <Field label="OpenRouter" badge="Qwen3 · Free tier" badgeColor="amber"
              hint="Used to extract LinkedIn URLs from company websites when regex fails.">
              <KeyInput value={openrouterKey} onChange={setOpenrouterKey} placeholder="sk-or-…" set={!!openrouterKey} />
            </Field>

            {/* How AI keys are used — gap-px grid */}
            <div style={{ marginTop: '24px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>How keys are used</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#c4c1bd', border: '1px solid #c4c1bd', borderRadius: '6px', overflow: 'hidden' }}>
                {[
                  { label: 'Gemini',  color: 'green', text: 'Website analysis, login detection, compliance, product classification, auto-fill.' },
                  { label: 'OpenAI',  color: 'blue',  text: 'Same as Gemini but paid. Used if Gemini key not set.' },
                  { label: 'Groq',    color: 'amber', text: 'Compliance checking, quick classification. Always free.' },
                ].map(({ label, color, text }) => (
                  <div key={label} style={{ background: 'var(--bg)', padding: '14px 16px' }}>
                    <span style={badge[color]}>{label}</span>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '8px' }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 03 — Enrichment */}
          <section ref={sectionRefs.enrichment} style={{ ...s.section, borderBottom: 'none', paddingBottom: 0 }}>
            <SectionHeader num="03" title="Enrichment" />
            <p style={s.sectionHint}>Used to find email addresses for leads.</p>

            <Field label="Hunter.io" hint="Email enrichment. Free at hunter.io">
              <KeyInput value={hunterKey} onChange={setHunterKey} placeholder="Hunter API key…" set={!!hunterKey} />
            </Field>

            <Field label="Apollo.io" hint="Email and phone enrichment. Note: free plan has limited API access.">
              <KeyInput value={apolloKey} onChange={setApolloKey} placeholder="Apollo API key…" set={!!apolloKey} />
            </Field>
          </section>

          {/* Save */}
          <div style={{ paddingTop: '32px', borderTop: '1px dashed var(--border-dash)' }}>
            <button onClick={handleSave} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '14px 20px',
              background: saved ? '#4a7c59' : '#1d1b1b', border: 'none', borderRadius: '8px',
              fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600',
              color: '#fdfdfd', cursor: 'pointer', transition: 'background 0.2s',
              letterSpacing: '0.04em',
            }}>
              <span>{saved ? '✓ Saved successfully' : 'Save settings'}</span>
              {!saved && <span style={{ opacity: 0.5 }}>→</span>}
            </button>
          </div>

        </main>
      </div>
    </div>
  )
}

function SectionHeader({ num, title }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '6px' }}>{num}</p>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1 }}>{title}</h2>
    </div>
  )
}

function Field({ label, badge: badgeName, badgeColor, hint, children }) {
  return (
    <div style={{ marginBottom: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '500', color: 'var(--text)', letterSpacing: '0.06em' }}>{label}</label>
        {badgeName && <span style={badge[badgeColor]}>{badgeName}</span>}
      </div>
      {hint && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '7px', lineHeight: 1.6 }}>{hint}</p>}
      {children}
    </div>
  )
}

function KeyInput({ value, onChange, placeholder, set }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="password" value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...s.input, paddingRight: set ? '48px' : '14px' }}
      />
      {set && (
        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', color: '#4a7c59', letterSpacing: '0.04em' }}>
          ✓ SET
        </span>
      )}
    </div>
  )
}

function ExtLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      style={{ color: 'var(--accent)', textDecoration: 'underline', textDecorationColor: 'rgba(168,100,72,0.35)' }}>
      {children}
    </a>
  )
}

const badge = {
  green: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', background: 'rgba(74,124,89,0.10)',  color: '#4a7c59', padding: '2px 7px', borderRadius: '3px', border: '1px solid rgba(74,124,89,0.22)',  letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  blue:  { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', background: 'rgba(91,141,184,0.10)', color: '#5b8db8', padding: '2px 7px', borderRadius: '3px', border: '1px solid rgba(91,141,184,0.22)', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  amber: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', background: 'rgba(168,100,72,0.10)', color: '#a86448', padding: '2px 7px', borderRadius: '3px', border: '1px solid rgba(168,100,72,0.22)', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
}

const s = {
  eyebrow:    { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' },
  heroTitle:  { fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 6vw, 80px)', fontWeight: '400', letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1, marginBottom: '10px' },
  heroSub:    { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.02em' },
  section:    { paddingBottom: '48px', marginBottom: '48px', borderBottom: '1px dashed var(--border-dash)' },
  sectionHint:{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.7 },
  input:      { width: '100%', padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s' },
}
