import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

import { excludesDemo, isRealRow, type DemoScope } from '@/lib/analytics/real-data'

/**
 * A seeded profile is not a client until someone claims it.
 *
 * Placeholder rows exist so a real person can take one over: plausible name,
 * real flat, real code, `isPlaceholder: true`. Until that takeover happens
 * there is nobody behind the row, and every pilot KPI has to say so.
 *
 * THE DIRECTION OF THE ERROR IS WHAT MAKES THIS URGENT. A placeholder left in
 * the numbers does not merely inflate a headcount — it reads as a client with
 * no labour-market contact, no German level recorded and no first meeting. So
 * the more placeholders exist to demonstrate the product, the WORSE the service
 * looks in the numbers it is judged on. Same failure as demo conflicts
 * reporting "67% mehr Konflikte · Verschlechterung", from the other side.
 *
 * And the opposite mistake is just as real: four of the live residents are
 * REAL clients who have never registered an account. Deriving "is a person"
 * from "has an Account" would erase four of the five people actually being
 * served. Placeholder-ness is provenance, fixed when the row is created.
 */

const ROOT = join(__dirname, '..', '..', '..', '..')

function sourceOf(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8')
}

describe('the scope the KPIs exclude', () => {
  it('drops a placeholder the same way it drops a demo row', () => {
    const scope: DemoScope = { residentIds: new Set(['placeholder-1']), unitIds: new Set() }
    expect(isRealRow({ residentId: 'placeholder-1' }, scope)).toBe(false)
    expect(isRealRow({ residentId: 'real-1' }, scope)).toBe(true)
  })

  it('keeps a real client who never registered', () => {
    // A real client with no Account and no email: entirely real.
    const scope: DemoScope = { residentIds: new Set(['placeholder-1']), unitIds: new Set() }
    const rows = [{ residentId: 'hana' }, { residentId: 'placeholder-1' }, { residentId: 'noor' }]
    expect(excludesDemo(rows, scope)).toEqual([{ residentId: 'hana' }, { residentId: 'noor' }])
  })
})

describe('loadDemoScope collects them', () => {
  const source = sourceOf('src/lib/analytics/real-data.ts')

  it('selects the flag at all', () => {
    // Under-selection is the silent failure here: a query that omits the
    // column leaves every placeholder looking like a client, and nothing
    // anywhere goes red.
    expect(source).toMatch(/isPlaceholder:\s*true/)
  })

  it('puts placeholders in the excluded set', () => {
    expect(source).toMatch(/isPlaceholder/)
    expect(source).toMatch(/isDemoResidentCode\([^)]*\)\s*\|\|\s*\w+\.isPlaceholder/)
  })

  it('does not rely on a code prefix for them', () => {
    // A placeholder's code must survive the takeover, and a code cannot be
    // re-prefixed afterwards, so prefix-matching could never have worked here.
    expect(source).toMatch(/cannot be re-prefixed/)
  })
})

describe('claiming a profile makes it a person', () => {
  const source = sourceOf('src/lib/auth/account.ts')

  it('clears the flag on registration', () => {
    expect(source).toMatch(/isPlaceholder:\s*false/)
  })

  it('does so on EVERY successful resident claim, not one branch', () => {
    // registerAccount succeeds down three paths. A claim through the wrong one
    // would leave a real client flagged fictional: dropped from the caseload
    // KPIs, and labelled a placeholder on a staff screen beside their name.
    const calls = [...source.matchAll(/clearPlaceholderFlag\(/g)].length
    // One definition plus a call at each of the two success returns.
    expect(calls).toBeGreaterThanOrEqual(3)
  })

  it('is a no-op for staff', () => {
    // Only a resident row carries the flag; a staff claim must not try.
    expect(source).toMatch(/identity\.kind !== 'resident'/)
  })
})

describe('the seed itself', () => {
  const config = sourceOf('scripts/db/real/witikonerstrasse-426.ts')
  const script = sourceOf('scripts/db/seed-placeholders.ts')

  it('marks every seeded profile', () => {
    expect(script).toMatch(/isPlaceholder:\s*true/)
  })

  it('never invents an address', () => {
    // Real AOZ stock, already in the database. The building is real; only the
    // people are placeholders.
    expect(config).toContain('Witikonerstrasse 426, 8053 Zürich')
  })

  it('refuses to touch a flat holding a real client', () => {
    expect(script).toMatch(/isPlaceholder,\s*false\)/)
    expect(script).toMatch(/REAL client/)
  })

  it('leaves a bed free somewhere', () => {
    // A flat seeded to exactly full cannot demonstrate placing anyone, which
    // is the product's entire subject.
    const beds = [...config.matchAll(/beds:\s*(\d+)/g)].map((m) => Number(m[1]))
    const totals = [...config.matchAll(/totalBeds:\s*(\d+)/g)].map((m) => Number(m[1]))
    const people = [...config.matchAll(/displayName:/g)].length
    expect(beds.length).toBeGreaterThan(0)
    expect(totals.reduce((a, b) => a + b, 0)).toBeGreaterThan(people)
  })
})
