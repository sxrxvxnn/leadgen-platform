import { Link, useLocation } from 'react-router-dom'

const DISPLAY = "var(--font-display, 'Barlow Condensed', sans-serif)"
const SANS    = "var(--font-sans, 'Host Grotesk', sans-serif)"

const PAGE_TITLES = {
  '/dashboard':   'Home',
  '/leads':       'Leads',
  '/companies':   'Companies',
  '/prospect':    'Prospect',
  '/sequences':   'Sequences',
  '/tasks':       'Tasks',
  '/analytics':   'Analytics',
  '/targeting':   'Targeting',
  '/settings':    'Settings',
  '/notifications': 'Notifications',
  '/unsubscribes':  'Unsubscribes',
  '/directory':   'Discovery',
  '/email-finder':'Email Finder',
  '/database':    'Database',
}

export default function MobileHeader() {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || 'Sonar'

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      height: 52,
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
    }}>
      {/* Logo mark */}
      <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
        <div style={{
          width: 26, height: 26, background: '#E7000B', borderRadius: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
            <circle cx="8" cy="8" r="4" stroke="#fff" strokeWidth="1.2" opacity="0.85" />
            <circle cx="8" cy="8" r="1.5" fill="#fff" />
            <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <span style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Sonar
        </span>
      </Link>

      {/* Page title */}
      <span style={{
        fontFamily: SANS,
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--text-muted)',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        / {title}
      </span>
    </header>
  )
}
