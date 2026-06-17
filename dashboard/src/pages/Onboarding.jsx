import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const BG   = '#f0eeea'
const INK  = '#111111'
const MID  = '#888888'
const LINE = '#d0cdc8'
const YLW  = '#e8f400'
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

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
      await finish('solo')
    } else {
      setStep(2)
    }
  }

  async function finish(selectedMode, tName = '') {
    setLoading(true)
    setError('')
    try {
      await api.post('/profile/setup', {
        mode: selectedMode,
        team_name: tName || undefined,
      })
      navigate('/dashboard')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', fontFamily: FONT, color: INK }}>

      {/* Nav */}
      <nav style={{
        borderBottom: `1px solid ${LINE}`,
        padding: '0 24px', height: 48,
        display: 'flex', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>SONAR©</span>
      </nav>

      {step === 1 && (
        <>
          {/* Section label */}
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontSize: 11, color: MID, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ① Setup
            </span>
          </div>

          {/* Big question */}
          <div style={{ padding: '40px 24px 48px', borderBottom: `1px solid ${LINE}` }}>
            <h1 style={{
              fontFamily: FONT,
              fontSize: 'clamp(40px, 7.5vw, 100px)',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              lineHeight: 0.95,
              margin: 0,
              color: INK,
            }}>
              How will you<br />use Sonar?
            </h1>
            <p style={{ fontSize: 14, color: MID, marginTop: 20, lineHeight: 1.65 }}>
              You can upgrade from Solo to Team at any time.
            </p>
          </div>

          {/* Mode cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 280 }}>
            <ModeCard
              label="A"
              title="SOLO"
              desc="Just me — building my own pipeline and prospecting independently."
              items={['Company discovery', 'AI enrichment', 'Lead management']}
              onClick={() => !loading && handleModeSelect('solo')}
              loading={loading && mode === 'solo'}
              disabled={loading}
              borderRight
            />
            <ModeCard
              label="B"
              title="TEAM"
              desc="I'm building a team — I want to invite members and manage access."
              items={['Everything in Solo', 'Invite members', 'Admin controls']}
              onClick={() => !loading && handleModeSelect('team')}
              loading={loading && mode === 'team'}
              disabled={loading}
              accent
            />
          </div>

          {error && (
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${LINE}` }}>
              <p style={{ fontSize: 12, color: '#c00', margin: 0, fontFamily: FONT }}>{error}</p>
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontSize: 11, color: MID, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ② Team name
            </span>
          </div>

          <div style={{ padding: '40px 24px 48px', borderBottom: `1px solid ${LINE}` }}>
            <h1 style={{
              fontFamily: FONT,
              fontSize: 'clamp(40px, 7.5vw, 100px)',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              lineHeight: 0.95,
              margin: '0 0 20px',
              color: INK,
            }}>
              Name your team.
            </h1>
            <p style={{ fontSize: 14, color: MID, margin: '0 0 40px', lineHeight: 1.65 }}>
              You can invite members right after setup.
            </p>

            <div style={{ maxWidth: 480 }}>
              <input
                type="text"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="e.g. Beagle Security"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && teamName.trim() && finish('team', teamName.trim())}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '14px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${INK}`,
                  fontFamily: FONT, fontSize: 28, fontWeight: 700,
                  color: INK, outline: 'none',
                  letterSpacing: '-0.02em',
                  marginBottom: 40,
                }}
              />

              {error && <p style={{ fontSize: 12, color: '#c00', marginBottom: 16 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  onClick={() => finish('team', teamName.trim())}
                  disabled={!teamName.trim() || loading}
                  style={{
                    fontFamily: FONT, fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    background: teamName.trim() && !loading ? INK : LINE,
                    color: teamName.trim() && !loading ? BG : MID,
                    border: 'none', padding: '11px 24px', borderRadius: 4,
                    cursor: teamName.trim() && !loading ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                  }}
                >
                  {loading ? 'Setting up…' : 'Create team →'}
                </button>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    fontFamily: FONT, fontSize: 11, fontWeight: 500,
                    color: MID, background: 'none', border: 'none',
                    cursor: 'pointer', letterSpacing: '0.06em',
                    textTransform: 'uppercase', padding: '11px 0',
                    transition: 'color 0.15s',
                  }}
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
    </div>
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
        padding: '32px 24px',
        borderBottom: `1px solid ${LINE}`,
        borderRight: borderRight ? `1px solid ${LINE}` : 'none',
        background: accent
          ? hovered ? YLW : 'transparent'
          : hovered ? '#e8e6e2' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !loading ? 0.5 : 1,
        transition: 'background 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: MID, fontWeight: 500, letterSpacing: '0.1em' }}>{label})</span>
      </div>
      <p style={{
        fontFamily: FONT,
        fontSize: 'clamp(32px, 5vw, 64px)',
        fontWeight: 900,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        color: INK,
        marginBottom: 16,
      }}>
        {loading ? 'Setting up…' : title}
      </p>
      <p style={{ fontSize: 13, color: MID, lineHeight: 1.65, marginBottom: 20, maxWidth: 280 }}>
        {desc}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(item => (
          <li key={item} style={{ fontSize: 12, color: MID, display: 'flex', gap: 8 }}>
            <span style={{ color: LINE }}>—</span>{item}
          </li>
        ))}
      </ul>
    </div>
  )
}
