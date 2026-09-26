/**
 * Which housing counts as CAPACITY — one definition, three call sites.
 *
 * ## The bug this exists to end
 *
 * `totalBeds` was summed over every unit regardless of status, and free beds is
 * `totalBeds − occupiedBeds`. So a CLOSED building contributed beds nobody can
 * be placed into, and the dashboard advertised them as free.
 *
 * That was harmless while the database held only units AOZ actually runs. It
 * stopped being harmless on 2026-09-04, when the 118 flats of a real
 * street terrace were entered from the federal register: a terrace under demolition
 * order, most of which AOZ may not hold. Their beds are 0 today precisely
 * BECAUSE of this bug — the moment anyone types a real bed count into a flat
 * that is not yet in service, the all-domains Betreuerin's "Freie Plätze" tile inflates.
 *
 * Capacity you cannot place anyone into is not capacity. It is worse than a
 * missing number, because it reads as headroom during exactly the conversation
 * where headroom decides whether somebody gets a bed tonight.
 *
 * ## Where the line sits, and why not one step further
 *
 * `MAINTENANCE` still counts. A flat being repaired is stock AOZ holds and will
 * get back; excluding it would make occupancy jump every time a shower breaks
 * and drop again when it is fixed, which would read as a placement trend that
 * never happened.
 *
 * `CLOSED` does not count. It means the unit is not in service — not yet
 * commissioned, handed back, or awaiting demolition. Nobody can be placed
 * there, so it is not headroom.
 */

import type { HousingStatus } from '@/lib/db'

/**
 * Statuses whose beds are real, placeable capacity.
 *
 * Deliberately an allowlist rather than "everything except CLOSED": a status
 * added later must be considered rather than silently counted, and the failure
 * direction of forgetting is then "capacity looks smaller", which is the safe
 * way to be wrong about how many free beds exist.
 */
export const CAPACITY_STATUSES: readonly HousingStatus[] = ['AVAILABLE', 'FULL', 'MAINTENANCE']

export function countsTowardCapacity(status: HousingStatus): boolean {
  return CAPACITY_STATUSES.includes(status)
}

/**
 * Total placeable beds across a set of units.
 *
 * Takes the whole list and filters here, rather than expecting every caller to
 * remember the `where` clause — the three call sites that had this wrong were
 * each individually reasonable-looking.
 */
export function placeableBeds(units: readonly { totalBeds: number; status: HousingStatus }[]) {
  return units.reduce(
    (sum, unit) => (countsTowardCapacity(unit.status) ? sum + unit.totalBeds : sum),
    0,
  )
}
