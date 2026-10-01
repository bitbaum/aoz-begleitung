/**
 * What the resident board hands back.
 *
 * The rule worth a test is the one that is invisible when it breaks: a
 * resident may learn whether a place is still free, and may not learn who is
 * in it. Returning the applicant rows and simply not rendering them looks
 * identical on screen — the payload is the leak, not the markup — so the shape
 * of the returned object is asserted directly.
 */

const mockApplicationFindMany = vi.fn()
const mockOpportunityFindMany = vi.fn()

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: {
      opportunityApplication: { findMany: (...a: unknown[]) => mockApplicationFindMany(...a) },
      opportunity: { findMany: (...a: unknown[]) => mockOpportunityFindMany(...a) },
    },
  },
}))

import type { Mock } from 'vitest'
import { residentOpportunityBoard } from '../opportunities'
import { whereParts } from '@/test-utils/drizzle-where'

const mockDb = {
  opportunityApplication: { findMany: mockApplicationFindMany },
  opportunity: { findMany: mockOpportunityFindMany },
}

function listing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'opp-1',
    title: 'Mittagstisch',
    status: 'PUBLISHED',
    seats: 3,
    startsAt: null,
    updatedAt: new Date('2026-08-01'),
    applications: [{ stage: 'ACCEPTED' }],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(mockDb.opportunityApplication.findMany as Mock).mockResolvedValue([])
  ;(mockDb.opportunity.findMany as Mock).mockResolvedValue([listing()])
})

describe('residentOpportunityBoard', () => {
  it('never hands the resident the other applicants', async () => {
    const { open } = await residentOpportunityBoard('res-1')

    expect(open).toHaveLength(1)
    expect(open[0]).not.toHaveProperty('applications')
  })

  it('reports the seats left rather than the people in them', async () => {
    const { open } = await residentOpportunityBoard('res-1')

    expect(open[0].seatsLeft).toBe(2)
  })

  it('reports an unstated capacity as unknown, not as full', async () => {
    // `null` seats means the listing never named a number. Rendering that as
    // zero would take an open place off the board for everyone.
    ;(mockDb.opportunity.findMany as Mock).mockResolvedValue([listing({ seats: null })])

    const { open } = await residentOpportunityBoard('res-1')

    expect(open[0].seatsLeft).toBeNull()
  })

  it('only ever asks for published listings', async () => {
    await residentOpportunityBoard('res-1')

    const where = (mockDb.opportunity.findMany as Mock).mock.calls[0][0].where
    expect(whereParts(where)).toEqual({ status: 'PUBLISHED' })
  })

  it('drops listings the resident is already attached to', async () => {
    // Otherwise the same place appears twice — once under "your placements"
    // with a stage, and once under "open" with a button that cannot work.
    ;(mockDb.opportunityApplication.findMany as Mock).mockResolvedValue([
      { id: 'app-1', opportunityId: 'opp-1', stage: 'INTERESTED', opportunity: listing() },
    ])

    const { mine, open } = await residentOpportunityBoard('res-1')

    expect(mine).toHaveLength(1)
    expect(open).toHaveLength(0)
  })

  it('puts the places someone can still take first', async () => {
    ;(mockDb.opportunity.findMany as Mock).mockResolvedValue([
      listing({ id: 'full', seats: 1, applications: [{ stage: 'STARTED' }] }),
      listing({ id: 'open', seats: 2, applications: [] }),
    ])

    const { open } = await residentOpportunityBoard('res-1')

    expect(open.map((row) => row.id)).toEqual(['open', 'full'])
  })

  it('scopes the applications it returns to the asking resident', async () => {
    await residentOpportunityBoard('res-1')

    const where = (mockDb.opportunityApplication.findMany as Mock).mock.calls[0][0].where
    expect(whereParts(where)).toEqual({ residentId: 'res-1' })
  })
})

describe('how to reach the organisation, and when', () => {
  /**
   * The same rule as the applicant rows above, one field further in.
   * `with: { opportunity: true }` selects EVERY column, so the board was
   * shipping an employer's direct line to anyone who had pressed "Ich habe
   * Interesse" — not rendered, but present, which is the distinction this file
   * exists to keep.
   *
   * The reason it matters here is not secrecy. These residents hold permits
   * that constrain work, `permitRequirementIsStated` exists so that a listing
   * cannot claim otherwise, and someone arranging a job directly at INTERESTED
   * has gone around the one person who checks which route applies.
   */
  const withContact = (stage: string) => ({
    id: 'app-1',
    opportunityId: 'opp-1',
    stage,
    opportunity: listing({
      contactName: 'R. Meier',
      contactEmail: 'r.meier@example.org',
      contactPhone: '044 000 00 00',
      website: 'https://example.org',
    }),
  })

  it.each(['INTERESTED', 'APPLIED', 'INTERVIEW', 'DECLINED'])(
    'is withheld at %s — stripped from the row, not hidden in the markup',
    async (stage) => {
      ;(mockDb.opportunityApplication.findMany as Mock).mockResolvedValue([withContact(stage)])

      const { mine } = await residentOpportunityBoard('res-1')

      expect(mine[0].opportunity).toMatchObject({
        contactName: null,
        contactEmail: null,
        contactPhone: null,
        website: null,
      })
    },
  )

  it.each(['ACCEPTED', 'STARTED', 'ENDED'])(
    'is handed over at %s — otherwise they cannot turn up',
    async (stage) => {
      ;(mockDb.opportunityApplication.findMany as Mock).mockResolvedValue([withContact(stage)])

      const { mine } = await residentOpportunityBoard('res-1')

      expect(mine[0].opportunity.contactEmail).toBe('r.meier@example.org')
    },
  )

  it('never appears on the open board, where nobody has been accepted', async () => {
    ;(mockDb.opportunity.findMany as Mock).mockResolvedValue([
      listing({ contactEmail: 'r.meier@example.org', contactPhone: '044 000 00 00' }),
    ])

    const { open } = await residentOpportunityBoard('res-1')

    expect(open[0]).not.toHaveProperty('contactEmail')
    expect(open[0]).not.toHaveProperty('contactPhone')
  })
})
