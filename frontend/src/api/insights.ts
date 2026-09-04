import { apiFetch } from './client'
import type {
  AtRiskPatient,
  InsightAlert,
  RiskDistributionRow,
} from './types'

export function getDistribution() {
  return apiFetch<{ distribution: RiskDistributionRow[]; count: number }>(
    '/insights/distribution',
  )
}

export function listAtRisk(params?: {
  risk_flag?: string
  risk_level?: string
  limit?: number
}) {
  const q = new URLSearchParams()
  if (params?.risk_flag) q.set('risk_flag', params.risk_flag)
  if (params?.risk_level) q.set('risk_level', params.risk_level)
  q.set('limit', String(Math.min(params?.limit ?? 10, 50)))
  return apiFetch<{ patients: AtRiskPatient[]; count: number }>(
    `/insights/at-risk?${q}`,
  )
}

export function listInsightAlerts(opts?: {
  open?: boolean
  patient_id?: string
}) {
  const q = new URLSearchParams()
  if (opts?.open !== false) q.set('open', 'true')
  if (opts?.patient_id) q.set('patient_id', opts.patient_id)
  return apiFetch<InsightAlert[]>(`/insights/alerts?${q}`)
}

export function dismissInsightAlert(alertId: string) {
  return apiFetch<{ alert_id: string; dismissed: true }>(
    `/insights/alerts/${alertId}/dismiss`,
    { method: 'POST' },
  )
}
