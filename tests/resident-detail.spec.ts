import { test, expect } from '@playwright/test'
import { expectNotFoundPage } from './helpers'

// storageState from playwright.config handles staff auth
// Seed data (scripts/db/seed.ts):
//   RES-001 → status PLACED (active placement in ZH-001)
//   RES-021 → status ACTIVE  (unplaced, no active placement)

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Navigate to residents list, click the first detail link, return the href. */
async function getFirstResidentHref(page: import('@playwright/test').Page): Promise<string> {
  // The board defaults to the viewer's own case load; the seeded E2E user has
  // no assignments, so content lives behind the "all" filter.
  await page.goto('/residents?filter=all')
  const link = page
    .locator('a[href^="/residents/"]')
    .filter({ hasNotText: /Bearbeiten|Edit|neu|new/i })
    .first()
  await expect(link).toBeVisible({ timeout: 15_000 })
  return (await link.getAttribute('href'))!
}

/** Navigate via the list to find a resident by code. Returns the detail href. */
async function getResidentHrefByCode(
  page: import('@playwright/test').Page,
  code: string,
): Promise<string> {
  await page.goto('/residents?filter=all')
  const link = page.locator(`a[href^="/residents/"]`).filter({ hasText: code }).first()
  await expect(link).toBeVisible({ timeout: 15_000 })
  return (await link.getAttribute('href'))!
}

// =============================================================================
// Resident list (/residents)
// =============================================================================

test.describe('Resident list (/residents)', () => {
  test('loads with heading and new-resident button', async ({ page }) => {
    await page.goto('/residents')

    // level 1: the empty "mine" board renders an h2 "Keine Klient*innen zugewiesen"
    await expect(page.getByRole('heading', { level: 1, name: /Klient\*innen/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('link', { name: /^\+ Klient\*in$/i })).toBeVisible()
  })

  test('shows seed residents in the list', async ({ page }) => {
    await page.goto('/residents?filter=all')

    // .first(): a board row prints the code twice (name line + mono code)
    await expect(page.getByText('RES-001').first()).toBeVisible({ timeout: 15_000 })
  })

  test('each row links to the resident detail page', async ({ page }) => {
    const href = await getFirstResidentHref(page)
    expect(href).toMatch(/^\/residents\/[a-z0-9]+$/)
  })

  test('new-resident button points to /residents/new', async ({ page }) => {
    await page.goto('/residents')

    const link = page.getByRole('link', { name: /^\+ Klient\*in$/i }).first()
    await expect(link).toHaveAttribute('href', '/residents/new')
  })
})

// =============================================================================
// Resident detail — placed resident (RES-001)
// =============================================================================

test.describe('Resident detail — placed resident (RES-001)', () => {
  test('page loads with resident code in heading', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-001')
    await page.goto(href)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('RES-001').first()).toBeVisible()
  })

  test('shows PLACED status badge', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-001')
    await page.goto(href)

    await expect(
      page
        .locator('.badge, [class*="badge"]')
        .filter({ hasText: /Platziert|Placed/i })
        .first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('shows current placement card with housing unit link', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-001')
    await page.goto(href)

    // ZH-001 is the seeded placement for RES-001
    await expect(
      page
        .locator('a[href^="/housing/"]')
        .filter({ hasText: /ZH-001/i })
        .first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('shows edit button that links to /residents/[id]/edit', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-001')
    await page.goto(href)

    const editLink = page.getByRole('link', { name: /Bearbeiten/i }).first()
    await expect(editLink).toBeVisible({ timeout: 15_000 })
    await expect(editLink).toHaveAttribute('href', `${href}/edit`)
  })

  test('shows Transfer button for placed resident', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-001')
    await page.goto(href)

    await expect(page.getByRole('link', { name: /^Verlegen$/i }).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('breadcrumb links back to /residents', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-001')
    await page.goto(href)

    const back = page.getByRole('link', { name: /Klient\*innen/i }).first()
    await expect(back).toBeVisible({ timeout: 15_000 })
    await back.click()
    await page.waitForURL('**/residents', { timeout: 10_000 })
  })

  test('shows placement history for a resident with past placements', async ({ page }) => {
    // PlacementHistoryCard renders nothing when there is no *past* placement,
    // which is correct — RES-001 only has its current one. RES-004 is placed
    // *and* has an earlier, ended placement in the seed.
    const href = await getResidentHrefByCode(page, 'RES-004')
    // The placement's past lives in the dossier's Wohnen section.
    await page.goto(`${href}?tab=housing`)

    await expect(page.getByRole('heading', { name: /Platzierungshistorie/i })).toBeVisible({
      timeout: 15_000,
    })
  })
})

// =============================================================================
// Resident detail — unplaced resident (RES-021)
// =============================================================================

test.describe('Resident detail — unplaced resident (RES-021)', () => {
  test('shows ACTIVE status badge', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-021')
    await page.goto(href)

    await expect(
      page
        .locator('.badge, [class*="badge"]')
        .filter({ hasText: /Aktiv|Active/i })
        .first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('shows Place button (no current placement)', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-021')
    await page.goto(href)

    // Unplaced residents get a "Place" / "Platzieren" button linking to /matching
    await expect(page.getByRole('link', { name: /Platzieren|Unterbringen/i }).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('Place button links to matching page with resident param', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-021')
    await page.goto(href)

    const placeLink = page.getByRole('link', { name: /Platzieren|Unterbringen/i }).first()
    const placeHref = await placeLink.getAttribute('href')
    expect(placeHref).toMatch(/\/matching\?resident=/)
  })

  test('shows compatible units or empty state for matching', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-021')
    await page.goto(`${href}?tab=housing`)

    // CompatibleMatchesCard heading, in the dossier's Wohnen section
    await expect(page.getByRole('heading', { name: /Passende Optionen/i })).toBeVisible({
      timeout: 15_000,
    })
  })
})

// =============================================================================
// Resident detail — 404
// =============================================================================

test.describe('Resident detail — 404', () => {
  test('nonexistent id shows the 404 page', async ({ page }) => {
    await page.goto('/residents/nonexistent-id-xyz')
    await expectNotFoundPage(page)
  })
})

// =============================================================================
// Resident edit (/residents/[id]/edit)
// =============================================================================

test.describe('Resident edit (/residents/[id]/edit)', () => {
  test('edit page loads with form heading', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-001')
    await page.goto(`${href}/edit`)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
    // Heading contains the resident code
    await expect(page.getByText('RES-001').first()).toBeVisible()
  })

  test('edit form has core resident fields', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-001')
    await page.goto(`${href}/edit`)

    // ResidentFormFields renders ageRange, gender, familyStatus etc.
    await expect(page.locator('select[name="ageRange"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('select[name="gender"]')).toBeVisible()
  })

  test('back link returns to resident detail', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-001')
    await page.goto(`${href}/edit`)

    const back = page.getByRole('link', { name: /Zurück|RES-001/i }).first()
    await expect(back).toBeVisible({ timeout: 15_000 })
    await back.click()
    await page.waitForURL(`**${href}`, { timeout: 10_000 })
  })

  test('edit page has save button', async ({ page }) => {
    const href = await getResidentHrefByCode(page, 'RES-001')
    await page.goto(`${href}/edit`)

    await expect(
      page.getByRole('button', { name: /Speichern|Aktualisieren|Änderungen/i }),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('nonexistent id shows the 404 page', async ({ page }) => {
    await page.goto('/residents/nonexistent-id-xyz/edit')
    await expectNotFoundPage(page)
  })
})
