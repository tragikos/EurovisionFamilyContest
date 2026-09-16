import { useAuth } from '../context/AuthContext'
import { useContestData } from '../context/ContestDataContext'

export function useIsAdmin(): boolean {
  const { user } = useAuth()
  const { config } = useContestData()
  return Boolean(user && config?.adminEmails.includes(user.email))
}
