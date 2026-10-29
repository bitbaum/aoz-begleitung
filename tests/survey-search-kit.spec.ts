import { test, expect } from '@playwright/test'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'

// Synthetic fixtures only, in the same isolated database as the E2E seed.
const databaseUrl = process.env.DATABASE_URL
const isolated = databaseUrl ? new URL(databaseUrl) : null

for (const width of [390, 1280]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`survey recipient search at ${width}px in ${colorScheme}`, async ({ page }) => {
      if (
        !isolated ||
        !['localhost', '127.0.0.1'].includes(isolated.hostname) ||
        isolated.pathname !== '/aoz_housing_test'
      ) {
        throw new Error('Survey fixtures require the isolated aoz_housing_test database')
      }
      const pool = new Pool({ connectionString: databaseUrl })
      const suffix = randomUUID()
      const clients = [
        { id: randomUUID(), name: `Müller ${suffix}` },
        { id: randomUUID(), name: `Schneider ${suffix}` },
      ]
      let surveyId: string | undefined
      try {
        for (const client of clients) {
          const result = await pool.query(
            `
            INSERT INTO "Resident"
            SELECT (jsonb_populate_record(NULL::"Resident", to_jsonb(r) ||
              jsonb_build_object('id', $1::text, 'code', $2::text, 'displayName', $3::text,
                'isPlaceholder', false, 'status', 'ACTIVE'))).*
            FROM "Resident" r LIMIT 1
          `,
            [client.id, `RES-E2E-${client.id}`, client.name],
          )
          expect(result.rowCount).toBe(1)
        }
        await page.setViewportSize({ width, height: 900 })
        await page.emulateMedia({ colorScheme })
        await page.goto('/surveys/new')
        await page.waitForLoadState('networkidle')
        await page.locator('[name="title"]').fill(`Synthetic search ${suffix}`)
        await page.getByRole('button', { name: 'Als Entwurf speichern', exact: true }).click()
        await page.waitForURL(
          (url) => url.pathname.startsWith('/surveys/') && !url.pathname.endsWith('/new'),
        )
        surveyId = new URL(page.url()).pathname.split('/').at(-1)
        await page.getByRole('radio', { name: 'Einzelne Klient*innen', exact: true }).click()
        await page.getByRole('checkbox', { name: clients[0].name, exact: true }).check()
        await page.getByRole('searchbox').fill('Schneidre')
        await expect(
          page.getByRole('checkbox', { name: clients[0].name, exact: true }),
        ).toHaveCount(0)
        await page.getByRole('checkbox', { name: clients[1].name, exact: true }).check()
        expect(
          await page
            .locator('[name="residentIds"]')
            .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
        ).toEqual([clients[0].id, clients[1].id])
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true)
      } finally {
        if (surveyId) await pool.query('DELETE FROM "Survey" WHERE id = $1', [surveyId])
        await pool.query('DELETE FROM "Resident" WHERE id = ANY($1::text[])', [
          clients.map((client) => client.id),
        ])
        await pool.end()
      }
    })
  }
}
