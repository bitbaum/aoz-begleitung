'use server'

import { revalidatePath } from 'next/cache'
import { db, eventRsvp, houseEvent, placement } from '@/lib/db'
import type { EventRsvpStatus, HouseEventCategory, HouseEventStatus } from '@/lib/db'
import { asc, desc, eq } from 'drizzle-orm'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { idSchema } from '@/lib/validation/schemas'
import { appendMessage, getOrCreateThread } from '@/lib/messaging/queries'
import { EVENTS_ADMIN_LABELS } from '@/lib/constants/labels/events'
import {
  cancellationRecipients,
  clientSeesEvent,
  mayDeleteEvent,
  type EventUnitOption,
} from '@/lib/config/events'
import { getCurrentUser } from '@/lib/auth'
import { getPortalAuth } from '@/lib/portal-auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { RESIDENT_NAME_SELECT, residentName } from '@/lib/utils/resident-name'
import { formatZurichDateTime, fromDatetimeLocalInput } from '@/lib/utils/local-time'

const CATEGORIES: HouseEventCategory[] = ['HOUSE_MEETING', 'SOCIAL', 'CULTURE', 'SUPPORT']
const RSVP_STATUSES: EventRsvpStatus[] = ['GOING', 'MAYBE', 'DECLINED']

export type HouseEventSummary = {
  id: string
  title: string
  description: string
  category: HouseEventCategory
  location: string | null
  startsAt: Date
  status: HouseEventStatus
  housingUnitId: string
  housingUnitCode: string
  createdByName: string | null
  createdByResidentId: string | null
  rsvps: { residentId: string; residentName: string; status: EventRsvpStatus }[]
}

function parseCategory(value: FormDataEntryValue | null): HouseEventCategory {
  return typeof value === 'string' && (CATEGORIES as string[]).includes(value)
    ? (value as HouseEventCategory)
    : 'SOCIAL'
}

function parseRsvpStatus(value: FormDataEntryValue | null): EventRsvpStatus | null {
  return typeof value === 'string' && (RSVP_STATUSES as string[]).includes(value)
    ? (value as EventRsvpStatus)
    : null
}

function revalidateEvents() {
  revalidatePath('/portal/events')
  revalidatePath('/events')
}

function mapEvent(row: {
  id: string
  title: string
  description: string
  category: HouseEventCategory
  location: string | null
  startsAt: Date
  status: HouseEventStatus
  housingUnit: { id: string; code: string }
  createdByStaff: { name: string } | null
  createdByResident: { id: string; code: string; displayName: string | null } | null
  rsvps: {
    residentId: string
    status: EventRsvpStatus
    resident: { code: string; displayName: string | null }
  }[]
}): HouseEventSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    location: row.location,
    startsAt: row.startsAt,
    status: row.status,
    housingUnitId: row.housingUnit.id,
    housingUnitCode: row.housingUnit.code,
    createdByName:
      row.createdByStaff?.name ??
      (row.createdByResident ? residentName(row.createdByResident) : null),
    createdByResidentId: row.createdByResident?.id ?? null,
    rsvps: row.rsvps.map((rsvp) => ({
      residentId: rsvp.residentId,
      residentName: residentName(rsvp.resident),
      status: rsvp.status,
    })),
  }
}

/**
 * The unit's events, split by whether they have happened yet.
 *
 * One list sorted ascending put last month's Frühlingsputz above next week's
 * Hausversammlung and asked a resident to RSVP to both. What is coming is the
 * only part anyone can act on, so it comes first and in the order it will
 * happen; what is done is a record, so it reads newest-first.
 */
export async function listUnitEvents(now: Date = new Date()): Promise<{
  upcoming: HouseEventSummary[]
  past: HouseEventSummary[]
} | null> {
  const auth = await getPortalAuth()
  if (!auth) return null

  const rows = await db.query.houseEvent.findMany({
    // Cancelled events too: the ones this client had answered stay visible as
    // «Abgesagt» (`clientSeesEvent`, below) instead of silently vanishing.
    where: eq(houseEvent.housingUnitId, auth.placement.housingUnitId),
    with: {
      housingUnit: { columns: { id: true, code: true } },
      createdByStaff: { columns: { name: true } },
      createdByResident: { columns: RESIDENT_NAME_SELECT },
      rsvps: { with: { resident: { columns: RESIDENT_NAME_SELECT } } },
    },
    orderBy: [asc(houseEvent.startsAt)],
  })

  const mapped = rows.map(mapEvent).filter((event) => clientSeesEvent(event, auth.resident.id))
  return {
    upcoming: mapped.filter((event) => event.startsAt >= now),
    past: mapped.filter((event) => event.startsAt < now).reverse(),
  }
}

export async function listStaffEvents(): Promise<HouseEventSummary[]> {
  const rows = await db.query.houseEvent.findMany({
    with: {
      housingUnit: { columns: { id: true, code: true } },
      createdByStaff: { columns: { name: true } },
      createdByResident: { columns: RESIDENT_NAME_SELECT },
      rsvps: { with: { resident: { columns: RESIDENT_NAME_SELECT } } },
    },
    orderBy: [desc(houseEvent.startsAt)],
  })
  return rows.map(mapEvent)
}

export async function createEventAsResident(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const auth = await getPortalAuth()
  if (!auth) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }

  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const location = String(formData.get('location') || '').trim() || null
  const startsAt = fromDatetimeLocalInput(String(formData.get('startsAt') || ''))
  const category = parseCategory(formData.get('category'))
  if (!title || !description || !startsAt) {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  await db.insert(houseEvent).values({
    housingUnitId: auth.placement.housingUnitId,
    createdByResidentId: auth.resident.id,
    title,
    description,
    location,
    startsAt,
    category,
  })

  revalidateEvents()
  return { success: true }
}

export async function createEventAsStaff(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }
  if (!hasPermission(user, 'events:write')) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }

  const housingUnitId = String(formData.get('housingUnitId') || '')
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const location = String(formData.get('location') || '').trim() || null
  const startsAt = fromDatetimeLocalInput(String(formData.get('startsAt') || ''))
  const category = parseCategory(formData.get('category'))
  if (!housingUnitId || !title || !description || !startsAt) {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  await db.insert(houseEvent).values({
    housingUnitId,
    createdByStaffId: user.id,
    title,
    description,
    location,
    startsAt,
    category,
  })

  revalidateEvents()
  return { success: true }
}

export async function rsvpToEvent(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const auth = await getPortalAuth()
  if (!auth) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }

  const eventId = String(formData.get('eventId') || '')
  const status = parseRsvpStatus(formData.get('status'))
  if (!eventId || !status) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }

  // The id arrived in a form field, so it is a claim, not a fact. Without this
  // check any resident could answer any unit's event by id — and since the
  // attendee list renders NAMES, that puts a stranger into another household's
  // "wer kommt" list, which is a privacy leak wearing the costume of an RSVP.
  const event = await db.query.houseEvent.findFirst({
    where: eq(houseEvent.id, eventId),
    columns: { housingUnitId: true, status: true },
  })
  if (
    !event ||
    event.housingUnitId !== auth.placement.housingUnitId ||
    event.status === 'CANCELLED'
  ) {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  await db
    .insert(eventRsvp)
    .values({ eventId, residentId: auth.resident.id, status })
    .onConflictDoUpdate({
      target: [eventRsvp.eventId, eventRsvp.residentId],
      set: { status },
    })

  revalidateEvents()
  return { success: true }
}

/**
 * Tell everyone who said «Ich komme» that it is off — through their message
 * thread with staff, the product's one in-app channel to a client (no email).
 * Best effort per person: one failed thread must not undo the cancellation
 * or skip everyone after it.
 */
async function notifyCancellation(
  event: { id: string; title: string; startsAt: Date },
  rsvps: readonly { residentId: string; status: EventRsvpStatus }[],
  staffUserId: string,
): Promise<number> {
  const body = EVENTS_ADMIN_LABELS.cancellationMessage(
    event.title,
    formatZurichDateTime(event.startsAt),
  )
  let sent = 0
  for (const residentId of cancellationRecipients(rsvps)) {
    try {
      const thread = await getOrCreateThread(residentId)
      await appendMessage({
        threadId: thread.id,
        party: { kind: 'staff', userId: staffUserId },
        body,
      })
      sent += 1
    } catch (cause) {
      logger.errorWithCause('Failed to notify event cancellation', cause, {
        eventId: event.id,
        residentId,
      })
    }
  }
  return sent
}

/**
 * Cancel an event. Staff may cancel any; a client only one they created.
 *
 * Cancelling is no longer silent. When staff cancel, every client who had
 * said «Ich komme» gets a message in their portal thread; and every client
 * who had answered keeps seeing the event, marked «Abgesagt»
 * (`clientSeesEvent`), instead of it vanishing from under them. A client who
 * cancels their own event cannot write into a neighbour's staff thread, so
 * for them the «Abgesagt» card is the notice.
 */
export async function cancelEvent(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const parsedId = idSchema.safeParse(formData.get('id'))
  if (!parsedId.success) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  const id = parsedId.data
  const event = await db.query.houseEvent.findFirst({
    where: eq(houseEvent.id, id),
    columns: { id: true, title: true, startsAt: true, status: true, createdByResidentId: true },
    with: { rsvps: { columns: { residentId: true, status: true } } },
  })
  if (!event) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  if (event.status === 'CANCELLED') return { success: true }

  const staffUser = await getCurrentUser()
  if (staffUser && hasPermission(staffUser, 'events:write')) {
    await db.update(houseEvent).set({ status: 'CANCELLED' }).where(eq(houseEvent.id, id))
    const notified = await notifyCancellation(event, event.rsvps, staffUser.id)
    await logAudit({
      action: 'UPDATE',
      entity: 'HOUSE_EVENT',
      entityId: id,
      userId: staffUser.id,
      changes: { status: 'CANCELLED', notified },
    })
    revalidateEvents()
    revalidatePath('/portal/messages')
    return { success: true }
  }

  const auth = await getPortalAuth()
  if (auth && event.createdByResidentId === auth.resident.id) {
    await db.update(houseEvent).set({ status: 'CANCELLED' }).where(eq(houseEvent.id, id))
    revalidateEvents()
    return { success: true }
  }

  return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
}

/** Staff remove a CANCELLED event for good (its answers go with it). */
export async function deleteEvent(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const staffUser = await getCurrentUser()
  if (!staffUser) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }
  if (!hasPermission(staffUser, 'events:write')) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }
  const parsedId = idSchema.safeParse(formData.get('id'))
  if (!parsedId.success) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  const id = parsedId.data

  const event = await db.query.houseEvent.findFirst({
    where: eq(houseEvent.id, id),
    columns: { status: true, title: true },
  })
  if (!event || !mayDeleteEvent(event)) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }

  await db.delete(houseEvent).where(eq(houseEvent.id, id))
  await logAudit({
    action: 'DELETE',
    entity: 'HOUSE_EVENT',
    entityId: id,
    userId: staffUser.id,
    changes: { title: event.title },
  })
  revalidateEvents()
  return { success: true }
}

/** Units for the staff event form, with how many people live in each. */
export async function listEventUnitOptions(): Promise<EventUnitOption[]> {
  const units = await db.query.housingUnit.findMany({
    columns: { id: true, code: true, nickname: true, address: true },
    with: { placements: { where: eq(placement.status, 'ACTIVE'), columns: { id: true } } },
  })
  return units.map((unit) => ({
    id: unit.id,
    code: unit.code,
    nickname: unit.nickname,
    address: unit.address,
    activePlacements: unit.placements.length,
  }))
}
