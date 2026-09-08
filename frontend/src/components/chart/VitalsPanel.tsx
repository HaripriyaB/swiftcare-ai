import type { Vitals } from '../../api/types'

export function VitalsPanel({ vitals, loading = false }: { vitals: Vitals | null; loading?: boolean }) {
  const metrics = vitals ? [
    ['Blood pressure', vitals.systolic_bp != null && vitals.diastolic_bp != null ? `${vitals.systolic_bp}/${vitals.diastolic_bp} mmHg` : null],
    ['Heart rate', vitals.heart_rate != null ? `${vitals.heart_rate} bpm` : null],
    ['Respiratory rate', vitals.respiratory_rate != null ? `${vitals.respiratory_rate} /min` : null],
    ['Weight', vitals.weight_kg != null ? `${vitals.weight_kg.toFixed(1)} kg` : null],
    ['Height', vitals.height_cm != null ? `${vitals.height_cm.toFixed(1)} cm` : null],
    ['BMI', vitals.bmi != null ? vitals.bmi.toFixed(1) : null],
  ].filter(([, value]) => value != null) : []

  if (loading) return (
    <section className="panel">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Vitals</h2>
      <div className="inline-loader" role="status" aria-live="polite">
        <span className="inline-loader__spinner" aria-hidden="true" />
        <span>Loading latest recorded vitals…</span>
      </div>
    </section>
  )
  if (!vitals || !metrics.length) return (
    <section className="panel">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Vitals</h2>
      <p className="empty">Nothing on file.</p>
    </section>
  )
  return (
    <section className="panel">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Vitals</h2>
      <div className="vitals-grid">
        {metrics.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
      </div>
      {vitals.latest_observation_date ? <p className="muted" style={{ margin: '0.7rem 0 0', fontSize: '0.85rem' }}>Recorded {vitals.latest_observation_date}</p> : null}
    </section>
  )
}
