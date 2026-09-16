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
}

const MembershipContext = createContext<MembershipContextValue | null>(null)

export function MembershipProvider({ children }: { children: ReactNode }) {
  const { user, authReady } = useAuth()
  const { config, ready: contestReady } = useContestData()
  const [member, setMember] = useState<Member | null>(null)
  const [memberLoaded, setMemberLoaded] = useState(false)

  const isAdmin = Boolean(user && config?.adminEmails.includes(user.email))

  useEffect(() => {
    if (!user || isAdmin) {
      setMember(null)
      setMemberLoaded(true)
      return
    }
    setMemberLoaded(false)
    return subscribeMember(user.email, (next) => {
      setMember(next)
      setMemberLoaded(true)
    })
  }, [user, isAdmin])

  // The first time an invited person signs in, flip their invite to active.
  useEffect(() => {
    if (!user || isAdmin || !member) return
    if (member.status === 'invited') {
      markMemberActive(user.email, user.uid, user.displayName).catch((error: unknown) => {
        console.error('Failed to activate membership:', error)
      })
    }
  }, [user, isAdmin, member])

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

  return <MembershipContext.Provider value={{ status, isAdmin }}>{children}</MembershipContext.Provider>
}

export function useMembership() {
  const context = useContext(MembershipContext)
  if (!context) {
    throw new Error('useMembership must be used within a MembershipProvider')
  }
  return context
}
