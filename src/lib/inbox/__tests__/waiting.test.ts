/**
 * Which requests reach whose Eingang.
 *
 * The rule under test: a request is shown to everyone who may ANSWER it, in
 * the half of the integration domain they work — not only to the holder of the
 * resident's care seat, which left unassigned residents on no screen at all.
 */

import { PgDialect } from 'drizzle-orm/pg-core'
import { OPPORTUNITY_KINDS, WORK_OPPORTUNITY_KINDS } from '@/lib/config/opportunities'
import { ALL_DEMO_RESIDENT_CODE_PREFIXES } from '@/lib/demo/config'
import { REAL_WORLD, type ViewerWorld } from '@/lib/demo/world'
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
    await expect(waitingApplications(own('BETREUUNG'), REAL_WORLD)).resolves.toEqual([])
  })
})

/**
 * The live bug: the REAL Jobcoach's Eingang said 2, and both were invented
 * residents ("Elena", "Grace"). The list and the badge share one WHERE, so
 * proving it narrows by world proves both.
 */
describe("waiting requests follow the viewer's world", () => {
  const dialect = new PgDialect()
  const realWorld: ViewerWorld = { isDemo: false, demoStaffIds: new Set(['demo-staff']) }
  const demoWorld: ViewerWorld = { isDemo: true, demoStaffIds: new Set(['demo-staff']) }
  const render = (world: ViewerWorld) =>
    dialect.sqlToQuery(waitingApplicationsWhere(WORK_OPPORTUNITY_KINDS, world)!)

  it('a real viewer: every demo prefix is EXCLUDED from the residents asked about', () => {
    const { sql, params } = render(realWorld)
    expect(sql).toMatch(/not \(?\(?"Resident"\."code" like/i)
    for (const prefix of ALL_DEMO_RESIDENT_CODE_PREFIXES) expect(params).toContain(`${prefix}%`)
  })

  it('a demo viewer: ONLY demo-prefixed residents', () => {
    const { sql, params } = render(demoWorld)
    expect(sql).not.toMatch(/not \(?\(?"Resident"\."code"/i)
    expect(sql).toMatch(/"Resident"\."code" like/i)
    for (const prefix of ALL_DEMO_RESIDENT_CODE_PREFIXES) expect(params).toContain(`${prefix}%`)
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

    await waitingApplications(own('JOBCOACH'), realWorld)

    expect(dialect.sqlToQuery(captured as never)).toEqual(render(realWorld))
  })

  it('the nav badge resolves the viewer by id and counts only their world', async () => {
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
    mockSelect.mockImplementation((fields: Record<string, unknown>) =>
      'n' in fields
        ? countChain
        : // the demo staff lookup: simon is not among them
          { from: () => ({ where: () => Promise.resolve([{ id: 'demo-staff' }]) }) },
    )
    mockFactQueue.mockResolvedValue([
      { id: 'f1', resident: { code: `${ALL_DEMO_RESIDENT_CODE_PREFIXES[0]}3` } },
      { id: 'f2', resident: { code: 'KL-REAL01' } },
    ])

    const counts = await waitingCounts(viewer)

    const rendered = wheres.map((w) => dialect.sqlToQuery(w as never))
    expect(rendered).toContainEqual(render(realWorld))
    // One demo, one real pending fact: the real Jobcoach is asked about one.
    expect(counts.approvals).toBe(1)
  })
})
