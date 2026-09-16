import { useAuth } from '../context/AuthContext'
import { useMembership } from '../context/MembershipContext'

/** The name to show/save for the current user: an admin-assigned name if one was set, else their real Google name. */
export function useDisplayName(): string {
  const { user } = useAuth()
  const { member } = useMembership()
  return member?.assignedName || user?.displayName || ''
}
