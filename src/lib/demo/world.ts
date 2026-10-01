/**
 * Which world a viewer lives in — the invented one or the real one — and the
 * rule that every LIST follows from it.
 *
 * ## Why this exists
 *
 * The demo lives on the production site beside the real flat (decided
 * 2026-09-26). Observed live afterwards: the REAL Jobcoach logged in and his
 * Eingang badge said 2 — both were invented residents' requests. He would have
 * spent his morning answering people who do not exist, and a real client on
 * the portal could press "Ich habe Interesse" on an invented employer.
 *
 * So the rule is the matcher's rule (`belongsToSameWorld`), applied to every
 * list rather than only to compatibility candidates: a demo viewer sees only
 * the invented world, a real viewer only the real one. Neither can reach into
 * the other.
 *
 * ## What "invented" means — one definition, reused
 *
 * Exactly what the nightly scoped reset deletes (`lib/demo/scoped-reset.ts`),
 * so a row the reset can clean is exactly a row real staff never see:
 *  - a resident whose code carries a demo prefix (`isDemoResidentCode`),
 *  - a housing unit whose code starts with `DEMO-` (`isDemoUnitCode`),
 *  - a listing authored by a demo staff account (`demoStaffCodes()`, which
 *    includes the legacy `DEMO_STAFF_CODE`, `WG-DEMO01` in production).
 *
 * A PLACEHOLDER resident is REAL-world here. Placeholders sit in real AOZ
 * flats waiting for the person who will claim the code; real staff must see
 * them. They stay out of the KPIs (`lib/analytics/real-data.ts`), which is a
 * different question from who may see a row.
 */

import { inArray, isNull, like, not, notInArray, or, sql, type SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

import { belongsToSameWorld, isDemoResidentCode, isDemoUnitCode } from '@/lib/analytics/real-data'
import { db, escapeLike, housingUnit, resident, user } from '@/lib/db'
import { ALL_DEMO_RESIDENT_CODE_PREFIXES, DEMO_UNIT_CODE_PREFIX } from '@/lib/demo/config'
import { demoStaffCodes } from '@/lib/demo/roles'

// =============================================================================
// Pure predicates
// =============================================================================

/** Is this staff member a demo door? Matches the reset's list exactly. */
export function isDemoViewer(viewer: { code: string }): boolean {
  return demoStaffCodes().includes(viewer.code)
}

/** Invented resident? Placeholders are NOT — they are real-world rows. */
export function isDemoResident(row: { code: string }): boolean {
  return isDemoResidentCode(row.code)
}

export function isDemoUnit(row: { code: string }): boolean {
  return isDemoUnitCode(row.code)
}

/** Invented listing = authored by a demo staff account. */
export function isDemoListing(
  row: { createdByUserId: string | null },
  demoStaffIds: ReadonlySet<string>,
): boolean {
  return row.createdByUserId !== null && demoStaffIds.has(row.createdByUserId)
}

/** The viewer's world, resolved once per request. */
export interface ViewerWorld {
  isDemo: boolean
  /** Ids of every demo staff account — what marks a listing as invented. */
  demoStaffIds: ReadonlySet<string>
}

/**
 * A real world with no demo accounts — what a test or an instance without
 * demo doors resolves to.
 */
export const REAL_WORLD: ViewerWorld = { isDemo: false, demoStaffIds: new Set() }

/** Keep a row whose own demo-ness is `rowIsDemo` for this viewer? */
export function visibleIn(world: ViewerWorld, rowIsDemo: boolean): boolean {
  return belongsToSameWorld(world.isDemo, rowIsDemo)
}

/** Filter loaded rows that carry a resident down to the viewer's world. */
export function residentsInWorld<T>(
  rows: readonly T[],
  world: ViewerWorld,
  residentOf: (row: T) => { code: string } | null | undefined,
): T[] {
  return rows.filter((row) => {
    const subject = residentOf(row)
    // A row with no resident cannot be identified as invented: real-world.
    return visibleIn(world, subject ? isDemoResident(subject) : false)
  })
}

/** Filter loaded rows that carry a housing unit down to the viewer's world. */
export function unitsInWorld<T>(
  rows: readonly T[],
  world: ViewerWorld,
  unitOf: (row: T) => { code: string } | null | undefined,
): T[] {
  return rows.filter((row) => {
    const unit = unitOf(row)
    return visibleIn(world, unit ? isDemoUnit(unit) : false)
  })
}

// =============================================================================
// SQL fragments — the same rule, for pages that already build a WHERE
// =============================================================================

function startsWithAny(column: AnyPgColumn, prefixes: readonly string[]): SQL {
  const matches = prefixes.map((prefix) => like(column, `${escapeLike(prefix)}%`))
  return (matches.length === 1 ? matches[0] : or(...matches)) as SQL
}

/** `resident.code` (or any resident code column) in the viewer's world. */
export function residentCodeInWorld(column: AnyPgColumn, world: ViewerWorld): SQL {
  const demo = startsWithAny(column, ALL_DEMO_RESIDENT_CODE_PREFIXES)
  return world.isDemo ? demo : not(demo)
}

/** `housingUnit.code` in the viewer's world. */
export function unitCodeInWorld(column: AnyPgColumn, world: ViewerWorld): SQL {
  const demo = startsWithAny(column, [DEMO_UNIT_CODE_PREFIX])
  return world.isDemo ? demo : not(demo)
}

/**
 * `opportunity.createdByUserId` in the viewer's world.
 *
 * A listing with no author is real-world. With no demo accounts at all, the
 * demo world holds no listings and the real world holds every one.
 */
export function listingAuthorInWorld(column: AnyPgColumn, world: ViewerWorld): SQL {
  const ids = [...world.demoStaffIds]
  if (world.isDemo) return ids.length > 0 ? inArray(column, ids) : sql`false`
  return ids.length > 0 ? (or(isNull(column), notInArray(column, ids)) as SQL) : sql`true`
}

/** A foreign key to `Resident.id`, narrowed to residents of the viewer's world. */
export function residentIdInWorld(column: AnyPgColumn, world: ViewerWorld): SQL {
  return inArray(
    column,
    db.select({ id: resident.id }).from(resident).where(residentCodeInWorld(resident.code, world)),
  )
}

/** A foreign key to `HousingUnit.id`, narrowed to flats of the viewer's world. */
export function unitIdInWorld(column: AnyPgColumn, world: ViewerWorld): SQL {
  return inArray(
    column,
    db
      .select({ id: housingUnit.id })
      .from(housingUnit)
      .where(unitCodeInWorld(housingUnit.code, world)),
  )
}

/**
 * `User.id` in the viewer's world: demo doors are the invented staff, every
 * other account is real. Keeps the demo accounts out of a real Leitung's
 * "never signed in" handover count.
 */
export function staffIdInWorld(column: AnyPgColumn, world: ViewerWorld): SQL {
  const ids = [...world.demoStaffIds]
  if (world.isDemo) return ids.length > 0 ? inArray(column, ids) : sql`false`
  return ids.length > 0 ? notInArray(column, ids) : sql`true`
}

// =============================================================================
// Loading
// =============================================================================

/** Ids of the demo staff accounts that exist on this instance. */
export async function loadDemoStaffIds(): Promise<ReadonlySet<string>> {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.code, demoStaffCodes()))
  return new Set(rows.map((row) => row.id))
}

/**
 * The world of a signed-in staff member.
 *
 * Resolved by id against the demo accounts rather than by reading the code
 * off the session: the session does not carry the code, and one id-only query
 * answers both questions this module needs (am I demo, which listings are).
 * No viewer → real world: the narrow direction to be wrong in is the one
 * that shows no invented people.
 */
export async function staffViewerWorld(userId: string | null | undefined): Promise<ViewerWorld> {
  const demoStaffIds = await loadDemoStaffIds()
  return { isDemo: !!userId && demoStaffIds.has(userId), demoStaffIds }
}

/** The world of a signed-in resident: their own code decides it. */
export async function residentViewerWorld(viewer: { code: string }): Promise<ViewerWorld> {
  return { isDemo: isDemoResident(viewer), demoStaffIds: await loadDemoStaffIds() }
}
