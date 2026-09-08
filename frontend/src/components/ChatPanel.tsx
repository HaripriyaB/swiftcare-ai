import { useEffect, useState } from 'react'
import { sendChat } from '../api/chat'
import type { ChatPatientRow, ChatResponse } from '../api/types'
import { DownloadPatientsFromReply } from './DownloadPatientsFromReply'
import { readPageMemory, writePageMemory } from '../utils/pageMemory'

type Msg = {
  role: 'user' | 'assistant'
  text: string
  patients?: ChatPatientRow[]
}

function friendlyReply(text: string) {
  return text
    .replace(/\s*\(?\s*source\s*:\s*[^)\n]+\)?/gi, '')
    .replace(/\b(?:retrieval|orchestrator|insights|suggestion)\s+agent\b/gi, 'Swify')
    .trim()
}

export function ChatPanel({
  patientId,
  sessionId,
}: {
  patientId?: string | null
  sessionId?: string | null
}) {
  const cacheKey = `swify:${patientId ?? 'workspace'}:${sessionId ?? 'default'}`
  const restored = readPageMemory<{ open: boolean; input: string; msgs: Msg[] }>(cacheKey)
  const [open, setOpen] = useState(() => restored?.open ?? false)
  const [input, setInput] = useState(() => restored?.input ?? '')
  const [msgs, setMsgs] = useState<Msg[]>(() => restored?.msgs ?? [])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    writePageMemory(cacheKey, { open, input, msgs })
  }, [cacheKey, input, msgs, open])

  if (import.meta.env.VITE_ENABLE_CHAT !== 'true') return null

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || busy) return
    const message = input.trim()
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text: message }])
    setBusy(true)
    try {
      const res: ChatResponse = await sendChat({
        message,
        patient_id: patientId ?? null,
        session_id: sessionId ?? null,
      })
      setMsgs((m) => [
        ...m,
        {
          role: 'assistant',
          text: friendlyReply(res.reply),
          patients: res.patients ?? [],
        },
      ])
    } catch {
      setMsgs((m) => [
        ...m,
        { role: 'assistant', text: 'Swify could not send that message. Please check the connection and try again.' },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="swify-chat"
      style={{
        position: 'fixed',
        right: 16,
        width: open ? 340 : 'auto',
        zIndex: 20,
      }}
    >
      {!open ? (
        <button type="button" className="primary" onClick={() => setOpen(true)}>
          Ask Swify
        </button>
      ) : (
        <div className="panel stack" style={{ maxHeight: '70vh' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Swify — the AI assistant</strong>
            <button type="button" className="ghost swify-chat__close" onClick={() => setOpen(false)} aria-label="Close Swify">
              ×
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.75rem', margin: 0 }}>Grounded in the current patient record and operational data. Not for diagnosis or treatment.</p>
          <div className="stack" style={{ overflow: 'auto', maxHeight: 280 }}>
            {msgs.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  background:
                    m.role === 'user' ? 'var(--sc-accent-soft)' : 'var(--sc-surface-muted)',
                  padding: '0.5rem 0.65rem',
                  borderRadius: 8,
                }}
              >
                <div>{m.text}</div>
                {m.patients?.length ? (
                  <DownloadPatientsFromReply patients={m.patients} />
                ) : null}
              </div>
            ))}
          </div>
          <form className="row" onSubmit={(e) => void send(e)}>
            <input
              aria-label="Chat message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about follow-ups, medications, or recent visits…"
            />
            <button type="submit" className="primary" disabled={busy}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
