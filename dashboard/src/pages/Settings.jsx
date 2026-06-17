import React, { useState, useRef } from 'react'
import Navbar from '../components/Navbar'

const SECTIONS = [
  { id: 'profile',  num: '01', label: 'Profile' },
  { id: 'linkedin', num: '02', label: 'LinkedIn' },
  { id: 'privacy',  num: '03', label: 'Privacy' },
  { id: 'terms',    num: '04', label: 'Terms' },
]

export default function Settings() {
  const [fullName, setFullName] = useState(localStorage.getItem('fullName') || '')
  const [liCookie, setLiCookie] = useState(localStorage.getItem('liCookie') || '')
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')

  const sectionRefs = {
    profile:  useRef(null),
    linkedin: useRef(null),
    privacy:  useRef(null),
    terms:    useRef(null),
  }

  function handleSave() {
    localStorage.setItem('fullName', fullName)
    localStorage.setItem('liCookie', liCookie)
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
          <p style={s.heroSub}>Profile and enrichment configuration.</p>
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
                  padding: '8px 10px', border: 'none',
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

          {/* 02 — LinkedIn */}
          <section ref={sectionRefs.linkedin} style={{ ...s.section, borderBottom: '1px dashed var(--border-dash)' }}>
            <SectionHeader num="02" title="LinkedIn" />
            <p style={s.sectionHint}>
              LinkedIn now blocks unauthenticated access to company pages. Providing your session cookie lets the scraper fetch phone, founded year, specialties, company size, and tagline directly from LinkedIn About pages.
            </p>

            <Field label="LinkedIn Session Cookie" badge="li_at" badgeColor="blue"
              hint={
                <span>
                  1. Open LinkedIn in your browser while logged in.<br />
                  2. DevTools → Application → Cookies → www.linkedin.com → find <code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', background: 'var(--surface)', padding: '1px 4px', borderRadius: '3px' }}>li_at</code> → copy its Value.<br />
                  3. Paste below and Save. The cookie is only sent to your own backend.
                </span>
              }>
              <KeyInput value={liCookie} onChange={setLiCookie} placeholder="AQEDAx…" set={!!liCookie} />
            </Field>

            <div style={{ marginTop: '16px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>What this unlocks</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#c4c1bd', border: '1px solid #c4c1bd', borderRadius: '6px', overflow: 'hidden' }}>
                {[
                  { label: 'Phone',        text: 'Business phone number listed on LinkedIn About.' },
                  { label: 'Founded',      text: 'Company founding year.' },
                  { label: 'Specialties',  text: 'LinkedIn-listed expertise areas.' },
                  { label: 'Company size', text: 'Exact employee band (e.g. 2-10, 51-200).' },
                ].map(({ label, text }) => (
                  <div key={label} style={{ background: 'var(--bg)', padding: '14px 16px' }}>
                    <span style={badge.blue}>{label}</span>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '8px' }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 03 — Privacy */}
          <section ref={sectionRefs.privacy} style={{ ...s.section, borderBottom: 'none', paddingBottom: 0 }}>
            <SectionHeader num="03" title="Privacy" />
            <p style={s.sectionHint}>
              How LeadGen Engine collects, uses, and protects your data. Effective June 16, 2026.
            </p>

            {[
              {
                title: 'Data Collected',
                body: "We collect your name and email for authentication, B2B company/contact data you add or import, anonymised usage analytics via PostHog, and LinkedIn company profile data where you authorise API access.",
              },
              {
                title: 'How We Use It',
                body: 'Your data is used solely to operate the platform: authenticate your account, enrich company records via third-party APIs, sync LinkedIn leads into your pipeline, and improve the product via anonymised analytics. We do not sell or share your data with third parties for advertising.',
              },
              {
                title: 'Storage & Security',
                body: 'All data is stored in Supabase (PostgreSQL) with Row Level Security enforced — you can only access your own records. All communication is encrypted over HTTPS. Data is retained while your account is active and deleted on request.',
              },
              {
                title: 'LinkedIn API Data',
                body: 'LinkedIn data is only accessed with your explicit authorisation. Lead Gen Form data is used solely to populate your pipeline and is never redistributed. You can revoke LinkedIn access at any time via your LinkedIn account settings.',
              },
              {
                title: 'Third-Party Services',
                body: 'Supabase (database), Google Maps (location enrichment), PostHog (analytics), Vercel (hosting). Each service is governed by its own privacy policy.',
              },
              {
                title: 'Your Rights (DPDP Act 2023)',
                body: 'You have the right to access, correct, export, or delete your personal data at any time. To exercise these rights or for any privacy concerns, contact leadgenengineplatform@proton.me. We will respond within 30 days.',
              },
            ].map(({ title, body }) => (
              <div key={title} style={{ marginBottom: '1px', padding: '16px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '8px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text)', textTransform: 'uppercase', marginBottom: '6px' }}>{title}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{body}</p>
              </div>
            ))}

            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '16px', lineHeight: 1.6 }}>
              Full policy available at{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                leadgenengineplatform.vercel.app/privacy
              </a>
            </p>
          </section>

          {/* 04 — Terms */}
          <section ref={sectionRefs.terms} style={{ ...s.section, borderBottom: 'none', paddingBottom: 0 }}>
            <SectionHeader num="04" title="Terms" />
            <p style={s.sectionHint}>
              The rules governing your use of LeadGen Engine. Effective June 16, 2026.
            </p>

            {[
              {
                title: 'Acceptance',
                body: 'By using LeadGen Engine you agree to these Terms. If you do not agree, do not use the platform. These Terms form a binding agreement between you and Shravan Omanakuttan, operator of LeadGen Engine.',
              },
              {
                title: 'Acceptable Use',
                body: 'Use the platform only for lawful B2B sales and marketing purposes. You must not scrape third-party platforms in violation of their terms, send unsolicited bulk communications, resell platform access, or use the platform to store sensitive personal data such as health or financial information.',
              },
              {
                title: 'Your Data',
                body: 'You own all company, contact, and lead data you create in the platform. You grant us a limited licence to store and process it solely to provide the Service. You are responsible for ensuring you have the right to upload any data you add.',
              },
              {
                title: 'LinkedIn API',
                body: "By connecting LinkedIn, you authorise LeadGen Engine to access LinkedIn data on your behalf within the approved scope. LinkedIn data may only be used for your own sales activities and is subject to LinkedIn's own terms in addition to ours.",
              },
              {
                title: 'Disclaimers',
                body: 'The platform is provided "as is" without warranties of any kind. We do not guarantee that enrichment data from third-party APIs will be accurate, complete, or current. The platform may be unavailable during maintenance windows.',
              },
              {
                title: 'Liability',
                body: 'Our total liability for any claims is limited to the amount you paid us in the prior 12 months or ₹5,000, whichever is greater. We are not liable for indirect, incidental, or consequential damages including loss of business or data.',
              },
            ].map(({ title, body }) => (
              <div key={title} style={{ marginBottom: '1px', padding: '16px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '8px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text)', textTransform: 'uppercase', marginBottom: '6px' }}>{title}</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{body}</p>
              </div>
            ))}

            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '16px', lineHeight: 1.6 }}>
              Full terms at{' '}
              <a href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                leadgenengineplatform.vercel.app/terms
              </a>
              {' '}·{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                Privacy Policy
              </a>
            </p>
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
  eyebrow:     { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' },
  heroTitle:   { fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 6vw, 80px)', fontWeight: '400', letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1, marginBottom: '10px' },
  heroSub:     { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.02em' },
  section:     { paddingBottom: '48px', marginBottom: '48px', borderBottom: '1px dashed var(--border-dash)' },
  sectionHint: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.7 },
  input:       { width: '100%', padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s' },
}
