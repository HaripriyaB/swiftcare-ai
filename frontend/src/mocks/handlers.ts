import { http, HttpResponse } from 'msw'
import patients from './fixtures/patients.json'
import chart from './fixtures/chart.json'
import conditions from './fixtures/conditions.json'
import symptomsSeed from './fixtures/symptoms.json'
import cardsSeed from './fixtures/cards.json'
import alertsSeed from './fixtures/alerts.json'
import type {
  AdvisoryCard,
  ChatPatientRow,
  InsightAlert,
  PatientMatch,
  Symptom,
} from '../api/types'

const base = '/api/v1'

type ChartBundle = (typeof chart)[keyof typeof chart]

const symptomsStore: Record<string, Symptom[]> = structuredClone(
  symptomsSeed as Record<string, Symptom[]>,
)
const cardsStore: Record<string, AdvisoryCard[]> = structuredClone(
  cardsSeed as Record<string, AdvisoryCard[]>,
)
const alertsStore: InsightAlert[] = structuredClone(
  alertsSeed.alerts as InsightAlert[],
)

let session = {
  session_id: 'sess-demo-1',
  user_id: 'dev-user',
  active_patient_id: null as string | null,
}

// Local-only continuity work used to make the review UI representative without
// contacting BigQuery or the deployed API.
let continuityCards = [
  { card_id: 'demo-card-1', patient_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001', patient_name: 'Fannie Kuhn', priority: 'HIGH', priority_score: 0.94, action_type: 'CONTACT_FOR_FOLLOW_UP', action_label: 'Call to arrange follow-up', why_now: 'The follow-up window has passed and no future visit is scheduled.', evidence: [{ label: 'Last visit', value: '842 days ago', source: 'encounter' }, { label: 'Open care gap', value: 'Preventive follow-up', source: 'continuity view' }], status: 'OPEN', rule_version: 'demo-v1', created_at: '2026-09-10T07:45:00Z', updated_at: '2026-09-10T07:45:00Z', disclaimer: 'Operational support only.' },
  { card_id: 'demo-card-2', patient_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001', patient_name: 'Harold Nguyen', priority: 'HIGH', priority_score: 0.89, action_type: 'REVIEW_WITH_CARE_TEAM', action_label: 'Review repeated recent visits', why_now: 'Recent utilization suggests a coordination review may help.', evidence: [{ label: 'Recent encounters', value: '8 in 90 days', source: 'encounter' }, { label: 'Active medications', value: '6', source: 'medication' }], status: 'OPEN', rule_version: 'demo-v1', created_at: '2026-09-10T07:30:00Z', updated_at: '2026-09-10T07:30:00Z', disclaimer: 'Operational support only.' },
  { card_id: 'demo-card-3', patient_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002', patient_name: 'Maya Patel', priority: 'MEDIUM', priority_score: 0.67, action_type: 'CONTACT_FOR_FOLLOW_UP', action_label: 'Confirm a follow-up appointment', why_now: 'A routine follow-up remains overdue.', evidence: [{ label: 'Last visit', value: '400 days ago', source: 'encounter' }, { label: 'Care pattern', value: 'Gap in care', source: 'continuity view' }], status: 'OPEN', rule_version: 'demo-v1', created_at: '2026-09-10T07:15:00Z', updated_at: '2026-09-10T07:15:00Z', disclaimer: 'Operational support only.' },
  { card_id: 'demo-card-4', patient_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0003', patient_name: 'Luis Ortiz', priority: 'LOW', priority_score: 0.42, action_type: 'REVIEW_WITH_CARE_TEAM', action_label: 'Review medication coordination', why_now: 'Multiple active medications are recorded for operational awareness.', evidence: [{ label: 'Active medications', value: '4', source: 'medication' }, { label: 'Last visit', value: '510 days ago', source: 'encounter' }], status: 'OPEN', rule_version: 'demo-v1', created_at: '2026-09-10T06:50:00Z', updated_at: '2026-09-10T06:50:00Z', disclaimer: 'Operational support only.' },
]

const continuityEvents = [
  { event_id: 'demo-event-1', card_id: 'demo-card-completed', patient_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002', patient_name: 'Maya Patel', action_label: 'Confirmed outreach details', event_type: 'COMPLETED', outcome: 'Contact information verified', note: 'Left a secure callback request.', actor_user_id: 'dev-user', created_at: '2026-09-10T06:20:00Z' },
  { event_id: 'demo-event-2', card_id: 'demo-card-history', patient_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001', patient_name: 'Harold Nguyen', action_label: 'Reviewed care-team note', event_type: 'IN_PROGRESS', outcome: 'Awaiting team review', note: 'Added to today’s huddle.', actor_user_id: 'dev-user', created_at: '2026-09-10T05:55:00Z' },
]

function chartFor(id: string): ChartBundle | undefined {
  return (chart as Record<string, ChartBundle>)[id]
}

function requireAuth(request: Request) {
  const bypass = import.meta.env.VITE_AUTH_BYPASS === 'true'
  if (bypass) return null
  const h = request.headers.get('Authorization')
  if (!h?.startsWith('Bearer ')) {
    return HttpResponse.json(
      { error: 'unauthorized', message: 'Missing bearer token' },
      { status: 401 },
    )
  }
  return null
}

export const handlers = [
  http.get(`${base}/health`, () => HttpResponse.json({ ok: true })),

  http.get(`${base}/session`, ({ request }) => {
    const err = requireAuth(request)
    if (err) return err
    return HttpResponse.json(session)
  }),

  http.put(`${base}/session`, async ({ request }) => {
    const err = requireAuth(request)
    if (err) return err
    const body = (await request.json()) as {
      active_patient_id?: string | null
      user_id?: string
    }
    session = {
      ...session,
      active_patient_id: body.active_patient_id ?? session.active_patient_id,
      user_id: body.user_id ?? session.user_id,
    }
    return HttpResponse.json(session)
  }),

  http.get(`${base}/patients/search`, ({ request }) => {
    const err = requireAuth(request)
    if (err) return err
    const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? ''
    const matches = (patients as PatientMatch[]).filter((p) => {
      const searchable = JSON.stringify({
        patient: p,
        chart: chartFor(p.patient_id),
        conditions: (conditions as Record<string, unknown[]>)[p.patient_id],
        symptoms: symptomsStore[p.patient_id],
      }).toLowerCase()
      return !q || searchable.includes(q)
    })
    return HttpResponse.json({
      match_count: matches.length,
      matches,
      display_hint: 'Select a row to open the patient workspace.',
    })
  }),

  http.get(`${base}/patients/:id/summary`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const c = chartFor(String(params.id))
    if (!c) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    return HttpResponse.json(c.summary)
  }),

  http.get(`${base}/patients/:id/medications`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const c = chartFor(String(params.id))
    if (!c) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    return HttpResponse.json(c.medications)
  }),

  http.get(`${base}/patients/:id/allergies`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const c = chartFor(String(params.id))
    if (!c) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    return HttpResponse.json(c.allergies)
  }),

  http.get(`${base}/patients/:id/visits`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const c = chartFor(String(params.id))
    if (!c) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    return HttpResponse.json(c.visits)
  }),

  http.get(`${base}/patients/:id/timeline`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const c = chartFor(String(params.id))
    if (!c) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    return HttpResponse.json(c.timeline)
  }),

  http.get(`${base}/patients/:id/vitals`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const c = chartFor(String(params.id))
    if (!c) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    return HttpResponse.json(c.vitals)
  }),

  http.get(`${base}/patients/:id/conditions`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const rows =
      (conditions as Record<string, unknown[]>)[String(params.id)] ?? []
    return HttpResponse.json(rows)
  }),

  http.get(`${base}/patients/:id/fhir-findings`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const id = String(params.id)
    const rows = ((conditions as Record<string, Array<{ condition_id: string; display_name: string; onset_date?: string }>>)[id] ?? [])
      .slice(0, 6)
      .map((row) => ({
        finding_id: `condition:${row.condition_id}`,
        patient_id: id,
        display_name: row.display_name,
        source_kind: 'FHIR Condition',
        recorded_date: row.onset_date ?? null,
        value_text: null,
        attribution: 'Source-recorded FHIR chart data — not generated by SwiftCare AI',
      }))
    return HttpResponse.json(rows)
  }),

  http.get(`${base}/patients/:id/attention-card`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const id = String(params.id)
    return HttpResponse.json(continuityCards.find((card) => card.patient_id === id) ?? null)
  }),

  http.get(`${base}/patients/:id/symptoms`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const active =
      new URL(request.url).searchParams.get('active') !== 'false'
    const rows = symptomsStore[String(params.id)] ?? []
    return HttpResponse.json(
      active ? rows.filter((s) => s.status === 'active') : rows,
    )
  }),

  http.post(`${base}/patients/:id/symptoms`, async ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const body = (await request.json()) as {
      description: string
      reported_by: 'patient' | 'staff'
    }
    const id = String(params.id)
    const row: Symptom = {
      symptom_id: `s-${crypto.randomUUID()}`,
      patient_id: id,
      description: body.description.slice(0, 200),
      reported_by: body.reported_by,
      recorded_by_user_id: session.user_id,
      recorded_by_display: `${session.user_id}@local`,
      status: 'active',
      recorded_at: new Date().toISOString(),
      resolved_at: null,
    }
    symptomsStore[id] = [...(symptomsStore[id] ?? []), row]
    return HttpResponse.json(row, { status: 201 })
  }),

  http.post(
    `${base}/patients/:id/symptoms/:symptomId/resolve`,
    ({ params, request }) => {
      const err = requireAuth(request)
      if (err) return err
      const id = String(params.id)
      const sid = String(params.symptomId)
      const rows = symptomsStore[id] ?? []
      const idx = rows.findIndex((s) => s.symptom_id === sid)
      if (idx < 0) {
        return HttpResponse.json({ error: 'not_found' }, { status: 404 })
      }
      rows[idx] = {
        ...rows[idx],
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      }
      return HttpResponse.json(rows[idx])
    },
  ),

  http.get(`${base}/patients/:id/advisory-cards`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const open = new URL(request.url).searchParams.get('open') !== 'false'
    const rows = cardsStore[String(params.id)] ?? []
    return HttpResponse.json(open ? rows.filter((c) => !c.dismissed) : rows)
  }),

  http.post(`${base}/patients/:id/generate-next-steps`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const id = String(params.id)
    const existing = cardsStore[id] ?? []
    if (!existing.some((card) => !card.dismissed)) {
      const condition = (conditions as Record<string, Array<{ display_name?: string }>>)[id]?.[0]?.display_name ?? 'documented chart findings'
      cardsStore[id] = [{
        card_id: `generated-${crypto.randomUUID()}`,
        session_id: session.session_id,
        patient_id: id,
        agent_type: 'suggestion',
        content: {
          title: 'Review source-recorded chart context',
          body: `Review the documented ${condition} and confirm whether a care-coordination follow-up is appropriate.`,
          severity: 'info',
          card_type: 'chart_completeness',
          disclaimer: 'Not a clinical order. Staff review required. Not a diagnosis or prescription.',
        },
        source_refs: [{ view: 'FHIR chart findings', patient_id: id }],
        dismissed: false,
        created_at: new Date().toISOString(),
      }]
    }
    return HttpResponse.json({ cards: cardsStore[id], reply: 'Generated source-grounded operational next steps.' })
  }),

  http.post(
    `${base}/patients/:id/advisory-cards/:cardId/dismiss`,
    ({ params, request }) => {
      const err = requireAuth(request)
      if (err) return err
      const id = String(params.id)
      const cardId = String(params.cardId)
      const rows = cardsStore[id] ?? []
      const idx = rows.findIndex((c) => c.card_id === cardId)
      if (idx < 0) {
        return HttpResponse.json({ error: 'not_found' }, { status: 404 })
      }
      rows[idx] = { ...rows[idx], dismissed: true }
      return HttpResponse.json({ card_id: cardId, dismissed: true })
    },
  ),

  http.get(`${base}/continuity/queue`, ({ request }) => {
    const err = requireAuth(request)
    if (err) return err
    const url = new URL(request.url)
    const priority = url.searchParams.get('priority')
    const actionType = url.searchParams.get('action_type')
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? 50)
    const openCards = continuityCards.filter((card) => card.status === 'OPEN')
    const filtered = openCards.filter((card) => (!priority || card.priority === priority) && (!actionType || card.action_type === actionType))
    const cards = filtered.slice(offset, offset + limit)
    return HttpResponse.json({ cards, summary: { HIGH: openCards.filter((card) => card.priority === 'HIGH').length, MEDIUM: openCards.filter((card) => card.priority === 'MEDIUM').length, LOW: openCards.filter((card) => card.priority === 'LOW').length }, offset, next_offset: offset + limit < filtered.length ? offset + limit : null, has_more: offset + limit < filtered.length, total_count: filtered.length })
  }),

  http.get(`${base}/continuity/summary`, ({ request }) => {
    const err = requireAuth(request)
    if (err) return err
    const openCards = continuityCards.filter((card) => card.status === 'OPEN')
    return HttpResponse.json({ HIGH: openCards.filter((card) => card.priority === 'HIGH').length, MEDIUM: openCards.filter((card) => card.priority === 'MEDIUM').length, LOW: openCards.filter((card) => card.priority === 'LOW').length })
  }),

  http.get(`${base}/continuity/cards/:cardId`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const card = continuityCards.find((item) => item.card_id === String(params.cardId))
    return card ? HttpResponse.json(card) : HttpResponse.json({ error: 'not_found' }, { status: 404 })
  }),

  http.post(`${base}/continuity/cards/:cardId/start`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const index = continuityCards.findIndex((item) => item.card_id === String(params.cardId))
    if (index < 0) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    continuityCards[index] = { ...continuityCards[index], status: 'IN_PROGRESS', updated_at: new Date().toISOString() }
    return HttpResponse.json(continuityCards[index])
  }),

  http.post(`${base}/continuity/cards/:cardId/complete`, async ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const index = continuityCards.findIndex((item) => item.card_id === String(params.cardId))
    if (index < 0) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    const body = await request.json() as { outcome?: string; note?: string }
    continuityCards[index] = { ...continuityCards[index], status: 'COMPLETED', updated_at: new Date().toISOString() }
    continuityEvents.unshift({ event_id: `demo-event-${crypto.randomUUID()}`, card_id: continuityCards[index].card_id, patient_id: continuityCards[index].patient_id, patient_name: continuityCards[index].patient_name, action_label: continuityCards[index].action_label, event_type: 'COMPLETED', outcome: body.outcome ?? 'Completed', note: body.note ?? '', actor_user_id: 'dev-user', created_at: new Date().toISOString() })
    return HttpResponse.json(continuityCards[index])
  }),

  http.get(`${base}/continuity/history`, ({ request }) => {
    const err = requireAuth(request)
    if (err) return err
    return HttpResponse.json({ events: continuityEvents })
  }),

  http.get(`${base}/continuity/history/:eventId`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const event = continuityEvents.find((item) => item.event_id === String(params.eventId))
    if (!event) return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    return HttpResponse.json({ ...event, priority: 'MEDIUM', why_now: 'Local review fixture.', audit_history: [{ event_id: event.event_id, event_type: event.event_type, outcome: event.outcome, note: event.note, actor_user_id: event.actor_user_id, created_at: event.created_at }] })
  }),

  http.get(`${base}/insights/distribution`, ({ request }) => {
    const err = requireAuth(request)
    if (err) return err
    return HttpResponse.json({
      distribution: alertsSeed.distribution,
      count: alertsSeed.distribution.length,
    })
  }),

  http.get(`${base}/insights/at-risk`, ({ request }) => {
    const err = requireAuth(request)
    if (err) return err
    const url = new URL(request.url)
    const flag = url.searchParams.get('risk_flag')
    const level = url.searchParams.get('risk_level')
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 10), 50)
    let rows = [...alertsSeed.atRisk]
    if (flag) rows = rows.filter((r) => r.risk_flag === flag)
    if (level) rows = rows.filter((r) => r.risk_level === level)
    rows = rows.slice(0, limit)
    return HttpResponse.json({ patients: rows, count: rows.length })
  }),

  http.get(`${base}/insights/alerts`, ({ request }) => {
    const err = requireAuth(request)
    if (err) return err
    const url = new URL(request.url)
    const open = url.searchParams.get('open') !== 'false'
    const pid = url.searchParams.get('patient_id')
    let rows = [...alertsStore]
    if (open) rows = rows.filter((a) => !a.dismissed)
    if (pid) rows = rows.filter((a) => a.patient_id === pid)
    return HttpResponse.json(rows)
  }),

  http.post(`${base}/insights/alerts/:alertId/dismiss`, ({ params, request }) => {
    const err = requireAuth(request)
    if (err) return err
    const alertId = String(params.alertId)
    const idx = alertsStore.findIndex((a) => a.alert_id === alertId)
    if (idx < 0) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 })
    }
    alertsStore[idx] = { ...alertsStore[idx], dismissed: true }
    return HttpResponse.json({ alert_id: alertId, dismissed: true })
  }),

  http.post(`${base}/chat`, async ({ request }) => {
    const err = requireAuth(request)
    if (err) return err
    const body = (await request.json()) as {
      message: string
      patient_id?: string | null
    }
    const msg = body.message.toLowerCase()

    if (/diagnos|prescrib|antibiotic/.test(msg)) {
      return HttpResponse.json({
        reply:
          'I can’t diagnose or prescribe. I can show chart data, operational next steps, or population insights for staff review.',
        agent_type: 'orchestrator',
        patient_id: body.patient_id ?? null,
        citations: [],
        cards: [],
        alerts: [],
        patients: [],
      })
    }

    if (/care gap|gap in care|at.?risk|who hasn't|overdue/.test(msg)) {
      const list = alertsSeed.atRisk.slice(0, 5) as ChatPatientRow[]
      return HttpResponse.json({
        reply:
          'These patients may need follow-up attention. These are operational scheduling flags, not diagnoses.',
        agent_type: 'insights',
        patient_id: null,
        citations: [{ view: 'mv_at_risk_patients' }],
        cards: [],
        alerts: [],
        patients: list.map((p) => ({
          patient_id: p.patient_id,
          display_first_name: p.display_first_name,
          display_last_name: p.display_last_name,
          risk_flag: p.risk_flag,
          risk_level: p.risk_level,
          days_since_last_visit: p.days_since_last_visit,
          age_years: p.age_years,
        })),
      })
    }

    if (/vital|bp|blood pressure|heart/.test(msg)) {
      const c = body.patient_id ? chartFor(body.patient_id) : undefined
      const v = c?.vitals
      return HttpResponse.json({
        reply: v
          ? `Latest recorded vitals: blood pressure ${v.systolic_bp}/${v.diastolic_bp}, heart rate ${v.heart_rate} (${v.latest_observation_date}).`
          : 'Open a patient first to see vitals, or ask with an active patient selected.',
        agent_type: 'retrieval',
        patient_id: body.patient_id ?? null,
        citations: [{ view: 'mv_patient_latest_vitals' }],
        cards: [],
        alerts: [],
        patients: [],
      })
    }

    if (/med|medication/.test(msg)) {
      const c = body.patient_id ? chartFor(body.patient_id) : undefined
      const names = c?.medications.map((m) => m.medication_name).join(', ')
      return HttpResponse.json({
        reply: names
          ? `Active medications: ${names}.`
          : 'No medication list loaded for this patient.',
        agent_type: 'retrieval',
        patient_id: body.patient_id ?? null,
        citations: [{ view: 'v_active_medications' }],
        cards: [],
        alerts: [],
        patients: [],
      })
    }

    if (/symptom/.test(msg)) {
      return HttpResponse.json({
        reply:
          'Use the Symptoms tab to view or add symptoms recorded by staff. I won’t invent symptom lists.',
        agent_type: 'orchestrator',
        patient_id: body.patient_id ?? null,
        citations: [],
        cards: [],
        alerts: [],
        patients: [],
      })
    }

    return HttpResponse.json({
      reply:
        'Try asking about care gaps, medications, vitals, or open the patient tabs for symptoms, outcomes, and recommended next steps.',
      agent_type: 'orchestrator',
      patient_id: body.patient_id ?? null,
      citations: [],
      cards: [],
      alerts: [],
      patients: [],
    })
  }),
]
