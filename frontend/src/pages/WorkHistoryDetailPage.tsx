import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getContinuityHistoryEntry, updateContinuityHistoryEntry } from '../api/continuity'
import { getSummary } from '../api/patients'
import type { ContinuityHistoryEntry, PatientSummary } from '../api/types'
import { displayFullPatientName } from '../utils/displayPatientName'
import { LoadingPanel } from '../components/LoadingPanel'
import { readPageMemory, writePageMemory } from '../utils/pageMemory'
import { formatOperationalLabel } from '../utils/formatOperationalLabel'

const completionOutcomes = [
  ['CONTACT_ATTEMPTED', 'Contact attempted'],
  ['PATIENT_REACHED', 'Patient reached'],
  ['FOLLOW_UP_REQUESTED', 'Follow-up requested'],
  ['REFERRAL_VERIFIED', 'Referral verified'],
  ['VISIT_CONFIRMED', 'Visit confirmed'],
  ['NEEDS_CARE_TEAM_REVIEW', 'Needs care team review'],
]
const dismissOutcomes = [
  ['ALREADY_HANDLED', 'Already handled'],
  ['NOT_APPLICABLE', 'Not applicable'],
  ['DUPLICATE', 'Duplicate'],
  ['OTHER', 'Other'],
]

export function WorkHistoryDetailPage() {
  const { eventId = '' } = useParams()
  const cacheKey = `work-history-entry:${eventId}`
  const restored = readPageMemory<{ entry: ContinuityHistoryEntry; patient: PatientSummary | null }>(cacheKey)
  const [entry, setEntry] = useState<ContinuityHistoryEntry | null>(() => restored?.entry ?? null)
  const [patient, setPatient] = useState<PatientSummary | null>(() => restored?.patient ?? null)
  const [outcome, setOutcome] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (entry) writePageMemory(cacheKey, { entry, patient })
  }, [cacheKey, entry, patient])

  useEffect(() => {
    if (restored) return
    let active = true
    void getContinuityHistoryEntry(eventId).then(async (record) => {
      if (!active) return
      setEntry(record); setOutcome(record.outcome ?? ''); setNote(record.note ?? '')
      try { const summary = await getSummary(record.patient_id); if (active) setPatient(summary) } catch { /* the entry remains useful without a secondary summary */ }
    }).catch((err) => active && setError(err instanceof Error ? err.message : 'Unable to load this work entry.'))
    return () => { active = false }
  }, [eventId])

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!entry || !outcome) return
    setBusy(true); setError(null)
    try { setEntry(await updateContinuityHistoryEntry(entry.event_id, outcome, note)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to save this update.') }
    finally { setBusy(false) }
  }

  if (error && !entry) return <div className="panel continuity-page__error"><strong>Work entry unavailable</strong><p>{error}</p><Link to="/history">Return to work history</Link></div>
  if (!entry) return <LoadingPanel label="Loading this work entry…" />
  const options = entry.event_type === 'DISMISSED' ? dismissOutcomes : completionOutcomes
  const lastUpdated = entry.audit_history.at(-1)
  return <section className="history-detail stack">
    <Link className="action-detail__back" to="/history">← Back to work history</Link>
    <div className="history-detail__heading"><div><p className="eyebrow">Recorded work</p><h1>{displayFullPatientName(entry.patient_name)}</h1><p className="muted">{entry.action_label}</p></div><Link className="ghost" to={`/patient/${entry.patient_id}`}>Open full patient record</Link></div>
    <div className="panel history-detail__context"><div><small>Last visit</small><strong>{patient?.last_visit_date ?? 'Not on file'}</strong></div><div><small>Active conditions</small><strong>{patient?.active_conditions_count ?? '—'}</strong></div><div><small>Medications on file</small><strong>{patient?.active_medications_count ?? '—'}</strong></div></div>
    <div className="panel"><p className="eyebrow">Why this work was created</p><p>{entry.why_now}</p></div>
    <form className="panel action-detail__outcome" onSubmit={(event) => void save(event)}><h2>Edit recorded outcome</h2><p className="muted">Saving retains the prior entry in the audit trail and records who made the update.</p><label>Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)} required>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Staff note<textarea value={note} maxLength={280} onChange={(event) => setNote(event.target.value)} /></label>{error ? <p className="action-detail__error">{error}</p> : null}<button className="primary" type="submit" disabled={busy || !outcome}>{busy ? 'Saving update…' : 'Save update'}</button></form>
    <div className="panel history-detail__audit"><div><p className="eyebrow">Audit trail</p><h2>Work entry history</h2>{lastUpdated ? <p className="muted">Last updated {new Date(lastUpdated.created_at).toLocaleString()}</p> : null}</div><ol>{entry.audit_history.map((audit) => <li key={audit.event_id}><strong>{formatOperationalLabel(audit.event_type)}</strong><span>{formatOperationalLabel(audit.outcome) || '—'} · {new Date(audit.created_at).toLocaleString()}</span>{audit.note ? <small>{audit.note}</small> : null}</li>)}</ol></div>
  </section>
}
