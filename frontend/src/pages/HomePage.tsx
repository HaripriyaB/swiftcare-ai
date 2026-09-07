import { useEffect, useMemo, useState } from 'react'
import { getContinuityQueue } from '../api/continuity'
import type { ContinuityCard } from '../api/types'
import { ContinuityCard as ContinuityCardView } from '../components/ContinuityCard'
import { useAuth } from '../auth/useAuth'

export function HomePage() {
  const [cards, setCards] = useState<ContinuityCard[]>([])
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const firstName = user?.email?.split('@')[0] ?? 'team'

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await getContinuityQueue(filter || undefined)
        if (active) setCards(res.cards)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load the attention queue.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [filter])

  const counts = useMemo(() => ({
    HIGH: cards.filter((card) => card.priority === 'HIGH').length,
    MEDIUM: cards.filter((card) => card.priority === 'MEDIUM').length,
    LOW: cards.filter((card) => card.priority === 'LOW').length,
  }), [cards])

  return (
    <div className="stack continuity-page">
      <div className="continuity-page__intro">
        <p className="eyebrow">Today · Patient continuity</p>
        <h1>Good morning, {firstName}.</h1>
        <p className="muted">Start with the patient who needs attention. Review the evidence, then decide the next operational step.</p>
      </div>
      <div className="continuity-page__summary" aria-label="Queue summary">
        <button className={`chip HIGH ${filter === 'HIGH' ? 'selected' : ''}`} onClick={() => setFilter(filter === 'HIGH' ? '' : 'HIGH')}>{counts.HIGH} High priority</button>
        <button className={`chip MEDIUM ${filter === 'MEDIUM' ? 'selected' : ''}`} onClick={() => setFilter(filter === 'MEDIUM' ? '' : 'MEDIUM')}>{counts.MEDIUM} Medium priority</button>
        <button className={`chip LOW ${filter === 'LOW' ? 'selected' : ''}`} onClick={() => setFilter(filter === 'LOW' ? '' : 'LOW')}>{counts.LOW} Low priority</button>
      </div>
      <div className="continuity-page__heading">
        <div><h2>Attention queue</h2><p className="muted">Operational support only · synthetic demo data</p></div>
        {filter ? <button className="ghost" onClick={() => setFilter('')}>Clear filter</button> : null}
      </div>
      {loading ? <div className="panel">Loading continuity queue…</div> : null}
      {error ? <div className="panel continuity-page__error"><strong>Queue unavailable</strong><p>{error}</p></div> : null}
      {!loading && !error && cards.length === 0 ? <div className="panel"><strong>No patients need attention in this view.</strong><p className="muted">Try clearing the filter or use Patient search for a specific chart.</p></div> : null}
      <div className="continuity-page__grid">
        {cards.map((card) => <ContinuityCardView key={card.card_id} card={card} />)}
      </div>
    </div>
  )
}
