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

function RadarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7" stroke="#1d1b1b" strokeWidth="1" strokeOpacity="0.25" />
      <circle cx="8" cy="8" r="4" stroke="#1d1b1b" strokeWidth="1" strokeOpacity="0.5" />
      <circle cx="8" cy="8" r="1.5" fill="#1d1b1b" />
    </svg>
  )
}


export default function Navbar() {
  const { user, profile, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function updateName() {
      const saved = localStorage.getItem('fullName')
      setDisplayName(saved || user?.email?.split('@')[0] || '')
    }
    updateName()
    window.addEventListener('nameUpdated', updateName)
    return () => window.removeEventListener('nameUpdated', updateName)
  }, [user])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const isActive = (path) => location.pathname === path
  const handleLogout = () => { logout(); navigate('/') }
  const isAdmin = profile?.role === 'admin'

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        padding: '0 24px',
        height: '48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
      }}>

        {/* Logo */}
        <Link to="/dashboard" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: '12px', fontWeight: '700',
            color: '#1d1b1b', letterSpacing: '0.04em',
          }}>
            SONAR©
          </span>
        </Link>

        {/* Center nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {NAV_LINKS.map(({ label, path }) => (
            <Link
              key={path}
              to={path}
              style={{
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontSize: '11px',
                fontWeight: isActive(path) ? '700' : '500',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: isActive(path) ? '#111' : '#888',
                padding: '4px 10px',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { if (!isActive(path)) e.currentTarget.style.color = '#111' }}
              onMouseLeave={e => { if (!isActive(path)) e.currentTarget.style.color = '#888' }}
            >
              {label}
            </Link>
          ))}
          {isAdmin && profile?.mode === 'team' && (
            <Link
              to="/admin"
              style={{
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontSize: '11px',
                fontWeight: isActive('/admin') ? '700' : '500',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: isActive('/admin') ? '#111' : '#888',
                padding: '4px 10px',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { if (!isActive('/admin')) e.currentTarget.style.color = '#111' }}
              onMouseLeave={e => { if (!isActive('/admin')) e.currentTarget.style.color = '#888' }}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Right: user + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          {displayName && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#999', letterSpacing: '0.04em' }}>
              {displayName}
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontSize: '11px', fontWeight: '700',
              letterSpacing: '0.07em', textTransform: 'uppercase',
              padding: '7px 16px',
              background: '#111', color: '#f0eeea',
              border: 'none', borderRadius: 4, cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
