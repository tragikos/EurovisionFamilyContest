import { useEffect, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useContestData } from '../context/ContestDataContext'
import { useAuth } from '../context/AuthContext'
import { useToast, errorMessage } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { SortableList } from '../components/SortableList'
import { PredictionOrderList } from '../components/PredictionOrderList'
import { Spinner } from '../components/Spinner'
import { computeStandings } from '../services/scoring'
import {
  deleteAllSeasons,
  deleteSeason,
  exportBackup,
  importBackup,
  inviteMember,
  resetContest,
  saveContestants,
  saveFinalResult,
  setAdminEmails,
  setContestTitle,
  setMemberAssignedName,
  setMemberBlocked,
  setVotingStatus,
  subscribeMembers,
  subscribeSeasons,
} from '../services/firestoreService'
import type { BackupData, Contestant, Member, Prediction, Season, SubmissionStatus, VotingStatus } from '../types'

export function AdminPage() {
  const { ready, config, contestants, predictions, submissionStatuses } = useContestData()

  if (!ready || !config) return null

  return (
    <div className="admin-page">
      <ContestControlCard
        status={config.votingStatus}
        title={config.title ?? ''}
        hasContestants={contestants.length > 0}
      />
      <ContestantsCard contestants={contestants} votingStatus={config.votingStatus} />
      {config.votingStatus === 'closed' && <FinalStandingCard contestants={contestants} />}
      <SubmissionsCard
        predictions={predictions}
        submissionStatuses={submissionStatuses}
        contestants={contestants}
        votingStatus={config.votingStatus}
      />
      <InvitesCard />
      <AdminsCard adminEmails={config.adminEmails} />
      <BackupCard votingStatus={config.votingStatus} />
      <HistoryCard />
      <DangerZoneCard title={config.title ?? ''} votingStatus={config.votingStatus} />
    </div>
  )
}

/** Collapsed-by-default wrapper for the less-frequently-used admin sections. */
function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card">
      <button type="button" className="section-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} {title}
      </button>
      {open && <div className="collapsible-card__body">{children}</div>}
    </div>
  )
}

function ContestControlCard({
  status,
  title,
  hasContestants,
}: {
  status: VotingStatus
  title: string
  hasContestants: boolean
}) {
  const { showSuccess, showError } = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<'start' | 'end' | null>(null)
  const [titleInput, setTitleInput] = useState(title)
  const [savingTitle, setSavingTitle] = useState(false)

  useEffect(() => setTitleInput(title), [title])

  async function transition(next: VotingStatus, which: 'start' | 'end') {
    const confirmed = await confirm(
      which === 'start'
        ? 'Start voting now? Family members will be able to submit predictions immediately.'
        : "End voting now? Nobody will be able to submit or change predictions after this.",
      { confirmLabel: which === 'start' ? 'Start voting' : 'End voting' },
    )
    if (!confirmed) return
    setBusy(which)
    try {
      await setVotingStatus(next)
      showSuccess(which === 'start' ? 'Voting is open!' : 'Voting closed.')
    } catch (err) {
      showError(errorMessage(err, 'Failed to update voting status.'))
    } finally {
      setBusy(null)
    }
  }

  async function handleSaveTitle() {
    const confirmed = await confirm(`Save "${titleInput.trim()}" as the contest title?`, { confirmLabel: 'Save' })
    if (!confirmed) return
    setSavingTitle(true)
    try {
      await setContestTitle(titleInput.trim())
      showSuccess('Contest title saved.')
    } catch (err) {
      showError(errorMessage(err, 'Failed to save the title.'))
    } finally {
      setSavingTitle(false)
    }
  }

  return (
    <div className="card">
      <h2>Voting control</h2>
      <label className="field-label">
        Contest title
        <div className="form-actions">
          <input
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            className="admin-email-input"
            value={titleInput}
            placeholder="e.g. Eurovision Final 2027"
            onChange={(e) => setTitleInput(e.target.value)}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={handleSaveTitle}
            disabled={savingTitle || titleInput === title}
          >
            {savingTitle && <Spinner />}
            {savingTitle ? 'Saving…' : 'Save title'}
          </button>
        </div>
      </label>
      <p>
        Current status: <strong>{status.replace('_', ' ')}</strong>
      </p>
      <div className="form-actions">
        <button
          type="button"
          className="primary-button"
          disabled={busy !== null || status !== 'not_started' || !hasContestants}
          onClick={() => transition('open', 'start')}
        >
          {busy === 'start' && <Spinner />}
          {busy === 'start' ? 'Starting…' : 'Start voting'}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy !== null || status !== 'open'}
          onClick={() => transition('closed', 'end')}
        >
          {busy === 'end' && <Spinner />}
          {busy === 'end' ? 'Ending…' : 'End voting'}
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
  const { showSuccess, showError } = useToast()
  const confirm = useConfirm()
  const [rows, setRows] = useState<{ key: string; country: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(votingStatus === 'not_started')

  useEffect(() => {
    setRows(
      [...contestants]
        .sort((a, b) => a.appearanceOrder - b.appearanceOrder)
        .map((c) => ({ key: c.id, country: c.country })),
    )
  }, [contestants])

  // Minimized the moment voting opens - there's usually nothing left to do
  // here once voting has started - and re-expanded the moment the contest is
  // reset, since setting up next season's contestants is the very next thing
  // an admin needs to do. Only reacts to the *transition*, so an admin who
  // deliberately toggles it manually isn't fought with on every render.
  useEffect(() => {
    if (votingStatus === 'open') setOpen(false)
    else if (votingStatus === 'not_started') setOpen(true)
  }, [votingStatus])

  function updateCountry(key: string, value: string) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, country: value } : row)))
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key))
  }

  function addRow() {
    setRows((prev) => [...prev, { key: `new-${Date.now()}-${prev.length}`, country: '' }])
  }

  const originalCountries = [...contestants]
    .sort((a, b) => a.appearanceOrder - b.appearanceOrder)
    .map((c) => c.country)
  const currentCountries = rows.map((r) => r.country.trim()).filter(Boolean)
  const hasChanges = JSON.stringify(originalCountries) !== JSON.stringify(currentCountries)

  async function handleSave() {
    const confirmed = await confirm('Save this contestant list and running order?', { confirmLabel: 'Save' })
    if (!confirmed) return
    setSaving(true)
    try {
      const countries = rows.map((r) => r.country.trim()).filter(Boolean)
      await saveContestants(countries)
      showSuccess('Contestants saved.')
    } catch (err) {
      showError(errorMessage(err, 'Failed to save contestants.'))
    } finally {
      setSaving(false)
    }
  }

  // Voting has to be back at 'not_started' (i.e. the contest reset) before
  // the list can be touched again - editing it once real predictions exist
  // against these contestant ids could silently invalidate every submitted
  // pick, so this is a hard lock, not just a warning.
  const editingDisabled = votingStatus === 'closed' || votingStatus === 'finalized'

  return (
    <div className="card">
      <button type="button" className="section-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Contestants &amp; running order
      </button>
      {open && (
        <div className="collapsible-card__body">
          {editingDisabled ? (
            <p className="warning-text">
              Voting has ended — the contestant list is locked until you reset the contest for a new season.
            </p>
          ) : (
            votingStatus === 'open' && (
              <p className="warning-text">
                Voting is open. Editing the contestant list now can invalidate submitted predictions — only do this
                if you know what you're doing.
              </p>
            )
          )}
          <SortableList
            items={rows}
            getId={(row) => row.key}
            onReorder={setRows}
            disabled={editingDisabled}
            renderItem={(row, index, handleProps) => (
              <div className="sortable-row__content">
                <span className="sortable-row__rank">{index + 1}</span>
                <span className="sortable-row__handle" {...handleProps}>⠿</span>
                <input
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  className="sortable-row__input"
                  value={row.country}
                  placeholder="Country name"
                  disabled={editingDisabled}
                  onChange={(e) => updateCountry(row.key, e.target.value)}
                />
                <button
                  type="button"
                  className="link-button link-button--danger"
                  onClick={() => removeRow(row.key)}
                  disabled={editingDisabled}
                >
                  Remove
                </button>
              </div>
            )}
          />
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={addRow} disabled={editingDisabled}>
              + Add country
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={handleSave}
              disabled={saving || !hasChanges || editingDisabled}
            >
              {saving && <Spinner />}
              {saving ? 'Saving…' : 'Save contestants'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SubmissionsCard({
  predictions,
  submissionStatuses,
  contestants,
  votingStatus,
}: {
  predictions: Prediction[]
  submissionStatuses: SubmissionStatus[]
  contestants: Contestant[]
  votingStatus: VotingStatus
}) {
  // Who's submitted and when (submissionStatuses) is always visible, even
  // while voting is open - it deliberately carries no `order` field, so it
  // can't leak anyone's actual pick. The pick itself (predictions) only
  // becomes readable once voting is no longer open - while it's open,
  // `predictions` here only ever contains the current admin's own
  // submission, if any, so the expand-to-see-order toggle below is
  // effectively unavailable for anyone else's row until then.
  const revealPicks = votingStatus !== 'open'
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  // Expanded the moment voting opens, since tracking who's submitted is
  // exactly what an admin wants front-and-center once people can actually
  // start submitting. Only reacts to the *transition* into 'open', so
  // manually collapsing it again isn't fought with on every render.
  useEffect(() => {
    if (votingStatus === 'open') setOpen(true)
  }, [votingStatus])

  const predictionById = new Map(predictions.map((p) => [p.id, p]))
  const sorted = [...submissionStatuses].sort((a, b) => a.memberName.localeCompare(b.memberName))
  const filtered = query.trim()
    ? sorted.filter((s) => s.memberName.toLowerCase().includes(query.trim().toLowerCase()))
    : sorted

  return (
    <div className="card">
      <button type="button" className="section-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Submissions ({submissionStatuses.length})
      </button>
      {open && (
        <div className="collapsible-card__body">
          {!revealPicks && (
            <p className="hint-text">
              Picks stay hidden until voting closes, even from admins - names and times only.
            </p>
          )}
          {submissionStatuses.length === 0 ? (
            <p className="hint-text">Nobody has submitted a prediction yet.</p>
          ) : (
            <>
              {submissionStatuses.length > 6 && (
                <input
                  autoComplete="off"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  className="admin-email-input"
                  value={query}
                  placeholder="Filter by name…"
                  onChange={(e) => setQuery(e.target.value)}
                />
              )}
              <ul className="submissions-list">
                {filtered.map((s) => {
                  const prediction = predictionById.get(s.id)
                  return (
                    <li key={s.id}>
                      {revealPicks && prediction ? (
                        <button
                          type="button"
                          className="link-button submission-row-toggle"
                          onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                        >
                          {expandedId === s.id ? '▾' : '▸'} {s.memberName}
                        </button>
                      ) : (
                        s.memberName
                      )}{' '}
                      <span className="hint-text">— saved {new Date(s.updatedAt).toLocaleString()}</span>
                      {expandedId === s.id && prediction && (
                        <PredictionOrderList contestants={contestants} order={prediction.order} />
                      )}
                    </li>
                  )
                })}
              </ul>
              {filtered.length === 0 && <p className="hint-text">No submissions match "{query}".</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function FinalStandingCard({ contestants }: { contestants: Contestant[] }) {
  const { showSuccess, showError } = useToast()
  const confirm = useConfirm()
  const [order, setOrder] = useState<Contestant[]>(
    [...contestants].sort((a, b) => a.appearanceOrder - b.appearanceOrder),
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const confirmed = await confirm(
      'Finalize this as the official result? Every prediction will be scored against it and voting will be marked finalized.',
      { confirmLabel: 'Finalize results' },
    )
    if (!confirmed) return
    setSaving(true)
    try {
      await saveFinalResult(order.map((c) => c.id))
      showSuccess('Results finalized!')
    } catch (err) {
      showError(errorMessage(err, 'Failed to finalize results.'))
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
        renderItem={(c, index, handleProps) => (
          <div className="sortable-row__content">
            <span className="sortable-row__rank">{index + 1}</span>
            <span className="sortable-row__handle" {...handleProps}>⠿</span>
            <span className="sortable-row__label">{c.country}</span>
          </div>
        )}
      />
      <div className="form-actions">
        <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
          {saving && <Spinner />}
          {saving ? 'Saving…' : 'Finalize results'}
        </button>
      </div>
    </div>
  )
}

function InvitesCard() {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const confirm = useConfirm()
  const [members, setMembers] = useState<Member[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const [seasons, setSeasons] = useState<Season[] | null>(null)
  const [seasonsWanted, setSeasonsWanted] = useState(false)
  const [loadingSeasons, setLoadingSeasons] = useState(false)
  const [blockingEmail, setBlockingEmail] = useState<string | null>(null)
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => subscribeMembers(setMembers), [])

  // Only starts listening once a row is first expanded (most admin visits
  // never need past-submission history), but stays live from then on - a
  // one-shot fetch here would go stale the moment a reset archives a new
  // season while this card is still open.
  useEffect(() => {
    if (!seasonsWanted) return
    setLoadingSeasons(true)
    return subscribeSeasons((result) => {
      setSeasons(result)
      setLoadingSeasons(false)
    })
  }, [seasonsWanted])

  async function handleInvite() {
    const email = newEmail.trim().toLowerCase()
    if (!email || !user) return
    const confirmed = await confirm(
      `Invite ${email}${newName.trim() ? ` (as "${newName.trim()}")` : ''} to the contest?`,
      { confirmLabel: 'Invite' },
    )
    if (!confirmed) return
    setInviting(true)
    try {
      const created = await inviteMember(email, user.email, newName)
      showSuccess(created ? `Invited ${email}.` : `${email} was already invited.`)
      setNewEmail('')
      setNewName('')
    } catch (err) {
      showError(errorMessage(err, 'Failed to invite that email.'))
    } finally {
      setInviting(false)
    }
  }

  function startEditName(member: Member) {
    setEditingEmail(member.email)
    setEditingName(member.assignedName ?? '')
  }

  async function handleSaveName(email: string) {
    const trimmed = editingName.trim()
    const confirmed = await confirm(
      trimmed ? `Set the display name for ${email} to "${trimmed}"?` : `Clear the display name for ${email}?`,
      { confirmLabel: 'Save' },
    )
    if (!confirmed) return
    setSavingName(true)
    try {
      await setMemberAssignedName(email, editingName)
      showSuccess('Display name updated.')
      setEditingEmail(null)
    } catch (err) {
      showError(errorMessage(err, 'Failed to update that name.'))
    } finally {
      setSavingName(false)
    }
  }

  function toggleExpand(email: string) {
    if (expandedEmail === email) {
      setExpandedEmail(null)
      return
    }
    setSeasonsWanted(true)
    setExpandedEmail(email)
  }

  async function handleToggleBlock(member: Member) {
    const blocking = member.status !== 'blocked'
    const confirmed = await confirm(
      blocking
        ? `Block ${member.email} from voting? They'll keep their history but won't be able to participate until unblocked.`
        : `Unblock ${member.email}, restoring their access to vote?`,
      { confirmLabel: blocking ? 'Block' : 'Unblock', danger: blocking },
    )
    if (!confirmed) return
    setBlockingEmail(member.email)
    try {
      await setMemberBlocked(member.email, blocking)
      showSuccess(blocking ? `${member.email} blocked.` : `${member.email} unblocked.`)
    } catch (err) {
      showError(errorMessage(err, 'Failed to update that player.'))
    } finally {
      setBlockingEmail(null)
    }
  }

  function statusTooltip(member: Member): string {
    if (member.status === 'blocked') return 'Blocked'
    if (member.status === 'invited') return "Invited — hasn't signed in yet"
    return `Active — first signed in ${member.firstSignInAt ? new Date(member.firstSignInAt).toLocaleDateString() : ''}`
  }

  const sorted = [...members].sort((a, b) => a.email.localeCompare(b.email))

  return (
    <CollapsibleCard title={`Invited players (${members.length})`}>
      <p className="hint-text">
        Only invited Google accounts can vote (admins can always vote regardless of this list). Block a player to
        revoke their access without deleting their history. Hover an icon for details.
      </p>
      {sorted.length === 0 ? (
        <p className="hint-text">Nobody has been invited yet.</p>
      ) : (
        <ul className="submissions-list">
          {sorted.map((member) => (
            <li key={member.email}>
              <div className="invite-row">
                <span className={`status-dot status-dot--${member.status}`} title={statusTooltip(member)} />
                {editingEmail === member.email ? (
                  <>
                    <input
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-form-type="other"
                      className="invite-row__name-input"
                      value={editingName}
                      placeholder={member.email}
                      autoFocus
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveName(member.email)
                        if (e.key === 'Escape') setEditingEmail(null)
                      }}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      title="Save name"
                      onClick={() => handleSaveName(member.email)}
                      disabled={savingName}
                    >
                      {savingName ? <Spinner /> : '✔️'}
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      title="Cancel"
                      onClick={() => setEditingEmail(null)}
                      disabled={savingName}
                    >
                      ✖️
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="link-button invite-row__name"
                      onClick={() => toggleExpand(member.email)}
                      title={member.assignedName ? member.email : undefined}
                    >
                      {expandedEmail === member.email ? '▾' : '▸'} {member.assignedName || member.email}
                    </button>
                    <span
                      className="invite-row__icon"
                      title={`Invited by ${member.invitedBy} on ${new Date(member.invitedAt).toLocaleDateString()}`}
                    >
                      ℹ️
                    </span>
                    <button
                      type="button"
                      className="icon-button"
                      title="Edit display name"
                      onClick={() => startEditName(member)}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      title={member.status === 'blocked' ? 'Unblock this player' : 'Block this player'}
                      onClick={() => handleToggleBlock(member)}
                      disabled={blockingEmail === member.email}
                    >
                      {blockingEmail === member.email ? <Spinner /> : member.status === 'blocked' ? '♻️' : '🚫'}
                    </button>
                  </>
                )}
              </div>
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
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          className="admin-email-input"
          value={newEmail}
          placeholder="name@gmail.com"
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <input
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          className="admin-email-input"
          value={newName}
          placeholder="Display name (optional)"
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="button" className="primary-button" onClick={handleInvite} disabled={inviting}>
          {inviting && <Spinner />}
          {inviting ? 'Inviting…' : '+ Invite player'}
        </button>
      </div>
    </CollapsibleCard>
  )
}

function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** Past (archived) contests this player took part in - just the contest, date, and standing, not the full pick. */
function MemberPastSubmissions({ member, seasons }: { member: Member; seasons: Season[] }) {
  // Live predictions are keyed by uid; imported historical predictions are
  // keyed by email (imported before the person ever had a uid) - match either.
  const entries = seasons
    .map((season) => {
      const prediction = season.predictions.find((p) => p.id === member.uid || p.id === member.email)
      if (!prediction) return null
      const standing = season.result
        ? computeStandings(season.predictions, season.result).find((s) => s.id === prediction.id)
        : undefined
      return { season, standing }
    })
    .filter((entry): entry is { season: Season; standing: ReturnType<typeof computeStandings>[number] | undefined } => !!entry)

  if (entries.length === 0) {
    return <p className="hint-text">No past submissions.</p>
  }

  return (
    <ul className="submissions-list">
      {entries.map(({ season, standing }) => (
        <li key={season.id} className="hint-text">
          <strong>{season.title}</strong> — {new Date(season.archivedAt).toLocaleDateString()} —{' '}
          {standing ? `${ordinal(standing.rank)} place (${standing.score})` : 'not finalized'}
        </li>
      ))}
    </ul>
  )
}

function HistoryCard() {
  const { showSuccess, showError } = useToast()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)

  useEffect(() => {
    setLoading(true)
    return subscribeSeasons((result) => {
      setSeasons(result)
      setLoaded(true)
      setLoading(false)
    })
  }, [])

  async function handleDeleteOne(season: Season) {
    const confirmed = await confirm(`Permanently delete "${season.title}"? This can't be undone.`, {
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!confirmed) return
    setDeletingId(season.id)
    try {
      await deleteSeason(season.id)
      setSeasons((prev) => prev.filter((s) => s.id !== season.id))
      showSuccess(`Deleted "${season.title}".`)
    } catch (err) {
      showError(errorMessage(err, 'Failed to delete that contest.'))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteAll() {
    const confirmed = await confirm(
      `Permanently delete ALL ${seasons.length} archived contest(s)? This can't be undone.`,
      { confirmLabel: 'Delete all', danger: true },
    )
    if (!confirmed) return
    setDeletingAll(true)
    try {
      await deleteAllSeasons()
      setSeasons([])
      showSuccess('All contest history deleted.')
    } catch (err) {
      showError(errorMessage(err, 'Failed to delete contest history.'))
    } finally {
      setDeletingAll(false)
    }
  }

  return (
    <div className="card">
      <button type="button" className="section-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Contest history ({loaded ? seasons.length : '…'})
      </button>
      {open && (
        <div className="collapsible-card__body">
          <p className="hint-text">Past (archived) contests. Deleting one is permanent and cannot be undone.</p>
          {loading ? (
            <p className="hint-text">Loading…</p>
          ) : seasons.length === 0 ? (
            <p className="hint-text">No archived contests yet.</p>
          ) : (
            <ul className="submissions-list">
              {seasons.map((season) => (
                <li key={season.id} className="admin-email-row">
                  <span>
                    <strong>{season.title}</strong>{' '}
                    <span className="hint-text">
                      — {new Date(season.archivedAt).toLocaleDateString()}, {season.predictions.length} submission
                      {season.predictions.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="link-button link-button--danger"
                    onClick={() => handleDeleteOne(season)}
                    disabled={deletingId === season.id}
                  >
                    {deletingId === season.id && <Spinner />}
                    {deletingId === season.id ? 'Deleting…' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {seasons.length > 0 && (
            <div className="form-actions">
              <button type="button" className="danger-button" onClick={handleDeleteAll} disabled={deletingAll}>
                {deletingAll && <Spinner />}
                {deletingAll ? 'Deleting all…' : 'Delete all history'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AdminsCard({ adminEmails }: { adminEmails: string[] }) {
  const { user } = useAuth()
  const { showSuccess, showError } = useToast()
  const confirm = useConfirm()
  const [emails, setEmails] = useState<string[]>(adminEmails)
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => setEmails(adminEmails), [adminEmails])

  function addEmail() {
    const trimmed = newEmail.trim().toLowerCase()
    if (!trimmed || emails.includes(trimmed)) return
    setEmails((prev) => [...prev, trimmed])
    setNewEmail('')
  }

  function removeEmail(email: string) {
    // Blocked in the UI (not just discouraged): removing your own admin
    // access here has no "undo" button - meta/config can only be updated by
    // an existing admin, so a sole admin locking themselves out is
    // unrecoverable without going into the Firebase console directly.
    if (email === user?.email) return
    setEmails((prev) => prev.filter((e) => e !== email))
  }

  const hasChanges = JSON.stringify([...emails].sort()) !== JSON.stringify([...adminEmails].sort())

  async function handleSave() {
    if (emails.length === 0) {
      showError('There must be at least one admin.')
      return
    }
    const confirmed = await confirm('Save this list of admins? Anyone on it gets full admin access.', {
      confirmLabel: 'Save',
    })
    if (!confirmed) return
    setSaving(true)
    try {
      await setAdminEmails(emails)
      showSuccess('Admins saved.')
    } catch (err) {
      showError(errorMessage(err, 'Failed to save admins.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <CollapsibleCard title={`Admins (${emails.length})`}>
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
            <button
              type="button"
              className="link-button link-button--danger"
              onClick={() => removeEmail(email)}
              disabled={email === user?.email}
              title={email === user?.email ? "You can't remove your own admin access" : undefined}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="form-actions">
        <input
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          className="admin-email-input"
          value={newEmail}
          placeholder="name@gmail.com"
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <button type="button" className="secondary-button" onClick={addEmail}>
          + Add admin
        </button>
        <button type="button" className="primary-button" onClick={handleSave} disabled={saving || !hasChanges}>
          {saving && <Spinner />}
          {saving ? 'Saving…' : 'Save admins'}
        </button>
      </div>
    </CollapsibleCard>
  )
}

/** Full backup/restore of everything in Firestore - separate from the per-season history above. */
function BackupCard({ votingStatus }: { votingStatus: VotingStatus }) {
  const { showSuccess, showError } = useToast()
  const confirm = useConfirm()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  async function handleExport() {
    const confirmed = await confirm('Download a full backup of the current contest data?', {
      confirmLabel: 'Export',
    })
    if (!confirmed) return
    setExporting(true)
    try {
      const data = await exportBackup()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date(data.exportedAt).toISOString().slice(0, 10)
      a.href = url
      a.download = `eurovision-family-contest-backup-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
      showSuccess('Backup downloaded.')
    } catch (err) {
      showError(errorMessage(err, 'Failed to export a backup.'))
    } finally {
      setExporting(false)
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setPendingFile(file)
    setFileName(file?.name ?? null)
  }

  async function handleImport() {
    if (!pendingFile) return
    const confirmed = await confirm(
      `This will REPLACE all current contestants, predictions, results, invited players, and history with ` +
        `the contents of "${pendingFile.name}". This cannot be undone. Continue?`,
      { confirmLabel: 'Restore', danger: true },
    )
    if (!confirmed) return
    setImporting(true)
    try {
      const text = await pendingFile.text()
      const data = JSON.parse(text) as BackupData
      if (!Array.isArray(data.contestants) || !Array.isArray(data.members) || !Array.isArray(data.seasons)) {
        throw new Error('That file doesn’t look like a valid backup.')
      }
      await importBackup(data)
      showSuccess('Backup restored. Reloading…')
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      showError(errorMessage(err, 'Failed to restore that backup.'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <CollapsibleCard title="Backup & restore">
      <p className="hint-text">
        Export everything (contestants, predictions, results, invited players, and history) as one file, or restore
        from a previously exported file. Restoring replaces everything currently stored.
      </p>
      {votingStatus === 'open' && (
        <p className="hint-text">
          Predictions stay hidden while voting is open, so an export taken now will skip them — export again once
          voting closes to include everyone's picks.
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="secondary-button" onClick={handleExport} disabled={exporting}>
          {exporting && <Spinner />}
          {exporting ? 'Exporting…' : 'Export backup'}
        </button>
      </div>
      <div className="form-actions">
        <input type="file" accept="application/json" onChange={handleFileChange} />
        <button type="button" className="danger-button" onClick={handleImport} disabled={importing || !pendingFile}>
          {importing && <Spinner />}
          {importing ? 'Restoring…' : 'Restore from backup'}
        </button>
        {fileName && !importing && <span className="hint-text">{fileName}</span>}
      </div>
    </CollapsibleCard>
  )
}

function DangerZoneCard({ title, votingStatus }: { title: string; votingStatus: VotingStatus }) {
  const { showSuccess, showError } = useToast()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [clearContestants, setClearContestants] = useState(false)
  const [busy, setBusy] = useState(false)

  const noRunningContest = votingStatus === 'not_started'

  async function handleReset() {
    const confirmed = await confirm(
      'This clears all predictions and the final result' +
        (clearContestants ? ' and the contestant list' : '') +
        ' so you can start a new contest. Continue?',
      { confirmLabel: 'Reset', danger: true },
    )
    if (!confirmed) return
    setBusy(true)
    try {
      await resetContest({ clearContestants, title })
      showSuccess('Contest reset — ready for a new season.')
    } catch (err) {
      showError(errorMessage(err, 'Failed to reset the contest.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card card--danger">
      <button type="button" className="section-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Contest Control
      </button>
      {open && (
        <div className="danger-zone">
          <p>Start a new contest (e.g. next year). This clears all family predictions and the final result.</p>
          <label className="checkbox-label">
            <input
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
              type="checkbox"
              checked={clearContestants}
              onChange={(e) => setClearContestants(e.target.checked)}
            />
            Also clear the contestant list
          </label>
          {noRunningContest && (
            <p className="hint-text">Nothing to reset — there's no contest in progress yet.</p>
          )}
          <button type="button" className="danger-button" onClick={handleReset} disabled={busy || noRunningContest}>
            {busy && <Spinner />}
            {busy ? 'Resetting…' : 'Reset contest'}
          </button>
        </div>
      )}
    </div>
  )
}
