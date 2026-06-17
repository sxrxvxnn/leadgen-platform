import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getLeads, getCompanies } from '../services/api'
import Navbar from '../components/Navbar'
import { Skeleton, SkeletonRow } from '../components/Skeleton'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ totalLeads: 0, newLeads: 0, contacted: 0, companies: 0 })
  const [recentLeads, setRecentLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showExtBanner, setShowExtBanner] = useState(() => localStorage.getItem('extBannerDismissed') !== '1')
  const [extStepsOpen, setExtStepsOpen] = useState(false)

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
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Hero */}
      <div style={{ position: 'relative', padding: '64px 48px 48px', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
        {/* Ambient glow */}
        <div style={{ position: 'relative' }}>
          <p style={s.eyebrow}>Overview</p>
          <h1 style={s.heroTitle}>
            {loading ? '—' : stats.totalLeads}
            <span style={s.heroUnit}> leads</span>
          </h1>
          <p style={s.heroSub}>welcome back, {displayName}</p>
        </div>
      </div>

      {/* Extension banner */}
      {showExtBanner && (
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--accent-dimmer)' }}>
          {/* Top row */}
          <div style={{ padding: '14px 48px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 28, height: 28, background: 'var(--text)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#fffcfc" strokeWidth="1.2" opacity="0.3"/>
                <circle cx="8" cy="8" r="4" stroke="#fffcfc" strokeWidth="1.2" opacity="0.65"/>
                <circle cx="8" cy="8" r="1.5" fill="#fffcfc"/>
                <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#fffcfc" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Install the Sonar Chrome extension</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)', marginLeft: 8 }}>— extract leads from LinkedIn with one click.</span>
            </div>
            <a
              href="/sonar-extension.zip"
              download
              onClick={() => setExtStepsOpen(true)}
              style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--text)', background: '#ffffff', border: '1px solid var(--border-strong)', borderRadius: 3, padding: '6px 14px', textDecoration: 'none', flexShrink: 0 }}
            >
              Download ↓
            </a>
            <button onClick={() => { setShowExtBanner(false); localStorage.setItem('extBannerDismissed', '1') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '0 4px', lineHeight: 1, flexShrink: 0 }} aria-label="Dismiss">✕</button>
          </div>
          {/* Install steps — shown after download click */}
          {extStepsOpen && (
            <div style={{ padding: '0 48px 20px', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
              {[
                ['1', 'Unzip the downloaded file'],
                ['2', 'Open chrome://extensions in Chrome'],
                ['3', 'Toggle on Developer mode (top right)'],
                ['4', 'Click Load unpacked → select the folder'],
                ['5', 'Pin Sonar to toolbar and sign in'],
              ].map(([n, t]) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-light)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats — gap-px grid, no rounded cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#c4c1bd', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'New',       value: stats.newLeads,   note: 'awaiting action' },
          { label: 'Contacted', value: stats.contacted,  note: 'in progress' },
          { label: 'Companies', value: stats.companies,  note: 'tracked' },
          { label: 'Total',     value: stats.totalLeads, note: 'all leads' },
        ].map(({ label, value, note }) => (
          <div key={label} style={{ background: 'var(--bg)', padding: '28px 32px' }}>
            <p style={s.statLabel}>{label}</p>
            <p style={s.statValue}>{loading ? <Skeleton w={48} h={40} r={4} /> : value}</p>
            <p style={s.statNote}>{note}</p>
          </div>
        ))}
      </div>

      {/* Recent leads */}
      <div style={{ padding: '0 48px 48px' }}>
        {/* Section header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 0 16px', borderBottom: '1px solid var(--border)', marginBottom: '0' }}>
          <p style={s.sectionTitle}>Recent leads</p>
          <button style={s.viewAllBtn} onClick={() => navigate('/leads')}>View all →</button>
        </div>

        {loading ? (
          <div>
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
            {/* Table head */}
            <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid rgba(196,193,189,0.5)' }}>
              {['Name', 'Role', 'Company', 'Status'].map(h => (
                <span key={h} style={{ ...s.th, flex: h === 'Status' ? 1 : 2 }}>{h}</span>
              ))}
            </div>
            {recentLeads.map((lead) => (
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
  eyebrow:    { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' },
    heroTitle:  { fontFamily: 'var(--font-display)', fontSize: 'clamp(64px, 9vw, 112px)', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.05em', lineHeight: 1, marginBottom: '12px' },
  heroUnit:   { fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4.5vw, 56px)', fontWeight: '400', color: 'var(--text-muted)' },
  heroSub:    { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.04em' },
  statLabel:  { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' },
  statValue:  { fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: '900', color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '6px' },
  statNote:   { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' },
  sectionTitle: { fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', color: 'var(--text)', textTransform: 'uppercase' },
  viewAllBtn: { fontFamily: 'var(--font-mono)', background: 'none', border: 'none', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' },
  th:         { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' },
  trow:       { display: 'flex', padding: '14px 0', borderBottom: '1px solid rgba(196,193,189,0.4)', alignItems: 'center' },
  badge:      { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.06em', textTransform: 'uppercase' },
  empty:      { padding: '40px 0', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  emptyState: { padding: '72px 0', textAlign: 'center' },
  emptyTitle: { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '400', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '-0.03em' },
  emptyText:  { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 },
}
