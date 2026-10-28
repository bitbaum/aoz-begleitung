import { test, expect } from '@playwright/test'

// Real admin page and shared components, with a deterministic streaming reply.
// No model call or resident data is sent by these tests.
for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [390, 1280]) {
    test(`shared chat preserves scroll intent and the next draft at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.emulateMedia({ colorScheme })
      await page.setViewportSize({ width, height: 844 })
      await page.addInitScript(() => {
        const original = window.fetch.bind(window)
        const state = window as unknown as {
          chatController: ReadableStreamDefaultController<Uint8Array>
        }
        window.fetch = async (input, options) => {
          const url =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
          if (!url.endsWith('/api/ai/chat')) return original(input, options)
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              state.chatController = controller
            },
          })
          return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
        }
      })
      await page.goto('/ai-assistant')
      const input = page.locator('.ck-input')
      await input.fill('Testfrage ohne Personendaten')
      await input.press('Enter')
      await expect(page.locator('.ck-live')).toBeVisible()
      await page.evaluate(() => {
        const text = Array.from(
          { length: 60 },
          (_, i) => `Absatz ${i}: Eine lange Testantwort.`,
        ).join('\n\n')
        const state = window as unknown as {
          chatController: ReadableStreamDefaultController<Uint8Array>
        }
        state.chatController.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`),
        )
      })
      const scroller = page.locator('.ck-thread')
      await expect
        .poll(() => scroller.evaluate((el) => el.scrollHeight > el.clientHeight + 100))
        .toBe(true)
      await scroller.evaluate((el) => {
        el.scrollTop = 0
        el.dispatchEvent(new Event('scroll'))
      })
      await expect(page.locator('.ck-jump')).toBeVisible()
      await page.evaluate(() => {
        const state = window as unknown as {
          chatController: ReadableStreamDefaultController<Uint8Array>
        }
        state.chatController.enqueue(
          new TextEncoder().encode('data: {"type":"text","text":"\\n\\nWeiterer Text."}\n\n'),
        )
      })
      await expect(page.getByText('Weiterer Text.')).toBeAttached()
      await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeLessThan(10)
      await input.fill('Mein nächster Entwurf')
      await page.getByRole('button', { name: 'Antwort stoppen', exact: true }).click()
      await page.evaluate(() => {
        const state = window as unknown as {
          chatController: ReadableStreamDefaultController<Uint8Array>
        }
        state.chatController.close()
      })
      await expect(input).toHaveValue('Mein nächster Entwurf')
      await expect(input).toBeVisible()
      expect(errors).toEqual([])
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
    })
  }
}
