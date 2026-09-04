import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { searchPatients } from '../api/patients'
import { putSession } from '../api/session'
import type { PatientMatch } from '../api/types'
import { SearchResultsTable } from '../components/SearchResultsTable'
import { ChatPanel } from '../components/ChatPanel'
import { NoticeBoard } from '../components/NoticeBoard'
import { useAuth } from '../auth/useAuth'

export function HomePage() {
  const [q, setQ] = useState('')
  const [matches, setMatches] = useState<PatientMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()
  const { user } = useAuth()
  const firstName = user?.email?.split('@')[0] ?? 'team'

  const runSearch = async (query: string) => {
    setError(null)
    setQ(query)
    try {
      const res = await searchPatients(query)
      setMatches(res.matches)
    } catch {
      setError('Search failed')
    }
  }

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    await runSearch(q)
  }

  const onSelect = async (p: PatientMatch) => {
    await putSession({ active_patient_id: p.patient_id })
    nav(`/patient/${p.patient_id}`)
  }

  return (
    <div className="home-layout">
      <div className="stack home-layout__main">
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--sc-font-display)' }}>Find a patient</h1>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Welcome back, {firstName}. Search the chart roster or jump to a workspace tool.
          </p>
        </div>

        <div className="row home-quickstart" style={{ gap: '0.5rem' }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Quick start
          </span>
          <Link to="/insights" className="chip info" style={{ textDecoration: 'none' }}>
            Insights
          </Link>
          <Link to="/doctors" className="chip info" style={{ textDecoration: 'none' }}>
            Doctors
          </Link>
          <button
            type="button"
            className="chip LOW"
            style={{ border: 'none', cursor: 'pointer' }}
            onClick={() => void runSearch('Kuhn')}
          >
            Sample: Kuhn
          </button>
        </div>

        <form className="row" onSubmit={(e) => void onSearch(e)}>
          <label style={{ flex: 1 }}>
            <span className="muted">Name</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. Kuhn"
              aria-label="Patient name search"
            />
          </label>
          <button type="submit" className="primary" style={{ alignSelf: 'end' }}>
            Search
          </button>
        </form>
        {error ? <p style={{ color: 'var(--sc-high)' }}>{error}</p> : null}
        <div className="panel">
          {matches ? (
            <SearchResultsTable matches={matches} onSelect={(p) => void onSelect(p)} />
          ) : (
            <p className="empty">Search by name to get started. Try “Kuhn”.</p>
          )}
        </div>
        <ChatPanel />
      </div>
      <NoticeBoard />
    </div>
  )
}
