import { test, expect } from '@playwright/test'
import { BRAND } from '../src/lib/config/brand'
import { openCodeLoginForm, openEmailLoginForm } from './helpers'

// Auth tests need clean state (no existing session)
test.use({ storageState: { cookies: [], origins: [] } })

/**
 * Wait for React to hydrate the login form.
 *
 * The login page is a 'use client' component. In development mode,
 * webpack uses eval() for HMR source maps. Without 'unsafe-eval' in
 * the CSP, React never hydrates, the form submits natively (GET),
 * and no state changes appear.
 *
 * We detect hydration by verifying the controlled onChange handler
 * is active: React uppercases the code input value on every change.
 * (Reaching the code form at all requires the hydrated mode toggle,
 * so this also proves the page is interactive.)
 */
async function waitForCodeFormReady(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle')
  await openCodeLoginForm(page)
  // Verify React's onChange is active (converts to uppercase)
  await page.locator('#code').fill('x')
  await expect(page.locator('#code')).toHaveValue('X', { timeout: 10000 })
  await page.locator('#code').clear()
}

test.describe('Authentication flow', () => {
  test('login page offers email + password, with the other door one toggle away', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await openEmailLoginForm(page)

    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Passwort vergessen?' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Konto erstellen' })).toBeVisible()
  })

  test('the code form stays reachable behind the toggle', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await openCodeLoginForm(page)

    await expect(page.locator('#code')).toBeVisible()
    // Both prefixes from the brand SSOT, never a hardcoded /AOZ-|RES-|WG-/
    // alternation: that list silently stopped describing the product the day
    // the client prefix moved into the brand config, and a test that pins
    // literals is the same drift it is supposed to catch.
    await expect(page.locator('#code')).toHaveAttribute(
      'placeholder',
      new RegExp(`${BRAND.codePrefix}.*${BRAND.residentCodePrefix}`),
    )
  })

  test('rejects login with invalid code', async ({ page }) => {
    await page.goto('/login')
    await waitForCodeFormReady(page)

    await page.locator('#code').fill('INVALID-CODE')
    await page.locator('button[type="submit"]').click()

    // Should show error message
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 })
  })

  test('shows success and redirects on valid staff login', async ({ page }) => {
    const staffCode = process.env.E2E_STAFF_CODE || `${BRAND.codePrefix}E2E001`
    await page.goto('/login')
    await waitForCodeFormReady(page)

    await page.locator('#code').fill(staffCode)
    await page.locator('button[type="submit"]').click()

    // Success state shows green checkmark
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 10000 })

    // Redirects to dashboard
    await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 })
  })

  test('code input is case-insensitive', async ({ page }) => {
    const staffCode = process.env.E2E_STAFF_CODE || `${BRAND.codePrefix}E2E001`
    await page.goto('/login')
    await waitForCodeFormReady(page)

    // Enter lowercase code
    await page.locator('#code').fill(staffCode.toLowerCase())
    await page.locator('button[type="submit"]').click()

    // Should still succeed (API uppercases before lookup)
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 10000 })
  })

  test('rejects an email login with wrong credentials', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await openEmailLoginForm(page)

    await page.locator('#email').fill('nobody@example.ch')
    await page.locator('#password').fill('definitely-wrong')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 })
  })

  test('register page renders the claim-your-code form', async ({ page }) => {
    await page.goto('/register')

    await expect(page.locator('#code')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
  })

  test('forgot-password page renders and links back to login', async ({ page }) => {
    await page.goto('/forgot-password')

    await expect(page.locator('#email')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zurück zur Anmeldung' })).toBeVisible()
  })

  test('reset-password page without a token explains and links to forgot-password', async ({
    page,
  }) => {
    await page.goto('/reset-password')

    // Text-anchored, not [role=alert]: Next.js can mount a second live
    // region (route announcer), which trips strict mode on CI.
    await expect(page.getByText('Dieser Link ist unvollständig', { exact: false })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Neuen Link anfordern' })).toBeVisible()
  })
})
