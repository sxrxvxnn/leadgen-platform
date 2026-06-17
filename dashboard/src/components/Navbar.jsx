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

const SANS = "'IBM Plex Sans', 'DM Sans', sans-serif"
const INK  = '#01011b'
const PLUM = '#31263b'
const MID  = '#717a94'
const LINE = '#dbd7da'
const BG   = '#fffcfc'

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
      background: BG,
      borderBottom: `1px solid ${LINE}`,
    }}>
      <div style={{
        padding: '0 32px',
        height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
      }}>

        {/* Logo */}
        <Link to="/dashboard" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <span style={{
            fontFamily: SANS,
            fontSize: '16px', fontWeight: '700',
            color: INK, letterSpacing: '-0.02em',
          }}>
            Sonar
          </span>
        </Link>

        {/* Center nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {NAV_LINKS.map(({ label, path }) => (
            <Link
              key={path}
              to={path}
              style={{
                fontFamily: SANS,
                fontSize: '14px',
                fontWeight: isActive(path) ? '600' : '500',
                color: isActive(path) ? INK : MID,
                padding: '5px 12px',
                textDecoration: 'none',
                borderRadius: 3,
                background: isActive(path) ? '#ecedf2' : 'transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive(path)) { e.currentTarget.style.color = PLUM; e.currentTarget.style.background = '#f4f3f6' } }}
              onMouseLeave={e => { if (!isActive(path)) { e.currentTarget.style.color = MID; e.currentTarget.style.background = 'transparent' } }}
            >
              {label}
            </Link>
          ))}
          {isAdmin && profile?.mode === 'team' && (
            <Link
              to="/admin"
              style={{
                fontFamily: SANS,
                fontSize: '14px',
                fontWeight: isActive('/admin') ? '600' : '500',
                color: isActive('/admin') ? INK : MID,
                padding: '5px 12px',
                textDecoration: 'none',
                borderRadius: 3,
                background: isActive('/admin') ? '#ecedf2' : 'transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive('/admin')) { e.currentTarget.style.color = PLUM; e.currentTarget.style.background = '#f4f3f6' } }}
              onMouseLeave={e => { if (!isActive('/admin')) { e.currentTarget.style.color = MID; e.currentTarget.style.background = 'transparent' } }}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Right: user + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          {displayName && (
            <span style={{ fontFamily: SANS, fontSize: '13px', color: MID }}>
              {displayName}
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{
              fontFamily: SANS,
              fontSize: '14px', fontWeight: '500',
              padding: '7px 16px',
              background: '#ffffff',
              color: INK,
              border: `1px solid ${PLUM}`,
              borderRadius: 3,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = PLUM; e.currentTarget.style.color = BG }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = INK }}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
