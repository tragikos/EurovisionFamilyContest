import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useContestData } from '../context/ContestDataContext'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { useDisplayName } from '../hooks/useDisplayName'
import { StatusBanner } from './StatusBanner'

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { config } = useContestData()
  const isAdmin = useIsAdmin()
  const displayName = useDisplayName()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-title">
          🇪🇺 Eurovision Family Contest
        </Link>
        <div className="app-header__right">
          {config && <StatusBanner status={config.votingStatus} />}
          {user && (
            <>
              <span className="app-header__user">
                {displayName}
                {isAdmin ? ' (admin)' : ''}
              </span>
              <Link to="/" className="nav-link">
                My vote
              </Link>
              <Link to="/leaderboard" className="nav-link">
                Leaderboard
              </Link>
              {isAdmin && (
                <Link to="/admin" className="nav-link">
                  Admin
                </Link>
              )}
              <button type="button" className="link-button" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
