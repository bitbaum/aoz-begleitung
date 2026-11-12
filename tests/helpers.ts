import { expect, type Locator, type Page } from '@playwright/test'
import { BRAND } from '../src/lib/config/brand'
import { LOGIN_LABELS } from '../src/lib/constants/labels'
import { LOCALE_COOKIE } from '../src/lib/i18n/locales'

const STAFF_CODE = process.env.E2E_STAFF_CODE || `${BRAND.codePrefix}E2E001`

/**
 * Ensure the page has a valid staff session.
 * With storageState in playwright.config, we should already be authenticated.
 * This function falls back to UI login if the session is missing.
 */
export async function ensureStaffLogin(page: Page) {
  // Navigate to dashboard — middleware will redirect to /login if no session
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // If we got redirected to login, do a UI login
  if (page.url().includes('/login')) {
    await openCodeLoginForm(page)
    await page.locator('#code').fill(STAFF_CODE)
    await page
      .locator('form')
      .getByRole('button', { name: /^Anmelden$/i })
      .click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 })
  }
}

async function waitForLoginDoors(page: Page) {
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#email, #code').first()).toBeVisible({ timeout: 15_000 })
}

/**
 * The login page's primary door depends on the brand: AOZ/AOZH open on the
 * printed code, WG on email. Both doors stay one toggle away. Idempotent.
 */
export async function openCodeLoginForm(page: Page) {
  await waitForLoginDoors(page)
  const codeInput = page.locator('#code')
  if (!(await codeInput.isVisible())) {
    await page.getByRole('button', { name: LOGIN_LABELS.useCode }).click()
    await expect(codeInput).toBeVisible()
  }
}

export async function openEmailLoginForm(page: Page) {
  await waitForLoginDoors(page)
  const emailInput = page.locator('#email')
  if (!(await emailInput.isVisible())) {
    await page.getByRole('button', { name: LOGIN_LABELS.useEmail }).click()
    await expect(emailInput).toBeVisible()
  }
}

/** Short intake hides matching detail fields behind this control. */
export async function expandResidentIntakeDetails(page: Page) {
  const more = page.getByRole('button', { name: 'Weitere Angaben' })
  if (await more.isVisible()) {
    await more.click()
    await expect(page.locator('select[name="socialStyle"]')).toBeVisible()
  }
}

/** Portal dictionaries follow Accept-Language unless this cookie is set. */
export function portalLocaleCookie(locale = 'de') {
  return {
    name: LOCALE_COOKIE,
    value: locale,
    domain: 'localhost',
    path: '/',
  }
}

/**
 * Find `href` in the admin chrome and assert it is reachable.
 *
 * WHERE THE NAV LIVES, AND WHY THIS HELPER KEEPS CHANGING. It was a fixed
 * `<aside>`, then a header megamenu ("megamenu is sole desktop nav", May 2026),
 * and is an `<aside>` again — 20 destinations across 5 groups never fit a row.
 * The lesson worth keeping is about the HELPER: it hard-coded the container of
 * the day (`header.sticky, footer`), so moving the nav made every navigation
 * test fail on "element not found" rather than on anything a user would
 * notice. It now searches every place a desktop destination can legitimately
 * live, so the next move costs nothing here.
 *
 * Closed groups are the subtlety. The megamenu MOUNTED a dropdown's links only
 * while open; `<details>` keeps them in the DOM and merely hides them. So
 * "count() === 0" is no longer the signal that a group needs opening —
 * ":visible" is, and the fix is to open the groups rather than to click through
 * them one at a time hoping the right one appears.
 *
 * Scoped to *visible* chrome on purpose: MobileNav renders a second `<header>`
 * plus the full link list into the DOM at every viewport and merely hides them
 * with CSS, so an unscoped locator matches a hidden element and the assertion
 * fails on visibility rather than on reachability.
 */
export async function findAdminNavLink(page: Page, href: string): Promise<Locator> {
  // Desktop chrome only. MobileNav renders a second `header.chrome-bar` that
  // stays in the DOM at every viewport (`md:hidden`), so an unscoped `header`
  // match is two elements and Playwright strict-mode assertions fail.
  const chrome = page.locator('aside, header.sticky, footer')
  const selector = `a[href="${href}"]:visible`

  await expect(page.locator('header.sticky')).toBeVisible({ timeout: 15_000 })

  if ((await chrome.locator(selector).count()) === 0) {
    // Expand every sidebar group. Only the group holding the current page
    // starts open, so any destination outside it is present but hidden.
    //
    // Re-queried each pass rather than walked with .nth(i): clicking a summary
    // removes it from `:not([open])`, so the matched set shrinks under an
    // index-based loop and every other group would be skipped. The bound is
    // the group count, so this terminates even if a click does not land.
    const closed = page.locator('aside details:not([open]) > summary')
    for (let attempts = await closed.count(); attempts > 0; attempts--) {
      const next = closed.first()
      if ((await next.count()) === 0) break
      await next.click().catch(() => undefined)
    }
  }

  if ((await chrome.locator(selector).count()) === 0) {
    // System destinations (Einstellungen, Algorithmus, Hilfe) live in the user
    // menu, which is a popover rather than a group.
    await page.getByRole('button', { name: 'Benutzermenü' }).click()
    await chrome
      .locator(selector)
      .first()
      .waitFor({ state: 'visible', timeout: 2_000 })
      .catch(() => undefined)
  }

  const link = chrome.locator(selector).first()
  await expect(link).toBeVisible({ timeout: 15_000 })
  return link
}

/**
 * Assert the page currently rendered is the application's 404 page.
 *
 * Deliberately checks the rendered UI rather than `response.status()`: every
 * admin segment has a `loading.tsx`, so Next.js opens a Suspense boundary and
 * flushes the response shell (status 200) before the page body runs
 * `notFound()`. The status line is already committed by then. Keeping the
 * loading skeletons is the right product call, so the guarantee worth
 * asserting is the one users actually experience — they land on the 404 page.
 */
export async function expectNotFoundPage(page: Page) {
  await expect(page.getByRole('heading', { name: /Seite nicht gefunden/i })).toBeVisible({
    timeout: 15_000,
  })
}
