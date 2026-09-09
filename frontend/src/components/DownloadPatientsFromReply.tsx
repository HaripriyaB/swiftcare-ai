import type { ChatPatientRow } from '../api/types'
import { downloadBlob, stamp } from '../utils/download'
import { cleanNamePart } from '../utils/displayPatientName'
import { toCsv } from '../utils/toCsv'

export function DownloadPatientsFromReply({
  patients,
}: {
  patients: ChatPatientRow[]
}) {
  if (!patients.length) return null

  const run = () => {
    const rows = patients.map((p) => ({
      ...p,
      display_first_name: cleanNamePart(p.display_first_name),
      display_last_name: cleanNamePart(p.display_last_name),
    }))
    downloadBlob(
      `swiftcare-ai-patients-${stamp()}.csv`,
      new Blob([toCsv(rows)], { type: 'text/csv' }),
    )
  }

  return (
    <div className="row" style={{ marginTop: '0.5rem' }}>
      <button
        type="button"
        aria-label={`Download ${patients.length} patients as CSV`}
        onClick={run}
      >
        Download CSV ({patients.length})
      </button>
    </div>
  )
}
