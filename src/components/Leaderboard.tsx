import type { Contestant, FinalResult, Prediction } from '../types'
import { computeStandings } from '../services/scoring'

export function Leaderboard({
  contestants,
  predictions,
  result,
  highlightMemberName,
}: {
  contestants: Contestant[]
  predictions: Prediction[]
  result: FinalResult
  highlightMemberName?: string
}) {
  const contestantById = new Map(contestants.map((c) => [c.id, c]))
  const standings = computeStandings(predictions, result)

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
        <p className="hint-text">Lower score is better — 0 means a perfect prediction.</p>
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Family member</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry) => (
              <tr
                key={entry.memberName}
                className={entry.memberName === highlightMemberName ? 'leaderboard-table__row--me' : undefined}
              >
                <td>
                  {entry.rank === 1 ? '🏆 ' : ''}
                  {entry.rank}
                </td>
                <td>{entry.memberName}</td>
                <td>{entry.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
