import { createContext, useContext, useState, useEffect, useRef } from 'react'
import {
  login as loginApi,
  signup as signupApi,
  forgotPassword as forgotPasswordApi,
  resetPassword as resetPasswordApi,
} from '../services/api'
import api from '../services/api'
import posthog from '../lib/posthog'

const AuthContext = createContext(null)

async function _loadProfile() {
  try {
    const res = await api.get('/profile')
    return res.data
  } catch {
    return null
  }
}

function _tokenExpiresAt(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return (payload.exp || 0) * 1000
  } catch {
    return 0
  }
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
      const parsedUser = JSON.parse(savedUser)
      setToken(savedToken)
      setUser(parsedUser)
      posthog.identify(parsedUser.id, { email: parsedUser.email })
      _scheduleRefresh(savedToken)
      setProfileLoading(true)
      _loadProfile().then((p) => {
        setProfile(p)
        setProfileLoading(false)
      })
    }
    setLoading(false)
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
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
    posthog.identify(user.id, { email })
    _scheduleRefresh(access_token)
    setProfileLoading(true)
    _loadProfile().then((p) => {
      setProfile(p)
      setProfileLoading(false)
    })
    return response
  }

  const signup = async (email, password, full_name) => {
    const response = await signupApi({ email, password, full_name })
    return response
  }

  const loginWithSession = async (session) => {
    const { access_token, refresh_token, user } = session
    localStorage.setItem('token', access_token)
    if (refresh_token) localStorage.setItem('refreshToken', refresh_token)
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('userEmail', user.email || '')
    setToken(access_token)
    setUser(user)
    posthog.identify(user.id, { email: user.email })
    _scheduleRefresh(access_token)
    setProfileLoading(true)
    _loadProfile().then((p) => {
      setProfile(p)
      setProfileLoading(false)
    })
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
    // Clear legacy unscoped keys so they don't bleed into the next account on this browser
    ;[
      'fullName',
      'smtpHost',
      'smtpPort',
      'smtpUser',
      'smtpPass',
      'smtpFromName',
      'smtpFromEmail',
      'agreedTerms',
      'wantsUpdates',
      'savedICPs',
    ].forEach((k) => localStorage.removeItem(k))
    posthog.reset()
    setToken(null)
    setUser(null)
    setProfile(null)
    setProfileLoading(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        profile,
        profileLoading,
        loading,
        login,
        loginWithSession,
        signup,
        logout,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
