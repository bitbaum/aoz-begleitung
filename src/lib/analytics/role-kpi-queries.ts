/**
 * Loading the caseload a role's KPIs are computed over.
 *
 * Kept apart from `role-kpis.ts` on purpose: the arithmetic there is pure and
 * unit-tested, this is I/O. The same split `lib/jobcoach/queue.ts` already uses,
 * and the reason the KPI rules can be proven without a database.
 *
 * ## Whose caseload
 *
 * A specialist is measured on the people THEY hold — that is the point of a
 * per-role KPI, and a product-wide number would recreate the aggregate that
 * told the Jobcoach "23 laufend" while their own board showed nothing.
 *
 * A viewer with reach over every domain has no single seat, so they see the
 * whole real population instead: for them these are pilot numbers, not a
 * personal scorecard.
 *
 * Demo rows never count, in either case. @see ./real-data.ts
 */

import { and, eq, inArray } from 'drizzle-orm'
import { careAssignment, db, resident } from '@/lib/db'
import { loadDemoScope } from './real-data'
import { isAwaitingAnswer } from '@/lib/jobcoach/queue'
import {
  computeJobKpis,
  computeVolunteeringKpis,
  type JobKpiClient,
  type KpiValue,
  type VolunteeringKpiClient,
} from './role-kpis'
import type { CareRoleId } from '@/lib/config/care'
import { residentName } from '@/lib/utils/resident-name'

export interface RoleKpiRequest {
  domain: CareRoleId
  /** null = every real resident (a viewer whose reach is all domains). */
  staffId: string | null
}

/**
 * The residents a KPI set covers, already stripped of demo rows.
 *
 * Returns ids only; the caller fetches what each KPI needs. Splitting it this
 * way keeps "who counts" in one place — the question every KPI shares — while
 * letting the job and volunteering sets ask for different columns.
 */
async function caseloadResidentIds(request: RoleKpiRequest): Promise<string[]> {
  const demoScope = await loadDemoScope()

  if (request.staffId) {
    const rows = await db.query.careAssignment.findMany({
      where: and(
        eq(careAssignment.staffId, request.staffId),
        eq(careAssignment.role, request.domain),
      ),
      columns: { residentId: true },
    })
    return rows.map((r) => r.residentId).filter((id) => !demoScope.residentIds.has(id))
  }

  const rows = await db.query.resident.findMany({ columns: { id: true } })
  return rows.map((r) => r.id).filter((id) => !demoScope.residentIds.has(id))
}

export async function loadJobKpis(request: RoleKpiRequest): Promise<KpiValue[]> {
  const ids = await caseloadResidentIds(request)
  if (ids.length === 0) return computeJobKpis([])

  const rows = await db.query.resident.findMany({
    where: inArray(resident.id, ids),
    columns: { id: true, code: true, displayName: true, createdAt: true },
    with: {
      learningRecords: {
        columns: { kind: true, status: true, updatedAt: true, languageCode: true },
      },
      opportunityApplications: {
        columns: {
          opportunityId: true,
          stage: true,
          createdAt: true,
          createdBy: true,
          supportedByUserId: true,
        },
      },
    },
  })

  const clients: JobKpiClient[] = rows.map((row) => {
    // Threads nobody has answered are not contact, so they are not a first
    // contact either. Left in, the median would have measured how quickly
    // RESIDENTS click — a client who pressed "Ich habe Interesse" on day one
    // and waited two months would have reported one day, and the tile would
    // have improved fastest exactly where the service was slowest.
    // @see lib/jobcoach/queue.ts
    const answered = row.opportunityApplications.filter((a) => !isAwaitingAnswer(a))

    return {
      residentId: row.id,
      name: residentName(row),
      createdAt: row.createdAt,
      learningRecords: row.learningRecords,
      applications: row.opportunityApplications,
      // The earliest answered application is the best available proxy for
      // "first contact": it is the first moment this product can witness. An
      // approach made by phone and never recorded is invisible here, which is a
      // limit of the data rather than of the metric — and a reason the number
      // belongs beside a caseload size rather than alone.
      //
      // For a thread the resident opened and staff later took up, this is still
      // the date of the CLICK rather than of the reply, so the figure remains a
      // lower bound on the delay. Recording an answeredAt would tighten it; a
      // lower bound that cannot be gamed by the resident's own action is the
      // improvement that mattered.
      firstContactAt: answered.length
        ? answered.reduce(
            (earliest, a) => (a.createdAt < earliest ? a.createdAt : earliest),
            answered[0].createdAt,
          )
        : null,
    }
  })

  return computeJobKpis(clients)
}

export async function loadVolunteeringKpis(request: RoleKpiRequest): Promise<KpiValue[]> {
  const ids = await caseloadResidentIds(request)
  if (ids.length === 0) return computeVolunteeringKpis([])

  const rows = await db.query.resident.findMany({
    where: inArray(resident.id, ids),
    columns: { id: true },
    with: {
      opportunityApplications: {
        columns: {
          opportunityId: true,
          stage: true,
          createdBy: true,
          supportedByUserId: true,
        },
      },
      eventRsvps: { columns: { status: true } },
    },
  })

  const clients: VolunteeringKpiClient[] = rows.map((row) => ({
    residentId: row.id,
    applications: row.opportunityApplications,
    rsvpStatuses: row.eventRsvps.map((r) => r.status),
  }))

  return computeVolunteeringKpis(clients)
}
