import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

for (const width of [390, 834, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`public navigation at ${width}px in ${colorScheme}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme })
      await page.goto('/willkommen')
      if (width < 1100) {
        const menu = page.locator('[data-sitekit-menu]')
        await menu.locator('summary').click()
        const link = menu.getByRole('link', { name: 'Blog', exact: true })
        await expect(link).toBeVisible()
        const box = await link.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width)
        await page.keyboard.press('Escape')
        await expect(menu).not.toHaveAttribute('open')
        await menu.locator('summary').click()
        await link.click()
      } else {
        await page
          .locator('[data-sitekit-nav]')
          .getByRole('link', { name: 'Blog', exact: true })
          .click()
      }
      await expect(page).toHaveURL(/\/blog$/)
      const nav = page.locator(width < 1100 ? '[data-sitekit-menu]' : '[data-sitekit-nav]')
      await expect(
        nav.getByRole('link', { name: 'Blog', exact: true, includeHidden: true }),
      ).toHaveAttribute('aria-current', 'page')
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
      await expect(
        page.locator('footer').getByRole('link', { name: 'KI und Datenschutz' }),
      ).toBeVisible()
      expect(errors).toEqual([])
    })
  }
}

test('public menu works without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()
  await page.goto('http://localhost:3101/willkommen')
  await page.locator('[data-sitekit-menu] summary').click()
  await page
    .locator('[data-sitekit-menu]')
    .getByRole('link', { name: 'Roadmap', exact: true })
    .click()
  await expect(page).toHaveURL(/\/roadmap$/)
  await context.close()
})
