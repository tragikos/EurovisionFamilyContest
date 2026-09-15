import type { FinalResult, Prediction, StandingEntry } from '../types'

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
    return { memberName: prediction.memberName, score }
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
