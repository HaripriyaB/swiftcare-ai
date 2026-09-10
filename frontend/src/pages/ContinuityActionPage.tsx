import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { completeContinuityCard, getContinuityCard, startContinuityCard } from '../api/continuity'
import { getSummary } from '../api/patients'
import type { ContinuityCard, PatientSummary } from '../api/types'
import { displayFullPatientName } from '../utils/displayPatientName'
import { LoadingPanel } from '../components/LoadingPanel'
import { useSwifyPatientContext } from '../components/AppShell'
import { readPageMemory, writePageMemory } from '../utils/pageMemory'

const outcomes = [
  ['CONTACT_ATTEMPTED', 'Contact attempted'],
  ['PATIENT_REACHED', 'Patient reached'],
  ['FOLLOW_UP_REQUESTED', 'Follow-up requested'],
  ['REFERRAL_VERIFIED', 'Referral verified'],
  ['VISIT_CONFIRMED', 'Visit confirmed'],
  ['NEEDS_CARE_TEAM_REVIEW', 'Needs care team review'],
] as const

type ActionSnapshot = { card: ContinuityCard; patient: PatientSummary | null }

export function ContinuityActionPage() {
  const { cardId = '' } = useParams()
  const setSwifyPatientId = useSwifyPatientContext()
  const cacheKey = `continuity-action:${cardId}`
  const restored = readPageMemory<ActionSnapshot>(cacheKey)
  const [card, setCard] = useState<ContinuityCard | null>(() => restored?.card ?? null)
  const [outcome, setOutcome] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [patient, setPatient] = useState<PatientSummary | null>(() => restored?.patient ?? null)
  const [contextError, setContextError] = useState<string | null>(null)

  // A queue card is patient-specific, so keep Swify grounded in that record while it is open.
  useEffect(() => {
    setSwifyPatientId(card?.patient_id ?? null)
    return () => setSwifyPatientId(null)
  }, [card?.patient_id, setSwifyPatientId])

  useEffect(() => {
    if (card) writePageMemory(cacheKey, { card, patient })
  }, [cacheKey, card, patient])

  useEffect(() => {
    if (restored) return
    let active = true
    void getContinuityCard(cardId)
      .then((row) => {
        if (!active) return
        setCard(row)
        void getSummary(row.patient_id)
          .then((summary) => active && setPatient(summary))
          .catch(() => active && setContextError('Patient details are temporarily unavailable. You can still complete this operational work.'))
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Unable to load this action.'))
    return () => { active = false }
  }, [cardId])

  const start = async () => {
    if (!card) return
    setBusy(true); setError(null)
    setCard({ ...card, status: 'IN_PROGRESS' })
    try { setCard(await startContinuityCard(cardId)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to start this action.') }
    finally { setBusy(false) }
  }

  const complete = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!outcome || !card) return
    setBusy(true); setError(null)
    setCard({ ...card, status: 'COMPLETED' })
    try { setCard(await completeContinuityCard(cardId, outcome, note)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to record the outcome.') }
    finally { setBusy(false) }
  }

  if (error && !card) return <div className="panel continuity-page__error"><strong>Action unavailable</strong><p>{error}</p><Link to="/">Return to Today</Link></div>
  if (!card) return <LoadingPanel label="Loading this operational action…" />

  const completeState = card.status === 'COMPLETED'
  return (
    <section className="action-detail">
      <Link to="/" className="action-detail__back">← Back to Today</Link>
      <div className="action-detail__heading">
        <div><span className={`chip ${card.priority}`}>{card.priority} priority</span><h1>{displayFullPatientName(card.patient_name)}</h1><p className="action-detail__action">{card.action_label}</p></div>
        <Link className="ghost" to={`/patient/${card.patient_id}`}>Open full record</Link>
      </div>
      <div className="panel action-detail__primary">
        <p className="eyebrow">Why now</p>
        <p>{card.why_now}</p>
        <p className="muted">{card.disclaimer}</p>
      </div>
      <div className="panel">
        <h2>Evidence</h2>
        <ul className="action-detail__evidence">
          {card.evidence.map((item) => <li key={`${item.label}-${item.value}`}><strong>{item.label}</strong><span>{item.value}</span></li>)}
        </ul>
      </div>
      <div className="panel action-detail__context">
        <div><p className="eyebrow">Patient context</p><h2>At a glance</h2></div>
        {patient ? <div className="action-detail__context-grid"><span><small>Last visit</small><strong>{patient.last_visit_date ?? 'Not on file'}</strong></span><span><small>Active conditions</small><strong>{patient.active_conditions_count ?? 0}</strong></span><span><small>Medications on file</small><strong>{patient.active_medications_count ?? 0}</strong></span></div> : <p className="muted">{contextError ?? 'Loading patient context…'}</p>}
      </div>
      {error ? <p className="action-detail__error">{error}</p> : null}
      {card.status === 'OPEN' ? <button className="primary" disabled={busy} onClick={() => void start()}>{busy ? 'Starting…' : 'Start work'}</button> : null}
      {card.status === 'IN_PROGRESS' ? (
        <form className="panel action-detail__outcome" onSubmit={(event) => void complete(event)}>
          <h2>Mark outcome</h2>
          <p className="muted">Record what staff completed. SwiftCare does not send messages or change appointments.</p>
          <label>Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)} required><option value="">Choose an outcome</option>{outcomes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Optional note<textarea value={note} maxLength={280} onChange={(event) => setNote(event.target.value)} /></label>
          <button className="primary" disabled={busy || !outcome} type="submit">{busy ? 'Saving in audit trail…' : 'Record outcome'}</button>
        </form>
      ) : null}
      {completeState ? <div className="panel"><strong>Outcome recorded</strong><p className="muted">This operational action is complete and is retained in the audit history.</p></div> : null}
    </section>
  )
}
