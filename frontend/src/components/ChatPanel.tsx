import { useState } from 'react'
import { sendChat } from '../api/chat'
import type { ChatPatientRow, ChatResponse } from '../api/types'
import { DownloadPatientsFromReply } from './DownloadPatientsFromReply'

type Msg = {
  role: 'user' | 'assistant'
  text: string
  agent_type?: string
  patients?: ChatPatientRow[]
}

export function ChatPanel({
  patientId,
  sessionId,
}: {
  patientId?: string | null
  sessionId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)

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
          text: res.reply,
          agent_type: res.agent_type,
          patients: res.patients ?? [],
        },
      ])
    } catch {
      setMsgs((m) => [
        ...m,
        { role: 'assistant', text: 'Something went wrong talking to the mock API.' },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        width: open ? 340 : 'auto',
        zIndex: 20,
      }}
    >
      {!open ? (
        <button type="button" className="primary" onClick={() => setOpen(true)}>
          Chat
        </button>
      ) : (
        <div className="panel stack" style={{ maxHeight: '70vh' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Chat</strong>
            <button type="button" className="ghost" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.75rem', margin: 0 }}>
            Demo replies until API is connected (Chunk 6)
          </p>
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
                {m.agent_type ? (
                  <div className="muted" style={{ fontSize: '0.7rem' }}>
                    {m.agent_type}
                  </div>
                ) : null}
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
              placeholder="Ask about care gaps, meds, vitals…"
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
