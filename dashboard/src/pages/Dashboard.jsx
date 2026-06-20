import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../context/AuthContext'
import { getLeads, getCompanies } from '../services/api'
import api from '../services/api'
import Navbar from '../components/Navbar'
import { Skeleton, SkeletonRow } from '../components/Skeleton'
import { CountUp } from '../components/ui/CountUp'
import { Tabs } from '../components/ui/Tabs'
import Globe from '../components/Globe'
import ImagesFanBadge from '../components/ImagesFanBadge'
import CanvasText from '../components/CanvasText'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats]         = useState({ totalLeads: 0, newLeads: 0, contacted: 0, companies: 0 })
  const [analytics, setAnalytics] = useState(null)
  const [recentLeads, setRecentLeads]     = useState([])
  const [recentCompanies, setRecentCompanies] = useState([])
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('leads')
  const [showExtBanner, setShowExtBanner] = useState(() => localStorage.getItem('extBannerDismissed') !== '1')
  const [extStepsOpen, setExtStepsOpen]   = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [lr, cr, ar] = await Promise.all([getLeads(), getCompanies(), api.get('/analytics')])
        const leads     = lr.data.leads
        const companies = cr.data.companies
        setStats({
          totalLeads: leads.length,
          newLeads:   leads.filter(l => l.status === 'new').length,
          contacted:  leads.filter(l => l.status === 'contacted').length,
          companies:  companies.length,
        })
        setAnalytics(ar.data)
        setRecentLeads(leads.slice(0, 8))
        setRecentCompanies(companies.slice(0, 8))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const displayName = localStorage.getItem('fullName') || user?.email?.split('@')[0] || 'there'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', padding: '64px 48px 48px', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
        <motion.div
          style={{ position: 'relative' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <p style={s.eyebrow}>Overview</p>
          <h1 style={{ ...s.heroTitle, display: 'flex', alignItems: 'flex-end', gap: 0, flexWrap: 'wrap' }}>
            <span>{loading ? '—' : <CountUp to={stats.totalLeads} delay={0.1} />}</span>
            {!loading && (
              <CanvasText
                text=" leads"
                font='300 52px "IBM Plex Sans","DM Sans","Inter",sans-serif'
                width={248}
                height={70}
                style={{ position: 'relative', top: -2, opacity: 0.92 }}
              />
            )}
          </h1>
          <p style={s.heroSub}>welcome back, {displayName}</p>
        </motion.div>
      </div>

      {/* ── Extension banner ──────────────────────────────────────────────── */}
      {showExtBanner && (
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--accent-dimmer)' }}>
          <div style={{ padding: '14px 48px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 28, height: 28, background: 'var(--accent-dim)', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#121212" strokeWidth="1.2" opacity="0.4"/>
                <circle cx="8" cy="8" r="4" stroke="#121212" strokeWidth="1.2" opacity="0.75"/>
                <circle cx="8" cy="8" r="1.5" fill="#121212"/>
                <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#121212" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Install the Sonar Chrome extension</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)', marginLeft: 8 }}>— extract leads from LinkedIn with one click.</span>
            </div>
            <a href="/sonar-extension.zip" download onClick={() => setExtStepsOpen(true)}
              style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF', background: 'var(--accent)', border: 'none', borderRadius: 0, padding: '6px 14px', textDecoration: 'none', flexShrink: 0 }}>
              Download ↓
            </a>
            <button onClick={() => { setShowExtBanner(false); localStorage.setItem('extBannerDismissed', '1') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '0 4px', lineHeight: 1, flexShrink: 0 }} aria-label="Dismiss">✕</button>
          </div>
          {extStepsOpen && (
            <div style={{ padding: '0 48px 20px', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
              {[['1','Unzip the downloaded file'],['2','Open chrome://extensions in Chrome'],['3','Toggle on Developer mode (top right)'],['4','Click Load unpacked → select the folder'],['5','Pin Sonar to toolbar and sign in']].map(([n, t]) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-light)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bento stats grid ──────────────────────────────────────────────── */}
      {/* Row 1: New · Contacted · Companies  |  Row 2: Total summary (2 cols) · Globe */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: '190px 210px',
        gap: '1px',
        background: 'var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>

        {/* New leads — col 1, row 1 */}
        <motion.div
          style={{ background: 'var(--bg)', padding: '28px 32px', gridColumn: '1/2', gridRow: '1/2', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        >
          <p style={s.statLabel}>New</p>
          <p style={{ ...s.statValue, color: '#4a7c59' }}>
            {loading ? <Skeleton w={48} h={40} r={4} /> : <CountUp to={stats.newLeads} delay={0.1} />}
          </p>
          <p style={s.statNote}>awaiting action</p>
        </motion.div>

        {/* Contacted — col 2, row 1 */}
        <motion.div
          style={{ background: 'var(--bg)', padding: '28px 32px', gridColumn: '2/3', gridRow: '1/2', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
        >
          <p style={s.statLabel}>Contacted</p>
          <p style={{ ...s.statValue, color: '#a86448' }}>
            {loading ? <Skeleton w={48} h={40} r={4} /> : <CountUp to={stats.contacted} delay={0.18} />}
          </p>
          <p style={s.statNote}>in progress</p>
        </motion.div>

        {/* Companies — col 3, row 1 */}
        <motion.div
          style={{ background: 'var(--bg)', padding: '28px 32px', gridColumn: '3/4', gridRow: '1/2', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.19 }}
        >
          <p style={s.statLabel}>Companies</p>
          <p style={{ ...s.statValue, color: '#5b8db8' }}>
            {loading ? <Skeleton w={48} h={40} r={4} /> : <CountUp to={stats.companies} delay={0.26} />}
          </p>
          <p style={s.statNote}>tracked</p>
        </motion.div>

        {/* Total summary — cols 1-2, row 2 */}
        <motion.div
          style={{
            background: 'var(--bg)', padding: '28px 36px',
            gridColumn: '1/3', gridRow: '2/3',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.26 }}
        >
          <div>
            <p style={s.statLabel}>Pipeline</p>
            <p style={{ ...s.statValue, fontSize: 'clamp(40px, 5vw, 60px)', marginBottom: 12 }}>
              {loading ? <Skeleton w={72} h={48} r={4} /> : <CountUp to={stats.totalLeads} delay={0.32} />}
            </p>
            {!loading && (
              <CanvasText
                text="leads total"
                font='600 22px "IBM Plex Sans","DM Sans","Inter",sans-serif'
                width={168}
                height={36}
                style={{ opacity: 0.85 }}
              />
            )}
          </div>
          {/* Mini funnel breakdown */}
          {!loading && stats.totalLeads > 0 && (
            <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
              {[
                { label: 'New',       value: stats.newLeads,  color: '#4a7c59' },
                { label: 'Contacted', value: stats.contacted, color: '#a86448' },
                { label: 'Companies', value: stats.companies, color: '#5b8db8' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {label} <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{value}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Globe — col 3, row 2 */}
        <motion.div
          style={{
            background: 'var(--bg)', gridColumn: '3/4', gridRow: '2/3',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.33 }}
        >
          <Globe size={152} />
          <p style={{ ...s.statNote, fontSize: '9px', letterSpacing: '0.1em', textAlign: 'center' }}>Technopark · Kerala</p>
        </motion.div>

      </div>

      {/* ── Analytics strip ───────────────────────────────────────────────── */}
      {analytics && (
        <div style={{ padding: '24px 48px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, overflowX: 'auto' }}>
          {[
            { label: 'Avg ICP Score',    value: analytics.leads.avg_score || 0,              suffix: '/100', color: analytics.leads.avg_score >= 70 ? '#4a7c59' : 'var(--text)' },
            { label: 'High-Value Leads', value: analytics.leads.high_value || 0,             suffix: '', color: '#E7000B' },
            { label: 'Leads Scored',     value: analytics.leads.scored || 0,                 suffix: `/${analytics.leads.total}`, color: 'var(--text)' },
            { label: 'Sequences',        value: analytics.sequences.active || 0,             suffix: ' active', color: '#5b8db8' },
            { label: 'Enrolled',         value: analytics.sequences.total_enrolled || 0,     suffix: '', color: 'var(--text)' },
            { label: 'Reply Rate',       value: analytics.sequences.reply_rate || 0,         suffix: '%', color: analytics.sequences.reply_rate >= 10 ? '#4a7c59' : 'var(--text)' },
          ].map((m, i) => (
            <div key={m.label} style={{ flex: '0 0 auto', minWidth: 130, padding: '0 28px', borderRight: i < 5 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: m.color, letterSpacing: '-0.02em' }}>
                <CountUp to={m.value} delay={0.1} /><span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>{m.suffix}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Recent section with Tabs ──────────────────────────────────────── */}
      <div style={{ padding: '0 48px 56px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 0', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Tabs
              value={activeTab}
              onChange={setActiveTab}
              tabs={[
                { value: 'leads',     label: 'Recent leads',     count: loading ? null : recentLeads.length },
                { value: 'companies', label: 'Recent companies',  count: loading ? null : recentCompanies.length },
              ]}
              style={{ borderBottom: '1px solid var(--border)' }}
            />
            {!loading && activeTab === 'leads' && recentLeads.length > 0 && (
              <ImagesFanBadge leads={recentLeads} max={5} />
            )}
          </div>
          <button
            style={s.viewAllBtn}
            onClick={() => navigate(activeTab === 'leads' ? '/leads' : '/companies')}
          >
            View all →
          </button>
        </div>

        {/* Leads tab */}
        {activeTab === 'leads' && (
          loading ? (
            <div style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid rgba(196,193,189,0.5)' }}>
                {['Name', 'Role', 'Company', 'Status'].map(h => (
                  <span key={h} style={{ ...s.th, flex: h === 'Status' ? 1 : 2 }}>{h}</span>
                ))}
              </div>
              {[...Array(5)].map((_, i) => <SkeletonRow key={i} cols={[2, 2, 2, 1]} />)}
            </div>
          ) : recentLeads.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>No leads yet</p>
              <p style={s.emptyText}>Use the Chrome extension on LinkedIn to extract your first leads.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid rgba(196,193,189,0.5)' }}>
                {['Name', 'Role', 'Company', 'Status'].map(h => (
                  <span key={h} style={{ ...s.th, flex: h === 'Status' ? 1 : 2 }}>{h}</span>
                ))}
              </div>
              {recentLeads.map(lead => (
                <div key={lead.id} style={s.trow}>
                  <span style={{ flex: 2, fontSize: '13px', color: 'var(--text)', fontWeight: '500' }}>{lead.name || '—'}</span>
                  <span style={{ flex: 2, fontSize: '12px', color: 'var(--text-secondary)' }}>{lead.title || '—'}</span>
                  <span style={{ flex: 2, fontSize: '12px', color: 'var(--text-secondary)' }}>{lead.company || '—'}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ ...s.badge, ...statusBadge(lead.status) }}>{lead.status || 'new'}</span>
                  </span>
                </div>
              ))}
            </div>
          )
        )}

        {/* Companies tab */}
        {activeTab === 'companies' && (
          loading ? (
            <div style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid rgba(196,193,189,0.5)' }}>
                {['Name', 'Industry', 'Location', 'ICP'].map(h => (
                  <span key={h} style={{ ...s.th, flex: h === 'ICP' ? 1 : 2 }}>{h}</span>
                ))}
              </div>
              {[...Array(5)].map((_, i) => <SkeletonRow key={i} cols={[2, 2, 2, 1]} />)}
            </div>
          ) : recentCompanies.length === 0 ? (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>No companies yet</p>
              <p style={s.emptyText}>Discover companies in the Companies page to start building your pipeline.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid rgba(196,193,189,0.5)' }}>
                {['Name', 'Industry', 'Location', 'ICP'].map(h => (
                  <span key={h} style={{ ...s.th, flex: h === 'ICP' ? 1 : 2 }}>{h}</span>
                ))}
              </div>
              {recentCompanies.map(co => (
                <div key={co.id} style={s.trow}>
                  <span style={{ flex: 2, fontSize: '13px', color: 'var(--text)', fontWeight: '500' }}>{co.name || '—'}</span>
                  <span style={{ flex: 2, fontSize: '12px', color: 'var(--text-secondary)' }}>{co.industry || '—'}</span>
                  <span style={{ flex: 2, fontSize: '12px', color: 'var(--text-secondary)' }}>{co.location || co.city || '—'}</span>
                  <span style={{ flex: 1 }}>
                    {co.icp_score != null
                      ? <span style={{ ...s.badge, color: '#5b8db8', background: 'rgba(91,141,184,0.10)', border: '1px solid rgba(91,141,184,0.22)' }}>{co.icp_score}</span>
                      : <span style={{ ...s.badge, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)' }}>—</span>
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

function statusBadge(status) {
  const map = {
    new:          { color: '#4a7c59', background: 'rgba(74,124,89,0.10)',  border: 'rgba(74,124,89,0.22)' },
    contacted:    { color: '#a86448', background: 'rgba(168,100,72,0.10)', border: 'rgba(168,100,72,0.22)' },
    qualified:    { color: '#5b8db8', background: 'rgba(91,141,184,0.10)', border: 'rgba(91,141,184,0.22)' },
    disqualified: { color: '#a1a1a1', background: 'rgba(161,161,161,0.10)', border: 'rgba(161,161,161,0.22)' },
  }
  const st = map[status] || map.new
  return { color: st.color, background: st.background, border: `1px solid ${st.border}` }
}

const s = {
  eyebrow:      { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' },
  heroTitle:    { fontFamily: 'var(--font-display)', fontSize: 'clamp(64px, 9vw, 112px)', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.05em', lineHeight: 1, marginBottom: '12px' },
  heroSub:      { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.04em' },
  statLabel:    { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' },
  statValue:    { fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '6px' },
  statNote:     { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', margin: 0 },
  sectionTitle: { fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', color: 'var(--text)', textTransform: 'uppercase' },
  viewAllBtn:   { fontFamily: 'var(--font-mono)', background: 'none', border: 'none', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' },
  th:           { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' },
  trow:         { display: 'flex', padding: '14px 0', borderBottom: '1px solid rgba(196,193,189,0.4)', alignItems: 'center' },
  badge:        { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' },
  emptyState:   { padding: '72px 0', textAlign: 'center' },
  emptyTitle:   { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '400', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '-0.03em' },
  emptyText:    { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 },
}
