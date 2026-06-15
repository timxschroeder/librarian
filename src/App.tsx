import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Shelf from './pages/Shelf'
import Discover from './pages/Discover'
import Librarian from './pages/Librarian'
import Taste from './pages/Taste'
import Settings from './pages/Settings'
import Onboarding from './pages/Onboarding'
import Layout from './components/Layout'

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-display text-2xl text-muted">Librarian</p>
      </div>
    )
  }

  if (!user) return <Login />
  if (!profile?.onboarded_at) return <Onboarding />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/shelf" replace />} />
        <Route path="/shelf" element={<Shelf />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/librarian" element={<Librarian />} />
        <Route path="/taste" element={<Taste />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/shelf" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  )
}
