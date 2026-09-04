import type { Medication } from '../../api/types'

export function MedicationsPanel({ items }: { items: Medication[] }) {
  const rows = items.slice(0, 5)
  return (
    <section className="panel">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Medications</h2>
      {!rows.length ? (
        <p className="empty">Nothing on file.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {rows.map((m) => (
            <li key={m.medication_id}>{m.medication_name}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
