import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { getActivity } from '../services/api'

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)"
const SANS = "var(--font-sans, 'Host Grotesk', sans-serif)"

const EVENT_CFG = {
  created:            { icon: '✦', color: '#9b8ea8', label: 'Lead added' },
  scored:             { icon: '◎', color: '#5b8db8', label: 'ICP scored' },
  email_drafted:      { icon: '✉', color: '#7a8a5b', label: 'Email drafted' },
  email_sent:         { icon: '↗', color: '#4a7c59', label: 'Email sent' },
  status_changed:     { icon: '⟳', color: '#a86448', label: 'Status changed' },
  connection_changed: { icon: '⊕', color: '#9b8ea8', label: 'Connection updated' },
  note_saved:         { icon: '◈', color: '#7a8a5b', label: 'Note saved' },
  signal_detected:    { icon: '◉', color: '#a86448', label: 'Signal detected' },
  enriched:           { icon: '⬡', color: '#5b8db8', label: 'Enriched' },
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function eventDetail(event) {
  const d = event.data || {}
  switch (event.event_type) {
    case 'scored':            return d.score != null ? `Score: ${d.score}` : null
    case 'email_drafted':     return d.subject ? `"${d.subject}"` : null
    case 'email_sent':        return d.subject ? `"${d.subject}"` : null
    case 'status_changed':    return d.from && d.to ? `${d.from} → ${d.to}` : d.to || null
    case 'connection_changed':return d.status || null
    case 'signal_detected':   return d.count != null ? `${d.count} signals` : null
    case 'enriched':          return d.fields ? d.fields.join(', ') : null
    default:                  return null
  }
}

const ActivityFeed = forwardRef(function ActivityFeed({ leadId }, ref) {
  const [items, setItems]   = useState(null)
  const [loading, setLoading] = useState(true)

  function load() {
    if (!leadId) return
    setLoading(true)
    getActivity(leadId)
      .then(r => setItems(r.data.activity || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [leadId])

  useImperativeHandle(ref, () => ({ refresh: load }))

  if (loading || !items || items.length === 0) return null

  return (
    <div>
      <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12, marginTop: 0, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        Activity
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {items.map((ev, i) => {
          const cfg    = EVENT_CFG[ev.event_type] || { icon: '·', color: 'var(--text-muted)', label: ev.event_type }
          const detail = eventDetail(ev)
          const isLast = i === items.length - 1
          return (
            <div key={ev.id || i} style={{ display: 'flex', gap: 10, position: 'relative' }}>
              {/* vertical line */}
              {!isLast && (
                <div style={{ position: 'absolute', left: 7, top: 18, bottom: 0, width: 1, background: 'var(--border)' }} />
              )}
              {/* icon */}
              <div style={{
                width: 15, height: 15, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 2, fontSize: 10, color: cfg.color, zIndex: 1,
              }}>
                {cfg.icon}
              </div>
              {/* content */}
              <div style={{ flex: 1, paddingBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                    {cfg.label}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {timeAgo(ev.created_at)}
                  </span>
                </div>
                {detail && (
                  <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.4 }}>
                    {detail}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default ActivityFeed
