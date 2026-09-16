import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ContestDataProvider } from './context/ContestDataContext'
import { MembershipProvider } from './context/MembershipContext'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { ThemeProvider } from './context/ThemeContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { VotePage } from './pages/VotePage'
import { AdminPage } from './pages/AdminPage'
import { OverallLeaderboardPage } from './pages/OverallLeaderboardPage'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <ContestDataProvider>
              <MembershipProvider>
                <HashRouter>
                  <Layout>
                    <Routes>
                      <Route path="/login" element={<LoginPage />} />
                      <Route
                        path="/"
                        element={
                          <ProtectedRoute>
                            <VotePage />
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
                      <Route
                        path="/leaderboard"
                        element={
                          <ProtectedRoute>
                            <OverallLeaderboardPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </HashRouter>
              </MembershipProvider>
            </ContestDataProvider>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
