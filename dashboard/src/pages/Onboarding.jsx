import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

function RadarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="#a86448" strokeWidth="1.2" strokeOpacity="0.4" />
      <circle cx="10" cy="10" r="6" stroke="#a86448" strokeWidth="1.2" strokeOpacity="0.6" />
      <circle cx="10" cy="10" r="3" stroke="#a86448" strokeWidth="1.2" />
      <line x1="10" y1="10" x2="18" y2="10" stroke="#a86448" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="10" r="1.5" fill="#a86448" />
    </svg>
  )
}

export default function Onboarding() {
  const { user } = useAuth()
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
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '64px' }}>
        <RadarIcon />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: '600', color: '#fdfdfd', letterSpacing: '-0.02em' }}>sonar</span>
      </div>

      {step === 1 && (
        <div style={{ width: '100%', maxWidth: '520px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: '16px' }}>Welcome</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: '400', letterSpacing: '-0.04em', color: '#fdfdfd', marginBottom: '12px' }}>How will you use Sonar?</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '48px', lineHeight: 1.7 }}>You can upgrade from Solo to Team anytime.</p>

          <div style={{ display: 'flex', gap: '12px' }}>
            <ModeCard
              title="Solo"
              desc="Just me — building my own pipeline and prospecting independently."
              features={['Full enrichment', 'AI analysis', 'Lead management']}
              onClick={() => handleModeSelect('solo')}
              loading={loading && mode === 'solo'}
            />
            <ModeCard
              title="Team"
              desc="I'm building a team — I want to invite members and manage access."
              features={['Everything in Solo', 'Invite members', 'Admin controls']}
              accent
              onClick={() => handleModeSelect('team')}
              loading={loading && mode === 'team'}
            />
          </div>
          {error && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#e07070', marginTop: '16px' }}>{error}</p>}
        </div>
      )}

      {step === 2 && (
        <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: '16px' }}>Step 2 of 2</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: '400', letterSpacing: '-0.04em', color: '#fdfdfd', marginBottom: '12px' }}>Name your team.</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '40px', lineHeight: 1.7 }}>You can invite members after setup.</p>

          <input
            type="text"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="e.g. Beagle Security"
            autoFocus
            style={{
              width: '100%', padding: '14px 16px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
              fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#fdfdfd',
              outline: 'none', boxSizing: 'border-box', marginBottom: '16px',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(168,100,72,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            onKeyDown={e => e.key === 'Enter' && teamName.trim() && finish('team', teamName.trim())}
          />

          {error && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#e07070', marginBottom: '12px' }}>{error}</p>}

          <button
            onClick={() => finish('team', teamName.trim())}
            disabled={!teamName.trim() || loading}
            style={{
              width: '100%', padding: '14px', borderRadius: '10px',
              background: teamName.trim() ? '#a86448' : 'rgba(255,255,255,0.06)',
              border: 'none', fontFamily: 'var(--font-mono)', fontSize: '13px',
              fontWeight: '600', color: teamName.trim() ? '#fdfdfd' : 'rgba(255,255,255,0.3)',
              cursor: teamName.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {loading ? 'Setting up…' : 'Create team →'}
          </button>

          <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', marginTop: '16px' }}>
            ← Back
          </button>
        </div>
      )}
    </div>
  )
}

function ModeCard({ title, desc, features, accent, onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        flex: 1, padding: '28px 24px', borderRadius: '12px', cursor: 'pointer',
        background: accent ? 'rgba(168,100,72,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${accent ? 'rgba(168,100,72,0.3)' : 'rgba(255,255,255,0.08)'}`,
        textAlign: 'left', transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = accent ? 'rgba(168,100,72,0.1)' : 'rgba(255,255,255,0.06)'
        e.currentTarget.style.borderColor = accent ? 'rgba(168,100,72,0.5)' : 'rgba(255,255,255,0.18)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = accent ? 'rgba(168,100,72,0.06)' : 'rgba(255,255,255,0.03)'
        e.currentTarget.style.borderColor = accent ? 'rgba(168,100,72,0.3)' : 'rgba(255,255,255,0.08)'
      }}
    >
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600', color: accent ? '#a86448' : '#e7e7e7', marginBottom: '10px' }}>
        {loading ? 'Setting up…' : title}
      </p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: '20px' }}>{desc}</p>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {features.map(f => (
          <li key={f} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: '#a86448', fontSize: '10px' }}>✓</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{f}</span>
          </li>
        ))}
      </ul>
    </button>
  )
}
