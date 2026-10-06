import { test, expect } from '@playwright/test'
import { openEmailLoginForm } from './helpers'

// storageState from playwright.config handles staff auth
test.use({ viewport: { width: 375, height: 667 } })

test.describe('Mobile Responsiveness', () => {
  test('dashboard loads without horizontal scroll', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1) // +1 for rounding
  })

  test('residents list is usable on mobile', async ({ page }) => {
    await page.goto('/residents')
    await page.waitForLoadState('networkidle')

    // Should not have forced horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })

  test('housing detail page works on mobile', async ({ page }) => {
    await page.goto('/housing')
    await page.waitForLoadState('networkidle')

    // Click first housing unit if available
    const firstUnit = page.locator('a[href*="/housing/"]').first()
    if (await firstUnit.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstUnit.click()
      await page.waitForLoadState('networkidle')

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      const viewportWidth = await page.evaluate(() => window.innerWidth)
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
    }
  })

  test('navigation hamburger works on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Mobile menu trigger has aria-label="Menü öffnen"
    const menuTrigger = page.locator('button[aria-label="Menü öffnen"]')

    await expect(menuTrigger).toBeVisible({ timeout: 5000 })
    await menuTrigger.click()

    // Navigation links should become visible in the drawer
    await expect(page.locator('[role="dialog"] a[href="/residents"]')).toBeVisible({
      timeout: 5000,
    })
  })

  test('login page works on mobile', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)

    // The email login form stays reachable and usable on a phone.
    await openEmailLoginForm(page)
    await expect(page.locator('#email')).toBeVisible()
  })
})

/**
 * The PUBLIC pages, which nothing here used to measure.
 *
 * Every check above visits an admin page or /login. The landing page — the one
 * surface a stranger sees, and the one most likely to be opened on a phone from
 * a link — was never measured at any width. So when the language switcher added
 * three full endonyms ("Deutsch", "English", "Français", ~109px) to a header
 * that had roughly 15px of slack, the document went to 484px inside a 390px
 * viewport and the whole page scrolled sideways. 190 unit suites and this very
 * spec were green; it was found by opening the deployed page at 390px.
 *
 * 390px rather than 375px on purpose: it is the iPhone 12/13/14 width, the most
 * common phone viewport, and a check that only ever runs at 375 leaves the
 * band between them untested.
 *
 * `documentElement.scrollWidth`, not `body.scrollWidth`: the body can sit
 * inside its own bounds while a sticky header overflows the document, so the
 * body measure can read clean on exactly this bug.
 */
test.describe('Public pages on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  // Every language the landing page ships in, including the ones the switcher
  // itself widens the header with. Hardcoded rather than imported so this fails
  // loudly if a language is added without anyone measuring it.
  const LANDING_PATHS = ['/willkommen', '/en/willkommen', '/fr/willkommen']

  for (const path of LANDING_PATHS) {
    test(`${path} does not scroll sideways at 390px`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')

      const { doc, viewport } = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }))

      // Reported as an object so a failure says BY HOW MUCH and on which page,
      // rather than "484 is not <= 391".
      expect({ path, overflowPx: Math.max(0, doc - viewport - 1) }).toEqual({ path, overflowPx: 0 })
    })
  }

  test('the language switcher stays reachable and keeps its real names', async ({ page }) => {
    await page.goto('/fr/willkommen')
    await page.waitForLoadState('domcontentloaded')

    const nav = page.locator('nav[aria-label*="Sprache"]')
    await expect(nav).toBeVisible()

    // The visible label shrinks to a code on a phone; the ACCESSIBLE name must
    // not. A screen-reader user should hear "Français", never "F R".
    await expect(nav.getByRole('link', { name: 'Français' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Deutsch' })).toHaveAttribute('href', '/willkommen')
  })
})

/**
 * Desktop overflows too. Live 2026-10-02 /analytics scrolled 6px sideways at
 * 1280: the conflict-trend tile set «Verschlechterung» at text-2xl in a fifth
 * of the row, one unbreakable word wider than its grid track. Reproduced
 * locally on the E2E seed, which reports that trend.
 */
test.describe('staff pages at desktop width', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  for (const path of ['/analytics', '/residents?seat=all', '/learning?board=job']) {
    test(`${path} does not scroll sideways at 1280px`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const { doc, viewport } = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }))
      expect({ path, overflowPx: Math.max(0, doc - viewport - 1) }).toEqual({ path, overflowPx: 0 })
    })
  }
})
