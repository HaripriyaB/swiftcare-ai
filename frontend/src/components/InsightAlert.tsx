import { useEffect, useState } from 'react'
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
          <span title={oneLine !== alert.message ? alert.message : undefined}>{oneLine}</span>
        </p>
      </div>
      <button
        type="button"
        className="ghost insight-alert__acknowledge"
        aria-label={`Acknowledge signal ${label}`}
        onClick={() => onDismiss(alert.alert_id)}
      >
        Acknowledge
      </button>
    </div>
  )
}

export function InsightAlertStrip({
  alerts,
  onDismiss,
  title = 'New signals',
}: {
  alerts: InsightAlert[]
  onDismiss: (id: string) => void
  title?: string
}) {
  const open = alerts.filter((a) => !a.dismissed)
  const pageSize = 4
  const totalPages = Math.max(1, Math.ceil(open.length / pageSize))
  const [page, setPage] = useState(0)
  const shown = open.slice(page * pageSize, (page + 1) * pageSize)

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1))
  }, [totalPages])

  return (
    <section className="panel stack">
      <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h2>
      {!shown.length ? (
        <p className="empty">No new signals to acknowledge.</p>
      ) : (
        <div className="insight-alert__scroll" tabIndex={0} aria-label="Operational signals">
          {shown.map((a) => (
            <InsightAlertRow key={a.alert_id} alert={a} onDismiss={onDismiss} />
          ))}
        </div>
      )}
      {totalPages > 1 ? <nav className="queue-pagination insight-alert__pagination" aria-label="Operational signal pages">
        <button type="button" className="ghost" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</button>
        <span>Page {page + 1} of {totalPages}</span>
        <button type="button" className="ghost" disabled={page === totalPages - 1} onClick={() => setPage((current) => current + 1)}>Next</button>
      </nav> : null}
    </section>
  )
}
