import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useContestData } from '../context/ContestDataContext'
import { useIsAdmin } from '../hooks/useIsAdmin'

export function ProtectedRoute({ children, requireAdmin }: { children: ReactNode; requireAdmin?: boolean }) {
  const { user } = useAuth()
  const { config } = useContestData()
  const isAdmin = useIsAdmin()

  if (!user || !config) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
