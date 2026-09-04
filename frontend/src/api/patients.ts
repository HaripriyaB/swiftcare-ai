import { apiFetch } from './client'
import type {
  AdvisoryCard,
  Allergy,
  DiagnosticOutcome,
  Medication,
  PatientSearchResponse,
  PatientSummary,
  TimelineEvent,
  Visit,
  Vitals,
} from './types'

export function searchPatients(q: string) {
  return apiFetch<PatientSearchResponse>(
    `/patients/search?q=${encodeURIComponent(q)}`,
  )
}

export function getSummary(patientId: string) {
  return apiFetch<PatientSummary>(`/patients/${patientId}/summary`)
}

export function getConditions(patientId: string) {
  return apiFetch<DiagnosticOutcome[]>(`/patients/${patientId}/conditions`)
}

export function getMedications(patientId: string) {
  return apiFetch<Medication[]>(`/patients/${patientId}/medications`)
}

export function getAllergies(patientId: string) {
  return apiFetch<Allergy[]>(`/patients/${patientId}/allergies`)
}

export function getVisits(patientId: string) {
  return apiFetch<Visit[]>(`/patients/${patientId}/visits`)
}

export function getTimeline(patientId: string) {
  return apiFetch<TimelineEvent[]>(`/patients/${patientId}/timeline`)
}

export function getVitals(patientId: string) {
  return apiFetch<Vitals>(`/patients/${patientId}/vitals`)
}

export function listAdvisoryCards(patientId: string, open = true) {
  return apiFetch<AdvisoryCard[]>(
    `/patients/${patientId}/advisory-cards?open=${open}`,
  )
}

export function dismissAdvisoryCard(patientId: string, cardId: string) {
  return apiFetch<{ card_id: string; dismissed: true }>(
    `/patients/${patientId}/advisory-cards/${cardId}/dismiss`,
    { method: 'POST' },
  )
}
