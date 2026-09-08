import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getContinuityHistory } from '../api/continuity'
import type { ContinuityEvent } from '../api/types'
import { displayFullPatientName } from '../utils/displayPatientName'
import { LoadingPanel } from '../components/LoadingPanel'
import { readPageMemory, writePageMemory } from '../utils/pageMemory'
import { formatOperationalLabel } from '../utils/formatOperationalLabel'

const HISTORY_MEMORY_KEY = 'work-history'

export function WorkHistoryPage() {
  const restored = readPageMemory<ContinuityEvent[]>(HISTORY_MEMORY_KEY)
  const [events, setEvents] = useState<ContinuityEvent[]>(() => restored ?? [])
  const [loading, setLoading] = useState(() => !restored)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (restored) return
    void getContinuityHistory()
      .then((result) => { setEvents(result.events); writePageMemory(HISTORY_MEMORY_KEY, result.events) })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load work history.'))
      .finally(() => setLoading(false))
  }, [])

  return <section className="work-history stack">
    <div><p className="eyebrow">Operations audit</p><h1>Today’s work history</h1><p className="muted">Completed, dismissed, and in-progress continuity actions are retained here.</p></div>
    {error ? <div className="panel continuity-page__error">{error}</div> : null}
    {loading ? <LoadingPanel label="Loading today’s work history…" /> : null}
    {!error && !events.length ? <div className="panel"><p className="empty">No work actions have been recorded yet today.</p></div> : null}
    {events.length ? <div className="panel work-history__table"><table className="table"><thead><tr><th>Time</th><th>Patient</th><th>Action</th><th>Outcome</th><th>Staff note</th></tr></thead><tbody>{events.map((event) => <tr key={event.event_id} className="work-history__row" tabIndex={0} onClick={() => navigate(`/history/${event.event_id}`)} onKeyDown={(key) => { if (key.key === 'Enter' || key.key === ' ') navigate(`/history/${event.event_id}`) }}><td>{new Date(event.created_at).toLocaleString()}</td><td>{displayFullPatientName(event.patient_name)}</td><td>{event.action_label}</td><td>{formatOperationalLabel(event.outcome ?? event.event_type)}</td><td>{event.note || '—'}</td></tr>)}</tbody></table></div> : null}
  </section>
}
