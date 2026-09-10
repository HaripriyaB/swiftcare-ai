import { useState } from 'react'
import type { FhirClinicalFinding, Symptom, SymptomReportedBy } from '../../api/types'
import { SYMPTOMS_TITLE } from '../../api/types'

export function SymptomsPanel({
  symptoms,
  fhirFindings,
  onAdd,
  onResolve,
}: {
  symptoms: Symptom[]
  fhirFindings: FhirClinicalFinding[]
  onAdd: (description: string, reported_by: SymptomReportedBy) => Promise<void>
  onResolve: (id: string) => Promise<void>
}) {
  const [description, setDescription] = useState('')
  const [reportedBy, setReportedBy] = useState<SymptomReportedBy>('patient')
  const [busy, setBusy] = useState(false)
  const active = symptoms.filter((s) => s.status === 'active').slice(0, 8)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return
    setBusy(true)
    try {
      await onAdd(description.trim(), reportedBy)
      setDescription('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel stack">
      <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{SYMPTOMS_TITLE}</h2>
      <div className="patient-source-section">
        <strong>FHIR chart findings</strong>
        <p className="muted">Conditions and symptom-relevant observations from the source chart.</p>
        {!fhirFindings.length ? <p className="empty">No symptom-relevant FHIR observations are available.</p> : fhirFindings.slice(0, 6).map((finding) => (
          <div key={finding.finding_id} className="list-row">
            <div><strong>{finding.display_name}</strong><p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.8rem' }}>{finding.source_kind}{finding.value_text ? ` · ${finding.value_text}` : ''}{finding.recorded_date ? ` · ${finding.recorded_date}` : ''}</p></div>
          </div>
        ))}
      </div>
      <div className="patient-source-section">
        <strong>Active recorded symptoms</strong>
        <p className="muted">Patient-reported or staff-added operational symptoms.</p>
      {!active.length ? <p className="empty">No symptoms recorded yet.</p> : null}
      {active.map((s) => (
        <div key={s.symptom_id} className="list-row">
          <div>
            <div className="row">
              <span>{s.description}</span>
              <span className="chip">
                {s.reported_by === 'patient' ? 'Patient reported' : 'Staff added'}
              </span>
            </div>
            <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
              {s.recorded_by_display} · {new Date(s.recorded_at).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            aria-label={`Resolve symptom ${s.description}`}
            onClick={() => void onResolve(s.symptom_id)}
          >
            Resolve
          </button>
        </div>
      ))}
      </div>
      <form className="stack" onSubmit={(e) => void submit(e)}>
        <label>
          Add symptom
          <input
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
          />
        </label>
        <label>
          Reported by
          <select
            value={reportedBy}
            onChange={(e) => setReportedBy(e.target.value as SymptomReportedBy)}
          >
            <option value="patient">Patient</option>
            <option value="staff">Staff</option>
          </select>
        </label>
        <button type="submit" className="primary" disabled={busy}>
          Add symptom
        </button>
      </form>
    </section>
  )
}
