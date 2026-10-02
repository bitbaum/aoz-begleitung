/**
 * The staff applicant actions: who may be put forward, and how a thread moves.
 *
 * Observed live on 2026-10-01: a client was attached to a DRAFT job listing and
 * set straight to ENDED, which displayed «Nachweis erstellt». Every refusal
 * here is RETURNED — a thrown one reaches the error boundary as "Etwas ist
 * schiefgelaufen" and the coach never learns what to do instead.
 */

import { learningRecord, opportunityApplication } from '@/lib/db'
import { addApplicant, changeApplicationStage } from '../opportunities'
import { OPPORTUNITIES_ADMIN_LABELS as L } from '@/lib/constants/labels/opportunities'

const mockOpportunityFindFirst = vi.fn()
const mockApplicationFindFirst = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockTransaction = vi.fn()

/** One builder for both `db` and the transaction handle. */
const writer = {
  insert: (table: unknown) => ({
    values: (values: unknown) => {
      const result = mockInsert(table, values)
      // `await db.insert(t).values(v)` and `.returning()` are both used.
      return Object.assign(Promise.resolve(result), { returning: () => Promise.resolve(result) })
    },
  }),
  update: (table: unknown) => ({
    set: (values: unknown) => ({
      where: () => Promise.resolve(mockUpdate(table, values)),
    }),
  }),
}

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: {
      opportunity: { findFirst: (...a: unknown[]) => mockOpportunityFindFirst(...a) },
      opportunityApplication: {
        findFirst: (...a: unknown[]) => mockApplicationFindFirst(...a),
      },
    },
    insert: (table: unknown) => writer.insert(table),
    transaction: async (run: (tx: typeof writer) => Promise<void>) => {
      mockTransaction()
      await run(writer)
    },
  },
}))
vi.mock('next/cache', async () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', async () => ({ redirect: vi.fn() }))
vi.mock('@/lib/audit', async () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/portal-auth', async () => ({ getResidentCookie: vi.fn() }))
vi.mock('@/lib/logger', async () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), errorWithCause: vi.fn() },
}))
vi.mock('@/lib/auth', async () => ({
  requirePermission: vi.fn(async () => ({ id: 'staff-1', role: 'JOBCOACH' })),
}))

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.append(key, value)
  return data
}

const LISTING = {
  id: 'opp-1',
  kind: 'EMPLOYMENT',
  title: 'Fachleiter*in Velowerkstatt',
  organisation: 'AOZ',
  status: 'PUBLISHED',
}

function application(stage: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    opportunityId: LISTING.id,
    residentId: 'res-1',
    stage,
    learningRecordId: null,
    supportedByUserId: 'staff-1',
    opportunity: LISTING,
    ...overrides,
  }
}

const insertedInto = (table: unknown) =>
  mockInsert.mock.calls.filter(([target]) => target === table).map(([, values]) => values)

beforeEach(() => {
  vi.clearAllMocks()
  mockInsert.mockImplementation((table: unknown) =>
    table === learningRecord ? [{ id: 'lr-1' }] : undefined,
  )
})

describe('addApplicant', () => {
  const submit = () =>
    addApplicant({}, form({ opportunityId: LISTING.id, residentId: 'res-1', note: '' }))

  it.each(['DRAFT', 'ARCHIVED'])(
    'refuses a %s listing, by returning the reason',
    async (status) => {
      mockOpportunityFindFirst.mockResolvedValue({ status })

      const state = await submit()

      expect(state.error).toBe(L.refusals.attachNotPublished)
      expect(mockInsert).not.toHaveBeenCalled()
    },
  )

  it('attaches a person to a published listing', async () => {
    mockOpportunityFindFirst.mockResolvedValue({ status: 'PUBLISHED' })

    const state = await submit()

    expect(state).toEqual({})
    expect(insertedInto(opportunityApplication)).toEqual([
      expect.objectContaining({
        opportunityId: LISTING.id,
        residentId: 'res-1',
        stage: 'INTERESTED',
      }),
    ])
  })
})

describe('changeApplicationStage', () => {
  const move = (stage: string, extra: Record<string, string> = {}) =>
    changeApplicationStage({}, form({ applicationId: 'app-1', stage, ...extra }))

  it('refuses a jump the table does not allow — the live INTERESTED → ENDED', async () => {
    mockApplicationFindFirst.mockResolvedValue(application('INTERESTED'))

    const state = await move('ENDED')

    expect(state.error).toContain('Interessiert')
    expect(state.error).toContain('Beendet')
    // It names what IS possible, so the coach is not left guessing.
    expect(state.error).toContain('Bewerbung eingereicht')
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('refuses moving forward on a draft listing', async () => {
    mockApplicationFindFirst.mockResolvedValue(
      application('INTERESTED', { opportunity: { ...LISTING, status: 'DRAFT' } }),
    )

    const state = await move('APPLIED')

    expect(state.error).toBe(L.refusals.listingNotPublished)
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('still lets a person on a draft be declined', async () => {
    mockApplicationFindFirst.mockResolvedValue(
      application('INTERESTED', { opportunity: { ...LISTING, status: 'DRAFT' } }),
    )

    expect(await move('DECLINED')).toEqual({})
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it('reaching STARTED mints the evidence record exactly as before', async () => {
    mockApplicationFindFirst.mockResolvedValue(application('ACCEPTED'))

    expect(await move('STARTED')).toEqual({})

    expect(insertedInto(learningRecord)).toEqual([
      expect.objectContaining({
        residentId: 'res-1',
        kind: 'EMPLOYMENT',
        title: LISTING.title,
        provider: LISTING.organisation,
        status: 'IN_PROGRESS',
        recordedBy: 'STAFF',
      }),
    ])
    expect(mockUpdate).toHaveBeenCalledWith(
      opportunityApplication,
      expect.objectContaining({ stage: 'STARTED', learningRecordId: 'lr-1' }),
    )
  })

  it('does not mint a second record when one exists', async () => {
    mockApplicationFindFirst.mockResolvedValue(
      application('ACCEPTED', { learningRecordId: 'lr-existing' }),
    )

    await move('STARTED')

    expect(insertedInto(learningRecord)).toEqual([])
  })

  it('ENDED completes the record with the hours given', async () => {
    mockApplicationFindFirst.mockResolvedValue(application('STARTED', { learningRecordId: 'lr-1' }))

    expect(await move('ENDED', { hours: '12' })).toEqual({})

    expect(mockUpdate).toHaveBeenCalledWith(
      learningRecord,
      expect.objectContaining({ status: 'COMPLETED', hours: 12 }),
    )
  })

  it('treats a repeat of the current stage as done, not as an error', async () => {
    mockApplicationFindFirst.mockResolvedValue(application('APPLIED'))

    expect(await move('APPLIED')).toEqual({})
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns, never throws, for an application that does not exist', async () => {
    mockApplicationFindFirst.mockResolvedValue(undefined)

    expect(await move('APPLIED')).toEqual({ error: L.refusals.applicationNotFound })
  })
})
