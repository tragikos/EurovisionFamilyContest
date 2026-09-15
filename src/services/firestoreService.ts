import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Contestant, ContestConfig, FinalResult, Prediction, VotingStatus } from '../types'

// Refs are resolved lazily (not at module load) because `db` is null until
// Firebase env vars are configured - these functions are only ever called
// after ensureAnonymousAuth() has resolved, by which point db is guaranteed
// to exist, so the non-null assertion here is safe.
function requireDb() {
  if (!db) throw new Error('Firebase is not configured.')
  return db
}

const configRef = () => doc(requireDb(), 'meta', 'config')
const resultsRef = () => doc(requireDb(), 'results', 'final')
const contestantsCol = () => collection(requireDb(), 'contestants')
const predictionsCol = () => collection(requireDb(), 'predictions')

export function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '') || 'unnamed'
  )
}

export function subscribeConfig(callback: (config: ContestConfig | null) => void) {
  return onSnapshot(configRef(), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as ContestConfig) : null)
  })
}

export async function initializeConfig(familyPinHash: string, adminPasswordHash: string) {
  const config: ContestConfig = {
    familyPinHash,
    adminPasswordHash,
    votingStatus: 'not_started',
  }
  await setDoc(configRef(), config)
}

export async function setVotingStatus(status: VotingStatus) {
  await updateDoc(configRef(), { votingStatus: status })
}

export function subscribeContestants(callback: (contestants: Contestant[]) => void) {
  const contestantsQuery = query(contestantsCol(), orderBy('appearanceOrder'))
  return onSnapshot(contestantsQuery, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Contestant))
  })
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
  return onSnapshot(predictionsCol(), (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Prediction))
  })
}

export async function submitPrediction(memberName: string, order: string[]) {
  const id = slugify(memberName)
  const prediction: Omit<Prediction, 'id'> = {
    memberName: memberName.trim(),
    order,
    updatedAt: Date.now(),
  }
  await setDoc(doc(predictionsCol(), id), prediction)
}

export function subscribeResult(callback: (result: FinalResult | null) => void) {
  return onSnapshot(resultsRef(), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as FinalResult) : null)
  })
}

export async function saveFinalResult(order: string[]) {
  const result: FinalResult = { order, finalizedAt: Date.now() }
  await setDoc(resultsRef(), result)
  await updateDoc(configRef(), { votingStatus: 'finalized' satisfies VotingStatus })
}

export async function resetContest(options: { clearContestants: boolean }) {
  const predictionDocs = await getDocs(predictionsCol())
  await Promise.all(predictionDocs.docs.map((d) => deleteDoc(d.ref)))
  await deleteDoc(resultsRef())

  if (options.clearContestants) {
    const contestantDocs = await getDocs(contestantsCol())
    await Promise.all(contestantDocs.docs.map((d) => deleteDoc(d.ref)))
  }

  await updateDoc(configRef(), { votingStatus: 'not_started' satisfies VotingStatus })
}
