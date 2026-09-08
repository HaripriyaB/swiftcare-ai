import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchPatients } from '../api/patients'
import { putSession } from '../api/session'
import type { PatientMatch } from '../api/types'
import { SearchResultsTable } from '../components/SearchResultsTable'
import { LoadingPanel } from '../components/LoadingPanel'
import { readPageMemory, writePageMemory } from '../utils/pageMemory'
import { downloadBlob, stamp } from '../utils/download'
import { toCsv } from '../utils/toCsv'
import { displayPatientName } from '../utils/displayPatientName'

type PatientSearchSnapshot = { query: string; matches: PatientMatch[] | null; recentSearches: string[] }
const SEARCH_MEMORY_KEY = 'patient-search'

export function PatientsPage() {
  const restored = readPageMemory<PatientSearchSnapshot>(SEARCH_MEMORY_KEY)
  const [query, setQuery] = useState(() => restored?.query ?? '')
  const [matches, setMatches] = useState<PatientMatch[] | null>(() => restored?.matches ?? null)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => restored?.recentSearches ?? [])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const remember = (nextQuery: string, nextMatches: PatientMatch[] | null, nextRecent = recentSearches) => {
    writePageMemory(SEARCH_MEMORY_KEY, { query: nextQuery, matches: nextMatches, recentSearches: nextRecent })
  }

  const runSearch = async (rawTerm: string) => {
    const term = rawTerm.trim()
    if (!term) return
    setQuery(term)
    setLoading(true); setError(null)
    try {
      const result = await searchPatients(term)
      setMatches(result.matches)
      const nextRecent = [term, ...recentSearches.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 6)
      setRecentSearches(nextRecent)
      remember(term, result.matches, nextRecent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Patient search is unavailable.')
      setMatches(null)
    } finally {
      setLoading(false)
    }
  }

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    void runSearch(query)
  }

  const select = async (patient: PatientMatch) => {
    try { await putSession({ active_patient_id: patient.patient_id }) } catch { /* patient detail can still open */ }
    nav(`/patient/${patient.patient_id}`)
  }

  const downloadResults = () => {
    if (!matches?.length) return
    const rows = matches.map((patient) => ({
      patient_id: patient.patient_id,
      patient_name: displayPatientName(patient.display_first_name ?? patient.first_name, patient.display_last_name ?? patient.last_name),
      location: [patient.city, patient.state].filter(Boolean).join(', '),
      matched_on: patient.matched_on ?? '',
      last_visit_date: patient.last_visit_date ?? '',
      age_years: patient.age_years ?? '',
    }))
    downloadBlob(`swiftcare-patient-search-${stamp()}.csv`, new Blob([toCsv(rows)], { type: 'text/csv' }))
  }

  return (
    <section className="patient-search stack">
      <div><p className="eyebrow">Patient lookup</p><h1>Find a patient</h1><p className="muted">Search by name, location, symptom, condition, medication, allergy, or another chart attribute.</p></div>
      <form className="patient-search__form" onSubmit={(event) => void search(event)}>
        <label>Search patient records<input value={query} onChange={(event) => { setQuery(event.target.value); remember(event.target.value, matches) }} placeholder="e.g. Kuhn, Boston, dizziness, diabetes" aria-label="Search patient records" /></label>
        <button className="primary" type="submit" disabled={loading || !query.trim()}>{loading ? 'Searching…' : 'Search'}</button>
      </form>
      {recentSearches.length ? <div className="patient-search__recent"><div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Recent searches</span><button type="button" className="ghost" onClick={() => { setRecentSearches([]); remember(query, matches, []) }}>Clear</button></div><div className="row">{recentSearches.map((term) => <button key={term} type="button" className="chip" onClick={() => void runSearch(term)}>{term}</button>)}</div></div> : null}
      {error ? <div className="panel continuity-page__error"><strong>Search unavailable</strong><p>{error}</p></div> : null}
      {loading && !matches ? <LoadingPanel label="Searching patient records…" /> : null}
      {matches ? <div className="panel">
        <div className="patient-search__results-header">
          <div><h2>Search results</h2><p className="muted">{matches.length} {matches.length === 1 ? 'patient' : 'patients'} found</p></div>
          {matches.length ? <button type="button" className="patient-search__download" aria-label="Download search results as CSV" title="Download search results as CSV" onClick={downloadResults}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></svg>
          </button> : null}
        </div>
        <SearchResultsTable matches={matches} onSelect={(patient) => void select(patient)} />
      </div> : !loading ? <div className="panel"><p className="empty">Search by patient name to get started.</p></div> : null}
    </section>
  )
}
