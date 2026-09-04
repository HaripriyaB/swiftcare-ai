import type { TimelineEvent } from '../../api/types'

export function TimelinePanel({ items }: { items: TimelineEvent[] }) {
  const rows = items.slice(0, 8)
  return (
    <section className="panel">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Timeline</h2>
      {!rows.length ? (
        <p className="empty">Nothing on file.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {rows.map((t, i) => (
            <li key={`${t.event_date}-${i}`}>
              {t.event_date} — {t.event_label}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
