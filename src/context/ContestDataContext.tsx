import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ensureAnonymousAuth } from '../firebase'
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
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<ContestConfig | null>(null)
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [result, setResult] = useState<FinalResult | null>(null)

  useEffect(() => {
    let unsubscribers: Array<() => void> = []

    ensureAnonymousAuth()
      .then(() => {
        unsubscribers = [
          subscribeConfig(setConfig),
          subscribeContestants(setContestants),
          subscribePredictions(setPredictions),
          subscribeResult(setResult),
        ]
        setReady(true)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to connect to Firebase.')
      })

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [])

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
