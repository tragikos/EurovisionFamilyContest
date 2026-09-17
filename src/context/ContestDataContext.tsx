import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  subscribeConfig,
  subscribeContestants,
  subscribeOwnPrediction,
  subscribePredictions,
  subscribeResult,
} from '../services/firestoreService'
import type { Contestant, ContestConfig, FinalResult, Prediction } from '../types'

interface ContestDataValue {
  ready: boolean
  error: string | null
  config: ContestConfig | null
  contestants: Contestant[]
  predictions: Prediction[]
  result: FinalResult | null
}

const ContestDataContext = createContext<ContestDataValue | null>(null)

export function ContestDataProvider({ children }: { children: ReactNode }) {
  const { user, authReady } = useAuth()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<ContestConfig | null>(null)
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [result, setResult] = useState<FinalResult | null>(null)

  useEffect(() => {
    if (!authReady) return

    // Firestore rules require request.auth != null, so there's nothing to
    // read until a participant has signed in with Google.
    if (!user) {
      setConfig(null)
      setContestants([])
      setPredictions([])
      setResult(null)
      setReady(true)
      return
    }

    setError(null)
    const unsubscribers = [
      subscribeConfig(setConfig),
      subscribeContestants(setContestants),
      subscribeResult(setResult),
    ]
    setReady(true)

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [authReady, user])

  // Predictions are subscribed separately from the rest: the security rules
  // only let you list everyone's picks once voting is no longer open - not
  // even admins are exempt, so an admin who's also playing can't see anyone
  // else's pick before finalizing their own. Before that, all you (admin or
  // not) can read is your own, via a single-doc subscription instead of a
  // collection listener.
  useEffect(() => {
    if (!user || !config) {
      setPredictions([])
      return
    }
    const revealed = config.votingStatus !== 'open'
    return revealed ? subscribePredictions(setPredictions) : subscribeOwnPrediction(user.uid, setPredictions)
  }, [user, config])

  const value: ContestDataValue = { ready, error, config, contestants, predictions, result }

  return <ContestDataContext.Provider value={value}>{children}</ContestDataContext.Provider>
}

export function useContestData() {
  const context = useContext(ContestDataContext)
  if (!context) {
    throw new Error('useContestData must be used within a ContestDataProvider')
  }
  return context
}
