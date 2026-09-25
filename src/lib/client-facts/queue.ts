/**
 * The approval queue: client-entered facts nobody has looked at yet.
 *
 * Scoped by the seats the viewer holds, not by their job title. The all-domains Betreuerin
 * (ALL_DOMAINS) sees every client's; the Jobcoach sees the permits of the clients he
 * coaches and nothing else — no insurance, no doctors, and nothing at all for
 * a client he does not hold.
 *
 * The query is written per fact kind rather than as one union so that the
 * per-kind visibility rule in `policy.ts` is applied by construction: a kind a
 * viewer may not read is a query that is never issued, rather than rows
 * fetched and filtered afterwards. The payload is the leak, not the markup.
 */

import { and, eq, inArray } from 'drizzle-orm'

import {
  CLIENT_FACT_KINDS,
  mayReadFact,
  type ClientFactKind,
  type FactViewer,
} from '@/lib/client-facts/policy'
import { CARE_DOMAIN_STAFF_ROLE, type CareRoleId } from '@/lib/config/care'
import { careAssignment, clientHealthContact, clientInsurance, clientPermit, db } from '@/lib/db'
import { RESIDENT_NAME_SELECT } from '@/lib/utils/resident-name'

export interface QueueItem {
  id: string
  kind: ClientFactKind
  createdAt: Date
  resident: { id: string; code: string; displayName: string | null }
  /** One line describing what was entered — never a diagnosis, by construction. */
  summary: string
  validUntil: Date | null
}

/** Client ids this staff member holds a seat for, in the given domains. */
async function clientsInSeats(staffId: string, domains: readonly CareRoleId[]): Promise<string[]> {
  if (domains.length === 0) return []
  const rows = await db
    .select({ residentId: careAssignment.residentId })
    .from(careAssignment)
    .where(
      and(
        eq(careAssignment.staffId, staffId),
        inArray(careAssignment.role, domains as unknown as CareRoleId[]),
      ),
    )
  return [...new Set(rows.map((row) => row.residentId))]
}

/**
 * The domains a viewer could hold that would let them read this kind.
 *
 * Derived from the policy table rather than restated, so adding a reader to a
 * fact kind cannot be half-applied — the queue widens with it automatically.
 */
function readerDomainsFor(kind: ClientFactKind, viewer: FactViewer): CareRoleId[] {
  return viewer.seatsForClient.filter((seat) =>
    mayReadFact(kind, { scope: 'OWN_DOMAIN', seatsForClient: [seat] }),
  )
}

export interface QueueViewer {
  userId: string
  scope: string
  /** The care domain this staff member's ROLE corresponds to, if any. */
  ownDomain?: CareRoleId
}

/**
 * Everything awaiting a first look, newest last so the oldest wait is on top.
 *
 * PENDING only. A confirmed fact is not work, and a rejected one is waiting on
 * the client, not on staff — leaving either in the queue would make the number
 * beside it stop meaning "things I have to do".
 */
export async function pendingFactQueue(viewer: QueueViewer): Promise<QueueItem[]> {
  const seats: CareRoleId[] = viewer.ownDomain ? [viewer.ownDomain] : []
  const factViewer: FactViewer = { scope: viewer.scope, seatsForClient: seats }

  const kinds = CLIENT_FACT_KINDS.filter((kind) => mayReadFact(kind, factViewer))
  if (kinds.length === 0) return []

  const items: QueueItem[] = []

  for (const kind of kinds) {
    // ALL_DOMAINS reads every client; otherwise restrict to held seats.
    let residentIds: string[] | null = null
    if (viewer.scope !== 'ALL_DOMAINS') {
      residentIds = await clientsInSeats(viewer.userId, readerDomainsFor(kind, factViewer))
      if (residentIds.length === 0) continue
    }

    if (kind === 'INSURANCE') {
      const rows = await db.query.clientInsurance.findMany({
        where: residentIds
          ? and(
              eq(clientInsurance.status, 'PENDING'),
              inArray(clientInsurance.residentId, residentIds),
            )
          : eq(clientInsurance.status, 'PENDING'),
        columns: { id: true, createdAt: true, insurerName: true, validUntil: true },
        with: { resident: { columns: RESIDENT_NAME_SELECT } },
      })
      items.push(
        ...rows.map((row) => ({
          id: row.id,
          kind,
          createdAt: row.createdAt,
          resident: row.resident,
          summary: row.insurerName,
          validUntil: row.validUntil,
        })),
      )
    }

    if (kind === 'HEALTH_CONTACT') {
      const rows = await db.query.clientHealthContact.findMany({
        where: residentIds
          ? and(
              eq(clientHealthContact.status, 'PENDING'),
              inArray(clientHealthContact.residentId, residentIds),
            )
          : eq(clientHealthContact.status, 'PENDING'),
        columns: { id: true, createdAt: true, name: true, profession: true },
        with: { resident: { columns: RESIDENT_NAME_SELECT } },
      })
      items.push(
        ...rows.map((row) => ({
          id: row.id,
          kind,
          createdAt: row.createdAt,
          resident: row.resident,
          summary: `${row.profession} — ${row.name}`,
          validUntil: null,
        })),
      )
    }

    if (kind === 'PERMIT') {
      const rows = await db.query.clientPermit.findMany({
        where: residentIds
          ? and(eq(clientPermit.status, 'PENDING'), inArray(clientPermit.residentId, residentIds))
          : eq(clientPermit.status, 'PENDING'),
        columns: { id: true, createdAt: true, type: true, validUntil: true },
        with: { resident: { columns: RESIDENT_NAME_SELECT } },
      })
      items.push(
        ...rows.map((row) => ({
          id: row.id,
          kind,
          createdAt: row.createdAt,
          resident: row.resident,
          summary: row.type,
          validUntil: row.validUntil,
        })),
      )
    }
  }

  // Oldest first: the person who has waited longest is the one to answer.
  return items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

/** Which staff role corresponds to a care domain — derived, never restated. */
export const DOMAIN_ROLE = CARE_DOMAIN_STAFF_ROLE
