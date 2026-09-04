import type {
  AdvisoryCard,
  Allergy,
  DiagnosticOutcome,
  Medication,
  PatientDetailsExport,
  PatientSummary,
  Symptom,
  TimelineEvent,
  Visit,
  Vitals,
  InsightAlert,
} from '../api/types'

export function buildPatientExport(input: {
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
}): PatientDetailsExport {
  return {
    exported_at: new Date().toISOString(),
    patient_id: input.patientId,
    disclaimer:
      'Operational export for staff use. Not a clinical order or legal medical record substitute.',
    summary: input.summary,
    symptoms: input.symptoms,
    diagnostic_outcomes: input.outcomes,
    recommended_next_steps: input.nextSteps,
    medications: input.medications,
    allergies: input.allergies,
    visits: input.visits,
    timeline: input.timeline,
    vitals: input.vitals,
    insight_alerts_open: input.alerts,
  }
}

export function flattenExportToRows(exp: PatientDetailsExport): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  if (exp.summary) {
    rows.push({ section: 'summary', ...exp.summary })
  }
  exp.symptoms.forEach((s) => rows.push({ section: 'symptom', ...s }))
  exp.diagnostic_outcomes.forEach((o) => rows.push({ section: 'outcome', ...o }))
  exp.recommended_next_steps.forEach((c) =>
    rows.push({
      section: 'next_step',
      card_id: c.card_id,
      title: c.content.title,
      body: c.content.body,
      severity: c.content.severity,
    }),
  )
  exp.medications.forEach((m) => rows.push({ section: 'medication', ...m }))
  exp.allergies.forEach((a) => rows.push({ section: 'allergy', ...a }))
  exp.visits.forEach((v) => rows.push({ section: 'visit', ...v }))
  exp.timeline.forEach((t) => rows.push({ section: 'timeline', ...t }))
  if (exp.vitals) rows.push({ section: 'vitals', ...exp.vitals })
  exp.insight_alerts_open.forEach((a) => rows.push({ section: 'insight_alert', ...a }))
  return rows
}
