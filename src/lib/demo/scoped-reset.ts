/**
 * The scoped demo reset — the invented world living beside the real one.
 *
 * The demo lives on the main site (decided 2026-09-26): anyone can open a
 * door on aoz.orangecat.ch and use the real product, next to the real flat.
 * So the nightly reset must remove ONLY what is invented, and never truncate:
 *
 *   - residents whose code carries a demo prefix,
 *   - housing units whose code starts with `DEMO-`,
 *   - listings created by a demo staff account (seeded ones, and whatever a
 *     visitor posted through a demo door).
 *
 * Everything that points at those rows goes with them. Which rows point where
 * is read from the database's own foreign keys, not from a hand-kept list:
 * the last hand-kept list (removed in PR 231) covered five tables, and the
 * schema has grown well past it. Postgres names only the FIRST blocking
 * constraint, so a missed table would not read as "you forgot X" — it would
 * fail the whole reset every night.
 *
 * Relative-import-safe (no '@/' aliases): loaded through ts-node.
 */

import { eq, inArray, like, or, sql } from 'drizzle-orm'
import { escapeLike, housingUnit, opportunity, resident, user, type db } from '../db'
import {
  ALL_DEMO_RESIDENT_CODE_PREFIXES,
  DEMO_UNIT_CODE_PREFIX,
  resolveDemoResidentCode,
} from './config'
import { demoStaffCodes } from './roles'

type Db = typeof db

interface ForeignKey {
  child: string
  column: string
  parent: string
  /** pg_constraint.confdeltype: a = no action, r = restrict, c = cascade, n/d = set null/default */
  action: string
}

/** Recursion guard: real schemas are a handful of levels deep. */
const MAX_DEPTH = 12

async function loadForeignKeys(dbClient: Db): Promise<ForeignKey[]> {
  const { rows } = await dbClient.execute(sql`
    SELECT c.conrelid::regclass::text  AS child,
           a.attname                   AS column,
           c.confrelid::regclass::text AS parent,
           c.confdeltype               AS action
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND array_length(c.conkey, 1) = 1
       AND c.connamespace = 'public'::regnamespace
  `)
  return rows as unknown as ForeignKey[]
}

async function tablesWithId(dbClient: Db): Promise<Set<string>> {
  const { rows } = await dbClient.execute(sql`
    SELECT format('%I', table_name) AS name
      FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'id'
  `)
  return new Set((rows as unknown as { name: string }[]).map((row) => row.name))
}

/**
 * Delete `ids` from `table`, and first every row that references them —
 * depth-first, whatever the constraint's ON DELETE says. Following CASCADE
 * edges explicitly too matters: a cascaded child can itself be the parent of a
 * RESTRICT row (a unit's expenses carry shares that restrict on residents).
 * Set-null edges are left to Postgres. Returns the number of rows deleted
 * from `table` itself.
 */
export async function deleteWithDependents(
  dbClient: Db,
  table: string,
  ids: readonly string[],
  graph?: { fks: ForeignKey[]; withId: Set<string> },
  depth = 0,
): Promise<number> {
  if (ids.length === 0) return 0
  if (depth > MAX_DEPTH) throw new Error(`deleteWithDependents: too deep at ${table}`)
  const { fks, withId } = graph ?? {
    fks: await loadForeignKeys(dbClient),
    withId: await tablesWithId(dbClient),
  }
  const idArray = sql`ARRAY[${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )}]::text[]`

  for (const fk of fks) {
    if (fk.parent !== table || fk.action === 'n' || fk.action === 'd') continue
    const child = sql.raw(fk.child)
    const column = sql.raw(`"${fk.column}"`)
    if (withId.has(fk.child)) {
      const { rows } = await dbClient.execute(
        sql`SELECT id FROM ${child} WHERE ${column} = ANY(${idArray})`,
      )
      const childIds = (rows as unknown as { id: string }[]).map((row) => row.id)
      await deleteWithDependents(dbClient, fk.child, childIds, { fks, withId }, depth + 1)
    } else {
      // A table without an id (a join table) is referenced by nothing.
      await dbClient.execute(sql`DELETE FROM ${child} WHERE ${column} = ANY(${idArray})`)
    }
  }

  const result = await dbClient.execute(
    sql`DELETE FROM ${sql.raw(table)} WHERE id = ANY(${idArray})`,
  )
  return result.rowCount ?? 0
}

export interface DemoWorldDeleted {
  residentsDeleted: number
  unitsDeleted: number
  opportunitiesDeleted: number
}

/** Remove every invented row, and everything hanging off it. No-op when absent. */
export async function deleteDemoWorld(dbClient: Db): Promise<DemoWorldDeleted> {
  const graph = { fks: await loadForeignKeys(dbClient), withId: await tablesWithId(dbClient) }

  const demoStaff = await dbClient
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.code, demoStaffCodes()))
  const demoOpportunities = demoStaff.length
    ? await dbClient
        .select({ id: opportunity.id })
        .from(opportunity)
        .where(
          inArray(
            opportunity.createdByUserId,
            demoStaff.map((row) => row.id),
          ),
        )
    : []

  const demoResidents = await dbClient
    .select({ id: resident.id })
    .from(resident)
    .where(
      or(
        ...ALL_DEMO_RESIDENT_CODE_PREFIXES.map((prefix) =>
          like(resident.code, `${escapeLike(prefix)}%`),
        ),
        eq(resident.code, resolveDemoResidentCode()),
      ),
    )
  const demoUnits = await dbClient
    .select({ id: housingUnit.id })
    .from(housingUnit)
    .where(like(housingUnit.code, `${escapeLike(DEMO_UNIT_CODE_PREFIX)}%`))

  const opportunitiesDeleted = await deleteWithDependents(
    dbClient,
    '"Opportunity"',
    demoOpportunities.map((row) => row.id),
    graph,
  )
  const residentsDeleted = await deleteWithDependents(
    dbClient,
    '"Resident"',
    demoResidents.map((row) => row.id),
    graph,
  )
  const unitsDeleted = await deleteWithDependents(
    dbClient,
    '"HousingUnit"',
    demoUnits.map((row) => row.id),
    graph,
  )
  return { residentsDeleted, unitsDeleted, opportunitiesDeleted }
}
