/**
 * A work listing may not go out claiming that no authorisation is needed.
 *
 * `permitRequirement` defaults to `NONE`, which renders to a resident as
 * "Keine Bewilligung nötig". On unpaid volunteering that is true and useful.
 * On a job it is a legal claim about that person's situation which this
 * product cannot make — and must never make BY DEFAULT, which is exactly what
 * a default does.
 *
 * The people this is for hold permits that constrain work. A wrong
 * reassurance here costs the resident their status, not us a bug report. It is
 * the same reasoning that keeps a price field off the marketplace: this
 * product does not put someone in a position where taking it at its word can
 * hurt them.
 *
 * So the rule is enforced in two places, because there are two ways to
 * publish: through the form (the schema) and through the publish button on a
 * list (the action). A gate on only one of them is a gate you walk around.
 */

import {
  OPPORTUNITY_KINDS,
  PERMIT_REQUIREMENTS,
  WORK_OPPORTUNITY_KINDS,
  isWorkKind,
  permitRequirementIsStated,
} from '@/lib/config/opportunities'
import { OpportunityInputSchema } from '@/lib/validation'
import { redirect } from 'next/navigation'
import {
  createOpportunity,
  publishOpportunity,
  publishOpportunityFromDetail,
  publishOpportunityFromEdit,
} from '@/lib/actions/opportunities'
import { whereParts as mockWhereParts } from '@/test-utils/drizzle-where'

// --- the action path -------------------------------------------------------

const mockOpportunityFindFirst = vi.fn()
// (set, whereParts) → the rows `.returning()` yields
const mockOpportunityUpdate = vi.fn()

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: {
      opportunity: { findFirst: (...a: unknown[]) => mockOpportunityFindFirst(...a) },
    },
    update: () => ({
      set: (data: unknown) => ({
        where: (w: unknown) => ({
          returning: () => Promise.resolve(mockOpportunityUpdate(data, mockWhereParts(w))),
        }),
      }),
    }),
  },
}))
vi.mock('next/cache', async () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', async () => ({ redirect: vi.fn() }))
vi.mock('@/lib/audit', async () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/logger', async () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), errorWithCause: vi.fn() },
}))
vi.mock('@/lib/auth', async () => ({
  requirePermission: vi.fn(async () => ({ id: 'staff-1', role: 'JOBCOACH' })),
}))

const UNPAID_KINDS = OPPORTUNITY_KINDS.filter((kind) => !isWorkKind(kind))

function draft(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'EMPLOYMENT',
    title: 'Küchenhilfe',
    description: 'Mithilfe in der Küche, 40%.',
    organisation: 'Restaurant Sonne',
    status: 'PUBLISHED',
    permitRequirement: 'EMPLOYER_NOTIFIES',
    ...overrides,
  }
}

describe('which kinds count as work', () => {
  it('treats employment and internships as work, and unpaid engagement as not', () => {
    expect([...WORK_OPPORTUNITY_KINDS]).toEqual(['EMPLOYMENT', 'INTERNSHIP'])
    expect(UNPAID_KINDS).toEqual(['VOLUNTEERING', 'COMMUNITY_SERVICE'])
  })

  it('covers every kind — a new one must be classified, not silently unpaid', () => {
    for (const kind of OPPORTUNITY_KINDS) {
      expect(typeof isWorkKind(kind)).toBe('boolean')
    }
    expect(UNPAID_KINDS.length + WORK_OPPORTUNITY_KINDS.length).toBe(OPPORTUNITY_KINDS.length)
  })
})

describe('the rule itself', () => {
  it.each([...WORK_OPPORTUNITY_KINDS])('%s may not claim NONE', (kind) => {
    expect(permitRequirementIsStated(kind, 'NONE')).toBe(false)
    expect(permitRequirementIsStated(kind, 'EMPLOYER_NOTIFIES')).toBe(true)
    expect(permitRequirementIsStated(kind, 'PERMIT_REQUIRED')).toBe(true)
  })

  it.each([...UNPAID_KINDS])('%s is unaffected — NONE is honest there', (kind) => {
    for (const permit of PERMIT_REQUIREMENTS) {
      expect(permitRequirementIsStated(kind, permit)).toBe(true)
    }
  })
})

describe('publishing through the form', () => {
  it.each([...WORK_OPPORTUNITY_KINDS])(
    'refuses to publish a %s with no stated authorisation route',
    (kind) => {
      const result = OpportunityInputSchema.safeParse(draft({ kind, permitRequirement: 'NONE' }))

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('permitRequirement'))).toBe(true)
      }
    },
  )

  it('refuses when the field is simply absent, which is how a default bites', () => {
    const { permitRequirement, ...withoutPermit } = draft()
    void permitRequirement

    expect(OpportunityInputSchema.safeParse(withoutPermit).success).toBe(false)
  })

  it.each([...WORK_OPPORTUNITY_KINDS])('accepts a %s that states a route', (kind) => {
    expect(
      OpportunityInputSchema.safeParse(draft({ kind, permitRequirement: 'PERMIT_REQUIRED' }))
        .success,
    ).toBe(true)
  })

  it('lets a work listing be SAVED as a draft while the answer is unknown', () => {
    // The coach who does not yet know must be able to keep the work in
    // progress. What they must not be able to do is put it in front of a
    // resident. Blocking the draft too would just push the record elsewhere.
    expect(
      OpportunityInputSchema.safeParse(draft({ status: 'DRAFT', permitRequirement: 'NONE' }))
        .success,
    ).toBe(true)
  })

  it('leaves unpaid listings publishable with NONE, as before', () => {
    for (const kind of UNPAID_KINDS) {
      expect(
        OpportunityInputSchema.safeParse(draft({ kind, permitRequirement: 'NONE' })).success,
      ).toBe(true)
    }
  })
})

describe('publishing through the button that skips the form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOpportunityUpdate.mockReturnValue([{ id: 'opp-1' }])
  })

  it.each([...WORK_OPPORTUNITY_KINDS])(
    'refuses to publish a stored %s draft that still says NONE',
    async (kind) => {
      mockOpportunityFindFirst.mockResolvedValue({
        kind,
        permitRequirement: 'NONE',
      })

      await expect(publishOpportunity('opp-1')).rejects.toThrow(/Bewilligungsweg/)
      expect(mockOpportunityUpdate).not.toHaveBeenCalled()
    },
  )

  it('publishes a work listing once a route is stated', async () => {
    mockOpportunityFindFirst.mockResolvedValue({
      kind: 'EMPLOYMENT',
      permitRequirement: 'PERMIT_REQUIRED',
    })

    await publishOpportunity('opp-1')

    expect(mockOpportunityUpdate).toHaveBeenCalledWith(expect.anything(), { id: 'opp-1' })
  })

  it('leaves unpaid listings publishable', async () => {
    mockOpportunityFindFirst.mockResolvedValue({
      kind: 'VOLUNTEERING',
      permitRequirement: 'NONE',
    })

    await publishOpportunity('opp-1')

    expect(mockOpportunityUpdate).toHaveBeenCalled()
  })
})

describe('the refusal has to reach the person who has to act on it', () => {
  /**
   * The gate above works and, for a while, told nobody.
   *
   * `publishOpportunity` throws; nothing caught it; Next rendered "Etwas ist
   * schiefgelaufen. Bitte versuchen Sie es erneut." A message that names the
   * exact next step ("Sonst als Entwurf speichern und mit der Sozialarbeit
   * klären") was replaced by a shrug — observed live on 2026-09-04 while
   * posting a real AOZ vacancy.
   *
   * The throw stays: it is the server guard, pinned above. The BUTTON now
   * carries the reason back to the page instead of letting it escape.
   */
  beforeEach(() => {
    vi.clearAllMocks()
    mockOpportunityUpdate.mockReturnValue([{ id: 'opp-1' }])
  })

  it('sends the gate’s own words back to the edit page', async () => {
    mockOpportunityFindFirst.mockResolvedValue({
      kind: 'EMPLOYMENT',
      permitRequirement: 'NONE',
    })

    await publishOpportunityFromEdit('opp-1')

    const target = vi.mocked(redirect).mock.calls[0][0] as string
    expect(target).toContain('/opportunities/opp-1/edit?error=')
    expect(decodeURIComponent(target)).toMatch(/Bewilligungsweg/)
  })

  it('sends the refusal back to the DETAIL page when pressed there', async () => {
    // The draft detail page now carries the button too; its refusal must
    // land beside it, not on a form the coach never opened.
    mockOpportunityFindFirst.mockResolvedValue({
      kind: 'EMPLOYMENT',
      permitRequirement: 'NONE',
    })

    await publishOpportunityFromDetail('opp-1')

    const target = vi.mocked(redirect).mock.calls[0][0] as string
    expect(target).toMatch(/^\/opportunities\/opp-1\?error=/)
    expect(decodeURIComponent(target)).toMatch(/Bewilligungsweg/)
  })

  it('goes to the listing when the publish actually worked', async () => {
    mockOpportunityFindFirst.mockResolvedValue({
      kind: 'EMPLOYMENT',
      permitRequirement: 'EMPLOYER_NOTIFIES',
    })

    await publishOpportunityFromEdit('opp-1')

    expect(vi.mocked(redirect).mock.calls[0][0]).toBe('/opportunities/opp-1')
  })
})

describe('a rejected save returns rather than throwing', () => {
  /**
   * The costly half. The form is a client component holding every value —
   * fourteen fields, most of them written by the assistant from a pasted
   * advertisement. A throw unmounts the route and takes all of it; a returned
   * state leaves the store alone and the coach fixes one field.
   */
  beforeEach(() => vi.clearAllMocks())

  it('reports the work-permit rule instead of exploding', async () => {
    const form = new FormData()
    form.set('title', 'Programmleiter*in')
    form.set('description', 'Leitung des Pilotprojekts.')
    form.set('organisation', 'AOZ')
    form.set('kind', 'EMPLOYMENT')
    form.set('permitRequirement', 'NONE')
    form.set('status', 'PUBLISHED')

    const state = await createOpportunity({}, form)

    expect(state.error).toMatch(/Bewilligungsweg/)
    expect(state.fieldErrors?.permitRequirement?.length).toBeGreaterThan(0)
  })
})
