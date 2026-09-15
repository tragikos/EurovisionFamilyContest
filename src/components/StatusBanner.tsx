import type { VotingStatus } from '../types'

const LABELS: Record<VotingStatus, string> = {
  setup: 'Setting up',
  not_started: 'Voting not started',
  open: 'Voting open',
  closed: 'Voting closed',
  finalized: 'Results are in',
}

export function StatusBanner({ status }: { status: VotingStatus }) {
  return <span className={`status-pill status-pill--${status}`}>{LABELS[status]}</span>
}
