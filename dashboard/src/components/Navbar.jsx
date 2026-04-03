import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(true)
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    setDarkMode(saved !== 'light')
  }, [])

  useEffect(() => {
    function updateName() {
      const savedName = localStorage.getItem('fullName')
      if (savedName) {
        setDisplayName(savedName)
      } else {
        setDisplayName(user?.email?.split('@')[0] || '')
      }
    }
    updateName()
    window.addEventListener('nameUpdated', updateName)
    return () => window.removeEventListener('nameUpdated', updateName)
  }, [user])

  function toggleTheme() {
    const newMode = !darkMode
    setDarkMode(newMode)
    const theme = newMode ? 'dark' : 'light'
    localStorage.setItem('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }

  const handleLogout = () => { logout(); navigate('/login') }
  const isActive = (path) => location.pathname === path

  return (
    <nav style={s.nav}>
      <div style={s.left}>
        <Link to="/dashboard" style={s.brand} data-hover="true">
          <span style={s.brandMark}>LE</span>
          <span style={s.brandName}>LEADGEN ENGINE</span>
        </Link>
      </div>
      <div style={s.center}>
        {[
          ['OVERVIEW', '/dashboard'],
          ['LEADS', '/leads'],
          ['ICP', '/icp'],
          ['PERSONA', '/persona'],
          ['SETTINGS', '/settings'],
        ].map(([label, path]) => (
          <Link
            key={path}
            to={path}
            style={{ ...s.link, ...(isActive(path) ? s.linkActive : {}) }}
            data-hover="true"
          >
            {label}
            {isActive(path) && <span style={s.activeLine} />}
          </Link>
        ))}
      </div>
      <div style={s.right}>
        <button onClick={toggleTheme} style={s.themeBtn} title="Toggle theme">
          {darkMode ? '☀' : '☾'}
        </button>
        <span style={s.userTag}>{displayName}</span>
        <button onClick={handleLogout} style={s.logoutBtn} data-hover="true">
          Sign out
        </button>
      </div>
    </nav>
  )
}

const s = {
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', background: 'var(--black)', borderBottom: '1px solid var(--gray-2)', position: 'sticky', top: 0, zIndex: 100 },
  left: { display: 'flex', alignItems: 'center' },
  brand: { display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' },
  brandMark: { width: '28px', height: '28px', background: 'var(--white)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '900', color: 'var(--black)', letterSpacing: '0.5px' },
  brandName: { fontSize: '11px', fontWeight: '700', letterSpacing: '3px', color: 'var(--gray-4)' },
  center: { display: 'flex', alignItems: 'center', gap: '4px' },
  link: { position: 'relative', padding: '6px 14px', fontSize: '11px', fontWeight: '600', letterSpacing: '2px', color: 'var(--gray-4)', textDecoration: 'none', transition: 'color 0.2s' },
  linkActive: { color: 'var(--white)' },
  activeLine: { position: 'absolute', bottom: '-1px', left: '14px', right: '14px', height: '1px', background: 'var(--white)' },
  right: { display: 'flex', alignItems: 'center', gap: '16px' },
  themeBtn: { background: 'none', border: '1px solid var(--gray-2)', borderRadius: '4px', color: 'var(--gray-4)', fontSize: '14px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 },
  userTag: { fontSize: '11px', fontWeight: '600', letterSpacing: '1px', color: 'var(--gray-4)', textTransform: 'lowercase' },
  logoutBtn: { padding: '6px 14px', background: 'transparent', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '11px', fontWeight: '600', color: 'var(--gray-4)', cursor: 'pointer', letterSpacing: '1px' },
}