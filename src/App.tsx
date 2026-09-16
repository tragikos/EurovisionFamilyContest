import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ContestDataProvider } from './context/ContestDataContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { VotePage } from './pages/VotePage'
import { AdminPage } from './pages/AdminPage'
import { useIsAdmin } from './hooks/useIsAdmin'

export default function App() {
  return (
    <AuthProvider>
      <ContestDataProvider>
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <HomeRoute />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </HashRouter>
      </ContestDataProvider>
    </AuthProvider>
  )
}

function HomeRoute() {
  const isAdmin = useIsAdmin()
  if (isAdmin) {
    return <Navigate to="/admin" replace />
  }
  return <VotePage />
}
