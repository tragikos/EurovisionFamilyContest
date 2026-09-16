import { useEffect, useState } from 'react'
import { useContestData } from '../context/ContestDataContext'
import { useAuth } from '../context/AuthContext'
import { SortableList } from '../components/SortableList'
import { PredictionOrderList } from '../components/PredictionOrderList'
import { computeStandings } from '../services/scoring'
import {
  getSeasons,
  inviteMember,
  resetContest,
  saveContestants,
  saveFinalResult,
  setAdminEmails,
  setMemberBlocked,
  setVotingStatus,
  subscribeMembers,
} from '../services/firestoreService'
import type { Contestant, Member, Prediction, Season, VotingStatus } from '../types'

export function AdminPage() {
  const { ready, config, contestants, predictions } = useContestData()

  if (!ready || !config) return null

  return (
    <div className="admin-page">
      <ContestControlCard status={config.votingStatus} hasContestants={contestants.length > 0} />
      <ContestantsCard contestants={contestants} votingStatus={config.votingStatus} />
      <SubmissionsCard predictions={predictions} contestants={contestants} votingStatus={config.votingStatus} />
      {config.votingStatus === 'closed' && <FinalStandingCard contestants={contestants} />}
      <InvitesCard />
      <AdminsCard adminEmails={config.adminEmails} />
      <DangerZoneCard />
    </div>
  )
}

function ContestControlCard({ status, hasContestants }: { status: VotingStatus; hasContestants: boolean }) {
  const [busy, setBusy] = useState(false)

  async function transition(next: VotingStatus) {
    setBusy(true)
    try {
      await setVotingStatus(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>Voting control</h2>
      <p>
        Current status: <strong>{status.replace('_', ' ')}</strong>
      </p>
      <div className="form-actions">
        <button
          type="button"
          className="primary-button"
          disabled={busy || status !== 'not_started' || !hasContestants}
          onClick={() => transition('open')}
        >
          Start voting
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy || status !== 'open'}
          onClick={() => transition('closed')}
        >
          End voting
        </button>
      </div>
      {!hasContestants && status === 'not_started' && (
        <p className="hint-text">Add at least one contestant below before starting voting.</p>
      )}
    </div>
  )
}

function ContestantsCard({
  contestants,
  votingStatus,
}: {
  contestants: Contestant[]
  votingStatus: VotingStatus
}) {
  const [rows, setRows] = useState<{ key: string; country: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setRows(
      [...contestants]
        .sort((a, b) => a.appearanceOrder - b.appearanceOrder)
        .map((c) => ({ key: c.id, country: c.country })),
    )
  }, [contestants])

  function updateCountry(key: string, value: string) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, country: value } : row)))
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key))
  }

  function addRow() {
    setRows((prev) => [...prev, { key: `new-${Date.now()}-${prev.length}`, country: '' }])
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const countries = rows.map((r) => r.country.trim()).filter(Boolean)
      await saveContestants(countries)
      setMessage('Saved!')
    } finally {
      setSaving(false)
    }
  }

  const locked = votingStatus !== 'not_started'

  return (
    <div className="card">
      <h2>Contestants &amp; running order</h2>
      {locked && (
        <p className="warning-text">
          Voting has already started or finished. Editing the contestant list now can invalidate submitted
          predictions — only do this if you know what you're doing.
        </p>
      )}
      <SortableList
        items={rows}
        getId={(row) => row.key}
        onReorder={setRows}
        renderItem={(row, index) => (
          <div className="sortable-row__content">
            <span className="sortable-row__rank">{index + 1}</span>
            <span className="sortable-row__handle">⠿</span>
            <input
              className="sortable-row__input"
              value={row.country}
              placeholder="Country name"
              onChange={(e) => updateCountry(row.key, e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              className="link-button link-button--danger"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => removeRow(row.key)}
            >
              Remove
            </button>
          </div>
        )}
      />
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={addRow}>
          + Add country
        </button>
        <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save contestants'}
        </button>
        {message && <span className="hint-text">{message}</span>}
      </div>
    </div>
  )
}

function SubmissionsCard({
  predictions,
  contestants,
  votingStatus,
}: {
  predictions: Prediction[]
  contestants: Contestant[]
  votingStatus: VotingStatus
}) {
  // Picks stay hidden (name + time only) while voting is still open, even
  // from admins, so an admin who's also playing can't peek at everyone
  // else's picks before adjusting their own.
  const revealPicks = votingStatus !== 'open'

  return (
    <div className="card">
      <h2>Submissions ({predictions.length})</h2>
      {!revealPicks && (
        <p className="hint-text">Picks stay hidden until voting closes, even from admins.</p>
      )}
      {predictions.length === 0 ? (
        <p className="hint-text">Nobody has submitted a prediction yet.</p>
      ) : revealPicks ? (
        <ul className="submissions-list">
          {predictions.map((p) => (
            <li key={p.id}>
              <strong>{p.memberName}</strong>{' '}
              <span className="hint-text">— saved {new Date(p.updatedAt).toLocaleString()}</span>
              <PredictionOrderList contestants={contestants} order={p.order} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="submissions-list">
          {predictions.map((p) => (
            <li key={p.id}>
              {p.memberName} — <span className="hint-text">{new Date(p.updatedAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FinalStandingCard({ contestants }: { contestants: Contestant[] }) {
  const [order, setOrder] = useState<Contestant[]>(
    [...contestants].sort((a, b) => a.appearanceOrder - b.appearanceOrder),
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await saveFinalResult(order.map((c) => c.id))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <h2>Set final standing</h2>
      <p>Drag the countries into the real final result — 1st place at the top.</p>
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
        <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Finalize results'}
        </button>
      </div>
    </div>
  )
}

function InvitesCard() {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const [seasons, setSeasons] = useState<Season[] | null>(null)
  const [loadingSeasons, setLoadingSeasons] = useState(false)

  useEffect(() => subscribeMembers(setMembers), [])

  async function handleInvite() {
    const email = newEmail.trim().toLowerCase()
    if (!email || !user) return
    setInviting(true)
    setMessage(null)
    try {
      const created = await inviteMember(email, user.email)
      setMessage(created ? `Invited ${email}.` : `${email} was already invited.`)
      setNewEmail('')
    } finally {
      setInviting(false)
    }
  }

  async function toggleExpand(email: string) {
    if (expandedEmail === email) {
      setExpandedEmail(null)
      return
    }
    if (!seasons) {
      setLoadingSeasons(true)
      try {
        setSeasons(await getSeasons())
      } finally {
        setLoadingSeasons(false)
      }
    }
    setExpandedEmail(email)
  }

  function statusLabel(member: Member): string {
    if (member.status === 'blocked') return 'Blocked'
    if (member.status === 'invited') return 'Invited — hasn’t signed in yet'
    return `Active — first signed in ${member.firstSignInAt ? new Date(member.firstSignInAt).toLocaleDateString() : ''}`
  }

  const sorted = [...members].sort((a, b) => a.email.localeCompare(b.email))

  return (
    <div className="card">
      <h2>Invited players</h2>
      <p className="hint-text">
        Only invited Google accounts can vote (admins can always vote regardless of this list). Block a player to
        revoke their access without deleting their history.
      </p>
      {sorted.length === 0 ? (
        <p className="hint-text">Nobody has been invited yet.</p>
      ) : (
        <ul className="submissions-list">
          {sorted.map((member) => (
            <li key={member.email}>
              <div className="admin-email-row">
                <button type="button" className="link-button" onClick={() => toggleExpand(member.email)}>
                  {member.email}
                </button>
                <span className="hint-text">{statusLabel(member)}</span>
                <button
                  type="button"
                  className={member.status === 'blocked' ? 'link-button' : 'link-button link-button--danger'}
                  onClick={() => setMemberBlocked(member.email, member.status !== 'blocked')}
                >
                  {member.status === 'blocked' ? 'Unblock' : 'Block'}
                </button>
              </div>
              <p className="hint-text">
                Invited by {member.invitedBy} on {new Date(member.invitedAt).toLocaleDateString()}
              </p>
              {expandedEmail === member.email && (
                <div className="member-history">
                  {loadingSeasons ? (
                    <p className="hint-text">Loading past submissions…</p>
                  ) : (
                    <MemberPastSubmissions member={member} seasons={seasons ?? []} />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="form-actions">
        <input
          className="admin-email-input"
          value={newEmail}
          placeholder="name@gmail.com"
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <button type="button" className="primary-button" onClick={handleInvite} disabled={inviting}>
          {inviting ? 'Inviting…' : '+ Invite player'}
        </button>
        {message && <span className="hint-text">{message}</span>}
      </div>
    </div>
  )
}

/** Past (archived) submissions only - never the current round, so this can never leak an in-progress vote. */
function MemberPastSubmissions({ member, seasons }: { member: Member; seasons: Season[] }) {
  if (!member.uid) {
    return <p className="hint-text">No past submissions.</p>
  }

  const entries = seasons
    .map((season) => {
      const prediction = season.predictions.find((p) => p.id === member.uid)
      if (!prediction) return null
      const score = season.result ? computeStandings([prediction], season.result)[0].score : null
      return { season, prediction, score }
    })
    .filter((entry): entry is { season: Season; prediction: Prediction; score: number | null } => !!entry)

  if (entries.length === 0) {
    return <p className="hint-text">No past submissions.</p>
  }

  return (
    <div>
      {entries.map(({ season, prediction, score }) => (
        <div key={season.id} className="member-history__entry">
          <p className="hint-text">
            {new Date(season.archivedAt).toLocaleDateString()}
            {score !== null ? ` — score ${score}` : ' — not finalized'}
          </p>
          <PredictionOrderList contestants={season.contestants} order={prediction.order} />
        </div>
      ))}
    </div>
  )
}

function AdminsCard({ adminEmails }: { adminEmails: string[] }) {
  const { user } = useAuth()
  const [emails, setEmails] = useState<string[]>(adminEmails)
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setEmails(adminEmails), [adminEmails])

  function addEmail() {
    const trimmed = newEmail.trim().toLowerCase()
    if (!trimmed || emails.includes(trimmed)) return
    setEmails((prev) => [...prev, trimmed])
    setNewEmail('')
  }

  function removeEmail(email: string) {
    setEmails((prev) => prev.filter((e) => e !== email))
  }

  async function handleSave() {
    if (emails.length === 0) {
      setError('There must be at least one admin.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await setAdminEmails(emails)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <h2>Admins</h2>
      <p className="hint-text">
        Anyone signed in with one of these Google accounts gets admin access. Add a spouse or co-organizer here.
      </p>
      <ul className="submissions-list">
        {emails.map((email) => (
          <li key={email} className="admin-email-row">
            <span>
              {email}
              {user?.email === email && <span className="hint-text"> (you)</span>}
            </span>
            <button type="button" className="link-button link-button--danger" onClick={() => removeEmail(email)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="form-actions">
        <input
          className="admin-email-input"
          value={newEmail}
          placeholder="name@gmail.com"
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <button type="button" className="secondary-button" onClick={addEmail}>
          + Add admin
        </button>
        <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save admins'}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}

function DangerZoneCard() {
  const [open, setOpen] = useState(false)
  const [clearContestants, setClearContestants] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleReset() {
    const confirmed = window.confirm(
      'This clears all predictions and the final result' +
        (clearContestants ? ' and the contestant list' : '') +
        ' so you can start a new contest. Continue?',
    )
    if (!confirmed) return
    setBusy(true)
    try {
      await resetContest({ clearContestants })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card card--danger">
      <button type="button" className="link-button" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide' : 'Show'} danger zone
      </button>
      {open && (
        <div className="danger-zone">
          <p>Start a new contest (e.g. next year). This clears all family predictions and the final result.</p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={clearContestants}
              onChange={(e) => setClearContestants(e.target.checked)}
            />
            Also clear the contestant list
          </label>
          <button type="button" className="danger-button" onClick={handleReset} disabled={busy}>
            {busy ? 'Resetting…' : 'Reset contest'}
          </button>
        </div>
      )}
    </div>
  )
}
