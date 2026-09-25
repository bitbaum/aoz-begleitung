import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import type { InterpreterNeed } from '@/lib/db'
import { CareWorkspace } from '../CareWorkspace'
import { CARE_ROLES, CARE_ROLE_LABELS, writableCareDomains } from '@/lib/config/care'
import { ASSIGNABLE_STAFF_ROLES, type StaffRole } from '@/lib/auth/role-policy'

/**
 * The workspace is an access boundary, not a form with some disabled inputs.
 *
 * It used to map over CARE_ROLES and pass the writable set down as an edit
 * flag, so every staff member READ all four domains and merely could not type
 * in three of them. A job coach opening any client saw Housing's "Schlüssel:
 * fehlt" and Sozialarbeit's "Nächster Schritt" — notes another discipline
 * wrote about a person, on a page he opened to do a different job.
 *
 * A rendering test is the only thing that catches a regression here: putting
 * `CARE_ROLES.map` back type-checks, lints and looks completely fine.
 */

vi.mock('@/lib/actions/care', async () => ({
  createAppointment: vi.fn(),
  saveCareAttributes: vi.fn(),
  setAppointmentStatus: vi.fn(),
}))

vi.mock('lucide-react', async () => ({
  ...(await vi.importActual<object>('lucide-react')),
  ChevronDown: () => <span data-testid="chevron" />,
}))

function renderFor(role: StaffRole, interpreterNeed: InterpreterNeed = 'NONE') {
  return render(
    <CareWorkspace
      residentId="res-1"
      interpreterNeed={interpreterNeed}
      attributes={[]}
      appointments={[]}
      writableDomains={writableCareDomains({ role, scope: 'OWN_DOMAIN', isSystemAdmin: false })}
    />,
  )
}

describe('the interpreting prompt sits where the time is chosen', () => {
  /**
   * Medios needs roughly a day's notice, so the moment that decides whether an
   * interpreter can be there is the moment somebody picks a date. A note
   * further up the profile is read after that decision, if at all.
   */
  it('says nothing for someone who does not need one', () => {
    renderFor('BETREUUNG', 'NONE')
    expect(screen.queryByText(/Dolmetschung/)).toBeNull()
  })

  it('warns beside the appointment form when one is needed', () => {
    renderFor('BETREUUNG', 'ALWAYS')
    expect(screen.getAllByText(/Dolmetschung/).length).toBeGreaterThan(0)
  })

  it('warns for FOR_COMPLEX too — the product cannot judge which talks are complex', () => {
    renderFor('BETREUUNG', 'FOR_COMPLEX')
    expect(screen.getAllByText(/Dolmetschung/).length).toBeGreaterThan(0)
  })

  it('says the product does not do the booking', () => {
    // Medios has a platform. Implying this system arranges the interpreter
    // would be worse than saying nothing.
    renderFor('BETREUUNG', 'ALWAYS')
    expect(screen.getAllByText(/nicht über dieses System/).length).toBeGreaterThan(0)
  })
})

describe('CareWorkspace domain boundary', () => {
  it.each(ASSIGNABLE_STAFF_ROLES.map((role) => [role]))(
    '%s is shown their own seats and no others',
    (role) => {
      renderFor(role)
      const own = writableCareDomains({ role, scope: 'OWN_DOMAIN', isSystemAdmin: false })

      for (const domain of CARE_ROLES) {
        const heading = CARE_ROLE_LABELS[domain]
        if (own.includes(domain)) {
          expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
        } else {
          expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument()
        }
      }
    },
  )

  it('shows a job coach exactly one seat, and not the housing or social ones', () => {
    renderFor('JOBCOACH')

    expect(screen.getByRole('heading', { name: CARE_ROLE_LABELS.JOB })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: CARE_ROLE_LABELS.HOUSING })).toBeNull()
    expect(screen.queryByRole('heading', { name: CARE_ROLE_LABELS.SOCIAL })).toBeNull()
    expect(screen.queryByRole('heading', { name: CARE_ROLE_LABELS.VOLUNTEERING })).toBeNull()
  })

  it('gives a viewer with oversight all four seats — whatever their role', () => {
    // This is the all-domains Betreuerin: she covers every seat. It used to
    // require the ADMIN role, which erased the fact that housing is her
    // domain. Breadth is now its own axis, so the role stays true.
    render(
      <CareWorkspace
        residentId="res-1"
        interpreterNeed="NONE"
        attributes={[]}
        appointments={[]}
        writableDomains={writableCareDomains({
          role: 'BETREUUNG',
          scope: 'ALL_DOMAINS',
          isSystemAdmin: false,
        })}
      />,
    )

    for (const domain of CARE_ROLES) {
      expect(screen.getByRole('heading', { name: CARE_ROLE_LABELS[domain] })).toBeInTheDocument()
    }
  })

  it('renders nothing at all rather than an empty card when no seat is readable', () => {
    const { container } = render(
      <CareWorkspace
        residentId="res-1"
        interpreterNeed="NONE"
        attributes={[]}
        appointments={[]}
        writableDomains={[]}
      />,
    )

    // An empty "Begleitung" card with a dangling subtitle reads as a broken
    // page; absence is the honest rendering of "this is not your surface".
    expect(container).toBeEmptyDOMElement()
  })
})
