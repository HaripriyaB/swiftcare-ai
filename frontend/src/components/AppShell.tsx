import { Link, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { DemoBanner } from './DemoBanner'
import { BackButton } from './BackButton'
import { BrandLockup } from './BrandLockup'

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const looker = import.meta.env.VITE_LOOKER_STUDIO_URL

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <DemoBanner />
      <header className="app-header">
        <div className="app-header__brand">
          <BrandLockup to="/" size="sm" />
          <span className="muted app-header__context">Front desk · SwiftCare Clinic</span>
        </div>
        <nav className="row app-header__nav" style={{ gap: '1rem' }}>
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/doctors">Doctors</NavLink>
          <NavLink to="/insights">Insights</NavLink>
          {looker ? (
            <a href={looker} target="_blank" rel="noreferrer">
              Looker
            </a>
          ) : null}
        </nav>
        <div className="row app-header__user">
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {user?.email}
          </span>
          <button type="button" className="ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="app-main">
        <BackButton fallback="/" />
        {children}
      </main>
      <footer className="app-footer">
        <div className="app-footer__inner">
          <div>
            <strong style={{ fontFamily: 'var(--sc-font-display)' }}>SwiftCare Clinic</strong>
            <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
              Campus hours Mon–Fri 07:00–20:00 · Sat 08:00–14:00
            </p>
          </div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            <div>Main desk · (617) 555-0140</div>
            <div>Emergency · (617) 555-0911</div>
          </div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            Notices from the{' '}
            <Link to="/" style={{ color: 'var(--sc-accent)' }}>
              Dean’s Office
            </Link>{' '}
            appear on Home.
          </div>
        </div>
      </footer>
    </div>
  )
}
