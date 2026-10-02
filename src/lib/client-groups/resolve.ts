/**
 * Who is in a saved group — computed now, from its filters, for one viewer.
 *
 * A group is a name on a set of filters (`config/client-filters.ts`), never a
 * stored list of people, so membership is always current: whoever matches the
 * filters today AND is visible to the person asking. The viewer's site scope
 * applies exactly as it does on the list page — a group can narrow what
 * somebody sees, never widen it.
 *
 * `mine` in a stored group means the VIEWER's caseload. A survey module that
 * resolves a group should therefore resolve it as the person sending it.
 */

import { and, asc, type SQL } from 'drizzle-orm'
import { db, resident } from '@/lib/db'
import { residentScopeFilter, type SiteCapabilities } from '@/lib/auth/site-access'
import {
  clientFilterStateSchema,
  clientFilterWhere,
  type ClientFilterState,
} from '@/lib/config/client-filters'

/** The person a group is resolved for. */
export interface GroupViewer extends SiteCapabilities {
  id: string
}

/**
 * Who may rename or delete a group: whoever made it, and the system
 * administration. Everybody else with the list may USE it.
 */
export function mayManageClientGroup(
  viewer: { id: string; isSystemAdmin: boolean },
  group: { createdByUserId: string },
): boolean {
  return viewer.isSystemAdmin || group.createdByUserId === viewer.id
}

/** Thrown when a stored group no longer validates against the filter config. */
export class InvalidGroupFiltersError extends Error {
  constructor(groupId: string) {
    super(`ClientGroup ${groupId} holds filters the current config rejects`)
    this.name = 'InvalidGroupFiltersError'
  }
}

/**
 * Validate a group's stored JSON. Strict, like the save path: a filter the
 * config no longer knows is refused rather than dropped, because dropping it
 * would WIDEN the group behind everyone's back.
 */
export function parseGroupFilters(
  filters: unknown,
): { success: true; data: ClientFilterState } | { success: false } {
  const parsed = clientFilterStateSchema.safeParse(filters)
  return parsed.success ? { success: true, data: parsed.data } : { success: false }
}

/** The full `where` for a group's members as seen by `viewer`. Pure. */
export function groupMembersWhere(
  state: ClientFilterState,
  viewer: GroupViewer,
  now: Date,
): SQL | undefined {
  return and(
    residentScopeFilter(viewer) ?? undefined,
    clientFilterWhere(state, { viewerId: viewer.id, now }),
  )
}

/** Resident ids in `group`, for `viewer`, right now. */
export async function resolveGroupMembers(
  group: { id: string; filters: unknown },
  viewer: GroupViewer,
  now: Date = new Date(),
): Promise<string[]> {
  const parsed = parseGroupFilters(group.filters)
  if (!parsed.success) throw new InvalidGroupFiltersError(group.id)
  const rows = await db
    .select({ id: resident.id })
    .from(resident)
    .where(groupMembersWhere(parsed.data, viewer, now))
    .orderBy(asc(resident.id))
  return rows.map((row) => row.id)
}
