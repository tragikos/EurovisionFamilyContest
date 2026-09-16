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
  memberName: string
  score: number
  rank: number
}

export interface AuthUser {
  uid: string
  email: string
  displayName: string
}
