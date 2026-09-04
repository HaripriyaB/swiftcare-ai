import { useState } from 'react'
import type { AdvisoryCard } from '../api/types'
import { DEFAULT_CARD_DISCLAIMER } from '../api/types'

export function AdvisoryCardRow({
  card,
  onDismiss,
}: {
  card: AdvisoryCard
  onDismiss: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const disclaimer = card.content.disclaimer || DEFAULT_CARD_DISCLAIMER

  return (
    <div className="list-row" style={{ borderLeft: '3px solid var(--sc-accent)', paddingLeft: '0.75rem' }}>
      <div style={{ flex: 1 }}>
        <div className="row" style={{ marginBottom: 4 }}>
          <strong>{card.content.title}</strong>
          <span className={`chip ${card.content.severity}`}>{card.content.severity}</span>
        </div>
        <p style={{ margin: 0 }}>
          {open ? card.content.body : `${card.content.body.slice(0, 90)}${card.content.body.length > 90 ? '…' : ''}`}
        </p>
        {open ? (
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
            {disclaimer}
          </p>
        ) : (
          <button type="button" className="ghost" style={{ padding: 0, border: 'none', marginTop: 4 }} onClick={() => setOpen(true)}>
            Show more
          </button>
        )}
      </div>
      <button type="button" aria-label={`Dismiss ${card.content.title}`} onClick={() => onDismiss(card.card_id)}>
        Dismiss
      </button>
    </div>
  )
}
