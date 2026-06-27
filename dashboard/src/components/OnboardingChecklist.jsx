import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const MONO    = "'IBM Plex Mono', monospace"
const DISPLAY = "var(--font-display, 'Barlow Condensed', sans-serif)"

const STEPS = [
  { id: 'account',   label: 'Create your account',    desc: 'You\'re in.',                                               path: null,         always: true },
  { id: 'company',   label: 'Add your first company', desc: 'Track a target account.',                                   path: '/companies', action: 'Add Company' },
  { id: 'lead',      label: 'Add your first lead',    desc: 'Find and save a contact.',                                  path: '/leads',     action: 'Add Lead' },
  { id: 'sequence',  label: 'Create a sequence',      desc: 'Build an automated outreach campaign.',                     path: '/sequences', action: 'New Sequence' },
  { id: 'email_sent',label: 'Send your first email',  desc: 'Enroll a lead and fire the first step.',                    path: '/sequences', action: 'View Sequences' },
]

export default function OnboardingChecklist({ data, loading }) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('onboarding_dismissed') === '1')

  const L = data?.leads     || {}
  const S = data?.sequences || {}
  const C = data?.companies || {}

  const completed = {
    account:    true,
    company:    (C.total || 0) > 0,
    lead:       (L.total || 0) > 0,
    sequence:   (S.emails_sent || 0) > 0 || (S.active_enrollments || 0) > 0,
    email_sent: (S.emails_sent || 0) > 0,
  }

  const doneCount  = Object.values(completed).filter(Boolean).length
  const totalSteps = STEPS.length
  const allDone    = doneCount === totalSteps

  function dismiss() {
    localStorage.setItem('onboarding_dismissed', '1')
    setDismissed(true)
  }

  // Auto-dismiss once everything is complete (with a short delay)
  useEffect(() => {
    if (allDone && !dismissed) {
      const t = setTimeout(() => {
        localStorage.setItem('onboarding_dismissed', '1')
        setDismissed(true)
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [allDone, dismissed])

  if (dismissed || loading) return null

  const pct = Math.round((doneCount / totalSteps) * 100)

  return (
    <div style={{
      margin: '16px 36px 0',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '0.02em' }}>
                {allDone ? '🎉 Setup complete' : 'Get started'}
              </p>
              <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)' }}>{doneCount} of {totalSteps} steps</span>
            </div>
            {/* Progress bar */}
            <div style={{ width: 180, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: allDone ? '#059669' : '#E7000B', borderRadius: 2, transition: 'width 0.5s ease' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={e => { e.stopPropagation(); dismiss() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, fontFamily: MONO, padding: '2px 6px' }}
          >
            {allDone ? 'Dismiss' : 'Hide'}
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 14, fontFamily: MONO }}>
            {collapsed ? '›' : '‹'}
          </span>
        </div>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div style={{ borderTop: '1px solid var(--border)', display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {STEPS.map((step, i) => {
            const done = completed[step.id]
            return (
              <div
                key={step.id}
                style={{
                  flex: 1, minWidth: 140, padding: '14px 16px',
                  borderRight: i < STEPS.length - 1 ? '1px solid var(--border)' : 'none',
                  opacity: done ? 0.65 : 1,
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                {/* Step number / checkmark */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: done ? 'rgba(5,150,105,0.12)' : 'rgba(231,0,11,0.08)',
                    border: `1.5px solid ${done ? 'rgba(5,150,105,0.3)' : 'rgba(231,0,11,0.25)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: MONO, fontSize: 9, fontWeight: 700,
                    color: done ? '#059669' : '#E7000B',
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: done ? 'var(--text-muted)' : 'var(--text)', margin: 0, lineHeight: 1.3 }}>
                    {step.label}
                  </p>
                </div>
                <p style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  {step.desc}
                </p>
                {!done && step.path && (
                  <button
                    onClick={() => navigate(step.path)}
                    style={{
                      marginTop: 4, padding: '5px 10px', alignSelf: 'flex-start',
                      background: 'none', border: '1px solid var(--border)', borderRadius: 5,
                      fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)',
                      cursor: 'pointer', letterSpacing: '0.04em',
                    }}
                  >
                    {step.action} →
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
