import type { PatientSummary } from '../../api/types'

export function SummaryPanel({ summary }: { summary: PatientSummary | null }) {
  if (!summary) return <p className="empty">Nothing on file.</p>
  const name = `${summary.display_first_name ?? ''} ${summary.display_last_name ?? ''}`.trim()
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'var(--sc-font-display)' }}>
          {name || 'Patient'}
        </h1>
        <p className="muted" style={{ margin: '0.25rem 0 0' }}>
          Age {summary.age_years ?? '—'} · Last visit {summary.last_visit_date ?? '—'}
        </p>
      </div>
    </div>
  )
}
