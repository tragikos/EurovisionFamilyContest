import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth'

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

let anonymousAuthPromise: Promise<void> | null = null

/**
 * Firestore security rules require request.auth != null. We use silent
 * anonymous auth (no UI, no password) purely to satisfy that check - the
 * real "who are you" gate is the family PIN / admin password flow.
 */
export function ensureAnonymousAuth(): Promise<void> {
  if (!isFirebaseConfigured || !auth) {
    return Promise.reject(
      new Error('Firebase is not configured. Copy .env.example to .env and fill in your Firebase project values.'),
    )
  }
  const authInstance = auth
  if (!anonymousAuthPromise) {
    anonymousAuthPromise = new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        authInstance,
        (user) => {
          if (user) {
            unsubscribe()
            resolve()
          }
        },
        (error) => {
          unsubscribe()
          reject(error)
        },
      )
      signInAnonymously(authInstance).catch((error) => {
        unsubscribe()
        reject(error)
      })
    })
  }
  return anonymousAuthPromise
}
