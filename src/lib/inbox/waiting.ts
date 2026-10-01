/**
 * Who is waiting for a staff answer — the one definition the Eingang page and
 * the navigation badge both read.
 *
 * ## Why one module
 *
 * A badge that says 3 above a page that says 7 teaches people to ignore the
 * badge. So the badge counts exactly one thing — a PERSON who asked and has not
 * been answered — and the Eingang page renders those same rows at the top.
 * Everything else the page shows (check-ins due, conflict units, renewals) is
 * work the staff member schedules; it is on the page and deliberately not in
 * the number, because nobody is sitting on the other side of it waiting.
 *
 * ## Why an application is everyone's, not one coach's
 *
 * The dashboard used to surface a resident's "Ich habe Interesse" only to the
 * specialist who held that resident's care seat. A resident nobody was assigned
 * to — most of them, on a new instance — raised a hand that no screen showed
 * anyone. Now every staff member who may act on a listing sees the requests
 * for the listings of their half of the integration domain (the Jobcoach the jobs,
 * the Freiwilligenarbeit coordinator the volunteering, Leitung and Betreuung both), whoever holds the file.
 */

import { and, asc, countDistinct, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { hasPermission, type StaffCapabilities } from '@/lib/auth/role-policy'
import { defaultIntegrationBoardForRole } from '@/lib/config/integration-boards'
import { boardOpportunityKinds, type OpportunityKindId } from '@/lib/config/opportunities'
import { ownSeat } from '@/lib/client-facts/access'
import { pendingFactQueue } from '@/lib/client-facts/queue'
import { awaitingAnswerFilter } from '@/lib/data/opportunities'
import {
  db,
  message,
  opportunity,
  opportunityApplication,
  resident,
  transferRequest,
} from '@/lib/db'
import {
  residentCodeInWorld,
  residentsInWorld,
  staffViewerWorld,
  type ViewerWorld,
} from '@/lib/demo/world'
import { logger } from '@/lib/logger'
import { residentName } from '@/lib/utils/resident-name'

/** A staff viewer, with the id the seat-scoped queues need. */
export type WaitingViewer = StaffCapabilities & { id: string }

/**
 * The listing kinds whose requests this viewer answers.
 *
 * ALL_DOMAINS reaches every listing. Everyone else works the half of the
 * domain their role opens on — derived from the SAME function that picks the
 * board, so the Eingang can never send a coach requests the board hides.
 */
export function answerableOpportunityKinds(
  viewer: StaffCapabilities,
): readonly OpportunityKindId[] {
  const board =
    viewer.scope === 'ALL_DOMAINS' ? 'overview' : defaultIntegrationBoardForRole(viewer.role)
  return boardOpportunityKinds(board)
}

export interface WaitingApplication {
  applicationId: string
  opportunityId: string
  opportunityTitle: string
  residentId: string
  name: string
  since: Date
}

/**
 * The WHERE both the list and the badge count use: awaiting an answer, on a
 * listing this viewer answers, from a person in the viewer's world. A real
 * Jobcoach is never asked to answer an invented resident, and a demo door
 * never shows a real person's request. @see lib/demo/world.ts
 */
export function waitingApplicationsWhere(kinds: readonly OpportunityKindId[], world: ViewerWorld) {
  return and(
    awaitingAnswerFilter(),
    inArray(opportunity.kind, [...kinds]),
    residentCodeInWorld(resident.code, world),
  )
}

/** Requests nobody has picked up yet, oldest first. Empty without the verb. */
export async function waitingApplications(
  viewer: StaffCapabilities,
  world: ViewerWorld,
): Promise<WaitingApplication[]> {
  if (!hasPermission(viewer, 'opportunities:write')) return []
  const kinds = answerableOpportunityKinds(viewer)
  if (kinds.length === 0) return []

  const rows = await db
    .select({
      applicationId: opportunityApplication.id,
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      residentId: resident.id,
      code: resident.code,
      displayName: resident.displayName,
      since: opportunityApplication.createdAt,
    })
    .from(opportunityApplication)
    .innerJoin(opportunity, eq(opportunity.id, opportunityApplication.opportunityId))
    .innerJoin(resident, eq(resident.id, opportunityApplication.residentId))
    .where(waitingApplicationsWhere(kinds, world))
    .orderBy(asc(opportunityApplication.createdAt))

  return rows.map(({ code, displayName, ...row }) => ({
    ...row,
    name: residentName({ code, displayName }),
  }))
}

async function waitingApplicationCount(
  viewer: StaffCapabilities,
  world: ViewerWorld,
): Promise<number> {
  if (!hasPermission(viewer, 'opportunities:write')) return 0
  const kinds = answerableOpportunityKinds(viewer)
  if (kinds.length === 0) return 0
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(opportunityApplication)
    .innerJoin(opportunity, eq(opportunity.id, opportunityApplication.opportunityId))
    .innerJoin(resident, eq(resident.id, opportunityApplication.residentId))
    .where(waitingApplicationsWhere(kinds, world))
  return row?.n ?? 0
}

/**
 * Conversations where the resident wrote last and nobody has read it — the
 * same rule `staffInbox()` uses for `waitingSince`, as one COUNT rather than a
 * load of every message, because this runs on every staff page.
 */
async function waitingThreadCount(viewer: StaffCapabilities, world: ViewerWorld): Promise<number> {
  if (!hasPermission(viewer, 'messages:read')) return 0
  const [row] = await db
    .select({ n: countDistinct(message.threadId) })
    .from(message)
    .innerJoin(resident, eq(resident.id, message.authorResidentId))
    .where(
      and(
        isNotNull(message.authorResidentId),
        isNull(message.readAt),
        residentCodeInWorld(resident.code, world),
      ),
    )
  return Number(row?.n ?? 0)
}

async function pendingTransferCount(
  viewer: StaffCapabilities,
  world: ViewerWorld,
): Promise<number> {
  if (!hasPermission(viewer, 'placements:write')) return 0
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transferRequest)
    .innerJoin(resident, eq(resident.id, transferRequest.residentId))
    .where(and(eq(transferRequest.status, 'PENDING'), residentCodeInWorld(resident.code, world)))
  return row?.n ?? 0
}

async function pendingFactCount(viewer: WaitingViewer, world: ViewerWorld): Promise<number> {
  if (!hasPermission(viewer, 'clientFacts:read')) return 0
  const items = await pendingFactQueue({
    userId: viewer.id,
    scope: viewer.scope,
    ownDomain: ownSeat(viewer.role),
  })
  return residentsInWorld(items, world, (item) => item.resident).length
}

export interface WaitingCounts {
  applications: number
  approvals: number
  messages: number
  transfers: number
  total: number
}

/** Per-queue counts of people waiting on this viewer. */
export async function waitingCounts(
  viewer: WaitingViewer,
  world?: ViewerWorld,
): Promise<WaitingCounts> {
  const inWorld = world ?? (await staffViewerWorld(viewer.id))
  const [applications, approvals, messages, transfers] = await Promise.all([
    waitingApplicationCount(viewer, inWorld),
    pendingFactCount(viewer, inWorld),
    waitingThreadCount(viewer, inWorld),
    pendingTransferCount(viewer, inWorld),
  ])
  return {
    applications,
    approvals,
    messages,
    transfers,
    total: applications + approvals + messages + transfers,
  }
}

/**
 * The badge number, or null when it could not be computed.
 *
 * A badge is a convenience; the page under it must render whether or not the
 * count query succeeds, so a failure here is logged and shown as no badge
 * rather than as an error page on every staff route.
 */
export async function waitingBadgeCount(viewer: WaitingViewer): Promise<number | null> {
  try {
    return (await waitingCounts(viewer)).total
  } catch (error) {
    logger.errorWithCause('Failed to count waiting items for the nav badge', error, {
      userId: viewer.id,
    })
    return null
  }
}
