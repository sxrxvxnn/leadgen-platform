import React, { useState, useRef, useCallback } from 'react'
import { motion } from 'motion/react'

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
  const [agreedTerms, setAgreedTerms] = useState(localStorage.getItem('agreedTerms') === '1')
  const [wantsUpdates, setWantsUpdates] = useState(localStorage.getItem('wantsUpdates') !== '0')

  const sectionRefs = {
    profile:  useRef(null),
    linkedin: useRef(null),
    privacy:  useRef(null),
    terms:    useRef(null),
  }

  function handleSave() {
    localStorage.setItem('fullName', fullName)
    localStorage.setItem('liCookie', liCookie)
    localStorage.setItem('agreedTerms', agreedTerms ? '1' : '0')
    localStorage.setItem('wantsUpdates', wantsUpdates ? '1' : '0')
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
      {/* Hero */}
      <motion.div style={{ position: 'relative', padding: '64px 48px 48px', borderBottom: '1px solid var(--border)', overflow: 'hidden' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
        <div style={{ position: 'relative' }}>
          <p style={s.eyebrow}>Configuration</p>
          <h1 style={s.heroTitle}>Settings.</h1>
          <p style={s.heroSub}>Profile and enrichment configuration.</p>
        </div>
      </motion.div>

      {/* Two-column layout */}
      <motion.div style={{ display: 'flex', maxWidth: '1100px', margin: '0 auto', padding: '0 48px 80px' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }}>

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
                  borderRadius: 0,
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
          <section ref={sectionRefs.linkedin} style={{ ...s.section, borderBottom: '1px solid var(--border)' }}>
            <SectionHeader num="02" title="LinkedIn" />
            <p style={s.sectionHint}>
              LinkedIn now blocks unauthenticated access to company pages. Providing your session cookie lets the scraper fetch phone, founded year, specialties, company size, and tagline directly from LinkedIn About pages.
            </p>

            <Field label="LinkedIn Session Cookie" badge="li_at" badgeColor="blue"
              hint={
                <span>
                  1. Open LinkedIn in your browser while logged in.<br />
                  2. DevTools → Application → Cookies → www.linkedin.com → find <code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', background: 'var(--surface)', padding: '1px 4px', borderRadius: 0 }}>li_at</code> → copy its Value.<br />
                  3. Paste below and Save. The cookie is only sent to your own backend.
                </span>
              }>
              <KeyInput value={liCookie} onChange={setLiCookie} placeholder="AQEDAx…" set={!!liCookie} />
            </Field>

            <div style={{ marginTop: '16px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>What this unlocks</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 0, overflow: 'hidden' }}>
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
          <section ref={sectionRefs.privacy} style={{ ...s.section }}>
            <SectionHeader num="03" title="Privacy Policy" />
            <p style={s.sectionHint}>How Sonar collects, uses, and protects your data. Effective June 16, 2026.</p>

            <div style={{ height: '280px', overflowY: 'scroll', border: '1px solid var(--border)', padding: '20px 22px', background: 'var(--surface)', marginBottom: '20px', lineHeight: 1.8 }}>
              <p style={s.legalHeading}>PRIVACY POLICY</p>
              <p style={s.legalMeta}>Date of last revision: June 16, 2026</p>

              <p style={s.legalBody}>This Privacy Policy describes how Sonar ("Company," "we," "us," or "our") collects, uses, and shares information about you when you use our B2B lead intelligence platform and Chrome extension (collectively, the "Services").</p>

              <p style={s.legalSubhead}>1. Data Collected</p>
              <p style={s.legalBody}>We collect your name and email for authentication, B2B company and contact data you add or import, anonymised usage analytics via PostHog, and LinkedIn company profile data where you authorise API access. We do not collect sensitive personal data such as health, financial, or government-issued identification information.</p>

              <p style={s.legalSubhead}>2. How We Use It</p>
              <p style={s.legalBody}>Your data is used solely to operate the platform: authenticate your account, enrich company records via third-party APIs (Hunter, Apollo, Google Maps), sync LinkedIn leads into your pipeline, and improve the product via anonymised analytics. We do not sell or share your personal data with third parties for advertising purposes.</p>

              <p style={s.legalSubhead}>3. Storage & Security</p>
              <p style={s.legalBody}>All data is stored in Supabase (PostgreSQL) hosted on AWS with Row Level Security enforced — you can only access your own records. All communication is encrypted over HTTPS/TLS. Data is retained while your account is active and deleted on request within 30 days.</p>

              <p style={s.legalSubhead}>4. LinkedIn API Data</p>
              <p style={s.legalBody}>LinkedIn data is only accessed with your explicit authorisation via your session cookie. Lead data is used solely to populate your pipeline and is never redistributed. You can revoke LinkedIn access at any time by removing your cookie from Settings.</p>

              <p style={s.legalSubhead}>5. Third-Party Services</p>
              <p style={s.legalBody}>Supabase (database), Google Maps (location enrichment), PostHog (analytics), Vercel (hosting), Hunter.io and Apollo.io (email enrichment). Each service is governed by its own privacy policy.</p>

              <p style={s.legalSubhead}>6. Your Rights (DPDP Act 2023)</p>
              <p style={s.legalBody}>You have the right to access, correct, export, or delete your personal data at any time. To exercise these rights or for any privacy concerns, contact sonarleads@proton.me. We will respond within 30 days.</p>

              <p style={s.legalSubhead}>7. Cookies</p>
              <p style={s.legalBody}>We use session storage and local storage to maintain your authentication state and preferences. No third-party advertising cookies are set.</p>
            </div>

            <ToggleRow
              label={<>I have read and agree to Sonar's <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Privacy Policy</a>.</>}
              checked={agreedTerms}
              onChange={() => setAgreedTerms(v => !v)}
            />
          </section>

          {/* 04 — Terms */}
          <section ref={sectionRefs.terms} style={{ ...s.section, borderBottom: 'none', paddingBottom: 0 }}>
            <SectionHeader num="04" title="Terms of Service" />
            <p style={s.sectionHint}>The rules governing your use of Sonar. Effective June 16, 2026.</p>

            <div style={{ height: '280px', overflowY: 'scroll', border: '1px solid var(--border)', padding: '20px 22px', background: 'var(--surface)', marginBottom: '20px', lineHeight: 1.8 }}>
              <p style={s.legalHeading}>TERMS OF USE / SERVICE AGREEMENT</p>
              <p style={s.legalMeta}>Date of last revision: June 16, 2026</p>

              <p style={s.legalBody}>This Terms of Use or Service Agreement ("Agreement") is between Shravan Omanakuttan, operating Sonar ("Company," "we," "us," or "our") and the person or entity ("you" or "your") that has decided to use our services; any of our websites or apps; or any features, products, text, images, data, computer code, and all other forms of data and communications (collectively, "Services").</p>

              <p style={s.legalBody}>YOU MUST CONSENT TO THIS AGREEMENT TO USE OUR SERVICES. If you do not accept and agree to be bound by all of the terms of this Agreement, you cannot use Services.</p>

              <p style={s.legalBody}>If we update this Agreement, we will provide you notice and an opportunity to review and decide whether you would like to continue to use the Services.</p>

              <p style={s.legalSubhead}>1. Description of the Services</p>
              <p style={s.legalBody}>Sonar is a B2B lead intelligence platform that provides tools to discover, enrich, and manage company and contact records for sales and marketing purposes.</p>

              <p style={s.legalSubhead}>2. Acceptable Use</p>
              <p style={s.legalBody}>Use the platform only for lawful B2B sales and marketing purposes. You must not scrape third-party platforms in violation of their terms, send unsolicited bulk communications, resell platform access, or use the platform to store sensitive personal data such as health or financial information.</p>

              <p style={s.legalSubhead}>3. Your Data</p>
              <p style={s.legalBody}>You own all company, contact, and lead data you create in the platform. You grant us a limited licence to store and process it solely to provide the Service. You are responsible for ensuring you have the right to upload any data you add.</p>

              <p style={s.legalSubhead}>4. LinkedIn API</p>
              <p style={s.legalBody}>By connecting LinkedIn, you authorise Sonar to access LinkedIn data on your behalf within the approved scope. LinkedIn data may only be used for your own sales activities and is subject to LinkedIn's own terms in addition to ours.</p>

              <p style={s.legalSubhead}>5. Disclaimers</p>
              <p style={s.legalBody}>The platform is provided "as is" without warranties of any kind. We do not guarantee that enrichment data from third-party APIs will be accurate, complete, or current. The platform may be unavailable during maintenance windows.</p>

              <p style={s.legalSubhead}>6. Limitation of Liability</p>
              <p style={s.legalBody}>Our total liability for any claims is limited to the amount you paid us in the prior 12 months or ₹5,000, whichever is greater. We are not liable for indirect, incidental, or consequential damages including loss of business or data.</p>
            </div>

            <ToggleRow
              label={<>I agree to Sonar's <a href="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Privacy Policy</a>.</>}
              checked={agreedTerms}
              onChange={() => setAgreedTerms(v => !v)}
            />
            <div style={{ marginTop: '10px' }}>
              <ToggleRow
                label="I want to receive product updates and launch emails. You can unsubscribe at any time."
                checked={wantsUpdates}
                onChange={() => setWantsUpdates(v => !v)}
              />
            </div>
          </section>

          {/* Save */}
          <div style={{ paddingTop: '32px', borderTop: '1px solid var(--border)' }}>
            <button onClick={handleSave} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '14px 20px',
              background: saved ? '#4a7c59' : 'var(--accent)', border: 'none', borderRadius: 0,
              fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600',
              color: '#FFFFFF', cursor: 'pointer', transition: 'background 0.2s',
              letterSpacing: '0.04em',
            }}>
              <span>{saved ? '✓ Saved successfully' : 'Save settings'}</span>
              {!saved && <span style={{ opacity: 0.5 }}>→</span>}
            </button>
          </div>

        </main>
      </motion.div>
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

function ToggleRow({ label, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '14px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>{label}</span>
      <button
        onClick={onChange}
        style={{
          position: 'relative', flexShrink: 0,
          width: '44px', height: '24px',
          background: checked ? 'var(--accent)' : 'var(--surface)',
          border: checked ? '1px solid var(--accent)' : '1px solid var(--border)',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'background 0.2s, border-color 0.2s',
          padding: 0,
        }}
        aria-pressed={checked}
      >
        <span style={{
          position: 'absolute',
          top: '3px',
          left: checked ? '22px' : '3px',
          width: '16px', height: '16px',
          borderRadius: '50%',
          background: checked ? '#FFFFFF' : '#9CA3AF',
          transition: 'left 0.2s',
          display: 'block',
        }} />
      </button>
    </div>
  )
}

const badge = {
  green: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', background: 'var(--accent-dim)', color: 'var(--accent)', padding: '2px 7px', borderRadius: 0, border: '1px solid var(--accent-light)', letterSpacing: '0.06em', whiteSpace: 'nowrap' },
  blue:  { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', background: 'var(--blue-dim)', color: 'var(--blue)', padding: '2px 7px', borderRadius: 0, border: '1px solid rgba(0,130,243,0.3)', letterSpacing: '0.06em', whiteSpace: 'nowrap' },
  amber: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', background: 'var(--amber-dim)', color: 'var(--amber)', padding: '2px 7px', borderRadius: 0, border: '1px solid rgba(245,158,11,0.3)', letterSpacing: '0.06em', whiteSpace: 'nowrap' },
}

const s = {
  eyebrow:      { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' },
  heroTitle:    { fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 6vw, 80px)', fontWeight: '900', letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1, marginBottom: '10px' },
  heroSub:      { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.02em' },
  section:      { paddingBottom: '48px', marginBottom: '48px', borderBottom: '1px solid var(--border)' },
  sectionHint:  { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.7 },
  input:        { width: '100%', padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 0, fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s' },
  legalHeading: { fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', color: 'var(--text)', textTransform: 'uppercase', marginBottom: '4px' },
  legalMeta:    { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '18px', letterSpacing: '0.02em' },
  legalSubhead: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text)', textTransform: 'uppercase', marginTop: '18px', marginBottom: '6px' },
  legalBody:    { fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '0px' },
}
