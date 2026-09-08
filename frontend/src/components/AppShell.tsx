import { NavLink } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { subscribeToApiActivity } from '../api/client'
import { DemoBanner } from './DemoBanner'
import { BrandLockup } from './BrandLockup'
import { ChatPanel } from './ChatPanel'

const navigationItems = [
  { to: '/', label: 'Attention queue', icon: 'announcement', end: true },
  { to: '/patients', label: 'Patients', icon: 'add-patient' },
  { to: '/insights', label: 'Care dashboard', icon: 'analytics' },
  { to: '/history', label: 'Work history', icon: 'history' },
  { to: '/account', label: 'Account settings', icon: 'settings' },
]

function NavigationIcon({ name }: { name: string }) {
  const common = { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false }

  if (name === 'announcement') return <svg {...common}><path d="M4 10v4h3l4 3V7l-4 3H4Z" /><path d="M15 9.5a3.6 3.6 0 0 1 0 5" /><path d="M17.5 7a7 7 0 0 1 0 10" /></svg>
  if (name === 'add-patient') return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.7-3.1 2.7-4.7 5.5-4.7s4.8 1.6 5.5 4.7" /><path d="M18 5v6M15 8h6" /></svg>
  if (name === 'analytics') return <svg {...common}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-4M12 16V8M16 16v-7" /></svg>
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.9-1.1L14.4 3h-4.8l-.3 2.9A7 7 0 0 0 7.4 7l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .7.1 1.1l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.9 1.1l.3 2.9h4.8l.3-2.9a7 7 0 0 0 1.9-1.1l2.3 1 2-3.4-2-1.5c.1-.4.1-.7.1-1.1Z" /></svg>
  return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg>
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const looker = import.meta.env.VITE_LOOKER_STUDIO_URL
  const [loading, setLoading] = useState(false)
  const [navigationExpanded, setNavigationExpanded] = useState(true)

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
    <div className="app-shell">
      <aside className={`app-sidebar ${navigationExpanded ? '' : 'is-collapsed'}`}>
        <button
          type="button"
          className="app-sidebar__toggle"
          aria-expanded={navigationExpanded}
          aria-controls="primary-navigation"
          aria-label={navigationExpanded ? 'Collapse side navigation' : 'Expand side navigation'}
          title={navigationExpanded ? 'Collapse side navigation' : 'Expand side navigation'}
          onClick={() => setNavigationExpanded((expanded) => !expanded)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 4v16" />
            {navigationExpanded ? (
              <path d="m14.5 9-3 3 3 3" />
            ) : (
              <path d="m10.5 9 3 3-3 3" />
            )}
          </svg>
        </button>
        <nav id="primary-navigation" className="app-sidebar__nav" aria-label="Primary navigation">
            {navigationItems.map((item) => <NavLink key={item.to} to={item.to} end={item.end} title={item.label}>
              <span className="app-sidebar__icon"><NavigationIcon name={item.icon} /></span>
              <span className="app-sidebar__label">{item.label}</span>
            </NavLink>)}
            {looker ? (
              <a href={looker} target="_blank" rel="noreferrer" title="Looker">
                <span className="app-sidebar__icon" aria-hidden="true">↗</span>
                <span className="app-sidebar__label">Looker</span>
              </a>
            ) : null}
          </nav>
      </aside>
      <div className="app-shell__workspace">
        <DemoBanner />
        <header className="app-topbar">
          <div className="app-topbar__brand">
            <div className="app-topbar__identity">
              <BrandLockup to="/" size="md" />
              <span>Front desk · SwiftCare Clinic</span>
            </div>
          </div>
          <div className="app-topbar__user">
            <span className="muted">{user?.email}</span>
            <button type="button" className="app-topbar__logout" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5M15 12H4" /></svg>
            </button>
          </div>
        </header>
        <div className="app-shell__content">
          <div className="app-shell__body">
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
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}
