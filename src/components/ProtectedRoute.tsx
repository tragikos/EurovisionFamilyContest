import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'

export function ProtectedRoute({ children, requireAdmin }: { children: ReactNode; requireAdmin?: boolean }) {
  const { session } = useSession()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !session.isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
