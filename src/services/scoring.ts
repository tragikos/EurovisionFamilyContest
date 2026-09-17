import type { FinalResult, Prediction, StandingEntry } from '../types'

export interface OverallStanding {
  memberName: string
  contests: number
  wins: number
  bestScore: number
  averageScore: number
  points: number
}

/** F1-style points per finishing position: 25-18-15-12-10-8-6-4-2-1, then nothing. */
const POINTS_BY_RANK = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

export function pointsForRank(rank: number): number {
  return POINTS_BY_RANK[rank - 1] ?? 0
}

/**
 * Score = sum of |predicted position - actual position| across every
 * contestant, so lower is better (0 = predicted the final standing exactly).
 * Ties in score share the same rank (competition ranking: 1, 1, 3).
 */
export function computeStandings(predictions: Prediction[], result: FinalResult): StandingEntry[] {
  const actualPosition = new Map<string, number>()
  result.order.forEach((contestantId, index) => actualPosition.set(contestantId, index))

  const scored = predictions.map((prediction) => {
    let score = 0
    prediction.order.forEach((contestantId, index) => {
      const actualIndex = actualPosition.get(contestantId)
      if (actualIndex !== undefined) {
        score += Math.abs(actualIndex - index)
      }
    })
    return { id: prediction.id, memberName: prediction.memberName, score }
  })

  scored.sort((a, b) => a.score - b.score)

  const standings: StandingEntry[] = []
  let rank = 0
  let previousScore: number | null = null
  scored.forEach((entry, index) => {
    if (previousScore === null || entry.score !== previousScore) {
      rank = index + 1
      previousScore = entry.score
    }
    standings.push({ ...entry, rank })
  })
  return standings
}

/**
 * Aggregates standings across every finalized contest. People are matched by
 * their prediction's memberName (an admin-assigned name that stays the same
 * across seasons for the same person) rather than by id, since ids may be a
 * uid in one season and an email in another for historical entries.
 */
export function computeOverallStandings(rounds: { predictions: Prediction[]; result: FinalResult }[]): OverallStanding[] {
  const byName = new Map<
    string,
    { totalScore: number; contests: number; wins: number; bestScore: number; points: number }
  >()

  for (const round of rounds) {
    const standings = computeStandings(round.predictions, round.result)
    for (const entry of standings) {
      const name = entry.memberName.trim()
      if (!name) continue
      const existing = byName.get(name) ?? { totalScore: 0, contests: 0, wins: 0, bestScore: Infinity, points: 0 }
      existing.totalScore += entry.score
      existing.contests += 1
      existing.bestScore = Math.min(existing.bestScore, entry.score)
      existing.points += pointsForRank(entry.rank)
      if (entry.rank === 1) existing.wins += 1
      byName.set(name, existing)
    }
  }

  return Array.from(byName.entries())
    .map(([memberName, v]) => ({
      memberName,
      contests: v.contests,
      wins: v.wins,
      bestScore: v.bestScore,
      averageScore: v.totalScore / v.contests,
      points: v.points,
    }))
    .sort((a, b) => b.points - a.points)
}
