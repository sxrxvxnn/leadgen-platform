import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFeatureFlags } from '../context/FeatureFlagContext'
import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'https://leadgenengineplatform-api.vercel.app'

const SANS = "var(--font-sans, 'Host Grotesk', sans-serif)"
const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)"

function Ico({ d, size = 15, stroke = 'currentColor', fill = 'none', sw = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  )
}

const IC = {
  home: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10'],
  people: [
    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2',
    'M9 11a4 4 0 100-8 4 4 0 000 8',
    'M23 21v-2a4 4 0 00-3-3.87',
    'M16 3.13a4 4 0 010 7.75',
  ],
  companies: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10'],
  sequences: [
    'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z',
    'M22 6l-10 7L2 6',
  ],
  tasks: ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'],
  lists: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  analytics: 'M18 20V10M12 20V4M6 20v-6',
  settings: [
    'M12 15a3 3 0 100-6 3 3 0 000 6z',
    'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  ],
  prospect: 'M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0',
  email: [
    'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z',
    'M22 6l-10 7L2 6',
  ],
  database: [
    'M12 2C6.48 2 2 4.24 2 7s4.48 5 10 5 10-2.24 10-5-4.48-5-10-5z',
    'M2 17c0 2.76 4.48 5 10 5s10-2.24 10-5',
    'M2 12c0 2.76 4.48 5 10 5s10-2.24 10-5',
  ],
  targeting: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  notifs:
    'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  directory: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  unsubscr: [
    'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2',
    'M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z',
  ],
  enrichment: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
}

const NAV = [
  {
    items: [{ label: 'Home', path: '/dashboard', icon: 'home' }],
  },
  {
    label: 'Engage',
    items: [
      { label: 'Sequences', path: '/sequences', icon: 'sequences', flag: 'page_sequences' },
      { label: 'Tasks', path: '/tasks', icon: 'tasks', flag: 'page_tasks' },
    ],
  },
  {
    label: 'Find',
    items: [
      { label: 'People', path: '/people', icon: 'people' },
      { label: 'Companies', path: '/companies', icon: 'companies', flag: 'page_companies' },
      { label: 'Lists', path: '/lists', icon: 'lists' },
      { label: 'Prospect', path: '/prospect', icon: 'prospect', flag: 'page_prospect' },
      { label: 'Discovery', path: '/directory', icon: 'directory', flag: 'page_discovery' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Analytics', path: '/analytics', icon: 'analytics', flag: 'page_analytics' },
      { label: 'Email Finder', path: '/email-finder', icon: 'email', flag: 'page_email_finder' },
    ],
  },
  {
    label: 'Configure',
    items: [
      { label: 'Targeting', path: '/targeting', icon: 'targeting', flag: 'page_targeting' },
      { label: 'Notifications', path: '/notifications', icon: 'notifs', badge: true },
      { label: 'Unsubscribes', path: '/unsubscribes', icon: 'unsubscr', flag: 'page_unsubscribes' },
      { label: 'Settings', path: '/settings', icon: 'settings' },
    ],
  },
]

function NavItem({ label, path, icon, isActive, unreadCount }) {
  const [hov, setHov] = useState(false)
  const textColor = isActive ? '#fff' : hov ? 'var(--text-soft)' : 'var(--text-secondary)'

  return (
    <Link
      to={path}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '6px 10px',
        margin: '1px 6px',
        borderRadius: 6,
        textDecoration: 'none',
        background: isActive
          ? 'rgba(92,78,229,0.20)'
          : hov
            ? 'rgba(255,255,255,0.05)'
            : 'transparent',
        transition: 'background 0.1s',
        position: 'relative',
      }}
    >
      {isActive && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: 18,
            background: 'var(--accent)',
            borderRadius: '0 2px 2px 0',
          }}
        />
      )}
      <span
        style={{
          color: isActive ? 'var(--accent-light)' : textColor,
          flexShrink: 0,
          display: 'flex',
        }}
      >
        <Ico d={IC[icon]} color={isActive ? 'var(--accent-light)' : textColor} />
      </span>
      <span
        style={{
          fontFamily: SANS,
          fontSize: 13,
          fontWeight: isActive ? 500 : 400,
          color: textColor,
          flex: 1,
          letterSpacing: '0.01em',
        }}
      >
        {label}
      </span>
      {unreadCount > 0 && (
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 700,
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 10,
            padding: '1px 5px',
            lineHeight: 1.6,
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}

export default function Sidebar() {
  const { user, profile, logout, session } = useAuth()
  const { isEnabled } = useFeatureFlags()
  const location = useLocation()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    function update() {
      const key = user?.id ? `fullName_${user.id}` : 'fullName'
      const saved = localStorage.getItem(key) || localStorage.getItem('fullName')
      setDisplayName(saved || user?.email?.split('@')[0] || '')
    }
    update()
    window.addEventListener('nameUpdated', update)
    return () => window.removeEventListener('nameUpdated', update)
  }, [user])

  useEffect(() => {
    if (!session?.access_token) return
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API}/api/notifications`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        setUnreadNotifs(data.unseen || 0)
      } catch (_) {}
    }
    fetch_()
    const iv = setInterval(fetch_, 120000)
    return () => clearInterval(iv)
  }, [session])

  const isActive = (path) => location.pathname === path
  const isAdmin = profile?.role === 'admin'

  const initials = displayName
    ? displayName
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : (user?.email?.[0] || '?').toUpperCase()

  const sidebar = (
    <aside
      style={{
        width: 'var(--sidebar-width, 216px)',
        flexShrink: 0,
        height: '100vh',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: isMobile ? (mobileOpen ? 0 : -240) : 0,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        zIndex: 100,
        transition: isMobile ? 'left 0.22s ease' : 'none',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '15px 14px 11px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <Link
          to="/dashboard"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: 'linear-gradient(135deg, #5c4ee5 0%, #7b6ff0 100%)',
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(92,78,229,0.4)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
              <circle cx="8" cy="8" r="3.5" stroke="#fff" strokeWidth="1.2" opacity="0.9" />
              <circle cx="8" cy="8" r="1.2" fill="#fff" />
              <line
                x1="9"
                y1="7"
                x2="13.5"
                y2="2.5"
                stroke="#fff"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "'Barlow Condensed', 'Host Grotesk', sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Sonar
          </span>
        </Link>
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
        {NAV.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 2 }}>
            {group.label && (
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  padding: '10px 16px 3px',
                  margin: 0,
                }}
              >
                {group.label}
              </p>
            )}
            {group.items
              .filter((item) => {
                if (item.adminOnly && !isAdmin) return false
                if (item.flag && !isEnabled(item.flag)) return false
                return true
              })
              .map((item) => (
                <NavItem
                  key={item.path}
                  {...item}
                  isActive={isActive(item.path)}
                  unreadCount={item.badge ? unreadNotifs : 0}
                />
              ))}
          </div>
        ))}

        {isAdmin && (
          <div style={{ marginTop: 4 }}>
            <p
              style={{
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '10px 16px 3px',
                margin: 0,
              }}
            >
              Admin
            </p>
            <NavItem
              label="Database"
              path="/database"
              icon="database"
              isActive={isActive('/database')}
            />
            <NavItem label="Admin" path="/admin" icon="settings" isActive={isActive('/admin')} />
          </div>
        )}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', flexShrink: 0 }}>
        <div
          onClick={() => navigate('/settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '6px 8px',
            borderRadius: 7,
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #5c4ee5, #7b6ff0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              fontFamily: SANS,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: SANS,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text)',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName || 'User'}
            </p>
            <p
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: 'var(--text-muted)',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.email || ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            logout()
            navigate('/')
          }}
          style={{
            width: '100%',
            marginTop: 6,
            fontFamily: SANS,
            fontSize: 12,
            padding: '5px 8px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'color 0.12s, border-color 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text)'
            e.currentTarget.style.borderColor = 'var(--border-strong)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {isMobile && (
        <button
          onClick={() => setMobileOpen((v) => !v)}
          style={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 200,
            width: 36,
            height: 36,
            borderRadius: 6,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text)',
          }}
        >
          {mobileOpen ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          )}
        </button>
      )}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99 }}
        />
      )}
      {sidebar}
    </>
  )
}
