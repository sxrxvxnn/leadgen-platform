import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

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
        {[['OVERVIEW', '/dashboard'], ['LEADS', '/leads']].map(([label, path]) => (
          <Link key={path} to={path} style={{ ...s.link, ...(isActive(path) ? s.linkActive : {}) }} data-hover="true">
            {label}
            {isActive(path) && <span style={s.activeLine} />}
          </Link>
        ))}
      </div>
      <div style={s.right}>
        <span style={s.userTag}>{user?.email?.split('@')[0]}</span>
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
  link: { position: 'relative', padding: '6px 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '2px', color: 'var(--gray-4)', textDecoration: 'none', transition: 'color 0.2s' },
  linkActive: { color: 'var(--white)' },
  activeLine: { position: 'absolute', bottom: '-1px', left: '16px', right: '16px', height: '1px', background: 'var(--white)' },
  right: { display: 'flex', alignItems: 'center', gap: '20px' },
  userTag: { fontSize: '11px', fontWeight: '600', letterSpacing: '1px', color: 'var(--gray-4)', textTransform: 'lowercase' },
  logoutBtn: { padding: '6px 14px', background: 'transparent', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '11px', fontWeight: '600', color: 'var(--gray-4)', cursor: 'none', letterSpacing: '1px', transition: 'all 0.2s' },
}