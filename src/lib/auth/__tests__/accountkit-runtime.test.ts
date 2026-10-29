/**
 * The shared runtime on AOZ's real schema: the committed migration chain, a
 * synthetic legacy snapshot, the real import SQL, then AccountKit's own
 * endpoints answering through AOZ's identity adapter. No production data.
 */
import type { PGlite } from '@electric-sql/pglite'
import { PASSWORD, SITE, cookieOf, openSharedDb, seedAndImport } from './helpers/shared-db'

const holder = vi.hoisted(() => ({ db: undefined as unknown }))

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return {
    ...actual,
    db: new Proxy({}, { get: (_, prop) => Reflect.get(holder.db as object, prop) }),
  }
})

let pg: PGlite

beforeAll(async () => {
  pg = await openSharedDb(holder)
})

afterAll(async () => pg?.close())

beforeEach(async () => seedAndImport(pg))

async function runtime() {
  const { sharedAuth } = await import('@/lib/auth/shared/runtime')
  const identity = await import('@/lib/auth/shared/identity')
  const auth = sharedAuth.getAuth()
  const post = (route: string, body: unknown, cookie = '') =>
    auth.handler(
      new Request(`${SITE}/api/auth${route}`, {
        method: 'POST',
        headers: { origin: SITE, 'content-type': 'application/json', cookie },
        body: JSON.stringify(body),
      }),
    )
  const who = async (cookie: string) => {
    const session = await sharedAuth.sessionFor(new Headers({ cookie }))
    if (!session) return null
    return identity.identitiesForSession(
      session.user.id,
      await identity.readSessionScope(session.session.id),
    )
  }
  return { auth, post, cookieOf, who, identity }
}

test('a login code opens only its own side of a dual account; a password opens both', async () => {
  const { post, cookieOf, who } = await runtime()
  const staffCode = await post('/sign-in/domain', { credential: 'AOZ-SYNTHETIC1' })
  expect(staffCode.status).toBe(200)
  const staffOnly = await who(cookieOf(staffCode))
  expect(staffOnly?.staff?.id).toBe('staff-dual')
  expect(staffOnly?.resident).toBeNull()

  const residentCode = await post('/sign-in/domain', { credential: 'RES-SYNTHETIC1' })
  const residentOnly = await who(cookieOf(residentCode))
  expect(residentOnly?.resident?.code).toBe('RES-SYNTHETIC1')
  expect(residentOnly?.staff).toBeNull()

  expect((await post('/sign-in/domain', { credential: 'AOZ-UNKNOWN' })).status).toBe(401)

  const password = await post('/sign-in/email', { email: 'dual@example.test', password: PASSWORD })
  expect(password.status).toBe(200)
  const both = await who(cookieOf(password))
  expect(both?.staff?.id).toBe('staff-dual')
  expect(both?.resident?.id).toBe('resident-dual')
  expect(both?.staff?.email).toBe('dual@example.test')
})

test('authorization is reread on every request: deactivation, site reach and revocation', async () => {
  const { post, cookieOf, who } = await runtime()
  const cookie = cookieOf(
    await post('/sign-in/email', { email: 'dual@example.test', password: PASSWORD }),
  )
  await pg.exec(`UPDATE "User" SET "siteAccess" = 'ASSIGNED_UNITS' WHERE id = 'staff-dual'`)
  expect((await who(cookie))?.staff?.siteAccess).toBe('ASSIGNED_UNITS')

  await pg.exec(`UPDATE "User" SET active = false WHERE id = 'staff-dual'`)
  const deactivated = await who(cookie)
  expect(deactivated?.staff).toBeNull()
  expect(deactivated?.resident?.id).toBe('resident-dual')

  await pg.exec(`DELETE FROM sessions`)
  expect(await who(cookie)).toBeNull()
  expect((await pg.query('SELECT * FROM "AccountSessionScope"')).rows).toEqual([])
})

test('a code-only resident claims a first password and stops being a placeholder', async () => {
  const { post, cookieOf, who } = await runtime()
  const claimed = await post('/provision/claim', {
    credential: 'code:RES-SYNTHETIC2',
    email: 'New.Person@example.test',
    password: 'synthetic first password',
  })
  expect(claimed.status).toBe(200)
  expect((await who(cookieOf(claimed)))?.resident?.id).toBe('resident-code')
  const resident = await pg.query<{ isPlaceholder: boolean }>(
    `SELECT "isPlaceholder" FROM "Resident" WHERE id = 'resident-code'`,
  )
  expect(resident.rows[0].isPlaceholder).toBe(false)
  const again = await post('/provision/claim', {
    credential: 'code:RES-SYNTHETIC2',
    email: 'new.person@example.test',
    password: 'synthetic first password',
  })
  expect(again.status).toBe(409)
})

test('a second identity joins an account only on that account’s legacy password', async () => {
  const { post, cookieOf, who } = await runtime()
  const claim = (password: string) =>
    post('/provision/claim', {
      credential: 'code:AOZ-SYNTHETIC2',
      email: 'password@example.test',
      password,
    })
  expect((await claim('not the account password')).status).toBe(401)
  const linked = await claim(PASSWORD)
  expect(linked.status).toBe(200)
  const both = await who(cookieOf(linked))
  expect(both?.staff?.id).toBe('staff-code')
  expect(both?.resident?.id).toBe('resident-password')
  const rows = await pg.query(
    `SELECT "sharedUserId", "staffId", "residentId" FROM "AccountIdentity"
     WHERE "staffId" = 'staff-code' OR "sharedUserId" = 'aoz-staff:staff-code'`,
  )
  expect(rows.rows).toEqual(
    expect.arrayContaining([
      { sharedUserId: 'account-password', staffId: 'staff-code', residentId: 'resident-password' },
      { sharedUserId: 'aoz-staff:staff-code', staffId: null, residentId: null },
    ]),
  )
})

test('a claim link is single-use and given back when the claim fails', async () => {
  const { post } = await runtime()
  const { hashClaimToken } = await import('@/lib/auth/claim-invites')
  await pg.query(
    `INSERT INTO "ClaimInvite" (id, "tokenHash", "userId", "expiresAt")
     VALUES ('invite', $1, 'staff-invited', now() + interval '1 day')`,
    [hashClaimToken('synthetic-link')],
  )
  const claim = (email: string) =>
    post('/provision/claim', {
      credential: 'link:synthetic-link',
      email,
      password: 'synthetic invited password',
    })
  expect((await claim('dual@example.test')).status).toBe(401)
  const open = await pg.query<{ usedAt: Date | null }>(
    `SELECT "usedAt" FROM "ClaimInvite" WHERE id = 'invite'`,
  )
  expect(open.rows[0].usedAt).toBeNull()
  expect((await claim('invited@example.test')).status).toBe(200)
  expect((await claim('invited@example.test')).status).toBe(401)
})

test('a borrowed view opens only the colleague’s staff side and returns to its opener', async () => {
  const { post, cookieOf, who } = await runtime()
  const { sharedAuth } = await import('@/lib/auth/shared/runtime')
  const { openBorrowedSession, closeBorrowedSession } = await import('@/lib/auth/shared/borrowed')
  const adminCookie = cookieOf(
    await post('/sign-in/email', { email: 'dual@example.test', password: PASSWORD }),
  )
  const admin = await sharedAuth.sessionFor(new Headers({ cookie: adminCookie }))
  const opened = await openBorrowedSession({
    targetStaffId: 'staff-code',
    openerStaffId: 'staff-dual',
    openerSessionId: admin!.session.id,
  })
  const borrowedCookie = `${opened!.name}=${opened!.value}`
  // Read first: the shared refresh used to push a written 8-hour expiry to 14 days.
  await who(borrowedCookie)
  const [{ expires_at }] = (
    await pg.query<{ expires_at: Date }>(
      `SELECT s.expires_at FROM sessions s JOIN "AccountSessionScope" x ON x."sessionId" = s.id
       WHERE x."impersonatorStaffId" IS NOT NULL`,
    )
  ).rows
  expect(new Date(expires_at).getTime() - Date.now()).toBeLessThanOrEqual(8 * 60 * 60 * 1000)
  const borrowed = await who(borrowedCookie)
  expect(borrowed?.staff?.id).toBe('staff-code')
  expect(borrowed?.staff?.impersonatorId).toBe('staff-dual')
  expect(borrowed?.staff?.email).toBe('dual@example.test')
  expect(borrowed?.resident).toBeNull()

  const borrowedSession = await sharedAuth.sessionFor(new Headers({ cookie: borrowedCookie }))
  const back = await closeBorrowedSession(borrowedSession!.session.id)
  expect(await who(borrowedCookie)).toBeNull()
  expect((await who(`${back.name}=${back.value}`))?.staff?.id).toBe('staff-dual')

  const again = await openBorrowedSession({
    targetStaffId: 'staff-code',
    openerStaffId: 'staff-dual',
    openerSessionId: admin!.session.id,
  })
  await pg.exec(`UPDATE "User" SET active = false WHERE id = 'staff-dual'`)
  expect((await who(`${again!.name}=${again!.value}`))?.staff).toBeNull()
})

test('staff sessions keep the 8-hour idle limit; resident-only accounts keep the default', async () => {
  const { post, cookieOf, who } = await runtime()
  const hoursLeft = async (email: string) => {
    const { rows } = await pg.query<{ expires_at: Date }>(
      `SELECT s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = $1`,
      [email],
    )
    return (new Date(rows[0].expires_at).getTime() - Date.now()) / 3_600_000
  }
  const staff = cookieOf(
    await post('/sign-in/email', { email: 'dual@example.test', password: PASSWORD }),
  )
  await who(staff)
  await who(staff)
  expect(await hoursLeft('dual@example.test')).toBeLessThanOrEqual(8)

  await pg.exec(`UPDATE sessions SET updated_at = now() - interval '9 hours'
    WHERE user_id = 'account-dual'`)
  expect(await who(staff)).toBeNull()

  const resident = cookieOf(
    await post('/sign-in/email', { email: 'password@example.test', password: PASSWORD }),
  )
  await who(resident)
  expect(await hoursLeft('password@example.test')).toBeGreaterThan(13 * 24)
})
