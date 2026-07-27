import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import api from '../services/api'

const FeatureFlagContext = createContext({ flags: {}, isEnabled: () => true, loading: true })

export function FeatureFlagProvider({ children }) {
  const { profile } = useAuth()
  const [flags, setFlags] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function fetchFlags() {
      api
        .get('/feature-flags')
        .then((res) => {
          const map = {}
          for (const f of res.data?.flags || []) map[f.name] = f.enabled
          setFlags(map)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
    fetchFlags()
    const id = setInterval(fetchFlags, 60_000)
    return () => clearInterval(id)
  }, [])

  // Admins and owners always see all features — flags only gate regular users
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
  const isEnabled = (name) => isAdmin || flags[name] !== false

  return (
    <FeatureFlagContext.Provider value={{ flags, isEnabled, loading, setFlags, isAdmin }}>
      {children}
    </FeatureFlagContext.Provider>
  )
}

export const useFeatureFlags = () => useContext(FeatureFlagContext)
