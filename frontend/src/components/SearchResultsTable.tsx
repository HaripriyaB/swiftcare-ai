import type { PatientMatch } from '../api/types'

function displayName(p: PatientMatch) {
  return `${p.display_first_name ?? p.first_name ?? ''} ${p.display_last_name ?? p.last_name ?? ''}`.trim()
}

export function SearchResultsTable({
  matches,
  onSelect,
}: {
  matches: PatientMatch[]
  onSelect: (p: PatientMatch) => void
}) {
  if (!matches.length) {
    return <p className="empty">No matches — try another name.</p>
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Last visit</th>
          <th scope="col">Age</th>
        </tr>
      </thead>
      <tbody>
        {matches.map((p) => (
          <tr key={p.patient_id} onClick={() => onSelect(p)}>
            <td>{displayName(p)}</td>
            <td>{p.last_visit_date ?? '—'}</td>
            <td>{p.age_years ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
