import { useState } from 'react'
import type { ChatPatientRow, ExportFormat } from '../api/types'
import { downloadBlob, stamp } from '../utils/download'
import { toCsv } from '../utils/toCsv'

export function DownloadPatientsFromReply({
  patients,
}: {
  patients: ChatPatientRow[]
}) {
  const [format, setFormat] = useState<ExportFormat>('csv')
  if (!patients.length) return null

  const run = () => {
    const rows = patients.map((p) => ({ ...p }))
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
    <div className="row" style={{ marginTop: '0.5rem' }}>
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as ExportFormat)}
        style={{ width: 'auto' }}
        aria-label="Download patients format"
      >
        <option value="csv">CSV</option>
        <option value="json">JSON</option>
      </select>
      <button
        type="button"
        aria-label={`Download patients ${patients.length}`}
        onClick={run}
      >
        Download patients ({patients.length})
      </button>
    </div>
  )
}
