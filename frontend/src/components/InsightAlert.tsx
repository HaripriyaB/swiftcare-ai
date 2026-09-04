import { useState } from 'react'
import type { InsightAlert } from '../api/types'
import { PLAIN_RISK_LABELS } from '../api/types'

export function InsightAlertRow({
  alert,
  onDismiss,
}: {
  alert: InsightAlert
  onDismiss: (id: string) => void
}) {
  const label = PLAIN_RISK_LABELS[alert.alert_type] ?? alert.alert_type
  const oneLine =
    alert.message.length > 110 ? `${alert.message.slice(0, 110)}…` : alert.message

  return (
    <div className="list-row">
      <div>
        <div className="row" style={{ marginBottom: 4 }}>
          <strong>{label}</strong>
          <span className={`chip ${alert.severity}`}>{alert.severity}</span>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          {oneLine}
        </p>
      </div>
      <button type="button" aria-label={`Dismiss insight ${label}`} onClick={() => onDismiss(alert.alert_id)}>
        Dismiss
      </button>
    </div>
  )
}

export function InsightAlertStrip({
  alerts,
  onDismiss,
}: {
  alerts: InsightAlert[]
  onDismiss: (id: string) => void
}) {
  const open = alerts.filter((a) => !a.dismissed)
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? open : open.slice(0, 3)

  return (
    <section className="panel stack">
      <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Insights</h2>
      {!shown.length ? (
        <p className="empty">No open insight alerts.</p>
      ) : (
        shown.map((a) => (
          <InsightAlertRow key={a.alert_id} alert={a} onDismiss={onDismiss} />
        ))
      )}
      {open.length > 3 && !showAll ? (
        <button type="button" className="ghost" onClick={() => setShowAll(true)}>
          Show more
        </button>
      ) : null}
    </section>
  )
}
