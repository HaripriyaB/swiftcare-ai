import type { RiskDistributionRow } from '../api/types'

export type CareSignal = {
  flag: string
  title: string
  description: string
  patientCount: number
  highCount: number
}

const SIGNAL_COPY: Record<string, Pick<CareSignal, 'title' | 'description'>> = {
  gap_in_care: {
    title: 'Follow-up windows missed',
    description: 'Patients whose expected visit or follow-up window has passed.',
  },
  high_utilizer: {
    title: 'Repeated recent visits',
    description: 'Patients with unusually frequent recent visits who may need coordination.',
  },
  polypharmacy: {
    title: 'Medication coordination needs review',
    description: 'Patients with multiple active medications for staff awareness.',
  },
  chronic_burden: {
    title: 'Multiple ongoing conditions',
    description: 'Patients with several documented ongoing conditions.',
  },
}

export function buildCareSignals(rows: RiskDistributionRow[]): CareSignal[] {
  return Object.entries(SIGNAL_COPY).map(([flag, copy]) => {
    const matching = rows.filter((row) => row.risk_flag === flag)
    return {
      flag,
      ...copy,
      patientCount: matching.reduce((total, row) => total + row.patient_count, 0),
      highCount: matching
        .filter((row) => row.risk_level === 'HIGH')
        .reduce((total, row) => total + row.patient_count, 0),
    }
  })
}

export function CareSignalsDashboard({
  rows,
  selectedFlag,
  openAlertCount,
  completedToday,
  onSelectFlag,
  onOpenQueue,
}: {
  rows: RiskDistributionRow[]
  selectedFlag: string
  openAlertCount: number
  completedToday: number
  onSelectFlag: (flag: string) => void
  onOpenQueue: (flag: string) => void
}) {
  const signals = buildCareSignals(rows)
  const affectedCount = signals.reduce((total, signal) => total + signal.patientCount, 0)
  const highCount = signals.reduce((total, signal) => total + signal.highCount, 0)

  return (
    <>
      <section className="care-signals__metrics" aria-label="Care dashboard summary">
        <div className="care-signals__metric">
          <strong>{affectedCount}</strong>
          <span>Affected patient records</span>
        </div>
        <div className="care-signals__metric attention">
          <strong>{highCount}</strong>
          <span>Higher-priority patterns</span>
        </div>
        <div className="care-signals__metric info">
          <strong>{openAlertCount}</strong>
          <span>New signals to acknowledge</span>
        </div>
        <div className="care-signals__metric success">
          <strong>{completedToday}</strong>
          <span>Outcomes recorded today</span>
        </div>
      </section>

      <section className="care-signals__patterns" aria-labelledby="care-patterns-heading">
        <div className="care-signals__section-heading">
          <div>
            <p className="eyebrow">Where to focus</p>
            <h2 id="care-patterns-heading">Current care patterns</h2>
          </div>
          <p className="muted">Choose a pattern to review the affected patient group, then open the related work already prioritized for today.</p>
        </div>
        <div className="care-signals__grid">
          {signals.map((signal) => (
            <article
              key={signal.flag}
              className={`care-signal ${selectedFlag === signal.flag ? 'selected' : ''}`}
            >
              <div className="care-signal__count">{signal.patientCount}</div>
              <div>
                <h3>{signal.title}</h3>
                <p>{signal.description}</p>
                {signal.highCount ? <span className="chip HIGH">{signal.highCount} higher priority</span> : <span className="chip LOW">No higher-priority records</span>}
              </div>
              <div className="care-signal__actions">
                <button type="button" className="text-action" onClick={() => onSelectFlag(signal.flag)}>
                  View affected patients
                </button>
                <button type="button" className="text-action" onClick={() => onOpenQueue(signal.flag)}>
                  Open today’s related work
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
