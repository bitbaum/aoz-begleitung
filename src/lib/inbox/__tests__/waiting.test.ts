/**
 * Which requests reach whose Eingang.
 *
 * The rule under test: a request is shown to everyone who may ANSWER it, in
 * the half of the integration domain they work — not only to the holder of the
 * resident's care seat, which left unassigned residents on no screen at all.
 */

import { OPPORTUNITY_KINDS, WORK_OPPORTUNITY_KINDS } from '@/lib/config/opportunities'
import { answerableOpportunityKinds, waitingApplications } from '../waiting'

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db/schema')),
  db: {
    select: () => {
      throw new Error('a viewer who may not answer must never reach the database')
    },
  },
}))

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
