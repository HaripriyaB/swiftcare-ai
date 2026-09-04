import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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

type Tab = 'overview' | 'symptoms' | 'outcomes' | 'next' | 'more'

export function PatientPage() {
  const { patientId = '' } = useParams()
  const [tab, setTab] = useState<Tab>('overview')
  const [summary, setSummary] = useState<PatientSummary | null>(null)
  const [symptoms, setSymptoms] = useState<Symptom[]>([])
  const [outcomes, setOutcomes] = useState<DiagnosticOutcome[]>([])
  const [nextSteps, setNextSteps] = useState<AdvisoryCard[]>([])
  const [meds, setMeds] = useState<Medication[]>([])
  const [allergies, setAllergies] = useState<Allergy[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [vitals, setVitals] = useState<Vitals | null>(null)
  const [alerts, setAlerts] = useState<InsightAlert[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!patientId) return
    setError(null)
    try {
      const [
        s,
        sy,
        oc,
        cards,
        m,
        a,
        v,
        t,
        vit,
        al,
      ] = await Promise.all([
        getSummary(patientId),
        listSymptoms(patientId),
        getConditions(patientId),
        listAdvisoryCards(patientId),
        getMedications(patientId),
        getAllergies(patientId),
        getVisits(patientId),
        getTimeline(patientId),
        getVitals(patientId),
        listInsightAlerts({ patient_id: patientId }),
      ])
      setSummary(s)
      setSymptoms(sy)
      setOutcomes(oc)
      setNextSteps(cards)
      setMeds(m)
      setAllergies(a)
      setVisits(v)
      setTimeline(t)
      setVitals(vit)
      setAlerts(al)
    } catch {
      setError('Could not load patient')
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  const copyId = async () => {
    await navigator.clipboard.writeText(patientId)
  }

  return (
    <div className="stack">
      <div className="panel stack">
        <SummaryPanel summary={summary} />
        <div className="row">
          <button type="button" onClick={() => void copyId()}>
            Copy ID
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
            disabled={!summary}
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
          <VitalsPanel vitals={vitals} />
          <div className="panel row" style={{ justifyContent: 'space-between' }}>
            <span>
              Open next steps:{' '}
              <strong>{nextSteps.filter((c) => !c.dismissed).length}</strong>
            </span>
            <span>
              Active symptoms: <strong>{symptoms.filter((s) => s.status === 'active').length}</strong>
            </span>
          </div>
        </div>
      ) : null}

      {tab === 'symptoms' ? (
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
      ) : null}

      {tab === 'outcomes' ? <DiagnosticOutcomesPanel outcomes={outcomes} /> : null}

      {tab === 'next' ? (
        <NextStepsPanel
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
          <MedicationsPanel items={meds} />
          <AllergiesPanel items={allergies} />
          <VisitsPanel items={visits} />
          <TimelinePanel items={timeline} />
          <InsightAlertStrip
            alerts={alerts}
            onDismiss={(id) => {
              void dismissInsightAlert(id).then(() => {
                setAlerts((a) =>
                  a.map((x) => (x.alert_id === id ? { ...x, dismissed: true } : x)),
                )
              })
            }}
          />
        </div>
      ) : null}

      <ChatPanel patientId={patientId} />
    </div>
  )
}
