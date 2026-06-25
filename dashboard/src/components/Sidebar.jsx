import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFeatureFlags } from '../context/FeatureFlagContext'
import { useState, useEffect } from 'react'

const SANS    = "var(--font-sans, 'Host Grotesk', sans-serif)"
const MONO    = "var(--font-mono, 'IBM Plex Mono', monospace)"
const DISPLAY = "var(--font-display, 'Barlow Condensed', sans-serif)"

// ── Icons ─────────────────────────────────────────────────────────
function Icon({ d, size = 16, color = 'currentColor', fill = 'none', strokeWidth = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  )
}

const ICONS = {
  home:      ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10'],
  search:    'M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0',
  leads:     ['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M9 11a4 4 0 100-8 4 4 0 000 8', 'M23 21v-2a4 4 0 00-3-3.87', 'M16 3.13a4 4 0 010 7.75'],
  companies: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10'],
  sequences: ['M3 8l7.89 5.26a2 2 0 002.22 0L21 8', 'M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'],
  targeting: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  settings:  ['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'],
  directory: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  prospect:  ['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M9 11a4 4 0 100-8 4 4 0 000 8', 'M23 21v-2a4 4 0 00-3-3.87', 'M16 3.13a4 4 0 011.93 3.87M21 21l-2-2'],
  email:     ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'],
  database:  ['M12 2C6.48 2 2 4.24 2 7s4.48 5 10 5 10-2.24 10-5-4.48-5-10-5z', 'M2 17c0 2.76 4.48 5 10 5s10-2.24 10-5', 'M2 12c0 2.76 4.48 5 10 5s10-2.24 10-5'],
  tasks:     ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'],
  analytics:    'M18 20V10M12 20V4M6 20v-6',
  unsubscribes: ['M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2', 'M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z'],
}

const NAV_GROUPS = [
  {
    items: [
      { label: 'Home',         path: '/dashboard',   icon: 'home' },
      { label: 'Prospect',     path: '/prospect',    icon: 'prospect',  flag: 'page_prospect' },
      { label: 'Email Finder', path: '/email-finder',icon: 'email',     flag: 'page_email_finder' },
      { label: 'Database',     path: '/database',    icon: 'database',  adminOnly: true },
      { label: 'Discovery',    path: '/directory',   icon: 'directory', flag: 'page_discovery' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Leads',     path: '/leads',     icon: 'leads',     flag: 'page_leads' },
      { label: 'Companies', path: '/companies', icon: 'companies', flag: 'page_companies' },
      { label: 'Sequences', path: '/sequences', icon: 'sequences', flag: 'page_sequences' },
      { label: 'Tasks',     path: '/tasks',     icon: 'tasks',     flag: 'page_tasks' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', path: '/analytics', icon: 'analytics', flag: 'page_analytics' },
    ],
  },
  {
    label: 'Configure',
    items: [
      { label: 'Targeting',    path: '/targeting',    icon: 'targeting',    flag: 'page_targeting' },
      { label: 'Unsubscribes', path: '/unsubscribes', icon: 'unsubscribes', flag: 'page_unsubscribes' },
      { label: 'Settings',     path: '/settings',     icon: 'settings' },
    ],
  },
]

function NavItem({ label, path, icon, isActive }) {
  const [hovered, setHovered] = useState(false)
  const color = isActive ? 'var(--text)' : hovered ? 'var(--text-secondary)' : 'var(--text-muted)'

  return (
    <Link
      to={path}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 16px',
        textDecoration: 'none',
        borderRadius: 5,
        margin: '1px 8px',
        background: isActive ? 'var(--surface)' : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'all 0.12s',
      }}
    >
      <span style={{ color, flexShrink: 0 }}>
        <Icon d={ICONS[icon]} color={color} size={15} />
      </span>
      <span style={{
        fontFamily: SANS,
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        color,
        letterSpacing: '0.01em',
      }}>
        {label}
      </span>
    </Link>
  )
}

export default function Sidebar() {
  const { user, profile, logout } = useAuth()
  const { isEnabled } = useFeatureFlags()
  const location = useLocation()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    function update() {
      const key   = user?.id ? `fullName_${user.id}` : 'fullName'
      const saved = localStorage.getItem(key) || localStorage.getItem('fullName')
      setDisplayName(saved || user?.email?.split('@')[0] || '')
    }
    update()
    window.addEventListener('nameUpdated', update)
    return () => window.removeEventListener('nameUpdated', update)
  }, [user])

  const isActive = (path) => location.pathname === path
  const isAdmin  = profile?.role === 'admin'

  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email?.[0] || '?').toUpperCase()

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      height: '100vh',
      position: 'sticky',
      top: 0,
      background: 'var(--bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      zIndex: 50,
    }}>

      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <Link to="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, background: '#E7000B', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
              <circle cx="8" cy="8" r="4" stroke="#fff" strokeWidth="1.2" opacity="0.85" />
              <circle cx="8" cy="8" r="1.5" fill="#fff" />
              <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Sonar
          </span>
        </Link>
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 4 }}>
            {group.label && (
              <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 24px 4px', margin: 0 }}>
                {group.label}
              </p>
            )}
            {group.items.filter(item => {
              if (item.adminOnly && !isAdmin) return false
              if (item.flag && !isEnabled(item.flag)) return false
              return true
            }).map(item => (
              <NavItem key={item.path} {...item} isActive={isActive(item.path)} />
            ))}
          </div>
        ))}

        {isAdmin && profile?.mode === 'team' && (
          <div style={{ marginTop: 4 }}>
            <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 24px 4px', margin: 0 }}>
              Admin
            </p>
            <NavItem label="Admin" path="/admin" icon="settings" isActive={isActive('/admin')} />
          </div>
        )}
      </nav>

      {/* User section */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>{initials}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: SANS, fontSize: 12, fontWeight: 500, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName || 'User'}
            </p>
            <p style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email || ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/') }}
          style={{ width: '100%', fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', padding: '6px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', textAlign: 'left', transition: 'color 0.12s, border-color 0.12s' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
