import type { Vitals } from '../../api/types'

export function VitalsPanel({ vitals }: { vitals: Vitals | null }) {
  if (!vitals) return (
    <section className="panel">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Vitals</h2>
      <p className="empty">Nothing on file.</p>
    </section>
  )
  return (
    <section className="panel">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Vitals</h2>
      <p style={{ margin: 0 }}>
        BP {vitals.systolic_bp}/{vitals.diastolic_bp} · HR {vitals.heart_rate}
      </p>
      <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
        {vitals.latest_observation_date}
      </p>
    </section>
  )
}
