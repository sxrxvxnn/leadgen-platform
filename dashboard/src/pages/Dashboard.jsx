import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'
import { getDashboardSummary, listJobChangeAlerts, markAllAlertsSeen, dismissAlert } from '../services/api'
import { Skeleton } from '../components/Skeleton'
import { CountUp } from '../components/ui/CountUp'

const SANS    = "var(--font-sans, 'Host Grotesk', sans-serif)"
const MONO    = "var(--font-mono, 'IBM Plex Mono', monospace)"
const DISPLAY = "var(--font-display, 'Barlow Condensed', sans-serif)"

const STATUS_COLOR = { new: '#4a7c59', contacted: '#a86448', qualified: '#5b8db8', closed: '#9b59b6', lost: '#888' }
const STATUS_BG    = { new: '#4a7c5918', contacted: '#a8644818', qualified: '#5b8db818', closed: '#9b59b618', lost: '#88888818' }

function timeGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function TrendArrow({ thisWeek, lastWeek }) {
  if (lastWeek === 0 && thisWeek === 0) return null
  const up = thisWeek >= lastWeek
  const pct = lastWeek > 0 ? Math.round(Math.abs(thisWeek - lastWeek) / lastWeek * 100) : 100
  return (
    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: up ? '#4a7c59' : '#e07070', marginLeft: 6 }}>
      {up ? '↑' : '↓'} {pct}% vs last wk
    </span>
  )
}

function StatCard({ label, value, suffix = '', note, color, trend, loading, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', cursor: onClick ? 'pointer' : 'default', minWidth: 0 }}
      onClick={onClick}
      whileHover={onClick ? { borderColor: 'var(--border-strong)' } : {}}
    >
      <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 10px' }}>{label}</p>
      {loading ? <Skeleton height={28} width={60} /> : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, color: color || 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            <CountUp to={typeof value === 'number' ? value : 0} duration={0.8} />
            {suffix}
          </span>
        </div>
      )}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        {note && <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)' }}>{note}</span>}
        {trend && <TrendArrow {...trend} />}
      </div>
    </motion.div>
  )
}

function ActivityIcon({ type }) {
  const icons = {
    email_sent:       { icon: '✉', color: '#5b8db8' },
    email_opened:     { icon: '👁', color: '#4a7c59' },
    email_clicked:    { icon: '🔗', color: '#4a7c59' },
    linkedin_connect: { icon: 'in', color: '#0082F3' },
    note:             { icon: '✎', color: '#a86448' },
    status_change:    { icon: '→', color: '#9b59b6' },
    call:             { icon: '☎', color: '#a86448' },
    enriched:         { icon: '⚡', color: '#e7a000' },
    task_created:     { icon: '✓', color: '#888' },
  }
  const { icon, color } = icons[type] || { icon: '·', color: '#888' }
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}18`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color }}>
      {icon}
    </div>
  )
}

function ActivityItem({ event }) {
  const lead = event.leads || {}
  const name = lead.name || lead.company || 'a lead'
  const labels = {
    email_sent:    `Email sent to ${name}`,
    email_opened:  `${name} opened your email`,
    email_clicked: `${name} clicked a link`,
    note:          `Note added for ${name}`,
    status_change: `${name} status updated`,
    enriched:      `${name} enriched`,
    task_created:  `Task created for ${name}`,
    call:          `Call logged with ${name}`,
    linkedin_connect: `LinkedIn connection to ${name}`,
  }
  const label = labels[event.event_type] || `Activity for ${name}`
  const time  = event.created_at ? new Date(event.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <ActivityIcon type={event.event_type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
        <p style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', margin: '2px 0 0' }}>{time}</p>
      </div>
    </div>
  )
}

function TaskItem({ task }) {
  const lead    = task.leads || {}
  const isPast  = task.due_date && new Date(task.due_date) < new Date()
  const dueStr  = task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: task.priority === 'high' ? '#E7000B' : 'var(--border-strong)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
        {lead.name && <p style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', margin: '2px 0 0' }}>{lead.name}{lead.company ? ` · ${lead.company}` : ''}</p>}
      </div>
      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: isPast ? '#e07070' : 'var(--text-muted)', flexShrink: 0 }}>{dueStr}</span>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [jobAlerts, setJobAlerts] = useState([])

  useEffect(() => {
    getDashboardSummary()
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
    listJobChangeAlerts()
      .then(r => setJobAlerts(r.data.alerts || []))
      .catch(() => {})
  }, [])

  async function handleMarkAllSeen() {
    await markAllAlertsSeen().catch(() => {})
    setJobAlerts(a => a.map(x => ({ ...x, seen: true })))
  }

  async function handleDismissAlert(id) {
    await dismissAlert(id).catch(() => {})
    setJobAlerts(a => a.filter(x => x.id !== id))
  }

  const nameKey     = user?.id ? `fullName_${user.id}` : 'fullName'
  const displayName = localStorage.getItem(nameKey) || localStorage.getItem('fullName') || user?.email?.split('@')[0] || 'there'
  const L = data?.leads        || {}
  const S = data?.sequences    || {}
  const tasks    = data?.tasks_due_today || []
  const activity = data?.recent_activity || []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding: '26px 36px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 4px' }}>Dashboard</p>
          <h1 style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>
            Good {timeGreeting()}, {displayName}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Prospect', path: '/prospect' },
            { label: 'Add Lead', path: '/leads' },
            { label: 'Sequences', path: '/sequences' },
            { label: 'Discovery', path: '/directory' },
          ].map(a => (
            <button key={a.path} onClick={() => navigate(a.path)}
              style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', padding: '7px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top stat row */}
      <div style={{ display: 'flex', gap: 12, padding: '20px 36px', borderBottom: '1px solid var(--border)' }}>
        <StatCard label="Total Leads"  value={L.total || 0}       color="var(--text)"  note="in pipeline"   trend={{ thisWeek: L.this_week || 0, lastWeek: L.last_week || 0 }} loading={loading} onClick={() => navigate('/leads')} />
        <StatCard label="New This Week" value={L.this_week || 0}  color="#4a7c59"      note="leads added"   loading={loading} onClick={() => navigate('/leads')} />
        <StatCard label="Qualified"     value={L.qualified || 0}  color="#5b8db8"      note="ready to close" loading={loading} onClick={() => navigate('/leads')} />
        <StatCard label="Companies"     value={data?.companies?.total || 0} color="var(--text)" note="tracked" loading={loading} onClick={() => navigate('/companies')} />
        <StatCard label="Emails Sent"   value={S.emails_sent || 0} color="#a86448"     note={`${S.avg_open_rate || 0}% open rate`} loading={loading} onClick={() => navigate('/sequences')} />
        <StatCard label="Active Enrolled" value={S.active_enrollments || 0} color="#9b59b6" note={`${S.replied || 0} replied`} loading={loading} onClick={() => navigate('/sequences')} />
      </div>

      {/* Pipeline funnel bar */}
      {!loading && (L.total || 0) > 0 && (
        <div style={{ padding: '12px 36px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { label: 'New',       value: L.new || 0,       color: '#4a7c59' },
            { label: 'Contacted', value: L.contacted || 0, color: '#a86448' },
            { label: 'Qualified', value: L.qualified || 0, color: '#5b8db8' },
          ].map(({ label, value, color }, i) => {
            const pct = L.total > 0 ? Math.round(value / L.total * 100) : 0
            return (
              <div key={label} style={{ flex: 1, paddingRight: i < 2 ? 24 : 0, marginRight: i < 2 ? 24 : 0, borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color, fontWeight: 700 }}>{pct}% · {value}</span>
                </div>
                <div style={{ height: 3, background: 'var(--surface)', borderRadius: 2, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    style={{ height: '100%', background: color, borderRadius: 2 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 0, minHeight: 'calc(100vh - 280px)' }}>

        {/* Left — recent leads + sequence perf */}
        <div style={{ borderRight: '1px solid var(--border)', padding: '24px 36px 48px' }}>

          {/* Sequence performance */}
          {!loading && S.emails_sent > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>Sequence Performance</p>
                <button onClick={() => navigate('/sequences')} style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>View sequences →</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { label: 'Sent',       value: S.emails_sent || 0,          color: 'var(--text)' },
                  { label: 'Open Rate',  value: `${S.avg_open_rate || 0}%`,  color: (S.avg_open_rate || 0) > 20 ? '#4a7c59' : 'var(--text)' },
                  { label: 'Click Rate', value: `${S.avg_click_rate || 0}%`, color: (S.avg_click_rate || 0) > 5 ? '#0082F3' : 'var(--text)' },
                  { label: 'Replied',    value: S.replied || 0,              color: '#9b59b6' },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
                    <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 6px' }}>{m.label}</p>
                    <p style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 700, color: m.color, margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent leads */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>Recent Leads</p>
              <button onClick={() => navigate('/leads')} style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(6)].map((_, i) => <Skeleton key={i} height={44} />)}
              </div>
            ) : (L.total || 0) === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <p style={{ fontFamily: MONO, fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>No leads yet.</p>
                <button onClick={() => navigate('/prospect')} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '8px 18px', background: '#E7000B', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Search 800M+ contacts →</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 90px 60px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Title', 'Company', 'Status', 'ICP'].map(h => (
                    <span key={h} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</span>
                  ))}
                </div>
                {/* We only have summary data, not individual leads — link to leads page */}
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px' }}>
                    {L.total} leads in pipeline — {L.new} new, {L.contacted} contacted, {L.qualified} qualified
                  </p>
                  <button onClick={() => navigate('/leads')} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '7px 18px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                    Open Leads →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right sidebar — job alerts + tasks + activity */}
        <div style={{ padding: '24px 24px 48px' }}>

          {/* Job change alerts */}
          {jobAlerts.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>Job Changes</p>
                  {jobAlerts.some(a => !a.seen) && (
                    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#b07d2e18', border: '1px solid #b07d2e40', color: '#b07d2e' }}>
                      {jobAlerts.filter(a => !a.seen).length} new
                    </span>
                  )}
                </div>
                {jobAlerts.some(a => !a.seen) && (
                  <button onClick={handleMarkAllSeen} style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Mark all seen</button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {jobAlerts.slice(0, 5).map(alert => {
                  const lead = alert.leads || {}
                  const isBounce = alert.detected_via === 'bounce'
                  return (
                    <div key={alert.id} style={{ padding: '10px 12px', background: alert.seen ? 'var(--bg)' : 'rgba(176,125,46,0.06)', border: `1px solid ${alert.seen ? 'var(--border)' : 'rgba(176,125,46,0.25)'}`, borderRadius: 7, position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: 'var(--text)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lead.name || 'Unknown lead'}
                          </p>
                          {isBounce ? (
                            <p style={{ fontFamily: MONO, fontSize: 10, color: '#b07d2e', margin: 0, lineHeight: 1.5 }}>
                              Email bounced — may have changed jobs
                              {alert.old_company && <span style={{ color: 'var(--text-muted)' }}> at {alert.old_company}</span>}
                            </p>
                          ) : (
                            <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                              {alert.old_company && alert.new_company && alert.old_company !== alert.new_company
                                ? <>{alert.old_company} <span style={{ color: '#b07d2e' }}>→</span> {alert.new_company}</>
                                : alert.new_title || alert.old_title || 'Role changed'}
                            </p>
                          )}
                        </div>
                        <button onClick={() => handleDismissAlert(alert.id)}
                          style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 8px', lineHeight: 1, flexShrink: 0 }}>×</button>
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                        {isBounce ? 'Email bounce' : 'Detected via extension'} · {new Date(alert.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tasks due today */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>Tasks Due</p>
              <button onClick={() => navigate('/tasks')} style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>All tasks →</button>
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...Array(3)].map((_, i) => <Skeleton key={i} height={44} />)}
              </div>
            ) : tasks.length === 0 ? (
              <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', padding: '12px 0' }}>No tasks due today.</p>
            ) : (
              tasks.map(t => <TaskItem key={t.id} task={t} />)
            )}
          </div>

          {/* Activity feed */}
          <div>
            <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 12px' }}>Recent Activity</p>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...Array(5)].map((_, i) => <Skeleton key={i} height={44} />)}
              </div>
            ) : activity.length === 0 ? (
              <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', padding: '12px 0' }}>No activity yet. Send an email or enrich a lead to get started.</p>
            ) : (
              activity.map(e => <ActivityItem key={e.id} event={e} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
