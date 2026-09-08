import { useEffect, useRef, useState } from 'react'
import { sendChat } from '../api/chat'
import type { ChatPatientRow, ChatResponse } from '../api/types'
import { DownloadPatientsFromReply } from './DownloadPatientsFromReply'
import { readPageMemory, writePageMemory } from '../utils/pageMemory'

type Msg = {
  role: 'user' | 'assistant'
  text: string
  patients?: ChatPatientRow[]
}

type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type SpeechRecognizer = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognizerConstructor = new () => SpeechRecognizer

export function formatSwifyReply(text: string) {
  return text
    .replace(/\s*\(?\s*source\s*:\s*[^)\n]+\)?/gi, '')
    .replace(/\b(?:retrieval|orchestrator|insights|suggestion)\s+agent\b/gi, 'Swify')
    .replace(/^\s*[-*]\s+/gmu, '• ')
    .replace(/\*\*(.+?)\*\*/gu, '$1')
    .replace(/`([^`]+)`/gu, '$1')
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
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognizer | null>(null)

  useEffect(() => {
    writePageMemory(cacheKey, { open, input, msgs })
  }, [cacheKey, input, msgs, open])

  useEffect(() => () => recognitionRef.current?.stop(), [])

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
          text: formatSwifyReply(res.reply),
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

  const toggleSpeech = () => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognizerConstructor
      webkitSpeechRecognition?: SpeechRecognizerConstructor
    }
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.lang = navigator.language || 'en-US'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) setInput((current) => `${current}${current ? ' ' : ''}${transcript}`)
    }
    recognition.onend = () => { setListening(false); recognitionRef.current = null }
    recognition.onerror = () => { setListening(false); recognitionRef.current = null }
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
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
          <form className="swify-chat__composer" onSubmit={(e) => void send(e)}>
            <input
              aria-label="Chat message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about follow-ups, medications, or recent visits…"
            />
            <div className="swify-chat__composer-actions">
              <button
                type="button"
                className={`swify-chat__icon-button ${listening ? 'is-listening' : ''}`}
                aria-label={listening ? 'Stop voice input' : 'Speak message'}
                title={listening ? 'Stop voice input' : 'Speak message'}
                onClick={toggleSpeech}
                disabled={busy || !(typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window))}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></svg>
              </button>
              <button type="submit" className="swify-chat__icon-button" aria-label="Send message" title="Send message" disabled={busy || !input.trim()}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m4 4 16 8-16 8 3-8-3-8Z" /><path d="M7 12h13" /></svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
