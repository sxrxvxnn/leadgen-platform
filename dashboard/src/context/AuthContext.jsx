import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { login as loginApi, signup as signupApi, forgotPassword as forgotPasswordApi, resetPassword as resetPasswordApi } from '../services/api'
import api from '../services/api'

const AuthContext = createContext(null)

async function _loadProfile() {
  try {
    const res = await api.get('/profile')
    return res.data
  } catch { return null }
}

function _tokenExpiresAt(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return (payload.exp || 0) * 1000
  } catch { return 0 }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const refreshTimer = useRef(null)

  const _scheduleRefresh = (accessToken) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    const expiresAt = _tokenExpiresAt(accessToken)
    if (!expiresAt) return
    // Refresh 5 minutes before expiry
    const delay = expiresAt - Date.now() - 5 * 60 * 1000
    if (delay <= 0) return
    refreshTimer.current = setTimeout(async () => {
      const rt = localStorage.getItem('refreshToken')
      if (!rt) return
      try {
        const res = await api.post('/auth/refresh', { refresh_token: rt })
        const newAccess = res.data.access_token
        localStorage.setItem('token', newAccess)
        if (res.data.refresh_token) localStorage.setItem('refreshToken', res.data.refresh_token)
        setToken(newAccess)
        _scheduleRefresh(newAccess)
      } catch {
        // Silent fail — the 401 interceptor will handle it on the next request
      }
    }, delay)
  }

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
      _scheduleRefresh(savedToken)
      setProfileLoading(true)
      _loadProfile().then(p => { setProfile(p); setProfileLoading(false) })
    }
    setLoading(false)
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }
  }, [])

  const login = async (email, password) => {
    const response = await loginApi({ email, password })
    const { access_token, refresh_token, user } = response.data
    localStorage.setItem('token', access_token)
    if (refresh_token) localStorage.setItem('refreshToken', refresh_token)
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('userEmail', email)
    setToken(access_token)
    setUser(user)
    _scheduleRefresh(access_token)
    setProfileLoading(true)
    _loadProfile().then(p => { setProfile(p); setProfileLoading(false) })
    return response
  }

  const signup = async (email, password, full_name) => {
    const response = await signupApi({ email, password, full_name })
    return response
  }

  const forgotPassword = async (email) => {
    const response = await forgotPasswordApi(email)
    return response
  }

  const resetPassword = async (recoveryToken, newPassword) => {
    const response = await resetPasswordApi(recoveryToken, newPassword)
    return response
  }

  const logout = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    localStorage.removeItem('userEmail')
    setToken(null)
    setUser(null)
    setProfile(null)
    setProfileLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, token, profile, profileLoading, loading, login, signup, logout, forgotPassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}