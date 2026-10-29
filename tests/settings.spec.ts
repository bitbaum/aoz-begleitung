import { test, expect } from '@playwright/test'
import { BRAND } from '../src/lib/config/brand'
import { findAdminNavLink } from './helpers'

// storageState from playwright.config handles staff auth

test.describe('Settings page', () => {
  test('shared date picker preserves the pilot date submitted to the server', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const date = page.locator('#pilotStartDate')
    await date.fill('2026-10-15')
    await expect(date).toHaveValue('2026-10-15')
    await expect(date.locator('..').locator('.wk-input-text')).toContainText('15')
    expect(
      await date.evaluate((input) =>
        new FormData((input as HTMLInputElement).form!).get('pilotStartDate'),
      ),
    ).toBe('2026-10-15')
  })

  test('settings page loads with team and invite sections', async ({ page }) => {
    await page.goto('/settings')

    // Page heading
    await expect(page.getByRole('heading', { name: /Einstellungen/i })).toBeVisible({
      timeout: 15_000,
    })

    // Invite form section
    await expect(page.getByRole('heading', { name: /Mitarbeiter einladen/i })).toBeVisible()

    // Team section
    await expect(page.getByRole('heading', { name: /Team/i })).toBeVisible()

    // Email config section
    await expect(page.getByRole('heading', { name: /E-Mail-Konfiguration/i })).toBeVisible()
  })

  test('invite form has name and email fields', async ({ page }) => {
    await page.goto('/settings')

    // Inputs have id="invite-name" / id="invite-email" (no name attr)
    await expect(page.locator('#invite-name')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('#invite-email')).toBeVisible()
    await expect(page.getByRole('button', { name: /Einladung senden/i })).toBeVisible()
  })

  test('team list names the team without showing anyone their login code', async ({ page }) => {
    await page.goto('/settings')

    // The roster renders...
    await expect(page.getByRole('heading', { name: /Team/i })).toBeVisible({ timeout: 15_000 })

    // ...and no staff code appears on it. This assertion used to run the other
    // way round: it REQUIRED a code to be visible, which pinned the bug in
    // place — a staff code is the credential (`loginByCode` takes it with no
    // password), so the page was handing every signed-in colleague everyone
    // else's login, and the suite called that the passing state.
    await expect(page.locator('body')).not.toContainText(
      new RegExp(`${BRAND.codePrefix}[A-Z0-9]{4,}`),
    )
  })

  test('invite form shows validation error for empty submission', async ({ page }) => {
    await page.goto('/settings')

    // Wait for form to load
    await expect(page.locator('#invite-name')).toBeVisible({ timeout: 15_000 })

    // Submit without filling in fields
    await page.getByRole('button', { name: /Einladung senden/i }).click()

    // Browser HTML5 validation or our error message
    const hasError =
      (await page
        .locator('[role="alert"]')
        .isVisible()
        .catch(() => false)) || (await page.locator('#invite-name:invalid').count()) > 0

    expect(hasError).toBe(true)
  })

  test('settings page is accessible from the header nav', async ({ page }) => {
    await page.goto('/')

    const settingsLink = await findAdminNavLink(page, '/settings')

    await settingsLink.click()
    await page.waitForURL('**/settings', { timeout: 10_000 })

    await expect(page.getByRole('heading', { name: /Einstellungen/i })).toBeVisible()
  })
})
