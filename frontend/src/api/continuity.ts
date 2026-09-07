import { apiFetch } from './client'
import type { ContinuityCard, ContinuityQueueResponse } from './types'

export function getContinuityQueue(priority?: string) {
  const query = new URLSearchParams({ status: 'OPEN', limit: '8' })
  if (priority) query.set('priority', priority)
  return apiFetch<ContinuityQueueResponse>(`/continuity/queue?${query}`)
}

export function startContinuityCard(cardId: string) {
  return apiFetch<ContinuityCard>(`/continuity/cards/${cardId}/start`, { method: 'POST' })
}

export function getContinuityCard(cardId: string) {
  return apiFetch<ContinuityCard>(`/continuity/cards/${cardId}`)
}

export function completeContinuityCard(cardId: string, outcome: string, note?: string) {
  return apiFetch<ContinuityCard>(`/continuity/cards/${cardId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ outcome, note: note || undefined }),
  })
}
