import type { AtRiskPatient, ExportFormat } from '../api/types'
import { PLAIN_RISK_LABELS } from '../api/types'
import { downloadBlob, stamp } from '../utils/download'
import { cleanNamePart, displayPatientName } from '../utils/displayPatientName'
import { toCsv } from '../utils/toCsv'

export function AtRiskTable({
  patients,
  onOpen,
  page,
  hasNextPage,
  onPageChange,
  title = 'Affected patients',
  description,
}: {
  patients: AtRiskPatient[]
  onOpen: (id: string) => void
  page: number
  hasNextPage: boolean
  onPageChange: (page: number) => void
  title?: string
  description?: string
}) {
  const download = (format: ExportFormat) => {
    const rows = patients.map((p) => ({
      patient_id: p.patient_id,
      display_first_name: cleanNamePart(p.display_first_name),
      display_last_name: cleanNamePart(p.display_last_name),
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
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h2>
          {description ? <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.86rem' }}>{description}</p> : null}
        </div>
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
        <>
          <div className="at-risk-table__scroll" tabIndex={0} aria-label="Affected patient records">
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
                      {displayPatientName(p.display_first_name, p.display_last_name)}
                    </td>
                    <td>{PLAIN_RISK_LABELS[p.risk_flag] ?? p.risk_flag}</td>
                    <td>
                      <span className={`chip ${p.risk_level}`}>{p.risk_level}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(page > 0 || hasNextPage) ? <nav className="queue-pagination at-risk-table__pagination" aria-label="Affected patient pages">
            <button type="button" className="ghost" disabled={page === 0} onClick={() => onPageChange(page - 1)}>Previous</button>
            <span>Page {page + 1}</span>
            <button type="button" className="ghost" disabled={!hasNextPage} onClick={() => onPageChange(page + 1)}>Next</button>
          </nav> : null}
        </>
      )}
    </section>
  )
}
