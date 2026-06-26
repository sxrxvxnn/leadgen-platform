import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'https://leadgenengineplatform-api.vercel.app'
const SANS = "var(--font-sans, 'Host Grotesk', sans-serif)"
const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)"

const TYPE_CONFIG = {
  job_change:     { label: 'Job Change',     color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  sequence_reply: { label: 'Reply',          color: '#10B981', bg: 'rgba(16,185,129,0.1)',  icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  funding:        { label: 'Funding',        color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  hiring:         { label: 'Hiring',         color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)',  icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  compliance:     { label: 'Compliance',     color: '#E7000B', bg: 'rgba(231,0,11,0.1)',    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  news:           { label: 'News',           color: '#6B7280', bg: 'rgba(107,114,128,0.1)', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  growth:         { label: 'Growth',         color: '#10B981', bg: 'rgba(16,185,129,0.1)',  icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  company_alert:  { label: 'Alert',          color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function NotificationIcon({ type, size = 18 }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.company_alert
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8, background: cfg.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d={cfg.icon} />
      </svg>
    </div>
  )
}

function NotificationItem({ notif, onSeen, onClick }) {
  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.company_alert
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={() => { if (!notif.seen) onSeen(notif); onClick(notif) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '14px 20px',
        background: hovered ? 'var(--surface)' : notif.seen ? 'transparent' : 'rgba(231,0,11,0.03)',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'background 0.12s',
        position: 'relative',
      }}
    >
      {/* Unread dot */}
      {!notif.seen && (
        <div style={{
          position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
          width: 6, height: 6, borderRadius: '50%', background: '#E7000B',
        }} />
      )}

      <NotificationIcon type={notif.type} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
          <span style={{
            fontFamily: SANS, fontSize: 13, fontWeight: notif.seen ? 400 : 600,
            color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {notif.title}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
            {timeAgo(notif.created_at)}
          </span>
        </div>
        <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          {notif.body}
        </p>
        <span style={{
          display: 'inline-block', marginTop: 6,
          fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: cfg.color,
          background: cfg.bg, padding: '2px 6px', borderRadius: 3,
        }}>
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

const FILTERS = ['All', 'Unread', 'Job Changes', 'Replies', 'Company Alerts']

export default function Notifications() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [unseen, setUnseen] = useState(0)

  const headers = { Authorization: `Bearer ${session?.access_token}` }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/notifications`, { headers })
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnseen(data.unseen || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => { load() }, [load])

  const markSeen = async (notif) => {
    try {
      await fetch(`${API}/api/notifications/${notif.id}/seen`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: notif.type }),
      })
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, seen: true } : n))
      setUnseen(prev => Math.max(0, prev - 1))
    } catch (e) { console.error(e) }
  }

  const markAllSeen = async () => {
    try {
      await fetch(`${API}/api/notifications/mark-all-seen`, { method: 'POST', headers })
      setNotifications(prev => prev.map(n => ({ ...n, seen: true })))
      setUnseen(0)
    } catch (e) { console.error(e) }
  }

  const handleClick = (notif) => {
    if (notif.link) navigate(notif.link)
  }

  const filtered = notifications.filter(n => {
    if (filter === 'Unread') return !n.seen
    if (filter === 'Job Changes') return n.type === 'job_change'
    if (filter === 'Replies') return n.type === 'sequence_reply'
    if (filter === 'Company Alerts') return ['funding', 'hiring', 'compliance', 'news', 'growth', 'company_alert'].includes(n.type)
    return true
  })

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            Notifications
            {unseen > 0 && (
              <span style={{
                fontFamily: MONO, fontSize: 11, fontWeight: 700,
                background: '#E7000B', color: '#fff',
                borderRadius: 10, padding: '1px 7px', lineHeight: 1.6,
              }}>
                {unseen}
              </span>
            )}
          </h1>
          <p style={{ fontFamily: SANS, fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Job changes, replies, and company signals
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unseen > 0 && (
            <button
              onClick={markAllSeen}
              style={{
                fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
                padding: '7px 14px', background: 'transparent',
                border: '1px solid var(--border)', borderRadius: 5,
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              Mark all read
            </button>
          )}
          <button
            onClick={load}
            style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
              padding: '7px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 5,
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', padding: '5px 12px',
              background: filter === f ? '#E7000B' : 'var(--surface)',
              border: `1px solid ${filter === f ? '#E7000B' : 'var(--border)'}`,
              borderRadius: 4, color: filter === f ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg)' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, width: '60%', background: 'var(--surface)', borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 11, width: '85%', background: 'var(--surface)', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={1.2} style={{ marginBottom: 16 }}>
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p style={{ fontFamily: SANS, fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
              {filter === 'Unread' ? 'All caught up!' : 'No notifications yet'}
            </p>
            <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0', opacity: 0.7 }}>
              Job changes, sequence replies, and company signals will appear here
            </p>
          </div>
        ) : (
          filtered.map(n => (
            <NotificationItem key={n.id} notif={n} onSeen={markSeen} onClick={handleClick} />
          ))
        )}
      </div>

      {/* Stats footer */}
      {!loading && notifications.length > 0 && (
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 16 }}>
          {notifications.length} total · {unseen} unread
        </p>
      )}
    </div>
  )
}
