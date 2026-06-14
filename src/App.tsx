import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Shelf from './pages/Shelf'
import Discover from './pages/Discover'
import Together from './pages/Together'
import Settings from './pages/Settings'
import Layout from './components/Layout'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-display text-2xl text-muted">Librarian</p>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/shelf" replace />} />
        <Route path="/shelf" element={<Shelf />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/together" element={<Together />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/shelf" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
