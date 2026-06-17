import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BulkOpsProvider } from './context/BulkOpsContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Targeting from './pages/Targeting'
import Settings from './pages/Settings'
import Companies from './pages/Companies'
import CompanyDirectory from './pages/CompanyDirectory'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Admin from './pages/Admin'

function RootRedirect() {
  const { token, loading } = useAuth()
  if (loading) return null
  return <Navigate to={token ? '/dashboard' : '/'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BulkOpsProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
          <Route path="/targeting" element={<ProtectedRoute><Targeting /></ProtectedRoute>} />
          <Route path="/icp" element={<Navigate to="/targeting" replace />} />
          <Route path="/persona" element={<Navigate to="/targeting" replace />} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/companies" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
          <Route path="/directory" element={<ProtectedRoute><CompanyDirectory /></ProtectedRoute>} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
        </BulkOpsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}