/**
 * Staff survey actions: the right permission, refusals returned, the audience
 * resolved AS THE SENDER, and audit entries that carry counts — never the
 * list of people invited.
 */

import { survey, surveyInvitation } from '@/lib/db'
import { SURVEY_LABELS } from '@/lib/constants/labels/surveys'
import { closeSurvey, createSurvey, sendSurvey } from '../surveys'

const E = SURVEY_LABELS.errors

const mockRequirePermission = vi.fn()
const mockFindSurvey = vi.fn()
const mockInsertReturning = vi.fn()
const mockUpdateReturning = vi.fn()
const mockResolve = vi.fn()
const mockAudit = vi.fn()
const inserted: { table: unknown; values: unknown }[] = []
const updated: { table: unknown; values: unknown }[] = []

function insertChain(table: unknown) {
  return {
    values: (values: unknown) => {
      inserted.push({ table, values })
      return {
        returning: () => Promise.resolve(mockInsertReturning(table, values)),
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve(mockInsertReturning(table, values)),
        }),
      }
    },
  }
}
function updateChain(table: unknown) {
  return {
    set: (values: unknown) => {
      updated.push({ table, values })
      const where = () => {
        const result = Promise.resolve(undefined) as Promise<unknown> & { returning: () => unknown }
        result.returning = () => Promise.resolve(mockUpdateReturning(table, values))
        return result
      }
      return { where }
    },
  }
}

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: { survey: { findFirst: (...a: unknown[]) => mockFindSurvey(...a) } },
    insert: insertChain,
    update: updateChain,
    transaction: (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ insert: insertChain, update: updateChain }),
  },
}))
vi.mock('@/lib/auth', async () => ({
  requirePermission: (...a: unknown[]) => mockRequirePermission(...a),
}))
vi.mock('@/lib/surveys/audience', async () => ({
  resolveSurveyAudience: (...a: unknown[]) => mockResolve(...a),
}))
vi.mock('@/lib/audit', async () => ({ logAudit: (...a: unknown[]) => mockAudit(...a) }))
vi.mock('@/lib/logger', async () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), errorWithCause: vi.fn() },
}))
vi.mock('next/cache', async () => ({ revalidatePath: vi.fn() }))

function form(entries: [string, string][]): FormData {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

const SENDER = {
  id: 'sender',
  role: 'BETREUUNG',
  scope: 'OWN_DOMAIN',
  isSystemAdmin: false,
  siteAccess: 'ASSIGNED_UNITS',
  assignedUnitIds: ['unit-a'],
}

beforeEach(() => {
  vi.clearAllMocks()
  inserted.length = 0
  updated.length = 0
  mockRequirePermission.mockResolvedValue(SENDER)
  mockFindSurvey.mockResolvedValue({ id: 'survey-1', status: 'DRAFT' })
  mockInsertReturning.mockImplementation((table: unknown, values: unknown) =>
    table === surveyInvitation
      ? (values as unknown[]).map((_, i) => ({ id: `inv-${i}` }))
      : [{ id: 'survey-1' }],
  )
  mockUpdateReturning.mockReturnValue([{ id: 'survey-1' }])
  mockResolve.mockResolvedValue({ ok: true, residentIds: ['r1', 'r2', 'r3'] })
})

describe('createSurvey', () => {
  const valid: [string, string][] = [
    ['templateId', 'leben-in-der-wohnung'],
    ['title', 'Leben in der Wohnung'],
    ['intro', ''],
    ['minResponses', '5'],
  ]

  it('asks for surveys:write and snapshots the template questions', async () => {
    await expect(createSurvey({}, form(valid))).resolves.toEqual({ ok: true, surveyId: 'survey-1' })
    expect(mockRequirePermission).toHaveBeenCalledWith('surveys:write')
    const row = inserted[0]
    expect(row.table).toBe(survey)
    expect(row.values).toMatchObject({
      templateId: 'leben-in-der-wohnung',
      intro: null,
      minResponses: 5,
      createdByUserId: 'sender',
    })
    expect((row.values as { questions: unknown[] }).questions).toHaveLength(21)
  })

  it.each([
    ['k below the floor', [...valid.slice(0, 3), ['minResponses', '2']], E.minResponses(3, 50)],
    ['k not a number', [...valid.slice(0, 3), ['minResponses', 'viele']], E.minResponses(3, 50)],
    ['no title', [valid[0], ['title', '  '], valid[2], valid[3]], E.titleRequired],
    ['an unknown template', [['templateId', 'nope'], ...valid.slice(1)], E.templateUnknown],
  ] as [string, [string, string][], string][])(
    'returns a refusal for %s',
    async (_l, entries, error) => {
      await expect(createSurvey({}, form(entries))).resolves.toEqual({ error })
      expect(inserted).toEqual([])
    },
  )
})

describe('sendSurvey', () => {
  it('resolves a saved group AS THE SENDER and opens the draft', async () => {
    const state = await sendSurvey(
      {},
      form([
        ['id', 'survey-1'],
        ['audience', 'group'],
        ['groupId', 'group-1'],
      ]),
    )
    expect(state).toEqual({ ok: true, surveyId: 'survey-1', invited: 3 })
    expect(mockRequirePermission).toHaveBeenCalledWith('surveys:write')
    expect(mockResolve).toHaveBeenCalledWith({ kind: 'group', groupId: 'group-1' }, SENDER)
    expect(inserted[0]).toEqual({
      table: surveyInvitation,
      values: [
        { surveyId: 'survey-1', residentId: 'r1' },
        { surveyId: 'survey-1', residentId: 'r2' },
        { surveyId: 'survey-1', residentId: 'r3' },
      ],
    })
    expect(updated[0]).toMatchObject({ table: survey, values: { status: 'OPEN' } })
  })

  it('passes chosen individuals through the same resolution', async () => {
    await sendSurvey(
      {},
      form([
        ['id', 'survey-1'],
        ['audience', 'individuals'],
        ['residentIds', 'r1'],
        ['residentIds', 'r9'],
      ]),
    )
    expect(mockResolve).toHaveBeenCalledWith(
      { kind: 'individuals', residentIds: ['r1', 'r9'] },
      SENDER,
    )
  })

  it('audits a count, never the people', async () => {
    await sendSurvey(
      {},
      form([
        ['id', 'survey-1'],
        ['audience', 'group'],
        ['groupId', 'group-1'],
      ]),
    )
    const audited = JSON.stringify(mockAudit.mock.calls)
    expect(audited).toContain('"invited":3')
    for (const id of ['r1', 'r2', 'r3']) expect(audited).not.toContain(`"${id}"`)
  })

  it('does not re-open an OPEN survey, only invites more', async () => {
    mockFindSurvey.mockResolvedValue({ id: 'survey-1', status: 'OPEN' })
    await sendSurvey(
      {},
      form([
        ['id', 'survey-1'],
        ['audience', 'individuals'],
        ['residentIds', 'r1'],
      ]),
    )
    expect(updated).toEqual([])
    expect(inserted).toHaveLength(1)
  })

  it.each([
    [
      'a closed survey',
      () => mockFindSurvey.mockResolvedValue({ id: 'survey-1', status: 'CLOSED' }),
      E.notSendable,
    ],
    ['an unknown survey', () => mockFindSurvey.mockResolvedValue(undefined), E.notFound],
    [
      'a vanished group',
      () => mockResolve.mockResolvedValue({ ok: false, reason: 'group-not-found' }),
      E.groupNotFound,
    ],
    [
      'a group the config rejects',
      () => mockResolve.mockResolvedValue({ ok: false, reason: 'group-invalid' }),
      E.groupInvalid,
    ],
    [
      'an audience nobody can receive',
      () => mockResolve.mockResolvedValue({ ok: false, reason: 'empty' }),
      E.emptyAudience,
    ],
  ])('returns a refusal for %s', async (_label, arrange, error) => {
    arrange()
    const state = await sendSurvey(
      {},
      form([
        ['id', 'survey-1'],
        ['audience', 'group'],
        ['groupId', 'group-1'],
      ]),
    )
    expect(state).toEqual({ error })
    expect(inserted).toEqual([])
  })

  it('refuses when no audience was chosen', async () => {
    const state = await sendSurvey(
      {},
      form([
        ['id', 'survey-1'],
        ['audience', 'individuals'],
      ]),
    )
    expect(state).toEqual({ error: E.noAudience })
    expect(mockResolve).not.toHaveBeenCalled()
  })
})

describe('closeSurvey', () => {
  it('closes an open survey', async () => {
    await expect(closeSurvey({}, form([['id', 'survey-1']]))).resolves.toEqual({
      ok: true,
      surveyId: 'survey-1',
    })
    expect(updated[0]).toMatchObject({ table: survey, values: { status: 'CLOSED' } })
  })

  it('returns a refusal when it was not open', async () => {
    mockUpdateReturning.mockReturnValue([])
    mockFindSurvey.mockResolvedValue({ id: 'survey-1' })
    await expect(closeSurvey({}, form([['id', 'survey-1']]))).resolves.toEqual({ error: E.notOpen })
  })
})
