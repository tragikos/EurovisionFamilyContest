import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import type { WriteBatch } from 'firebase/firestore'
import type { FirestoreError } from 'firebase/firestore'
import { db } from '../firebase'
import type {
  BackupData,
  Contestant,
  ContestConfig,
  FinalResult,
  Member,
  Prediction,
  Season,
  SubmissionStatus,
  VotingStatus,
} from '../types'

// Refs are resolved lazily (not at module load) because `db` is null until
// Firebase env vars are configured - these functions are only ever called
// after a user has signed in, by which point db is guaranteed to exist.
function requireDb() {
  if (!db) throw new Error('Firebase is not configured.')
  return db
}

const configRef = () => doc(requireDb(), 'meta', 'config')
const resultsRef = () => doc(requireDb(), 'results', 'final')
const contestantsCol = () => collection(requireDb(), 'contestants')
const predictionsCol = () => collection(requireDb(), 'predictions')
const submissionStatusCol = () => collection(requireDb(), 'submissionStatus')
const membersCol = () => collection(requireDb(), 'members')
const seasonsCol = () => collection(requireDb(), 'seasons')

export function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '') || 'unnamed'
  )
}

function logSnapshotError(what: string) {
  return (error: FirestoreError) => console.error(`Failed to subscribe to ${what}:`, error)
}

export function subscribeConfig(callback: (config: ContestConfig | null) => void) {
  return onSnapshot(
    configRef(),
    (snapshot) => callback(snapshot.exists() ? (snapshot.data() as ContestConfig) : null),
    logSnapshotError('config'),
  )
}

/** Bootstraps the contest the first time anyone signs in, making that person the first admin. */
export async function createConfig(adminEmail: string) {
  const config: ContestConfig = {
    adminEmails: [adminEmail],
    votingStatus: 'not_started',
  }
  await setDoc(configRef(), config)
}

export async function setVotingStatus(status: VotingStatus) {
  await updateDoc(configRef(), { votingStatus: status })
}

export async function setAdminEmails(emails: string[]) {
  await updateDoc(configRef(), { adminEmails: emails })
}

export async function setContestTitle(title: string) {
  await updateDoc(configRef(), { title })
}

export function subscribeContestants(callback: (contestants: Contestant[]) => void) {
  const contestantsQuery = query(contestantsCol(), orderBy('appearanceOrder'))
  return onSnapshot(
    contestantsQuery,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Contestant)),
    logSnapshotError('contestants'),
  )
}

/**
 * Replaces the whole contestant list. Doc ids are slugs of the country name
 * so ids stay stable across re-saves as long as the country name is
 * unchanged, keeping any submitted predictions (which reference these ids)
 * valid.
 */
export async function saveContestants(countries: string[]) {
  const slugCounts = new Map<string, string[]>()
  for (const country of countries) {
    const slug = slugify(country)
    slugCounts.set(slug, [...(slugCounts.get(slug) ?? []), country])
  }
  const collisions = [...slugCounts.values()].filter((names) => names.length > 1)
  if (collisions.length > 0) {
    throw new Error(
      `These country names produce the same identifier and would overwrite each other: ${collisions
        .map((names) => names.join(' / '))
        .join(', ')}. Use more distinct spellings.`,
    )
  }

  const col = contestantsCol()
  const existing = await getDocs(col)
  const nextIds = new Set(countries.map((c) => slugify(c)))

  await Promise.all(
    existing.docs.filter((d) => !nextIds.has(d.id)).map((d) => deleteDoc(d.ref)),
  )

  await Promise.all(
    countries.map((country, index) =>
      setDoc(doc(col, slugify(country)), {
        country,
        appearanceOrder: index + 1,
      }),
    ),
  )
}

export function subscribePredictions(callback: (predictions: Prediction[]) => void) {
  return onSnapshot(
    predictionsCol(),
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Prediction)),
    logSnapshotError('predictions'),
  )
}

/**
 * Subscribes to just the signed-in user's own prediction doc, for use while
 * voting is still open: the security rules only allow reading everyone
 * else's picks once voting is no longer open, but you can always read your
 * own so the voting page can show what you already saved.
 */
export function subscribeOwnPrediction(uid: string, callback: (predictions: Prediction[]) => void) {
  return onSnapshot(
    doc(predictionsCol(), uid),
    (snapshot) => callback(snapshot.exists() ? [{ id: snapshot.id, ...snapshot.data() } as Prediction] : []),
    logSnapshotError('your prediction'),
  )
}

/**
 * Always readable to active participants (unlike /predictions, which stays
 * hidden until voting is no longer open) - just who has submitted and when,
 * with no `order` field, so admins can track submission progress during
 * voting without seeing anyone's actual pick.
 */
export function subscribeSubmissionStatuses(callback: (statuses: SubmissionStatus[]) => void) {
  return onSnapshot(
    submissionStatusCol(),
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SubmissionStatus)),
    logSnapshotError('submission status'),
  )
}

/**
 * The prediction's doc id is the signer's own Firebase uid (not a slug of
 * their name), both so two people can't collide on the same display name
 * and so Firestore rules can enforce "you may only write your own
 * prediction" with a simple `request.auth.uid == predictionId` check.
 *
 * Writes the actual pick and its thin, always-visible submissionStatus
 * companion (memberName + updatedAt only) together in one batch, so the two
 * can never drift out of sync with each other.
 */
export async function submitPrediction(uid: string, memberName: string, order: string[]) {
  const trimmedName = memberName.trim()
  const updatedAt = Date.now()
  const batch = writeBatch(requireDb())
  batch.set(doc(predictionsCol(), uid), { memberName: trimmedName, order, updatedAt } satisfies Omit<
    Prediction,
    'id'
  >)
  batch.set(doc(submissionStatusCol(), uid), { memberName: trimmedName, updatedAt } satisfies Omit<
    SubmissionStatus,
    'id'
  >)
  await batch.commit()
}

export function subscribeResult(callback: (result: FinalResult | null) => void) {
  return onSnapshot(
    resultsRef(),
    (snapshot) => callback(snapshot.exists() ? (snapshot.data() as FinalResult) : null),
    logSnapshotError('result'),
  )
}

export async function saveFinalResult(order: string[]) {
  const result: FinalResult = { order, finalizedAt: Date.now() }
  await setDoc(resultsRef(), result)
  await updateDoc(configRef(), { votingStatus: 'finalized' satisfies VotingStatus })
}

/**
 * Archives the current contestants/predictions/result as a season snapshot
 * before wiping them, so admins can still look back at everyone's past
 * submissions after the contest is reset for a new year. The live title is
 * cleared afterward so the admin picks a fresh one for the new season.
 */
export async function resetContest(options: { clearContestants: boolean; title: string }) {
  const [contestantDocs, predictionDocs, submissionStatusDocs, resultSnap] = await Promise.all([
    getDocs(contestantsCol()),
    getDocs(predictionsCol()),
    getDocs(submissionStatusCol()),
    getDoc(resultsRef()),
  ])

  const season: Omit<Season, 'id'> = {
    title: options.title || 'Untitled contest',
    archivedAt: Date.now(),
    contestants: contestantDocs.docs.map((d) => ({ id: d.id, ...d.data() }) as Contestant),
    predictions: predictionDocs.docs.map((d) => ({ id: d.id, ...d.data() }) as Prediction),
    result: resultSnap.exists() ? (resultSnap.data() as FinalResult) : null,
  }
  await setDoc(doc(seasonsCol(), String(season.archivedAt)), season)

  await Promise.all(predictionDocs.docs.map((d) => deleteDoc(d.ref)))
  await Promise.all(submissionStatusDocs.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(resultsRef())

  if (options.clearContestants) {
    await Promise.all(contestantDocs.docs.map((d) => deleteDoc(d.ref)))
  }

  await updateDoc(configRef(), { votingStatus: 'not_started' satisfies VotingStatus, title: '' })
}

export async function getSeasons(): Promise<Season[]> {
  const seasonsQuery = query(seasonsCol(), orderBy('archivedAt', 'desc'))
  const snapshot = await getDocs(seasonsQuery)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Season)
}

/**
 * Live version of getSeasons() - use this wherever archived seasons are
 * displayed on an already-mounted page, so a reset (which archives a new
 * season) or a history deletion shows up immediately instead of only after
 * the component remounts (e.g. a full page reload).
 */
export function subscribeSeasons(callback: (seasons: Season[]) => void) {
  const seasonsQuery = query(seasonsCol(), orderBy('archivedAt', 'desc'))
  return onSnapshot(
    seasonsQuery,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Season)),
    logSnapshotError('seasons'),
  )
}

/** Permanently deletes one archived season (e.g. a test run). Does not touch the live contest. */
export async function deleteSeason(seasonId: string) {
  await deleteDoc(doc(seasonsCol(), seasonId))
}

/** Permanently deletes every archived season. Does not touch the live contest. */
export async function deleteAllSeasons() {
  const snapshot = await getDocs(seasonsCol())
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)))
}

export function subscribeMembers(callback: (members: Member[]) => void) {
  return onSnapshot(
    membersCol(),
    (snapshot) => callback(snapshot.docs.map((d) => ({ email: d.id, ...d.data() }) as Member)),
    logSnapshotError('members'),
  )
}

export function subscribeMember(email: string, callback: (member: Member | null) => void) {
  return onSnapshot(
    doc(membersCol(), email),
    (snapshot) => callback(snapshot.exists() ? ({ email: snapshot.id, ...snapshot.data() } as Member) : null),
    logSnapshotError('member'),
  )
}

/** Invites a new player by email. No-ops if that email is already invited/active/blocked. */
export async function inviteMember(email: string, invitedBy: string, assignedName?: string): Promise<boolean> {
  const id = email.trim().toLowerCase()
  const ref = doc(membersCol(), id)
  const existing = await getDoc(ref)
  if (existing.exists()) return false
  const member: Omit<Member, 'email'> = {
    status: 'invited',
    invitedAt: Date.now(),
    invitedBy,
    ...(assignedName?.trim() ? { assignedName: assignedName.trim() } : {}),
  }
  await setDoc(ref, member)
  return true
}

export async function setMemberBlocked(email: string, blocked: boolean) {
  await updateDoc(doc(membersCol(), email), { status: blocked ? 'blocked' : 'active' })
}

/** Lets an admin set (or clear, with an empty string) the name shown for this player everywhere. */
export async function setMemberAssignedName(email: string, name: string) {
  const trimmed = name.trim()
  if (trimmed) {
    await updateDoc(doc(membersCol(), email), { assignedName: trimmed })
  } else {
    await updateDoc(doc(membersCol(), email), { assignedName: deleteField() })
  }
}

/** Called by the signed-in user themselves the first time they log in, flipping their own invite to active. */
export async function markMemberActive(email: string, uid: string, displayName: string) {
  await updateDoc(doc(membersCol(), email), {
    status: 'active' satisfies Member['status'],
    uid,
    displayName,
    firstSignInAt: Date.now(),
  })
}

/**
 * Predictions are only readable while voting isn't open (picks stay hidden
 * from everyone, admins included, until then - see firestore.rules), so a
 * backup taken mid-vote can't include them. Rather than fail the whole
 * export over that one collection, this omits predictions in that
 * specific case - export again once voting closes to capture them too.
 * Any other failure (a dropped connection, misconfigured rules, etc.) is
 * rethrown instead of also being swallowed, so a backup can't silently
 * come back with an empty predictions array and a false "success" toast.
 */
async function readPredictionsForBackup(): Promise<Prediction[]> {
  try {
    const snapshot = await getDocs(predictionsCol())
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Prediction)
  } catch (err) {
    if ((err as FirestoreError).code === 'permission-denied') return []
    throw err
  }
}

/** Reads every collection into one JSON-serializable snapshot, for a manual backup download. */
export async function exportBackup(): Promise<BackupData> {
  const [configSnap, contestantsSnap, predictions, resultSnap, membersSnap, seasonsSnap] = await Promise.all([
    getDoc(configRef()),
    getDocs(contestantsCol()),
    readPredictionsForBackup(),
    getDoc(resultsRef()),
    getDocs(membersCol()),
    getDocs(seasonsCol()),
  ])

  return {
    exportedAt: Date.now(),
    config: configSnap.exists() ? (configSnap.data() as ContestConfig) : null,
    contestants: contestantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Contestant),
    predictions,
    result: resultSnap.exists() ? (resultSnap.data() as FinalResult) : null,
    members: membersSnap.docs.map((d) => ({ email: d.id, ...d.data() }) as Member),
    seasons: seasonsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Season),
  }
}

/**
 * Applies a batch of set/delete operations in chunks (Firestore batched
 * writes cap out at 500 operations), each chunk atomic on its own, in the
 * order given - so callers should order every `set` before any `delete` that
 * depends on it having landed first.
 */
async function commitInChunks(ops: ((batch: WriteBatch) => void)[], chunkSize = 400) {
  const db = requireDb()
  for (let i = 0; i < ops.length; i += chunkSize) {
    const batch = writeBatch(db)
    ops.slice(i, i + chunkSize).forEach((op) => op(batch))
    await batch.commit()
  }
}

/**
 * Replaces every collection with the contents of a previously exported
 * backup. Every new/updated doc is written before anything stale is deleted,
 * so a dropped connection or closed tab partway through leaves extra
 * leftover docs at worst, never a wiped database with nothing restored yet.
 */
export async function importBackup(data: BackupData) {
  const [existingContestants, existingPredictions, existingSubmissionStatus, existingMembers, existingSeasons] =
    await Promise.all([
      getDocs(contestantsCol()),
      getDocs(predictionsCol()),
      getDocs(submissionStatusCol()),
      getDocs(membersCol()),
      getDocs(seasonsCol()),
    ])

  const setOps: ((batch: WriteBatch) => void)[] = []
  const deleteOps: ((batch: WriteBatch) => void)[] = []

  if (data.config) setOps.push((b) => b.set(configRef(), data.config as ContestConfig))

  const newContestantIds = new Set(data.contestants.map((c) => c.id))
  for (const c of data.contestants) {
    setOps.push((b) => b.set(doc(contestantsCol(), c.id), { country: c.country, appearanceOrder: c.appearanceOrder }))
  }
  for (const d of existingContestants.docs) {
    if (!newContestantIds.has(d.id)) deleteOps.push((b) => b.delete(d.ref))
  }

  const newPredictionIds = new Set(data.predictions.map((p) => p.id))
  for (const p of data.predictions) {
    setOps.push((b) =>
      b.set(doc(predictionsCol(), p.id), { memberName: p.memberName, order: p.order, updatedAt: p.updatedAt }),
    )
    // submissionStatus is a derived, always-visible companion to each
    // prediction (memberName + updatedAt, no order) - regenerated here from
    // the same backup data rather than stored separately in BackupData.
    setOps.push((b) =>
      b.set(doc(submissionStatusCol(), p.id), { memberName: p.memberName, updatedAt: p.updatedAt }),
    )
  }
  for (const d of existingPredictions.docs) {
    if (!newPredictionIds.has(d.id)) deleteOps.push((b) => b.delete(d.ref))
  }
  for (const d of existingSubmissionStatus.docs) {
    if (!newPredictionIds.has(d.id)) deleteOps.push((b) => b.delete(d.ref))
  }

  if (data.result) setOps.push((b) => b.set(resultsRef(), data.result as FinalResult))
  else deleteOps.push((b) => b.delete(resultsRef()))

  const newMemberIds = new Set(data.members.map((m) => m.email))
  for (const m of data.members) {
    const memberData: Omit<Member, 'email'> = {
      status: m.status,
      invitedAt: m.invitedAt,
      invitedBy: m.invitedBy,
      ...(m.uid ? { uid: m.uid } : {}),
      ...(m.displayName ? { displayName: m.displayName } : {}),
      ...(m.firstSignInAt ? { firstSignInAt: m.firstSignInAt } : {}),
      ...(m.assignedName ? { assignedName: m.assignedName } : {}),
    }
    setOps.push((b) => b.set(doc(membersCol(), m.email), memberData))
  }
  for (const d of existingMembers.docs) {
    if (!newMemberIds.has(d.id)) deleteOps.push((b) => b.delete(d.ref))
  }

  const newSeasonIds = new Set(data.seasons.map((s) => s.id))
  for (const s of data.seasons) {
    const { id, ...seasonData } = s
    setOps.push((b) => b.set(doc(seasonsCol(), id), seasonData))
  }
  for (const d of existingSeasons.docs) {
    if (!newSeasonIds.has(d.id)) deleteOps.push((b) => b.delete(d.ref))
  }

  await commitInChunks([...setOps, ...deleteOps])
}
