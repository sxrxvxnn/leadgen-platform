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

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState(null)
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleModeSelect(selected) {
    setMode(selected)
    if (selected === 'solo') {
      await finish('solo', '', false)
    } else {
      setStep(2)
    }
  }

  async function finish(selectedMode, tName = '', goToDash = true) {
    setLoading(true)
    setError('')
    try {
      await api.post('/profile/setup', {
        mode: selectedMode,
        team_name: tName || undefined,
      })
      if (goToDash) {
        navigate('/dashboard')
      } else {
        setStep(3)
        setLoading(false)
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Something went wrong.')
      setLoading(false)
    }
  }

  const loaderSteps = [
    'Setting up your workspace…',
    'Building your ICP profile…',
    'Preparing your pipeline…',
    'Configuring enrichment…',
    'Almost ready…',
  ]

  return (
    <motion.div style={{ background: BG, minHeight: '100vh', fontFamily: SANS, color: INK }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>

      <AnimatePresence>
        {loading && <MultiStepLoader steps={loaderSteps} active={loading} />}
      </AnimatePresence>

      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${LINE}`, padding: '0 40px', height: 56, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: INK }}>Sonar</span>
      </nav>

      {step === 1 && (
        <>
          <div style={{ padding: '16px 40px', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '0.08em' }}>① Setup</span>
          </div>

          <div style={{ padding: '56px 40px 64px', borderBottom: `1px solid ${LINE}` }}>
            <h1 style={{ margin: '0 0 16px', lineHeight: 1.05 }}>
              <span style={{ display: 'block', fontFamily: SERIF, fontSize: 'clamp(40px, 7vw, 96px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.03em', color: INK }}>
                How will you
              </span>
              <span style={{ display: 'block', fontFamily: SANS, fontSize: 'clamp(32px, 5.5vw, 72px)', fontWeight: 700, letterSpacing: '-0.03em', color: PLUM }}>
                use Sonar?
              </span>
            </h1>
            <p style={{ fontSize: 14, color: MID, marginTop: 20, lineHeight: 1.65 }}>
              You can upgrade from Solo to Team at any time.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 300 }}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}>
              <ModeCard
                label="A"
                title="Solo"
                desc="Just me — building my own pipeline and prospecting independently."
                items={['Company discovery', 'AI enrichment', 'Lead management']}
                onClick={() => !loading && handleModeSelect('solo')}
                loading={loading && mode === 'solo'}
                disabled={loading}
                borderRight
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}>
              <ModeCard
                label="B"
                title="Team"
                desc="I'm building a team — I want to invite members and manage access."
                items={['Everything in Solo', 'Invite members', 'Admin controls']}
                onClick={() => !loading && handleModeSelect('team')}
                loading={loading && mode === 'team'}
                disabled={loading}
                accent
              />
            </motion.div>
          </div>

          {error && (
            <div style={{ padding: '16px 40px', borderTop: `1px solid ${LINE}` }}>
              <p style={{ fontSize: 13, color: '#b83232', margin: 0 }}>{error}</p>
            </div>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <div style={{ padding: '16px 40px', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: ACC, textTransform: 'uppercase', letterSpacing: '0.08em' }}>③ Chrome extension</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 'calc(100vh - 112px)' }}>
            {/* Left — copy */}
            <div style={{ padding: '56px 40px 64px', borderRight: `1px solid ${LINE}` }}>
              <h1 style={{ margin: '0 0 16px', lineHeight: 1.05 }}>
                <span style={{ display: 'block', fontFamily: SERIF, fontSize: 'clamp(36px, 5vw, 72px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.03em', color: INK }}>
                  Extract leads
                </span>
                <span style={{ display: 'block', fontFamily: SANS, fontSize: 'clamp(24px, 3.5vw, 48px)', fontWeight: 700, letterSpacing: '-0.03em', color: PLUM }}>
                  from LinkedIn.
                </span>
              </h1>
              <p style={{ fontSize: 14, color: MID, margin: '20px 0 32px', lineHeight: 1.7, maxWidth: 420 }}>
                The Sonar Chrome extension lets you pull people and companies from any LinkedIn page — profiles, people pages, search results — directly into your pipeline with one click.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Extract from LinkedIn people search & Sales Nav',
                  'Scrape full profiles: bio, experience, job title',
                  'Auto-scroll to load all results before extracting',
                  'Leads appear in your dashboard instantly',
                ].map(item => (
                  <li key={item} style={{ fontFamily: SANS, fontSize: 14, color: MID, display: 'flex', gap: 10 }}>
                    <span style={{ color: ACC, flexShrink: 0 }}>—</span>{item}
                  </li>
                ))}
              </ul>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <a
                  href="/sonar-extension.zip"
                  download
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    fontFamily: SANS, fontSize: 14, fontWeight: 500,
                    color: INK, background: '#ffffff',
                    border: `1px solid ${PLUM}`, borderRadius: 3,
                    padding: '10px 20px', textDecoration: 'none',
                    width: 'fit-content',
                  }}
                >
                  Download extension ↓
                </a>
                <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    ['1', 'Download and unzip the file'],
                    ['2', <>Open <code style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, background: SURF, padding: '1px 6px', borderRadius: 3, color: ACC }}>chrome://extensions</code> in Chrome</>],
                    ['3', 'Toggle on Developer mode (top-right corner)'],
                    ['4', 'Click Load unpacked → select the unzipped folder'],
                    ['5', 'Pin Sonar to your toolbar and sign in'],
                  ].map(([num, text]) => (
                    <li key={num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13, color: MID, lineHeight: 1.55 }}>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 400, color: ACC, background: 'rgba(111,99,183,0.08)', border: `1px solid rgba(111,99,183,0.2)`, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{num}</span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Right — go to dashboard */}
            <div
              style={{
                padding: '56px 40px 64px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}
            >
              <div>
                <p style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Ready to go</p>
                <p style={{ fontFamily: SANS, fontSize: 14, color: MID, lineHeight: 1.7, maxWidth: 320 }}>
                  You can install the extension any time from Settings → Extension inside your dashboard. Skip for now and start exploring Sonar.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <AnimatedButton variant="shimmer" as="button" onClick={() => { window.location.href = '/dashboard' }} style={{ width: 'fit-content' }}>
                  Go to dashboard →
                </AnimatedButton>
                <button
                  onClick={() => setStep(mode === 'team' ? 2 : 1)}
                  style={{ fontFamily: SANS, fontSize: 13, color: MID, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: 'fit-content' }}
                >
                  ← Back
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ padding: '16px 40px', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '0.08em' }}>② Team name</span>
          </div>

          <div style={{ padding: '56px 40px 64px', borderBottom: `1px solid ${LINE}` }}>
            <h1 style={{ margin: '0 0 16px', lineHeight: 1.05 }}>
              <span style={{ display: 'block', fontFamily: SERIF, fontSize: 'clamp(40px, 7vw, 96px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.03em', color: INK }}>
                Name your team.
              </span>
            </h1>
            <p style={{ fontSize: 14, color: MID, margin: '16px 0 48px', lineHeight: 1.65 }}>
              You can invite members right after setup.
            </p>

            <div style={{ maxWidth: 560 }}>
              <input
                type="text"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="e.g. Beagle Security"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && teamName.trim() && finish('team', teamName.trim())}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${PLUM}`,
                  fontFamily: SANS, fontSize: 24, fontWeight: 600,
                  color: INK, outline: 'none',
                  letterSpacing: '-0.02em',
                  marginBottom: 40,
                }}
              />

              {error && <p style={{ fontSize: 13, color: '#b83232', marginBottom: 16 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <AnimatedButton
                  variant="shimmer"
                  as="button"
                  onClick={() => finish('team', teamName.trim(), false)}
                  disabled={!teamName.trim() || loading}
                  style={{ opacity: !teamName.trim() || loading ? 0.5 : 1, cursor: !teamName.trim() || loading ? 'not-allowed' : 'pointer' }}
                >
                  Continue →
                </AnimatedButton>
                <button
                  onClick={() => setStep(1)}
                  style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: MID, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = INK}
                  onMouseLeave={e => e.currentTarget.style.color = MID}
                >
                  ← Back
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}

function ModeCard({ label, title, desc, items, accent, onClick, loading, disabled, borderRight }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '40px 40px',
        borderBottom: `1px solid ${LINE}`,
        borderRight: borderRight ? `1px solid ${LINE}` : 'none',
        background: hovered ? SURF : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !loading ? 0.5 : 1,
        transition: 'background 0.2s',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: ACC, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label})</span>
      </div>
      <h3 style={{
        fontFamily: SERIF,
        fontSize: 'clamp(32px, 5vw, 64px)',
        fontWeight: 300,
        fontStyle: 'italic',
        letterSpacing: '-0.02em',
        lineHeight: 1,
        color: INK,
        marginBottom: 16,
      }}>
        {loading ? 'Setting up…' : title}
      </h3>
      <p style={{ fontFamily: SANS, fontSize: 14, color: MID, lineHeight: 1.65, marginBottom: 24, maxWidth: 280 }}>
        {desc}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          <li key={item} style={{ fontFamily: SANS, fontSize: 14, color: MID, display: 'flex', gap: 10 }}>
            <span style={{ color: ACC }}>—</span>{item}
          </li>
        ))}
      </ul>
      {hovered && !loading && (
        <div style={{ marginTop: 32 }}>
          <span style={{
            fontFamily: SANS, fontSize: 14, fontWeight: 500,
            color: INK, border: `1px solid ${PLUM}`, borderRadius: 3,
            padding: '8px 16px', display: 'inline-block',
          }}>Select {title} →</span>
        </div>
      )}
    </div>
  )
}
