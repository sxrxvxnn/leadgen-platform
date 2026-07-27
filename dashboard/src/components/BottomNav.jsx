import { Link, useLocation } from 'react-router-dom'

const DISPLAY = "var(--font-display, 'Barlow Condensed', sans-serif)"
const SANS = "var(--font-sans, 'Host Grotesk', sans-serif)"

function Icon({ d, size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  )
}

const BOTTOM_NAV = [
  {
    label: 'Home',
    path: '/dashboard',
    d: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10'],
  },
  {
    label: 'Leads',
    path: '/leads',
    d: [
      'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2',
      'M9 11a4 4 0 100-8 4 4 0 000 8',
      'M23 21v-2a4 4 0 00-3-3.87',
      'M16 3.13a4 4 0 010 7.75',
    ],
  },
  {
    label: 'Companies',
    path: '/companies',
    d: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10'],
  },
  {
    label: 'Prospect',
    path: '/prospect',
    d: [
      'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2',
      'M9 11a4 4 0 100-8 4 4 0 000 8',
      'M23 21v-2a4 4 0 00-3-3.87',
      'M16 3.13a4 4 0 011.93 3.87M21 21l-2-2',
    ],
  },
  {
    label: 'Settings',
    path: '/settings',
    d: [
      'M12 15a3 3 0 100-6 3 3 0 000 6z',
      'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
    ],
  },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <>
      {/* Spacer so content doesn't hide behind fixed bar */}
      <div style={{ height: 64, flexShrink: 0 }} />

      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          background: 'var(--bg)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'stretch',
          height: 64,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {BOTTOM_NAV.map(({ label, path, d }) => {
          const active = location.pathname === path
          return (
            <Link
              key={path}
              to={path}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                textDecoration: 'none',
                color: active ? '#E7000B' : 'var(--text-muted)',
                transition: 'color 0.12s',
                padding: '8px 4px 4px',
              }}
            >
              <Icon d={d} size={20} />
              <span
                style={{
                  fontFamily: SANS,
                  fontSize: 10,
                  fontWeight: active ? 700 : 400,
                  letterSpacing: '0.01em',
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
