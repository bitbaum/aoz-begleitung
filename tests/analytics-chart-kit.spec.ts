import { test, expect } from '@playwright/test'

// Uses the seeded database, the real analytics route and the shared renderer.
// This is read-only: no resident or check-in record is created by the test.
for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [390, 1280]) {
    test(`shared satisfaction chart at ${width}px in ${colorScheme}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.emulateMedia({ colorScheme })
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/analytics')
      const chart = page.locator('.ck-chart-bars')
      await expect(chart).toBeVisible()
      const levels = chart.locator('.ck-bar-label')
      await expect(levels).toHaveText([
        '1/5 Sehr unzufrieden',
        '2/5 Unzufrieden',
        '3/5 Neutral',
        '4/5 Zufrieden',
        '5/5 Sehr zufrieden',
      ])
      await expect(chart.getByRole('columnheader', { name: 'Anzahl' })).toBeAttached()
      const colors = await chart
        .locator('.ck-bar-fill')
        .evaluateAll((bars) => bars.map((bar) => getComputedStyle(bar).backgroundColor))
      expect(new Set(colors).size).toBe(3)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBe(true)
      expect(errors).toEqual([])
    })
  }
}
