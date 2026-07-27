import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import api from '../services/api'
import { CountUp } from '../components/ui/CountUp'

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)"
const SANS = "var(--font-sans, 'Host Grotesk', sans-serif)"
const DISPLAY = "var(--font-display, 'Barlow Condensed', sans-serif)"

function SectionTitle({ children }) {
  return (
    <p
      style={{
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--text-muted)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        margin: '0 0 16px',
        paddingBottom: 8,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {children}
    </p>
  )
}

function MetricCard({ label, value, suffix, sub, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay }}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '18px 22px',
        flex: 1,
        minWidth: 120,
      }}
    >
      <p
        style={{
          fontFamily: MONO,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.13em',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          margin: '0 0 8px',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: DISPLAY,
          fontSize: 36,
          fontWeight: 900,
          color: color || 'var(--text)',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          margin: '0 0 3px',
        }}
      >
        <CountUp to={typeof value === 'number' ? value : 0} delay={delay + 0.1} />
        {suffix && (
          <span
            style={{
              fontFamily: MONO,
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-muted)',
              marginLeft: 2,
            }}
          >
            {suffix}
          </span>
        )}
      </p>
      {sub && (
        <p style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', margin: 0 }}>
          {sub}
        </p>
      )}
    </motion.div>
  )
}

function FunnelBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: SANS, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>
          {value} <span style={{ color }}>{pct}%</span>
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: '100%', background: color, borderRadius: 2 }}
        />
      </div>
    </div>
  )
}

function ScoreBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 9,
          fontWeight: 600,
          color,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          width: 60,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 8,
          background: 'var(--border)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: '100%', background: color, borderRadius: 4, opacity: 0.85 }}
        />
      </div>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 10,
          color: 'var(--text-muted)',
          width: 40,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// GitHub-style activity heatmap
function ActivityHeatmap({ data }) {
  if (!data || data.length === 0) return null

  const maxCount = Math.max(...data.map((d) => d.count), 1)

  function cellColor(count) {
    if (count === 0) return 'var(--border)'
    const intensity = count / maxCount
    if (intensity < 0.25) return 'rgba(231,0,11,0.2)'
    if (intensity < 0.5) return 'rgba(231,0,11,0.45)'
    if (intensity < 0.75) return 'rgba(231,0,11,0.7)'
    return '#E7000B'
  }

  // Group into weeks (columns), days (rows 0=Mon..6=Sun)
  const weeks = []
  let week = []
  // Pad start so first day falls on correct weekday
  const firstDate = new Date(data[0].date + 'T00:00:00')
  const firstDow = (firstDate.getDay() + 6) % 7 // Mon=0
  for (let i = 0; i < firstDow; i++) week.push(null)

  data.forEach((d) => {
    const dow = (new Date(d.date + 'T00:00:00').getDay() + 6) % 7
    week.push(d)
    if (dow === 6) {
      weeks.push(week)
      week = []
    }
  })
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const CELL = 11
  const GAP = 3

  return (
    <div>
      <div style={{ display: 'flex', gap: GAP }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, marginTop: 0 }}>
          {dayLabels.map((l, i) => (
            <div
              key={i}
              style={{
                width: CELL,
                height: CELL,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 8, color: 'var(--text-muted)' }}>
                {i % 2 === 0 ? l : ''}
              </span>
            </div>
          ))}
        </div>
        {/* Grid */}
        {weeks.map((wk, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
            {wk.map((cell, di) => (
              <div
                key={di}
                title={cell ? `${cell.date}: ${cell.count} activities` : ''}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 2,
                  background: cell ? cellColor(cell.count) : 'transparent',
                  border: cell ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  cursor: cell && cell.count > 0 ? 'default' : 'default',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: 'var(--text-muted)' }}>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
          <div
            key={i}
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 2,
              background: v === 0 ? 'var(--border)' : `rgba(231,0,11,${0.2 + v * 0.8})`,
            }}
          />
        ))}
        <span style={{ fontFamily: MONO, fontSize: 8, color: 'var(--text-muted)' }}>More</span>
      </div>
    </div>
  )
}

// Weekly trend mini bars
function WeeklyTrend({ data }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
      {data.map((w, i) => {
        const h = max > 0 ? Math.max((w.count / max) * 48, w.count > 0 ? 4 : 2) : 2
        const isLast = i === data.length - 1
        return (
          <div
            key={i}
            title={`w/o ${w.week_start}: ${w.count} leads`}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: h }}
              transition={{ duration: 0.5, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
              style={{
                width: '100%',
                background: isLast ? '#E7000B' : 'rgba(231,0,11,0.35)',
                borderRadius: 2,
                minHeight: 2,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

// Sequence step funnel table
function StepFunnel({ seq }) {
  const [open, setOpen] = useState(false)
  if (!seq.step_funnel || seq.step_funnel.length === 0) return null
  const maxSent = Math.max(...seq.step_funnel.map((s) => s.sent), 1)
  return (
    <div
      style={{
        marginBottom: 12,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {seq.name}
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: 'var(--text-muted)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '2px 7px',
            }}
          >
            {seq.enrolled || 0} enrolled
          </span>
          {seq.status === 'active' && (
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: '#4a7c59',
                background: 'rgba(74,124,89,0.12)',
                borderRadius: 4,
                padding: '2px 6px',
              }}
            >
              ACTIVE
            </span>
          )}
        </div>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
            display: 'inline-block',
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 70px 1fr 60px 60px 52px',
              gap: 8,
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
              }}
            >
              #
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
              }}
            >
              TYPE
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
              }}
            >
              REACH
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
                textAlign: 'right',
              }}
            >
              SENT
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
                textAlign: 'right',
              }}
            >
              OPENS
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
                textAlign: 'right',
              }}
            >
              RATE
            </span>
          </div>
          {seq.step_funnel.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 70px 1fr 60px 60px 52px',
                gap: 8,
                alignItems: 'center',
                padding: '6px 0',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>
                {step.step_number}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color:
                    step.type === 'email'
                      ? '#E7000B'
                      : step.type === 'linkedin'
                        ? '#0077B5'
                        : 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {step.type}
              </span>
              <div
                style={{
                  height: 4,
                  background: 'var(--border)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${maxSent > 0 ? (step.sent / maxSent) * 100 : 0}%`,
                    background: '#E7000B',
                    borderRadius: 2,
                    opacity: 0.6,
                  }}
                />
              </div>
              <span
                style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text)', textAlign: 'right' }}
              >
                {step.sent}
              </span>
              <span
                style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text)', textAlign: 'right' }}
              >
                {step.opened}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  color: step.open_rate >= 20 ? '#4a7c59' : 'var(--text-muted)',
                  textAlign: 'right',
                }}
              >
                {step.open_rate}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/analytics')
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '28px 36px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 32,
          }}
        >
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 90,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                opacity: 1 - i * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { leads, email, tasks, pipeline, sequences, activity_heatmap } = data
  const totalLeads = leads?.total || 0
  const byStatus = leads?.by_status || {}
  const scoreDist = leads?.score_distribution || {}
  const pipelineValue = pipeline?.total_value || 0
  const weeklyTrend = leads?.weekly_trend || []
  const heatmap = activity_heatmap || []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding: '28px 36px 24px', borderBottom: '1px solid var(--border)' }}>
        <p
          style={{
            fontFamily: MONO,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.14em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            margin: '0 0 4px',
          }}
        >
          Insights
        </p>
        <h1
          style={{
            fontFamily: DISPLAY,
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.02em',
            margin: 0,
            lineHeight: 1,
          }}
        >
          Analytics
        </h1>
      </div>

      <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Top KPIs */}
        <div>
          <SectionTitle>Overview</SectionTitle>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <MetricCard label="Total Leads" value={totalLeads} color="var(--text)" delay={0.05} />
            <MetricCard
              label="Avg ICP Score"
              value={leads?.avg_score}
              suffix="/100"
              color={leads?.avg_score >= 70 ? '#4a7c59' : '#a86448'}
              delay={0.1}
            />
            <MetricCard
              label="High-Value"
              value={leads?.high_value}
              sub="score ≥ 70"
              color="#4a7c59"
              delay={0.15}
            />
            <MetricCard
              label="Pipeline Value"
              value={Math.round(pipelineValue / 1000)}
              suffix="k"
              sub={`${pipeline?.valued_deals || 0} deals valued`}
              color="#5b8db8"
              delay={0.2}
            />
            <MetricCard
              label="Open Tasks"
              value={tasks?.open}
              sub={tasks?.overdue > 0 ? `${tasks.overdue} overdue` : 'on track'}
              color={tasks?.overdue > 0 ? '#E7000B' : 'var(--text)'}
              delay={0.25}
            />
            <MetricCard
              label="Emails Sent"
              value={email?.sent}
              sub={`${email?.open_rate || 0}% open rate`}
              color="var(--text)"
              delay={0.3}
            />
          </div>
        </div>

        {/* Activity Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '20px 24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 16,
            }}
          >
            <SectionTitle>Activity — Last 12 Weeks</SectionTitle>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { label: 'Leads added', color: '#E7000B' },
                { label: 'Emails sent', color: 'rgba(231,0,11,0.4)' },
              ].map(({ label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, background: color, borderRadius: 2 }} />
                  <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <ActivityHeatmap data={heatmap} />
        </motion.div>

        {/* Pipeline funnel + ICP + Weekly trend */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '20px 24px',
            }}
          >
            <SectionTitle>Pipeline Funnel</SectionTitle>
            <FunnelBar label="New" value={byStatus.new || 0} total={totalLeads} color="#4a7c59" />
            <FunnelBar
              label="Contacted"
              value={byStatus.contacted || 0}
              total={totalLeads}
              color="#a86448"
            />
            <FunnelBar
              label="Qualified"
              value={byStatus.qualified || 0}
              total={totalLeads}
              color="#5b8db8"
            />
            <FunnelBar
              label="Disqualified"
              value={byStatus.disqualified || 0}
              total={totalLeads}
              color="#a1a1a1"
            />
            {totalLeads > 0 && (
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  color: 'var(--text-muted)',
                  marginTop: 14,
                  marginBottom: 0,
                }}
              >
                {byStatus.qualified || 0} qualified ·{' '}
                {Math.round(((byStatus.qualified || 0) / totalLeads) * 100)}% conversion
              </p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.22 }}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '20px 24px',
            }}
          >
            <SectionTitle>ICP Score Distribution</SectionTitle>
            <ScoreBar label="High" value={scoreDist.high || 0} total={totalLeads} color="#4a7c59" />
            <ScoreBar
              label="Medium"
              value={scoreDist.medium || 0}
              total={totalLeads}
              color="#a86448"
            />
            <ScoreBar label="Low" value={scoreDist.low || 0} total={totalLeads} color="#a1a1a1" />
            <ScoreBar
              label="Unscored"
              value={scoreDist.unscored || 0}
              total={totalLeads}
              color="var(--border-strong)"
            />
            <p
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: 'var(--text-muted)',
                marginTop: 14,
                marginBottom: 0,
              }}
            >
              {leads?.scored || 0} of {totalLeads} scored · avg {leads?.avg_score || 0}/100
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.29 }}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '20px 24px',
            }}
          >
            <SectionTitle>Leads Added — Last 8 Weeks</SectionTitle>
            <WeeklyTrend data={weeklyTrend} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              {weeklyTrend.slice(0, 8).map((w, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: MONO,
                    fontSize: 8,
                    color: 'var(--text-muted)',
                    flex: 1,
                    textAlign: 'center',
                  }}
                >
                  {w.count > 0 ? w.count : ''}
                </span>
              ))}
            </div>
            {weeklyTrend.length > 0 && (
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  color: 'var(--text-muted)',
                  marginTop: 8,
                  marginBottom: 0,
                }}
              >
                This week: {weeklyTrend[weeklyTrend.length - 1]?.count || 0} leads added
              </p>
            )}
          </motion.div>
        </div>

        {/* Email + Sequences */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '20px 24px',
            }}
          >
            <SectionTitle>Email Tracking</SectionTitle>
            {email?.sent === 0 ? (
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}
              >
                No tracked emails yet. Use "Copy + Track Opens" in the lead drawer.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                  {[
                    { label: 'Sent', value: email?.sent, color: 'var(--text)' },
                    { label: 'Opened', value: email?.opened, color: '#4a7c59' },
                    {
                      label: 'Open Rate',
                      value: `${email?.open_rate || 0}%`,
                      color: email?.open_rate >= 20 ? '#4a7c59' : '#a86448',
                      raw: true,
                    },
                    { label: 'Clicks', value: email?.total_clicks, color: '#5b8db8' },
                  ].map(({ label, value, color, raw }) => (
                    <div key={label}>
                      <p
                        style={{
                          fontFamily: MONO,
                          fontSize: 9,
                          color: 'var(--text-muted)',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          margin: '0 0 4px',
                        }}
                      >
                        {label}
                      </p>
                      <p
                        style={{
                          fontFamily: DISPLAY,
                          fontSize: 28,
                          fontWeight: 900,
                          color,
                          margin: 0,
                          letterSpacing: '-0.03em',
                        }}
                      >
                        {raw ? value : <CountUp to={Number(value) || 0} delay={0.4} />}
                      </p>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    height: 4,
                    background: 'var(--border)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(email?.open_rate || 0, 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    style={{
                      height: '100%',
                      background: email?.open_rate >= 20 ? '#4a7c59' : '#a86448',
                      borderRadius: 2,
                    }}
                  />
                </div>
                <p
                  style={{
                    fontFamily: MONO,
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    margin: '6px 0 0',
                  }}
                >
                  Industry avg: ~21% open · ~2.5% click
                </p>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.37 }}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '20px 24px',
            }}
          >
            <SectionTitle>Sequences</SectionTitle>
            {!sequences?.total || sequences.total === 0 ? (
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}
              >
                No sequences yet. Create one in the Sequences page.
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 20 }}>
                {[
                  { label: 'Active', value: sequences?.active, color: '#4a7c59' },
                  { label: 'Enrolled', value: sequences?.total_enrolled, color: 'var(--text)' },
                  { label: 'Replied', value: sequences?.total_replied, color: '#5b8db8' },
                  {
                    label: 'Reply Rate',
                    value: `${sequences?.reply_rate || 0}%`,
                    color: sequences?.reply_rate >= 5 ? '#4a7c59' : '#a86448',
                    raw: true,
                  },
                ].map(({ label, value, color, raw }) => (
                  <div key={label}>
                    <p
                      style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        margin: '0 0 4px',
                      }}
                    >
                      {label}
                    </p>
                    <p
                      style={{
                        fontFamily: DISPLAY,
                        fontSize: 28,
                        fontWeight: 900,
                        color,
                        margin: 0,
                        letterSpacing: '-0.03em',
                      }}
                    >
                      {raw ? value : <CountUp to={Number(value) || 0} delay={0.4} />}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Per-sequence step funnels */}
        {sequences?.list?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
          >
            <SectionTitle>Sequence Step Funnels</SectionTitle>
            {sequences.list.map((seq) => (
              <StepFunnel key={seq.id} seq={seq} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
