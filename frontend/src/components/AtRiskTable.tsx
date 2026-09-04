import type { AtRiskPatient, ExportFormat } from '../api/types'
import { PLAIN_RISK_LABELS } from '../api/types'
import { downloadBlob, stamp } from '../utils/download'
import { toCsv } from '../utils/toCsv'

export function AtRiskTable({
  patients,
  onOpen,
}: {
  patients: AtRiskPatient[]
  onOpen: (id: string) => void
}) {
  const download = (format: ExportFormat) => {
    const rows = patients.map((p) => ({
      patient_id: p.patient_id,
      display_first_name: p.display_first_name,
      display_last_name: p.display_last_name,
      risk_flag: p.risk_flag,
      risk_level: p.risk_level,
      days_since_last_visit: p.days_since_last_visit,
    }))
    if (format === 'json') {
      downloadBlob(
        `swiftcare-ai-patients-${stamp()}.json`,
        new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }),
      )
    } else {
      downloadBlob(
        `swiftcare-ai-patients-${stamp()}.csv`,
        new Blob([toCsv(rows)], { type: 'text/csv' }),
      )
    }
  }

  return (
    <section className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>At-risk patients</h2>
        {patients.length ? (
          <div className="row">
            <button type="button" aria-label="Download patients as JSON" onClick={() => download('json')}>
              Download patients ({patients.length}) JSON
            </button>
            <button type="button" aria-label="Download patients as CSV" onClick={() => download('csv')}>
              CSV
            </button>
          </div>
        ) : null}
      </div>
      {!patients.length ? (
        <p className="empty">No patients in this filter.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">What to review</th>
              <th scope="col">Level</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.patient_id} onClick={() => onOpen(p.patient_id)}>
                <td>
                  {p.display_first_name} {p.display_last_name}
                </td>
                <td>{PLAIN_RISK_LABELS[p.risk_flag] ?? p.risk_flag}</td>
                <td>
                  <span className={`chip ${p.risk_level}`}>{p.risk_level}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
