import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getLeads, getCompanies } from '../services/api'
import Navbar from '../components/Navbar'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ totalLeads: 0, newLeads: 0, contacted: 0, companies: 0 })
  const [recentLeads, setRecentLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const [lr, cr] = await Promise.all([getLeads(), getCompanies()])
        const leads = lr.data.leads
        setStats({
          totalLeads: leads.length,
          newLeads: leads.filter((l) => l.status === 'new').length,
          contacted: leads.filter((l) => l.status === 'contacted').length,
          companies: cr.data.companies.length,
        })
        setRecentLeads(leads.slice(0, 8))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const pad = (n) => String(n).padStart(2, '0')
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`

  return (
    <div style={s.page}>
      <Navbar />

      {/* Hero bar */}
      <div style={s.hero}>
        <div style={s.heroLeft}>
          <p style={s.heroEyebrow}>INTELLIGENCE OVERVIEW</p>
          <h1 style={s.heroTitle}>
            {loading ? '—' : stats.totalLeads}
            <span style={s.heroUnit}> leads</span>
          </h1>
        </div>
        <div style={s.heroRight}>
          <p style={s.clock}>{timeStr}</p>
          <p style={s.heroOperator}>{user?.email?.split('@')[0]}</p>
        </div>
      </div>

      <div style={s.container}>
        {/* Stats row */}
        <div style={s.statsRow}>
          {[
            { label: 'NEW', value: stats.newLeads, color: 'var(--white)' },
            { label: 'CONTACTED', value: stats.contacted, color: 'var(--amber)' },
            { label: 'COMPANIES', value: stats.companies, color: 'var(--white)' },
            { label: 'TOTAL', value: stats.totalLeads, color: 'var(--white)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={s.statCard}>
              <p style={s.statLabel}>{label}</p>
              <p style={{ ...s.statValue, color }}>{loading ? '—' : value}</p>
            </div>
          ))}
        </div>

        {/* Recent leads table */}
        <div style={s.section}>
          <div style={s.sectionHead}>
            <p style={s.sectionLabel}>RECENT TARGETS</p>
            <button style={s.sectionBtn} onClick={() => navigate('/leads')} data-hover="true">
              View all →
            </button>
          </div>

          {loading ? (
            <p style={s.empty}>Loading...</p>
          ) : recentLeads.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>No leads yet</p>
              <p style={s.emptyText}>Use the Chrome extension on LinkedIn to extract your first leads.</p>
            </div>
          ) : (
            <div style={s.table}>
              <div style={s.thead}>
                {['TARGET', 'ROLE', 'COMPANY', 'STATUS'].map((h) => (
                  <span key={h} style={{ ...s.th, flex: h === 'STATUS' ? 1 : 2 }}>{h}</span>
                ))}
              </div>
              {recentLeads.map((lead, i) => (
                <LeadRow key={lead.id} lead={lead} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const statusColors = {
  new: 'var(--white)',
  contacted: 'var(--amber)',
  qualified: 'var(--green)',
  disqualified: 'var(--gray-4)',
}

function LeadRow({ lead, index }) {
  return (
    <div className="fade-up" style={{ ...s.trow, animationDelay: index * 0.04 + 's' }}>
      <span style={{ ...s.td, flex: 2, color: 'var(--white)', fontWeight: '500' }}>{lead.name || '—'}</span>
      <span style={{ ...s.td, flex: 2 }}>{lead.title || '—'}</span>
      <span style={{ ...s.td, flex: 2 }}>{lead.company || '—'}</span>
      <span style={{ ...s.td, flex: 1 }}>
        <span style={{ ...s.badge, color: statusColors[lead.status] || 'var(--white)', borderColor: statusColors[lead.status] || 'var(--gray-3)' }}>
          {(lead.status || 'new').toUpperCase()}
        </span>
      </span>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: 'var(--black)' },
  hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '48px 32px 32px', borderBottom: '1px solid var(--gray-2)' },
  heroLeft: {},
  heroEyebrow: { fontSize: '11px', fontWeight: '600', letterSpacing: '4px', color: 'var(--gray-4)', marginBottom: '12px' },
  heroTitle: { fontSize: 'clamp(48px, 6vw, 80px)', fontWeight: '900', letterSpacing: '-3px', color: 'var(--white)', lineHeight: 1 },
  heroUnit: { fontSize: 'clamp(24px, 3vw, 40px)', fontWeight: '300', color: 'var(--gray-4)', letterSpacing: '-1px' },
  heroRight: { textAlign: 'right' },
  clock: { fontSize: '28px', fontWeight: '300', letterSpacing: '-1px', color: 'var(--gray-3)', fontVariantNumeric: 'tabular-nums' },
  heroOperator: { fontSize: '11px', letterSpacing: '2px', color: 'var(--gray-4)', marginTop: '8px' },
  container: { padding: '32px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'var(--gray-2)', border: '1px solid var(--gray-2)', borderRadius: '4px', overflow: 'hidden', marginBottom: '32px' },
  statCard: { background: 'var(--black)', padding: '24px 28px' },
  statLabel: { fontSize: '10px', fontWeight: '600', letterSpacing: '3px', color: 'var(--gray-4)', marginBottom: '10px' },
  statValue: { fontSize: '36px', fontWeight: '900', letterSpacing: '-2px' },
  section: { background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', overflow: 'hidden' },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--gray-2)' },
  sectionLabel: { fontSize: '10px', fontWeight: '600', letterSpacing: '3px', color: 'var(--gray-4)' },
  sectionBtn: { background: 'none', border: 'none', fontSize: '12px', color: 'var(--gray-4)', cursor: 'none', fontWeight: '500' },
  table: { display: 'flex', flexDirection: 'column' },
  thead: { display: 'flex', padding: '10px 24px', background: 'var(--black)' },
  th: { fontSize: '9px', fontWeight: '600', letterSpacing: '2px', color: 'var(--gray-4)' },
  trow: { display: 'flex', padding: '14px 24px', borderTop: '1px solid var(--gray-2)', alignItems: 'center' },
  td: { fontSize: '13px', color: 'var(--gray-5)' },
  badge: { fontSize: '9px', fontWeight: '700', letterSpacing: '1px', border: '1px solid', padding: '2px 8px', borderRadius: '2px' },
  empty: { padding: '32px 24px', fontSize: '13px', color: 'var(--gray-4)' },
  emptyState: { padding: '60px 24px', textAlign: 'center' },
  emptyTitle: { fontSize: '16px', fontWeight: '600', color: 'var(--gray-3)', marginBottom: '8px' },
  emptyText: { fontSize: '13px', color: 'var(--gray-4)', lineHeight: 1.6 },
}