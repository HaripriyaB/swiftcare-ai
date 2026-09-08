import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { clearAttentionQueueCache, getAttentionQueue } from '../api/continuity'
import type { ContinuityCard, ContinuitySummary } from '../api/types'
import { ContinuityCard as ContinuityCardView } from '../components/ContinuityCard'
import { useAuth } from '../auth/useAuth'
import { LoadingPanel } from '../components/LoadingPanel'
import { readPageMemory, writePageMemory } from '../utils/pageMemory'

type QueueView = { cards: ContinuityCard[]; summary: ContinuitySummary }
type HomeSnapshot = { filter: string; views: Record<string, QueueView> }
const HOME_MEMORY_KEY = 'home'

const actionLabels: Record<string, string> = {
  CONTACT_FOR_FOLLOW_UP: 'Follow-up actions',
  REVIEW_WITH_CARE_TEAM: 'Care-team review actions',
}

export function HomePage() {
  const restored = readPageMemory<HomeSnapshot>(HOME_MEMORY_KEY)
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState<string>(() => restored?.filter ?? '')
  const actionType = searchParams.get('action') ?? ''
  const [views, setViews] = useState<Record<string, QueueView>>(() => restored?.views ?? {})
  const [loading, setLoading] = useState(() => !restored?.views[restored.filter || 'all'])
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
  const viewKey = `${filter || 'all'}:${actionType || 'all'}`
  const activeView = views[viewKey]
  const cards = activeView?.cards ?? []
  const summary = activeView?.summary ?? views.all?.summary ?? { HIGH: 0, MEDIUM: 0, LOW: 0 }

  useEffect(() => {
    writePageMemory(HOME_MEMORY_KEY, { filter, views })
  }, [filter, views])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!views[viewKey]) setLoading(true)
      setError(null)
      try {
        const snapshot = await getAttentionQueue(filter || undefined, actionType || undefined)
        if (active) setViews((current) => ({ ...current, [viewKey]: snapshot }))
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load the attention queue.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [actionType, filter, viewKey])

  useEffect(() => {
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('swiftcare-continuity')
    channel?.addEventListener('message', () => { clearAttentionQueueCache() })
    const refresh = () => { void getAttentionQueue(filter || undefined, actionType || undefined, true).then((snapshot) => { setViews((current) => ({ ...current, [viewKey]: snapshot })) }).catch(() => undefined) }
    const timer = window.setInterval(refresh, 30_000)
    return () => { window.clearInterval(timer); channel?.close() }
  }, [actionType, filter, viewKey])

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
        <button className={`chip HIGH ${filter === 'HIGH' ? 'selected' : ''}`} onClick={() => setFilter(filter === 'HIGH' ? '' : 'HIGH')}>{summary.HIGH} High priority</button>
        <button className={`chip MEDIUM ${filter === 'MEDIUM' ? 'selected' : ''}`} onClick={() => setFilter(filter === 'MEDIUM' ? '' : 'MEDIUM')}>{summary.MEDIUM} Medium priority</button>
        <button className={`chip LOW ${filter === 'LOW' ? 'selected' : ''}`} onClick={() => setFilter(filter === 'LOW' ? '' : 'LOW')}>{summary.LOW} Low priority</button>
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
    </div>
  )
}
