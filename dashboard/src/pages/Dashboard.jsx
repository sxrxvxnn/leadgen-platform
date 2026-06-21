import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'
import { getLeads, getCompanies } from '../services/api'
import api from '../services/api'
import { Skeleton, SkeletonRow } from '../components/Skeleton'
import { CountUp } from '../components/ui/CountUp'
import ImagesFanBadge from '../components/ImagesFanBadge'

const SANS    = "var(--font-sans, 'Host Grotesk', sans-serif)"
const MONO    = "var(--font-mono, 'IBM Plex Mono', monospace)"
const DISPLAY = "var(--font-display, 'Barlow Condensed', sans-serif)"

function StatCard({ label, value, suffix, color, note, delay, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay }}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px', flex: 1 }}
    >
      <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 10px' }}>{label}</p>
      <p style={{ fontFamily: DISPLAY, fontSize: 38, fontWeight: 900, color: color || 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1, margin: '0 0 4px' }}>
        {loading ? <Skeleton w={52} h={36} r={4} /> : <><CountUp to={value} delay={delay + 0.1} />{suffix && <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 2 }}>{suffix}</span>}</>}
      </p>
      {note && <p style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', margin: 0 }}>{note}</p>}
    </motion.div>
  )
}

function statusBadge(status) {
  const map = {
    new:          { color: '#4a7c59', background: 'rgba(74,124,89,0.10)',   border: 'rgba(74,124,89,0.22)' },
    contacted:    { color: '#a86448', background: 'rgba(168,100,72,0.10)',  border: 'rgba(168,100,72,0.22)' },
    qualified:    { color: '#5b8db8', background: 'rgba(91,141,184,0.10)',  border: 'rgba(91,141,184,0.22)' },
    disqualified: { color: '#a1a1a1', background: 'rgba(161,161,161,0.08)', border: 'rgba(161,161,161,0.22)' },
  }
  const st = map[status] || map.new
  return { color: st.color, background: st.background, border: `1px solid ${st.border}` }
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats]     = useState({ totalLeads: 0, newLeads: 0, contacted: 0, qualified: 0, companies: 0, avgScore: null })
  const [recentLeads, setRecentLeads]         = useState([])
  const [recentCompanies, setRecentCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('leads')

  useEffect(() => {
    async function load() {
      try {
        const [lr, cr] = await Promise.all([getLeads(), getCompanies()])
        const leads     = lr.data.leads     || []
        const companies = cr.data.companies || []
        const scored    = leads.filter(l => l.icp_score != null)
        const avgScore  = scored.length ? Math.round(scored.reduce((s, l) => s + l.icp_score, 0) / scored.length) : null
        setStats({
          totalLeads: leads.length,
          newLeads:   leads.filter(l => l.status === 'new').length,
          contacted:  leads.filter(l => l.status === 'contacted').length,
          qualified:  leads.filter(l => l.status === 'qualified').length,
          companies:  companies.length,
          avgScore,
        })
        setRecentLeads(leads.slice(0, 10))
        setRecentCompanies(companies.slice(0, 10))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const displayName = localStorage.getItem('fullName') || user?.email?.split('@')[0] || 'there'

  const QUICK_ACTIONS = [
    { label: 'Add Lead',     icon: '+', path: '/leads',     color: 'var(--text)' },
    { label: 'Companies',    icon: '⊞', path: '/companies', color: 'var(--text)' },
    { label: 'New Sequence', icon: '✉', path: '/sequences', color: 'var(--text)' },
    { label: 'Discovery',    icon: '◎', path: '/directory', color: 'var(--text)' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Page header ───────────────────────────────────────────── */}
      <div style={{ padding: '28px 36px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 4px' }}>Overview</p>
          <h1 style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>
            Good {timeGreeting()}, {displayName}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', padding: '7px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'border-color 0.12s, color 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              <span style={{ fontSize: 13 }}>{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────── */}
      <div style={{ padding: '24px 36px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
        <StatCard label="Total Leads"  value={stats.totalLeads} color="var(--text)"  note="in pipeline"     delay={0.05} loading={loading} />
        <StatCard label="New"          value={stats.newLeads}   color="#4a7c59"      note="awaiting action" delay={0.10} loading={loading} />
        <StatCard label="Contacted"    value={stats.contacted}  color="#a86448"      note="in progress"     delay={0.15} loading={loading} />
        <StatCard label="Qualified"    value={stats.qualified}  color="#5b8db8"      note="ready to close"  delay={0.20} loading={loading} />
        <StatCard label="Companies"    value={stats.companies}  color="var(--text)"  note="tracked"         delay={0.25} loading={loading} />
        {stats.avgScore != null && (
          <StatCard label="Avg ICP Score" value={stats.avgScore} suffix="/100" color={stats.avgScore >= 70 ? '#4a7c59' : '#a86448'} note="scored leads" delay={0.30} loading={loading} />
        )}
      </div>

      {/* ── Pipeline funnel ───────────────────────────────────────── */}
      {!loading && stats.totalLeads > 0 && (
        <div style={{ padding: '16px 36px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { label: 'New',       value: stats.newLeads,  color: '#4a7c59' },
            { label: 'Contacted', value: stats.contacted, color: '#a86448' },
            { label: 'Qualified', value: stats.qualified, color: '#5b8db8' },
          ].map(({ label, value, color }, i) => {
            const pct = stats.totalLeads > 0 ? Math.round((value / stats.totalLeads) * 100) : 0
            return (
              <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, paddingRight: i < 2 ? 24 : 0, marginRight: i < 2 ? 24 : 0, borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color, fontWeight: 600 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--surface)', borderRadius: 2, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      style={{ height: '100%', background: color, borderRadius: 2 }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Recent leads / companies ─────────────────────────────── */}
      <div style={{ padding: '0 36px 48px' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingTop: 20, marginBottom: 0 }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {['leads', 'companies'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                  padding: '10px 16px', background: 'transparent', border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.12s', marginBottom: -1,
                }}
              >
                {tab === 'leads' ? 'Recent Leads' : 'Recent Companies'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 4 }}>
            {activeTab === 'leads' && !loading && recentLeads.length > 0 && (
              <ImagesFanBadge leads={recentLeads} max={5} />
            )}
            <button
              onClick={() => navigate(activeTab === 'leads' ? '/leads' : '/companies')}
              style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.04em' }}
            >
              View all →
            </button>
          </div>
        </div>

        {/* Leads table */}
        {activeTab === 'leads' && (
          loading ? (
            <div>
              <div style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Title', 'Company', 'Status', 'ICP'].map((h, i) => (
                  <span key={h} style={{ ...s.th, flex: i === 0 ? 2 : 1 }}>{h}</span>
                ))}
              </div>
              {[...Array(6)].map((_, i) => <SkeletonRow key={i} cols={[2, 1, 1, 1, 1]} />)}
            </div>
          ) : recentLeads.length === 0 ? (
            <EmptyState title="No leads yet" text='Add leads via the Leads page or use the Chrome extension on LinkedIn.' />
          ) : (
            <div>
              <div style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Title', 'Company', 'Status', 'ICP'].map((h, i) => (
                  <span key={h} style={{ ...s.th, flex: i === 0 ? 2 : 1 }}>{h}</span>
                ))}
              </div>
              {recentLeads.map(lead => (
                <div
                  key={lead.id}
                  style={{ display: 'flex', padding: '13px 0', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => navigate('/leads')}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ flex: 2, fontFamily: SANS, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{lead.name || '—'}</span>
                  <span style={{ flex: 1, fontFamily: SANS, fontSize: 12, color: 'var(--text-secondary)' }}>{lead.title || '—'}</span>
                  <span style={{ flex: 1, fontFamily: SANS, fontSize: 12, color: 'var(--text-secondary)' }}>{lead.company || '—'}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.06em', textTransform: 'uppercase', ...statusBadge(lead.status) }}>
                      {lead.status || 'new'}
                    </span>
                  </span>
                  <span style={{ flex: 1 }}>
                    {lead.icp_score != null
                      ? <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: lead.icp_score >= 70 ? '#4a7c59' : lead.icp_score >= 40 ? '#a86448' : 'var(--text-muted)' }}>{lead.icp_score}</span>
                      : <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    }
                  </span>
                </div>
              ))}
            </div>
          )
        )}

        {/* Companies table */}
        {activeTab === 'companies' && (
          loading ? (
            <div>
              <div style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Industry', 'Location', 'Employees', 'ICP'].map((h, i) => (
                  <span key={h} style={{ ...s.th, flex: i === 0 ? 2 : 1 }}>{h}</span>
                ))}
              </div>
              {[...Array(6)].map((_, i) => <SkeletonRow key={i} cols={[2, 1, 1, 1, 1]} />)}
            </div>
          ) : recentCompanies.length === 0 ? (
            <EmptyState title="No companies yet" text='Add companies or run Discovery to find prospects.' />
          ) : (
            <div>
              <div style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Industry', 'Location', 'Employees', 'ICP'].map((h, i) => (
                  <span key={h} style={{ ...s.th, flex: i === 0 ? 2 : 1 }}>{h}</span>
                ))}
              </div>
              {recentCompanies.map(co => (
                <div
                  key={co.id}
                  style={{ display: 'flex', padding: '13px 0', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => navigate('/companies')}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ flex: 2, fontFamily: SANS, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{co.name || '—'}</span>
                  <span style={{ flex: 1, fontFamily: SANS, fontSize: 12, color: 'var(--text-secondary)' }}>{co.industry || '—'}</span>
                  <span style={{ flex: 1, fontFamily: SANS, fontSize: 12, color: 'var(--text-secondary)' }}>{co.location || co.city || '—'}</span>
                  <span style={{ flex: 1, fontFamily: MONO, fontSize: 12, color: 'var(--text-secondary)' }}>{co.employee_count || '—'}</span>
                  <span style={{ flex: 1 }}>
                    {co.icp_score != null
                      ? <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: '#5b8db8' }}>{co.icp_score}</span>
                      : <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    }
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

function EmptyState({ title, text }) {
  return (
    <div style={{ padding: '56px 0', textAlign: 'center' }}>
      <p style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 400, color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '-0.02em' }}>{title}</p>
      <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>{text}</p>
    </div>
  )
}

function timeGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const s = {
  th: { fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' },
}
