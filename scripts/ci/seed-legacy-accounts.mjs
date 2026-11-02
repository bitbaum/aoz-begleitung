#!/usr/bin/env node
/**
 * CI only: people as AOZ's own sign-in left them, written before
 * scripts/db/accountkit-import.sql runs, so the browser smoke proves the
 * imported accounts work on AccountKit: a staff member with a code and an
 * email + bcrypt password (an admin, so their role and reach are visible), and
 * a resident with a code only. Synthetic codes, address and password, from env.
 *
 *   DATABASE_URL=… STAFF_EMAIL=… STAFF_PASSWORD=… STAFF_CODE=… RESIDENT_CODE=… \
 *     node scripts/ci/seed-legacy-accounts.mjs
 */
import bcrypt from 'bcryptjs'
import pg from 'pg'

const { DATABASE_URL, STAFF_EMAIL, STAFF_PASSWORD, STAFF_CODE, RESIDENT_CODE } = process.env
if (!DATABASE_URL || !STAFF_EMAIL || !STAFF_PASSWORD || !STAFF_CODE || !RESIDENT_CODE) {
  console.error('set DATABASE_URL, STAFF_EMAIL, STAFF_PASSWORD, STAFF_CODE and RESIDENT_CODE')
  process.exit(2)
}
const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()
try {
  // AOZ's own cost factor (src/lib/auth/passwords.ts).
  const hash = await bcrypt.hash(STAFF_PASSWORD, 12)
  await client.query(
    `INSERT INTO "User" (id, "updatedAt", name, code, active, "isSystemAdmin", scope, "siteAccess")
     VALUES ('smoke-staff', now(), 'Smoke Staff', $1, true, true, 'ALL_DOMAINS', 'ALL_UNITS')`,
    [STAFF_CODE],
  )
  await client.query(
    `INSERT INTO "Account" (id, "updatedAt", email, "passwordHash", "emailVerifiedAt", "userId")
     VALUES ('smoke-account', now(), $1, $2, now(), 'smoke-staff')`,
    [STAFF_EMAIL, hash],
  )
  await client.query(
    `INSERT INTO "Resident" (id, "updatedAt", code, "ageRange", gender, "familyStatus",
       "sleepSchedule", "noiseTolerance", "cleanlinessPractice", "socialStyle",
       "smokingStatus", "mobilityNeeds", "privacyNeed", "isPlaceholder")
     VALUES ('smoke-resident', now(), $1, 'ADULT', 'PREFER_NOT_SAY', 'SINGLE', 'STANDARD', 3, 3,
       'MODERATE', 'NON_SMOKER', 'NONE', 3, false)`,
    [RESIDENT_CODE],
  )
  console.log('seeded 1 staff account (code + bcrypt) and 1 resident (code)')
} finally {
  await client.end()
}
