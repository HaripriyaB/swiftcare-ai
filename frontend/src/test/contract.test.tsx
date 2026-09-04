import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchResultsTable } from '../components/SearchResultsTable'
import { DiagnosticOutcomesPanel } from '../components/chart/DiagnosticOutcomesPanel'
import { AdvisoryCardRow } from '../components/AdvisoryCard'
import { InsightAlertRow } from '../components/InsightAlert'
import { DownloadPatientsFromReply } from '../components/DownloadPatientsFromReply'
import { buildPatientExport } from '../utils/buildPatientExport'
import { OUTCOMES_SUBTITLE, DEFAULT_CARD_DISCLAIMER } from '../api/types'
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
  })

  it('F1-008 outcomes subtitle present', () => {
    const outcomes: DiagnosticOutcome[] = [
      {
        condition_id: 'c1',
        patient_id: 'p1',
        display_name: 'Essential hypertension',
        status: 'active',
        attribution: OUTCOMES_SUBTITLE,
      },
    ]
    render(<DiagnosticOutcomesPanel outcomes={outcomes} />)
    expect(screen.getByText(OUTCOMES_SUBTITLE)).toBeInTheDocument()
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
