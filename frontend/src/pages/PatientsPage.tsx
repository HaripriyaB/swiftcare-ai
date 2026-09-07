import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchPatients } from '../api/patients'
import { putSession } from '../api/session'
import type { PatientMatch } from '../api/types'
import { SearchResultsTable } from '../components/SearchResultsTable'

export function PatientsPage() {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<PatientMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const search = async (event: React.FormEvent) => {
    event.preventDefault()
    const term = query.trim()
    if (!term) return
    setLoading(true); setError(null)
    try {
      const result = await searchPatients(term)
      setMatches(result.matches)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Patient search is unavailable.')
      setMatches(null)
    } finally {
      setLoading(false)
    }
  }

  const select = async (patient: PatientMatch) => {
    try { await putSession({ active_patient_id: patient.patient_id }) } catch { /* patient detail can still open */ }
    nav(`/patient/${patient.patient_id}`)
  }

  return (
    <section className="patient-search stack">
      <div><p className="eyebrow">Patient lookup</p><h1>Find a patient</h1><p className="muted">Search by name to open a factual patient workspace.</p></div>
      <form className="patient-search__form" onSubmit={(event) => void search(event)}>
        <label>Name<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Kuhn" aria-label="Patient name" /></label>
        <button className="primary" type="submit" disabled={loading || !query.trim()}>{loading ? 'Searching…' : 'Search'}</button>
      </form>
      {error ? <div className="panel continuity-page__error"><strong>Search unavailable</strong><p>{error}</p></div> : null}
      {matches ? <div className="panel"><SearchResultsTable matches={matches} onSelect={(patient) => void select(patient)} /></div> : <div className="panel"><p className="empty">Search by patient name to get started.</p></div>}
    </section>
  )
}
