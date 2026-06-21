import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'motion/react'
import { useLocation } from 'react-router-dom'
import {
  getLinkedInStatus, getLinkedInAuthUrl, disconnectLinkedIn,
  getLinkedInAdAccounts, selectLinkedInAccount, linkedInSyncNow,
} from '../services/api'

const SECTIONS = [
  { id: 'profile',      num: '01', label: 'Profile' },
  { id: 'linkedin',     num: '02', label: 'LinkedIn' },
  { id: 'lead-sync',    num: '03', label: 'Lead Sync' },
  { id: 'privacy',      num: '04', label: 'Privacy' },
  { id: 'terms',        num: '05', label: 'Terms' },
]

export default function Settings() {
  const [fullName, setFullName] = useState(localStorage.getItem('fullName') || '')
  const [liCookie, setLiCookie] = useState(localStorage.getItem('liCookie') || '')
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')
  const [agreedTerms, setAgreedTerms] = useState(localStorage.getItem('agreedTerms') === '1')
  const [wantsUpdates, setWantsUpdates] = useState(localStorage.getItem('wantsUpdates') !== '0')

  // LinkedIn Lead Sync state
  const [liStatus, setLiStatus]         = useState(null)
  const [liAccounts, setLiAccounts]     = useState([])
  const [liConnecting, setLiConnecting] = useState(false)
  const [liSyncing, setLiSyncing]       = useState(false)
  const [liSyncResult, setLiSyncResult] = useState(null)
  const [liError, setLiError]           = useState(null)

  const location = useLocation()

  const sectionRefs = {
    profile:     useRef(null),
    linkedin:    useRef(null),
    'lead-sync': useRef(null),
    privacy:     useRef(null),
    terms:       useRef(null),
  }

  // On mount: load LinkedIn status + handle OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('li_connected') === '1') {
      window.history.replaceState({}, '', '/settings')
      setLiError(null)
      setLiSyncResult(null)
    }
    if (params.get('li_error')) {
      setLiError(`LinkedIn connect failed: ${params.get('li_error')}`)
      window.history.replaceState({}, '', '/settings')
    }
    getLinkedInStatus()
      .then(r => setLiStatus(r.data))
      .catch(() => setLiStatus({ connected: false }))
  }, [])

  async function handleLinkedInConnect() {
    setLiConnecting(true)
    setLiError(null)
    try {
      const r = await getLinkedInAuthUrl()
      window.location.href = r.data.auth_url
    } catch {
      setLiError('Failed to start LinkedIn OAuth. Make sure LINKEDIN_CLIENT_SECRET is set on the server.')
      setLiConnecting(false)
    }
  }

  async function handleLinkedInDisconnect() {
    await disconnectLinkedIn().catch(() => {})
    setLiStatus({ connected: false })
    setLiAccounts([])
    setLiSyncResult(null)
  }

  async function handleLoadAccounts() {
    setLiError(null)
    try {
      const r = await getLinkedInAdAccounts()
      setLiAccounts(r.data.accounts || [])
    } catch (e) {
      setLiError(e?.response?.data?.detail || 'Failed to load ad accounts')
    }
  }

  async function handleSelectAccount(urn) {
    await selectLinkedInAccount(urn).catch(() => {})
    setLiStatus(prev => ({ ...prev, selected_account_urn: urn }))
  }

  async function handleSyncNow() {
    setLiSyncing(true)
    setLiSyncResult(null)
    setLiError(null)
    try {
      const r = await linkedInSyncNow()
      setLiSyncResult(r.data)
      setLiStatus(prev => ({ ...prev, last_synced_at: new Date().toISOString() }))
    } catch (e) {
      setLiError(e?.response?.data?.detail || 'Sync failed')
    } finally {
      setLiSyncing(false)
    }
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

          {/* 03 — LinkedIn Lead Sync */}
          <section ref={sectionRefs['lead-sync']} style={{ ...s.section, borderBottom: '1px solid var(--border)' }}>
            <SectionHeader num="03" title="Lead Sync" />
            <p style={s.sectionHint}>
              Connect your LinkedIn ad account to automatically pull leads from Lead Gen Forms directly into your pipeline. Requires LinkedIn Lead Sync API access (Standard Tier).
            </p>

            {liError && (
              <div style={{ background: 'rgba(231,0,11,0.08)', border: '1px solid rgba(231,0,11,0.25)', borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#E7000B', margin: 0 }}>{liError}</p>
              </div>
            )}

            {liStatus === null ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Loading...</p>
            ) : !liStatus.connected ? (
              <div>
                <button
                  onClick={handleLinkedInConnect}
                  disabled={liConnecting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 20px', border: '1px solid var(--border)', borderRadius: 4,
                    background: 'var(--surface)', color: 'var(--text)', cursor: liConnecting ? 'wait' : 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  {liConnecting ? 'Redirecting to LinkedIn...' : 'Connect LinkedIn'}
                </button>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 10 }}>
                  You will be redirected to LinkedIn to authorise access to your Lead Gen Forms.
                </p>
              </div>
            ) : (
              <div>
                {/* Connected status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, marginBottom: 20 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4a7c59', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                      LinkedIn Connected
                    </p>
                    {liStatus.last_synced_at && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        Last synced: {new Date(liStatus.last_synced_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleLinkedInDisconnect}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}
                  >
                    Disconnect
                  </button>
                </div>

                {/* Ad account selection */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Ad Account
                  </p>
                  {liStatus.selected_account_urn ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, background: 'rgba(74,124,89,0.12)', color: '#4a7c59', padding: '2px 8px', borderRadius: 3, border: '1px solid rgba(74,124,89,0.3)', letterSpacing: '0.06em' }}>Connected</span>
                      <button
                        onClick={handleLoadAccounts}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleLoadAccounts}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '8px 14px', cursor: 'pointer' }}
                    >
                      Load my ad accounts
                    </button>
                  )}

                  {liAccounts.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {liAccounts.map(acc => (
                        <button
                          key={acc.urn}
                          onClick={() => handleSelectAccount(acc.urn)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', border: `1px solid ${liStatus.selected_account_urn === acc.urn ? 'var(--accent)' : 'var(--border)'}`,
                            borderRadius: 4, background: liStatus.selected_account_urn === acc.urn ? 'rgba(231,0,11,0.05)' : 'var(--surface)',
                            cursor: 'pointer', textAlign: 'left',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text)' }}>{acc.name}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{acc.status}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sync */}
                {liStatus.selected_account_urn && (
                  <div>
                    <button
                      onClick={handleSyncNow}
                      disabled={liSyncing}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 18px', background: liSyncing ? 'var(--surface)' : 'var(--accent)',
                        border: 'none', borderRadius: 4, color: '#fff',
                        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                        cursor: liSyncing ? 'wait' : 'pointer',
                      }}
                    >
                      {liSyncing ? 'Syncing...' : 'Sync leads now'}
                    </button>
                    {liSyncResult && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a7c59', marginTop: 8 }}>
                        Synced {liSyncResult.synced} new lead{liSyncResult.synced !== 1 ? 's' : ''} from {liSyncResult.forms_checked} form{liSyncResult.forms_checked !== 1 ? 's' : ''}.
                      </p>
                    )}
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 6 }}>
                      Pulls all unsynced leads from your Lead Gen Forms. Duplicates are skipped by email.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 04 — Privacy */}
          <section ref={sectionRefs.privacy} style={{ ...s.section }}>
            <SectionHeader num="04" title="Privacy Policy" />
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
            <SectionHeader num="05" title="Terms of Service" />
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
