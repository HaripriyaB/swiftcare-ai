export function DemoBanner() {
  if (import.meta.env.VITE_DEMO_BANNER !== 'true') return null
  return (
    <div
      className="muted"
      style={{
        background: 'var(--sc-accent-soft)',
        padding: '0.45rem 1rem',
        fontSize: '0.85rem',
        borderBottom: '1px solid var(--sc-border)',
      }}
    >
      Demo mode — synthetic Synthea data only.
    </div>
  )
}
