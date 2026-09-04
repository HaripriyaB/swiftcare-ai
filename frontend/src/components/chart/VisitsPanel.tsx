import type { Visit } from '../../api/types'

export function VisitsPanel({ items }: { items: Visit[] }) {
  const rows = items.slice(0, 5)
  return (
    <section className="panel">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Visits</h2>
      {!rows.length ? (
        <p className="empty">Nothing on file.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {rows.map((v) => (
            <li key={v.encounter_id}>
              {v.visit_date} — {v.visit_type ?? 'Visit'}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
