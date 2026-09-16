import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useContestData } from './ContestDataContext'
import { markMemberActive, subscribeMember } from '../services/firestoreService'
import type { Member } from '../types'

export type MembershipStatus = 'checking' | 'allowed' | 'not_invited' | 'blocked'

interface MembershipContextValue {
  status: MembershipStatus
  isAdmin: boolean
  member: Member | null
}

const MembershipContext = createContext<MembershipContextValue | null>(null)

export function MembershipProvider({ children }: { children: ReactNode }) {
  const { user, authReady } = useAuth()
  const { config, ready: contestReady } = useContestData()
  const [member, setMember] = useState<Member | null>(null)
  const [memberLoaded, setMemberLoaded] = useState(false)

  const isAdmin = Boolean(user && config?.adminEmails.includes(user.email))

  // Subscribed regardless of admin status: an admin may also have their own
  // member record (e.g. from historical data import), and its status should
  // still reflect reality even though isAdmin already grants them access below.
  useEffect(() => {
    if (!user) {
      setMember(null)
      setMemberLoaded(true)
      return
    }
    setMemberLoaded(false)
    return subscribeMember(user.email, (next) => {
      setMember(next)
      setMemberLoaded(true)
    })
  }, [user])

  // The first time an invited person signs in, flip their invite to active -
  // including admins, so their own status dot in the invite list stops showing "invited".
  useEffect(() => {
    if (!user || !member) return
    if (member.status === 'invited') {
      markMemberActive(user.email, user.uid, user.displayName).catch((error: unknown) => {
        console.error('Failed to activate membership:', error)
      })
    }
  }, [user, member])

  let status: MembershipStatus = 'checking'
  if (authReady && contestReady && memberLoaded) {
    if (isAdmin) {
      status = 'allowed'
    } else if (!member) {
      status = 'not_invited'
    } else if (member.status === 'blocked') {
      status = 'blocked'
    } else {
      status = 'allowed'
    }
  }

  return <MembershipContext.Provider value={{ status, isAdmin, member }}>{children}</MembershipContext.Provider>
}

export function useMembership() {
  const context = useContext(MembershipContext)
  if (!context) {
    throw new Error('useMembership must be used within a MembershipProvider')
  }
  return context
}
