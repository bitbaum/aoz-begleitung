/**
 * Full data wipe with a keep-list — shared by the demo reset (lib/demo/reset)
 * and the real-apartment seed (prisma/seed-real.ts --wipe).
 *
 * Enumerates pg_tables rather than a hand-maintained deleteMany list, so a
 * new model added to the schema is wiped automatically — the old seed's
 * explicit list had already gone stale against the governance tables.
 *
 * Relative-import-safe (no '@/' aliases): loaded through ts-node.
 */

import { sql } from 'drizzle-orm'
import type { db } from '../db'

/**
 * Tables that survive a wipe:
 * - _prisma_migrations, _deploy_schema_history — schema state, never data.
 *   The second is the ledger the deploy's apply-schema step reads; emptying
 *   it makes the next deploy try to re-apply every migration.
 * - User               — real staff accounts
 * - AlgorithmWeight    — tuned scoring config, not seed data
 * - SystemConfig       — operator configuration, not seed data
 */
export const KEEP_TABLES = new Set([
  '_prisma_migrations',
  '_deploy_schema_history',
  'User',
  'AlgorithmWeight',
  'SystemConfig',
])

/** Truncate every public table except the keep-list. Returns the wiped count. */
export async function wipeAllExceptKeepList(dbClient: typeof db): Promise<number> {
  const { rows } = await dbClient.execute(sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `)
  const tables = rows as unknown as Array<{ tablename: string }>
  const wipe = tables.map((t) => t.tablename).filter((t) => !KEEP_TABLES.has(t))

  if (wipe.length > 0) {
    // Table names come from pg_tables, not user input; quoting preserves the
    // PascalCase names Prisma creates. CASCADE clears FK order concerns —
    // none of the kept tables reference a wiped one.
    await dbClient.execute(
      sql.raw(`TRUNCATE TABLE ${wipe.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`),
    )
  }

  return wipe.length
}
