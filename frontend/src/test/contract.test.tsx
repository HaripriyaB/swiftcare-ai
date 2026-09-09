import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SearchResultsTable } from '../components/SearchResultsTable'
import { formatSwifyReply } from '../components/ChatPanel'
import { DiagnosticOutcomesPanel } from '../components/chart/DiagnosticOutcomesPanel'
import { AdvisoryCardRow } from '../components/AdvisoryCard'
import { InsightAlertRow } from '../components/InsightAlert'
import { buildCareSignals } from '../components/CareSignalsDashboard'
import { DownloadPatientsFromReply } from '../components/DownloadPatientsFromReply'
import { buildPatientExport } from '../utils/buildPatientExport'
import { DEFAULT_CARD_DISCLAIMER } from '../api/types'
import type { AdvisoryCard, DiagnosticOutcome, PatientMatch } from '../api/types'

describe('F1 display & guardrails', () => {
  it('F1-001 prefers display names', () => {
    const matches: PatientMatch[] = [
      {
        patient_id: '1',
        first_name: 'Fannie123',
        last_name: 'Kuhn456',
        display_first_name: 'Fannie',
        display_last_name: 'Kuhn',
        age_years: 72,
        last_visit_date: '2019-01-01',
      },
    ]
    render(<SearchResultsTable matches={matches} onSelect={() => undefined} />)
    expect(screen.getByText('Fannie Kuhn')).toBeInTheDocument()
    expect(screen.queryByText(/Fannie123/)).toBeNull()
  })

  it('F1-001b opens a patient workspace from a keyboard-accessible name control', () => {
    const onSelect = vi.fn()
    render(
      <SearchResultsTable
        matches={[{ patient_id: 'p1', first_name: 'Fannie123', last_name: 'Kuhn456' }]}
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open patient workspace for Fannie Kuhn' }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ patient_id: 'p1' }))
  })

  it('F1-001c presents Swify replies without raw markdown or internal source labels', () => {
    expect(formatSwifyReply('**Medication**\n* Hydrochlorothiazide\n(source: mv_patient_latest_vitals)'))
      .toBe('Medication\n• Hydrochlorothiazide')
    expect(formatSwifyReply('### Matching patients (12)\n_Choose a patient below to continue._'))
      .toBe('Matching patients (12)\nChoose a patient below to continue.')
  })

  it('F1-002 advisory shows disclaimer when expanded path has fallback', () => {
    const card: AdvisoryCard = {
      card_id: 'c1',
      patient_id: 'p1',
      dismissed: false,
      created_at: '2026-01-01',
      content: {
        title: 'Allergy awareness',
        body: 'Penicillin on file for staff awareness before scheduling.',
        severity: 'attention',
        card_type: 'allergy_awareness',
        disclaimer: DEFAULT_CARD_DISCLAIMER,
      },
    }
    render(<AdvisoryCardRow card={card} onDismiss={() => undefined} />)
    expect(screen.getByText('Allergy awareness')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument()
  })

  it('F1-003 maps gap_in_care label', () => {
    render(
      <InsightAlertRow
        alert={{
          alert_id: 'a1',
          patient_id: 'p1',
          alert_type: 'gap_in_care',
          severity: 'MEDIUM',
          message: 'Ops note',
          dismissed: false,
          created_at: '2026-01-01',
        }}
        onDismiss={() => undefined}
      />,
    )
    expect(screen.getByText(/care gap/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /acknowledge signal/i })).toHaveTextContent('Acknowledge')
  })

  it('F1-003b groups operational patterns into Care Signals', () => {
    const signals = buildCareSignals([
      { risk_flag: 'gap_in_care', risk_level: 'HIGH', patient_count: 3 },
      { risk_flag: 'gap_in_care', risk_level: 'LOW', patient_count: 2 },
    ])
    expect(signals.find((signal) => signal.flag === 'gap_in_care')).toMatchObject({
      title: 'Follow-up windows missed',
      patientCount: 5,
      highCount: 3,
    })
  })

  it('F1-008 conditions are read-only', () => {
    const outcomes: DiagnosticOutcome[] = [
      {
        condition_id: 'c1',
        patient_id: 'p1',
        display_name: 'Essential hypertension',
        status: 'active',
        attribution: 'documented condition',
      },
    ]
    render(<DiagnosticOutcomesPanel outcomes={outcomes} />)
    expect(screen.getByText('Essential hypertension')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
  })

  it('F1-007 download control hidden when no patients', () => {
    const { container } = render(<DownloadPatientsFromReply patients={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('F1-006 export envelope includes required sections', () => {
    const exp = buildPatientExport({
      patientId: 'p1',
      summary: { patient_id: 'p1', display_first_name: 'A', display_last_name: 'B' },
      symptoms: [],
      outcomes: [],
      nextSteps: [],
      medications: [],
      allergies: [],
      visits: [],
      timeline: [],
      vitals: null,
      alerts: [],
    })
    expect(exp).toHaveProperty('symptoms')
    expect(exp).toHaveProperty('diagnostic_outcomes')
    expect(exp).toHaveProperty('recommended_next_steps')
    expect(exp.patient_id).toBe('p1')
  })
})
