import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'

const NAV_LINKS = [
  { label: 'Overview', path: '/dashboard' },
  { label: 'Discovery', path: '/directory' },
  { label: 'Companies', path: '/companies' },
  { label: 'Targeting', path: '/targeting' },
  { label: 'Leads', path: '/leads' },
  { label: 'Sequences', path: '/sequences' },
  { label: 'Settings', path: '/settings' },
]

const DARK = '#FFFFFF'
const BORDER = '#E5E7EB'
const INK = '#0A0A0A'
const STEEL = '#6B7280'
const ACCENT = '#E7000B'
const LOGO_BG = '#E7000B'
const SANS = "'Host Grotesk', 'Roboto', sans-serif"
const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif"

export default function Navbar() {
  const { user, profile, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    function updateName() {
      const key = user?.id ? `fullName_${user.id}` : 'fullName'
      const saved = localStorage.getItem(key) || localStorage.getItem('fullName')
      setDisplayName(saved || user?.email?.split('@')[0] || '')
    }
    updateName()
    window.addEventListener('nameUpdated', updateName)
    return () => window.removeEventListener('nameUpdated', updateName)
  }, [user])

  const isActive = (path) => location.pathname === path
  const handleLogout = () => {
    logout()
    navigate('/')
  }
  const isAdmin = profile?.role === 'admin'

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: DARK,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div
        style={{
          padding: '0 32px',
          height: '56px',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        {/* Logo - left */}
        <Link
          to="/dashboard"
          style={{
            textDecoration: 'none',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              background: LOGO_BG,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.5" />
              <circle cx="8" cy="8" r="4" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.85" />
              <circle cx="8" cy="8" r="1.5" fill="#FFFFFF" />
              <line
                x1="9.1"
                y1="6.9"
                x2="13"
                y2="3"
                stroke="#FFFFFF"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontFamily: DISPLAY,
              fontSize: '18px',
              fontWeight: '700',
              color: INK,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Sonar
          </span>
        </Link>

        {/* Nav links - center */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {NAV_LINKS.map(({ label, path }) => (
            <Link
              key={path}
              to={path}
              style={{
                fontFamily: SANS,
                fontSize: '11px',
                fontWeight: '500',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: isActive(path) ? INK : STEEL,
                padding: '5px 12px',
                textDecoration: 'none',
                borderRadius: 0,
                background: isActive(path) ? 'rgba(0,0,0,0.05)' : 'transparent',
                borderBottom: isActive(path) ? `1px solid ${ACCENT}` : '1px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive(path)) e.currentTarget.style.color = INK
              }}
              onMouseLeave={(e) => {
                if (!isActive(path)) e.currentTarget.style.color = STEEL
              }}
            >
              {label}
            </Link>
          ))}
          {isAdmin && profile?.mode === 'team' && (
            <Link
              to="/admin"
              style={{
                fontFamily: SANS,
                fontSize: '11px',
                fontWeight: '500',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: isActive('/admin') ? INK : STEEL,
                padding: '5px 12px',
                textDecoration: 'none',
                background: isActive('/admin') ? 'rgba(255,255,255,0.07)' : 'transparent',
                borderBottom: isActive('/admin') ? `1px solid ${ACCENT}` : '1px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive('/admin')) e.currentTarget.style.color = INK
              }}
              onMouseLeave={(e) => {
                if (!isActive('/admin')) e.currentTarget.style.color = STEEL
              }}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Right actions - right */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end' }}
        >
          {displayName && (
            <span
              style={{ fontFamily: SANS, fontSize: '12px', color: STEEL, letterSpacing: '0.04em' }}
            >
              {displayName}
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{
              fontFamily: SANS,
              fontSize: '11px',
              fontWeight: '500',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '6px 14px',
              background: 'transparent',
              color: INK,
              border: `1px solid ${BORDER}`,
              borderRadius: 0,
              cursor: 'pointer',
              transition: 'border-color 0.15s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = ACCENT
              e.currentTarget.style.boxShadow = `0 0 10px rgba(231,0,11,0.15)`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = BORDER
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
