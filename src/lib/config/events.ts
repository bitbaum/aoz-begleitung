/**
 * House event configuration — SSOT.
 *
 * The category and RSVP labels were rebuilt inline on the portal page and
 * again on the staff page, both times as a hand-written object literal keyed by
 * the Prisma enum. Two copies means a category added to the schema renders as
 * `undefined` on whichever page nobody remembered — silently, since indexing a
 * plain object with a missing key is not a type error once the map is inferred
 * rather than declared.
 *
 * Declared as `Record<Enum, MessageKey>` here, so adding a value to the schema
 * fails to compile until it has a word.
 */

import type { EventRsvpStatus, HouseEventCategory } from '@/lib/db'
import type { MessageKey } from '@/lib/i18n'

export const HOUSE_EVENT_CATEGORY_LABEL_KEYS: Record<HouseEventCategory, MessageKey> = {
  HOUSE_MEETING: 'events.categoryHouseMeeting',
  SOCIAL: 'events.categorySocial',
  CULTURE: 'events.categoryCulture',
  SUPPORT: 'events.categorySupport',
}

export const HOUSE_EVENT_CATEGORIES = Object.keys(
  HOUSE_EVENT_CATEGORY_LABEL_KEYS,
) as HouseEventCategory[]

export const EVENT_RSVP_LABEL_KEYS: Record<EventRsvpStatus, MessageKey> = {
  GOING: 'events.rsvpGoing',
  MAYBE: 'events.rsvpMaybe',
  DECLINED: 'events.rsvpDeclined',
}

/** The order the three buttons are offered in, most affirmative first. */
export const EVENT_RSVP_STATUSES: readonly EventRsvpStatus[] = ['GOING', 'MAYBE', 'DECLINED']

/**
 * Whether a client sees an event on their portal.
 *
 * A cancelled event used to vanish — including for the people who had said
 * «Ich komme», who then had no way to learn it was off except by turning up.
 * It now stays, marked «Abgesagt», for everyone who had answered GOING or
 * MAYBE; for the rest of the house it simply disappears.
 */
export function clientSeesEvent(
  event: { status: string; rsvps: readonly { residentId: string; status: EventRsvpStatus }[] },
  residentId: string,
): boolean {
  if (event.status !== 'CANCELLED') return true
  return event.rsvps.some(
    (rsvp) =>
      rsvp.residentId === residentId && (rsvp.status === 'GOING' || rsvp.status === 'MAYBE'),
  )
}

/** Who is told when staff cancel: the people who said «Ich komme». */
export function cancellationRecipients(
  rsvps: readonly { residentId: string; status: EventRsvpStatus }[],
): string[] {
  return [...new Set(rsvps.filter((rsvp) => rsvp.status === 'GOING').map((r) => r.residentId))]
}

/** Only a cancelled event may be deleted — a live one is cancelled first, so nobody is left out. */
export function mayDeleteEvent(event: { status: string }): boolean {
  return event.status === 'CANCELLED'
}

/** A unit as the staff event form offers it. */
export interface EventUnitOption {
  id: string
  code: string
  nickname: string | null
  address: string
  activePlacements: number
}

/**
 * The staff unit picker: 118 bare codes was a list nobody could choose from.
 * Each unit names itself by nickname and address beside its code, and the
 * units people actually live in come first — an event in an empty flat has
 * nobody to invite.
 */
export function eventUnitOptions(units: readonly EventUnitOption[]): {
  occupied: { id: string; label: string }[]
  empty: { id: string; label: string }[]
} {
  const label = (unit: EventUnitOption) =>
    [unit.code, unit.nickname, unit.address].filter((part) => part && part.trim()).join(' · ')
  const sorted = [...units].sort((a, b) => a.code.localeCompare(b.code, 'de-CH', { numeric: true }))
  const option = (unit: EventUnitOption) => ({ id: unit.id, label: label(unit) })
  return {
    occupied: sorted.filter((unit) => unit.activePlacements > 0).map(option),
    empty: sorted.filter((unit) => unit.activePlacements === 0).map(option),
  }
}
