import { lazy, Suspense, useState, useCallback, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BulkOpsProvider } from './context/BulkOpsContext'
import { FeatureFlagProvider, useFeatureFlags } from './context/FeatureFlagContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import { PostHogProvider } from './components/PostHogProvider'
import { PageLoader } from './components/ui/PageLoader'
import EnrichmentProgressModal from './components/EnrichmentProgressModal'

// Eagerly load auth-critical pages (shown immediately on cold visit)
import Login from './pages/Login'
import Signup from './pages/Signup'
import Landing from './pages/Landing'
import AuthCallback from './pages/AuthCallback'

// Lazy load everything else — splits into separate chunks
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Leads = lazy(() => import('./pages/Leads'))
const Companies = lazy(() => import('./pages/Companies'))
const Targeting = lazy(() => import('./pages/Targeting'))
const Settings = lazy(() => import('./pages/Settings'))
const CompanyDirectory = lazy(() => import('./pages/CompanyDirectory'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Admin = lazy(() => import('./pages/Admin'))
const Sequences = lazy(() => import('./pages/Sequences'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Prospect = lazy(() => import('./pages/Prospect'))
const EmailFinder = lazy(() => import('./pages/EmailFinder'))
const Database = lazy(() => import('./pages/Database'))
const Unsubscribes = lazy(() => import('./pages/Unsubscribes'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const BookingPage = lazy(() => import('./pages/BookingPage'))
const Notifications = lazy(() => import('./pages/Notifications'))
const People = lazy(() => import('./pages/People'))
const Lists = lazy(() => import('./pages/Lists'))

class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { errored: false }
  }
  static getDerivedStateFromError(e) {
    const isChunk =
      e?.name === 'ChunkLoadError' ||
      e?.message?.includes('Failed to fetch dynamically imported module') ||
      e?.message?.includes('Importing a module script failed')
    return isChunk ? { errored: true } : null
  }
  componentDidCatch(e) {
    const isChunk =
      e?.name === 'ChunkLoadError' ||
      e?.message?.includes('Failed to fetch dynamically imported module') ||
      e?.message?.includes('Importing a module script failed')
    if (isChunk) window.location.reload()
  }
  render() {
    return this.state.errored ? null : this.props.children
  }
}

function PageFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#121212',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          border: '2px solid rgba(255,255,0,0.15)',
          borderTop: '2px solid #FFFF00',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function AdminRoute({ children }) {
  const { profile, profileLoading } = useAuth()
  if (profileLoading) return null
  if (profile?.role !== 'admin' && profile?.role !== 'owner')
    return <Navigate to="/dashboard" replace />
  return children
}

function FlaggedRoute({ flag, children }) {
  const { isEnabled, loading } = useFeatureFlags()
  if (loading) return null
  if (!isEnabled(flag)) return <Navigate to="/dashboard" replace />
  return children
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
          <FeatureFlagProvider>
            <ToastProvider>
              <BulkOpsProvider>
                {!loaderDone && <PageLoader onDone={handleLoaderDone} />}
                <EnrichmentProgressModal />
                <ChunkErrorBoundary>
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      <Route path="/" element={<Landing />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />
                      {/* Standalone protected (no sidebar) */}
                      <Route
                        path="/onboarding"
                        element={
                          <ProtectedRoute>
                            <Onboarding />
                          </ProtectedRoute>
                        }
                      />

                      {/* App pages — sidebar layout */}
                      <Route element={<AuthLayout />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/people" element={<People />} />
                        <Route path="/lists" element={<Lists />} />
                        <Route
                          path="/leads"
                          element={
                            <FlaggedRoute flag="page_leads">
                              <Leads />
                            </FlaggedRoute>
                          }
                        />
                        <Route
                          path="/companies"
                          element={
                            <FlaggedRoute flag="page_companies">
                              <Companies />
                            </FlaggedRoute>
                          }
                        />
                        <Route
                          path="/directory"
                          element={
                            <FlaggedRoute flag="page_discovery">
                              <CompanyDirectory />
                            </FlaggedRoute>
                          }
                        />
                        <Route
                          path="/prospect"
                          element={
                            <FlaggedRoute flag="page_prospect">
                              <Prospect />
                            </FlaggedRoute>
                          }
                        />
                        <Route
                          path="/email-finder"
                          element={
                            <FlaggedRoute flag="page_email_finder">
                              <EmailFinder />
                            </FlaggedRoute>
                          }
                        />
                        <Route
                          path="/database"
                          element={
                            <AdminRoute>
                              <Database />
                            </AdminRoute>
                          }
                        />
                        <Route
                          path="/sequences"
                          element={
                            <FlaggedRoute flag="page_sequences">
                              <Sequences />
                            </FlaggedRoute>
                          }
                        />
                        <Route
                          path="/tasks"
                          element={
                            <FlaggedRoute flag="page_tasks">
                              <Tasks />
                            </FlaggedRoute>
                          }
                        />
                        <Route
                          path="/analytics"
                          element={
                            <FlaggedRoute flag="page_analytics">
                              <Analytics />
                            </FlaggedRoute>
                          }
                        />
                        <Route
                          path="/targeting"
                          element={
                            <FlaggedRoute flag="page_targeting">
                              <Targeting />
                            </FlaggedRoute>
                          }
                        />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/notifications" element={<Notifications />} />
                        <Route
                          path="/unsubscribes"
                          element={
                            <FlaggedRoute flag="page_unsubscribes">
                              <Unsubscribes />
                            </FlaggedRoute>
                          }
                        />
                        <Route
                          path="/admin"
                          element={
                            <AdminRoute>
                              <Admin />
                            </AdminRoute>
                          }
                        />
                      </Route>

                      <Route path="/icp" element={<Navigate to="/targeting" replace />} />
                      <Route path="/persona" element={<Navigate to="/targeting" replace />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/book/:slug" element={<BookingPage />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="*" element={<RootRedirect />} />
                    </Routes>
                  </Suspense>
                </ChunkErrorBoundary>
              </BulkOpsProvider>
            </ToastProvider>
          </FeatureFlagProvider>
        </AuthProvider>
      </PostHogProvider>
    </BrowserRouter>
  )
}
