/**
 * The real AOZ team — data config for scripts/maintenance/ensure-aoz-team.ts.
 *
 * Four people, and the product must describe them as they actually are rather
 * than approximate them with the nearest available enum value. That was the
 * whole reason role, reach and administration became three columns:
 *
 *   Franziska is a Betreuerin who ALSO sees every client. The only way to say
 *   that used to be `ADMIN`, which erased the fact that housing is her domain
 *   and handed her the settings page as a side effect. Here her role stays
 *   true and her breadth is stated separately.
 *
 *   Simon and Sandra each work one domain, which is the ordinary shape.
 *
 *   Manuel is responsible for the HOUSING ITSELF — units, placements,
 *   maintenance — and carries NO caseload. He and Franziska were briefly given
 *   the same `BETREUUNG` role on the grounds that the permissions matched.
 *   They do not do the same job: she supports a PERSON about their housing and
 *   holds their HOUSING care seat; he is responsible for the BUILDING. Saying
 *   that with one role said they were one job.
 *
 *   `LIEGENSCHAFTEN` is therefore the first role staffed for no care domain at
 *   all. `STAFF_ROLE_CARE_DOMAIN` leaves it undefined — the same shape retired
 *   ADMIN has, for the opposite reason: ADMIN works every seat, this works
 *   none. `roleHasCaseload()` is how the product asks, so "no clients" reads
 *   as his job rather than as an account nobody has finished setting up.
 *
 * Nobody here is a system administrator. Running the house is not the same as
 * configuring the product; that stays with the operator account, and granting
 * it is a deliberate one-line change, not something a care role implies.
 *
 * ⚠️ `AOZ-ADMIN1` is NOT in this list and must not be added. It is the
 * operator account, and it is also George's own staff profile — renamed from
 * "Administrator" to "Georgy" on 2026-09-05, deliberately. Its `Account`
 * (butaeff@gmail.com) carries BOTH a `userId` and a `residentId`, so one email
 * and one password reach the Verwaltung as Georgy and the portal as the
 * resident Georgy (RES-LCCM7A), with a one-click switch each way. That is the
 * dual-identity design working, not drift to be cleaned up: do not rename it
 * back, do not split it into two accounts, and do not delete the resident
 * record because a staff member shares its name.
 *
 * It keeps the retired ADMIN role on purpose — that role is exactly
 * ALL_DOMAINS + isSystemAdmin, which is what an operator needs, and testing
 * another role's view is what "Ansicht wechseln" is for rather than a second
 * account. `db:seed:admin` matches by CODE and skips an existing row, so the
 * rename survives a reseed.
 *
 * There is no Sozialarbeit staff member. That is a fact about AOZ, not a gap
 * in this file — the SOCIAL care seat is covered by Franziska's oversight, and
 * `ensure-aoz-team.ts` reports it rather than leaving it silently unstaffed.
 *
 * ⚠️ People are matched by NAME. Adding a surname to "Sandra" or "Manuel"
 * later does not rename anybody — it mints a SECOND user, which is exactly the
 * duplicate this instance is already carrying for one resident. Correct a name
 * in the database, not by editing this file.
 *
 * Login codes are NOT in this file, for the same reason they are absent from
 * the apartment config: they are generated when the script runs and printed
 * once. Committing them would publish four working staff logins.
 */

import type { StaffRole, StaffScopeId } from '../../../src/lib/auth/role-policy'

export interface RealStaffSeed {
  /** Shown wherever staff are listed; never a bare code. */
  name: string
  /** The care domain this person is staffed for — or the work they do, when
   *  that is not a care domain at all (Liegenschaften). */
  role: StaffRole
  /** Whose files they may open. */
  scope: StaffScopeId
  /** May they reconfigure the product? Deliberately false for all four. */
  isSystemAdmin: boolean
  /** Why this shape, in one line — read by the script's output. */
  note: string
}

export const AOZ_TEAM: readonly RealStaffSeed[] = [
  {
    name: 'Franziska Heimhuber',
    role: 'BETREUUNG',
    scope: 'ALL_DOMAINS',
    isSystemAdmin: false,
    note: 'Betreuerin — Wohnen ist ihr Bereich, sie sieht zusätzlich alle Klient*innen.',
  },
  {
    name: 'Simon B.',
    role: 'JOBCOACH',
    scope: 'OWN_DOMAIN',
    isSystemAdmin: false,
    note: 'Jobcoach — sieht die Personen, die er begleitet.',
  },
  {
    name: 'Sandra',
    role: 'FREIWILLIGENARBEIT',
    scope: 'OWN_DOMAIN',
    isSystemAdmin: false,
    note: 'Freiwilligenarbeit — sieht die Personen, die sie begleitet.',
  },
  {
    name: 'Manuel',
    role: 'LIEGENSCHAFTEN',
    scope: 'OWN_DOMAIN',
    isSystemAdmin: false,
    note: 'Liegenschaften — Unterkünfte, Platzierungen und Unterhalt. Keine Fallführung.',
  },
] as const
