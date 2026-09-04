import { useEffect, useState } from 'react'
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

export function InsightsPage() {
  const [dist, setDist] = useState<RiskDistributionRow[]>([])
  const [patients, setPatients] = useState<AtRiskPatient[]>([])
  const [alerts, setAlerts] = useState<InsightAlert[]>([])
  const [flag, setFlag] = useState('gap_in_care')
  const nav = useNavigate()

  useEffect(() => {
    void (async () => {
      const [d, p, a] = await Promise.all([
        getDistribution(),
        listAtRisk({ risk_flag: flag, limit: 10 }),
        listInsightAlerts({ open: true }),
      ])
      setDist(d.distribution)
      setPatients(p.patients)
      setAlerts(a)
    })()
  }, [flag])

  return (
    <div className="stack">
      <h1 style={{ margin: 0, fontFamily: 'var(--sc-font-display)' }}>Insights</h1>
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
            setAlerts((rows) =>
              rows.map((a) => (a.alert_id === id ? { ...a, dismissed: true } : a)),
            )
          })
        }}
      />
      <ChatPanel />
    </div>
  )
}
