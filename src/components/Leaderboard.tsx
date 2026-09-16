import { Fragment, useState } from 'react'
import type { Contestant, FinalResult, Prediction } from '../types'
import { computeStandings } from '../services/scoring'

export function Leaderboard({
  contestants,
  predictions,
  result,
  currentUserId,
}: {
  contestants: Contestant[]
  predictions: Prediction[]
  result: FinalResult
  currentUserId?: string
}) {
  const contestantById = new Map(contestants.map((c) => [c.id, c]))
  const predictionById = new Map(predictions.map((p) => [p.id, p]))
  const standings = computeStandings(predictions, result)
  const [expandedId, setExpandedId] = useState<string | null>(currentUserId ?? null)

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
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Family member</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry) => {
              const isExpanded = expandedId === entry.id
              const isMe = entry.id === currentUserId
              const prediction = predictionById.get(entry.id)
              return (
                <Fragment key={entry.id}>
                  <tr
                    className={`leaderboard-table__row${isMe ? ' leaderboard-table__row--me' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <td>
                      {entry.rank === 1 ? '🏆 ' : ''}
                      {entry.rank}
                    </td>
                    <td>
                      {entry.memberName}
                      {isMe ? ' (you)' : ''}
                    </td>
                    <td>{entry.score}</td>
                  </tr>
                  {isExpanded && prediction && (
                    <tr className="leaderboard-table__detail-row">
                      <td colSpan={3}>
                        <PredictionBreakdown prediction={prediction} contestants={contestants} result={result} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
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

  return (
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
            <td>{row.cost ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
