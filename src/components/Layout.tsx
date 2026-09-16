import { useState } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  async function handleLogout() {
    closeMenu()
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__bar">
          <Link to="/" className="app-title" onClick={closeMenu}>
            🇪🇺 Eurovision Family Contest
          </Link>
          <div className="app-header__bar-right">
            {config && <StatusBanner status={config.votingStatus} />}
            {user && (
              <button
                type="button"
                className="menu-toggle"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                {menuOpen ? '✕' : '☰'}
              </button>
            )}
          </div>
        </div>
        {user && (
          <div className={`app-header__nav${menuOpen ? ' app-header__nav--open' : ''}`}>
            <span className="app-header__user">
              {displayName}
              {isAdmin ? ' (admin)' : ''}
            </span>
            <Link to="/" className="nav-link" onClick={closeMenu}>
              My vote
            </Link>
            <Link to="/leaderboard" className="nav-link" onClick={closeMenu}>
              Leaderboard
            </Link>
            {isAdmin && (
              <Link to="/admin" className="nav-link" onClick={closeMenu}>
                Admin
              </Link>
            )}
            <button type="button" className="link-button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
