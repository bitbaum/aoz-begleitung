/**
 * AOZ's sign-in screens on the shared runtime: the same route handlers the
 * screens call, answered by AccountKit through the bridge, on the real schema
 * and import. Mail is captured at the shared mailer; nothing is sent.
 */
import type { PGlite } from '@electric-sql/pglite'
import { NextRequest } from 'next/server'
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
let ip = 0

beforeAll(async () => {
  pg = await openSharedDb(holder)
})

afterAll(async () => pg?.close())

beforeEach(async () => {
  vi.resetModules()
  await seedAndImport(pg)
})

/** A fresh caller each time, so AccountKit's per-caller limiter never decides a test. */
function request(route: string, body?: unknown, cookie = '') {
  ip += 1
  return new NextRequest(`${SITE}${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `198.51.100.${ip % 250}`,
      cookie,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

async function signedInAs(cookie: string) {
  const { sharedAuth } = await import('@/lib/auth/shared/runtime')
  const { identitiesForSession, readSessionScope } = await import('@/lib/auth/shared/identity')
  const session = await sharedAuth.sessionFor(new Headers({ cookie }))
  if (!session) return null
  return identitiesForSession(session.user.id, await readSessionScope(session.session.id))
}

/** Switch mail on for this test's runtime and capture what it would send. */
async function withMail() {
  const { sharedAuthMailer } = await import('@/lib/auth/shared/runtime')
  const sent: Array<{ kind: string; to: string; url: string }> = []
  vi.spyOn(sharedAuthMailer, 'configured', 'get').mockReturnValue(true)
  vi.spyOn(sharedAuthMailer, 'send').mockImplementation(async (kind, to, url) => {
    sent.push({ kind, to, url })
  })
  return sent
}

test('the login screen signs in by password (both roles) and by code (its role only)', async () => {
  const { POST } = await import('@/app/api/auth/login/route')
  const byPassword = await POST(
    request('/api/auth/login', { email: 'dual@example.test', password: PASSWORD }),
  )
  expect(await byPassword.json()).toEqual({
    success: true,
    type: 'staff',
    roles: ['staff', 'resident'],
  })
  expect((await signedInAs(cookieOf(byPassword)))?.resident?.id).toBe('resident-dual')

  const wrong = await POST(
    request('/api/auth/login', { email: 'dual@example.test', password: 'wrong' }),
  )
  expect(wrong.status).toBe(401)
  expect(cookieOf(wrong)).toBe('')

  const byCode = await POST(request('/api/auth/login', { code: 'res-synthetic1' }))
  const body = await byCode.json()
  expect(body).toEqual({ success: true, type: 'resident', code: 'RES-SYNTHETIC1' })
  const scoped = await signedInAs(cookieOf(byCode))
  expect(scoped?.staff).toBeNull()

  expect((await POST(request('/api/auth/login', { code: 'AOZ-NOBODY' }))).status).toBe(401)
})

test('the register screen gives a code its first password and links a second on proof', async () => {
  const { POST } = await import('@/app/api/auth/signup/route')
  const first = await POST(
    request('/api/auth/signup', {
      code: 'RES-SYNTHETIC2',
      email: 'resident@example.test',
      password: 'synthetic resident password',
    }),
  )
  expect(await first.json()).toEqual({ success: true, type: 'resident', roles: ['resident'] })

  const mismatch = await POST(
    request('/api/auth/signup', {
      code: 'AOZ-SYNTHETIC2',
      email: 'resident@example.test',
      password: 'not that password',
    }),
  )
  expect(mismatch.status).toBe(401)
  expect((await mismatch.json()).error).toMatch(/Passwort dieses Kontos/)

  const linked = await POST(
    request('/api/auth/signup', {
      code: 'AOZ-SYNTHETIC2',
      email: 'resident@example.test',
      password: 'synthetic resident password',
    }),
  )
  expect((await linked.json()).roles).toEqual(['staff', 'resident'])

  const invited = await POST(
    request('/api/auth/signup', {
      code: 'RES-SYNTHETIC3',
      email: 'invited@example.test',
      password: 'synthetic password',
    }),
  )
  expect(invited.status).toBe(400)
  expect((await invited.json()).error).toMatch(/Passwort vergessen/)
})

test('a claim link works once, and an expired one answers 410 as the screen expects', async () => {
  const { hashClaimToken } = await import('@/lib/auth/claim-invites')
  await pg.query(
    `INSERT INTO "ClaimInvite" (id, "tokenHash", "userId", "expiresAt")
     VALUES ('invite', $1, 'staff-invited', now() + interval '1 day')`,
    [hashClaimToken('synthetic-link')],
  )
  const { POST } = await import('@/app/api/auth/claim/route')
  const body = {
    token: 'synthetic-link',
    email: 'invited@example.test',
    password: 'first password',
  }
  const claimed = await POST(request('/api/auth/claim', body))
  expect(await claimed.json()).toEqual({ success: true, type: 'staff', roles: ['staff'] })
  expect((await POST(request('/api/auth/claim', body))).status).toBe(410)
})

test('with mail: confirm before signing in, resend from the refusal, and recover a password', async () => {
  const sent = await withMail()
  const signup = (await import('@/app/api/auth/signup/route')).POST
  const login = (await import('@/app/api/auth/login/route')).POST
  const resend = (await import('@/app/api/auth/resend-verification/route')).POST
  const verify = (await import('@/app/api/auth/verify-email/route')).GET
  const forgot = (await import('@/app/api/auth/forgot-password/route')).POST
  const reset = (await import('@/app/api/auth/reset-password/route')).POST

  const claimed = await signup(
    request('/api/auth/signup', {
      code: 'RES-SYNTHETIC2',
      email: 'mailbox@example.test',
      password: 'synthetic mailbox password',
    }),
  )
  expect(await claimed.json()).toEqual({ success: true, verifyEmail: true })
  expect(cookieOf(claimed)).toBe('')

  const refused = await login(
    request('/api/auth/login', {
      email: 'mailbox@example.test',
      password: 'synthetic mailbox password',
    }),
  )
  expect(refused.status).toBe(403)
  expect((await refused.json()).needsVerification).toBe(true)

  expect(
    (await resend(request('/api/auth/resend-verification', { email: 'mailbox@example.test' })))
      .status,
  ).toBe(200)
  expect(sent.map((m) => m.kind)).toEqual(['verify', 'verify'])

  const link = new URL(sent[1].url)
  const confirmed = await verify(request(`${link.pathname}${link.search}`))
  expect(confirmed.status).toBe(302)
  expect(confirmed.headers.get('location')).toContain('/login?verified=1')
  expect((await signedInAs(cookieOf(confirmed)))?.resident?.id).toBe('resident-code')

  // The imported legacy account with an unverified address recovers through mail.
  expect(
    (await forgot(request('/api/auth/forgot-password', { email: 'password@example.test' }))).status,
  ).toBe(200)
  const resetMail = sent.at(-1)!
  expect(resetMail.kind).toBe('reset')
  const token = new URL(resetMail.url).pathname.split('/').at(-1)!
  expect(
    (
      await reset(
        request('/api/auth/reset-password', { token, password: 'synthetic new password' }),
      )
    ).status,
  ).toBe(200)
  const after = await login(
    request('/api/auth/login', {
      email: 'password@example.test',
      password: 'synthetic new password',
    }),
  )
  expect(await after.json()).toEqual({ success: true, type: 'resident', roles: ['resident'] })
  const old = await login(
    request('/api/auth/login', { email: 'password@example.test', password: PASSWORD }),
  )
  expect(old.status).toBe(401)
})

test('an invited colleague’s address is attached unverified, and their code claims it', async () => {
  await withMail()
  const { attachInvitedEmail } = await import('@/lib/auth/shared/identity')
  await pg.exec(`INSERT INTO "User" (id, "updatedAt", name, code, active) VALUES
    ('staff-new', now(), 'Synthetic new', 'AOZ-SYNTHETIC9', true)`)
  expect(await attachInvitedEmail('staff', 'staff-new', 'New@Example.test')).toBe('attached')
  expect(await attachInvitedEmail('staff', 'staff-new', 'other@example.test')).toBe('has_email')
  expect(await attachInvitedEmail('staff', 'staff-code', 'dual@example.test')).toBe('taken')
  const mapped = await pg.query<{ sharedUserId: string; email: string; email_verified: boolean }>(
    `SELECT i."sharedUserId", u.email, u.email_verified FROM "AccountIdentity" i
     JOIN users u ON u.id = i."sharedUserId" WHERE i."staffId" = 'staff-new'`,
  )
  expect(mapped.rows).toEqual([
    { sharedUserId: 'aoz-staff:staff-new', email: 'new@example.test', email_verified: false },
  ])
  const { POST } = await import('@/app/api/auth/signup/route')
  const claimed = await POST(
    request('/api/auth/signup', {
      code: 'AOZ-SYNTHETIC9',
      email: 'new@example.test',
      password: 'synthetic first password',
    }),
  )
  expect(await claimed.json()).toEqual({ success: true, verifyEmail: true })
})

test('the legacy routes are untouched while the flag is off', async () => {
  process.env.AUTH_RUNTIME = 'legacy'
  try {
    const { GET } = await import('@/app/api/auth/[...all]/route')
    expect((await GET(new Request(`${SITE}/api/auth/get-session`))).status).toBe(404)
    const { POST } = await import('@/app/api/auth/login/route')
    const legacy = await POST(request('/api/auth/login', { code: 'AOZ-NOBODY' }))
    expect((await legacy.json()).error).toBe('Ungültiger Code')
    expect((await pg.query('SELECT * FROM sessions')).rows).toEqual([])
  } finally {
    process.env.AUTH_RUNTIME = 'accountkit'
  }
})
