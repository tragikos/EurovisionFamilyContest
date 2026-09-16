export type VotingStatus = 'not_started' | 'open' | 'closed' | 'finalized'

export interface ContestConfig {
  adminEmails: string[]
  votingStatus: VotingStatus
  title?: string
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
  /** Their real Google account name, recorded automatically the first time they sign in. */
  displayName?: string
  firstSignInAt?: number
  /** The name an admin chose for them - shown everywhere in place of their Google name, once set. */
  assignedName?: string
}

/** A snapshot of one past contest, archived when the admin resets for a new season. */
export interface Season {
  id: string
  title: string
  archivedAt: number
  contestants: Contestant[]
  predictions: Prediction[]
  result: FinalResult | null
}

/** A full export of everything in Firestore, for manual backup/restore. */
export interface BackupData {
  exportedAt: number
  config: ContestConfig | null
  contestants: Contestant[]
  predictions: Prediction[]
  result: FinalResult | null
  members: Member[]
  seasons: Season[]
}
