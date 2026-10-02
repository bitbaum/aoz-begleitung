/**
 * Who a survey goes to — resolved AS THE SENDER.
 *
 * Two ways to name an audience: a saved client group (`ClientGroup`, a saved
 * filter) or individual clients. Either way the result passes through the
 * sender's own site scope, so a survey can never reach somebody the sender
 * cannot see on the client list. A group's `seat: mine` means the SENDER's
 * caseload, because `resolveGroupMembers` resolves for the viewer it is given.
 *
 * Two kinds of client are never invited, whatever the audience says:
 *  - placeholder profiles (`isPlaceholder`): nobody has claimed them, so an
 *    invitation would only inflate "eingeladen" with people who do not exist;
 *  - EXITED clients: a survey about living in the flat is not theirs to get.
 */

import { and, asc, eq, inArray, ne, type SQL } from 'drizzle-orm'
import { db, clientGroup, resident } from '@/lib/db'
import { residentScopeFilter } from '@/lib/auth/site-access'
import {
  groupMembersWhere,
  parseGroupFilters,
  resolveGroupMembers,
  type GroupViewer,
} from '@/lib/client-groups/resolve'

export type SurveyAudience =
  { kind: 'group'; groupId: string } | { kind: 'individuals'; residentIds: string[] }

export type ResolvedAudience =
  | { ok: true; residentIds: string[] }
  | { ok: false; reason: 'group-not-found' | 'group-invalid' | 'empty' }

/** The `where` for clients who may receive a survey from `viewer`. Pure. */
export function surveyRecipientWhere(
  viewer: GroupViewer,
  candidateIds: readonly string[],
): SQL | undefined {
  return and(
    inArray(resident.id, [...candidateIds]),
    eq(resident.isPlaceholder, false),
    ne(resident.status, 'EXITED'),
    residentScopeFilter(viewer) ?? undefined,
  )
}

export interface AudienceOptions {
  groups: { id: string; name: string; memberCount: number | null }[]
  clients: { id: string; code: string; displayName: string | null }[]
}

/**
 * What the sender can pick from: every saved group (with its size as THEY
 * would resolve it) and every client they could invite individually.
 */
export async function loadAudienceOptions(
  viewer: GroupViewer,
  now: Date = new Date(),
): Promise<AudienceOptions> {
  const [groupRows, clients] = await Promise.all([
    db
      .select({ id: clientGroup.id, name: clientGroup.name, filters: clientGroup.filters })
      .from(clientGroup)
      .orderBy(asc(clientGroup.name)),
    db
      .select({ id: resident.id, code: resident.code, displayName: resident.displayName })
      .from(resident)
      .where(
        and(
          eq(resident.isPlaceholder, false),
          ne(resident.status, 'EXITED'),
          residentScopeFilter(viewer) ?? undefined,
        ),
      )
      .orderBy(asc(resident.displayName), asc(resident.code)),
  ])
  const groups = await Promise.all(
    groupRows.map(async (row) => {
      const parsed = parseGroupFilters(row.filters)
      const memberCount = parsed.success
        ? await db.$count(resident, groupMembersWhere(parsed.data, viewer, now))
        : null
      return { id: row.id, name: row.name, memberCount }
    }),
  )
  return { groups, clients }
}

export async function resolveSurveyAudience(
  audience: SurveyAudience,
  viewer: GroupViewer,
  now: Date = new Date(),
): Promise<ResolvedAudience> {
  let candidates: string[]
  if (audience.kind === 'group') {
    const group = await db.query.clientGroup.findFirst({
      where: eq(clientGroup.id, audience.groupId),
      columns: { id: true, filters: true },
    })
    if (!group) return { ok: false, reason: 'group-not-found' }
    try {
      candidates = await resolveGroupMembers(group, viewer, now)
    } catch {
      return { ok: false, reason: 'group-invalid' }
    }
  } else {
    candidates = Array.from(new Set(audience.residentIds))
  }

  if (candidates.length === 0) return { ok: false, reason: 'empty' }

  const rows = await db
    .select({ id: resident.id })
    .from(resident)
    .where(surveyRecipientWhere(viewer, candidates))
    .orderBy(asc(resident.id))
  if (rows.length === 0) return { ok: false, reason: 'empty' }
  return { ok: true, residentIds: rows.map((row) => row.id) }
}
