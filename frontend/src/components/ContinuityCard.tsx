import { Link } from 'react-router-dom'
import type { ContinuityCard as Card } from '../api/types'
import { displayFullPatientName } from '../utils/displayPatientName'

export function ContinuityCard({ card }: { card: Card }) {
  return (
    <Link className={`continuity-card priority-${card.priority.toLowerCase()}`} to={`/continuity/${card.card_id}`} aria-label={`Review action for ${displayFullPatientName(card.patient_name)}`}>
      <div className="continuity-card__top">
        <span className={`chip ${card.priority}`}>{card.priority} priority</span>
        <span className="continuity-card__open">Review action →</span>
      </div>
      <h2>{displayFullPatientName(card.patient_name)}</h2>
      <p className="continuity-card__action">{card.action_label}</p>
      <p className="muted">{card.why_now}</p>
      <ul className="continuity-card__evidence" aria-label="Evidence">
        {card.evidence.slice(0, 2).map((item) => (
          <li key={`${item.label}-${item.value}`}>
            <strong>{item.label}:</strong> {item.value}
          </li>
        ))}
      </ul>
    </Link>
  )
}
