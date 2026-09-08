import { apiFetch, clearApiCache } from './client'
import type { Symptom, SymptomCreateRequest } from './types'

export function listSymptoms(patientId: string, activeOnly = true) {
  return apiFetch<Symptom[]>(
    `/patients/${patientId}/symptoms?active=${activeOnly}`,
  )
}

export function addSymptom(patientId: string, body: SymptomCreateRequest) {
  return apiFetch<Symptom>(`/patients/${patientId}/symptoms`, {
    method: 'POST',
    body: JSON.stringify(body),
  }).then((value) => { clearApiCache(`/patients/${patientId}`); return value })
}

export function resolveSymptom(patientId: string, symptomId: string) {
  return apiFetch<Symptom>(
    `/patients/${patientId}/symptoms/${symptomId}/resolve`,
    { method: 'POST' },
  ).then((value) => { clearApiCache(`/patients/${patientId}`); return value })
}
