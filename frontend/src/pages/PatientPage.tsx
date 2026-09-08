import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  dismissAdvisoryCard,
  getAllergies,
  getConditions,
  getMedications,
  getSummary,
  getTimeline,
  getVisits,
  getVitals,
  listAdvisoryCards,
} from '../api/patients'
import { addSymptom, listSymptoms, resolveSymptom } from '../api/symptoms'
import { dismissInsightAlert, listInsightAlerts } from '../api/insights'
import type {
  AdvisoryCard,
  Allergy,
  DiagnosticOutcome,
  InsightAlert,
  Medication,
  PatientSummary,
  Symptom,
  SymptomReportedBy,
  TimelineEvent,
  Visit,
  Vitals,
} from '../api/types'
import { SummaryPanel } from '../components/chart/SummaryPanel'
import { SymptomsPanel } from '../components/chart/SymptomsPanel'
import { DiagnosticOutcomesPanel } from '../components/chart/DiagnosticOutcomesPanel'
import { MedicationsPanel } from '../components/chart/MedicationsPanel'
import { AllergiesPanel } from '../components/chart/AllergiesPanel'
import { VisitsPanel } from '../components/chart/VisitsPanel'
import { TimelinePanel } from '../components/chart/TimelinePanel'
import { VitalsPanel } from '../components/chart/VitalsPanel'
import { NextStepsPanel } from '../components/NextStepsPanel'
import { InsightAlertStrip } from '../components/InsightAlertStrip'
import { DownloadPatientDetails } from '../components/DownloadPatientDetails'
import { ChatPanel } from '../components/ChatPanel'
import { LoadingPanel } from '../components/LoadingPanel'
import { readPageMemory, writePageMemory } from '../utils/pageMemory'

type Tab = 'overview' | 'symptoms' | 'outcomes' | 'next' | 'more'
type PatientSnapshot = {
  tab: Tab
  summary: PatientSummary
  symptoms: Symptom[]
  outcomes: DiagnosticOutcome[]
  nextSteps: AdvisoryCard[]
  meds: Medication[]
  allergies: Allergy[]
  visits: Visit[]
  timeline: TimelineEvent[]
  vitals: Vitals | null
  alerts: InsightAlert[]
}

type DetailLoading = Record<'symptoms' | 'outcomes' | 'nextSteps' | 'meds' | 'allergies' | 'visits' | 'timeline' | 'vitals' | 'alerts', boolean>

function detailLoading(value: boolean): DetailLoading {
  return {
    symptoms: value,
    outcomes: value,
    nextSteps: value,
    meds: value,
    allergies: value,
    visits: value,
    timeline: value,
    vitals: value,
    alerts: value,
  }
}

export function PatientPage() {
  const { patientId = '' } = useParams()
  const cacheKey = `patient:${patientId}`
  const restored = readPageMemory<PatientSnapshot>(cacheKey)
  const [tab, setTab] = useState<Tab>(() => restored?.tab ?? 'overview')
  const [summary, setSummary] = useState<PatientSummary | null>(() => restored?.summary ?? null)
  const [symptoms, setSymptoms] = useState<Symptom[]>(() => restored?.symptoms ?? [])
  const [outcomes, setOutcomes] = useState<DiagnosticOutcome[]>(() => restored?.outcomes ?? [])
  const [nextSteps, setNextSteps] = useState<AdvisoryCard[]>(() => restored?.nextSteps ?? [])
  const [meds, setMeds] = useState<Medication[]>(() => restored?.meds ?? [])
  const [allergies, setAllergies] = useState<Allergy[]>(() => restored?.allergies ?? [])
  const [visits, setVisits] = useState<Visit[]>(() => restored?.visits ?? [])
  const [timeline, setTimeline] = useState<TimelineEvent[]>(() => restored?.timeline ?? [])
  const [vitals, setVitals] = useState<Vitals | null>(() => restored?.vitals ?? null)
  const [alerts, setAlerts] = useState<InsightAlert[]>(() => restored?.alerts ?? [])
  const [loading, setLoading] = useState(() => !restored)
  const [detailsLoading, setDetailsLoading] = useState<DetailLoading>(() => detailLoading(!restored))
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const cached = readPageMemory<PatientSnapshot>(cacheKey)
    if (cached) {
      setTab(cached.tab); setSummary(cached.summary); setSymptoms(cached.symptoms)
      setOutcomes(cached.outcomes); setNextSteps(cached.nextSteps); setMeds(cached.meds)
      setAllergies(cached.allergies); setVisits(cached.visits); setTimeline(cached.timeline)
      setVitals(cached.vitals); setAlerts(cached.alerts); setLoading(false); setDetailsLoading(detailLoading(false)); setError(null)
      return
    }
    if (!patientId) return
    let active = true
    setTab('overview'); setSummary(null); setSymptoms([]); setOutcomes([]); setNextSteps([])
    setMeds([]); setAllergies([]); setVisits([]); setTimeline([]); setVitals(null); setAlerts([])
    setLoading(true); setDetailsLoading(detailLoading(true)); setError(null)
    void (async () => {
      // Begin every read immediately. Each visible section updates as soon as
      // its own response arrives, rather than waiting for another chart panel.
      const summaryRequest = getSummary(patientId)
      const loadDetail = <T,>(key: keyof DetailLoading, request: Promise<T>, setter: (value: T) => void) => {
        void request
          .then((value) => { if (active) setter(value) })
          .catch(() => undefined)
          .finally(() => {
            if (active) setDetailsLoading((current) => ({ ...current, [key]: false }))
          })
      }
      loadDetail('symptoms', listSymptoms(patientId), setSymptoms)
      loadDetail('outcomes', getConditions(patientId), setOutcomes)
      loadDetail('nextSteps', listAdvisoryCards(patientId), setNextSteps)
      loadDetail('meds', getMedications(patientId), setMeds)
      loadDetail('allergies', getAllergies(patientId), setAllergies)
      loadDetail('visits', getVisits(patientId), setVisits)
      loadDetail('timeline', getTimeline(patientId), setTimeline)
      loadDetail('vitals', getVitals(patientId), setVitals)
      loadDetail('alerts', listInsightAlerts({ patient_id: patientId }), setAlerts)
      try {
        const s = await summaryRequest
        if (!active) return
        setSummary(s)
      } catch {
        if (active) setError('Could not load patient')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [cacheKey, patientId])

  useEffect(() => {
    if (!summary || summary.patient_id !== patientId) return
    writePageMemory(cacheKey, { tab, summary, symptoms, outcomes, nextSteps, meds, allergies, visits, timeline, vitals, alerts })
  }, [cacheKey, patientId, tab, summary, symptoms, outcomes, nextSteps, meds, allergies, visits, timeline, vitals, alerts])

  const copyId = async () => {
    setError(null)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(patientId)
      } else {
        const helper = document.createElement('textarea')
        helper.value = patientId
        helper.setAttribute('readonly', '')
        helper.style.position = 'fixed'
        helper.style.opacity = '0'
        document.body.appendChild(helper)
        try {
          helper.select()
          if (!document.execCommand('copy')) throw new Error('copy_failed')
        } finally {
          helper.remove()
        }
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Clipboard access is unavailable. Select the patient ID from the URL instead.')
    }
  }

  return (
    <div className="stack patient-record">
      <Link className="patient-record__back" to="/patients">← Patient search</Link>
      {loading && !summary ? <LoadingPanel label="Loading this patient record…" /> : <>
      <div className="panel stack">
        <SummaryPanel summary={summary} />
        <div className="row">
          <button className="text-action" type="button" onClick={() => void copyId()} aria-live="polite">
            {copied ? 'Copied' : 'Copy patient ID'}
          </button>
          <DownloadPatientDetails
            patientId={patientId}
            summary={summary}
            symptoms={symptoms}
            outcomes={outcomes}
            nextSteps={nextSteps}
            medications={meds}
            allergies={allergies}
            visits={visits}
            timeline={timeline}
            vitals={vitals}
            alerts={alerts}
            disabled={!summary || Object.values(detailsLoading).some(Boolean)}
          />
        </div>
      </div>

      {error ? <p style={{ color: 'var(--sc-high)' }}>{error}</p> : null}

      <div className="tabs" role="tablist">
        {(
          [
            ['overview', 'Overview'],
            ['symptoms', 'Symptoms'],
            ['outcomes', 'Outcomes'],
            ['next', 'Next steps'],
            ['more', 'More…'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="stack">
          <VitalsPanel vitals={vitals} loading={detailsLoading.vitals} />
          <div className="panel row" style={{ justifyContent: 'space-between' }}>
            {detailsLoading.nextSteps ? <span className="section-loading"><span className="inline-loader__spinner" aria-hidden="true" /> Loading next steps…</span> : <span>Open next steps: <strong>{nextSteps.filter((c) => !c.dismissed).length}</strong></span>}
            {detailsLoading.symptoms ? <span className="section-loading"><span className="inline-loader__spinner" aria-hidden="true" /> Loading symptoms…</span> : <span>Active symptoms: <strong>{symptoms.filter((s) => s.status === 'active').length}</strong></span>}
          </div>
        </div>
      ) : null}

      {tab === 'symptoms' ? (detailsLoading.symptoms ? <LoadingPanel label="Loading reported symptoms…" /> : (
        <SymptomsPanel
          symptoms={symptoms}
          onAdd={async (description, reported_by: SymptomReportedBy) => {
            const row = await addSymptom(patientId, { description, reported_by })
            setSymptoms((s) => [...s, row])
          }}
          onResolve={async (id) => {
            await resolveSymptom(patientId, id)
            setSymptoms((s) =>
              s.map((x) =>
                x.symptom_id === id
                  ? { ...x, status: 'resolved', resolved_at: new Date().toISOString() }
                  : x,
              ),
            )
          }}
        />
      )) : null}

      {tab === 'outcomes' ? (detailsLoading.outcomes ? <LoadingPanel label="Loading documented conditions…" /> : <DiagnosticOutcomesPanel outcomes={outcomes} />) : null}

      {tab === 'next' ? (
        detailsLoading.nextSteps ? <LoadingPanel label="Loading next steps…" /> : <NextStepsPanel
          cards={nextSteps}
          onDismiss={(id) => {
            void dismissAdvisoryCard(patientId, id).then(() => {
              setNextSteps((cards) =>
                cards.map((c) => (c.card_id === id ? { ...c, dismissed: true } : c)),
              )
            })
          }}
        />
      ) : null}

      {tab === 'more' ? (
        <div className="stack">
          {detailsLoading.meds ? <LoadingPanel label="Loading medications…" /> : <MedicationsPanel items={meds} />}
          {detailsLoading.allergies ? <LoadingPanel label="Loading allergies…" /> : <AllergiesPanel items={allergies} />}
          {detailsLoading.visits ? <LoadingPanel label="Loading visit history…" /> : <VisitsPanel items={visits} />}
          {detailsLoading.timeline ? <LoadingPanel label="Loading timeline…" /> : <TimelinePanel items={timeline} />}
          {detailsLoading.alerts ? <LoadingPanel label="Loading patient signals…" /> : <InsightAlertStrip
            alerts={alerts}
            onDismiss={(id) => {
              void dismissInsightAlert(id).then(() => {
                setAlerts((a) =>
                  a.map((x) => (x.alert_id === id ? { ...x, dismissed: true } : x)),
                )
              })
            }}
          />}
        </div>
      ) : null}

      <ChatPanel key={patientId} patientId={patientId} />
      </>}
    </div>
  )
}
