/**
 * Keeping unclaimed placeholder profiles out of the numbers the pilot is
 * judged on.
 *
 * ## Why this exists
 *
 * A PLACEHOLDER is a seeded profile with a plausible name and a real login
 * code, sitting in a real AOZ flat and waiting for the person who will claim
 * it at /register (`Resident.isPlaceholder`). Until that happens there is
 * nobody behind the row.
 *
 * Leaving placeholders in would not merely inflate a headcount, it would bend
 * the numbers the WRONG WAY: a seeded profile nobody is serving reads as a
 * client with no labour-market contact and no German level recorded, so the
 * more of them exist, the worse the service looks.
 *
 * History: until 2026-10-01 this module also excluded an invented demo world
 * (DEMO- flats, demo-prefixed residents, re-seeded nightly). Measured
 * 2026-09-03, seven of eight interpersonal incidents in 180 days were demo and
 * the page reported "67% mehr Konflikte" off them. That world was removed at
 * the owner's request; placeholders are the only seeded people left.
 *
 * ## Why a SET rather than a WHERE
 *
 * The ids are loaded into a set and applied as a pure predicate rather than
 * expressed as SQL, so `excludesPlaceholders` can be tested without a database
 * and proven by mutation. The flag is provenance, not "has no account": real
 * clients who never registered are real, and placeholder codes carry no prefix
 * because a code has to survive the takeover and cannot be re-prefixed.
 */

import { db } from '@/lib/db'

/** The placeholder residents to leave out, by id. */
export interface PlaceholderScope {
  residentIds: ReadonlySet<string>
}

export const EMPTY_PLACEHOLDER_SCOPE: PlaceholderScope = { residentIds: new Set() }

/** Anything that may carry a resident — placements, learning records, check-ins. */
export interface MaybePlaceholderRow {
  residentId?: string | null
}

/** Keep this row in the pilot's numbers? */
export function isRealRow(row: MaybePlaceholderRow, scope: PlaceholderScope): boolean {
  return !(row.residentId && scope.residentIds.has(row.residentId))
}

/** Filter a collection down to the rows about people actually being served. */
export function excludesPlaceholders<T extends MaybePlaceholderRow>(
  rows: readonly T[],
  scope: PlaceholderScope,
): T[] {
  return rows.filter((row) => isRealRow(row, scope))
}

/**
 * Load the placeholder ids once per analytics request.
 *
 * Selects ids and the flag only — nothing here reaches a UI.
 */
export async function loadPlaceholderScope(): Promise<PlaceholderScope> {
  const residents = await db.query.resident.findMany({
    columns: { id: true, isPlaceholder: true },
  })
  return {
    residentIds: new Set(residents.filter((r) => r.isPlaceholder).map((r) => r.id)),
  }
}
