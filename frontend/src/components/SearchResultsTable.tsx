import type { PatientMatch } from '../api/types'
import { displayPatientName } from '../utils/displayPatientName'
import { formatOperationalLabel } from '../utils/formatOperationalLabel'

function displayName(p: PatientMatch) {
  return displayPatientName(p.display_first_name ?? p.first_name, p.display_last_name ?? p.last_name)
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
          <th scope="col">Location</th>
          <th scope="col">Matched on</th>
          <th scope="col">Last visit</th>
          <th scope="col">Age</th>
        </tr>
      </thead>
      <tbody>
            {matches.map((p) => (
          <tr key={p.patient_id} onClick={() => onSelect(p)}>
                <td>{displayName(p)}</td>
                <td>{[p.city, p.state].filter(Boolean).join(', ') || '—'}</td>
                <td>{formatOperationalLabel(p.matched_on) || '—'}</td>
                <td>{p.last_visit_date ?? '—'}</td>
            <td>{p.age_years ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
