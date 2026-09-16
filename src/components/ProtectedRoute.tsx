import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useContestData } from '../context/ContestDataContext'
import { useMembership } from '../context/MembershipContext'

export function ProtectedRoute({ children, requireAdmin }: { children: ReactNode; requireAdmin?: boolean }) {
  const { user } = useAuth()
  const { config } = useContestData()
  const { status, isAdmin } = useMembership()

  if (!user || !config) {
    return <Navigate to="/login" replace />
  }

  // Not yet resolved, not invited, or blocked - LoginPage renders the right
  // message for each of those states.
  if (status !== 'allowed') {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
