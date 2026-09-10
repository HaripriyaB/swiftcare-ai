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

const TREND_SHAPES = [
  [0.3, 0.5, 0.25, 0.76, 0.52, 1],
  [0.5, 0.28, 0.65, 0.38, 0.78, 0.58],
  [0.25, 0.7, 0.46, 0.92, 0.7, 1],
  [0.4, 0.25, 0.7, 0.5, 0.95, 0.72],
]

function metricTrend(value: number, tone: number) {
  const xs = [2, 15, 28, 41, 54, 70]
  if (value <= 0) return { points: xs.map((x) => `${x},21`).join(' '), lastY: 21 }
  const amplitude = Math.min(13, 3.5 + Math.log10(value + 1) * 2.7)
  const points = TREND_SHAPES[tone].map((shape, index) => `${xs[index]},${(23 - shape * amplitude).toFixed(1)}`)
  return { points: points.join(' '), lastY: 23 - TREND_SHAPES[tone][5] * amplitude }
}

function MetricTrend({ tone, value }: { tone: number; value: number }) {
  const trend = metricTrend(value, tone)
  return (
    <svg className={`care-signals__trend tone-${tone}`} viewBox="0 0 72 30" aria-hidden="true" focusable="false">
      <path d="M2 27H70" className="care-signals__trend-baseline" />
      <polyline points={trend.points} className="care-signals__trend-line" />
      <circle cx="70" cy={trend.lastY} r="2.5" className="care-signals__trend-dot" />
    </svg>
  )
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
          <div><strong>{affectedCount}</strong><span>Affected patient records</span></div>
          <MetricTrend tone={0} value={affectedCount} />
        </div>
        <div className="care-signals__metric attention">
          <div><strong>{highCount}</strong><span>Higher-priority patterns</span></div>
          <MetricTrend tone={1} value={highCount} />
        </div>
        <div className="care-signals__metric info">
          <div><strong>{openAlertCount}</strong><span>New signals to acknowledge</span></div>
          <MetricTrend tone={2} value={openAlertCount} />
        </div>
        <div className="care-signals__metric success">
          <div><strong>{completedToday}</strong><span>Outcomes recorded today</span></div>
          <MetricTrend tone={3} value={completedToday} />
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
