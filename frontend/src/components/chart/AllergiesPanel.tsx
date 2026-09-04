import type { Allergy } from '../../api/types'

export function AllergiesPanel({ items }: { items: Allergy[] }) {
  const rows = items.slice(0, 5)
  return (
    <section className="panel">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Allergies</h2>
      {!rows.length ? (
        <p className="empty">Nothing on file.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {rows.map((a) => (
            <li key={a.allergy_id} className="row">
              <span>{a.allergen}</span>
              {a.criticality === 'high' ? (
                <span className="chip attention">high</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
