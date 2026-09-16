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
} from 'firebase/firestore'
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
 * The prediction's doc id is the signer's own Firebase uid (not a slug of
 * their name), both so two people can't collide on the same display name
 * and so Firestore rules can enforce "you may only write your own
 * prediction" with a simple `request.auth.uid == predictionId` check.
 */
export async function submitPrediction(uid: string, memberName: string, order: string[]) {
  const prediction: Omit<Prediction, 'id'> = {
    memberName: memberName.trim(),
    order,
    updatedAt: Date.now(),
  }
  await setDoc(doc(predictionsCol(), uid), prediction)
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
  const [contestantDocs, predictionDocs, resultSnap] = await Promise.all([
    getDocs(contestantsCol()),
    getDocs(predictionsCol()),
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

/** Reads every collection into one JSON-serializable snapshot, for a manual backup download. */
export async function exportBackup(): Promise<BackupData> {
  const [configSnap, contestantsSnap, predictionsSnap, resultSnap, membersSnap, seasonsSnap] = await Promise.all([
    getDoc(configRef()),
    getDocs(contestantsCol()),
    getDocs(predictionsCol()),
    getDoc(resultsRef()),
    getDocs(membersCol()),
    getDocs(seasonsCol()),
  ])

  return {
    exportedAt: Date.now(),
    config: configSnap.exists() ? (configSnap.data() as ContestConfig) : null,
    contestants: contestantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Contestant),
    predictions: predictionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Prediction),
    result: resultSnap.exists() ? (resultSnap.data() as FinalResult) : null,
    members: membersSnap.docs.map((d) => ({ email: d.id, ...d.data() }) as Member),
    seasons: seasonsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Season),
  }
}

/**
 * Replaces every collection with the contents of a previously exported
 * backup. Destructive - wipes whatever is currently there first.
 */
export async function importBackup(data: BackupData) {
  const [existingContestants, existingPredictions, existingMembers, existingSeasons] = await Promise.all([
    getDocs(contestantsCol()),
    getDocs(predictionsCol()),
    getDocs(membersCol()),
    getDocs(seasonsCol()),
  ])
  await Promise.all([
    ...existingContestants.docs.map((d) => deleteDoc(d.ref)),
    ...existingPredictions.docs.map((d) => deleteDoc(d.ref)),
    ...existingMembers.docs.map((d) => deleteDoc(d.ref)),
    ...existingSeasons.docs.map((d) => deleteDoc(d.ref)),
  ])

  const writes: Promise<void>[] = []

  if (data.config) writes.push(setDoc(configRef(), data.config))

  for (const c of data.contestants) {
    writes.push(setDoc(doc(contestantsCol(), c.id), { country: c.country, appearanceOrder: c.appearanceOrder }))
  }

  for (const p of data.predictions) {
    writes.push(setDoc(doc(predictionsCol(), p.id), { memberName: p.memberName, order: p.order, updatedAt: p.updatedAt }))
  }

  writes.push(data.result ? setDoc(resultsRef(), data.result) : deleteDoc(resultsRef()))

  for (const m of data.members) {
    const memberData: Omit<Member, 'email'> = {
      status: m.status,
      invitedAt: m.invitedAt,
      invitedBy: m.invitedBy,
      ...(m.uid ? { uid: m.uid } : {}),
      ...(m.displayName ? { displayName: m.displayName } : {}),
      ...(m.firstSignInAt ? { firstSignInAt: m.firstSignInAt } : {}),
    }
    writes.push(setDoc(doc(membersCol(), m.email), memberData))
  }

  for (const s of data.seasons) {
    const { id, ...seasonData } = s
    writes.push(setDoc(doc(seasonsCol(), id), seasonData))
  }

  await Promise.all(writes)
}
