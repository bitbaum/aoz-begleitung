import { describe, expect, it } from 'vitest'

import {
  INTEGRATION_BOARD_IDS,
  defaultIntegrationBoardForRole,
  resolveIntegrationBoard,
} from '@/lib/config/integration-boards'
import {
  OPPORTUNITY_KINDS,
  WORK_OPPORTUNITY_KINDS,
  boardOpportunityKinds,
} from '@/lib/config/opportunities'
import { boardKinds } from '@/lib/config/learning'
import { STAFF_ROLES } from '@/lib/auth/role-policy'

describe('the board a role works in', () => {
  it('opens each coach on their own half', () => {
    expect(defaultIntegrationBoardForRole('JOBCOACH')).toBe('job')
    expect(defaultIntegrationBoardForRole('FREIWILLIGENARBEIT')).toBe('volunteering')
  })

  it('opens the roles that span both halves on everything', () => {
    // Narrowing these would hide, not help: Betreuung and Sozialarbeit work
    // across both halves, and the all-domains Betreuerin's oversight is the point of that seat.
    expect(defaultIntegrationBoardForRole('BETREUUNG')).toBe('overview')
    expect(defaultIntegrationBoardForRole('SOZIALARBEIT')).toBe('overview')
    expect(defaultIntegrationBoardForRole('ADMIN')).toBe('overview')
  })

  it('gives every role a board, including one added later', () => {
    for (const role of STAFF_ROLES) {
      expect(INTEGRATION_BOARD_IDS).toContain(defaultIntegrationBoardForRole(role))
    }
  })

  it('lets an explicit choice beat the role default', () => {
    expect(resolveIntegrationBoard('volunteering', 'JOBCOACH')).toBe('volunteering')
    expect(resolveIntegrationBoard('overview', 'JOBCOACH')).toBe('overview')
  })

  it('falls back to the role when the parameter is absent or junk', () => {
    expect(resolveIntegrationBoard('', 'FREIWILLIGENARBEIT')).toBe('volunteering')
    expect(resolveIntegrationBoard('../etc', 'FREIWILLIGENARBEIT')).toBe('volunteering')
    expect(resolveIntegrationBoard('JOB', 'FREIWILLIGENARBEIT')).toBe('volunteering')
  })
})

describe('which listings land on each board', () => {
  it('sends work to the job board and everything else to volunteering', () => {
    expect(boardOpportunityKinds('job')).toEqual(WORK_OPPORTUNITY_KINDS)
    expect(boardOpportunityKinds('volunteering')).toEqual(['VOLUNTEERING', 'COMMUNITY_SERVICE'])
    expect(boardOpportunityKinds('overview')).toEqual(OPPORTUNITY_KINDS)
  })

  /**
   * The reason the split is DERIVED rather than written twice. A kind added to
   * the enum must land on exactly one coach's board — never on both (two people
   * think the other one has it) and never on neither (it exists and nobody sees
   * it, which is how a listing goes unworked).
   */
  it('partitions every kind across the two halves — no overlap, no gap', () => {
    const job = boardOpportunityKinds('job')
    const volunteering = boardOpportunityKinds('volunteering')

    expect(job.filter((kind) => volunteering.includes(kind))).toEqual([])
    expect([...job, ...volunteering].sort()).toEqual([...OPPORTUNITY_KINDS].sort())
  })

  it('agrees with the learning board about which kinds are volunteering', () => {
    // Two pages, one vocabulary. If these drift, the Freiwilligenarbeit coordinator's record board and the
    // directory disagree about what that role's own work is.
    expect(boardOpportunityKinds('volunteering')).toEqual(
      boardKinds('volunteering').filter((kind) =>
        (OPPORTUNITY_KINDS as readonly string[]).includes(kind),
      ),
    )
  })
})
