import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'

const NAV_LINKS = [
  { label: 'Overview',  path: '/dashboard' },
  { label: 'Discovery', path: '/directory' },
  { label: 'Companies', path: '/companies' },
  { label: 'Targeting', path: '/targeting' },
  { label: 'Leads',     path: '/leads' },
  { label: 'Settings',  path: '/settings' },
]

const DARK    = '#121212'
const BORDER  = '#2A2A2A'
const INK     = '#F5F5F5'
const STEEL   = '#5B6670'
const ACCENT  = '#FFFF00'
const SANS    = "'Host Grotesk', 'Roboto', sans-serif"
const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif"

export default function Navbar() {
  const { user, profile, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    function updateName() {
      const saved = localStorage.getItem('fullName')
      setDisplayName(saved || user?.email?.split('@')[0] || '')
    }
    updateName()
    window.addEventListener('nameUpdated', updateName)
    return () => window.removeEventListener('nameUpdated', updateName)
  }, [user])

  const isActive = (path) => location.pathname === path
  const handleLogout = () => { logout(); navigate('/') }
  const isAdmin = profile?.role === 'admin'

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: DARK,
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <div style={{
        padding: '0 32px',
        height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
      }}>

        {/* Logo */}
        <Link to="/dashboard" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{
            fontFamily: DISPLAY,
            fontSize: '18px', fontWeight: '700',
            color: INK, letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            Sonar
          </span>
        </Link>

        {/* Center nav */}
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
                background: isActive(path) ? 'rgba(255,255,255,0.07)' : 'transparent',
                borderBottom: isActive(path) ? `1px solid ${ACCENT}` : '1px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive(path)) e.currentTarget.style.color = INK }}
              onMouseLeave={e => { if (!isActive(path)) e.currentTarget.style.color = STEEL }}
            >
              {label}
            </Link>
          ))}
          {isAdmin && profile?.mode === 'team' && (
            <Link
              to="/admin"
              style={{
                fontFamily: SANS,
                fontSize: '11px', fontWeight: '500',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                color: isActive('/admin') ? INK : STEEL,
                padding: '5px 12px',
                textDecoration: 'none',
                background: isActive('/admin') ? 'rgba(255,255,255,0.07)' : 'transparent',
                borderBottom: isActive('/admin') ? `1px solid ${ACCENT}` : '1px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive('/admin')) e.currentTarget.style.color = INK }}
              onMouseLeave={e => { if (!isActive('/admin')) e.currentTarget.style.color = STEEL }}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Right: user + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          {displayName && (
            <span style={{ fontFamily: SANS, fontSize: '12px', color: STEEL, letterSpacing: '0.04em' }}>
              {displayName}
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{
              fontFamily: SANS,
              fontSize: '11px', fontWeight: '500',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '6px 14px',
              background: 'transparent',
              color: INK,
              border: `1px solid ${BORDER}`,
              borderRadius: 0,
              cursor: 'pointer',
              transition: 'border-color 0.15s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = `0 0 10px rgba(255,255,0,0.12)` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = 'none' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
