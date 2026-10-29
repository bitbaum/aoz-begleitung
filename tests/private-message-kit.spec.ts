import { test, expect } from '@playwright/test'

for (const [width, colorScheme] of [
  [390, 'dark'],
  [1280, 'light'],
] as const) {
  test(`staff reply reconciliation at ${width}px in ${colorScheme}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ colorScheme })
    await page.goto('/residents')
    const href = await page
      .locator('a[href^="/residents/"]')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute('href'))
          .find(
            (link) =>
              link &&
              /^\/residents\/[^/?]+$/.test(link) &&
              !['new', 'import'].includes(link.split('/').at(-1)!),
          ),
      )
    if (!href) throw new Error('Seeded resident detail link is unavailable')
    await page.goto(`/messages/${href.split('/').at(-1)}`)
    let releaseReply!: () => void
    const replyReady = new Promise<void>((resolve) => {
      releaseReply = resolve
    })
    // Exercise the real authenticated page and renderer without storing a reply.
    await page.route('**/api/messages/*', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      const { body } = route.request().postDataJSON()
      await replyReady
      await route.fulfill({
        json: {
          success: true,
          data: {
            message: {
              id: `confirmed-${width}`,
              body,
              authorUserId: 'fixture-staff',
              authorResidentId: null,
              createdAt: new Date().toISOString(),
              readAt: null,
            },
          },
        },
      })
    })
    const text = `ThreadKit Testnachricht ${width}`
    await page.getByRole('textbox').fill(text)
    await page.getByRole('button', { name: 'Senden', exact: true }).click()
    await expect(page.getByText(text, { exact: true })).toHaveCount(1)
    releaseReply()
    await expect(page.getByRole('button', { name: 'Senden', exact: true })).toBeVisible()
    await expect(page.getByText(text, { exact: true })).toHaveCount(1)
    const composer = page.locator('form').filter({ has: page.getByRole('textbox') })
    await expect(composer.getByRole('alert')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    expect(errors).toEqual([])
  })
}
