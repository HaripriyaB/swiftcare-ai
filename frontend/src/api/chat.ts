import { apiFetch } from './client'
import type { ChatRequest, ChatResponse } from './types'

export function sendChat(body: ChatRequest) {
  return apiFetch<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
