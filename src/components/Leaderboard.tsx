import { Fragment, useState } from 'react'
import type { Contestant, FinalResult, Prediction } from '../types'
import { computeStandings, pointsForRank } from '../services/scoring'
import { medalEmoji } from '../utils/medal'

/**
 * Mirrors the original spreadsheet's conditional formatting (a white-to-color
 * scale per column, scaled to that column's own min/max) - adapted for this
 * app's theming by blending toward the card background instead of white, so
 * low-magnitude cells stay unobtrusive and high-magnitude ones stand out.
 */
function magnitudeColor(
  value: number,
  min: number,
  max: number,
  targetRgb: [number, number, number],
  baseRgb: [number, number, number],
): string {
  if (max === min) return 'transparent'
  const t = (value - min) / (max - min)
  const [r, g, b] = baseRgb.map((c, i) => Math.round(c + (targetRgb[i] - c) * t))
  return `rgb(${r}, ${g}, ${b})`
}

/** Reads the theme's actual --card-bg (light or dark) instead of assuming which one is active. */
function cardBgRgb(): [number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim() || '#24123f'
  const clean = hex.replace('#', '')
  const value = parseInt(clean, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const SCORE_TARGET: [number, number, number] = [122, 53, 53] // muted red, echoing the sheet's total-row red
const COST_TARGET: [number, number, number] = [47, 107, 82] // muted green, echoing the sheet's per-cell green

export function Leaderboard({
  contestants,
  predictions,
  result,
  currentUserId,
  currentUserEmail,
  startExpanded = true,
}: {
  contestants: Contestant[]
  predictions: Prediction[]
  result: FinalResult
  /** Live predictions are keyed by uid; archived/imported ones may be keyed by email - pass both to match either. */
  currentUserId?: string
  currentUserEmail?: string
  /** Whether the current user's own row should start pre-expanded. Set false to start fully collapsed (e.g. when browsing past contests). */
  startExpanded?: boolean
}) {
  const contestantById = new Map(contestants.map((c) => [c.id, c]))
  const predictionById = new Map(predictions.map((p) => [p.id, p]))
  const standings = computeStandings(predictions, result)
  const myId = predictions.find((p) => p.id === currentUserId || p.id === currentUserEmail)?.id
  const [expandedId, setExpandedId] = useState<string | null>(startExpanded ? (myId ?? null) : null)

  const scores = standings.map((s) => s.score)
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)
  const cardBg = cardBgRgb()

  return (
    <div className="leaderboard">
      <section>
        <h2>Actual final standing</h2>
        <ol className="final-order-list">
          {result.order.map((id) => (
            <li key={id}>{contestantById.get(id)?.country ?? id}</li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Family leaderboard</h2>
        <p className="hint-text">
          Lower score is better — 0 means a perfect prediction. Click anyone to see their full pick and how each
          country's placement counted against them.
        </p>
        <div className="table-scroll">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Family member</th>
                <th>Points</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((entry) => {
                const isExpanded = expandedId === entry.id
                const isMe = entry.id === myId
                const prediction = predictionById.get(entry.id)
                return (
                  <Fragment key={entry.id}>
                    <tr
                      className={`leaderboard-table__row${isMe ? ' leaderboard-table__row--me' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    >
                      <td>
                        {medalEmoji(entry.rank)}
                        {entry.rank}
                      </td>
                      <td>
                        {entry.memberName}
                        {isMe ? ' (you)' : ''}
                      </td>
                      <td>{pointsForRank(entry.rank)}</td>
                      <td style={{ background: magnitudeColor(entry.score, minScore, maxScore, SCORE_TARGET, cardBg) }}>
                        {entry.score}
                      </td>
                    </tr>
                    {isExpanded && prediction && (
                      <tr className="leaderboard-table__detail-row">
                        <td colSpan={4}>
                          <PredictionBreakdown prediction={prediction} contestants={contestants} result={result} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function PredictionBreakdown({
  prediction,
  contestants,
  result,
}: {
  prediction: Prediction
  contestants: Contestant[]
  result: FinalResult
}) {
  const contestantById = new Map(contestants.map((c) => [c.id, c]))
  const actualPosition = new Map(result.order.map((id, index) => [id, index]))

  const rows = prediction.order.map((id, predictedIndex) => {
    const actualIndex = actualPosition.get(id)
    return {
      id,
      country: contestantById.get(id)?.country ?? id,
      predictedRank: predictedIndex + 1,
      actualRank: actualIndex === undefined ? null : actualIndex + 1,
      cost: actualIndex === undefined ? null : Math.abs(actualIndex - predictedIndex),
    }
  })

  const costs = rows.map((r) => r.cost).filter((c): c is number => c !== null)
  const minCost = costs.length ? Math.min(...costs) : 0
  const maxCost = costs.length ? Math.max(...costs) : 0
  const cardBg = cardBgRgb()

  return (
    <div className="table-scroll">
      <table className="breakdown-table">
        <thead>
          <tr>
            <th>Country</th>
            <th>Predicted</th>
            <th>Actual</th>
            <th>Points off</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.country}</td>
              <td>{row.predictedRank}</td>
              <td>{row.actualRank ?? '—'}</td>
              <td
                style={
                  row.cost !== null
                    ? { background: magnitudeColor(row.cost, minCost, maxCost, COST_TARGET, cardBg) }
                    : undefined
                }
              >
                {row.cost ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
