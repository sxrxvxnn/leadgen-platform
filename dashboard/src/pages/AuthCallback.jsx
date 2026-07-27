import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase-client'

const SANS = "'Host Grotesk', 'Roboto', sans-serif"
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export default function AuthCallback() {
  const [status, setStatus] = useState('Completing sign-in…')
  const navigate = useNavigate()
  const { loginWithSession } = useAuth()

  useEffect(() => {
    // Bail immediately if this is an OAuth error redirect
    const params = new URLSearchParams(window.location.search)
    if (params.get('error')) {
      navigate('/login', { replace: true })
      return
    }

    // Guard so we only complete once even if both listeners fire
    let done = false

    async function complete(session) {
      if (done) return
      done = true
      await loginWithSession(session)
      // Use raw fetch to avoid the axios 401 interceptor — if ensure-profile
      // were to 401, the interceptor would clear localStorage before our
      // window.location.replace runs, causing AuthLayout to redirect back to login.
      fetch(`${API_BASE}/auth/ensure-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: session.user.email || '',
          full_name:
            session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
        }),
      }).catch(() => {})
      // Hard reload so AuthProvider re-initialises from localStorage
      window.location.replace('/dashboard')
    }

    // Supabase JS v2 with detectSessionInUrl=true automatically exchanges the
    // PKCE code in the URL during createClient(). Calling exchangeCodeForSession
    // manually races with that internal call and fails. Instead, listen for the
    // session Supabase creates.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        complete(session)
      }
    })

    // Supabase may have already finished by the time our listener registered
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) complete(session)
    })

    const timeout = setTimeout(() => {
      if (!done) setStatus('Sign-in failed. Please try again.')
    }, 15000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FFFFFF',
        fontFamily: SANS,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 22,
            height: 22,
            border: '2px solid #E5E7EB',
            borderTop: '2px solid #E7000B',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>{status}</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
