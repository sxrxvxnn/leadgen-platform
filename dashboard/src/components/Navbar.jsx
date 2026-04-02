import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav style={styles.nav}>
      <div style={styles.left}>
        <div style={styles.logo}>L</div>
        <span style={styles.brand}>LeadGen Engine</span>
      </div>

      <div style={styles.links}>
        <Link
          to="/dashboard"
          style={{
            ...styles.link,
            ...(isActive('/dashboard') ? styles.linkActive : {})
          }}
        >
          Dashboard
        </Link>
        <Link
          to="/leads"
          style={{
            ...styles.link,
            ...(isActive('/leads') ? styles.linkActive : {})
          }}
        >
          Leads
        </Link>
      </div>

      <div style={styles.right}>
        <span style={styles.email}>{user?.email}</span>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: '56px',
    background: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logo: {
    width: '30px',
    height: '30px',
    background: '#2563eb',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '14px',
    fontWeight: '700',
  },
  brand: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#111827',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  link: {
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#6b7280',
    textDecoration: 'none',
    fontWeight: '500',
    transition: 'all 0.15s',
  },
  linkActive: {
    background: '#eff6ff',
    color: '#2563eb',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  email: {
    fontSize: '13px',
    color: '#6b7280',
  },
  logoutBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: '500',
  },
}