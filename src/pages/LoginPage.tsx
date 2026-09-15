import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useContestData } from '../context/ContestDataContext'
import { useSession } from '../context/SessionContext'
import { initializeConfig } from '../services/firestoreService'
import { sha256Hex } from '../services/crypto'

export function LoginPage() {
  const { ready, error, config } = useContestData()
  const { session, login } = useSession()
  const navigate = useNavigate()

  if (session) {
    return <Navigate to={session.isAdmin ? '/admin' : '/'} replace />
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

  if (!ready) {
    return (
      <div className="auth-card">
        <p>Connecting…</p>
      </div>
    )
  }

  const needsSetup = !config || !config.familyPinHash || !config.adminPasswordHash

  if (needsSetup) {
    return <SetupForm onDone={() => window.location.reload()} />
  }

  return (
    <LoginForm
      familyPinHash={config.familyPinHash as string}
      adminPasswordHash={config.adminPasswordHash as string}
      onLogin={(next) => {
        login(next)
        navigate(next.isAdmin ? '/admin' : '/', { replace: true })
      }}
    />
  )
}

function SetupForm({ onDone }: { onDone: () => void }) {
  const [familyPin, setFamilyPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    if (familyPin.trim().length < 4) {
      setFormError('Family PIN should be at least 4 characters.')
      return
    }
    if (familyPin !== confirmPin) {
      setFormError('Family PIN confirmation does not match.')
      return
    }
    if (adminPassword.trim().length < 4) {
      setFormError('Admin password should be at least 4 characters.')
      return
    }
    if (adminPassword !== confirmAdminPassword) {
      setFormError('Admin password confirmation does not match.')
      return
    }

    setSubmitting(true)
    try {
      const [pinHash, adminHash] = await Promise.all([
        sha256Hex(familyPin.trim()),
        sha256Hex(adminPassword.trim()),
      ])
      await initializeConfig(pinHash, adminHash)
      onDone()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>First-time setup</h1>
      <p>
        Nobody has configured this contest yet. Choose a shared <strong>family PIN</strong> (for everyone
        picking their order) and a separate <strong>admin password</strong> (for whoever runs the contest).
      </p>
      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          Family PIN
          <input
            type="password"
            value={familyPin}
            onChange={(e) => setFamilyPin(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label>
          Confirm family PIN
          <input
            type="password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label>
          Admin password
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label>
          Confirm admin password
          <input
            type="password"
            value={confirmAdminPassword}
            onChange={(e) => setConfirmAdminPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {formError && <p className="error-text">{formError}</p>}
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </div>
  )
}

function LoginForm({
  familyPinHash,
  adminPasswordHash,
  onLogin,
}: {
  familyPinHash: string
  adminPasswordHash: string
  onLogin: (session: { memberName: string; isAdmin: boolean }) => void
}) {
  const [mode, setMode] = useState<'member' | 'admin'>('member')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      if (mode === 'member') {
        if (!name.trim()) {
          setFormError('Enter your name.')
          return
        }
        const hash = await sha256Hex(pin.trim())
        if (hash !== familyPinHash) {
          setFormError('Incorrect family PIN.')
          return
        }
        onLogin({ memberName: name.trim(), isAdmin: false })
      } else {
        const hash = await sha256Hex(adminPassword.trim())
        if (hash !== adminPasswordHash) {
          setFormError('Incorrect admin password.')
          return
        }
        onLogin({ memberName: 'Admin', isAdmin: true })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>Welcome back</h1>
      <div className="tab-switch">
        <button
          type="button"
          className={mode === 'member' ? 'tab-switch__button tab-switch__button--active' : 'tab-switch__button'}
          onClick={() => setMode('member')}
        >
          Family member
        </button>
        <button
          type="button"
          className={mode === 'admin' ? 'tab-switch__button tab-switch__button--active' : 'tab-switch__button'}
          onClick={() => setMode('admin')}
        >
          Admin
        </button>
      </div>
      <form onSubmit={handleSubmit} className="auth-form">
        {mode === 'member' ? (
          <>
            <label>
              Your name
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label>
              Family PIN
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="current-password"
              />
            </label>
          </>
        ) : (
          <label>
            Admin password
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        )}
        {formError && <p className="error-text">{formError}</p>}
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  )
}
