/**
 * A PGlite database with AOZ's committed migration chain, a synthetic legacy
 * snapshot imported by the real import SQL, and the env the shared runtime
 * reads. Test files mock '@/lib/db' onto `holder.db` (see accountkit-runtime).
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import bcrypt from 'bcryptjs'

export const SITE = 'https://aoz.example.test'
export const PASSWORD = 'synthetic legacy password'

export async function openSharedDb(holder: { db: unknown }): Promise<PGlite> {
  Object.assign(process.env, {
    AUTH_RUNTIME: 'accountkit',
    DATABASE_URL: 'postgres://synthetic',
    NEXT_PUBLIC_APP_URL: SITE,
    BETTER_AUTH_SECRET: 'synthetic-aoz-runtime-secret-at-least-32-characters',
  })
  delete process.env.RESEND_API_KEY
  const pg = new PGlite()
  const dir = path.join(process.cwd(), 'drizzle')
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(await readFile(path.join(dir, file), 'utf8'))
  }
  const schemaTables = await import('@/lib/db/schema')
  const schemaRelations = await import('@/lib/db/relations')
  holder.db = drizzle(pg, { schema: { ...schemaTables, ...schemaRelations } })
  return pg
}

/** Dual, code-only, password-only and invited people, then the real import. */
export async function seedAndImport(pg: PGlite): Promise<void> {
  await pg.exec(`TRUNCATE users, accounts, sessions, verifications, passkeys, two_factors,
    "AccountIdentity", "Account", "User", "Resident", "ClaimInvite" CASCADE`)
  await pg.exec(`
    INSERT INTO "User" (id, "updatedAt", name, code, active, "isSystemAdmin", "siteAccess") VALUES
      ('staff-dual', now(), 'Synthetic dual', 'AOZ-SYNTHETIC1', true, true, 'ALL_UNITS'),
      ('staff-code', now(), 'Synthetic code', 'AOZ-SYNTHETIC2', true, false, 'ALL_UNITS'),
      ('staff-invited', now(), 'Synthetic invited', 'AOZ-SYNTHETIC3', true, false, 'ALL_UNITS');
    INSERT INTO "Resident" (id, "updatedAt", code, "ageRange", gender, "familyStatus",
      "sleepSchedule", "noiseTolerance", "cleanlinessPractice", "socialStyle",
      "smokingStatus", "mobilityNeeds", "privacyNeed", "isPlaceholder")
    SELECT id, now(), code, 'ADULT', 'PREFER_NOT_SAY', 'SINGLE', 'STANDARD', 3, 3,
      'MODERATE', 'NON_SMOKER', 'NONE', 3, placeholder FROM (VALUES
      ('resident-dual', 'RES-SYNTHETIC1', false), ('resident-code', 'RES-SYNTHETIC2', true),
      ('resident-password', 'RES-SYNTHETIC3', false)) AS r(id, code, placeholder);
  `)
  await pg.query(
    `INSERT INTO "Account" (id, "updatedAt", email, "passwordHash", "emailVerifiedAt", "userId", "residentId")
     VALUES ('account-dual', now(), 'dual@example.test', $1, now(), 'staff-dual', 'resident-dual'),
       ('account-password', now(), 'password@example.test', $1, NULL, NULL, 'resident-password'),
       ('account-invited', now(), 'invited@example.test', NULL, NULL, 'staff-invited', NULL)`,
    [await bcrypt.hash(PASSWORD, 4)],
  )
  await pg.exec('BEGIN')
  try {
    await pg.exec(await readFile('scripts/db/accountkit-import.sql', 'utf8'))
    await pg.exec('COMMIT')
  } catch (error) {
    await pg.exec('ROLLBACK')
    throw error
  }
}

export const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
