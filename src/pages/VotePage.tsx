import { useEffect, useState } from 'react'
import { useContestData } from '../context/ContestDataContext'
import { useSession } from '../context/SessionContext'
import { SortableList } from '../components/SortableList'
import { Leaderboard } from '../components/Leaderboard'
import { submitPrediction, slugify } from '../services/firestoreService'
import type { Contestant } from '../types'

export function VotePage() {
  const { ready, config, contestants, predictions, result } = useContestData()
  const { session } = useSession()

  const myPrediction = session
    ? predictions.find((p) => p.id === slugify(session.memberName))
    : undefined

  const [order, setOrder] = useState<Contestant[]>([])
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(myPrediction?.updatedAt ?? null)

  useEffect(() => {
    if (contestants.length === 0) return
    const contestantById = new Map(contestants.map((c) => [c.id, c]))
    if (myPrediction) {
      const seeded = myPrediction.order.map((id) => contestantById.get(id)).filter((c): c is Contestant => !!c)
      const missing = contestants.filter((c) => !myPrediction.order.includes(c.id))
      setOrder([...seeded, ...missing])
    } else {
      setOrder([...contestants].sort((a, b) => a.appearanceOrder - b.appearanceOrder))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestants.length, myPrediction?.id])

  if (!ready || !session) return null

  if (!config || contestants.length === 0) {
    return (
      <div className="card">
        <h1>Welcome, {session.memberName}!</h1>
        <p>The admin hasn't added any contestants yet. Check back soon.</p>
      </div>
    )
  }

  if (config.votingStatus === 'finalized' && result) {
    return (
      <div className="card">
        <h1>🎉 The results are in!</h1>
        <Leaderboard
          contestants={contestants}
          predictions={predictions}
          result={result}
          highlightMemberName={session.memberName}
        />
      </div>
    )
  }

  if (config.votingStatus === 'not_started') {
    return (
      <div className="card">
        <h1>Welcome, {session.memberName}!</h1>
        <p>Voting hasn't opened yet. Here's the running order for the show:</p>
        <ol className="final-order-list">
          {[...contestants]
            .sort((a, b) => a.appearanceOrder - b.appearanceOrder)
            .map((c) => (
              <li key={c.id}>{c.country}</li>
            ))}
        </ol>
      </div>
    )
  }

  if (config.votingStatus === 'closed') {
    return (
      <div className="card">
        <h1>Voting is closed</h1>
        <p>Waiting for the admin to enter the final results. Here's the order you predicted:</p>
        <ol className="final-order-list">
          {order.map((c) => (
            <li key={c.id}>{c.country}</li>
          ))}
        </ol>
      </div>
    )
  }

  // votingStatus === 'open'
  async function handleSubmit() {
    if (!session) return
    setSaving(true)
    try {
      await submitPrediction(
        session.memberName,
        order.map((c) => c.id),
      )
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <h1>Pick your order, {session.memberName}!</h1>
      <p>
        Drag the countries into the order you think they'll finish — 1st place at the top, last place at the
        bottom. You can change your prediction as many times as you like until voting closes.
      </p>
      <SortableList
        items={order}
        getId={(c) => c.id}
        onReorder={setOrder}
        renderItem={(c, index) => (
          <div className="sortable-row__content">
            <span className="sortable-row__rank">{index + 1}</span>
            <span className="sortable-row__handle">⠿</span>
            <span className="sortable-row__label">{c.country}</span>
          </div>
        )}
      />
      <div className="form-actions">
        <button type="button" className="primary-button" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving…' : myPrediction ? 'Update my prediction' : 'Submit my prediction'}
        </button>
        {savedAt && <span className="hint-text">Saved {new Date(savedAt).toLocaleTimeString()}</span>}
      </div>
    </div>
  )
}
