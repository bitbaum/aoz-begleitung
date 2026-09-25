/**
 * The integration domain splits in two, and BOTH pages that serve it split the
 * same way: `/learning` is what somebody has already done, `/opportunities` is
 * where they could go next. The Jobcoach works the job half, the Freiwilligenarbeit coordinator the volunteering
 * half, the all-domains Betreuerin sees everything.
 *
 * The board identity and the role default live here so those two pages cannot
 * come to disagree about which half a coach works in. What a board CONTAINS
 * stays with each page — learning boards hold courses and qualifications, which
 * are records and not places, and never will be.
 *
 * Why a default rather than a filter the coach sets: a filter that every user
 * sets to the same value on every visit is a question the product already knows
 * the answer to. `User.role` is that answer. The board stays switchable, so the
 * default costs nothing to the one person who wants the other half.
 */

import type { StaffRole } from '@/lib/auth/role-policy'

export const INTEGRATION_BOARD_IDS = ['overview', 'job', 'volunteering'] as const
export type IntegrationBoardId = (typeof INTEGRATION_BOARD_IDS)[number]

export function isIntegrationBoardId(value: string): value is IntegrationBoardId {
  return (INTEGRATION_BOARD_IDS as readonly string[]).includes(value)
}

/**
 * Which half of the integration domain this role works in.
 *
 * BETREUUNG and SOZIALARBEIT get `overview` deliberately: their work spans both
 * halves, so narrowing it for them would hide rather than help. Scope is not
 * consulted — `scope` governs whose client FILES you may open, and a directory
 * of places is nobody's file.
 */
export function defaultIntegrationBoardForRole(role: StaffRole): IntegrationBoardId {
  if (role === 'JOBCOACH') return 'job'
  if (role === 'FREIWILLIGENARBEIT') return 'volunteering'
  return 'overview'
}

/**
 * Resolve the board for a request: an explicit choice wins, otherwise the role
 * answers. Both pages call this, so "?board=" behaves identically on each.
 */
export function resolveIntegrationBoard(boardParam: string, role: StaffRole): IntegrationBoardId {
  return isIntegrationBoardId(boardParam) ? boardParam : defaultIntegrationBoardForRole(role)
}
