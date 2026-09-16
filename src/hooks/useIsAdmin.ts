import { useMembership } from '../context/MembershipContext'

export function useIsAdmin(): boolean {
  return useMembership().isAdmin
}
