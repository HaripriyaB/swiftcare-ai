import { Link } from 'react-router-dom'
import type { ContinuityCard as Card } from '../api/types'

export function ContinuityCard({ card }: { card: Card }) {
  return (
    <article className="continuity-card">
      <div className="continuity-card__top">
        <span className={`chip ${card.priority}`}>{card.priority} priority</span>
        <span className="muted">Patient continuity</span>
      </div>
      <h2>{card.patient_name}</h2>
      <p className="continuity-card__action">{card.action_label}</p>
      <p className="muted">{card.why_now}</p>
      <ul className="continuity-card__evidence" aria-label="Evidence">
        {card.evidence.slice(0, 2).map((item) => (
          <li key={`${item.label}-${item.value}`}>
            <strong>{item.label}:</strong> {item.value}
          </li>
        ))}
      </ul>
      <Link className="primary continuity-card__button" to={`/continuity/${card.card_id}`}>
        Review action
      </Link>
    </article>
  )
}
