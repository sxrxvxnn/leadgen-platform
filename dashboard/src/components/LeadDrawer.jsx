import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { scoreLeadICP, draftEmail, updateLead, deleteLead, starLead, updateConnectionStatus, getLeadSignals, trackEmail, logActivity, getTemplates, createTemplate } from '../services/api'
import CompanySignals from './CompanySignals'
import EmailTimeline from './EmailTimeline'
import ActivityFeed from './ActivityFeed'
import TaskList from './TaskList'

const SANS    = "var(--font-sans, 'Host Grotesk', sans-serif)"
const MONO    = "var(--font-mono, 'IBM Plex Mono', monospace)"
const DISPLAY = "var(--font-display, 'Barlow Condensed', sans-serif)"

const STATUS_OPTIONS      = ['new', 'contacted', 'qualified', 'disqualified']
const CONNECTION_STATUSES = [
  'Not Requested','Connection Request Sent','First Message Sent',
  'Follow-up 1','Follow-up 2','Follow-up 3','Connected',
  'Not Interested','No Response','Transferred to Rahul','Transferred to Rejah',
]

const DECISION_MAKER_RE = /\b(ceo|cto|ciso|coo|cfo|founder|co-founder|cofounder|president|vice president|vp|director|head of|chief|managing director|md|partner|principal|owner|general manager|gm|svp|evp|senior vice|senior director)\b/i
const SECURITY_RE       = /\b(ciso|chief information security|cybersecurity|infosec|information security officer|grc|vapt|penetration tester|vulnerability|security analyst|security engineer|security architect|security manager|security director|soc analyst|devsecops|cloud security)\b/i

function scoreColor(s) {
  if (s == null) return { text: 'var(--text-muted)', bg: 'transparent', border: 'var(--border)' }
  if (s >= 70)   return { text: '#4a7c59', bg: 'rgba(74,124,89,0.10)', border: 'rgba(74,124,89,0.3)' }
  if (s >= 40)   return { text: '#a86448', bg: 'rgba(168,100,72,0.10)', border: 'rgba(168,100,72,0.3)' }
  return           { text: '#a1a1a1', bg: 'rgba(161,161,161,0.08)', border: 'rgba(161,161,161,0.25)' }
}

function Field({ label, value, mono, wrap }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</p>
      <p style={{ fontFamily: mono ? MONO : SANS, fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.5, whiteSpace: wrap ? 'pre-wrap' : 'normal', wordBreak: 'break-word' }}>{value}</p>
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <button onClick={copy} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: copied ? '#4a7c59' : 'var(--text-muted)', cursor: 'pointer', letterSpacing: '0.06em', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function SectionLabel({ children }) {
  return <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12, marginTop: 0, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>{children}</p>
}

function DealValueSection({ lead, onUpdate }) {
  const [value, setValue]   = useState(lead.deal_value || '')
  const [date, setDate]     = useState(lead.expected_close_date || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function save() {
    setSaving(true)
    try {
      await updateLead(lead.id, {
        deal_value: value ? parseFloat(value) : null,
        expected_close_date: date || null,
      })
      onUpdate?.({ deal_value: value ? parseFloat(value) : null, expected_close_date: date || null })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <div>
      <SectionLabel>Deal Value</SectionLabel>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Amount ($)</p>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="e.g. 25000"
            style={{ width: '100%', fontFamily: MONO, fontSize: 13, padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Expected Close</p>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ width: '100%', fontFamily: MONO, fontSize: 12, padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <button
          onClick={save} disabled={saving}
          style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, padding: '7px 12px', background: saved ? 'rgba(74,124,89,0.15)' : 'var(--surface)', border: `1px solid ${saved ? 'rgba(74,124,89,0.4)' : 'var(--border)'}`, borderRadius: 5, color: saved ? '#4a7c59' : 'var(--text-muted)', cursor: saving ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {saved ? 'Saved' : saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export default function LeadDrawer({ lead, onClose, onUpdate, onDelete }) {
  const [scoring, setScoring]     = useState(false)
  const [drafting, setDrafting]   = useState(false)
  const [draft, setDraft]         = useState(null)
  const [scoreResult, setScore]   = useState(null)
  const [localLead, setLocalLead] = useState(lead)
  const [saving, setSaving]       = useState(false)
  const [notes, setNotes]         = useState(lead.notes || '')
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue]       = useState('')
  const [signals, setSignals]           = useState(null)
  const [signalCompanyId, setSignalCompanyId] = useState(null)
  const [tracking, setTracking]         = useState(false)
  const [tracked, setTracked]           = useState(null)
  const [emailTimelineKey, setEmailTimelineKey] = useState(0)
  const [templates, setTemplates]       = useState(null)
  const [savingTpl, setSavingTpl]       = useState(false)
  const [tplSaved, setTplSaved]         = useState(false)
  const [showTplPicker, setShowTplPicker] = useState(false)
  const activityRef = useRef(null)

  useEffect(() => {
    if (!lead?.id) return
    getLeadSignals(lead.id).then(r => {
      setSignals(r.data.signals || [])
      setSignalCompanyId(r.data.company_id || null)
    }).catch(() => {})
  }, [lead?.id])

  if (!lead) return null

  const L = { ...localLead, ...lead }
  const isDM  = DECISION_MAKER_RE.test(L.title || '')
  const isSec = SECURITY_RE.test(L.title || '')
  const sc    = L.icp_score != null ? L.icp_score : scoreResult?.score
  const scReason = L.icp_score_reason || scoreResult?.reason
  const colors = scoreColor(sc)

  async function handleScore() {
    setScoring(true)
    try {
      const r = await scoreLeadICP(L.id)
      setScore(r.data)
      setLocalLead(prev => ({ ...prev, icp_score: r.data.score, icp_score_reason: r.data.reason }))
      onUpdate?.(L.id, { icp_score: r.data.score, icp_score_reason: r.data.reason })
      logActivity(L.id, 'scored', { score: r.data.score }).catch(() => {})
      activityRef.current?.refresh()
    } catch (e) { console.error(e) } finally { setScoring(false) }
  }

  async function handleDraft() {
    setDrafting(true)
    setDraft(null)
    try {
      const r = await draftEmail(L.id)
      setDraft(r.data)
      logActivity(L.id, 'email_drafted', { subject: r.data.subject }).catch(() => {})
      activityRef.current?.refresh()
    } catch (e) { console.error(e) } finally { setDrafting(false) }
  }

  async function handleTrackCopy() {
    if (!draft) return
    setTracking(true)
    try {
      const r = await trackEmail(L.id, draft.subject, draft.body)
      setTracked(r.data)
      const fullText = `Subject: ${r.data.subject}\n\n${r.data.body}`
      await navigator.clipboard.writeText(fullText)
      setEmailTimelineKey(k => k + 1)
      logActivity(L.id, 'email_sent', { subject: draft.subject }).catch(() => {})
      activityRef.current?.refresh()
    } catch (e) { console.error(e) }
    finally { setTracking(false) }
  }

  async function handleSaveTemplate() {
    if (!draft) return
    setSavingTpl(true)
    try {
      await createTemplate({ name: draft.subject || 'Untitled', subject: draft.subject, body: draft.body })
      setTplSaved(true); setTimeout(() => setTplSaved(false), 2500)
      setTemplates(null)
    } catch (e) { console.error(e) } finally { setSavingTpl(false) }
  }

  async function handleLoadTemplates() {
    if (templates !== null) { setShowTplPicker(p => !p); return }
    try {
      const r = await getTemplates()
      setTemplates(r.data.templates || [])
      setShowTplPicker(true)
    } catch (e) { console.error(e) }
  }

  function applyTemplate(tpl) {
    setDraft({ subject: tpl.subject || '', body: tpl.body })
    setShowTplPicker(false)
  }

  async function handleStatusChange(status) {
    const prev_status = L.status
    setLocalLead(prev => ({ ...prev, status }))
    onUpdate?.(L.id, { status })
    try {
      await updateLead(L.id, { status })
      logActivity(L.id, 'status_changed', { from: prev_status, to: status }).catch(() => {})
      activityRef.current?.refresh()
    } catch (e) { console.error(e) }
  }

  async function handleConnectionChange(connection_status) {
    setLocalLead(prev => ({ ...prev, connection_status }))
    onUpdate?.(L.id, { connection_status })
    try {
      await updateConnectionStatus(L.id, connection_status)
      logActivity(L.id, 'connection_changed', { status: connection_status }).catch(() => {})
      activityRef.current?.refresh()
    } catch (e) { console.error(e) }
  }

  async function handleStar() {
    const next = !L.starred
    setLocalLead(prev => ({ ...prev, starred: next }))
    onUpdate?.(L.id, { starred: next })
    try { await starLead(L.id, next) } catch (e) { console.error(e) }
  }

  async function handleSaveNotes() {
    setSaving(true)
    try {
      await updateLead(L.id, { notes })
      onUpdate?.(L.id, { notes })
      logActivity(L.id, 'note_saved', {}).catch(() => {})
      activityRef.current?.refresh()
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  async function handleDeleteLead() {
    if (!window.confirm('Delete this lead?')) return
    try { await deleteLead(L.id); onDelete?.(L.id); onClose() } catch (e) { console.error(e) }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.35)', zIndex: 200 }}
      />
      <motion.div
        key="drawer"
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.9 }}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
          background: 'var(--bg)', borderLeft: '1px solid var(--border)',
          zIndex: 201, overflowY: 'auto', display: 'flex', flexDirection: 'column',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.12)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                {isDM && <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, padding: '2px 6px', background: 'rgba(91,141,184,0.12)', color: '#5b8db8', border: '1px solid rgba(91,141,184,0.3)', borderRadius: 3, letterSpacing: '0.1em' }}>DECISION MAKER</span>}
                {isSec && <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, padding: '2px 6px', background: 'rgba(231,0,11,0.08)', color: '#E7000B', border: '1px solid rgba(231,0,11,0.25)', borderRadius: 3, letterSpacing: '0.1em' }}>SECURITY</span>}
              </div>
              <h2 style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{L.name || '—'}</h2>
              <p style={{ fontFamily: SANS, fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{[L.title, L.company].filter(Boolean).join(' · ')}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={handleStar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: L.starred ? 'var(--accent)' : 'var(--border-strong)', padding: '2px 4px' }}>
                {L.starred ? '★' : '☆'}
              </button>
              <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 4, lineHeight: 1 }}>✕</button>
            </div>
          </div>
        </div>

        {/* ICP Score */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', background: sc != null ? colors.bg : 'transparent' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 44, fontWeight: 900, color: colors.text, lineHeight: 1, letterSpacing: '-0.04em' }}>{sc != null ? sc : '—'}</div>
              <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>ICP Score</div>
            </div>
            <div style={{ flex: 1 }}>
              {scReason ? (
                <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{scReason}</p>
              ) : (
                <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>Not scored yet. Click Score to evaluate this lead against your ICP criteria.</p>
              )}
              <button
                onClick={handleScore} disabled={scoring}
                style={{ marginTop: 8, fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', padding: '5px 12px', background: scoring ? 'var(--surface)' : 'var(--text)', color: scoring ? 'var(--text-muted)' : 'var(--bg)', border: 'none', borderRadius: 4, cursor: scoring ? 'default' : 'pointer', transition: 'all 0.15s' }}
              >
                {scoring ? 'Scoring…' : sc != null ? 'Re-score' : 'Score ICP'}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Contact info */}
          <div>
            <SectionLabel>Contact</SectionLabel>
            {L.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>Email</p>
                  <p style={{ fontFamily: MONO, fontSize: 13, color: 'var(--text)', margin: 0 }}>{L.email}</p>
                </div>
                <CopyButton text={L.email} />
              </div>
            )}
            {!L.email && <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic' }}>No email — use Email button in the table to find one</p>}
            <Field label="Phone" value={L.phone} mono />
            <Field label="Location" value={L.location} />
            {L.profile_url && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>LinkedIn</p>
                <a href={L.profile_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>Open Profile ↗</a>
              </div>
            )}
          </div>

          {/* Company */}
          {(L.company || L.industry || L.employee_count || L.org_size) && (
            <div>
              <SectionLabel>Company</SectionLabel>
              <Field label="Company" value={L.company} />
              <Field label="Industry" value={L.industry} />
              <Field label="Employees" value={L.employee_count} />
              <Field label="Size tier" value={L.org_size} />
              <Field label="Revenue" value={L.revenue} />
              <Field label="Website" value={L.website} mono />
              {L.has_security_team && L.has_security_team !== 'No' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'rgba(231,0,11,0.07)', border: '1px solid rgba(231,0,11,0.2)', borderRadius: 4, marginBottom: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#E7000B', letterSpacing: '0.1em' }}>HAS SECURITY TEAM</span>
                </div>
              )}
            </div>
          )}

          {/* Deal Value */}
          <DealValueSection lead={L} onUpdate={(data) => { setLocalLead(prev => ({ ...prev, ...data })); onUpdate?.(L.id, data) }} />

          {/* Buying Signals */}
          {(L.company || signalCompanyId) && (
            <div>
              <CompanySignals
                companyId={signalCompanyId}
                initialSignals={signals && signals.length > 0 ? signals : null}
              />
            </div>
          )}

          {/* About */}
          {L.about && (
            <div>
              <SectionLabel>About</SectionLabel>
              <p style={{ fontFamily: SANS, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{L.about.slice(0, 400)}{L.about.length > 400 ? '…' : ''}</p>
            </div>
          )}

          {/* AI Email Draft */}
          <div>
            <SectionLabel>AI Email Writer</SectionLabel>
            <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, marginTop: -6 }}>
              Generate a hyper-personalized cold email in 2 seconds based on this lead's profile and company context.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                onClick={handleDraft} disabled={drafting}
                style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', padding: '8px 16px', background: drafting ? 'var(--surface)' : '#4a7c59', color: drafting ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 5, cursor: drafting ? 'default' : 'pointer', transition: 'all 0.15s' }}
              >
                {drafting ? 'Writing…' : draft ? 'Regenerate' : 'Write AI Email'}
              </button>
              <button
                onClick={handleLoadTemplates}
                style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                Templates
              </button>
            </div>

            {/* Template picker */}
            {showTplPicker && (
              <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                {templates && templates.length === 0 && (
                  <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No saved templates yet. Write an email and save it.</p>
                )}
                {templates && templates.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', fontFamily: SANS, fontSize: 12, color: 'var(--text)', background: 'none', border: 'none', padding: '5px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text)'}
                  >
                    {tpl.name}
                    {tpl.subject && <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', marginLeft: 8 }}>{tpl.subject}</span>}
                  </button>
                ))}
              </div>
            )}

            {draft && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>Subject</p>
                    <CopyButton text={draft.subject} />
                  </div>
                  <p style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text)', margin: 0 }}>{draft.subject}</p>
                </div>
                <div style={{ padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>Body</p>
                    <CopyButton text={draft.body} />
                  </div>
                  <pre style={{ fontFamily: SANS, fontSize: 13, color: 'var(--text)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{draft.body}</pre>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleTrackCopy}
                    disabled={tracking}
                    style={{ flex: 1, fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', padding: '8px', background: tracking ? 'var(--surface)' : 'var(--text)', color: tracking ? 'var(--text-muted)' : 'var(--bg)', border: 'none', borderRadius: 5, cursor: tracking ? 'default' : 'pointer' }}
                  >
                    {tracking ? 'Preparing…' : tracked ? 'Copied with Tracking' : 'Copy + Track Opens'}
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`)}
                    style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', padding: '8px 12px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer' }}
                  >
                    Copy Plain
                  </button>
                </div>
                {tracked && (
                  <p style={{ fontFamily: MONO, fontSize: 9, color: '#4a7c59', margin: '4px 0 0', letterSpacing: '0.06em' }}>
                    Tracking active — opens and link clicks will appear below
                  </p>
                )}
                <button
                  onClick={handleSaveTemplate} disabled={savingTpl}
                  style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, padding: '4px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: tplSaved ? '#4a7c59' : 'var(--text-muted)', cursor: savingTpl ? 'default' : 'pointer', letterSpacing: '0.05em', marginTop: 6 }}
                >
                  {tplSaved ? 'Saved as template' : savingTpl ? 'Saving…' : 'Save as template'}
                </button>
              </div>
            )}
          </div>

          {/* Email Activity Timeline */}
          <EmailTimeline key={emailTimelineKey} leadId={L.id} />

          {/* Activity Feed */}
          <ActivityFeed ref={activityRef} leadId={L.id} />

          {/* Status & Connection */}
          <div>
            <SectionLabel>Pipeline Status</SectionLabel>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '5px 10px', borderRadius: 4, cursor: 'pointer', transition: 'all 0.12s',
                    background: L.status === s ? 'var(--text)' : 'transparent',
                    color: L.status === s ? 'var(--bg)' : 'var(--text-muted)',
                    border: L.status === s ? '1px solid var(--text)' : '1px solid var(--border)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 }}>Connection</p>
            <select
              value={L.connection_status || 'Not Requested'}
              onChange={e => handleConnectionChange(e.target.value)}
              style={{ fontFamily: SANS, fontSize: 12, padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', cursor: 'pointer', width: '100%', outline: 'none' }}
            >
              {CONNECTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Tasks */}
          <TaskList leadId={L.id} />

          {/* Notes */}
          <div>
            <SectionLabel>Notes</SectionLabel>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes about this lead…"
              rows={4}
              style={{ width: '100%', fontFamily: SANS, fontSize: 13, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '10px 12px', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
            />
            <button
              onClick={handleSaveNotes} disabled={saving}
              style={{ marginTop: 6, fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: saving ? 'var(--text-muted)' : 'var(--text)', cursor: saving ? 'default' : 'pointer' }}
            >
              {saving ? 'Saving…' : 'Save Notes'}
            </button>
          </div>

          {/* Danger zone */}
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
            <button
              onClick={handleDeleteLead}
              style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', padding: '7px 14px', background: 'transparent', border: '1px solid rgba(184,50,50,0.4)', borderRadius: 4, color: 'var(--red, #E7000B)', cursor: 'pointer' }}
            >
              Delete Lead
            </button>
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  )
}
