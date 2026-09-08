import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  dismissInsightAlert,
  getDistribution,
  listAtRisk,
  listInsightAlerts,
} from '../api/insights'
import type { AtRiskPatient, InsightAlert, RiskDistributionRow } from '../api/types'
import { RiskDistribution } from '../components/RiskDistribution'
import { AtRiskTable } from '../components/AtRiskTable'
import { InsightAlertStrip } from '../components/InsightAlertStrip'
import { ChatPanel } from '../components/ChatPanel'
import { LoadingPanel } from '../components/LoadingPanel'
import { readPageMemory, writePageMemory } from '../utils/pageMemory'

type InsightSnapshot = {
  flag: string
  dist: RiskDistributionRow[]
  patients: AtRiskPatient[]
  alerts: InsightAlert[]
}
const INSIGHTS_MEMORY_KEY = 'insights'

export function InsightsPage() {
  const restored = readPageMemory<InsightSnapshot>(INSIGHTS_MEMORY_KEY)
  const [dist, setDist] = useState<RiskDistributionRow[]>(() => restored?.dist ?? [])
  const [patients, setPatients] = useState<AtRiskPatient[]>(() => restored?.patients ?? [])
  const [alerts, setAlerts] = useState<InsightAlert[]>(() => restored?.alerts ?? [])
  const [flag, setFlag] = useState(() => restored?.flag ?? 'gap_in_care')
  const [loading, setLoading] = useState(() => !restored)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()
  const restoredInitialView = useRef(Boolean(restored))

  useEffect(() => {
    writePageMemory(INSIGHTS_MEMORY_KEY, { flag, dist, patients, alerts })
  }, [flag, dist, patients, alerts])

  useEffect(() => {
    if (restoredInitialView.current) {
      restoredInitialView.current = false
      return
    }
    void (async () => {
      if (!patients.length) setLoading(true)
      setError(null)
      try {
        const [d, p, a] = await Promise.all([getDistribution(), listAtRisk({ risk_flag: flag, limit: 10 }), listInsightAlerts({ open: true })])
        setDist(d.distribution); setPatients(p.patients); setAlerts(a)
      } catch (err) { setError(err instanceof Error ? err.message : 'Insights are unavailable.') }
      finally { setLoading(false) }
    })()
  }, [flag])

  return (
    <div className="stack">
      <h1 style={{ margin: 0, fontFamily: 'var(--sc-font-display)' }}>Insights</h1>
      {error ? <div className="panel continuity-page__error">{error}</div> : null}
      {loading && !patients.length ? <LoadingPanel label="Loading operational insights…" /> : null}
      <RiskDistribution rows={dist} />
      <label className="row">
        <span className="muted">Filter</span>
        <select
          value={flag}
          onChange={(e) => setFlag(e.target.value)}
          style={{ width: 'auto' }}
          aria-label="Risk flag filter"
        >
          <option value="gap_in_care">Care gaps</option>
          <option value="high_utilizer">High utilizers</option>
          <option value="polypharmacy">Polypharmacy</option>
          <option value="chronic_burden">Chronic burden</option>
        </select>
      </label>
      <AtRiskTable patients={patients} onOpen={(id) => nav(`/patient/${id}`)} />
      <InsightAlertStrip
        alerts={alerts}
        onDismiss={(id) => {
          void dismissInsightAlert(id).then(() => {
            setAlerts((rows) => rows.map((a) => (a.alert_id === id ? { ...a, dismissed: true } : a)))
          }).catch((err) => setError(err instanceof Error ? err.message : 'Unable to dismiss this insight.'))
        }}
      />
      <ChatPanel />
    </div>
  )
}
