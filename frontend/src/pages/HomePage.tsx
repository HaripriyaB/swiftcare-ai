import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { clearAttentionQueueCache, getAttentionQueueBatch } from '../api/continuity'
import type { ContinuityCard, ContinuitySummary } from '../api/types'
import { ContinuityCard as ContinuityCardView } from '../components/ContinuityCard'
import { useAuth } from '../auth/useAuth'
import { LoadingPanel } from '../components/LoadingPanel'
import { readPageMemory, writePageMemory } from '../utils/pageMemory'

const PAGE_SIZE = 8
type QueueBatch = {
  cards: ContinuityCard[]
  summary: ContinuitySummary
  has_more?: boolean
  next_offset?: number | null
}
type HomeSnapshot = { filter: string; page: number; queue: QueueBatch | null }
const HOME_MEMORY_KEY = 'home:queue:v2'

const actionLabels: Record<string, string> = {
  CONTACT_FOR_FOLLOW_UP: 'Follow-up actions',
  REVIEW_WITH_CARE_TEAM: 'Care-team review actions',
}

export function HomePage() {
  const restored = readPageMemory<HomeSnapshot>(HOME_MEMORY_KEY)
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState<string>(() => restored?.filter ?? '')
  const actionType = searchParams.get('action') ?? ''
  const [page, setPage] = useState(() => restored?.page ?? 0)
  const [queue, setQueue] = useState<QueueBatch | null>(() => restored?.queue ?? null)
  const [loading, setLoading] = useState(() => !restored?.queue)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const displayName = user?.displayName?.trim().split(/\s+/u)[0]
    || user?.email?.split('@')[0]
    || 'team'
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
  const locallyFilteredCards = (queue?.cards ?? []).filter((card) =>
    (!filter || card.priority === filter) && (!actionType || card.action_type === actionType),
  )
  const cards = locallyFilteredCards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const summary = queue?.summary
  const summaryValue = (priority: keyof ContinuitySummary) => summary?.[priority] ?? '∼'
  const hasPreviousPage = page > 0
  const hasNextPage = locallyFilteredCards.length > (page + 1) * PAGE_SIZE || Boolean(queue?.has_more)

  useEffect(() => {
    writePageMemory(HOME_MEMORY_KEY, { filter, page, queue })
  }, [filter, page, queue])

  useEffect(() => {
    setPage(0)
  }, [filter, actionType])

  useEffect(() => {
    if (queue) return
    let active = true
    setLoading(true)
    setError(null)
    void getAttentionQueueBatch().then((snapshot) => {
      if (!active) return
      setQueue(snapshot)
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : 'Unable to load the attention queue.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [queue])

  const refreshFirstBatch = useCallback(async () => {
    try {
      const snapshot = await getAttentionQueueBatch(0, true)
      setQueue(snapshot)
      setPage(0)
      setError(null)
    } catch {
      // Keep the current working queue visible if a background refresh fails.
    }
  }, [])

  useEffect(() => {
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('swiftcare-continuity')
    const refresh = () => { void refreshFirstBatch() }
    channel?.addEventListener('message', () => { clearAttentionQueueCache(); refresh() })
    const timer = window.setInterval(refresh, 30_000)
    return () => { window.clearInterval(timer); channel?.close() }
  }, [refreshFirstBatch])

  const loadMore = async () => {
    if (!queue?.has_more || queue.next_offset === null || loadingMore) return
    setLoadingMore(true)
    try {
      const snapshot = await getAttentionQueueBatch(queue.next_offset)
      setQueue((current) => {
        if (!current) return snapshot
        const cardsById = new Map(current.cards.map((card) => [card.card_id, card]))
        snapshot.cards.forEach((card) => cardsById.set(card.card_id, card))
        return { ...snapshot, cards: [...cardsById.values()] }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load more queue items.')
    } finally {
      setLoadingMore(false)
    }
  }

  const nextPage = async () => {
    if (locallyFilteredCards.length > (page + 1) * PAGE_SIZE) {
      setPage((current) => current + 1)
      return
    }
    if (queue?.has_more) {
      await loadMore()
      setPage((current) => current + 1)
    }
  }

  const clearFilters = () => {
    setFilter('')
    setSearchParams({})
  }

  return (
    <div className="stack continuity-page">
      <div className="continuity-page__intro">
        <p className="eyebrow">Operations workspace · Today · {today}</p>
        <h1>Good morning, {displayName}.</h1>
        <p className="muted">Start with the patient who needs attention. Review the evidence, then decide the next operational step.</p>
      </div>
      <div className="continuity-page__summary" aria-label="Queue summary">
        <button className={`chip HIGH ${filter === 'HIGH' ? 'selected' : ''}`} onClick={() => setFilter(filter === 'HIGH' ? '' : 'HIGH')}>{summaryValue('HIGH')} High priority</button>
        <button className={`chip MEDIUM ${filter === 'MEDIUM' ? 'selected' : ''}`} onClick={() => setFilter(filter === 'MEDIUM' ? '' : 'MEDIUM')}>{summaryValue('MEDIUM')} Medium priority</button>
        <button className={`chip LOW ${filter === 'LOW' ? 'selected' : ''}`} onClick={() => setFilter(filter === 'LOW' ? '' : 'LOW')}>{summaryValue('LOW')} Low priority</button>
      </div>
      <div className="continuity-page__heading">
        <div><h2>Attention queue</h2><p className="muted">Prioritized operational work · synthetic demo data</p></div>
        <div className="row">
          {actionType ? <span className="chip info">{actionLabels[actionType] ?? 'Filtered actions'}</span> : null}
          {filter || actionType ? <button className="ghost" onClick={clearFilters}>Clear filter</button> : null}
        </div>
      </div>
      {loading && !cards.length ? <LoadingPanel label="Loading today’s attention queue…" /> : null}
      {error ? <div className="panel continuity-page__empty"><strong>All clear for now</strong><p className="muted">Nothing is waiting in the attention queue. Take a breath, stretch, or enjoy a quiet moment.</p></div> : null}
      {!loading && !error && cards.length === 0 ? <div className="panel continuity-page__empty"><strong>All clear for now</strong><p className="muted">Nothing is waiting in this view. Take a breath, stretch, or enjoy a quiet moment.</p></div> : null}
      <div className="continuity-page__grid">
        {cards.map((card) => <ContinuityCardView key={card.card_id} card={card} />)}
      </div>
      {(hasPreviousPage || hasNextPage) ? <nav className="queue-pagination" aria-label="Attention queue pages">
        <button type="button" className="ghost" disabled={!hasPreviousPage || loadingMore} onClick={() => setPage((current) => current - 1)}>Previous</button>
        <span>Page {page + 1}</span>
        <button type="button" className="ghost" disabled={!hasNextPage || loadingMore} onClick={() => void nextPage()}>{loadingMore ? 'Loading…' : 'Next'}</button>
      </nav> : null}
    </div>
  )
}
