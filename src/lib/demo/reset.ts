/**
 * Demo reset — wipe drive-by edits, restore the pristine presentation state.
 *
 * Called daily by api/cron/reset-demo (systemd timer on the box) and by the
 * CLI seed (prisma/seed-demo.ts). Four steps:
 *
 *   1. Truncate every table EXCEPT the keep-list. Enumerating from pg_tables
 *      (rather than a hand-maintained deleteMany list) means a new model added
 *      to the schema is wiped automatically — the old seed's explicit list had
 *      already gone stale against the governance tables.
 *   2. Reseed the presentation narrative (seed-data.ts).
 *   3. Upsert the demo accounts, so a visitor who renamed or broke the demo
 *      staff user self-heals. Real staff accounts live in the kept User table
 *      and are never touched.
 *   4. Re-sync the AOZ rule catalog — the truncate wiped HouseRule, and the
 *      governance pages are inert without it. Idempotent by design.
 *
 * Relative-import-safe (no '@/' aliases): prisma/seed-demo.ts loads this
 * through ts-node, which does not resolve tsconfig path aliases.
 */

import { asc, eq, like, or } from 'drizzle-orm'
import { careAssignment, escapeLike, resident, type db } from '../db'
import { ALL_DEMO_RESIDENT_CODE_PREFIXES, resolveDemoResidentCode } from './config'
import { deleteDemoWorld } from './scoped-reset'
import { STAFF_ROLE_CARE_DOMAIN } from '../config/care'
import { demoStaffCodeFor, demoStaffDoors } from './roles'
import { seedDemoData, type DemoSeedSummary } from './seed-data'
import { syncOrgRules } from '../governance/sync-org-rules'
import { upsertDemoStaff, upsertDemoStaffRoles } from './staff'
import { wipeAllExceptKeepList } from './wipe'
import { seedOpportunities } from '../seed/opportunities'

export interface DemoResetSummary extends DemoSeedSummary {
  tablesWiped: number
  demoStaffCode: string | null
  orgRulesSynced: boolean
  opportunities: number
  opportunityApplications: number
  caseloadAssignments: number
}

/**
 * `scoped` (the main site, and the default): delete only invented rows, then
 * reseed them — real residents, real flats and real listings are never
 * touched. `full` (a local dev database): truncate everything first.
 */
export type DemoResetScope = 'scoped' | 'full'

export async function resetDemoData(
  dbClient: typeof db,
  { scope = 'scoped' }: { scope?: DemoResetScope } = {},
): Promise<DemoResetSummary> {
  let tablesWiped = 0
  if (scope === 'full') {
    tablesWiped = await wipeAllExceptKeepList(dbClient)
  } else {
    await deleteDemoWorld(dbClient)
  }
  // Before the seed: the demo house rule points at an org rule by key.
  await syncOrgRules(dbClient)

  // BEFORE the seed, not after: the seed hands this account the care seats on
  // every demo resident, and an assignment cannot point at a row that does not
  // exist yet. (The wipe keeps User, so this is an update on a repeat run.)
  const demoStaff = await upsertDemoStaff(dbClient)
  // Every role door, so the visitor can walk the product as each of them.
  const roleAccounts = await upsertDemoStaffRoles(dbClient)

  const seeded = await seedDemoData(dbClient, {
    careStaffId: demoStaff?.id ?? null,
    // Only a full reset owns content no demo marker reaches.
    siteWideContent: scope === 'full',
  })

  // Invented residents only: on the main site the same table holds real
  // people. Invented listings are created BY the demo account, which is how
  // the next scoped reset finds and removes them (scoped-reset.ts).
  const demoResidents = await dbClient.query.resident.findMany({
    where: or(
      ...ALL_DEMO_RESIDENT_CODE_PREFIXES.map((prefix) =>
        like(resident.code, `${escapeLike(prefix)}%`),
      ),
      eq(resident.code, resolveDemoResidentCode()),
    ),
    columns: { id: true },
    orderBy: [asc(resident.code)],
  })
  // The author is what marks a listing as invented. Without a demo account to
  // own them the next scoped reset could never find them, so none are seeded.
  const listingAuthorId =
    demoStaff?.id ?? roleAccounts.find((a) => a.code === demoStaffCodeFor('ADMIN'))?.id ?? null
  const opportunities = listingAuthorId
    ? await seedOpportunities(dbClient, {
        residentIds: demoResidents.map((resident) => resident.id),
        staffId: listingAuthorId,
      })
    : { opportunities: 0, applications: 0, evidenceRecords: 0 }

  // Every specialist door opens onto real work. The Jobcoach and
  // Freiwilligenarbeit doors used to land on "Ihnen ist noch niemand
  // zugewiesen": the seed gave care seats only to the single legacy demo
  // account, so a visitor trying the product AS a specialist saw an empty
  // workspace — honest for a new account, useless for a demo.
  const caseloadAssignments = await assignDemoCaseloads(
    dbClient,
    roleAccounts,
    demoResidents.map((row) => row.id),
  )

  return {
    ...seeded,
    tablesWiped,
    demoStaffCode: demoStaff?.code ?? null,
    orgRulesSynced: true,
    opportunities: opportunities.opportunities,
    opportunityApplications: opportunities.applications,
    caseloadAssignments,
  }
}

/** How many invented residents each specialist door is given to work with. */
export const DEMO_CASELOAD_SIZE = 6

/**
 * Give every demo door that works a care domain its own clients, so the
 * specialist workspaces have something in them. The same residents may sit in
 * several domains — as in reality, one person has a Betreuerin AND a Jobcoach.
 * Doors without a care domain (Liegenschaften, the system admin) get none.
 */
export async function assignDemoCaseloads(
  dbClient: typeof db,
  accounts: readonly { id: string; code: string }[],
  residentIds: readonly string[],
): Promise<number> {
  const idByCode = new Map(accounts.map((account) => [account.code, account.id]))
  const rows = demoStaffDoors().flatMap((door) => {
    const domain = STAFF_ROLE_CARE_DOMAIN[door.role]
    const staffId = idByCode.get(door.code)
    if (!domain || !staffId) return []
    return residentIds
      .slice(0, DEMO_CASELOAD_SIZE)
      .map((residentId) => ({ residentId, staffId, role: domain }))
  })
  if (rows.length === 0) return 0
  // One holder per (resident, domain) is the table's rule; a seat the seed
  // already filled keeps its holder.
  const inserted = await dbClient
    .insert(careAssignment)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: careAssignment.id })
  return inserted.length
}
