/**
 * Recording an answer: one transaction, the invitation flipped, the response
 * written with exactly three keys — and nothing for anyone not invited or
 * already answered.
 */

import { surveyInvitation, surveyResponse } from '@/lib/db'
import { recordSurveyResponse, surveyDay } from '../submit'

const mockInvitationRows = vi.fn()
const mockFlipped = vi.fn()
const inserts: { table: unknown; values: unknown }[] = []
const updates: { table: unknown; values: unknown }[] = []
const mockTransaction = vi.fn()

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    transaction: (callback: (tx: unknown) => Promise<unknown>) => {
      mockTransaction()
      const tx = {
        select: () => ({
          from: () => ({ where: () => ({ limit: () => Promise.resolve(mockInvitationRows()) }) }),
        }),
        update: (table: unknown) => ({
          set: (values: unknown) => ({
            where: () => ({
              returning: () => {
                updates.push({ table, values })
                return Promise.resolve(mockFlipped())
              },
            }),
          }),
        }),
        insert: (table: unknown) => ({
          values: (values: unknown) => {
            inserts.push({ table, values })
            return Promise.resolve()
          },
        }),
      }
      return callback(tx)
    },
  },
}))

const INPUT = {
  surveyId: 'survey-1',
  residentId: 'resident-1',
  answers: { cooking: 'yes' },
  now: new Date('2026-10-02T21:30:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  inserts.length = 0
  updates.length = 0
  mockInvitationRows.mockReturnValue([{ id: 'inv-1', answered: false }])
  mockFlipped.mockReturnValue([{ id: 'inv-1' }])
})

describe('recordSurveyResponse', () => {
  it('flips the invitation and writes a response with no identity, in one transaction', async () => {
    await expect(recordSurveyResponse(INPUT)).resolves.toBe('ok')
    expect(mockTransaction).toHaveBeenCalledTimes(1)

    expect(updates).toEqual([{ table: surveyInvitation, values: { answered: true } }])
    expect(inserts).toHaveLength(1)
    expect(inserts[0].table).toBe(surveyResponse)
    // Exactly these keys. A resident id, an invitation id or a timestamp here
    // would make the answer attributable.
    expect(inserts[0].values).toEqual({
      surveyId: 'survey-1',
      answers: { cooking: 'yes' },
      submittedOn: '2026-10-02',
    })
    expect(JSON.stringify(inserts[0].values)).not.toContain('resident-1')
    expect(JSON.stringify(inserts[0].values)).not.toContain('inv-1')
  })

  it.each([
    ['not invited', [], undefined, 'not-invited'],
    ['already answered', [{ id: 'inv-1', answered: true }], undefined, 'already-answered'],
    // Two submits racing: the guarded update flips nothing for the second.
    ['lost the race', [{ id: 'inv-1', answered: false }], [], 'already-answered'],
  ])('refuses when %s, writing no response', async (_label, rows, flipped, outcome) => {
    mockInvitationRows.mockReturnValue(rows)
    if (flipped) mockFlipped.mockReturnValue(flipped)
    await expect(recordSurveyResponse(INPUT)).resolves.toBe(outcome)
    expect(inserts).toEqual([])
  })
})

describe('surveyDay', () => {
  it.each([
    ['late evening UTC is already tomorrow in Zurich', '2026-10-02T22:30:00Z', '2026-10-03'],
    ['midday', '2026-10-02T11:00:00Z', '2026-10-02'],
  ])('%s', (_label, iso, day) => {
    expect(surveyDay(new Date(iso))).toBe(day)
  })

  it('is a date with no time component', () => {
    expect(surveyDay(new Date())).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
