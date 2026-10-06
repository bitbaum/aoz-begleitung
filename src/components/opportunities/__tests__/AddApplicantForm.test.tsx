import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { AddApplicantForm } from '../AddApplicantForm'
import { residentOptionLabel } from '@/lib/utils/resident-name'

vi.mock('@/lib/actions/opportunities', async () => ({ addApplicant: vi.fn(async () => ({})) }))

describe('«Person zuordnen»', () => {
  it('starts with nobody chosen, so one press cannot attach whoever sorts first', () => {
    // Live 2026-10-02: no empty option, so the browser pre-selected Alex and
    // «Speichern» attached him to a listing nobody meant him for.
    render(
      <AddApplicantForm
        opportunityId="opp-1"
        people={[
          { id: 'alex', name: 'Alex' },
          { id: 'bea', name: 'Bea' },
        ]}
      />,
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('')
    expect(select).toBeRequired()
    expect(select.options[0].value).toBe('')
  })

  it('marks a placeholder profile in the option text', () => {
    expect(residentOptionLabel({ code: 'KL-1', displayName: 'Amir', isPlaceholder: true })).toBe(
      'Amir · Platzhalter',
    )
    expect(residentOptionLabel({ code: 'KL-2', displayName: 'Stepan', isPlaceholder: false })).toBe(
      'Stepan',
    )
  })
})
