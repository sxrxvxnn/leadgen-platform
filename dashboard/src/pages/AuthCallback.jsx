import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase-client'
import api from '../services/api'

const SANS = "'Host Grotesk', 'Roboto', sans-serif"

export default function AuthCallback() {
  const [status, setStatus] = useState('Completing sign-in…')
  const navigate = useNavigate()
  const { loginWithSession } = useAuth()

  useEffect(() => {
    async function exchange() {
      try {
        const code = new URLSearchParams(window.location.search).get('code')
        if (!code) {
          setStatus('Invalid callback — no code provided.')
          return
        }
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error || !data.session) {
          setStatus('Sign-in failed. Please try again.')
          return
        }
        const session = data.session
        await loginWithSession(session)
        // Ensure profile row exists for OAuth users (email/password signup creates it server-side)
        try {
          await api.post('/auth/ensure-profile', {
            email:     session.user.email || '',
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
          }, { headers: { Authorization: `Bearer ${session.access_token}` } })
        } catch { /* non-fatal */ }
        navigate('/dashboard', { replace: true })
      } catch {
        setStatus('An unexpected error occurred. Please try again.')
      }
    }
    exchange()
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', fontFamily: SANS }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 22, height: 22, border: '2px solid #E5E7EB', borderTop: '2px solid #E7000B', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>{status}</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
