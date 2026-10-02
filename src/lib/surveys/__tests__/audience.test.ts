/**
 * The audience is resolved as the SENDER: a group through
 * `resolveGroupMembers(group, sender)`, everything through the sender's site
 * scope, and never placeholders or exited clients.
 */

import { PgDialect } from 'drizzle-orm/pg-core'
import { resolveSurveyAudience, surveyRecipientWhere } from '../audience'

const mockFindGroup = vi.fn()
const mockResolveGroup = vi.fn()
const mockRecipients = vi.fn()
const whereSeen: unknown[] = []

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: { clientGroup: { findFirst: (...a: unknown[]) => mockFindGroup(...a) } },
    select: () => ({
      from: () => ({
        where: (where: unknown) => {
          whereSeen.push(where)
          return { orderBy: () => Promise.resolve(mockRecipients()) }
        },
      }),
    }),
  },
}))
vi.mock('@/lib/client-groups/resolve', async () => ({
  ...(await vi.importActual<object>('@/lib/client-groups/resolve')),
  resolveGroupMembers: (...a: unknown[]) => mockResolveGroup(...a),
}))

const SENDER = { id: 'sender', siteAccess: 'ASSIGNED_UNITS' as const, assignedUnitIds: ['unit-a'] }
const EVERYWHERE = { id: 'sender', siteAccess: 'ALL_UNITS' as const, assignedUnitIds: [] }

beforeEach(() => {
  vi.clearAllMocks()
  whereSeen.length = 0
  mockFindGroup.mockResolvedValue({ id: 'group-1', filters: { lang: ['AR'] } })
  mockResolveGroup.mockResolvedValue(['r1', 'r2'])
  mockRecipients.mockReturnValue([{ id: 'r1' }, { id: 'r2' }])
})

describe('resolveSurveyAudience', () => {
  it('resolves a group with the sender as the viewer', async () => {
    const now = new Date('2026-10-02T10:00:00Z')
    await expect(
      resolveSurveyAudience({ kind: 'group', groupId: 'group-1' }, SENDER, now),
    ).resolves.toEqual({
      ok: true,
      residentIds: ['r1', 'r2'],
    })
    expect(mockResolveGroup).toHaveBeenCalledWith(
      { id: 'group-1', filters: { lang: ['AR'] } },
      SENDER,
      now,
    )
  })

  it.each([
    ['a missing group', () => mockFindGroup.mockResolvedValue(undefined), 'group-not-found'],
    [
      'a group whose filters no longer validate',
      () => mockResolveGroup.mockRejectedValue(new Error('x')),
      'group-invalid',
    ],
    ['a group with nobody in it', () => mockResolveGroup.mockResolvedValue([]), 'empty'],
    ['nobody left after eligibility', () => mockRecipients.mockReturnValue([]), 'empty'],
  ])('refuses %s', async (_label, arrange, reason) => {
    arrange()
    await expect(
      resolveSurveyAudience({ kind: 'group', groupId: 'group-1' }, SENDER),
    ).resolves.toEqual({
      ok: false,
      reason,
    })
  })

  it('narrows individually chosen clients to who the sender may invite', async () => {
    mockRecipients.mockReturnValue([{ id: 'r1' }])
    await expect(
      resolveSurveyAudience({ kind: 'individuals', residentIds: ['r1', 'r1', 'outside'] }, SENDER),
    ).resolves.toEqual({ ok: true, residentIds: ['r1'] })
    expect(mockResolveGroup).not.toHaveBeenCalled()
  })
})

describe('surveyRecipientWhere', () => {
  const sql = (viewer: typeof SENDER | typeof EVERYWHERE) => {
    const where = surveyRecipientWhere(viewer, ['r1'])
    if (!where) throw new Error('expected a where')
    return new PgDialect().sqlToQuery(where).sql
  }

  it('excludes placeholders and exited clients for every sender', () => {
    for (const viewer of [SENDER, EVERYWHERE]) {
      const text = sql(viewer)
      expect(text).toContain('"isPlaceholder"')
      expect(text).toContain('"status" <>')
    }
  })

  it('applies the sender’s site scope only when they have one', () => {
    expect(sql(SENDER).length).toBeGreaterThan(sql(EVERYWHERE).length)
  })
})
