import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  dismissInsightAlert,
  getDistribution,
  listAtRisk,
  listInsightAlerts,
} from '../api/insights'
import type { AtRiskPatient, InsightAlert, RiskDistributionRow } from '../api/types'
import { AtRiskTable } from '../components/AtRiskTable'
import { InsightAlertStrip } from '../components/InsightAlertStrip'
import { LoadingPanel } from '../components/LoadingPanel'
import { CareSignalsDashboard, buildCareSignals } from '../components/CareSignalsDashboard'
import { getContinuityHistory } from '../api/continuity'
import { readPageMemory, writePageMemory } from '../utils/pageMemory'

type InsightSnapshot = {
  flag: string
  dist: RiskDistributionRow[]
  patients: AtRiskPatient[]
  alerts: InsightAlert[]
  completedToday: number
}
const INSIGHTS_MEMORY_KEY = 'insights'

const queueActionByFlag: Record<string, string> = {
  gap_in_care: 'CONTACT_FOR_FOLLOW_UP',
  high_utilizer: 'REVIEW_WITH_CARE_TEAM',
  polypharmacy: 'REVIEW_WITH_CARE_TEAM',
  chronic_burden: 'REVIEW_WITH_CARE_TEAM',
}

export function InsightsPage() {
  const restored = readPageMemory<InsightSnapshot>(INSIGHTS_MEMORY_KEY)
  const [dist, setDist] = useState<RiskDistributionRow[]>(() => restored?.dist ?? [])
  const [patients, setPatients] = useState<AtRiskPatient[]>(() => restored?.patients ?? [])
  const [alerts, setAlerts] = useState<InsightAlert[]>(() => restored?.alerts ?? [])
  const [flag, setFlag] = useState(() => restored?.flag ?? 'gap_in_care')
  const [completedToday, setCompletedToday] = useState(() => restored?.completedToday ?? 0)
  const [loading, setLoading] = useState(() => !restored)
  const [signalsLoading, setSignalsLoading] = useState(() => !restored)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()
  const restoredInitialView = useRef(Boolean(restored))
  const restoredInitialPatients = useRef(Boolean(restored))

  useEffect(() => {
    writePageMemory(INSIGHTS_MEMORY_KEY, { flag, dist, patients, alerts, completedToday })
  }, [flag, dist, patients, alerts, completedToday])

  useEffect(() => {
    if (restoredInitialView.current) {
      restoredInitialView.current = false
      return
    }
    void (async () => {
      setError(null)
      try {
        const [d, a, h] = await Promise.all([
          getDistribution(),
          listInsightAlerts({ open: true }),
          getContinuityHistory(),
        ])
        setDist(d.distribution); setAlerts(a)
        const today = new Date().toDateString()
        setCompletedToday(h.events.filter((event) => event.event_type === 'COMPLETED' && new Date(event.created_at).toDateString() === today).length)
      } catch (err) { setError(err instanceof Error ? err.message : 'Insights are unavailable.') }
      finally { setSignalsLoading(false) }
    })()
  }, [])

  useEffect(() => {
    if (restoredInitialPatients.current) {
      restoredInitialPatients.current = false
      return
    }
    void (async () => {
      setPatients([])
      setLoading(true)
      setError(null)
      try {
        const result = await listAtRisk({ risk_flag: flag, limit: 10 })
        setPatients(result.patients)
      } catch (err) { setError(err instanceof Error ? err.message : 'Affected patient group is unavailable.') }
      finally { setLoading(false) }
    })()
  }, [flag])

  const selectedSignal = buildCareSignals(dist).find((signal) => signal.flag === flag)

  return (
    <div className="stack">
      <div className="care-signals__intro">
        <p className="eyebrow">Team overview</p>
        <h1>Care Dashboard</h1>
        <p className="muted">See the patterns affecting patient continuity, choose a focus area, and move into today’s individual work only when you are ready to act.</p>
      </div>
      {error ? <div className="panel continuity-page__error">{error}</div> : null}
      {signalsLoading ? <LoadingPanel label="Loading care dashboard…" /> : <CareSignalsDashboard
          rows={dist}
          selectedFlag={flag}
          openAlertCount={alerts.filter((alert) => !alert.dismissed).length}
          completedToday={completedToday}
          onSelectFlag={setFlag}
          onOpenQueue={(nextFlag) => nav(`/?action=${queueActionByFlag[nextFlag]}`)}
        />}
      <div className="care-signals__lower-grid">
        {loading ? <LoadingPanel label="Loading affected patient group…" /> : <AtRiskTable
          patients={patients}
          onOpen={(id) => nav(`/patient/${id}`)}
          title={selectedSignal ? `Affected patients · ${selectedSignal.title}` : 'Affected patients'}
          description="This is a patient group for review—not a list of actions to complete."
        />}
        {signalsLoading ? <LoadingPanel label="Loading new operational signals…" /> : <InsightAlertStrip
          alerts={alerts}
          title="New operational signals"
          onDismiss={(id) => {
            void dismissInsightAlert(id).then(() => {
              setAlerts((rows) => rows.map((a) => (a.alert_id === id ? { ...a, dismissed: true } : a)))
            }).catch((err) => setError(err instanceof Error ? err.message : 'Unable to acknowledge this signal.'))
          }}
        />}
      </div>
    </div>
  )
}
