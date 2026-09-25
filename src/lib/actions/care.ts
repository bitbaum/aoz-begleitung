'use server'

import { revalidatePath } from 'next/cache'
import {
  db,
  appointment as appointmentTable,
  careAssignment,
  careAttribute,
  placement as placementTable,
  satisfactionCheckIn,
  user as userTable,
} from '@/lib/db'
import type { AppointmentStatus, CareRole } from '@/lib/db'
import { and, asc, eq, gte, or } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { getPortalAuth } from '@/lib/portal-auth'
import {
  hasPermission,
  isStaffRole,
  type StaffCapabilities,
  type StaffRole,
} from '@/lib/auth/role-policy'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import {
  APPOINTMENT_STATUSES,
  CARE_ROLES,
  canStaffWorkDomain,
  canWriteCareDomain,
  isCatalogKey,
  CARE_LABELS,
  type AppointmentStatusId,
  type CareRoleId,
} from '@/lib/config/care'
import { fromDatetimeLocalInput } from '@/lib/utils/local-time'
import { weeksBetween } from '@/lib/utils'
import { logAudit } from '@/lib/audit'

export type CareSeat = {
  role: CareRoleId
  staffId: string | null
  staffName: string | null
}

export type AssignableStaff = {
  id: string
  name: string
  role: string
  /** Carried so a seat can offer only the people who could actually work it. */
  scope: string
}

export type CareAppointment = {
  id: string
  domain: CareRoleId
  title: string
  startsAt: Date
  location: string | null
  notes: string | null
  status: AppointmentStatusId
  /**
   * Null on a request nobody has picked up yet.
   *
   * REQUIRED rather than optional, for the same reason `displayName` is: a
   * missing field would mean "the query did not ask", and an unclaimed
   * appointment means "nobody has taken this". Those are different facts and
   * the UI has to tell them apart.
   */
  staffId: string | null
  staffName: string | null
  residentNote: string | null
  staffNote: string | null
}

export type CareAttributeValue = {
  domain: CareRoleId
  key: string
  value: string
}

/**
 * Returns resident IDs where the given staff user is assigned as a care worker.
 * Used to power the "Meine Klient*innen" filter on the client board.
 */
export async function getMyResidentIds(staffId: string): Promise<string[]> {
  const assignments = await db.query.careAssignment.findMany({
    where: eq(careAssignment.staffId, staffId),
    columns: { residentId: true },
  })
  return assignments.map((a) => a.residentId)
}

function canWriteAnyCare(user: StaffCapabilities): boolean {
  if (!isStaffRole(user.role)) return false
  return hasPermission(user, 'residents:write') || hasPermission(user, 'learning:write')
}

function parseDomain(value: FormDataEntryValue | null): CareRole | null {
  if (typeof value !== 'string') return null
  return (CARE_ROLES as readonly string[]).includes(value) ? (value as CareRole) : null
}

function parseStatus(value: FormDataEntryValue | null): AppointmentStatus | null {
  if (typeof value !== 'string') return null
  return (APPOINTMENT_STATUSES as readonly string[]).includes(value)
    ? (value as AppointmentStatus)
    : null
}

function revalidateResident(residentId: string) {
  revalidatePath(`/residents/${residentId}`)
  revalidatePath('/portal')
  revalidatePath('/portal/profile')
  revalidatePath('/')
}

export async function getCareTeam(residentId: string): Promise<CareSeat[]> {
  const assignments = await db.query.careAssignment.findMany({
    where: eq(careAssignment.residentId, residentId),
    with: { staff: { columns: { id: true, name: true } } },
  })
  const byRole = new Map(assignments.map((row) => [row.role, row]))

  return CARE_ROLES.map((role) => {
    const row = byRole.get(role)
    return {
      role,
      staffId: row?.staff.id ?? null,
      staffName: row?.staff.name ?? null,
    }
  })
}

/**
 * Everyone who could be put on a client's team.
 *
 * `role` was already selected here and read by nothing, so the picker offered
 * EVERY active account for EVERY seat: the Liegenschaften lead appeared under Jobcoach although
 * `LIEGENSCHAFTEN` maps to no care domain and can never work one, and the Jobcoach
 * appeared under Freiwilligenarbeit. `scope` joins it so a caller can ask the
 * real question — see `canStaffWorkDomain` in config/care.ts.
 */
export async function listAssignableStaff(): Promise<AssignableStaff[]> {
  return db.query.user.findMany({
    where: eq(userTable.active, true),
    columns: { id: true, name: true, role: true, scope: true },
    orderBy: [asc(userTable.name)],
  })
}

export async function listCareAttributes(residentId: string): Promise<CareAttributeValue[]> {
  const rows = await db.query.careAttribute.findMany({
    where: eq(careAttribute.residentId, residentId),
  })
  return rows.map((row) => ({
    domain: row.domain as CareRoleId,
    key: row.key,
    value: row.value,
  }))
}

export async function listResidentAppointments(residentId: string): Promise<CareAppointment[]> {
  const rows = await db.query.appointment.findMany({
    where: eq(appointmentTable.residentId, residentId),
    with: { staff: { columns: { id: true, name: true } } },
    orderBy: [asc(appointmentTable.startsAt)],
  })
  return rows.map(mapAppointment)
}

/**
 * What the resident needs to see about their own appointments.
 *
 * Not just confirmed future ones. A request they made and a decision that came
 * back are both things they are waiting on, and filtering to SCHEDULED would
 * make a decline vanish the instant staff made it — the exact bug the transfer
 * page had, where filtering to PENDING meant every approval and denial
 * disappeared from the resident's view along with the staff note explaining it.
 *
 * Cancellations fade after a fortnight: long enough to be read, short enough
 * that the list stays about what is coming rather than what fell through.
 */
export async function listUpcomingResidentAppointments(
  residentId: string,
  now = new Date(),
): Promise<CareAppointment[]> {
  const answeredSince = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const rows = await db.query.appointment.findMany({
    where: and(
      eq(appointmentTable.residentId, residentId),
      or(
        and(eq(appointmentTable.status, 'SCHEDULED'), gte(appointmentTable.startsAt, now)),
        // An open request, whenever it was for — an unanswered ask does not
        // stop mattering because the date the resident suggested has passed.
        eq(appointmentTable.status, 'REQUESTED'),
        and(
          eq(appointmentTable.status, 'CANCELLED'),
          gte(appointmentTable.updatedAt, answeredSince),
        ),
      ),
    ),
    with: { staff: { columns: { id: true, name: true } } },
    orderBy: [asc(appointmentTable.startsAt)],
    limit: 12,
  })
  return rows.map(mapAppointment)
}

function mapAppointment(row: {
  id: string
  domain: CareRole
  title: string
  startsAt: Date
  location: string | null
  notes: string | null
  status: AppointmentStatus
  residentNote: string | null
  staffNote: string | null
  staff: { id: string; name: string } | null
}): CareAppointment {
  return {
    id: row.id,
    domain: row.domain as CareRoleId,
    title: row.title,
    startsAt: row.startsAt,
    location: row.location,
    notes: row.notes,
    status: row.status as AppointmentStatusId,
    staffId: row.staff?.id ?? null,
    staffName: row.staff?.name ?? null,
    residentNote: row.residentNote,
    staffNote: row.staffNote,
  }
}

export async function saveCareSeat(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }
  if (!canWriteAnyCare(user)) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }

  const residentId = String(formData.get('residentId') || '')
  const role = parseDomain(formData.get('role'))
  const staffId = String(formData.get('staffId') || '').trim()
  if (!residentId || !role) {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }
  if (!canWriteCareDomain(user, role)) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }

  if (!staffId) {
    await db
      .delete(careAssignment)
      .where(and(eq(careAssignment.residentId, residentId), eq(careAssignment.role, role)))
  } else {
    const staff = await db.query.user.findFirst({
      where: and(eq(userTable.id, staffId), eq(userTable.active, true)),
      columns: { id: true, role: true, scope: true },
    })
    if (!staff) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }

    // Who is being NAMED, not who is editing. The check above answers "may you
    // change this seat"; this one answers "could that person hold it". Without
    // it the picker was the only thing standing between a POST and a
    // Liegenschaften account sitting in the Jobcoach seat forever — and a
    // filtered dropdown is a suggestion, not a rule.
    if (!canStaffWorkDomain(staff, role)) {
      return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
    }

    await db
      .insert(careAssignment)
      .values({ residentId, staffId, role })
      .onConflictDoUpdate({
        target: [careAssignment.residentId, careAssignment.role],
        set: { staffId },
      })
  }

  revalidateResident(residentId)
  return { success: true }
}

export async function saveCareAttributes(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }

  const residentId = String(formData.get('residentId') || '')
  const domain = parseDomain(formData.get('domain'))
  if (!residentId || !domain) {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }
  if (!canWriteCareDomain(user, domain)) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }

  const entries = Array.from(formData.entries()).filter(([name]) => name.startsWith('attr.'))
  for (const [name, raw] of entries) {
    const key = name.slice('attr.'.length)
    if (!isCatalogKey(domain, key)) continue
    const value = String(raw).trim()
    if (!value) {
      await db
        .delete(careAttribute)
        .where(
          and(
            eq(careAttribute.residentId, residentId),
            eq(careAttribute.domain, domain),
            eq(careAttribute.key, key),
          ),
        )
      continue
    }
    await db
      .insert(careAttribute)
      .values({ residentId, domain, key, value, updatedById: user.id })
      .onConflictDoUpdate({
        target: [careAttribute.residentId, careAttribute.domain, careAttribute.key],
        set: { value, updatedById: user.id },
      })
  }

  revalidateResident(residentId)
  return { success: true }
}

export async function createAppointment(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }

  const residentId = String(formData.get('residentId') || '')
  const domain = parseDomain(formData.get('domain'))
  const title = String(formData.get('title') || '').trim()
  const startsAt = fromDatetimeLocalInput(String(formData.get('startsAt') || ''))
  if (!residentId || !domain || title.length < 2 || !startsAt) {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }
  if (!canWriteCareDomain(user, domain)) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }

  const assigned = await db.query.careAssignment.findFirst({
    where: and(eq(careAssignment.residentId, residentId), eq(careAssignment.role, domain)),
    columns: { staffId: true },
  })
  const staffId = assigned?.staffId || user.id

  await db.insert(appointmentTable).values({
    residentId,
    staffId,
    domain,
    title,
    startsAt,
    location: String(formData.get('location') || '').trim() || null,
    notes: String(formData.get('notes') || '').trim() || null,
  })

  revalidateResident(residentId)
  return { success: true }
}

export async function setAppointmentStatus(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }

  const id = String(formData.get('id') || '')
  const status = parseStatus(formData.get('status'))
  if (!id || !status) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }

  const appointment = await db.query.appointment.findFirst({
    where: eq(appointmentTable.id, id),
    columns: { residentId: true, domain: true },
    with: { checkIn: { columns: { id: true } } },
  })
  if (!appointment) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  if (!canWriteCareDomain(user, appointment.domain)) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }

  // How the person was doing, asked in the course of this appointment.
  //
  // Optional on purpose. The alternative — a required field on every
  // completion — buys a number for every meeting by making some of them
  // guesses, and a guessed score is worse than a missing one because it is
  // indistinguishable from an answer. Silence stays silence.
  const rating = parseSatisfaction(formData.get('overallSatisfaction'))
  const concerns = String(formData.get('concerns') || '').trim()

  await db.update(appointmentTable).set({ status }).where(eq(appointmentTable.id, id))

  if (status === 'COMPLETED' && rating !== null && !appointment.checkIn) {
    // The check-in hangs off a placement, so someone with no active placement
    // can still have appointments — they just have nothing to attach a
    // reading to. Completing the appointment must not fail because of that.
    const placement = await db.query.placement.findFirst({
      where: and(
        eq(placementTable.residentId, appointment.residentId),
        eq(placementTable.status, 'ACTIVE'),
      ),
      columns: { id: true, startDate: true },
    })

    if (placement) {
      await db.transaction(async (tx) => {
        await tx.insert(satisfactionCheckIn).values({
          placementId: placement.id,
          appointmentId: id,
          checkInType: 'AD_HOC',
          weekNumber: weeksBetween(placement.startDate),
          overallSatisfaction: rating,
          concerns: concerns || null,
          collectedByUserId: user.id,
          isAnonymous: false,
        })
        await tx
          .update(placementTable)
          .set({ satisfactionRating: rating })
          .where(eq(placementTable.id, placement.id))
      })

      await logAudit({
        action: 'CREATE',
        entity: 'CHECK_IN',
        entityId: id,
        userId: user.id,
        changes: {
          type: 'APPOINTMENT',
          appointmentId: id,
          domain: appointment.domain,
          overallSatisfaction: rating,
          hasConcerns: !!concerns,
        },
      })
    }
  }

  revalidateResident(appointment.residentId)
  return { success: true }
}

/** 1–5, or null for "not asked". Anything else is not a reading. */
function parseSatisfaction(raw: FormDataEntryValue | null): number | null {
  const value = Number(String(raw ?? ''))
  if (!Number.isInteger(value) || value < 1 || value > 5) return null
  return value
}

// ===========================================================================
// REQUESTING A MEETING — the resident's half
// ===========================================================================

/**
 * A resident asks for a meeting.
 *
 * Appointments were the one surface a resident could not write to. They can
 * record an expense, claim a chore, file a report and request a transfer — but
 * "when can I talk to the person responsible for me" had no answer here, and
 * the product's reply was: wait to be told.
 *
 * Shaped like TransferRequest, deliberately: the resident initiates, staff
 * decide with a note, and the resident reads the outcome. The last part is the
 * one that gets forgotten — a decision stored and never rendered is the same
 * as no decision.
 *
 * The resident proposes a time rather than leaving it open. An unanswered
 * request with no time attached gives staff nothing to accept, and gives the
 * resident nothing to plan around.
 */
export async function requestAppointment(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const auth = await getPortalAuth()
  if (!auth) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }

  const domain = parseDomain(formData.get('domain'))
  const startsAt = fromDatetimeLocalInput(String(formData.get('startsAt') || ''))
  const note = String(formData.get('residentNote') || '').trim()

  if (!domain || !startsAt) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }

  // A time in the past is a typo, not a wish, and it would sort out of the
  // upcoming list the moment it was created — invisible to everyone.
  if (startsAt.getTime() <= Date.now()) {
    return { success: false, error: CARE_LABELS.requestPastTime }
  }

  // One open request per seat. Without this a resident who taps twice, or who
  // is not sure the first one worked, fills a coach's queue with duplicates of
  // the same ask — and nothing in the UI told them the first had landed.
  const existing = await db.query.appointment.findFirst({
    where: and(
      eq(appointmentTable.residentId, auth.resident.id),
      eq(appointmentTable.domain, domain),
      eq(appointmentTable.status, 'REQUESTED'),
    ),
    columns: { id: true },
  })
  if (existing) return { success: false, error: CARE_LABELS.requestDuplicate }

  // Whoever holds the seat, if anyone does. Null is a real state: on a
  // deployment where the care team is not assigned yet, the request is still
  // worth making and lands unclaimed rather than being refused.
  const assigned = await db.query.careAssignment.findFirst({
    where: and(eq(careAssignment.residentId, auth.resident.id), eq(careAssignment.role, domain)),
    columns: { staffId: true },
  })

  await db.insert(appointmentTable).values({
    residentId: auth.resident.id,
    staffId: assigned?.staffId ?? null,
    domain,
    title: CARE_LABELS.requestTitle,
    startsAt,
    status: 'REQUESTED',
    residentNote: note || null,
  })

  revalidateResident(auth.resident.id)
  return { success: true }
}

/**
 * Staff answer a request: take it, or decline it with a reason.
 *
 * Accepting assigns the answering staff member — including on a request that
 * arrived unclaimed — and may move the time, because the resident proposed one
 * and staff are the ones who know what is possible.
 */
export async function respondToAppointmentRequest(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }

  const id = String(formData.get('id') || '')
  const decision = String(formData.get('decision') || '')
  const note = String(formData.get('staffNote') || '').trim()

  const appointment = await db.query.appointment.findFirst({
    where: eq(appointmentTable.id, id),
    columns: { residentId: true, domain: true, status: true },
  })
  if (!appointment || appointment.status !== 'REQUESTED') {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }
  if (!canWriteCareDomain(user, appointment.domain)) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }

  if (decision === 'DECLINE') {
    // A refusal without a reason is the thing this product keeps promising not
    // to do. The resident reads this sentence, so it is required.
    if (note.length < 3) return { success: false, error: CARE_LABELS.declineNeedsReason }

    await db
      .update(appointmentTable)
      .set({ status: 'CANCELLED', staffNote: note, staffId: user.id })
      .where(eq(appointmentTable.id, id))
  } else if (decision === 'ACCEPT') {
    const proposed = fromDatetimeLocalInput(String(formData.get('startsAt') || ''))

    await db
      .update(appointmentTable)
      .set({
        status: 'SCHEDULED',
        // The answering colleague takes it, which is also how an unclaimed
        // request gets an owner.
        staffId: user.id,
        ...(proposed ? { startsAt: proposed } : {}),
        staffNote: note || null,
      })
      .where(eq(appointmentTable.id, id))
  } else {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  await logAudit({
    action: 'UPDATE',
    entity: 'RESIDENT',
    entityId: appointment.residentId,
    userId: user.id,
    changes: { type: 'APPOINTMENT_REQUEST', appointmentId: id, decision },
  })

  revalidateResident(appointment.residentId)
  return { success: true }
}

/**
 * Move an appointment, keeping the appointment.
 *
 * There was no way to do this: changing a time meant cancelling and creating a
 * new row. The resident's card did not say "moved to Tuesday", it said the
 * meeting was cancelled and then a different one appeared — the worst
 * available message for someone waiting on the person responsible for them.
 */
export async function rescheduleAppointment(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }

  const id = String(formData.get('id') || '')
  const startsAt = fromDatetimeLocalInput(String(formData.get('startsAt') || ''))
  const note = String(formData.get('staffNote') || '').trim()
  if (!id || !startsAt) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }

  const appointment = await db.query.appointment.findFirst({
    where: eq(appointmentTable.id, id),
    columns: { residentId: true, domain: true, status: true },
  })
  if (!appointment) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  if (!canWriteCareDomain(user, appointment.domain)) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }
  // A meeting that already happened, or was called off, is a record. Moving it
  // would rewrite what took place rather than change a plan.
  if (appointment.status !== 'SCHEDULED' && appointment.status !== 'REQUESTED') {
    return { success: false, error: CARE_LABELS.rescheduleClosed }
  }

  await db
    .update(appointmentTable)
    .set({ startsAt, staffNote: note || null })
    .where(eq(appointmentTable.id, id))

  await logAudit({
    action: 'UPDATE',
    entity: 'RESIDENT',
    entityId: appointment.residentId,
    userId: user.id,
    changes: { type: 'APPOINTMENT_RESCHEDULED', appointmentId: id },
  })

  revalidateResident(appointment.residentId)
  return { success: true }
}
