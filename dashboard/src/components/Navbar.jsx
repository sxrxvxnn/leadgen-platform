import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'

export default function Navbar() {
  const { user, logout } = useAuth()
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

  const handleLogout = () => { logout(); navigate('/login') }
  const isActive = (path) => location.pathname === path

  return (
    <nav style={s.nav}>
      <div style={s.left}>
        <Link to="/dashboard" style={s.brand}>
          <span style={s.brandMark}>L</span>
          <span style={s.brandName}>Leadgen Engine</span>
        </Link>
      </div>

      <div style={s.center}>
        {[
          ['Overview',  '/dashboard'],
          ['Companies', '/companies'],
          ['Leads',     '/leads'],
          ['ICP',       '/icp'],
          ['Persona',   '/persona'],
          ['Settings',  '/settings'],
        ].map(([label, path]) => (
          <Link key={path} to={path} style={{ ...s.link, ...(isActive(path) ? s.linkActive : {}) }}>
            {label}
            {isActive(path) && <span style={s.activeDot} />}
          </Link>
        ))}
      </div>

      <div style={s.right}>
        <span style={s.userTag}>{displayName}</span>
        <button onClick={handleLogout} style={s.logoutBtn}>Sign out</button>
      </div>
    </nav>
  )
}

const s = {
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 32px', height: '52px',
    background: 'rgba(253,253,253,0.88)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, zIndex: 100,
  },
  left: { display: 'flex', alignItems: 'center' },
  brand: { display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' },
  brandMark: {
    width: '24px', height: '24px',
    background: 'var(--text)', borderRadius: '6px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '11px', fontWeight: '700', color: 'var(--bg)',
    fontFamily: "'DM Serif Display', serif",
  },
  brandName: { fontSize: '13px', fontWeight: '500', color: 'var(--text)', letterSpacing: '-0.2px' },
  center: { display: 'flex', alignItems: 'center', gap: '2px' },
  link: {
    position: 'relative',
    padding: '5px 12px',
    fontSize: '12px', fontWeight: '400',
    color: 'var(--text-muted)',
    textDecoration: 'none',
    borderRadius: '6px',
    transition: 'color 0.15s',
  },
  linkActive: { color: 'var(--text)', fontWeight: '500' },
  activeDot: {
    position: 'absolute', bottom: '-1px', left: '50%',
    transform: 'translateX(-50%)',
    width: '3px', height: '3px',
    background: 'var(--accent)', borderRadius: '50%',
  },
  right: { display: 'flex', alignItems: 'center', gap: '12px' },
  userTag: { fontSize: '12px', color: 'var(--text-muted)' },
  logoutBtn: {
    padding: '5px 12px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '12px', fontWeight: '400',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
}
