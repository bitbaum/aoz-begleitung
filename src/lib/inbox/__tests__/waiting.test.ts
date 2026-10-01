/**
 * Which requests reach whose Eingang.
 *
 * The rule under test: a request is shown to everyone who may ANSWER it, in
 * the half of the integration domain they work — not only to the holder of the
 * resident's care seat, which left unassigned residents on no screen at all.
 */

import { PgDialect } from 'drizzle-orm/pg-core'
import { OPPORTUNITY_KINDS, WORK_OPPORTUNITY_KINDS } from '@/lib/config/opportunities'
import { hasPermission } from '@/lib/auth/role-policy'
import {
  answerableOpportunityKinds,
  waitingApplications,
  waitingApplicationsWhere,
  waitingCounts,
} from '../waiting'

const mockFactQueue = vi.fn()
vi.mock('@/lib/client-facts/queue', () => ({
  pendingFactQueue: (...a: unknown[]) => mockFactQueue(...a),
}))

const mockSelect = vi.fn()

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db/schema')),
  ...(await vi.importActual<object>('@/lib/db/helpers')),
  db: { select: (...a: unknown[]) => mockSelect(...a) },
}))

beforeEach(() => {
  mockSelect.mockReset()
  mockSelect.mockImplementation(() => {
    throw new Error('a viewer who may not answer must never reach the database')
  })
})

const own = (role: string) => ({ role, scope: 'OWN_DOMAIN', isSystemAdmin: false }) as never

describe('answerableOpportunityKinds', () => {
  it('gives a Jobcoach the job half', () => {
    expect(answerableOpportunityKinds(own('JOBCOACH'))).toEqual(WORK_OPPORTUNITY_KINDS)
  })

  it('gives Freiwilligenarbeit everything that is not a job', () => {
    const kinds = answerableOpportunityKinds(own('FREIWILLIGENARBEIT'))
    expect(kinds.length).toBeGreaterThan(0)
    for (const kind of kinds) expect(WORK_OPPORTUNITY_KINDS).not.toContain(kind)
  })

  it('together the two halves cover every kind — no request falls between them', () => {
    const covered = new Set([
      ...answerableOpportunityKinds(own('JOBCOACH')),
      ...answerableOpportunityKinds(own('FREIWILLIGENARBEIT')),
    ])
    expect([...covered].sort()).toEqual([...OPPORTUNITY_KINDS].sort())
  })

  it('gives anyone with reach over every domain every kind', () => {
    const viewer = { role: 'JOBCOACH', scope: 'ALL_DOMAINS', isSystemAdmin: false } as never
    expect(answerableOpportunityKinds(viewer)).toEqual(OPPORTUNITY_KINDS)
  })
})

describe('waitingApplications', () => {
  it('returns nothing, without a query, to someone who may not answer', async () => {
    // Betreuung reads the board and may not act on it.
    await expect(waitingApplications(own('BETREUUNG'))).resolves.toEqual([])
  })
})

describe('the list and the badge share one WHERE', () => {
  const dialect = new PgDialect()
  const render = () => dialect.sqlToQuery(waitingApplicationsWhere(WORK_OPPORTUNITY_KINDS)!)

  it('narrows to the listing kinds this viewer answers', () => {
    const { sql, params } = render()
    expect(sql).toMatch(/"Opportunity"\."kind" in/i)
    for (const kind of WORK_OPPORTUNITY_KINDS) expect(params).toContain(kind)
  })

  it('the Eingang list query carries that WHERE', async () => {
    let captured: unknown
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      where: (where: unknown) => {
        captured = where
        return chain
      },
      orderBy: () => Promise.resolve([]),
    }
    mockSelect.mockReturnValue(chain)

    await waitingApplications(own('JOBCOACH'))

    expect(dialect.sqlToQuery(captured as never)).toEqual(render())
  })

  it('the nav badge counts the same requests and every pending fact', async () => {
    const viewer = {
      id: 'simon',
      role: 'JOBCOACH',
      scope: 'OWN_DOMAIN',
      isSystemAdmin: false,
    } as never
    // Both queues under test must be ones this viewer works, or the test
    // would pass by skipping them.
    expect(hasPermission(viewer, 'opportunities:write')).toBe(true)
    expect(hasPermission(viewer, 'clientFacts:read')).toBe(true)
    const wheres: unknown[] = []
    const countChain = {
      from: () => countChain,
      innerJoin: () => countChain,
      where: (where: unknown) => {
        wheres.push(where)
        return Promise.resolve([{ n: 0 }])
      },
    }
    mockSelect.mockReturnValue(countChain)
    mockFactQueue.mockResolvedValue([
      { id: 'f1', resident: { code: 'KL-AAAA01' } },
      { id: 'f2', resident: { code: 'KL-REAL01' } },
    ])

    const counts = await waitingCounts(viewer)

    const rendered = wheres.map((w) => dialect.sqlToQuery(w as never))
    expect(rendered).toContainEqual(render())
    expect(counts.approvals).toBe(2)
  })
})
