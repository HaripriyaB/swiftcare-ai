import { useState } from 'react'
import type { ExportFormat, PatientDetailsExport } from '../api/types'
import { buildPatientExport, flattenExportToRows } from '../utils/buildPatientExport'
import { downloadBlob, stamp } from '../utils/download'
import { toCsv } from '../utils/toCsv'
import type {
  AdvisoryCard,
  Allergy,
  DiagnosticOutcome,
  InsightAlert,
  Medication,
  PatientSummary,
  Symptom,
  TimelineEvent,
  Visit,
  Vitals,
} from '../api/types'

export function DownloadPatientDetails(props: {
  patientId: string
  summary: PatientSummary | null
  symptoms: Symptom[]
  outcomes: DiagnosticOutcome[]
  nextSteps: AdvisoryCard[]
  medications: Medication[]
  allergies: Allergy[]
  visits: Visit[]
  timeline: TimelineEvent[]
  vitals: Vitals | null
  alerts: InsightAlert[]
  disabled?: boolean
}) {
  const [format, setFormat] = useState<ExportFormat>('json')

  const run = () => {
    const exp: PatientDetailsExport = buildPatientExport({
      patientId: props.patientId,
      summary: props.summary,
      symptoms: props.symptoms,
      outcomes: props.outcomes,
      nextSteps: props.nextSteps,
      medications: props.medications,
      allergies: props.allergies,
      visits: props.visits,
      timeline: props.timeline,
      vitals: props.vitals,
      alerts: props.alerts,
    })
    const short = props.patientId.slice(0, 8)
    if (format === 'json') {
      downloadBlob(
        `swiftcare-patient-${short}-${stamp()}.json`,
        new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' }),
      )
    } else {
      downloadBlob(
        `swiftcare-patient-${short}-${stamp()}.csv`,
        new Blob([toCsv(flattenExportToRows(exp))], { type: 'text/csv' }),
      )
    }
  }

  return (
    <div className="row">
      <label className="row" style={{ gap: '0.35rem' }}>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          Format
        </span>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
          style={{ width: 'auto' }}
          aria-label="Download format"
        >
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
        </select>
      </label>
      <button
        type="button"
        aria-label="Download patient details"
        disabled={props.disabled}
        onClick={run}
      >
        Download patient details
      </button>
      <span className="muted" style={{ fontSize: '0.75rem' }}>
        Contains patient data — handle per clinic policy
      </span>
    </div>
  )
}
