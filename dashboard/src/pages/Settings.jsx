import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'motion/react'
import { getSmtpConfig, saveSmtpConfig, deleteSmtpConfig, getCalConfig, saveCalConfig, checkDomainHealth, getWarmupConfig, saveWarmupConfig } from '../services/api'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const SECTIONS = [
  { id: 'profile',    num: '01', label: 'Profile' },
  { id: 'email',      num: '02', label: 'Email Sending' },
  { id: 'automation', num: '03', label: 'Sequence Automation' },
  { id: 'warmup',     num: '04', label: 'Email Warm-up' },
  { id: 'scheduler',  num: '05', label: 'Meeting Scheduler' },
  { id: 'webhooks',   num: '06', label: 'Webhooks' },
  { id: 'privacy',    num: '07', label: 'Privacy' },
  { id: 'terms',      num: '08', label: 'Terms' },
]

const WEBHOOK_EVENT_LABELS = {
  'lead.created':       'Lead created',
  'lead.status_changed':'Lead status changed',
  'sequence.replied':   'Sequence replied',
  'sequence.completed': 'Sequence completed',
  'email.opened':       'Email opened',
}
const ALL_WEBHOOK_EVENTS = Object.keys(WEBHOOK_EVENT_LABELS)

// Scope a localStorage key to the current user so accounts don't bleed into each other
function uk(user, key) { return user?.id ? `${key}_${user.id}` : key }
function lsGet(user, key, fallback = '') { return localStorage.getItem(uk(user, key)) ?? localStorage.getItem(key) ?? fallback }
function lsSet(user, key, value) { localStorage.setItem(uk(user, key), value); localStorage.removeItem(key) }

export default function Settings() {
  const { user } = useAuth()
  const [fullName,    setFullName]    = useState(() => lsGet(user, 'fullName'))
  const [saved,       setSaved]       = useState(false)
  const [activeSection, setActiveSection] = useState('profile')
  const [agreedTerms, setAgreedTerms] = useState(() => lsGet(user, 'agreedTerms') === '1')
  const [wantsUpdates, setWantsUpdates] = useState(() => lsGet(user, 'wantsUpdates', '1') !== '0')

  // SMTP state (localStorage — for manual email sends in LeadDrawer)
  const [smtpHost,  setSmtpHost]  = useState(() => lsGet(user, 'smtpHost',     'smtp.gmail.com'))
  const [smtpPort,  setSmtpPort]  = useState(() => lsGet(user, 'smtpPort',     '587'))
  const [smtpUser,  setSmtpUser]  = useState(() => lsGet(user, 'smtpUser'))
  const [smtpPass,  setSmtpPass]  = useState(() => lsGet(user, 'smtpPass'))
  const [fromName,  setFromName]  = useState(() => lsGet(user, 'smtpFromName'))
  const [fromEmail, setFromEmail] = useState(() => lsGet(user, 'smtpFromEmail'))

  // Automation SMTP state (server-side — for sequence cron sends)
  const [autoSmtp, setAutoSmtp] = useState({
    smtp_host: 'smtp.gmail.com', smtp_port: '587',
    smtp_user: '', smtp_pass: '', from_email: '', from_name: '',
  })
  const [autoConfigured, setAutoConfigured] = useState(false)
  const [autoSaving, setAutoSaving]         = useState(false)
  const [autoSaved,  setAutoSaved]          = useState(false)
  const [autoDeleting, setAutoDeleting]     = useState(false)
  const [domainInput,   setDomainInput]     = useState('')
  const [domainChecking, setDomainChecking] = useState(false)
  const [domainHealth,  setDomainHealth]    = useState(null)
  const [domainError,   setDomainError]     = useState('')

  useEffect(() => {
    getSmtpConfig().then(res => {
      const cfg = res.data?.smtp_config || {}
      setAutoConfigured(res.data?.configured || false)
      if (cfg.smtp_user) {
        setAutoSmtp(prev => ({ ...prev, ...cfg }))
      }
    }).catch(() => {})
  }, [])

  async function handleSaveAutoSmtp() {
    setAutoSaving(true)
    try {
      await saveSmtpConfig(autoSmtp)
      setAutoConfigured(true)
      setAutoSaved(true)
      setTimeout(() => setAutoSaved(false), 3000)
    } catch (e) {
      alert('Failed to save: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setAutoSaving(false)
    }
  }

  async function handleDeleteAutoSmtp() {
    if (!confirm('Remove saved SMTP credentials from server? Sequence automation will stop sending emails until reconfigured.')) return
    setAutoDeleting(true)
    try {
      await deleteSmtpConfig()
      setAutoConfigured(false)
      setAutoSmtp({ smtp_host: 'smtp.gmail.com', smtp_port: '587', smtp_user: '', smtp_pass: '', from_email: '', from_name: '' })
    } catch (e) {
      alert('Failed: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setAutoDeleting(false)
    }
  }

  async function handleCheckDomain() {
    const domain = (domainInput || autoSmtp.from_email.split('@')[1] || '').trim()
    if (!domain) return
    setDomainError('')
    setDomainHealth(null)
    setDomainChecking(true)
    try {
      const r = await checkDomainHealth(domain)
      setDomainHealth(r.data)
      setDomainInput(domain)
    } catch (e) {
      setDomainError(e?.response?.data?.detail || 'Check failed. Verify the domain name.')
    } finally {
      setDomainChecking(false)
    }
  }

  const sectionRefs = {
    profile:    useRef(null),
    email:      useRef(null),
    automation: useRef(null),
    warmup:     useRef(null),
    scheduler:  useRef(null),
    webhooks:   useRef(null),
    privacy:    useRef(null),
    terms:      useRef(null),
  }

  // Meeting scheduler state
  const [calLink,    setCalLink]    = useState('')
  const [calSlug,    setCalSlug]    = useState('')
  const [calSaving,  setCalSaving]  = useState(false)
  const [calSaved,   setCalSaved]   = useState(false)
  const [calError,   setCalError]   = useState('')

  useEffect(() => {
    getCalConfig().then(r => {
      setCalLink(r.data.cal_link || '')
      setCalSlug(r.data.cal_slug || '')
    }).catch(() => {})
  }, [])

  // Webhooks state
  const [webhooks, setWebhooks] = useState([])
  const [whForm, setWhForm] = useState({ name: '', url: '', events: ['lead.created'], secret: '' })
  const [whAdding, setWhAdding] = useState(false)
  const [whShowForm, setWhShowForm] = useState(false)
  const [whTesting, setWhTesting] = useState({})
  const [whTestResult, setWhTestResult] = useState({})

  // Warm-up state
  const [warmup, setWarmup] = useState(null)
  const [warmupLoading, setWarmupLoading] = useState(true)
  const [warmupSaving,  setWarmupSaving]  = useState(false)
  const [warmupSaved,   setWarmupSaved]   = useState(false)
  const [warmupEnabled, setWarmupEnabled] = useState(false)
  const [warmupEmails,  setWarmupEmails]  = useState('')

  useEffect(() => {
    api.get('/webhooks').then(r => setWebhooks(r.data.webhooks || [])).catch(() => {})
  }, [])

  useEffect(() => {
    getWarmupConfig().then(r => {
      const cfg = r.data?.config
      setWarmup(r.data)
      setWarmupEnabled(cfg?.enabled || false)
      setWarmupEmails((cfg?.partner_emails || []).join(', '))
    }).catch(() => {}).finally(() => setWarmupLoading(false))
  }, [])

  async function handleSaveWarmup() {
    setWarmupSaving(true)
    try {
      const emails = warmupEmails.split(',').map(e => e.trim()).filter(Boolean)
      const r = await saveWarmupConfig({ enabled: warmupEnabled, partner_emails: emails })
      const cfg = r.data?.config
      setWarmup({ ...warmup, config: cfg, day: warmup?.day || 0, daily_target: warmup?.daily_target || 2 })
      setWarmupSaved(true)
      setTimeout(() => setWarmupSaved(false), 3000)
    } catch (e) {
      alert('Failed to save warm-up config: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setWarmupSaving(false)
    }
  }

  async function addWebhook() {
    if (!whForm.url || !whForm.events.length) return
    setWhAdding(true)
    try {
      const r = await api.post('/webhooks', whForm)
      setWebhooks(h => [r.data.webhook, ...h])
      setWhForm({ name: '', url: '', events: ['lead.created'], secret: '' })
      setWhShowForm(false)
    } catch (e) {
      alert('Failed: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setWhAdding(false)
    }
  }

  async function deleteWebhook(id) {
    if (!confirm('Delete this webhook?')) return
    await api.delete(`/webhooks/${id}`)
    setWebhooks(h => h.filter(w => w.id !== id))
  }

  async function testWebhook(id) {
    setWhTesting(t => ({ ...t, [id]: true }))
    try {
      const r = await api.post(`/webhooks/${id}/test`)
      setWhTestResult(t => ({ ...t, [id]: r.data.ok ? 'ok' : `fail (${r.data.status_code || r.data.error})` }))
    } catch {
      setWhTestResult(t => ({ ...t, [id]: 'error' }))
    } finally {
      setWhTesting(t => ({ ...t, [id]: false }))
      setTimeout(() => setWhTestResult(t => { const n = { ...t }; delete n[id]; return n }), 4000)
    }
  }

  function toggleWhEvent(ev) {
    setWhForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }))
  }

  async function handleSaveCal() {
    setCalError('')
    if (calLink && !calLink.startsWith('http')) { setCalError('Enter a valid URL starting with https://'); return }
    setCalSaving(true)
    try {
      const r = await saveCalConfig({ cal_link: calLink, cal_slug: calSlug })
      setCalSlug(r.data.cal_slug || calSlug)
      setCalSaved(true)
      setTimeout(() => setCalSaved(false), 3000)
    } catch (e) {
      setCalError(e?.response?.data?.detail || 'Failed to save.')
    } finally {
      setCalSaving(false)
    }
  }

  function handleSave() {
    lsSet(user, 'fullName',     fullName)
    lsSet(user, 'smtpHost',     smtpHost)
    lsSet(user, 'smtpPort',     smtpPort)
    lsSet(user, 'smtpUser',     smtpUser)
    lsSet(user, 'smtpPass',     smtpPass)
    lsSet(user, 'smtpFromName', fromName)
    lsSet(user, 'smtpFromEmail',fromEmail)
    lsSet(user, 'agreedTerms',  agreedTerms  ? '1' : '0')
    lsSet(user, 'wantsUpdates', wantsUpdates ? '1' : '0')
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
          <p style={s.heroSub}>Profile and platform configuration.</p>
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
                  cursor: 'pointer', textAlign: 'left',
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

          {/* 02 — Email Sending */}
          <section ref={sectionRefs.email} style={{ ...s.section, borderBottom: '1px solid var(--border)' }}>
            <SectionHeader num="02" title="Email Sending" />
            <p style={s.sectionHint}>
              Connect any email account via SMTP to send emails directly from Sonar — no copy-pasting required. Gmail users: use an App Password (Google Account → Security → 2FA → App Passwords).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 16 }}>
              <Field label="Your name" hint="Shown as sender name">
                <input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Jane Smith" style={s.input} />
              </Field>
              <Field label="From email" hint="Address recipients will reply to">
                <input value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="jane@company.com" style={s.input} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px', marginBottom: 16 }}>
              <Field label="SMTP host">
                <input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" style={s.input} />
              </Field>
              <Field label="Port">
                <input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" style={s.input} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Field label="SMTP username">
                <input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="jane@gmail.com" style={s.input} />
              </Field>
              <Field label="Password / App Password" hint="">
                <KeyInput value={smtpPass} onChange={setSmtpPass} placeholder="App password or SMTP password" set={!!smtpPass} />
              </Field>
            </div>

            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', margin: 0, lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--text)' }}>Gmail:</strong> smtp.gmail.com · port 587 · your Gmail address · <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>generate an App Password</a><br />
                <strong style={{ color: 'var(--text)' }}>Outlook:</strong> smtp.office365.com · port 587 · your email · account password<br />
                Credentials are saved in your browser only — never sent to our servers for storage.
              </p>
            </div>
          </section>

          {/* 03 — Sequence Automation */}
          <section ref={sectionRefs.automation} style={{ ...s.section, borderBottom: '1px solid var(--border)' }}>
            <SectionHeader num="03" title="Sequence Automation" />
            <p style={s.sectionHint}>
              Save SMTP credentials server-side so sequence steps run automatically on schedule — even when you're offline. These are stored encrypted on our server and used only by the sequence cron job. Sequences run every 6 hours.
            </p>

            {autoConfigured && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 14px', background: 'rgba(74,124,89,0.08)', border: '1px solid rgba(74,124,89,0.3)', borderRadius: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a7c59', fontWeight: 600 }}>AUTOMATION ACTIVE</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>Sequence emails will send automatically via {autoSmtp.smtp_user || 'saved account'}.</span>
                <button onClick={handleDeleteAutoSmtp} disabled={autoDeleting} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, padding: '4px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {autoDeleting ? 'Removing…' : 'Remove'}
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 16 }}>
              <Field label="From name" hint="Shown as sender name in sequence emails">
                <input value={autoSmtp.from_name} onChange={e => setAutoSmtp(p => ({ ...p, from_name: e.target.value }))} placeholder="Jane Smith" style={s.input} />
              </Field>
              <Field label="From email" hint="Reply-to address">
                <input value={autoSmtp.from_email} onChange={e => setAutoSmtp(p => ({ ...p, from_email: e.target.value }))} placeholder="jane@company.com" style={s.input} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px', marginBottom: 16 }}>
              <Field label="SMTP host">
                <input value={autoSmtp.smtp_host} onChange={e => setAutoSmtp(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" style={s.input} />
              </Field>
              <Field label="Port">
                <input value={autoSmtp.smtp_port} onChange={e => setAutoSmtp(p => ({ ...p, smtp_port: e.target.value }))} placeholder="587" style={s.input} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 20 }}>
              <Field label="SMTP username">
                <input value={autoSmtp.smtp_user} onChange={e => setAutoSmtp(p => ({ ...p, smtp_user: e.target.value }))} placeholder="jane@gmail.com" style={s.input} />
              </Field>
              <Field label="Password / App Password">
                <KeyInput value={autoSmtp.smtp_pass} onChange={v => setAutoSmtp(p => ({ ...p, smtp_pass: v }))} placeholder="App password or SMTP password" set={autoConfigured && autoSmtp.smtp_pass === '••••••••'} />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={handleSaveAutoSmtp} disabled={autoSaving || !autoSmtp.smtp_user} style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '10px 20px',
                background: autoSaved ? '#4a7c59' : 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 3, cursor: autoSaving || !autoSmtp.smtp_user ? 'default' : 'pointer',
                opacity: !autoSmtp.smtp_user ? 0.5 : 1, letterSpacing: '0.04em',
              }}>
                {autoSaving ? 'Saving…' : autoSaved ? 'Saved to server' : 'Save for automation'}
              </button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                Tokens: {'{{name}}'} {'{{first_name}}'} {'{{company}}'} {'{{title}}'} {'{{cal_link}}'}
              </span>
            </div>

            {/* Domain Health Check */}
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Domain Health</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                Check SPF and DMARC records for your sending domain. Missing records increase spam placement.
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  value={domainInput || (autoSmtp.from_email.includes('@') ? autoSmtp.from_email.split('@')[1] : '')}
                  onChange={e => setDomainInput(e.target.value)}
                  placeholder="yourdomain.com"
                  style={{ ...s.input, flex: 1, maxWidth: 280 }}
                />
                <button onClick={handleCheckDomain} disabled={domainChecking} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '10px 18px',
                  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
                  borderRadius: 3, cursor: domainChecking ? 'default' : 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                }}>
                  {domainChecking ? 'Checking…' : 'Check DNS'}
                </button>
              </div>

              {domainError && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444', marginTop: 10 }}>{domainError}</p>
              )}

              {domainHealth && (
                <div style={{ marginTop: 16, padding: '16px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                  {/* Score bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: domainHealth.score >= 80 ? 'rgba(74,124,89,0.15)' : domainHealth.score >= 40 ? 'rgba(234,179,8,0.12)' : 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: domainHealth.score >= 80 ? '#4a7c59' : domainHealth.score >= 40 ? '#ca8a04' : '#ef4444' }}>{domainHealth.score}</span>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{domainHealth.domain}</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: domainHealth.score >= 80 ? '#4a7c59' : domainHealth.score >= 40 ? '#ca8a04' : '#ef4444', margin: '2px 0 0' }}>
                        {domainHealth.score >= 80 ? 'Strong deliverability' : domainHealth.score >= 40 ? 'Needs improvement' : 'High spam risk'}
                      </p>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 3, background: domainHealth.spf.ok && !domainHealth.spf.warn ? 'rgba(74,124,89,0.12)' : 'rgba(239,68,68,0.1)', color: domainHealth.spf.ok && !domainHealth.spf.warn ? '#4a7c59' : '#ef4444' }}>
                        SPF {domainHealth.spf.ok ? (domainHealth.spf.warn ? '⚠' : '✓') : '✗'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 3, background: domainHealth.dmarc.ok && !domainHealth.dmarc.warn ? 'rgba(74,124,89,0.12)' : 'rgba(239,68,68,0.1)', color: domainHealth.dmarc.ok && !domainHealth.dmarc.warn ? '#4a7c59' : '#ef4444' }}>
                        DMARC {domainHealth.dmarc.ok ? (domainHealth.dmarc.warn ? '⚠' : '✓') : '✗'}
                      </span>
                    </div>
                  </div>

                  {/* Record values */}
                  {domainHealth.spf.value && (
                    <div style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 3, border: '1px solid var(--border)' }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', margin: '0 0 3px', fontWeight: 600 }}>SPF RECORD</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', margin: 0, wordBreak: 'break-all' }}>{domainHealth.spf.value}</p>
                    </div>
                  )}
                  {domainHealth.dmarc.value && (
                    <div style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 3, border: '1px solid var(--border)' }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', margin: '0 0 3px', fontWeight: 600 }}>DMARC RECORD</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', margin: 0, wordBreak: 'break-all' }}>{domainHealth.dmarc.value}</p>
                    </div>
                  )}

                  {/* Recommendations */}
                  {domainHealth.recommendations.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Recommendations</p>
                      {domainHealth.recommendations.map((rec, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ca8a04', flexShrink: 0, marginTop: 1 }}>→</span>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{rec}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* 04 — Email Warm-up */}
          <section ref={sectionRefs.warmup} style={{ ...s.section, borderBottom: '1px solid var(--border)' }}>
            <SectionHeader num="04" title="Email Warm-up" />
            <p style={s.sectionHint}>
              Gradually increase your sending volume to build sender reputation — like Instantly.ai. Sonar sends friendly warm-up emails to your partner addresses each day, starting at 2/day and ramping up to 40/day over 20 days.
            </p>

            {warmupLoading ? (
              <div style={{ height: 80, background: 'var(--bg)', borderRadius: 6, marginBottom: 16 }} />
            ) : (
              <>
                {warmup?.config && warmup.config.enabled && (
                  <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(74,124,89,0.08)', border: '1px solid rgba(74,124,89,0.3)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#4a7c59', letterSpacing: '0.1em' }}>WARM-UP ACTIVE</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>Day {warmup.day} / 20 &nbsp;·&nbsp; {warmup.daily_target} emails/day</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, (warmup.day / 20) * 100)}%`, background: '#4a7c59', borderRadius: 2, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <button
                    onClick={() => setWarmupEnabled(v => !v)}
                    style={{
                      position: 'relative', flexShrink: 0,
                      width: '44px', height: '24px',
                      background: warmupEnabled ? 'var(--accent)' : 'var(--surface)',
                      border: warmupEnabled ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: '12px', cursor: 'pointer', transition: 'background 0.2s', padding: 0,
                    }}
                  >
                    <span style={{ position: 'absolute', top: 3, left: warmupEnabled ? 22 : 3, width: 16, height: 16, borderRadius: '50%', background: warmupEnabled ? '#fff' : '#9CA3AF', transition: 'left 0.2s', display: 'block' }} />
                  </button>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                    {warmupEnabled ? 'Warm-up enabled' : 'Warm-up disabled'}
                  </span>
                </div>

                <Field label="Partner emails" hint="Comma-separated list of email addresses to send warm-up emails to. Leave blank to automatically use the Sonar warmup network — other platform users who have warm-up enabled.">
                  <input
                    value={warmupEmails}
                    onChange={e => setWarmupEmails(e.target.value)}
                    placeholder="Leave blank for auto network, or add: backup@gmail.com, personal@outlook.com"
                    style={s.input}
                  />
                </Field>
                {warmupEnabled && !warmupEmails.trim() && (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a7c59', margin: '-10px 0 14px', lineHeight: 1.5 }}>
                    ✓ Auto network active — warm-up emails will be sent to other Sonar users in the pool.
                  </p>
                )}

                {warmup?.config?.start_date && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>
                      Started: {new Date(warmup.config.start_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      {' '}&nbsp;·&nbsp; Target today: <strong style={{ color: 'var(--text)' }}>{warmup.daily_target}</strong> emails/day
                    </p>
                  </div>
                )}

                <button onClick={handleSaveWarmup} disabled={warmupSaving} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '10px 20px',
                  background: warmupSaved ? '#4a7c59' : 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 3, cursor: warmupSaving ? 'default' : 'pointer', letterSpacing: '0.04em',
                }}>
                  {warmupSaving ? 'Saving…' : warmupSaved ? 'Saved' : 'Save warm-up settings'}
                </button>

                <div style={{ marginTop: 20, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>How it works</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', margin: 0, lineHeight: 1.7 }}>
                    Day 1: 2 emails · Day 2: 4 emails · … · Day 20: 40 emails/day.<br />
                    Requires Sequence Automation SMTP configured above. Runs daily at 8 AM UTC.<br />
                    Use your own secondary email accounts as partners to keep warm-up traffic in your control.
                  </p>
                </div>
              </>
            )}
          </section>

          {/* 05 — Meeting Scheduler */}
          <section ref={sectionRefs.scheduler} style={{ ...s.section, borderBottom: '1px solid var(--border)' }}>
            <SectionHeader num="04" title="Meeting Scheduler" />
            <p style={s.sectionHint}>
              Paste your Calendly, Cal.com, Google Calendar, or any booking URL. Use <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface)', padding: '1px 5px', borderRadius: 3 }}>{'{{cal_link}}'}</code> in any sequence email to insert it automatically.
            </p>

            <Field label="Booking URL" hint="Your Calendly, Cal.com, or any scheduling link">
              <input
                type="url"
                value={calLink}
                onChange={e => setCalLink(e.target.value)}
                placeholder="https://calendly.com/yourname/30min"
                style={s.input}
              />
            </Field>

            <Field label="Custom slug (optional)" hint={`Share as sonarleads.vercel.app/book/${calSlug || 'yourname'}`}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', padding: '10px 10px 10px 14px', whiteSpace: 'nowrap', borderRight: '1px solid var(--border)' }}>
                  sonarleads.vercel.app/book/
                </span>
                <input
                  type="text"
                  value={calSlug}
                  onChange={e => setCalSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="yourname"
                  style={{ ...s.input, border: 'none', borderRadius: 0, flex: 1 }}
                />
              </div>
            </Field>

            {calError && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444', marginTop: 4 }}>{calError}</p>}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
              <button onClick={handleSaveCal} disabled={calSaving} style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '10px 20px',
                background: calSaved ? '#4a7c59' : 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 3, cursor: calSaving ? 'default' : 'pointer', letterSpacing: '0.04em',
              }}>
                {calSaving ? 'Saving…' : calSaved ? 'Saved' : 'Save scheduler settings'}
              </button>
              {calSlug && calLink && (
                <a href={`/book/${calSlug}`} target="_blank" rel="noreferrer"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textDecoration: 'none' }}>
                  Preview booking page →
                </a>
              )}
            </div>

            {calLink && (
              <div style={{ marginTop: 16, padding: '14px 18px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>How to use in sequences</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  Add <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>{'{{cal_link}}'}</code> anywhere in your sequence email body. Sonar replaces it with{' '}
                  {calSlug ? <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>sonarleads.vercel.app/book/{calSlug}</code> : 'your booking URL'}{' '}
                  when the email is sent.
                </p>
              </div>
            )}
          </section>



          {/* 06 — Webhooks */}
          <section ref={sectionRefs.webhooks} style={{ ...s.section, borderBottom: '1px solid var(--border)' }}>
            <SectionHeader num="05" title="Webhooks" />
            <p style={s.sectionHint}>Send real-time HTTP POST notifications to your endpoints when key events happen in Sonar. Compatible with Zapier, Make, n8n, or any custom integration.</p>

            {webhooks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {webhooks.map(wh => (
                  <div key={wh.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{wh.name || wh.url}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px', borderRadius: 4, background: wh.active ? 'rgba(74,124,89,0.15)' : 'rgba(180,180,180,0.1)', color: wh.active ? '#4a7c59' : 'var(--text-muted)' }}>
                          {wh.active ? 'ACTIVE' : 'PAUSED'}
                        </span>
                      </div>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', margin: '0 0 6px', wordBreak: 'break-all' }}>{wh.url}</p>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(wh.events || []).map(ev => (
                          <span key={ev} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                            {WEBHOOK_EVENT_LABELS[ev] || ev}
                          </span>
                        ))}
                      </div>
                      {wh.delivery_count > 0 && (
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                          {wh.delivery_count} deliveries · {wh.error_count || 0} errors
                          {wh.last_triggered_at && ` · last fired ${new Date(wh.last_triggered_at).toLocaleDateString()}`}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => testWebhook(wh.id)} disabled={whTesting[wh.id]} style={{ padding: '5px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: whTestResult[wh.id] === 'ok' ? '#4a7c59' : whTestResult[wh.id] ? '#E7000B' : 'var(--text)', cursor: 'pointer' }}>
                        {whTesting[wh.id] ? '…' : whTestResult[wh.id] || 'Test'}
                      </button>
                      <button onClick={() => deleteWebhook(wh.id)} style={{ padding: '5px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {whShowForm ? (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>Name (optional)</label>
                    <input value={whForm.name} onChange={e => setWhForm(f => ({ ...f, name: e.target.value }))} placeholder="My Zapier webhook" style={s.input} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={s.label}>Endpoint URL</label>
                    <input value={whForm.url} onChange={e => setWhForm(f => ({ ...f, url: e.target.value }))} placeholder="https://hooks.zapier.com/hooks/catch/…" style={s.input} />
                  </div>
                </div>
                <div>
                  <label style={s.label}>Events to subscribe</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    {ALL_WEBHOOK_EVENTS.map(ev => (
                      <button key={ev} type="button" onClick={() => toggleWhEvent(ev)} style={{ padding: '5px 10px', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer', border: '1px solid', borderColor: whForm.events.includes(ev) ? '#E7000B' : 'var(--border)', background: whForm.events.includes(ev) ? 'rgba(231,0,11,0.1)' : 'var(--surface)', color: whForm.events.includes(ev) ? '#E7000B' : 'var(--text-muted)' }}>
                        {WEBHOOK_EVENT_LABELS[ev]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={s.label}>Signing secret (optional — for HMAC verification)</label>
                  <input value={whForm.secret} onChange={e => setWhForm(f => ({ ...f, secret: e.target.value }))} placeholder="Leave blank to skip signature" style={s.input} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={addWebhook} disabled={whAdding || !whForm.url || !whForm.events.length} style={{ ...s.saveBtn, opacity: (whAdding || !whForm.url) ? 0.6 : 1 }}>
                    {whAdding ? 'Adding…' : 'Add webhook'}
                  </button>
                  <button onClick={() => setWhShowForm(false)} style={{ ...s.saveBtn, background: 'var(--surface)', color: 'var(--text)' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setWhShowForm(true)} style={{ ...s.saveBtn, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                + Add webhook
              </button>
            )}

            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 6px', letterSpacing: '0.08em' }}>HOW TO USE WITH ZAPIER</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                1. Create a Zap → Trigger: Webhooks by Zapier → Catch Hook → copy the URL above.<br />
                2. Select events you want (e.g. <code style={{ color: 'var(--text)' }}>lead.created</code>).<br />
                3. Click Test in Sonar to send a sample payload and activate your Zap.
              </p>
            </div>
          </section>

          {/* 05 — Privacy */}
          <section ref={sectionRefs.privacy} style={{ ...s.section }}>
            <SectionHeader num="06" title="Privacy Policy" />
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

          {/* 06 — Terms */}
          <section ref={sectionRefs.terms} style={{ ...s.section, borderBottom: 'none', paddingBottom: 0 }}>
            <SectionHeader num="07" title="Terms of Service" />
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
  label:        { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 },
  saveBtn:      { padding: '10px 20px', background: '#E7000B', border: 'none', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' },
  legalHeading: { fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', color: 'var(--text)', textTransform: 'uppercase', marginBottom: '4px' },
  legalMeta:    { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '18px', letterSpacing: '0.02em' },
  legalSubhead: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--text)', textTransform: 'uppercase', marginTop: '18px', marginBottom: '6px' },
  legalBody:    { fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '0px' },
}
