import type { DiagnosticOutcome } from '../../api/types'
import { OUTCOMES_TITLE, OUTCOMES_SUBTITLE } from '../../api/types'

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
        <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
          {OUTCOMES_SUBTITLE}
        </p>
      </div>
      {!rows.length ? (
        <p className="empty">Nothing on file.</p>
      ) : (
        rows.map((o) => (
          <div key={o.condition_id} className="list-row">
            <div>
              <strong>{o.display_name}</strong>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {o.status}
              </div>
            </div>
          </div>
        ))
      )}
    </section>
  )
}
