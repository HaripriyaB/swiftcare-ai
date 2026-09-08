export function LoadingPanel({ label = 'Loading the latest information…' }: { label?: string }) {
  return (
    <div className="panel inline-loader" role="status" aria-live="polite">
      <span className="inline-loader__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
