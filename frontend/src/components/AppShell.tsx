import { NavLink } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { subscribeToApiActivity } from '../api/client'
import { DemoBanner } from './DemoBanner'
import { BrandLockup } from './BrandLockup'

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const looker = import.meta.env.VITE_LOOKER_STUDIO_URL
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let timer: number | undefined
    const unsubscribe = subscribeToApiActivity((count) => {
      window.clearTimeout(timer)
      if (count) timer = window.setTimeout(() => setLoading(true), 160)
      else setLoading(false)
    })
    return () => { window.clearTimeout(timer); unsubscribe() }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('is-requesting', loading)
    return () => document.body.classList.remove('is-requesting')
  }, [loading])

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
            Today
          </NavLink>
          <NavLink to="/patients">Patients</NavLink>
          <NavLink to="/insights">Insights</NavLink>
          <NavLink to="/history">Work history</NavLink>
          {looker ? (
            <a href={looker} target="_blank" rel="noreferrer">
              Looker
            </a>
          ) : null}
        </nav>
        <div className="row app-header__user">
          <NavLink className="app-header__account" to="/account" aria-label="Open account settings">
            {user?.email}
          </NavLink>
          <button type="button" className="ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      {loading ? <span className="request-buffer" role="status" aria-label="Loading"><span className="inline-loader__spinner" aria-hidden="true" /></span> : null}
      <main className="app-main">
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
          <div className="muted" style={{ fontSize: '0.85rem' }}>Synthetic demo data · Operational support only.</div>
        </div>
      </footer>
    </div>
  )
}
