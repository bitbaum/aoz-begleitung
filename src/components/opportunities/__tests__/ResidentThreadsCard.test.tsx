/**
 * «Platz vorschlagen» on the dossier. Live 2026-10-02: Stepan's
 * «Einsätze & Bewerbungen» said «Noch nichts» with no way forward.
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { addApplicant } from '@/lib/actions/opportunities'
import { ResidentThreadsCard } from '../ResidentThreadsCard'

vi.mock('next/link', async () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/lib/actions/opportunities', async () => ({ addApplicant: vi.fn(async () => ({})) }))

const PLACES = [{ id: 'opp-1', title: 'Velowerkstatt', organisation: 'AOZ' }]

describe('ResidentThreadsCard', () => {
  it('stays read-only for a viewer who may not propose', () => {
    render(<ResidentThreadsCard threads={[]} propose={null} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('offers «Platz vorschlagen» with nothing pre-selected, for this person', () => {
    const { container } = render(
      <ResidentThreadsCard threads={[]} propose={{ residentId: 'stepan', places: PLACES }} />,
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.name).toBe('opportunityId')
    expect(select.value).toBe('')
    expect(select).toBeRequired()
    expect(container.querySelector('input[name="residentId"]')).toHaveValue('stepan')
    expect(screen.getByRole('option', { name: 'Velowerkstatt · AOZ' })).toBeInTheDocument()
    // The SAME action as «Person zuordnen» on a listing: one thread, one rule.
    expect(addApplicant).toBeDefined()
  })

  it('says so when there is nothing left to propose', () => {
    render(<ResidentThreadsCard threads={[]} propose={{ residentId: 'stepan', places: [] }} />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText(/Kein weiterer veröffentlichter Einsatzplatz/)).toBeInTheDocument()
  })
})
