import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import type { AuthUser } from './types'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.length > 0,
)

// initializeApp/getAuth throw synchronously on malformed config (e.g. an
// empty apiKey), which would otherwise crash the whole app before React can
// render a friendly "not configured" message - so only touch the SDK at all
// once the env vars look present.
export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null
export const db = app ? getFirestore(app) : null
export const auth = app ? getAuth(app) : null

function toAuthUser(user: User): AuthUser | null {
  if (!user.email) return null // Google accounts always have one, but the type allows null
  return { uid: user.uid, email: user.email, displayName: user.displayName ?? user.email }
}

/**
 * Every participant (family members and the admin alike) signs in with
 * their own Google account. This both identifies them (no more shared PIN,
 * no risk of two people colliding on the same name) and satisfies Firestore
 * security rules, which check request.auth directly.
 */
export function subscribeAuthUser(callback: (user: AuthUser | null) => void) {
  if (!auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, (user) => callback(user ? toAuthUser(user) : null))
}

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error('Firebase is not configured.')
  await signInWithPopup(auth, new GoogleAuthProvider())
}

export async function signOutUser(): Promise<void> {
  if (!auth) return
  await signOut(auth)
}
