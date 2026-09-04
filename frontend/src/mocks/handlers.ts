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
      const name = `${p.display_first_name} ${p.display_last_name} ${p.first_name} ${p.last_name}`.toLowerCase()
      return !q || name.includes(q)
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
          'Top care-gap / at-risk patients (source: mv_at_risk_patients). These are operational scheduling flags, not diagnoses.',
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
          ? `Latest vitals (source: mv_patient_latest_vitals): BP ${v.systolic_bp}/${v.diastolic_bp}, HR ${v.heart_rate} (${v.latest_observation_date}).`
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
          ? `Active medications (source: v_active_medications): ${names}.`
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
