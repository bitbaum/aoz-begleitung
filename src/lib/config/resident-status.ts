/**
 * Who is still in AOZ's care.
 *
 * A resident is `ACTIVE` before a placement and `PLACED` after one; both are
 * people this product accompanies. Housing is one part of a person's
 * situation, not a gate on the others — a query that means "everyone we
 * support" and says `ACTIVE` alone silently drops everybody who has been
 * housed. That happened to the Einsatzplatz picker: placed clients could not
 * be put forward for a job. One definition, so it cannot happen per query.
 */
export const IN_CARE_RESIDENT_STATUSES = ['ACTIVE', 'PLACED'] as const

/**
 * Placed or not — decided by the PLACEMENT, never by `Resident.status`.
 *
 * The status is a flag a placement action sets on the side; the active
 * placement row is the fact. They drift (a move-out that ended the placement
 * but left the status, an import that set one and not the other), and when
 * they did, /residents?seat=all showed «Platziert 12 / Unplatziert 1» in the
 * tabs, «2 ohne Platzierung» in the header and «11 / 2» in the tiles — three
 * definitions on one screen. Every count on that page now reads this one, and
 * `placedClientsWhere` / `unplacedClientsWhere` in config/client-filters.ts are
 * its SQL twin, held together by client-filters.test.ts.
 *
 * `exited` is anybody no longer in care, whatever their placements say.
 */
export type PlacementStand = 'placed' | 'unplaced' | 'exited'

export function placementStand(row: {
  status: string
  /** ACTIVE placements only. */
  placements?: readonly unknown[] | null
}): PlacementStand {
  if (!(IN_CARE_RESIDENT_STATUSES as readonly string[]).includes(row.status)) return 'exited'
  return (row.placements?.length ?? 0) > 0 ? 'placed' : 'unplaced'
}
