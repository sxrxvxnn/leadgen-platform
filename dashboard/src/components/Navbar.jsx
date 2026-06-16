/**
 * Navbar — runner.now style.
 * 2×2 square logomark + "Leadgen Engine" in Geist Mono.
 * Centered links in Geist Mono. Dark "Get Started" pill with dot-grid icon.
 * Frosted glass effect. Shadow/border intensifies on scroll.
 */
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

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <rect x="0"  y="0"  width="8" height="8" rx="1.5" fill="#1d1b1b" />
      <rect x="10" y="0"  width="8" height="8" rx="1.5" fill="#1d1b1b" />
      <rect x="0"  y="10" width="8" height="8" rx="1.5" fill="#1d1b1b" />
      <rect x="10" y="10" width="8" height="8" rx="1.5" fill="#1d1b1b" />
    </svg>
  )
}

function DotGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      {[0, 4, 8, 12].map(y =>
        [0, 4, 8, 12].map(x => (
          <rect key={`${x}-${y}`} x={x} y={y} width="2" height="2" rx="0.4"
            fill="rgba(231,231,231,0.55)" />
        ))
      )}
    </svg>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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
  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: scrolled ? 'rgba(253,253,253,0.92)' : 'rgba(253,253,253,0.75)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${scrolled ? 'rgba(29,27,27,0.10)' : 'rgba(29,27,27,0.06)'}`,
      boxShadow: scrolled ? '0 1px 12px rgba(29,27,27,0.05)' : 'none',
      transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
    }}>
      <div style={{
        maxWidth: '1400px', margin: '0 auto',
        padding: '0 28px',
        height: '54px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
      }}>

        {/* Logo */}
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
          <LogoMark />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '500',
            color: '#1d1b1b', letterSpacing: '-0.02em',
          }}>
            leadgen engine
          </span>
        </Link>

        {/* Center nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {NAV_LINKS.map(({ label, path }) => (
            <Link
              key={path}
              to={path}
              style={{
                position: 'relative',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: isActive(path) ? '500' : '400',
                color: isActive(path) ? '#1d1b1b' : '#6e6e6e',
                padding: '5px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { if (!isActive(path)) e.currentTarget.style.color = '#1d1b1b' }}
              onMouseLeave={e => { if (!isActive(path)) e.currentTarget.style.color = '#6e6e6e' }}
            >
              {label}
              {/* Active dot */}
              {isActive(path) && (
                <span style={{
                  position: 'absolute', bottom: '-1px', left: '50%',
                  transform: 'translateX(-50%)',
                  width: '3px', height: '3px', borderRadius: '50%',
                  background: '#a86448',
                }} />
              )}
            </Link>
          ))}
        </nav>

        {/* Right: user + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {displayName && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: '#a1a1a1',
            }}>
              {displayName}
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '500',
              padding: '8px 14px',
              background: '#1d1b1b', color: '#e7e7e7',
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2d2b2b' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1d1b1b' }}
          >
            Sign out
            <DotGrid />
          </button>
        </div>
      </div>
    </header>
  )
}
