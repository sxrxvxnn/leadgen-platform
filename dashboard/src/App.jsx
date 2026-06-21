import { lazy, Suspense, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BulkOpsProvider } from './context/BulkOpsContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import { PostHogProvider } from './components/PostHogProvider'
import { PageLoader } from './components/ui/PageLoader'

// Eagerly load auth-critical pages (shown immediately on cold visit)
import Login from './pages/Login'
import Signup from './pages/Signup'
import Landing from './pages/Landing'

// Lazy load everything else — splits into separate chunks
const Dashboard       = lazy(() => import('./pages/Dashboard'))
const Leads           = lazy(() => import('./pages/Leads'))
const Companies       = lazy(() => import('./pages/Companies'))
const Targeting       = lazy(() => import('./pages/Targeting'))
const Settings        = lazy(() => import('./pages/Settings'))
const CompanyDirectory= lazy(() => import('./pages/CompanyDirectory'))
const Onboarding      = lazy(() => import('./pages/Onboarding'))
const Admin           = lazy(() => import('./pages/Admin'))
const Sequences       = lazy(() => import('./pages/Sequences'))
const Tasks           = lazy(() => import('./pages/Tasks'))
const ForgotPassword  = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword   = lazy(() => import('./pages/ResetPassword'))
const Privacy         = lazy(() => import('./pages/Privacy'))
const Terms           = lazy(() => import('./pages/Terms'))

function PageFallback() {
  return (
    <div style={{ minHeight: '100vh', background: '#121212', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,0,0.15)', borderTop: '2px solid #FFFF00', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function RootRedirect() {
  const { token, loading } = useAuth()
  if (loading) return null
  return <Navigate to={token ? '/dashboard' : '/'} replace />
}

// Layout route — handles auth check + sidebar shell for all app pages
function AuthLayout() {
  const { token, loading } = useAuth()
  if (loading) return <PageFallback />
  if (!token) return <Navigate to="/login" replace />
  return <AppShell />
}

export default function App() {
  const alreadySeen = sessionStorage.getItem('loaderSeen') === '1'
  const [loaderDone, setLoaderDone] = useState(alreadySeen)

  const handleLoaderDone = useCallback(() => {
    sessionStorage.setItem('loaderSeen', '1')
    setLoaderDone(true)
  }, [])

  return (
    <BrowserRouter>
      <PostHogProvider>
      <AuthProvider>
        <BulkOpsProvider>
          {!loaderDone && <PageLoader onDone={handleLoaderDone} />}
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              {/* Standalone protected (no sidebar) */}
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

              {/* App pages — sidebar layout */}
              <Route element={<AuthLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/directory" element={<CompanyDirectory />} />
                <Route path="/sequences" element={<Sequences />} />
                <Route path="/tasks"     element={<Tasks />} />
                <Route path="/targeting" element={<Targeting />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/admin" element={<Admin />} />
              </Route>

              <Route path="/icp" element={<Navigate to="/targeting" replace />} />
              <Route path="/persona" element={<Navigate to="/targeting" replace />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </Suspense>
        </BulkOpsProvider>
      </AuthProvider>
      </PostHogProvider>
    </BrowserRouter>
  )
}
