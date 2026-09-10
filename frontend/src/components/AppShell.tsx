import { NavLink, useLocation } from 'react-router-dom'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { BrandLockup } from './BrandLockup'
import { ChatPanel } from './ChatPanel'

const navigationItems = [
  { to: '/', label: 'Attention queue', icon: 'announcement', end: true },
  { to: '/patients', label: 'Patients', icon: 'add-patient' },
  { to: '/insights', label: 'Care dashboard', icon: 'analytics' },
  { to: '/history', label: 'Work history', icon: 'history' },
  { to: '/account', label: 'Account settings', icon: 'settings' },
]

const PageHeaderMetaContext = createContext<((content: ReactNode | null) => void) | null>(null)
const SwifyPatientContext = createContext<((patientId: string | null) => void) | null>(null)

export function usePageHeaderMeta() {
  const setHeaderMeta = useContext(PageHeaderMetaContext)
  if (!setHeaderMeta) throw new Error('usePageHeaderMeta must be used inside AppShell')
  return setHeaderMeta
}

/** Sets the patient Swify should use as context outside the patient-record route. */
export function useSwifyPatientContext() {
  const setPatientId = useContext(SwifyPatientContext)
  if (!setPatientId) throw new Error('useSwifyPatientContext must be used inside AppShell')
  return setPatientId
}

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
  const location = useLocation()
  const looker = import.meta.env.VITE_LOOKER_STUDIO_URL
  const [navigationExpanded, setNavigationExpanded] = useState(true)
  const [swifyExpanded, setSwifyExpanded] = useState(true)
  const [headerMeta, setHeaderMeta] = useState<ReactNode | null>(null)
  const [swifyPatientId, setSwifyPatientId] = useState<string | null>(null)
  const pageTitle = location.pathname === '/' ? 'Attention queue'
    : location.pathname === '/patients' ? 'Patients'
      : location.pathname === '/insights' ? 'Care dashboard'
        : location.pathname === '/history' ? 'Work history'
          : location.pathname === '/account' ? 'Account settings'
            : location.pathname.startsWith('/patient/') ? 'Patient record'
              : location.pathname.startsWith('/continuity/') ? 'Review action'
                : location.pathname.startsWith('/history/') ? 'Work history'
                  : 'SwiftCare AI'

  return (
    <PageHeaderMetaContext.Provider value={setHeaderMeta}>
    <SwifyPatientContext.Provider value={setSwifyPatientId}>
    <div className="app-shell">
      <aside className={`app-sidebar ${navigationExpanded ? '' : 'is-collapsed'}`}>
        <div className="app-sidebar__brand">
          <div className="app-sidebar__brand-row">
            <BrandLockup to="/" size="sm" />
          </div>
          <p>Patient continuity intelligence</p>
        </div>
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
        <div className="app-sidebar__clinic" aria-label="Clinic information">
          <strong>SwiftCare Clinic</strong>
          <span>Campus hours</span>
          <small>Mon–Fri 07:00–20:00<br />Sat 08:00–14:00</small>
        </div>
        <button
          type="button"
          className="app-sidebar__edge-toggle"
          aria-expanded={navigationExpanded}
          aria-controls="primary-navigation"
          aria-label={navigationExpanded ? 'Collapse side navigation' : 'Expand side navigation'}
          title={navigationExpanded ? 'Collapse side navigation' : 'Expand side navigation'}
          onClick={() => setNavigationExpanded((expanded) => !expanded)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {navigationExpanded ? <path d="m14 7-5 5 5 5" /> : <path d="m10 7 5 5-5 5" />}
          </svg>
        </button>
      </aside>
      <div className="app-shell__workspace">
        <header className="app-topbar">
          <div className="app-topbar__brand">
            <div className="app-topbar__page-heading">
              <strong>{pageTitle}</strong>
              {headerMeta}
            </div>
          </div>
          <div className="app-topbar__user">
            <span className="app-topbar__contact">Main desk · (617) 555-0140<br />Emergency · (617) 555-0911</span>
            <span className="muted">{user?.email}</span>
            <button type="button" className="app-topbar__logout" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5M15 12H4" /></svg>
            </button>
          </div>
        </header>
        <div className={`app-shell__content ${swifyExpanded ? '' : 'is-swify-collapsed'}`}>
          <div className="app-shell__body">
            <main className="app-main">
              {children}
            </main>
          </div>
          <ChatPanel patientId={swifyPatientId} expanded={swifyExpanded} onExpandedChange={setSwifyExpanded} />
        </div>
      </div>
    </div>
    </SwifyPatientContext.Provider>
    </PageHeaderMetaContext.Provider>
  )
}
