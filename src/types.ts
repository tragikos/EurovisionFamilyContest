export type VotingStatus = 'setup' | 'not_started' | 'open' | 'closed' | 'finalized'

export interface ContestConfig {
  familyPinHash: string | null
  adminPasswordHash: string | null
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

export interface Session {
  memberName: string
  isAdmin: boolean
}
