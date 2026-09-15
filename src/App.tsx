import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './context/SessionContext'
import { ContestDataProvider } from './context/ContestDataContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { VotePage } from './pages/VotePage'
import { AdminPage } from './pages/AdminPage'

export default function App() {
  return (
    <SessionProvider>
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
    </SessionProvider>
  )
}

function HomeRoute() {
  const { session } = useSession()
  if (session?.isAdmin) {
    return <Navigate to="/admin" replace />
  }
  return <VotePage />
}
