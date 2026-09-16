import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useContestData } from '../context/ContestDataContext'
import { useMembership } from '../context/MembershipContext'
import { createConfig } from '../services/firestoreService'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"
      />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  )
}

export function LoginPage() {
  const { user, authReady, signIn, signOut } = useAuth()
  const { ready, error, config } = useContestData()
  const { status } = useMembership()
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)

  async function handleSignIn() {
    setSignInError(null)
    setSigningIn(true)
    try {
      await signIn()
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setSigningIn(false)
    }
  }

  if (error) {
    return (
      <div className="auth-card">
        <h1>Connection problem</h1>
        <p className="error-text">{error}</p>
        <p>Check the Firebase configuration in your .env file (see README.md).</p>
      </div>
    )
  }

  if (!authReady || (user && !ready)) {
    return (
      <div className="auth-card">
        <p>Connecting…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-card">
        <h1>Welcome</h1>
        <p>Sign in with your Google account to pick your Eurovision order.</p>
        <button type="button" className="google-button" onClick={handleSignIn} disabled={signingIn}>
          <GoogleIcon />
          {signingIn ? 'Signing in…' : 'Sign in with Google'}
        </button>
        {signInError && <p className="error-text">{signInError}</p>}
      </div>
    )
  }

  if (!config) {
    return <BootstrapAdmin email={user.email} />
  }

  if (status === 'checking') {
    return (
      <div className="auth-card">
        <p>Checking your invite…</p>
      </div>
    )
  }

  if (status === 'not_invited') {
    return (
      <div className="auth-card">
        <h1>Not invited yet</h1>
        <p>
          <strong>{user.email}</strong> hasn't been invited to this contest. Ask the admin to invite this Google
          account, or sign out and try a different one.
        </p>
        <button type="button" className="secondary-button" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    )
  }

  if (status === 'blocked') {
    return (
      <div className="auth-card">
        <h1>Access revoked</h1>
        <p>
          An admin has blocked <strong>{user.email}</strong> from participating in this contest.
        </p>
        <button type="button" className="secondary-button" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    )
  }

  return <Navigate to="/" replace />
}

function BootstrapAdmin({ email }: { email: string }) {
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleClaim() {
    setSubmitting(true)
    setFormError(null)
    try {
      await createConfig(email)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>First-time setup</h1>
      <p>
        Nobody has set up this contest yet. Continue as <strong>{email}</strong> to become the admin - you'll
        be able to add contestants and open voting next.
      </p>
      {formError && <p className="error-text">{formError}</p>}
      <button type="button" className="primary-button" onClick={handleClaim} disabled={submitting}>
        {submitting ? 'Setting up…' : "I'll be the admin"}
      </button>
    </div>
  )
}
