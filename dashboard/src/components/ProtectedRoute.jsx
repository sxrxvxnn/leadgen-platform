import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, profile, profileLoading, loading } = useAuth()
  const location = useLocation()

  if (loading || profileLoading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profile && !profile.onboarding_complete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fdfdfd',
  },
  spinner: {
    width: '28px',
    height: '28px',
    border: '2px solid rgba(29,27,27,0.08)',
    borderTop: '2px solid #a86448',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}
