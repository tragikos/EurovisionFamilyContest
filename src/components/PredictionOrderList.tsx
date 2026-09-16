import type { Contestant } from '../types'

export function PredictionOrderList({ contestants, order }: { contestants: Contestant[]; order: string[] }) {
  const contestantById = new Map(contestants.map((c) => [c.id, c]))
  return (
    <ol className="final-order-list">
      {order.map((id) => (
        <li key={id}>{contestantById.get(id)?.country ?? id}</li>
      ))}
    </ol>
  )
}
