/**
 * The portal submit: refusals are returned as keys, and nothing anywhere
 * records "this client answered this survey" — no audit entry, no log line
 * carrying the client.
 */

import { submitSurveyResponse } from '../survey-responses'

const mockFindSurvey = vi.fn()
const mockRecord = vi.fn()
const mockResident = vi.fn()
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  errorWithCause: vi.fn(),
}))
const mockAudit = vi.fn()

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: { query: { survey: { findFirst: (...a: unknown[]) => mockFindSurvey(...a) } } },
}))
vi.mock('@/lib/surveys/submit', async () => ({
  recordSurveyResponse: (...a: unknown[]) => mockRecord(...a),
}))
vi.mock('@/lib/portal-auth', async () => ({ getPortalResident: () => mockResident() }))
vi.mock('@/lib/logger', async () => ({ logger: mockLogger }))
vi.mock('@/lib/audit', async () => ({ logAudit: (...a: unknown[]) => mockAudit(...a) }))
vi.mock('next/cache', async () => ({ revalidatePath: vi.fn() }))

const T = (de: string) => ({ de, en: de, fr: de, uk: de, ru: de, ar: de })
const QUESTIONS = [
  {
    id: 'cooking',
    type: 'single',
    prompt: T('Kochen?'),
    options: [
      { id: 'yes', label: T('Ja') },
      { id: 'no', label: T('Nein') },
    ],
  },
]

function form(entries: [string, string][]): FormData {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

const ANSWERED = form([
  ['surveyId', 'survey-1'],
  ['q:cooking', 'yes'],
])

beforeEach(() => {
  vi.clearAllMocks()
  mockResident.mockResolvedValue({ id: 'resident-1', code: 'KL-ABC123' })
  mockFindSurvey.mockResolvedValue({ status: 'OPEN', questions: QUESTIONS })
  mockRecord.mockResolvedValue('ok')
})

describe('submitSurveyResponse', () => {
  it('records the answer for the signed-in client and audits nothing', async () => {
    await expect(submitSurveyResponse({}, ANSWERED)).resolves.toEqual({ ok: true })
    expect(mockRecord).toHaveBeenCalledWith({
      surveyId: 'survey-1',
      residentId: 'resident-1',
      answers: { cooking: 'yes' },
    })
    expect(mockAudit).not.toHaveBeenCalled()
  })

  it.each([
    ['not signed in', () => mockResident.mockResolvedValue(null), 'signedOut'],
    ['an unknown survey', () => mockFindSurvey.mockResolvedValue(undefined), 'notInvited'],
    [
      'a draft survey',
      () => mockFindSurvey.mockResolvedValue({ status: 'DRAFT', questions: QUESTIONS }),
      'closed',
    ],
    [
      'a closed survey',
      () => mockFindSurvey.mockResolvedValue({ status: 'CLOSED', questions: QUESTIONS }),
      'closed',
    ],
    [
      'a client who was not invited',
      () => mockRecord.mockResolvedValue('not-invited'),
      'notInvited',
    ],
    ['a second answer', () => mockRecord.mockResolvedValue('already-answered'), 'alreadyAnswered'],
  ])('refuses %s', async (_label, arrange, error) => {
    arrange()
    await expect(submitSurveyResponse({}, ANSWERED)).resolves.toEqual({ error })
    expect(mockAudit).not.toHaveBeenCalled()
  })

  it('refuses an empty submission before touching the database', async () => {
    await expect(submitSurveyResponse({}, form([['surveyId', 'survey-1']]))).resolves.toEqual({
      error: 'empty',
    })
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('refuses an answer to a choice that does not exist', async () => {
    const bad = form([
      ['surveyId', 'survey-1'],
      ['q:cooking', 'maybe'],
    ])
    await expect(submitSurveyResponse({}, bad)).resolves.toEqual({ error: 'invalid' })
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('logs a failure without the client, the survey or the driver message', async () => {
    mockRecord.mockRejectedValue(new Error('Failed query: select … params: survey-1,resident-1'))
    await expect(submitSurveyResponse({}, ANSWERED)).resolves.toEqual({ error: 'failed' })
    const logged = JSON.stringify([
      ...mockLogger.error.mock.calls,
      ...mockLogger.errorWithCause.mock.calls,
      ...mockLogger.warn.mock.calls,
      ...mockLogger.info.mock.calls,
    ])
    expect(logged).not.toContain('resident-1')
    expect(logged).not.toContain('KL-ABC123')
    expect(logged).not.toContain('survey-1')
    expect(mockAudit).not.toHaveBeenCalled()
  })
})
