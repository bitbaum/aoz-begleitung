#!/usr/bin/env node
/**
 * Every way into AOZ on AccountKit, in a real browser against the production
 * server and a PostgreSQL built from the committed migrations plus the cutover
 * import (.github/workflows/browser-smoke.yml), with AUTH_RUNTIME=accountkit:
 *
 *   - /login, /register and /forgot-password at 320px and 390px: no sideways
 *     scroll;
 *   - /login offers AccountKit's methods (password, passkey; the email link
 *     and OrangeCat when their env is set) and the code door beside them;
 *   - an imported staff member signs in with email and their old bcrypt
 *     password, lands on the staff dashboard and gets AOZ's 8-hour session;
 *   - /konto is AccountKit's panel: passkeys and a second factor, no name
 *     field (names live on AOZ's rows) and no delete button, but whom to ask;
 *   - the panel signs out; a wrong password is refused;
 *   - an imported resident signs in with their code and lands in the portal,
 *     and /portal/konto renders; a staff code still lands on the dashboard.
 *
 * The words are AccountKit's German labels and AOZ's own. Synthetic people
 * only (scripts/ci/seed-legacy-accounts.mjs); no mail leaves the machine.
 *
 *   BASE_URL=http://localhost:3000 STAFF_EMAIL=… STAFF_PASSWORD=… STAFF_CODE=… \
 *     RESIDENT_CODE=… node scripts/browser-smoke.mjs
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { authLabelsFor } from '@bitbaum/accountkit/auth'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const L = authLabelsFor('de')
const OUT = 'browser-smoke-artifacts'
const { STAFF_EMAIL, STAFF_PASSWORD, STAFF_CODE, RESIDENT_CODE, CLAIM_CODE } = process.env
const TIMEOUT = 30_000
const EIGHT_HOURS = 8 * 60 * 60 * 1000
const EXPECT = {
  orangecat: Boolean(process.env.ORANGECAT_OAUTH_CLIENT_ID),
  mail: Boolean(process.env.RESEND_API_KEY),
}
// AOZ's own words (src/lib/constants/labels/auth.ts).
const USE_CODE = 'Mit Code anmelden'
const CODE_LABEL = 'Zugangscode'
const CLAIM_SUBMIT = { ...authLabelsFor('en').claim, ...L.claim }.submit
const ASK_INSTEAD = 'Ihr Zugang gehört zu Ihrem persönlichen Code.'

const shot = (page, name) =>
  page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
const button = (page, name) => page.getByRole('button', { name, exact: true })
const shared = (page) =>
  page.evaluate(async () => (await fetch('/api/auth/get-session')).json().catch(() => null))

const failures = []
function check(ok, what) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`)
  if (!ok) failures.push(what)
}

async function emailSignIn(page, email, password) {
  await page.goto(`${BASE}/login`)
  await page.locator('input[autocomplete="username webauthn"]').fill(email)
  await page.locator('input[autocomplete="current-password"]').fill(password)
  await button(page, L.signIn).click()
}

/** AccountKit's code door, in AOZ's words for its personal code. */
async function codeSignIn(page, code) {
  await page.goto(`${BASE}/login`)
  await button(page, USE_CODE).click()
  await page.getByLabel(CODE_LABEL, { exact: true }).fill(code.toLowerCase())
  await button(page, L.signIn).click()
}

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch(
  process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {},
)
let page

try {
  if (!STAFF_EMAIL || !STAFF_PASSWORD || !STAFF_CODE || !RESIDENT_CODE || !CLAIM_CODE) {
    throw new Error('set STAFF_EMAIL, STAFF_PASSWORD, STAFF_CODE, RESIDENT_CODE and CLAIM_CODE')
  }

  // ── The sign-in pages at phone widths ──────────────────────────────────
  for (const width of [320, 390]) {
    const phone = await browser.newPage({ viewport: { width, height: 844 } })
    for (const route of ['/login', '/register', '/forgot-password']) {
      await phone.goto(`${BASE}${route}`)
      await phone.waitForLoadState('networkidle')
      const overflow = await phone.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      check(overflow <= 0, `${route} at ${width}px has no sideways scroll (${overflow}px)`)
      await shot(phone, `${width}${route.replaceAll('/', '-')}`)
    }
    await phone.close()
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(`${page.url()}: ${e.message}`))

  // ── The method set, and the code door beside it ────────────────────────
  await page.goto(`${BASE}/login`)
  for (const [name, wanted] of [
    [L.signIn, true],
    [L.withPasskey, true],
    [L.withLink, EXPECT.mail],
    [L.withOrangecat, EXPECT.orangecat],
    [USE_CODE, true],
  ]) {
    const count = await button(page, name).count()
    check(wanted ? count === 1 : count === 0, `/login ${wanted ? 'offers' : 'hides'} "${name}"`)
  }
  await shot(page, 'login-methods')

  // ── An imported staff member, by email and their old password ──────────
  await emailSignIn(page, STAFF_EMAIL, STAFF_PASSWORD)
  await page.waitForURL((u) => u.pathname === '/', { timeout: TIMEOUT })
  const staff = await shared(page)
  check(
    staff?.user?.email === STAFF_EMAIL,
    'an imported staff member signs in with their old password',
  )
  const lifetime = new Date(staff?.session?.expiresAt ?? 0).getTime() - Date.now()
  check(
    Math.abs(lifetime - EIGHT_HOURS) < 10 * 60 * 1000,
    `a staff session lasts 8 hours (${Math.round(lifetime / 60000)} min)`,
  )
  await shot(page, 'staff-dashboard')

  // ── /konto: AccountKit's panel, AOZ's rules ────────────────────────────
  await page.goto(`${BASE}/konto`)
  await page.waitForLoadState('networkidle')
  for (const title of [L.account.passkeys, L.account.twoFactor]) {
    check((await page.getByText(title, { exact: true }).count()) > 0, `/konto offers ${title}`)
  }
  check((await page.locator('#acct-display-name').count()) === 0, '/konto has no second name field')
  check((await button(page, L.account.delete).count()) === 0, '/konto has no delete button')
  check((await page.getByText(ASK_INSTEAD).count()) === 1, '/konto says whom to ask instead')
  await shot(page, 'staff-konto')

  await page
    .locator('section[aria-labelledby="acct-leave"]')
    .getByRole('button', { name: L.account.signOut, exact: true })
    .click()
  await page.waitForURL((u) => u.pathname !== '/konto', { timeout: TIMEOUT })
  check((await shared(page)) === null, "the panel's sign-out ends the session")

  await emailSignIn(page, STAFF_EMAIL, 'not the password')
  await page.getByText(L.errors.INVALID_EMAIL_OR_PASSWORD).waitFor({ timeout: TIMEOUT })
  check((await shared(page)) === null, 'a wrong password is refused')

  // ── Codes: a resident to the portal, staff to the dashboard ────────────
  const resident = await (await browser.newContext()).newPage()
  await codeSignIn(resident, RESIDENT_CODE)
  await resident.waitForURL((u) => u.pathname.startsWith('/portal'), { timeout: TIMEOUT })
  check(true, "a resident's code opens the portal")
  await resident.goto(`${BASE}/portal/konto`)
  await resident.waitForLoadState('networkidle')
  check(
    (await resident.getByRole('heading', { level: 1 }).count()) > 0 &&
      resident.url().endsWith('/portal/konto'),
    '/portal/konto renders for a resident',
  )
  await shot(resident, 'resident-konto')
  await resident.close()

  const byCode = await (await browser.newContext()).newPage()
  await codeSignIn(byCode, STAFF_CODE)
  await byCode.waitForURL((u) => u.pathname === '/', { timeout: TIMEOUT })
  check((await shared(byCode))?.user !== undefined, 'a staff code still opens the dashboard')
  await byCode.close()

  // ── A personal link: /login?code=… signs in at once ────────────────────
  const linked = await (await browser.newContext()).newPage()
  await linked.goto(`${BASE}/login?code=${RESIDENT_CODE.toLowerCase()}`)
  await linked.waitForURL((u) => u.pathname.startsWith('/portal'), { timeout: TIMEOUT })
  check(!linked.url().includes('code='), 'a personal link signs in and leaves the address bar')
  await linked.close()

  // ── Claiming a code: AccountKit's ClaimForm on /register ───────────────
  const claimer = await (await browser.newContext()).newPage()
  await claimer.goto(`${BASE}/register?code=${CLAIM_CODE}`)
  check(
    (await claimer.getByLabel(CODE_LABEL, { exact: true }).inputValue()) === CLAIM_CODE,
    "an invitation's code is filled in",
  )
  await claimer.getByLabel(L.email, { exact: true }).fill('smoke-claim@example.test')
  await claimer.locator('#acct-password').fill('synthetic claim password')
  await button(claimer, CLAIM_SUBMIT).click()
  await claimer.waitForURL((u) => u.pathname === '/', { timeout: TIMEOUT })
  check(
    (await shared(claimer))?.user?.email === 'smoke-claim@example.test',
    'claiming a code sets a first password and signs in',
  )
  await shot(claimer, 'claimed')
  await claimer.close()

  check(pageErrors.length === 0, `no uncaught page errors (${pageErrors.join(' | ')})`)
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
  console.error(error)
  await page
    ?.screenshot({ path: path.join(OUT, 'failure.png'), fullPage: true })
    .catch((e) => console.error('[smoke] failure screenshot not taken', e.message))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nsmoke: every way in works')
