export type VotingStatus = 'not_started' | 'open' | 'closed' | 'finalized'

export interface ContestConfig {
  adminEmails: string[]
  votingStatus: VotingStatus
}

export interface Contestant {
  id: string
  country: string
  appearanceOrder: number
}

export interface Prediction {
  id: string
  memberName: string
  order: string[]
  updatedAt: number
}

export interface FinalResult {
  order: string[]
  finalizedAt: number
}

export interface StandingEntry {
  id: string
  memberName: string
  score: number
  rank: number
}

export interface AuthUser {
  uid: string
  email: string
  displayName: string
}

export type MemberStatus = 'invited' | 'active' | 'blocked'

export interface Member {
  email: string
  status: MemberStatus
  invitedAt: number
  invitedBy: string
  uid?: string
  displayName?: string
  firstSignInAt?: number
}

/** A snapshot of one past contest, archived when the admin resets for a new season. */
export interface Season {
  id: string
  archivedAt: number
  contestants: Contestant[]
  predictions: Prediction[]
  result: FinalResult | null
}
