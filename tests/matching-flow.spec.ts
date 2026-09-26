import { test, expect } from '@playwright/test'
import { expandResidentIntakeDetails } from './helpers'

// storageState from playwright.config handles staff auth.
//
// Seed data used (from scripts/db/seed.ts):
//   - RES-008 to RES-013: status=ACTIVE (unplaced, no placement)
//   - ZH-001 to ZH-010+: housing units with available spots

test.describe('Matching page structure', () => {
  test('shows two-panel layout with resident selector and unit panel', async ({ page }) => {
    await page.goto('/matching')

    await expect(page.locator('h1, h2').first()).toContainText(/Matching/i)
    await expect(page.getByText(/Unplatzierte Klient\*innen/i).first()).toBeVisible()
  })

  test('shows unplaced residents list or empty state', async ({ page }) => {
    await page.goto('/matching')

    const hasResidents = (await page.getByRole('link', { name: 'Unterkunft finden' }).count()) > 0
    const hasEmptyState = await page
      .getByText(/Keine Klient\*innen|Alle Klient\*innen sind platziert/i)
      .isVisible()
      .catch(() => false)

    expect(hasResidents || hasEmptyState).toBe(true)
  })

  test('right panel prompts to select a resident before any is chosen', async ({ page }) => {
    await page.goto('/matching')

    const hasPrompt = await page
      .getByText(/Wählen Sie eine\*n Klient\*in/i)
      .isVisible()
      .catch(() => false)
    const hasUnits = await page
      .getByText(/Verfügbare Unterkünfte/i)
      .isVisible()
      .catch(() => false)

    expect(hasPrompt || hasUnits).toBe(true)
  })
})

test.describe('Resident selection', () => {
  test('clicking "Unterkunft finden" loads compatibility scores for that resident', async ({
    page,
  }) => {
    await page.goto('/matching')

    const matchingBtn = page.getByRole('link', { name: 'Unterkunft finden' }).first()
    if ((await matchingBtn.count()) === 0) {
      await expect(page.getByText(/Alle Klient\*innen|Keine Klient\*innen/i)).toBeVisible()
      return
    }

    await matchingBtn.click()

    // URL gains ?resident= param
    await expect(page).toHaveURL(/[?&]resident=/, { timeout: 15_000 })

    // Right panel switches to match results
    await expect(page.getByText(/Matches für/i)).toBeVisible()
  })

  test('selected resident button changes to "Ausgewählt"', async ({ page }) => {
    await page.goto('/matching')

    const matchingBtns = page.getByRole('link', { name: 'Unterkunft finden' })
    if ((await matchingBtns.count()) === 0) return

    await matchingBtns.first().click()
    await expect(page).toHaveURL(/[?&]resident=/, { timeout: 15_000 })

    // The clicked resident now shows "Ausgewählt"
    await expect(page.getByRole('link', { name: 'Ausgewählt' })).toBeVisible()
  })

  test('match results include score percentages', async ({ page }) => {
    await page.goto('/matching')

    const matchingBtn = page.getByRole('link', { name: 'Unterkunft finden' }).first()
    if ((await matchingBtn.count()) === 0) return

    await matchingBtn.click()
    await expect(page).toHaveURL(/[?&]resident=/, { timeout: 15_000 })
    await expect(page.getByText(/Matches für/i)).toBeVisible()

    // At least one unit card should show a percentage score
    const scorePattern = /\d{1,3}%/
    const scoreLocator = page.getByText(scorePattern)
    await expect(scoreLocator.first()).toBeVisible({ timeout: 10_000 })
  })

  test('Standard / Fast Mode toggle is visible after selecting a resident', async ({ page }) => {
    await page.goto('/matching')

    const matchingBtn = page.getByRole('link', { name: 'Unterkunft finden' }).first()
    if ((await matchingBtn.count()) === 0) return

    await matchingBtn.click()
    await expect(page).toHaveURL(/[?&]resident=/, { timeout: 15_000 })

    await expect(page.getByRole('link', { name: 'Standard' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Fast Mode' })).toBeVisible()
  })

  test('Fast Mode toggle updates URL and preserves resident param', async ({ page }) => {
    await page.goto('/matching')

    const matchingBtn = page.getByRole('link', { name: 'Unterkunft finden' }).first()
    if ((await matchingBtn.count()) === 0) return

    await matchingBtn.click()
    await expect(page).toHaveURL(/[?&]resident=/, { timeout: 15_000 })

    await page.getByRole('link', { name: 'Fast Mode' }).click()
    await expect(page).toHaveURL(/mode=fast/, { timeout: 10_000 })
    await expect(page).toHaveURL(/resident=/)
    await expect(page.getByText(/Matches für/i)).toBeVisible()
  })
})

test.describe('Resident search / filter', () => {
  test('searching with a non-matching string shows empty state', async ({ page }) => {
    await page.goto('/matching')

    const hasResidents = (await page.getByRole('link', { name: 'Unterkunft finden' }).count()) > 0
    if (!hasResidents) return

    await page.locator('input[name="q"]').fill('XYZNONEXISTENT999')
    await page.getByRole('button', { name: 'Suchen' }).click()

    await expect(page.getByText(/Keine Klient\*innen|keine.*Suche/i)).toBeVisible({
      timeout: 10_000,
    })
  })

  test('clearing search restores resident list', async ({ page }) => {
    await page.goto('/matching')

    const initialCount = await page.getByRole('link', { name: 'Unterkunft finden' }).count()
    if (initialCount === 0) return

    await page.locator('input[name="q"]').fill('XYZNONEXISTENT999')
    await page.getByRole('button', { name: 'Suchen' }).click()
    await expect(page.getByText(/Keine Klient\*innen|keine.*Suche/i)).toBeVisible({
      timeout: 10_000,
    })

    await page.locator('input[name="q"]').clear()
    await page.getByRole('button', { name: 'Suchen' }).click()

    // Should restore original count
    await expect(page.getByRole('link', { name: 'Unterkunft finden' }).first()).toBeVisible({
      timeout: 10_000,
    })
    const restoredCount = await page.getByRole('link', { name: 'Unterkunft finden' }).count()
    expect(restoredCount).toBe(initialCount)
  })
})

test.describe('Unit mode (who fits here)', () => {
  test('navigating with ?unit=<invalid> does not crash the page', async ({ page }) => {
    await page.goto('/matching?unit=nonexistent-id')
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('unit mode shows "Passende Klient\*innen" panel when a valid unit is selected', async ({
    page,
  }) => {
    // Get a real unit ID from the housing list
    const response = await page.request.get('/api/export/units').catch(() => null)
    // Navigate to housing list to get a unit ID from the page
    await page.goto('/housing')
    const firstUnitLink = page.getByRole('link').filter({ hasText: /ZH-/ }).first()
    if ((await firstUnitLink.count()) === 0) return

    const href = await firstUnitLink.getAttribute('href')
    const unitId = href?.split('/housing/')[1]?.split('/')[0]
    if (!unitId) return

    await page.goto(`/matching?unit=${unitId}`)

    // Unit mode panel renders
    await expect(page.getByText(/Passende Klient\*innen|Wählen Sie/i).first()).toBeVisible({
      timeout: 10_000,
    })
  })
})

test.describe('Full placement flow', () => {
  test('create resident → see matches → place in unit', async ({ page }) => {
    // 1. Create a new resident using the form (unique code prevents conflicts)
    const code = `E2E-M-${Date.now()}`
    await page.goto('/residents/new')

    await page.locator('input[name="code"]').fill(code)
    await page.locator('select[name="ageRange"]').selectOption('ADULT')
    await page.locator('select[name="gender"]').selectOption('MALE')
    await page.locator('select[name="familyStatus"]').selectOption('SINGLE')
    await page.locator('select[name="sleepSchedule"]').selectOption('STANDARD')
    await expandResidentIntakeDetails(page)
    await page.locator('select[name="socialStyle"]').selectOption('MODERATE')
    await page.locator('select[name="smokingStatus"]').selectOption('NON_SMOKER')
    await page.locator('select[name="mobilityNeeds"]').selectOption('NONE')

    await page.getByRole('button', { name: /Matching|Speichern/i }).click()

    // 2. Redirects to matching with resident pre-selected
    await expect(page).toHaveURL(/matching/, { timeout: 30_000 })
    await expect(page).toHaveURL(/resident=/)

    // Right panel shows matches for the new resident
    await expect(page.getByText(/Matches für/)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(code).first()).toBeVisible()

    // 3. Check for available placement
    const placeBtn = page.getByRole('button', { name: /Platzieren/i }).first()
    if ((await placeBtn.count()) === 0) {
      // No units with available spots — acceptable test environment state
      return
    }

    // 4. Submit placement
    await placeBtn.click()

    // placeResident redirects to /residents/:id?placed=true, but SuccessToast
    // fires the toast and immediately router.replace()s the param away — so
    // ?placed=true exists for a few milliseconds and asserting on it is a race
    // the test loses on a slow runner. Assert the destination, then the
    // confirmation the user actually sees.
    await expect(page).toHaveURL(/\/residents\/[^/?]+/, { timeout: 30_000 })

    // 5. Resident detail page shows a "placed" confirmation
    await expect(page.getByText(/Platziert|platziert|placed/i).first()).toBeVisible()

    // 6. Resident has moved out of the unplaced list on the matching page.
    //    It still appears under "Platzierte Klient\*innen" (the what-if comparison
    //    list), so the assertion has to be scoped to the unplaced region.
    await page.goto('/matching')
    await expect(
      page.getByRole('region', { name: /Unplatzierte Klient\*innen/i }).getByText(code),
    ).toHaveCount(0, { timeout: 10_000 })
    await expect(
      page.getByRole('region', { name: /Platzierte Klient\*innen/i }).getByText(code),
    ).toBeVisible()
  })
})
