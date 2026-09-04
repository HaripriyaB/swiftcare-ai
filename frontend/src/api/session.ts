import { apiFetch } from './client'
import type { Session } from './types'

export function getSession() {
  return apiFetch<Session>('/session')
}

export function putSession(body: {
  active_patient_id?: string | null
  user_id?: string
}) {
  return apiFetch<Session>('/session', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}
