import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { listEnrollments, unenrollLead, markReplied, getSequenceAnalytics, getSequenceSendStats, listSequenceTemplates, createFromTemplate, generateIcebreaker } from '../services/api'

const STEP_TYPES = [
  { id: 'email',    label: 'Email'    },
  { id: 'wait',     label: 'Wait'     },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'call',     label: 'Call'     },
]

const STATUS_COLOR = { draft: '#888', active: '#4a7c59', paused: '#b07d2e' }
const STATUS_BG    = { draft: '#88888818', active: '#4a7c5918', paused: '#b07d2e18' }

function VariantLabel({ letter, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, marginTop: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', padding: '2px 7px', borderRadius: 3, background: color + '18', border: `1px solid ${color}40`, color }}>
        VARIANT {letter}
      </span>
    </div>
  )
}

const PREVIEW_LEAD = { name: 'Sarah Chen', first_name: 'Sarah', company: 'Acme Corp', title: 'VP of Sales', cal_link: 'https://cal.com/you/15min' }

function previewText(text) {
  return (text || '')
    .replace(/\{\{name\}\}/g, PREVIEW_LEAD.name)
    .replace(/\{\{first_name\}\}/g, PREVIEW_LEAD.first_name)
    .replace(/\{\{company\}\}/g, PREVIEW_LEAD.company)
    .replace(/\{\{title\}\}/g, PREVIEW_LEAD.title)
    .replace(/\{\{cal_link\}\}/g, PREVIEW_LEAD.cal_link)
}

function StepCard({ step, index, onChange, onRemove }) {
  const [previewMode, setPreviewMode]       = useState(false)
  const [showTplPicker, setShowTplPicker]   = useState(false)
  const [tplList, setTplList]               = useState([])
  const [tplLoading, setTplLoading]         = useState(false)
  const abEnabled = step.subject_b !== undefined && step.subject_b !== null

  function toggleAB() {
    if (abEnabled) {
      onChange({ ...step, subject_b: null, body_b: null })
    } else {
      onChange({ ...step, subject_b: '', body_b: '' })
    }
  }

  async function openTplPicker() {
    setShowTplPicker(true)
    if (tplList.length === 0) {
      setTplLoading(true)
      try { const r = await api.get('/email-templates'); setTplList(r.data?.templates || []) } catch {}
      setTplLoading(false)
    }
  }

  function applyTemplate(tpl) {
    onChange({ ...step, subject: tpl.subject || step.subject, body: tpl.body })
    setShowTplPicker(false)
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{index + 1}</div>
        {index < 99 && <div style={{ width: 1, height: 24, background: 'var(--border)' }} />}
      </div>
      <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {STEP_TYPES.map(t => (
            <button key={t.id} onClick={() => onChange({ ...step, type: t.id })}
              style={{ padding: '5px 12px', borderRadius: 6, border: step.type === t.id ? '1.5px solid #E7000B' : '1px solid var(--border)', background: step.type === t.id ? '#E7000B18' : 'transparent', color: step.type === t.id ? '#E7000B' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {step.type === 'email' && (
            <button onClick={toggleAB} style={{ padding: '5px 10px', borderRadius: 6, border: abEnabled ? '1.5px solid #b07d2e' : '1px solid var(--border)', background: abEnabled ? '#b07d2e18' : 'transparent', color: abEnabled ? '#b07d2e' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              A/B Test
            </button>
          )}
          {step.type === 'email' && (
            <button onClick={openTplPicker} style={{ padding: '5px 10px', borderRadius: 6, border: showTplPicker ? '1.5px solid #059669' : '1px solid var(--border)', background: showTplPicker ? '#05966918' : 'transparent', color: showTplPicker ? '#059669' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              Templates
            </button>
          )}
          {step.type === 'email' && (
            <button onClick={() => setPreviewMode(p => !p)} style={{ padding: '5px 10px', borderRadius: 6, border: previewMode ? '1.5px solid #5b8db8' : '1px solid var(--border)', background: previewMode ? '#5b8db818' : 'transparent', color: previewMode ? '#5b8db8' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {previewMode ? 'Edit' : 'Preview'}
            </button>
          )}
          <button onClick={onRemove} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Remove</button>
        </div>

        {showTplPicker && step.type === 'email' && (
          <div style={{ marginBottom: 12, background: 'var(--bg)', border: '1px solid #05966940', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email Templates</span>
              <button onClick={() => setShowTplPicker(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
            </div>
            {tplLoading ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
            ) : tplList.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>No saved templates yet. Create them in Settings → Email Templates.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {tplList.map(tpl => (
                  <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                    style={{ textAlign: 'left', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#059669'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{tpl.name}</div>
                    {tpl.subject && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Subject: {tpl.subject}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step.type === 'wait' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Wait</span>
            <input type="number" min={1} max={30} value={step.delay_days}
              onChange={e => onChange({ ...step, delay_days: parseInt(e.target.value) || 1 })}
              style={{ width: 60, padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>days before next step</span>
          </div>
        ) : (
          previewMode && step.type === 'email' ? (
            <div style={{ background: 'var(--bg)', border: '1px solid #5b8db840', borderRadius: 8, padding: 16 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5b8db8', marginBottom: 10 }}>
                Preview for Sarah Chen · VP of Sales · Acme Corp
              </div>
              {step.subject && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  {previewText(step.subject)}
                </div>
              )}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {previewText(step.body)}
              </div>
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {step.type === 'email' && abEnabled && <VariantLabel letter="A" color="#4a7c59" />}
            {step.type === 'email' && (
              <input type="text" placeholder="Subject line…" value={step.subject || ''}
                onChange={e => onChange({ ...step, subject: e.target.value })}
                style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
            )}
            <textarea rows={step.type === 'email' ? 5 : 3}
              placeholder={step.type === 'email' ? 'Email body… Use {{name}}, {{company}}, {{title}}, {{cal_link}} for personalization.' : step.type === 'linkedin' ? 'LinkedIn message…' : 'Call notes or script…'}
              value={step.body || ''}
              onChange={e => onChange({ ...step, body: e.target.value })}
              style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />

            {step.type === 'email' && abEnabled && (
              <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
                <VariantLabel letter="B" color="#b07d2e" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input type="text" placeholder="Subject line B… (leave blank to use Subject A)"
                    value={step.subject_b || ''}
                    onChange={e => onChange({ ...step, subject_b: e.target.value })}
                    style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
                  <textarea rows={5}
                    placeholder="Email body B…"
                    value={step.body_b || ''}
                    onChange={e => onChange({ ...step, body_b: e.target.value })}
                    style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
                </div>
              </div>
            )}

            {step.type !== 'wait' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Send after</span>
                <input type="number" min={0} max={30} value={step.delay_days}
                  onChange={e => onChange({ ...step, delay_days: parseInt(e.target.value) || 0 })}
                  style={{ width: 50, padding: '4px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', outline: 'none' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>days</span>
              </div>
            )}
          </div>
          )
        )}
      </div>
    </div>
  )
}

const STATUS_DOT   = { active: '#4a7c59', completed: '#0082F3', paused: '#b07d2e', bounced: '#e07070', replied: '#9b59b6', unsubscribed: '#888' }
const STATUS_LABEL = { active: 'ACTIVE', completed: 'DONE', bounced: 'BOUNCED', replied: 'REPLIED', unsubscribed: 'UNSUB', paused: 'PAUSED' }

function AnalyticsBadge({ label, value, sub, color }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 60 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: color || 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: color || 'var(--text-muted)', fontWeight: 600 }}>{sub}</div>}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function EnrollmentPanel({ seq }) {
  const [tab, setTab]           = useState('enrollments') // 'enrollments' | 'analytics'
  const [open, setOpen]         = useState(false)
  const [enrollments, setEnrollments] = useState([])
  const [analytics, setAnalytics]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const totalSteps = seq.steps?.length || 1

  async function load() {
    setLoading(true)
    try {
      const [enrRes, anRes] = await Promise.all([
        listEnrollments(seq.id),
        getSequenceAnalytics(seq.id),
      ])
      setEnrollments(enrRes.data.enrollments || [])
      setAnalytics(anRes.data)
    } catch { } finally { setLoading(false) }
  }

  function toggle() {
    if (!open) load()
    setOpen(o => !o)
  }

  async function handleUnenroll(enrollmentId) {
    if (!confirm('Remove this lead from the sequence?')) return
    await unenrollLead(seq.id, enrollmentId)
    setEnrollments(e => e.filter(x => x.id !== enrollmentId))
  }

  async function handleReply(enrollmentId) {
    await markReplied(seq.id, enrollmentId)
    setEnrollments(e => e.map(x => x.id === enrollmentId ? { ...x, status: 'replied' } : x))
  }

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <button onClick={toggle} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9 }}>{open ? '▼' : '▶'}</span>
        {open ? 'Hide' : 'View'} analytics & leads ({seq.enrolled_count || 0} enrolled)
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          {loading ? (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Loading…</p>
          ) : (
            <>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                {['analytics', 'enrollments'].map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{ padding: '5px 12px', borderRadius: 6, border: tab === t ? '1.5px solid var(--accent)' : '1px solid var(--border)', background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#fff' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
                    {t}
                  </button>
                ))}
              </div>

              {tab === 'analytics' && analytics && (
                <div>
                  {/* Top metrics row */}
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '16px 20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 14 }}>
                    <AnalyticsBadge label="Sent" value={analytics.emails_sent} />
                    <AnalyticsBadge label="Open Rate" value={`${analytics.open_rate}%`} sub={`${analytics.unique_opens} opens`} color={analytics.open_rate > 20 ? '#4a7c59' : undefined} />
                    <AnalyticsBadge label="Click Rate" value={`${analytics.click_rate}%`} sub={`${analytics.unique_clicks} clicks`} color={analytics.click_rate > 5 ? '#0082F3' : undefined} />
                    <AnalyticsBadge label="Replied" value={analytics.replied} sub={`${analytics.reply_rate}%`} color="#9b59b6" />
                    <AnalyticsBadge label="Bounced" value={analytics.bounced} sub={`${analytics.bounce_rate}%`} color={analytics.bounced > 0 ? '#e07070' : undefined} />
                    <AnalyticsBadge label="Unsub" value={analytics.unsubscribed} />
                    <AnalyticsBadge label="Completed" value={analytics.completed} />
                  </div>

                  {/* Per-step breakdown */}
                  {analytics.steps?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 4px' }}>Step Breakdown</p>
                      {analytics.steps.map(step => (
                        <div key={step.step_number} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                          {/* Summary row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px' }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{step.step_number}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {step.type === 'email' ? (step.subject || '(no subject)') : step.type}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{step.sent} sent</span>
                              {step.type === 'email' && <>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: step.open_rate > 0 ? '#4a7c59' : 'var(--text-muted)' }}>{step.open_rate}% open</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: step.click_rate > 0 ? '#0082F3' : 'var(--text-muted)' }}>{step.click_rate}% click</span>
                              </>}
                              {step.ab && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#b07d2e18', border: '1px solid #b07d2e40', color: '#b07d2e' }}>A/B</span>}
                            </div>
                          </div>
                          {/* A/B comparison table */}
                          {step.ab && step.type === 'email' && (
                            <div style={{ borderTop: '1px dashed var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                              {[['A', '#4a7c59'], ['B', '#b07d2e']].map(([v, color]) => {
                                const vd = step.ab[v] || {}
                                return (
                                  <div key={v} style={{ padding: '8px 14px', borderRight: v === 'A' ? '1px dashed var(--border)' : 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: color + '18', border: `1px solid ${color}40`, color }}>VARIANT {v}</span>
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{vd.sent || 0} sent</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: vd.open_rate > 0 ? '#4a7c59' : 'var(--text-muted)' }}>{vd.open_rate || 0}% open</span>
                                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: vd.click_rate > 0 ? '#0082F3' : 'var(--text-muted)' }}>{vd.click_rate || 0}% click</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'enrollments' && (
                enrollments.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>No leads enrolled yet. Enroll from the Leads page.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {enrollments.map(enr => {
                      const lead    = enr.leads || {}
                      const stepN   = enr.current_step || 1
                      const progress= Math.min(100, Math.round((stepN - 1) / totalSteps * 100))
                      const nextRun = enr.next_run_at ? new Date(enr.next_run_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + new Date(enr.next_run_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'
                      return (
                        <div key={enr.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_DOT[enr.status] || '#888', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {lead.name || lead.email || 'Unknown'}
                              {lead.company && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {lead.company}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                              <div style={{ width: 80, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                                <div style={{ height: '100%', width: `${progress}%`, background: STATUS_DOT[enr.status] || '#4a7c59', borderRadius: 2 }} />
                              </div>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Step {stepN}/{totalSteps}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: STATUS_DOT[enr.status] || 'var(--text-muted)' }}>{STATUS_LABEL[enr.status] || enr.status?.toUpperCase()}</span>
                              {enr.reply_sentiment && enr.status === 'replied' && (() => {
                                const SM = { interested: ['★ INTERESTED','#4a7c59','rgba(74,124,89,0.12)'], not_interested: ['✗ NOT INTERESTED','#e07070','rgba(239,68,68,0.1)'], ooo: ['✈ OOO','#ca8a04','rgba(234,179,8,0.1)'], wrong_person: ['⟳ WRONG PERSON','var(--text-muted)','var(--surface)'] }
                                const [lbl, c, bg] = SM[enr.reply_sentiment] || []
                                return lbl ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: bg, color: c, letterSpacing: '0.04em' }}>{lbl}</span> : null
                              })()}
                              {enr.ab_variant && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: enr.ab_variant === 'A' ? '#4a7c5918' : '#b07d2e18', border: `1px solid ${enr.ab_variant === 'A' ? '#4a7c5940' : '#b07d2e40'}`, color: enr.ab_variant === 'A' ? '#4a7c59' : '#b07d2e' }}>V{enr.ab_variant}</span>}
                              {enr.status === 'active' && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>Next: {nextRun}</span>}
                              {enr.status === 'paused' && enr.ooo_resume_at && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ca8a04' }}>OOO — resumes {new Date(enr.ooo_resume_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                              {enr.status === 'replied' && enr.replied_at && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>Replied {new Date(enr.replied_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                            </div>
                            {enr.last_error && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#e07070', marginTop: 3 }}>{enr.last_error}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {enr.status === 'active' && (
                              <button onClick={() => handleReply(enr.id)} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 8px', background: 'transparent', border: '1px solid #9b59b6', borderRadius: 5, color: '#9b59b6', cursor: 'pointer' }}>
                                Replied
                              </button>
                            )}
                            <button onClick={() => handleUnenroll(enr.id)} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', cursor: 'pointer' }}>
                              Remove
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SequenceCard({ seq, onEdit, onDelete, onToggle, onClone }) {
  const [cloning, setCloning] = useState(false)

  async function handleClone() {
    setCloning(true)
    try { await onClone(seq.id) } finally { setCloning(false) }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{seq.name}</span>
            <span style={{ padding: '2px 8px', borderRadius: 20, background: STATUS_BG[seq.status], color: STATUS_COLOR[seq.status], fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{seq.status}</span>
          </div>
          {seq.description && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{seq.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onToggle(seq)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>
            {seq.status === 'active' ? 'Pause' : 'Activate'}
          </button>
          <button onClick={handleClone} disabled={cloning} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: cloning ? 'default' : 'pointer', opacity: cloning ? 0.6 : 1 }}>
            {cloning ? '…' : 'Clone'}
          </button>
          <button onClick={() => onEdit(seq)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Edit</button>
          <button onClick={() => onDelete(seq.id)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: '#e07070', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Delete</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {(seq.steps || []).map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--bg)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              {step.type === 'wait' ? `Wait ${step.delay_days}d` : STEP_TYPES.find(t => t.id === step.type)?.label || step.type}
              {step.subject_b && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 2, background: '#b07d2e18', color: '#b07d2e' }}>A/B</span>}
            </span>
            {i < seq.steps.length - 1 && <span style={{ color: 'var(--border)', fontSize: 10 }}>→</span>}
          </div>
        ))}
        {(!seq.steps || seq.steps.length === 0) && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>No steps yet</span>}
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Steps',     value: seq.steps?.length || 0,   color: 'var(--text)' },
          { label: 'Enrolled',  value: seq.enrolled_count || 0,  color: 'var(--text)' },
          { label: 'Active',    value: seq.active_count || 0,    color: '#4a7c59' },
          { label: 'Replied',   value: seq.replied_count || 0,   color: seq.replied_count > 0 ? '#9b59b6' : 'var(--text-muted)' },
          { label: 'Bounced',   value: seq.bounced_count || 0,   color: seq.bounced_count > 0 ? '#e07070' : 'var(--text-muted)' },
          { label: 'Completed', value: seq.completed_count || 0, color: seq.completed_count > 0 ? '#0082F3' : 'var(--text-muted)' },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{m.label}</div>
          </div>
        ))}
      </div>

      <EnrollmentPanel seq={seq} />
    </div>
  )
}

const BLANK_STEP = { type: 'email', delay_days: 0, subject: '', body: '' }

const SEQUENCE_TEMPLATES = [
  {
    name: 'Cold Outreach (3-touch)',
    description: 'Classic cold email sequence with follow-ups',
    steps: [
      { type: 'email', delay_days: 0, subject: 'Quick question, {{first_name}}', body: 'Hi {{first_name}},\n\nI came across {{company}} and was impressed by what you\'re building.\n\nWe help companies like yours [key benefit]. I\'d love to show you how we\'ve helped similar teams.\n\nWould you be open to a quick 15-minute call this week?\n\nBest,\n[Your name]' },
      { type: 'email', delay_days: 3, subject: 'Re: Quick question, {{first_name}}', body: 'Hi {{first_name}},\n\nJust following up on my previous email — did this land in the right place?\n\nI know you\'re busy, so I\'ll keep it short: [one-line value prop].\n\nWorth a 15-minute conversation?\n\n[Your name]' },
      { type: 'email', delay_days: 7, subject: 'Closing the loop', body: 'Hi {{first_name}},\n\nI\'ve reached out a couple of times about [topic] and haven\'t heard back — I completely understand if the timing isn\'t right.\n\nIf you\'d ever like to revisit this in the future, feel free to reach out. I\'ll leave you alone for now!\n\n[Your name]' },
    ],
  },
  {
    name: 'SaaS Demo Request (5-touch)',
    description: 'Nurture sequence to book a demo',
    steps: [
      { type: 'email', delay_days: 0, subject: 'How {{company}} can [outcome]', body: 'Hi {{first_name}},\n\nI noticed {{company}} is [observation about their business]. Companies in your space typically struggle with [pain point].\n\nWe built [product] specifically to solve this — [key metric/result].\n\nI\'d love to show you a quick demo tailored to {{company}}. Are you free for 20 minutes this week?\n\n[Your name]' },
      { type: 'email', delay_days: 2, subject: 'Case study: [Company] achieved [result]', body: 'Hi {{first_name}},\n\nFollowing up with something concrete — [similar company] used [product] to achieve [specific result] in [timeframe].\n\nI think we could do the same for {{company}}.\n\nHappy to send over the full case study — want me to?\n\n[Your name]' },
      { type: 'linkedin', delay_days: 4, subject: '', body: 'Hi {{first_name}}, sent you an email about [topic]. Would love to connect here too.' },
      { type: 'email', delay_days: 7, subject: 'Still thinking about it?', body: 'Hi {{first_name}},\n\nI know decisions like this take time. A few things that might help:\n\n• [Benefit 1]\n• [Benefit 2]\n• [Benefit 3]\n\nHappy to answer any questions or set up a no-pressure call.\n\n[Your name]' },
      { type: 'email', delay_days: 5, subject: 'Last one from me', body: 'Hi {{first_name}},\n\nI\'ll make this my last email so I\'m not cluttering your inbox.\n\nIf [problem] is ever a priority and you\'d like to see how [product] can help, my calendar is always open: [link]\n\nWishing {{company}} all the best,\n[Your name]' },
    ],
  },
  {
    name: 'Re-engagement (2-touch)',
    description: 'Win back cold or inactive leads',
    steps: [
      { type: 'email', delay_days: 0, subject: 'Checking in, {{first_name}}', body: 'Hi {{first_name}},\n\nWe spoke a while back about [topic] and I wanted to check in.\n\nA lot has changed on our end — [new feature/development]. Given what you\'re building at {{company}}, I think the timing might be better now.\n\nWould you be open to a quick reconnect?\n\n[Your name]' },
      { type: 'email', delay_days: 5, subject: 'Worth another look?', body: 'Hi {{first_name}},\n\nJust following up one last time. If the timing isn\'t right, completely fine — I just wanted to make sure you had a chance to see [specific update].\n\nIf things ever change at {{company}}, I\'m here.\n\n[Your name]' },
    ],
  },
]

export default function Sequences() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [sequences, setSequences] = useState([])
  const [loading, setLoading] = useState(true)
  const [sendStats, setSendStats] = useState(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [serverTemplates, setServerTemplates] = useState([])
  const [tplLoading, setTplLoading] = useState(false)
  const [tplCreating, setTplCreating] = useState('')
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiForm, setAiForm] = useState({ product: '', persona: '', tone: 'professional', num_steps: 3 })
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', steps: [{ ...BLANK_STEP }] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [token])

  async function load() {
    try {
      setLoading(true)
      const [res, statsRes] = await Promise.all([
        api.get('/sequences'),
        getSequenceSendStats().catch(() => null),
      ])
      setSequences(res.data.sequences || [])
      if (statsRes) setSendStats(statsRes.data)
    } catch {
      setError('Failed to load sequences')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', description: '', steps: [{ ...BLANK_STEP }] })
    setShowBuilder(true)
  }

  function openEdit(seq) {
    setEditing(seq)
    setForm({ name: seq.name, description: seq.description || '', steps: seq.steps?.length ? seq.steps : [{ ...BLANK_STEP }] })
    setShowBuilder(true)
  }

  async function handleAiDraft(e) {
    e.preventDefault()
    if (!aiForm.product.trim()) return
    setAiLoading(true)
    setAiError('')
    try {
      const res = await api.post('/sequences/ai-draft', aiForm)
      const steps = res.data.steps || []
      setForm(f => ({ ...f, steps }))
      setShowAiModal(false)
    } catch (err) {
      setAiError(err?.response?.data?.detail || 'AI draft failed — try again.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/sequences/${editing.id}`, form)
      } else {
        await api.post('/sequences', form)
      }
      setShowBuilder(false)
      await load()
    } catch {
      setError('Failed to save sequence')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this sequence?')) return
    await api.delete(`/sequences/${id}`)
    await load()
  }

  async function handleClone(id) {
    await api.post(`/sequences/${id}/clone`)
    await load()
  }

  async function handleToggle(seq) {
    const next = seq.status === 'active' ? 'paused' : 'active'
    if (next === 'active') {
      // Pre-flight checks before activating
      const warnings = []
      if (!seq.steps || seq.steps.filter(s => s.type === 'email').length === 0) {
        warnings.push('This sequence has no email steps.')
      }
      if (seq.enrolled_count === 0) {
        warnings.push('No leads are enrolled. Enroll leads first.')
      }
      if (sendStats && sendStats.remaining === 0) {
        warnings.push(`Daily send limit reached (${sendStats.daily_limit}/day). Emails will send tomorrow.`)
      }
      if (warnings.length > 0 && !confirm(`Before activating:\n\n${warnings.map(w => '⚠ ' + w).join('\n')}\n\nContinue anyway?`)) {
        return
      }
    }
    await api.patch(`/sequences/${seq.id}`, { status: next })
    await load()
  }

  function updateStep(i, val) {
    const steps = [...form.steps]
    steps[i] = val
    setForm(f => ({ ...f, steps }))
  }

  function removeStep(i) {
    setForm(f => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }))
  }

  function addStep() {
    setForm(f => ({ ...f, steps: [...f.steps, { ...BLANK_STEP }] }))
  }

  const s = {
    page: { minHeight: '100vh', background: 'var(--bg)' },
    inner: { maxWidth: 900, margin: '0 auto', padding: '40px 24px' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
    title: { fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 },
    subtitle: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 },
    btn: { padding: '10px 20px', background: '#E7000B', border: 'none', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' },
    input: { width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' },
    label: { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 },
  }

  if (showBuilder) {
    return (
      <div style={s.page}>
        <div style={{ ...s.inner, maxWidth: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setShowBuilder(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', padding: 0 }}>← Back</button>
              <h1 style={{ ...s.title, margin: 0 }}>{editing ? 'Edit Sequence' : 'New Sequence'}</h1>
            </div>
            {!editing && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setShowAiModal(true)} style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fff', cursor: 'pointer', letterSpacing: '0.05em', fontWeight: 600 }}>
                  ✦ AI Draft
                </button>
                <button type="button" onClick={async () => {
                  setShowTemplateModal(true)
                  if (serverTemplates.length === 0) {
                    setTplLoading(true)
                    try { const r = await listSequenceTemplates(); setServerTemplates(r.data.templates || []) } catch {}
                    setTplLoading(false)
                  }
                }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', letterSpacing: '0.05em' }}>
                  Start from template
                </button>
              </div>
            )}
          </div>

          {showTemplateModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={e => { if (e.target === e.currentTarget) setShowTemplateModal(false) }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: 580, maxHeight: '82vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Sequence Templates</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>One click to create — all steps pre-written, ready to customize.</div>
                  </div>
                  <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                </div>
                {tplLoading ? (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Loading templates…</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {serverTemplates.map(tpl => (
                      <div key={tpl.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tpl.name}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 6px' }}>{tpl.steps.length} steps</span>
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{tpl.description}</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {tpl.tags.map(t => (
                              <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{t}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                          <button onClick={async () => {
                            setTplCreating(tpl.id)
                            try {
                              await createFromTemplate(tpl.id)
                              await load()
                              setShowTemplateModal(false)
                            } catch { alert('Failed to create sequence from template') }
                            setTplCreating('')
                          }} disabled={!!tplCreating} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '8px 14px', background: tplCreating === tpl.id ? '#4a7c59' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: tplCreating ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                            {tplCreating === tpl.id ? 'Creating…' : 'Use template'}
                          </button>
                          <button onClick={() => {
                            setForm({ name: tpl.name, description: tpl.description || '', steps: tpl.steps.map(s => ({ ...s })) })
                            setShowTemplateModal(false)
                            setShowBuilder(true)
                          }} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '6px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Customize
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {showAiModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={e => { if (e.target === e.currentTarget) setShowAiModal(false) }}>
              <div style={{ background: 'var(--surface)', border: '1px solid #7c3aed40', borderRadius: 16, padding: 32, width: 500 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>✦ AI Sequence Draft</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Generate a complete sequence with AI</div>
                  </div>
                  <button onClick={() => setShowAiModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                </div>
                <form onSubmit={handleAiDraft} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ ...s.label, display: 'block', marginBottom: 6 }}>What does your product do?</label>
                    <textarea rows={3} required value={aiForm.product} onChange={e => setAiForm(f => ({ ...f, product: e.target.value }))}
                      placeholder="e.g. Sonar helps sales teams find verified B2B leads and automate cold email outreach with personalized sequences."
                      style={{ ...s.input, width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ ...s.label, display: 'block', marginBottom: 6 }}>Target persona</label>
                    <input value={aiForm.persona} onChange={e => setAiForm(f => ({ ...f, persona: e.target.value }))}
                      placeholder="e.g. VP of Sales at Series A–C SaaS companies in the US"
                      style={{ ...s.input, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...s.label, display: 'block', marginBottom: 6 }}>Tone</label>
                      <select value={aiForm.tone} onChange={e => setAiForm(f => ({ ...f, tone: e.target.value }))}
                        style={{ ...s.input, width: '100%', boxSizing: 'border-box' }}>
                        <option value="professional">Professional</option>
                        <option value="casual and direct">Casual & Direct</option>
                        <option value="bold and provocative">Bold & Provocative</option>
                        <option value="warm and empathetic">Warm & Empathetic</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...s.label, display: 'block', marginBottom: 6 }}>Steps</label>
                      <select value={aiForm.num_steps} onChange={e => setAiForm(f => ({ ...f, num_steps: parseInt(e.target.value) }))}
                        style={{ ...s.input, width: '100%', boxSizing: 'border-box' }}>
                        <option value={2}>2 emails</option>
                        <option value={3}>3 emails</option>
                        <option value={4}>4 emails</option>
                        <option value={5}>5 emails</option>
                      </select>
                    </div>
                  </div>
                  {aiError && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e07070' }}>{aiError}</div>}
                  <button type="submit" disabled={aiLoading} style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', borderRadius: 8, padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fff', cursor: aiLoading ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: aiLoading ? 0.7 : 1 }}>
                    {aiLoading ? 'Generating…' : '✦ Generate sequence'}
                  </button>
                </form>
              </div>
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 2 }}>
                <label style={s.label}>Sequence name</label>
                <input style={s.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cold Outreach — Series B SaaS" required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Description (optional)</label>
                <input style={s.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Target audience, goal…" />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <label style={{ ...s.label, margin: 0 }}>Steps ({form.steps.length})</label>
                <button type="button" onClick={addStep} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', cursor: 'pointer' }}>+ Add step</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.steps.map((step, i) => (
                  <StepCard key={i} step={step} index={i} onChange={v => updateStep(i, v)} onRemove={() => removeStep(i)} />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" disabled={saving} style={{ ...s.btn, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save sequence'}</button>
              <button type="button" onClick={() => setShowBuilder(false)} style={{ ...s.btn, background: 'var(--surface)', color: 'var(--text)' }}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Sequences</h1>
            <p style={s.subtitle}>Multi-step outreach campaigns — email, LinkedIn, calls</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {sendStats && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', background: 'var(--surface)', border: `1px solid ${sendStats.remaining === 0 ? '#e07070' : sendStats.remaining < 10 ? '#b07d2e40' : 'var(--border)'}`, borderRadius: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: sendStats.remaining === 0 ? '#e07070' : sendStats.remaining < 10 ? '#b07d2e' : '#4a7c59', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                  <span style={{ color: sendStats.remaining === 0 ? '#e07070' : 'var(--text)', fontWeight: 600 }}>{sendStats.sent_today}</span>
                  <span>/{sendStats.daily_limit} emails today</span>
                </span>
              </div>
            )}
            <button style={s.btn} onClick={openNew}>+ New sequence</button>
          </div>
        </div>

        {error && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#e07070', marginBottom: 16 }}>{error}</p>}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2].map(i => <div key={i} style={{ height: 140, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', opacity: 0.5 }} />)}
          </div>
        ) : sequences.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16, color: 'var(--border)' }}>—</div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>No sequences yet. Create your first outreach campaign.</p>
            <button style={s.btn} onClick={openNew}>Create sequence</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sequences.map(seq => (
              <SequenceCard key={seq.id} seq={seq} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggle} onClone={handleClone} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
