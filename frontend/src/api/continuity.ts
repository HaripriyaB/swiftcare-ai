import { apiFetch, clearApiCache } from './client'
import type { ContinuityCard, ContinuityHistoryEntry, ContinuityHistoryResponse, ContinuityQueueResponse, ContinuitySummary } from './types'

const CLIENT_CACHE_MS = 45_000
const queueCache = new Map<string, { loadedAt: number; value: ContinuityQueueResponse & { summary: ContinuitySummary } }>()

export function getContinuityQueue(priority?: string) {
  const query = new URLSearchParams({ status: 'OPEN', limit: '8' })
  if (priority) query.set('priority', priority)
  return apiFetch<ContinuityQueueResponse>(`/continuity/queue?${query}`)
}

export function getAttentionQueue(priority?: string, refresh = false) {
  const key = priority || 'all'
  const cached = queueCache.get(key)
  if (!refresh && cached && Date.now() - cached.loadedAt < CLIENT_CACHE_MS) return Promise.resolve(cached.value)
  const query = new URLSearchParams({ status: 'OPEN', limit: '8' })
  if (priority) query.set('priority', priority)
  return apiFetch<ContinuityQueueResponse & { summary: ContinuitySummary }>(`/continuity/queue?${query}`).then((value) => {
    queueCache.set(key, { loadedAt: Date.now(), value })
    return value
  })
}

export function invalidateAttentionQueue() {
  queueCache.clear()
  clearApiCache('/continuity/')
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('swiftcare-continuity')
    channel.postMessage('queue-changed')
    channel.close()
  }
}

export function clearAttentionQueueCache() { queueCache.clear() }

export function startContinuityCard(cardId: string) {
  return apiFetch<ContinuityCard>(`/continuity/cards/${cardId}/start`, { method: 'POST' }).then((card) => { invalidateAttentionQueue(); return card })
}

export function getContinuityCard(cardId: string) {
  return apiFetch<ContinuityCard>(`/continuity/cards/${cardId}`)
}

export function completeContinuityCard(cardId: string, outcome: string, note?: string) {
  return apiFetch<ContinuityCard>(`/continuity/cards/${cardId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ outcome, note: note || undefined }),
  }).then((card) => { invalidateAttentionQueue(); return card })
}

export function getContinuitySummary() {
  return apiFetch<ContinuitySummary>('/continuity/summary')
}

export function getContinuityHistory() {
  return apiFetch<ContinuityHistoryResponse>('/continuity/history?limit=50')
}

export function getContinuityHistoryEntry(eventId: string) {
  return apiFetch<ContinuityHistoryEntry>(`/continuity/history/${eventId}`)
}

export function updateContinuityHistoryEntry(eventId: string, outcome: string, note?: string) {
  return apiFetch<ContinuityHistoryEntry>(`/continuity/history/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify({ outcome, note: note || undefined }),
  }).then((entry) => { clearApiCache('/continuity/history'); return entry })
}
