import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const T = {
  bg:     '#0b0b0b',
  surface:'#111111',
  border: 'rgba(255,255,255,0.08)',
  text:   '#f0f0f0',
  muted:  '#7a7a7a',
  dim:    '#444444',
  accent: '#c8784a',
  font:   "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono:   "'SFMono-Regular', 'Consolas', 'Menlo', monospace",
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke={T.text} strokeWidth="1" strokeOpacity="0.25" />
        <circle cx="8" cy="8" r="4" stroke={T.text} strokeWidth="1" strokeOpacity="0.5" />
        <circle cx="8" cy="8" r="1.5" fill={T.text} />
      </svg>
      <span style={{ fontFamily: T.font, fontSize: 14, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>
        sonar
      </span>
    </div>
  )
}

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
    <div style={{
      minHeight: '100vh', background: T.bg, fontFamily: T.font,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '0 32px', height: 52,
        display: 'flex', alignItems: 'center',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <Logo />
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 32px',
      }}>

        {step === 1 && (
          <div style={{ width: '100%', maxWidth: 560 }}>
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.dim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 24 }}>
              Step 1 of 1
            </p>
            <h1 style={{
              fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600,
              letterSpacing: '-0.04em', lineHeight: 1.1,
              color: T.text, marginBottom: 12,
            }}>
              How will you use Sonar?
            </h1>
            <p style={{ fontSize: 14, color: T.muted, marginBottom: 40, lineHeight: 1.65 }}>
              You can upgrade from Solo to Team at any time.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ModeCard
                title="Solo"
                desc="Just me, building my own pipeline and prospecting independently."
                items={['Company discovery', 'AI enrichment', 'Lead management']}
                onClick={() => handleModeSelect('solo')}
                loading={loading && mode === 'solo'}
                disabled={loading}
              />
              <ModeCard
                title="Team"
                desc="I'm building a team — invite members and manage access."
                items={['Everything in Solo', 'Invite members', 'Admin controls']}
                accent
                onClick={() => handleModeSelect('team')}
                loading={loading && mode === 'team'}
                disabled={loading}
              />
            </div>

            {error && (
              <p style={{ fontFamily: T.mono, fontSize: 11, color: '#e07070', marginTop: 16 }}>{error}</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div style={{ width: '100%', maxWidth: 400 }}>
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.dim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 24 }}>
              Step 2 of 2
            </p>
            <h1 style={{
              fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600,
              letterSpacing: '-0.04em', lineHeight: 1.1,
              color: T.text, marginBottom: 12,
            }}>
              Name your team.
            </h1>
            <p style={{ fontSize: 14, color: T.muted, marginBottom: 32, lineHeight: 1.65 }}>
              You can invite members after setup.
            </p>

            <input
              type="text"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="e.g. Beagle Security"
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '13px 16px',
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                fontFamily: T.font, fontSize: 14,
                color: T.text, outline: 'none',
                marginBottom: 12,
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
              onBlur={e => e.target.style.borderColor = T.border}
              onKeyDown={e => e.key === 'Enter' && teamName.trim() && finish('team', teamName.trim())}
            />

            {error && (
              <p style={{ fontFamily: T.mono, fontSize: 11, color: '#e07070', marginBottom: 12 }}>{error}</p>
            )}

            <button
              onClick={() => finish('team', teamName.trim())}
              disabled={!teamName.trim() || loading}
              style={{
                width: '100%', padding: '13px',
                background: teamName.trim() && !loading ? T.text : T.surface,
                border: `1px solid ${teamName.trim() && !loading ? T.text : T.border}`,
                borderRadius: 10,
                fontFamily: T.font, fontSize: 14, fontWeight: 600,
                color: teamName.trim() && !loading ? '#0b0b0b' : T.dim,
                cursor: teamName.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              {loading ? 'Setting up…' : 'Create team'}
            </button>

            <button
              onClick={() => setStep(1)}
              style={{
                background: 'none', border: 'none', marginTop: 16,
                fontFamily: T.mono, fontSize: 11, color: T.dim,
                cursor: 'pointer', padding: '4px 0', display: 'block',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = T.muted}
              onMouseLeave={e => e.currentTarget.style.color = T.dim}
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ModeCard({ title, desc, items, accent, onClick, loading, disabled }) {
  const [hovered, setHovered] = useState(false)

  const borderColor = accent
    ? hovered ? 'rgba(200,120,74,0.6)' : 'rgba(200,120,74,0.25)'
    : hovered ? 'rgba(255,255,255,0.2)' : T.border

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '28px 24px', borderRadius: 12,
        background: accent ? 'rgba(200,120,74,0.04)' : T.surface,
        border: `1px solid ${borderColor}`,
        textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'border-color 0.15s',
        opacity: disabled && !loading ? 0.5 : 1,
      }}
    >
      <p style={{
        fontFamily: T.font, fontSize: 15, fontWeight: 600,
        color: loading ? T.muted : T.text,
        marginBottom: 8, letterSpacing: '-0.02em',
      }}>
        {loading ? 'Setting up…' : title}
      </p>
      <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.65, marginBottom: 20 }}>
        {desc}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(item => (
          <li key={item} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: T.dim }}>
            <span style={{ color: accent ? T.accent : T.dim }}>—</span>
            {item}
          </li>
        ))}
      </ul>
    </button>
  )
}
