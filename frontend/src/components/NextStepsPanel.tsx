import { useState } from 'react'
import type { AdvisoryCard } from '../api/types'
import { NEXT_STEPS_TITLE, DEFAULT_CARD_DISCLAIMER } from '../api/types'
import { AdvisoryCardRow } from './AdvisoryCard'

export function NextStepsPanel({
  cards,
  onDismiss,
}: {
  cards: AdvisoryCard[]
  onDismiss: (id: string) => void
}) {
  const visible = cards.filter((c) => !c.dismissed)
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? visible : visible.slice(0, 3)

  return (
    <section className="panel stack">
      <div>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{NEXT_STEPS_TITLE}</h2>
        <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
          {DEFAULT_CARD_DISCLAIMER}
        </p>
      </div>
      {!shown.length ? (
        <p className="empty">No open next steps.</p>
      ) : (
        shown.map((c) => (
          <AdvisoryCardRow key={c.card_id} card={c} onDismiss={onDismiss} />
        ))
      )}
      {visible.length > 3 && !showAll ? (
        <button type="button" className="ghost" onClick={() => setShowAll(true)}>
          Show more ({visible.length - 3})
        </button>
      ) : null}
    </section>
  )
}
