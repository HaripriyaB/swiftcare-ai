import type { RiskDistributionRow } from '../api/types'
import { PLAIN_RISK_LABELS } from '../api/types'

export function RiskDistribution({ rows }: { rows: RiskDistributionRow[] }) {
  const top = [...rows]
    .sort((a, b) => b.patient_count - a.patient_count)
    .slice(0, 3)
  const high = rows
    .filter((r) => r.risk_level === 'HIGH')
    .reduce((n, r) => n + r.patient_count, 0)
  const lead = top[0]

  return (
    <section className="panel">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Risk snapshot</h2>
      <p style={{ marginBottom: '0.75rem' }}>
        {lead
          ? `Most common: ${PLAIN_RISK_LABELS[lead.risk_flag] ?? lead.risk_flag} (${lead.patient_count}). High severity: ${high}.`
          : 'No risk distribution loaded.'}
      </p>
      <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {top.map((r) => (
          <li key={`${r.risk_flag}-${r.risk_level}`} className="row">
            <span style={{ minWidth: 180 }}>
              {PLAIN_RISK_LABELS[r.risk_flag] ?? r.risk_flag}
            </span>
            <span className={`chip ${r.risk_level}`}>{r.risk_level}</span>
            <span className="muted">{r.patient_count}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
