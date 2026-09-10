import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { sendChat } from '../api/chat'
import type { ChatPatientRow, ChatResponse } from '../api/types'
import { DownloadPatientsFromReply } from './DownloadPatientsFromReply'
import { readPageMemory, writePageMemory } from '../utils/pageMemory'
import { displayPatientName } from '../utils/displayPatientName'

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
type SwifyMode = 'ask' | 'help' | 'learn'

function patientName(patient: ChatPatientRow) {
  return displayPatientName(patient.display_first_name, patient.display_last_name) || 'Patient'
}

function PatientChoices({
  patients,
  selectedPatientId,
  onSelect,
  onOpen,
}: {
  patients: ChatPatientRow[]
  selectedPatientId: string | null
  onSelect: (patient: ChatPatientRow) => void
  onOpen: (patientId: string) => void
}) {
  return (
    <section className="swify-patient-choices" aria-label="Matching patients">
      <div className="swify-patient-choices__heading"><strong>Matching patients</strong><span>{patients.length} found</span></div>
      <div className="swify-patient-choices__list">
        {patients.map((patient) => {
          const location = [patient.city, patient.state].filter(Boolean).join(', ')
          const details = [location, patient.last_visit_date ? `Last visit ${patient.last_visit_date}` : ''].filter(Boolean).join(' · ')
          const selected = patient.patient_id === selectedPatientId
          return <article className={`swify-patient-choice ${selected ? 'selected' : ''}`} key={patient.patient_id}>
            <div><strong>{patientName(patient)}</strong><span>{details || 'Patient record'}</span></div>
            {patient.matched_on ? <small>{patient.matched_on}</small> : null}
            <div className="swify-patient-choice__actions">
              <button type="button" className="ghost" onClick={() => onSelect(patient)}>{selected ? 'Selected' : 'Ask about patient'}</button>
              <button type="button" className="link-button" onClick={() => onOpen(patient.patient_id)}>Open record</button>
            </div>
          </article>
        })}
      </div>
      <DownloadPatientsFromReply patients={patients} />
    </section>
  )
}

const modes: Array<{ id: SwifyMode; label: string; hint: string }> = [
  { id: 'ask', label: 'Ask', hint: 'Ask about a patient, follow-up, or today’s priorities.' },
  { id: 'help', label: 'Help', hint: 'Ask how to use SwiftCare.' },
  { id: 'learn', label: 'Learn', hint: 'Browse trusted health-information resources.' },
]

export function formatSwifyReply(text: string) {
  return text
    .replace(/\s*\(?\s*source\s*:\s*[^)\n]+\)?/gi, '')
    .replace(/\b(?:retrieval|orchestrator|insights|suggestion)\s+agent\b/gi, 'Swify')
    .replace(/^\s*[-*]\s+/gmu, '• ')
    .replace(/^\s{0,3}#{1,6}\s+/gmu, '')
    .replace(/\*\*(.+?)\*\*/gu, '$1')
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$)/gmu, '$1$2')
    .replace(/`([^`]+)`/gu, '$1')
    .trim()
}

export function ChatPanel({
  patientId,
  sessionId,
  expanded = true,
  onExpandedChange,
}: {
  patientId?: string | null
  sessionId?: string | null
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const routePatientId = location.pathname.match(/^\/patient\/([^/]+)/)?.[1] ?? null
  const cacheKey = `swify:rail:${sessionId ?? 'default'}`
  const restored = readPageMemory<{ input: string; msgs: Msg[]; selectedPatient?: ChatPatientRow | null }>(cacheKey)
  const [input, setInput] = useState(() => restored?.input ?? '')
  const [msgs, setMsgs] = useState<Msg[]>(() => restored?.msgs ?? [])
  const [selectedPatient, setSelectedPatient] = useState<ChatPatientRow | null>(() => restored?.selectedPatient ?? null)
  const [mode, setMode] = useState<SwifyMode>('ask')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognizer | null>(null)

  const activePatientId = patientId ?? routePatientId ?? selectedPatient?.patient_id ?? null

  useEffect(() => {
    writePageMemory(cacheKey, { input, msgs, selectedPatient })
  }, [cacheKey, input, msgs, selectedPatient])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  if (import.meta.env.VITE_ENABLE_CHAT !== 'true') return null

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || busy) return
    const message = input.trim()
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text: message }])
    const vaguePatientRequest = !activePatientId && /\b(patient details?|patient info|show (?:me )?(?:a )?patient|open (?:a )?chart)\b/i.test(message)
    if (vaguePatientRequest) {
      setMsgs((m) => [...m, { role: 'assistant', text: 'Let’s find the patient first, so I can use the correct chart.' }])
      navigate('/patients')
      return
    }
    setBusy(true)
    try {
      const res: ChatResponse = await sendChat({
        message,
        patient_id: activePatientId,
        session_id: sessionId ?? null,
        mode,
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

  const activeMode = modes.find((item) => item.id === mode) ?? modes[1]

  return (
    <aside className={`swify-rail ${expanded ? '' : 'is-collapsed'}`} aria-label="Swify assistant">
      <div className="swify-rail__header">
        <div><strong>Swify</strong><span>Operations assistant</span></div>
        <button
          type="button"
          className="swify-rail__toggle"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse Swify assistant' : 'Expand Swify assistant'}
          title={expanded ? 'Collapse assistant' : 'Expand assistant'}
          onClick={() => onExpandedChange?.(!expanded)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {expanded ? <path d="m10 7 5 5-5 5" /> : <path d="m14 7-5 5 5 5" />}
          </svg>
        </button>
      </div>
      <div className="swify-rail__expand-label">Swify · AI</div>
      <div className="swify-rail__collapsed-notice" role="status">
        <strong>Hi, I’m Swify</strong>
        <span>Your operations assistant. Expand for patient and workflow help.</span>
      </div>
      <div className="swify-rail__panel-content">
      <div className="swify-rail__modes" role="tablist" aria-label="Swify modes">
        {modes.map((item) => <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? 'active' : ''} onClick={() => setMode(item.id)}>{item.label}</button>)}
      </div>
      <div className="swify-rail__context">
        <p className="swify-rail__hint">{activeMode.hint}{activePatientId ? ' The open patient is included automatically.' : ''}</p>
        {mode === 'learn' ? <div className="swify-rail__resources"><span>Trusted health information</span><a href="https://medlineplus.gov/" target="_blank" rel="noreferrer">MedlinePlus ↗</a><a href="https://www.cdc.gov/" target="_blank" rel="noreferrer">CDC ↗</a></div> : null}
      </div>
      <div className="swify-rail__messages">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`swify-rail__message ${m.role}`}
              >
                <div className="swify-rail__reply-text">{formatSwifyReply(m.text)}</div>
                {m.patients?.length ? <PatientChoices patients={m.patients} selectedPatientId={selectedPatient?.patient_id ?? null} onSelect={(patient) => setSelectedPatient((current) => current?.patient_id === patient.patient_id ? null : patient)} onOpen={(id) => navigate(`/patient/${id}`)} /> : null}
              </div>
            ))}
            {busy ? <div className="swify-rail__message assistant swify-rail__loading" role="status"><span className="inline-loader__spinner" aria-hidden="true" />Swify is thinking…</div> : null}
      </div>
      <form className="swify-chat__composer" onSubmit={(e) => void send(e)}>
            <input
              aria-label="Chat message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={activeMode.hint}
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
      <p className="swify-rail__disclaimer">Operational support only. Swify does not diagnose or prescribe.</p>
      </div>
    </aside>
  )
}
