import { useEffect, useState } from 'react'
import { useContestData } from '../context/ContestDataContext'
import { subscribeMembers, subscribeSeasons } from '../services/firestoreService'
import { computeOverallStandings } from '../services/scoring'
import type { OverallStanding } from '../services/scoring'
import { medalEmoji } from '../utils/medal'
import type { Member, Prediction, Season } from '../types'

type SortKey = 'memberName' | 'contests' | 'wins' | 'bestScore' | 'averageScore' | 'points'
type SortDir = 'asc' | 'desc'

// The natural direction to start with when a column is first clicked: more
// contests/wins/points is better (desc), but a lower score is better (asc).
const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  memberName: 'asc',
  contests: 'desc',
  wins: 'desc',
  bestScore: 'asc',
  averageScore: 'asc',
  points: 'desc',
}

function compareStandings(a: OverallStanding, b: OverallStanding, key: SortKey): number {
  if (key === 'memberName') return a.memberName.localeCompare(b.memberName)
  return a[key] - b[key]
}

/**
 * Resolves the name a prediction should count under: a person's memberName
 * can drift across seasons (their old Google name, a stale test name, a
 * historical import's spelling), so this prefers their current admin-assigned
 * name, then their real Google name, and only falls back to whatever was
 * frozen onto that particular prediction if neither is known.
 */
function canonicalName(prediction: Prediction, members: Member[]): string {
  const member = members.find((m) => m.uid === prediction.id || m.email === prediction.id)
  return member?.assignedName?.trim() || member?.displayName?.trim() || prediction.memberName
}

/** A combined leaderboard across every finalized contest, past and present - visible to everyone, not just admins. */
export function OverallLeaderboardPage() {
  const { config, predictions, result } = useContestData()
  const [seasons, setSeasons] = useState<Season[] | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('points')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(DEFAULT_SORT_DIR[key])
    }
  }

  // Live subscription, not a one-shot fetch: a reset archiving a new season
  // (or an admin deleting one) should update this page immediately, not only
  // after it's remounted (e.g. by navigating away and back).
  useEffect(() => subscribeSeasons(setSeasons), [])

  useEffect(() => subscribeMembers(setMembers), [])

  if (!seasons) {
    return (
      <div className="card">
        <h1>All-time leaderboard</h1>
        <p className="hint-text">Loading…</p>
      </div>
    )
  }

  const withCanonicalNames = (preds: Prediction[]) =>
    preds.map((p) => ({ ...p, memberName: canonicalName(p, members) }))

  const rounds = [
    ...seasons
      .filter((s): s is Season & { result: NonNullable<Season['result']> } => s.result !== null)
      .map((s) => ({ predictions: withCanonicalNames(s.predictions), result: s.result })),
    ...(config?.votingStatus === 'finalized' && result
      ? [{ predictions: withCanonicalNames(predictions), result }]
      : []),
  ]

  if (rounds.length === 0) {
    return (
      <div className="card">
        <h1>All-time leaderboard</h1>
        <p className="hint-text">No finalized contests yet — this fills in once at least one contest is scored.</p>
      </div>
    )
  }

  const standings = [...computeOverallStandings(rounds)].sort(
    (a, b) => compareStandings(a, b, sortKey) * (sortDir === 'asc' ? 1 : -1),
  )

  function sortableHeader(label: string, key: SortKey) {
    const active = sortKey === key
    return (
      <th>
        <button type="button" className="sort-header" onClick={() => handleSort(key)}>
          {label}
          {active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
        </button>
      </th>
    )
  }

  return (
    <div className="card">
      <h1>All-time leaderboard</h1>
      <p className="hint-text">
        Combined across all {rounds.length} finalized contest{rounds.length === 1 ? '' : 's'} so far — 25-18-15-12-10
        -8-6-4-2-1 points for 1st through 10th each contest, like a race championship. Click a column to sort by it.
      </p>
      <div className="table-scroll">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              {sortableHeader('Family member', 'memberName')}
              {sortableHeader('Points', 'points')}
              {sortableHeader('Contests', 'contests')}
              {sortableHeader('Wins', 'wins')}
              {sortableHeader('Best score', 'bestScore')}
              {sortableHeader('Avg. score', 'averageScore')}
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.memberName}>
                <td>
                  {medalEmoji(s.rank)}
                  {s.rank}
                </td>
                <td>{s.memberName}</td>
                <td>{s.points}</td>
                <td>{s.contests}</td>
                <td>{s.wins}</td>
                <td>{s.bestScore}</td>
                <td>{s.averageScore.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
