export type ExportFormat = 'json' | 'csv'
export type CardSeverity = 'info' | 'attention'
export type CardType =
  | 'allergy_awareness'
  | 'medication_review'
  | 'follow_up_scheduling'
  | 'chart_completeness'
export type AlertSeverity = 'HIGH' | 'MEDIUM' | 'LOW'
export type AlertType =
  | 'gap_in_care'
  | 'polypharmacy'
  | 'high_utilizer'
  | 'chronic_burden'
  | 'scheduling_inefficiency'
export type SymptomReportedBy = 'patient' | 'staff'
export type SymptomStatus = 'active' | 'resolved'

export interface PatientMatch {
  patient_id: string
  first_name?: string
  last_name?: string
  display_first_name?: string
  display_last_name?: string
  city?: string
  state?: string
  last_visit_date?: string
  age_years?: number
  gender?: string
  match_score?: number
}

export interface PatientSearchResponse {
  match_count: number
  matches: PatientMatch[]
  results_table?: string
  display_hint?: string
}

export interface PatientSummary {
  patient_id: string
  display_first_name?: string
  display_last_name?: string
  age_years?: number
  gender?: string
  city?: string
  state?: string
  last_visit_date?: string
  is_deceased?: boolean
  active_conditions_count?: number
  active_medications_count?: number
  active_allergies_count?: number
  total_encounters?: number
}

export interface Medication {
  medication_id: string
  medication_name: string
  prescribed_date?: string
  status?: string
}

export interface Allergy {
  allergy_id: string
  allergen: string
  criticality?: string
}

export interface Visit {
  encounter_id: string
  visit_date: string
  encounter_class?: string
  visit_type?: string
  chief_complaint?: string
  status?: string
}

export interface TimelineEvent {
  event_date: string
  event_type: string
  event_label: string
  source_id?: string
}

export interface Vitals {
  patient_id: string
  systolic_bp?: number
  diastolic_bp?: number
  heart_rate?: number
  respiratory_rate?: number
  height_cm?: number
  weight_kg?: number
  bmi?: number
  latest_observation_date?: string
}

export interface DiagnosticOutcome {
  condition_id: string
  patient_id: string
  display_name: string
  status: string
  onset_date?: string
  source?: string
  attribution: string
}

export interface Symptom {
  symptom_id: string
  patient_id: string
  description: string
  reported_by: SymptomReportedBy
  recorded_by_user_id?: string
  recorded_by_display?: string
  status: SymptomStatus
  recorded_at: string
  resolved_at?: string | null
}

export interface SymptomCreateRequest {
  description: string
  reported_by: SymptomReportedBy
}

export interface AdvisoryContent {
  title: string
  body: string
  severity: CardSeverity
  card_type: CardType
  disclaimer: string
}

export interface SourceRef {
  view: string
  patient_id: string
  fields?: string[]
}

export interface AdvisoryCard {
  card_id: string
  session_id?: string | null
  patient_id: string
  agent_type?: string
  content: AdvisoryContent
  source_refs?: SourceRef[]
  dismissed: boolean
  created_at: string
}

export interface InsightAlert {
  alert_id: string
  patient_id: string
  alert_type: AlertType
  severity: AlertSeverity
  message: string
  dismissed: boolean
  created_at: string
}

export interface AtRiskPatient {
  patient_id: string
  display_first_name?: string
  display_last_name?: string
  age_years?: number
  days_since_last_visit?: number
  risk_flag: string
  risk_level: string
  encounters_last_90d?: number
  active_condition_count?: number
  active_med_count?: number
}

export interface RiskDistributionRow {
  risk_flag: string
  risk_level: string
  patient_count: number
}

export interface Session {
  session_id: string
  user_id: string
  active_patient_id: string | null
}

export interface ChatPatientRow {
  patient_id: string
  display_first_name?: string
  display_last_name?: string
  risk_flag?: string
  risk_level?: string
  days_since_last_visit?: number
  age_years?: number
  city?: string
  state?: string
}

export interface ChatRequest {
  message: string
  patient_id?: string | null
  session_id?: string | null
}

export interface ChatResponse {
  reply: string
  agent_type: string
  patient_id?: string | null
  citations?: { view: string }[]
  cards?: AdvisoryCard[]
  alerts?: InsightAlert[]
  patients?: ChatPatientRow[]
}

export interface PatientDetailsExport {
  exported_at: string
  patient_id: string
  disclaimer: string
  summary: PatientSummary | null
  symptoms: Symptom[]
  diagnostic_outcomes: DiagnosticOutcome[]
  recommended_next_steps: AdvisoryCard[]
  medications: Medication[]
  allergies: Allergy[]
  visits: Visit[]
  timeline: TimelineEvent[]
  vitals: Vitals | null
  insight_alerts_open: InsightAlert[]
}

export const PLAIN_RISK_LABELS: Record<string, string> = {
  gap_in_care: 'care gap (visit overdue)',
  polypharmacy: 'many active meds',
  high_utilizer: 'high visit volume (90d)',
  chronic_burden: 'multiple active conditions',
  scheduling_inefficiency: 'scheduling inefficiency (ops)',
  none: 'no elevated risk flag',
}

export const NEXT_STEPS_TITLE = 'Recommended next steps'
export const OUTCOMES_TITLE = 'Diagnostic outcomes'
export const OUTCOMES_SUBTITLE =
  'From the patient chart — not generated by SwiftCare AI'
export const SYMPTOMS_TITLE = 'Symptoms'
export const INSIGHT_LAYER_TITLE = 'Insights'
export const DEFAULT_CARD_DISCLAIMER =
  'Not a clinical order. Staff review required. Not a diagnosis or prescription.'
export const DEFAULT_ALERT_DISCLAIMER =
  'Not a diagnosis or clinical order. Staff review required. Operational insight only.'
