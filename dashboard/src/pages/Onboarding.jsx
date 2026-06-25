import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import api from '../services/api'
import { MultiStepLoader } from '../components/ui/MultiStepLoader'
import { AnimatedButton } from '../components/ui/AnimatedButton'

const BG   = '#fffcfc'
const INK  = '#01011b'
const PLUM = '#31263b'
const MID  = '#717a94'
const LINE = '#dbd7da'
const SURF = '#ecedf2'
const ACC  = '#6f63b7'
const SANS = "'IBM Plex Sans', 'DM Sans', sans-serif"
const SERIF = "'Cormorant Garamond', Georgia, serif"

const lbl = {
  display: 'block', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, fontWeight: 600,
  color: '#717a94', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
}

const inp = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 12px', background: '#ecedf2',
  border: '1.5px solid #dbd7da', borderRadius: 6,
  fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: '#01011b', outline: 'none',
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState(null)
  const [name, setName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // SMTP step state
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [smtpSaved, setSmtpSaved] = useState(false)
  const [smtpError, setSmtpError] = useState('')

  async function setupProfile(selectedMode, tName) {
    setLoading(true)
    setError('')
    try {
      await api.post('/profile/setup', {
        mode: selectedMode,
        team_name: tName || undefined,
        name: name.trim() || undefined,
      })
      setLoading(false)
      return true
    } catch (e) {
      setError(e?.response?.data?.detail || 'Something went wrong.')
      setLoading(false)
      return false
    }
  }

  async function handleStep1Continue() {
    if (!mode) return
    if (mode === 'team' && !teamName.trim()) return
    const ok = await setupProfile(mode, mode === 'team' ? teamName.trim() : '')
    if (ok) setStep(2)
  }

  async function handleSmtpSave() {
    setSmtpSaving(true)
    setSmtpError('')
    try {
      await api.patch('/profile/smtp-config', {
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        from_name: fromName,
        from_email: fromEmail,
      })
      setSmtpSaved(true)
    } catch (e) {
      setSmtpError(e?.response?.data?.detail || 'Failed to save SMTP config.')
    } finally {
      setSmtpSaving(false)
    }
  }

  const loaderSteps = [
    'Setting up your workspace…',
    'Building your ICP profile…',
    'Preparing your workspace…',
    'Configuring enrichment…',
    'Almost ready…',
  ]

  const STEPS = [
    { num: 1, label: 'Welcome' },
    { num: 2, label: 'SMTP' },
    { num: 3, label: 'Find leads' },
    { num: 4, label: 'Done' },
  ]

  return (
    <motion.div style={{ background: BG, minHeight: '100vh', fontFamily: SANS, color: INK }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>

      <AnimatePresence>
        {loading && <MultiStepLoader steps={loaderSteps} active={loading} />}
      </AnimatePresence>

      {/* Nav with step indicator */}
      <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 40px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: INK }}>Sonar</span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {STEPS.map((s, i) => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: SANS, fontSize: 11, fontWeight: 700,
                  background: step === s.num ? PLUM : step > s.num ? ACC : 'transparent',
                  color: step >= s.num ? '#fff' : MID,
                  border: `1.5px solid ${step === s.num ? PLUM : step > s.num ? ACC : LINE}`,
                  transition: 'all 0.2s',
                }}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span style={{ fontFamily: SANS, fontSize: 11, color: step === s.num ? INK : MID, fontWeight: step === s.num ? 600 : 400 }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 28, height: 1.5, background: step > s.num ? ACC : LINE, margin: '0 8px', transition: 'background 0.2s' }} />
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Step 1: Welcome */}
      {step === 1 && (
        <motion.div key="step1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ padding: '16px 40px', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '0.08em' }}>① Welcome</span>
          </div>

          <div style={{ padding: '56px 40px 64px', maxWidth: 640 }}>
            <h1 style={{ margin: '0 0 8px', lineHeight: 1.05 }}>
              <span style={{ display: 'block', fontFamily: SERIF, fontSize: 'clamp(36px, 6vw, 80px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.03em', color: INK }}>
                Welcome to
              </span>
              <span style={{ display: 'block', fontFamily: SANS, fontSize: 'clamp(28px, 5vw, 64px)', fontWeight: 700, letterSpacing: '-0.03em', color: PLUM }}>
                Sonar.
              </span>
            </h1>
            <p style={{ fontSize: 14, color: MID, marginTop: 16, lineHeight: 1.65, marginBottom: 40 }}>
              Let's get your workspace set up in under 3 minutes.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 480 }}>
              <div>
                <label style={lbl}>Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Alex Chen"
                  autoFocus
                  style={inp}
                />
              </div>

              <div>
                <label style={lbl}>How will you use Sonar?</label>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {[
                    { key: 'solo', title: 'Solo', desc: 'Just me' },
                    { key: 'team', title: 'Team', desc: 'Building with others' },
                  ].map(opt => (
                    <button key={opt.key}
                      onClick={() => setMode(opt.key)}
                      style={{
                        flex: 1, padding: '16px 20px', textAlign: 'left',
                        background: mode === opt.key ? 'rgba(111,99,183,0.08)' : 'transparent',
                        border: `1.5px solid ${mode === opt.key ? ACC : LINE}`,
                        borderRadius: 8, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}>
                      <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: INK, marginBottom: 4 }}>{opt.title}</div>
                      <div style={{ fontFamily: SANS, fontSize: 12, color: MID }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'team' && (
                <div>
                  <label style={lbl}>Team name</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && teamName.trim() && handleStep1Continue()}
                    placeholder="e.g. NovaSpark AI"
                    style={inp}
                  />
                </div>
              )}

              {error && <p style={{ fontSize: 13, color: '#b83232', margin: 0 }}>{error}</p>}

              <div>
                <AnimatedButton
                  variant="shimmer"
                  as="button"
                  onClick={handleStep1Continue}
                  disabled={!mode || loading || (mode === 'team' && !teamName.trim())}
                  style={{ opacity: (!mode || loading || (mode === 'team' && !teamName.trim())) ? 0.5 : 1, cursor: (!mode || loading) ? 'not-allowed' : 'pointer' }}
                >
                  Continue →
                </AnimatedButton>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 2: SMTP Setup */}
      {step === 2 && (
        <motion.div key="step2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ padding: '16px 40px', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: ACC, textTransform: 'uppercase', letterSpacing: '0.08em' }}>② SMTP Setup</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 'calc(100vh - 112px)' }}>
            <div style={{ padding: '48px 40px 64px', borderRight: `1px solid ${LINE}` }}>
              <h2 style={{ margin: '0 0 8px', fontFamily: SERIF, fontSize: 'clamp(26px, 3.5vw, 52px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.03em', color: INK, lineHeight: 1.1 }}>
                Email sending setup.
              </h2>
              <p style={{ fontSize: 14, color: MID, margin: '12px 0 28px', lineHeight: 1.65 }}>
                Required for sequence automation — emails are sent from your own inbox.
              </p>

              <div style={{ background: 'rgba(111,99,183,0.06)', border: '1px solid rgba(111,99,183,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 28, fontSize: 13, color: PLUM, lineHeight: 1.6 }}>
                <strong>Gmail?</strong>{' '}Use{' '}
                <code style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, background: SURF, padding: '1px 6px', borderRadius: 3 }}>smtp.gmail.com</code>{' '}
                port{' '}
                <code style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, background: SURF, padding: '1px 6px', borderRadius: 3 }}>587</code>{' '}
                +{' '}<a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: ACC }}>App Password</a>{' '}
                (not your regular password).
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                  <div>
                    <label style={lbl}>SMTP Host</label>
                    <input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Port</label>
                    <input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" style={inp} />
                  </div>
                </div>

                <div>
                  <label style={lbl}>SMTP Username (usually your email)</label>
                  <input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="you@gmail.com" style={inp} />
                </div>

                <div>
                  <label style={lbl}>SMTP Password / App Password</label>
                  <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="••••••••••••" style={inp} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>From Name</label>
                    <input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Alex Chen" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>From Email</label>
                    <input value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="alex@company.com" style={inp} />
                  </div>
                </div>

                {smtpError && <p style={{ fontSize: 13, color: '#b83232', margin: 0 }}>{smtpError}</p>}

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button
                    onClick={handleSmtpSave}
                    disabled={smtpSaving || !smtpUser || !smtpPass}
                    style={{
                      padding: '10px 22px',
                      background: smtpSaved ? '#4a7c59' : PLUM,
                      color: '#fff', border: 'none', borderRadius: 6,
                      fontFamily: SANS, fontSize: 13, fontWeight: 600,
                      cursor: smtpSaving || !smtpUser || !smtpPass ? 'not-allowed' : 'pointer',
                      opacity: smtpSaving || !smtpUser || !smtpPass ? 0.55 : 1,
                      transition: 'background 0.2s',
                    }}>
                    {smtpSaving ? 'Saving…' : smtpSaved ? '✓ Saved' : 'Save SMTP'}
                  </button>
                  {smtpSaved && <span style={{ fontFamily: SANS, fontSize: 13, color: '#4a7c59' }}>SMTP configured!</span>}
                </div>
              </div>
            </div>

            <div style={{ padding: '48px 40px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Why this matters</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'Send personalized sequences from your own inbox',
                    'Track opens and replies in the dashboard',
                    'Automated follow-ups at the right cadence',
                    'Works with Gmail, Outlook, or any custom domain',
                  ].map(item => (
                    <li key={item} style={{ fontFamily: SANS, fontSize: 14, color: MID, display: 'flex', gap: 10, lineHeight: 1.55 }}>
                      <span style={{ color: ACC, flexShrink: 0 }}>—</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <AnimatedButton variant="shimmer" as="button" onClick={() => setStep(3)} style={{ width: 'fit-content' }}>
                  {smtpSaved ? 'Continue →' : 'Skip for now →'}
                </AnimatedButton>
                <button onClick={() => setStep(1)} style={{ fontFamily: SANS, fontSize: 13, color: MID, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: 'fit-content' }}>
                  ← Back
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 3: Find your first leads */}
      {step === 3 && (
        <motion.div key="step3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ padding: '16px 40px', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: ACC, textTransform: 'uppercase', letterSpacing: '0.08em' }}>③ Find leads</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 'calc(100vh - 112px)' }}>
            <div style={{ padding: '56px 40px 64px', borderRight: `1px solid ${LINE}` }}>
              <h2 style={{ margin: '0 0 12px', fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 56px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.03em', color: INK, lineHeight: 1.1 }}>
                Find your first leads.
              </h2>
              <p style={{ fontSize: 14, color: MID, margin: '12px 0 36px', lineHeight: 1.65, maxWidth: 400 }}>
                Search 800M+ professionals with Sonar Prospect — filter by title, company size, location, and more.
              </p>
              <AnimatedButton variant="shimmer" as="a" href="/prospect" style={{ display: 'inline-flex', textDecoration: 'none' }}>
                Go to Prospect →
              </AnimatedButton>
            </div>

            <div style={{ padding: '56px 40px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>Other ways to get started</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <a href="/leads" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: SURF, border: `1px solid ${LINE}`, borderRadius: 8, textDecoration: 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(111,99,183,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📥</div>
                    <div>
                      <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: INK, marginBottom: 2 }}>Import from CSV</div>
                      <div style={{ fontFamily: SANS, fontSize: 12, color: MID }}>Upload an existing leads list</div>
                    </div>
                  </a>
                  <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: SURF, border: `1px solid ${LINE}`, borderRadius: 8, textDecoration: 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(10,102,194,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#0a66c2', flexShrink: 0 }}>in</div>
                    <div>
                      <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: INK, marginBottom: 2 }}>Use Chrome extension on LinkedIn</div>
                      <div style={{ fontFamily: SANS, fontSize: 12, color: MID }}>Extract leads from any LinkedIn page</div>
                    </div>
                  </a>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button onClick={() => setStep(4)} style={{ fontFamily: SANS, fontSize: 13, color: MID, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: 'fit-content' }}>
                  Skip, I'll do this later →
                </button>
                <button onClick={() => setStep(2)} style={{ fontFamily: SANS, fontSize: 13, color: MID, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: 'fit-content' }}>
                  ← Back
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 4: Done */}
      {step === 4 && (
        <motion.div key="step4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ padding: '16px 40px', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: ACC, textTransform: 'uppercase', letterSpacing: '0.08em' }}>④ You're set up</span>
          </div>

          <div style={{ padding: '56px 40px 64px', maxWidth: 640 }}>
            <h1 style={{ margin: '0 0 12px', lineHeight: 1.05 }}>
              <span style={{ display: 'block', fontFamily: SERIF, fontSize: 'clamp(36px, 6vw, 80px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.03em', color: INK }}>
                {name ? `You're all set, ${name.split(' ')[0]}.` : "You're all set."}
              </span>
            </h1>
            <p style={{ fontSize: 14, color: MID, margin: '16px 0 40px', lineHeight: 1.65 }}>
              Here's what you've configured. You can update any of these later in Settings.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 40, border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
              {[
                {
                  label: 'Account created',
                  done: true,
                  note: mode === 'team' ? `Team: ${teamName}` : 'Solo workspace',
                },
                {
                  label: 'SMTP configured',
                  done: smtpSaved,
                  note: smtpSaved ? smtpUser : 'Sequences may not send — configure in Settings → Email',
                },
              ].map((item, i) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: i < 1 ? `1px solid ${LINE}` : 'none', background: BG }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    background: item.done ? 'rgba(74,124,89,0.12)' : 'rgba(113,122,148,0.08)',
                    color: item.done ? '#4a7c59' : MID,
                    border: `1.5px solid ${item.done ? 'rgba(74,124,89,0.3)' : LINE}`,
                  }}>
                    {item.done ? '✓' : '—'}
                  </div>
                  <div>
                    <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: item.done ? INK : MID }}>{item.label}</div>
                    {item.note && <div style={{ fontFamily: SANS, fontSize: 12, color: MID, marginTop: 2 }}>{item.note}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <AnimatedButton variant="shimmer" as="button" onClick={() => { window.location.href = '/dashboard' }} style={{ width: 'fit-content' }}>
                Go to dashboard →
              </AnimatedButton>
              {!smtpSaved && (
                <button onClick={() => setStep(2)} style={{ fontFamily: SANS, fontSize: 13, color: ACC, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: 'fit-content' }}>
                  + Set up SMTP (recommended for sequences)
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
