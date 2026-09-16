import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  subscribeConfig,
  subscribeContestants,
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
      subscribePredictions(setPredictions),
      subscribeResult(setResult),
    ]
    setReady(true)

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [authReady, user])

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
