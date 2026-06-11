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

  useEffect(() => {
    async function load() {
      try {
        const [lr, cr] = await Promise.all([getLeads(), getCompanies()])
        const leads = lr.data.leads
        setStats({ totalLeads: leads.length, newLeads: leads.filter(l => l.status === 'new').length, contacted: leads.filter(l => l.status === 'contacted').length, companies: cr.data.companies.length })
        setRecentLeads(leads.slice(0, 8))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const displayName = localStorage.getItem('fullName') || user?.email?.split('@')[0] || 'there'

  return (
    <div style={s.page}>
      <Navbar />

      <div style={s.hero}>
        <div>
          <p style={s.eyebrow}>Overview</p>
          <h1 style={s.heroTitle}>
            {loading ? '—' : stats.totalLeads}
            <span style={s.heroUnit}> leads</span>
          </h1>
          <p style={s.heroSub}>Welcome back, {displayName}</p>
        </div>
      </div>

      <div style={s.container}>
        <div style={s.statsRow}>
          {[
            { label: 'New',       value: stats.newLeads,    note: 'awaiting action' },
            { label: 'Contacted', value: stats.contacted,   note: 'in progress' },
            { label: 'Companies', value: stats.companies,   note: 'tracked' },
            { label: 'Total',     value: stats.totalLeads,  note: 'all leads' },
          ].map(({ label, value, note }) => (
            <div key={label} style={s.statCard}>
              <p style={s.statLabel}>{label}</p>
              <p style={s.statValue}>{loading ? '—' : value}</p>
              <p style={s.statNote}>{note}</p>
            </div>
          ))}
        </div>

        <div style={s.section}>
          <div style={s.sectionHead}>
            <p style={s.sectionTitle}>Recent leads</p>
            <button style={s.viewAllBtn} onClick={() => navigate('/leads')}>View all →</button>
          </div>

          {loading ? (
            <p style={s.empty}>Loading…</p>
          ) : recentLeads.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>No leads yet</p>
              <p style={s.emptyText}>Use the Chrome extension on LinkedIn to extract your first leads.</p>
            </div>
          ) : (
            <div style={s.table}>
              <div style={s.thead}>
                {['Name', 'Role', 'Company', 'Status'].map(h => (
                  <span key={h} style={{ ...s.th, flex: h === 'Status' ? 1 : 2 }}>{h}</span>
                ))}
              </div>
              {recentLeads.map((lead, i) => (
                <div key={lead.id} style={{ ...s.trow, animationDelay: i * 0.04 + 's' }}>
                  <span style={{ ...s.td, flex: 2, color: 'var(--text)', fontWeight: '500' }}>{lead.name || '—'}</span>
                  <span style={{ ...s.td, flex: 2 }}>{lead.title || '—'}</span>
                  <span style={{ ...s.td, flex: 2 }}>{lead.company || '—'}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ ...s.badge, ...statusBadge(lead.status) }}>{(lead.status || 'new')}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function statusBadge(status) {
  const map = {
    new:           { color: '#4a7c59', background: 'rgba(74,124,89,0.10)',  border: 'rgba(74,124,89,0.22)' },
    contacted:     { color: '#a86448', background: 'rgba(168,100,72,0.10)', border: 'rgba(168,100,72,0.22)' },
    qualified:     { color: '#5b8db8', background: 'rgba(91,141,184,0.10)', border: 'rgba(91,141,184,0.22)' },
    disqualified:  { color: '#a1a1a1', background: 'rgba(161,161,161,0.10)', border: 'rgba(161,161,161,0.22)' },
  }
  const st = map[status] || map.new
  return { color: st.color, background: st.background, border: `1px solid ${st.border}` }
}

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  hero: { padding: '48px 40px 32px', borderBottom: '1px solid var(--border)' },
  eyebrow: { fontSize: '11px', fontWeight: '500', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' },
  heroTitle: { fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(44px, 6vw, 72px)', fontWeight: '400', color: 'var(--text)', letterSpacing: '-2px', lineHeight: 1, marginBottom: '8px' },
  heroUnit: { fontFamily: "'DM Serif Display', serif", fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: '400', color: 'var(--text-muted)' },
  heroSub: { fontSize: '13px', color: 'var(--text-muted)' },
  container: { padding: '28px 40px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '28px' },
  statCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 22px' },
  statLabel: { fontSize: '10px', fontWeight: '600', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' },
  statValue: { fontFamily: "'DM Serif Display', serif", fontSize: '36px', fontWeight: '400', color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1, marginBottom: '4px' },
  statNote: { fontSize: '11px', color: 'var(--text-muted)' },
  section: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' },
  sectionTitle: { fontSize: '13px', fontWeight: '500', color: 'var(--text)' },
  viewAllBtn: { background: 'none', border: 'none', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' },
  table: { display: 'flex', flexDirection: 'column' },
  thead: { display: 'flex', padding: '10px 20px', background: 'var(--bg)' },
  th: { fontSize: '10px', fontWeight: '600', letterSpacing: '1px', color: 'var(--text-muted)', textTransform: 'uppercase' },
  trow: { display: 'flex', padding: '12px 20px', borderTop: '1px solid var(--border)', alignItems: 'center' },
  td: { fontSize: '13px', color: 'var(--text-secondary)' },
  badge: { fontSize: '10px', fontWeight: '500', padding: '2px 8px', borderRadius: '4px' },
  empty: { padding: '28px 20px', fontSize: '13px', color: 'var(--text-muted)' },
  emptyState: { padding: '56px 24px', textAlign: 'center' },
  emptyTitle: { fontSize: '15px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '6px' },
  emptyText: { fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 },
}
