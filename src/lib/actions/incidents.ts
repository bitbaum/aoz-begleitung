'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db, incident, incidentFollowUp, incidentInvolvement } from '@/lib/db'
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm'
import { z } from 'zod'
import {
  validateFormData,
  idSchema,
  IncidentInputSchema,
  ResolveIncidentSchema,
  FollowUpInputSchema,
  UpdateMediationTimeSchema,
} from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { determineEntryStage } from '@/lib/governance/escalation'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { requirePermission } from '@/lib/auth'
import { QUERY_LIMITS } from '@/lib/config/thresholds'

// Simple schema for clearing follow-up
const ClearFollowUpSchema = z.object({
  incidentId: idSchema,
})

export async function createIncident(formData: FormData): Promise<void> {
  const user = await requirePermission('incidents:write')
  const data = validateFormData(IncidentInputSchema, formData)
  let incidentId: string

  try {
    const [created] = await db
      .insert(incident)
      .values({
        housingUnitId: data.housingUnitId,
        reportedById: data.reportedById || undefined,
        subjectId: data.subjectId || undefined,
        category: data.category,
        type: data.type,
        severity: data.severity,
        description: data.description,
        date: data.date,
        mediationMinutes: data.mediationMinutes ?? undefined,
        // Where this conflict enters the resolution ladder. Safety reports and
        // severe incidents skip the resident-to-resident rungs entirely — nobody
        // is asked to go and negotiate with someone who threatened them.
        resolutionStage: determineEntryStage({
          category: data.category,
          severity: data.severity,
          type: data.type,
        }).stage,
        stageEnteredAt: new Date(),
      })
      .returning()

    await logAudit({
      action: 'CREATE',
      entity: 'INCIDENT',
      entityId: created.id,
      userId: user.id,
      changes: {
        category: data.category,
        type: data.type,
        severity: data.severity,
        housingUnitId: data.housingUnitId,
      },
    })
    incidentId = created.id
  } catch (error) {
    logger.errorWithCause('Failed to create incident', error, { housingUnitId: data.housingUnitId })
    throw new Error(ERROR_MESSAGES.INCIDENT_CREATE_ERROR)
  }

  redirect(`/incidents/${incidentId}?created=true`)
}

export async function resolveIncident(formData: FormData): Promise<void> {
  const user = await requirePermission('incidents:write')
  const { incidentId, resolution } = validateFormData(ResolveIncidentSchema, formData)

  try {
    const [updated] = await db
      .update(incident)
      .set({
        resolvedAt: new Date(),
        resolution,
      })
      .where(eq(incident.id, incidentId))
      .returning({ id: incident.id })
    // Prisma threw when the incident was missing — keep that error path
    if (!updated) throw new Error(ERROR_MESSAGES.INCIDENT_RESOLVE_ERROR)

    await logAudit({
      action: 'RESOLVE',
      entity: 'INCIDENT',
      entityId: incidentId,
      userId: user.id,
      changes: { resolution },
    })
  } catch (error) {
    logger.errorWithCause('Failed to resolve incident', error, { incidentId })
    throw new Error(ERROR_MESSAGES.INCIDENT_RESOLVE_ERROR)
  }

  revalidatePath('/incidents')
  redirect(`/incidents/${incidentId}?resolved=true`)
}

export async function updateMediationTime(formData: FormData): Promise<void> {
  const user = await requirePermission('incidents:write')
  const { incidentId, mediationMinutes } = validateFormData(UpdateMediationTimeSchema, formData)

  try {
    const [updated] = await db
      .update(incident)
      .set({ mediationMinutes })
      .where(eq(incident.id, incidentId))
      .returning({ id: incident.id })
    // Prisma threw when the incident was missing — keep that error path
    if (!updated) throw new Error(ERROR_MESSAGES.INCIDENT_UPDATE_MEDIATION_ERROR)

    await logAudit({
      action: 'UPDATE',
      entity: 'INCIDENT',
      entityId: incidentId,
      userId: user.id,
      changes: { mediationMinutes },
    })
  } catch (error) {
    logger.errorWithCause('Failed to update mediation time', error, { incidentId })
    throw new Error(ERROR_MESSAGES.INCIDENT_UPDATE_MEDIATION_ERROR)
  }

  revalidatePath(`/incidents/${incidentId}`)
  revalidatePath('/analytics')
}

export interface ResidentIncidentStats {
  reported: number // Incidents this person reported
  asSubject: number // Incidents where this person was the subject/cause
  involved: number // Incidents where they were involved
  total: number // Total unique incidents
}

export async function getResidentIncidentStats(residentId: string): Promise<ResidentIncidentStats> {
  await requirePermission('incidents:read')
  const [reported, asSubject, involved] = await Promise.all([
    db.$count(incident, eq(incident.reportedById, residentId)),
    db.$count(incident, eq(incident.subjectId, residentId)),
    db.$count(incidentInvolvement, eq(incidentInvolvement.residentId, residentId)),
  ])

  // Count unique incidents (reporter, subject, or involved)
  const uniqueIncidents = await db.query.incident.findMany({
    where: or(
      eq(incident.reportedById, residentId),
      eq(incident.subjectId, residentId),
      inArray(
        incident.id,
        db
          .select({ id: incidentInvolvement.incidentId })
          .from(incidentInvolvement)
          .where(eq(incidentInvolvement.residentId, residentId)),
      ),
    ),
    columns: { id: true },
  })

  return {
    reported,
    asSubject,
    involved,
    total: uniqueIncidents.length,
  }
}

export async function getHousingUnitIncidentHistory(housingUnitId: string) {
  await requirePermission('incidents:read')
  const incidents = await db.query.incident.findMany({
    where: eq(incident.housingUnitId, housingUnitId),
    with: {
      reportedBy: { columns: { id: true, code: true } },
      subject: { columns: { id: true, code: true } },
      involvedResidents: {
        with: {
          resident: { columns: { id: true, code: true } },
        },
      },
    },
    orderBy: [desc(incident.date)],
    limit: QUERY_LIMITS.entityHistory,
  })

  return {
    incidents,
    stats: {
      total: incidents.length,
      open: incidents.filter((i) => !i.resolvedAt).length,
      interpersonal: incidents.filter((i) => i.category === 'INTERPERSONAL').length,
      maintenance: incidents.filter((i) => i.category === 'MAINTENANCE').length,
    },
  }
}

// =============================================================================
// FOLLOW-UP ACTIONS
// =============================================================================

export async function addFollowUp(formData: FormData): Promise<void> {
  const user = await requirePermission('incidents:write')
  const data = validateFormData(FollowUpInputSchema, formData)

  try {
    // Create the follow-up record
    const [followUp] = await db
      .insert(incidentFollowUp)
      .values({
        incidentId: data.incidentId,
        action: data.action,
        notes: data.notes,
        outcome: data.outcome,
        staffName: data.staffName,
        scheduledNextDate: data.scheduledNextDate,
      })
      .returning()

    // Update the incident with next follow-up date and priority
    const updateData: Partial<typeof incident.$inferInsert> = {}
    if (data.scheduledNextDate) {
      updateData.nextFollowUpDate = data.scheduledNextDate
    }
    if (data.followUpPriority) {
      updateData.followUpPriority = data.followUpPriority
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(incident).set(updateData).where(eq(incident.id, data.incidentId))
    }

    await logAudit({
      action: 'CREATE',
      entity: 'INCIDENT',
      entityId: data.incidentId,
      userId: user.id,
      changes: { followUpId: followUp.id, action: data.action },
    })
  } catch (error) {
    logger.errorWithCause('Failed to add follow-up', error, { incidentId: data.incidentId })
    throw new Error(ERROR_MESSAGES.FOLLOWUP_CREATE_ERROR)
  }

  revalidatePath('/incidents')
  revalidatePath(`/incidents/${data.incidentId}`)
}

export async function getIncidentWithFollowUps(incidentId: string) {
  await requirePermission('incidents:read')
  return (
    (await db.query.incident.findFirst({
      where: eq(incident.id, incidentId),
      with: {
        housingUnit: true,
        reportedBy: true,
        subject: true,
        involvedResidents: {
          with: { resident: true },
        },
        followUps: {
          orderBy: [desc(incidentFollowUp.createdAt)],
        },
      },
    })) ?? null
  )
}

export async function getIncidentsNeedingFollowUp() {
  await requirePermission('incidents:read')
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const threeDays = new Date(now)
  threeDays.setDate(threeDays.getDate() + 3)

  // Get overdue incidents (follow-up date passed but not resolved)
  const overdue = await db.query.incident.findMany({
    where: and(isNull(incident.resolvedAt), lt(incident.nextFollowUpDate, now)),
    with: {
      housingUnit: true,
      subject: true,
      followUps: { columns: { id: true } },
    },
    orderBy: [asc(incident.nextFollowUpDate)],
  })

  // Get incidents due today/tomorrow
  const dueSoon = await db.query.incident.findMany({
    where: and(
      isNull(incident.resolvedAt),
      gte(incident.nextFollowUpDate, now),
      lte(incident.nextFollowUpDate, tomorrow),
    ),
    with: {
      housingUnit: true,
      subject: true,
      followUps: { columns: { id: true } },
    },
    orderBy: [asc(incident.nextFollowUpDate)],
  })

  // Get incidents with urgent priority regardless of date
  const urgent = await db.query.incident.findMany({
    where: and(
      isNull(incident.resolvedAt),
      inArray(incident.followUpPriority, ['URGENT', 'HIGH']),
      gte(incident.nextFollowUpDate, tomorrow), // Not already in dueSoon
    ),
    with: {
      housingUnit: true,
      subject: true,
      followUps: { columns: { id: true } },
    },
    orderBy: [asc(incident.followUpPriority)],
  })

  // Rebuild Prisma's `_count: { followUps }` shape — the query API has no
  // count-include, so we fetched the follow-up ids and count them in memory.
  const withFollowUpCount = ({
    followUps,
    ...rest
  }: (typeof overdue)[number]): Omit<(typeof overdue)[number], 'followUps'> & {
    _count: { followUps: number }
  } => ({ ...rest, _count: { followUps: followUps.length } })

  return {
    overdue: overdue.map(withFollowUpCount),
    dueSoon: dueSoon.map(withFollowUpCount),
    urgent: urgent.map(withFollowUpCount),
  }
}

export async function clearFollowUpReminder(formData: FormData): Promise<void> {
  const user = await requirePermission('incidents:write')
  const { incidentId } = validateFormData(ClearFollowUpSchema, formData)

  try {
    const [updated] = await db
      .update(incident)
      .set({
        nextFollowUpDate: null,
        followUpPriority: null,
      })
      .where(eq(incident.id, incidentId))
      .returning({ id: incident.id })
    // Prisma threw when the incident was missing — keep that error path
    if (!updated) throw new Error(ERROR_MESSAGES.REMINDER_DELETE_ERROR)

    await logAudit({
      action: 'UPDATE',
      entity: 'INCIDENT',
      entityId: incidentId,
      userId: user.id,
      changes: { nextFollowUpDate: null, followUpPriority: null },
    })
  } catch (error) {
    logger.errorWithCause('Failed to clear follow-up reminder', error, { incidentId })
    throw new Error(ERROR_MESSAGES.REMINDER_DELETE_ERROR)
  }

  revalidatePath('/incidents')
}
