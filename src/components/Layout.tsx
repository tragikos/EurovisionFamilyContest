import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { useContestData } from '../context/ContestDataContext'
import { StatusBanner } from './StatusBanner'

export function Layout({ children }: { children: ReactNode }) {
  const { session, logout } = useSession()
  const { config } = useContestData()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
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
          {session && (
            <>
              <span className="app-header__user">
                {session.memberName}
                {session.isAdmin ? ' (admin)' : ''}
              </span>
              {session.isAdmin && (
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
