import { useEffect, useState } from 'react'
import { subscribeSeasons } from '../services/firestoreService'
import { Leaderboard } from './Leaderboard'
import type { Season } from '../types'

/** Read-only browser for archived contests, available to every signed-in participant (not just admins). */
export function PastContests({ currentUserId, currentUserEmail }: { currentUserId?: string; currentUserEmail?: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Only starts listening the first time this section is opened, but stays
  // live from then on - so a reset archiving a new season (or an admin
  // deleting one) shows up immediately instead of only after a page reload.
  useEffect(() => {
    if (!open) return
    setLoading(true)
    return subscribeSeasons((result) => {
      setSeasons(result)
      setLoaded(true)
      setLoading(false)
    })
  }, [open])

  function handleToggleOpen() {
    setOpen((o) => !o)
  }

  return (
    <div className="card">
      <button type="button" className="section-toggle" onClick={handleToggleOpen}>
        {open ? '▾' : '▸'} Past contests{loaded ? ` (${seasons.length})` : ''}
      </button>
      {open && (
        <>
          {loading && <p className="hint-text">Loading…</p>}
          {!loading && seasons.length === 0 && <p className="hint-text">No past contests yet.</p>}
          {!loading && seasons.length > 0 && (
            <ul className="submissions-list">
              {seasons.map((season) => (
                <li key={season.id}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setExpandedId(expandedId === season.id ? null : season.id)}
                  >
                    {expandedId === season.id ? '▾' : '▸'} <strong>{season.title}</strong>{' '}
                    <span className="hint-text">— {new Date(season.archivedAt).toLocaleDateString()}</span>
                  </button>
                  {expandedId === season.id &&
                    (season.result ? (
                      <Leaderboard
                        contestants={season.contestants}
                        predictions={season.predictions}
                        result={season.result}
                        currentUserId={currentUserId}
                        currentUserEmail={currentUserEmail}
                        startExpanded={false}
                      />
                    ) : (
                      <p className="hint-text">This contest was never finalized.</p>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
