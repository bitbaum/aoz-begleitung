import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import bcrypt from 'bcryptjs'
import { createPasswordHasher } from '@bitbaum/accountkit/auth/hash'
import { createAuthInstance } from '@bitbaum/accountkit/auth/server'
import { authSchema } from '@bitbaum/accountkit/auth/schema'

let pg: PGlite
let importSql: string
let legacyHash: string
let sharedHash: string
const longPassword = 'x'.repeat(80) + 'a'

beforeAll(async () => {
  pg = new PGlite()
  const dir = path.join(process.cwd(), 'drizzle')
  for (const file of (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(await readFile(path.join(dir, file), 'utf8'))
  }
  importSql = await readFile('scripts/db/accountkit-import.sql', 'utf8')
  legacyHash = await bcrypt.hash('legacy password', 4)
  sharedHash = await createPasswordHasher(bcrypt, 4).hash(longPassword)
})

afterAll(async () => pg?.close())

beforeEach(async () => {
  await pg.exec('TRUNCATE users, "Account", "User", "Resident" CASCADE')
  await pg.exec(`
    INSERT INTO "User" (id, "updatedAt", name, code, active, "isSystemAdmin", "siteAccess") VALUES
      ('staff-dual', now(), 'Synthetic dual', 'AOZ-SYNTHETIC1', true, true, 'ASSIGNED_UNITS'),
      ('staff-code', now(), 'Synthetic code', 'AOZ-SYNTHETIC2', true, false, 'ALL_UNITS'),
      ('staff-invited', now(), 'Synthetic invited', 'AOZ-SYNTHETIC3', true, false, 'ALL_UNITS'),
      ('staff-inactive', now(), 'Synthetic inactive', 'AOZ-SYNTHETIC4', false, false, 'ALL_UNITS');
    INSERT INTO "Resident" (id, "updatedAt", code, "ageRange", gender, "familyStatus",
      "sleepSchedule", "noiseTolerance", "cleanlinessPractice", "socialStyle",
      "smokingStatus", "mobilityNeeds", "privacyNeed")
    SELECT id, now(), code, 'ADULT', 'PREFER_NOT_SAY', 'SINGLE', 'STANDARD', 3, 3,
      'MODERATE', 'NON_SMOKER', 'NONE', 3 FROM (VALUES
      ('resident-dual', 'RES-SYNTHETIC1'), ('resident-code', 'RES-SYNTHETIC2'),
      ('resident-password', 'RES-SYNTHETIC3')) AS r(id, code);
  `)
  await pg.query(
    `
    INSERT INTO "Account" (id, "updatedAt", email, "passwordHash", "emailVerifiedAt", "userId", "residentId")
    VALUES ('account-dual', now(), 'Dual@Example.invalid', $1, now(), 'staff-dual', 'resident-dual'),
      ('account-password', now(), 'password@example.invalid', $2, NULL, NULL, 'resident-password'),
      ('account-invited', now(), 'invited@example.invalid', NULL, NULL, 'staff-invited', NULL)
  `,
    [legacyHash, sharedHash],
  )
  await pg.exec(`
    INSERT INTO "ClaimInvite" (id, "tokenHash", "userId", "expiresAt")
      VALUES ('synthetic-invite', 'synthetic-hash', 'staff-invited', now() + interval '1 day');
    INSERT INTO "AuthToken" (id, "tokenHash", purpose, "expiresAt", "accountId")
      VALUES ('synthetic-reset', 'synthetic-reset-hash', 'RESET_PASSWORD', now() + interval '1 day', 'account-dual');
  `)
})

async function runImport(rollback = false) {
  await pg.exec('BEGIN')
  try {
    await pg.exec(importSql)
    await pg.exec(rollback ? 'ROLLBACK' : 'COMMIT')
  } catch (error) {
    await pg.exec('ROLLBACK')
    throw error
  }
}

async function originalSnapshot() {
  const snapshots = []
  for (const table of ['Account', 'User', 'Resident', 'ClaimInvite', 'AuthToken']) {
    snapshots.push((await pg.query(`SELECT * FROM "${table}" ORDER BY id`)).rows)
  }
  return snapshots
}

test('imports stable accounts, both actors, unclaimed invitations and code-only identities without changing domain rows', async () => {
  const before = await originalSnapshot()
  await runImport()
  expect(await originalSnapshot()).toEqual(before)
  const mappings = (await pg.query('SELECT * FROM "AccountIdentity" ORDER BY "sharedUserId"')).rows
  expect(mappings).toHaveLength(6)
  expect(mappings).toContainEqual({
    sharedUserId: 'account-dual',
    legacyAccountId: 'account-dual',
    staffId: 'staff-dual',
    residentId: 'resident-dual',
  })
  expect(mappings).toContainEqual({
    sharedUserId: 'aoz-staff:staff-inactive',
    legacyAccountId: null,
    staffId: 'staff-inactive',
    residentId: null,
  })
  expect(
    (await pg.query('SELECT account_id, password FROM accounts ORDER BY account_id')).rows,
  ).toEqual([
    { account_id: 'account-dual', password: legacyHash },
    { account_id: 'account-password', password: sharedHash },
  ])
  const users = (
    await pg.query<{ email: string; role: string; email_verified: boolean }>('SELECT * FROM users')
  ).rows
  expect(users.every((u) => u.role === 'customer')).toBe(true)
  expect(users.find((u) => u.email === 'dual@example.invalid')?.email_verified).toBe(true)
  expect(
    users.filter((u) => u.email !== 'dual@example.invalid').every((u) => !u.email_verified),
  ).toBe(true)
  await runImport()
  expect((await pg.query('SELECT * FROM "AccountIdentity" ORDER BY "sharedUserId"')).rows).toEqual(
    mappings,
  )
})

test('rollback rehearsal leaves all shared tables empty and all domain records intact', async () => {
  const before = await originalSnapshot()
  await runImport(true)
  expect((await pg.query('SELECT * FROM users')).rows).toEqual([])
  expect((await pg.query('SELECT * FROM accounts')).rows).toEqual([])
  expect((await pg.query('SELECT * FROM "AccountIdentity"')).rows).toEqual([])
  expect(await originalSnapshot()).toEqual(before)
})

test('refuses normalized email collisions rather than silently joining two humans', async () => {
  await pg.exec(`INSERT INTO "Account" (id, "updatedAt", email)
    VALUES ('collision', now(), 'dual@example.invalid')`)
  await expect(runImport()).rejects.toThrow('reconciliation')
  expect((await pg.query('SELECT * FROM users')).rows).toEqual([])
})

test('refuses a generated code identity colliding with an existing account id', async () => {
  await pg.exec(`INSERT INTO "Account" (id, "updatedAt", email)
    VALUES ('aoz-staff:staff-code', now(), 'collision@example.invalid')`)
  await expect(runImport()).rejects.toThrow('reconciliation')
  expect((await pg.query('SELECT * FROM users')).rows).toEqual([])
})

test('refuses existing shared ownership and rolls back every attempted insertion', async () => {
  await pg.exec(`INSERT INTO users (id, email) VALUES ('someone-else', 'dual@example.invalid')`)
  await expect(runImport()).rejects.toThrow('snapshot differs')
  expect((await pg.query('SELECT id FROM users')).rows).toEqual([{ id: 'someone-else' }])
  expect((await pg.query('SELECT * FROM accounts')).rows).toEqual([])
})

test('never overwrites a changed shared password on a later import', async () => {
  await runImport()
  await pg.exec(
    "UPDATE accounts SET password = 'synthetic-new-hash' WHERE account_id = 'account-dual'",
  )
  await expect(runImport()).rejects.toThrow('snapshot differs')
  expect(
    (await pg.query("SELECT password FROM accounts WHERE account_id = 'account-dual'")).rows,
  ).toEqual([{ password: 'synthetic-new-hash' }])
})

test('real shared runtime reads imported hashes and stable ids; reset revokes its sessions', async () => {
  await runImport()
  const sent: string[] = []
  const origin = 'https://aoz-import.example.invalid'
  const runtime = (configured: boolean) =>
    createAuthInstance({
      site: { url: origin, title: 'Synthetic migration', slug: 'aoz-import' },
      database: drizzle(pg, { schema: authSchema }),
      legacyBcrypt: bcrypt,
      env: {
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'synthetic-rehearsal-secret-at-least-32-characters',
      },
      mail: {
        configured,
        send: async (_kind, _to, url) => {
          sent.push(url)
        },
      },
    })
  let auth = runtime(false)
  const post = (endpoint: string, body: unknown) =>
    auth.handler(
      new Request(`${origin}/api/auth${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify(body),
      }),
    )
  for (const [email, password, id] of [
    ['dual@example.invalid', 'legacy password', 'account-dual'],
    ['password@example.invalid', longPassword, 'account-password'],
  ]) {
    const response = await post('/sign-in/email', { email, password })
    expect(response.status).toBe(200)
    expect((await response.json()).user.id).toBe(id)
  }
  expect(
    (
      await post('/sign-in/email', {
        email: 'password@example.invalid',
        password: 'x'.repeat(80) + 'b',
      })
    ).status,
  ).toBe(401)
  expect(
    (await post('/sign-in/email', { email: 'invited@example.invalid', password: 'anything' }))
      .status,
  ).toBe(401)
  // Any real shared session makes the importer inapplicable, even on an exact repeat.
  await expect(runImport()).rejects.toThrow('active shared runtime')
  auth = runtime(true)
  expect(
    (await post('/sign-in/email', { email: 'password@example.invalid', password: longPassword }))
      .status,
  ).toBe(403)
  sent.length = 0
  const reset = await post('/request-password-reset', {
    email: 'dual@example.invalid',
    redirectTo: `${origin}/reset-password`,
  })
  expect(reset.status).toBe(200)
  expect(sent).toHaveLength(1)
  const callback = await auth.handler(new Request(sent[0]))
  const token = new URL(callback.headers.get('location')!).searchParams.get('token')!
  expect(
    (await post('/reset-password', { token, newPassword: 'new native password' })).status,
  ).toBe(200)
  expect((await pg.query("SELECT * FROM sessions WHERE user_id = 'account-dual'")).rows).toEqual([])
  expect((await post('/reset-password', { token, newPassword: 'reuse' })).status).toBe(400)
  expect(
    (
      await post('/sign-in/email', {
        email: 'dual@example.invalid',
        password: 'new native password',
      })
    ).status,
  ).toBe(200)
  expect(
    (await post('/sign-in/email', { email: 'dual@example.invalid', password: 'legacy password' }))
      .status,
  ).toBe(401)
})
