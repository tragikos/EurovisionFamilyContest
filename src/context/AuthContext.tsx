import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { signInWithGoogle, signOutUser, subscribeAuthUser } from '../firebase'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  authReady: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    return subscribeAuthUser((next) => {
      setUser(next)
      setAuthReady(true)
    })
  }, [])

  const value: AuthContextValue = {
    user,
    authReady,
    signIn: signInWithGoogle,
    signOut: signOutUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
