import type { DiagnosticOutcome } from '../../api/types'
import { OUTCOMES_TITLE } from '../../api/types'
import { formatOperationalLabel } from '../../utils/formatOperationalLabel'

export function DiagnosticOutcomesPanel({
  outcomes,
}: {
  outcomes: DiagnosticOutcome[]
}) {
  const rows = outcomes.filter((o) => o.status === 'active').slice(0, 5)

  return (
    <section className="panel stack">
      <div>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{OUTCOMES_TITLE}</h2>
      </div>
      {!rows.length ? (
        <p className="empty">Nothing on file.</p>
      ) : (
        rows.map((o) => (
          <div key={o.condition_id} className="list-row">
            <div>
              <strong>{o.display_name}</strong>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {formatOperationalLabel(o.status)}
              </div>
            </div>
          </div>
        ))
      )}
    </section>
  )
}
