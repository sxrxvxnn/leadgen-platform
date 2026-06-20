import { useState, useEffect } from 'react'
import { getEmailOpens } from '../services/api'

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)"
const SANS = "var(--font-sans, 'Host Grotesk', sans-serif)"

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function EmailRow({ email, isFirst }) {
  const [expanded, setExpanded] = useState(false)
  const opened = email.open_count > 0

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* status dot */}
        <div style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 4,
          background: opened ? '#4a7c59' : 'var(--border-strong)',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text)', margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {email.subject || '(no subject)'}
            </p>
            <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
              {timeAgo(email.sent_at)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {opened ? (
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#4a7c59', background: 'rgba(74,124,89,0.08)', border: '1px solid rgba(74,124,89,0.22)', borderRadius: 3, padding: '1px 5px' }}>
                Opened {email.open_count}× · {timeAgo(email.first_opened_at)}
              </span>
            ) : (
              <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px' }}>
                Not opened
              </span>
            )}
            {email.clicks?.length > 0 && (
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#5b8db8', background: 'rgba(91,141,184,0.08)', border: '1px solid rgba(91,141,184,0.22)', borderRadius: 3, padding: '1px 5px' }}>
                {email.clicks.length} click{email.clicks.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, marginLeft: 17, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {email.body_preview && (
            <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>
              "{email.body_preview}{email.body_preview.length >= 120 ? '…' : ''}"
            </p>
          )}
          {email.open_count > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <p style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Opens</p>
              <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text)', margin: 0 }}>
                First: {new Date(email.first_opened_at).toLocaleString()}
              </p>
              {email.last_opened_at !== email.first_opened_at && (
                <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text)', margin: 0 }}>
                  Last: {new Date(email.last_opened_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
          {email.clicks?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <p style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Clicks</p>
              {email.clicks.map((c, i) => (
                <p key={i} style={{ fontFamily: MONO, fontSize: 10, color: '#5b8db8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {new URL(c.url).hostname} · {timeAgo(c.clicked_at)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function EmailTimeline({ leadId }) {
  const [emails, setEmails] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leadId) return
    getEmailOpens(leadId)
      .then(r => setEmails(r.data.emails || []))
      .catch(() => setEmails([]))
      .finally(() => setLoading(false))
  }, [leadId])

  if (loading) return null
  if (!emails || emails.length === 0) return null

  return (
    <div>
      <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10, marginTop: 0, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        Email Activity
      </p>
      {emails.map((e, i) => (
        <EmailRow key={e.id || i} email={e} isFirst={i === 0} />
      ))}
    </div>
  )
}
