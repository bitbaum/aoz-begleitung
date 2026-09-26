import {
  EMPTY_DEMO_SCOPE,
  belongsToSameWorld,
  excludesDemo,
  isDemoResidentCode,
  isDemoUnitCode,
  isRealRow,
  type DemoScope,
} from '../real-data'
import { ALL_DEMO_RESIDENT_CODE_PREFIXES, DEMO_UNIT_CODE_PREFIX } from '@/lib/demo/config'

const scope: DemoScope = {
  residentIds: new Set(['demo-resident-1']),
  unitIds: new Set(['demo-unit-12', 'demo-unit-09']),
}

describe('the production case this was written from', () => {
  /**
   * Measured against the live instance on 2026-09-03 — INTERPERSONAL incidents
   * over 180 days, by unit:
   *
   *   DEMO-U12   6
   *   DEMO-U09   1
   *   WIT-458    1     <- the only real apartment
   *
   * The pilot's headline KPI counted all eight and reported "67% mehr Konflikte
   * · Verschlechterung". Seven of them are re-seeded nightly at 04:05. The KPI
   * was measuring the demo world's weather.
   */
  it('counts one conflict, not eight', () => {
    const incidents = [
      ...Array.from({ length: 6 }, () => ({ housingUnitId: 'demo-unit-12' })),
      { housingUnitId: 'demo-unit-09' },
      { housingUnitId: 'wit-458' },
    ]

    expect(excludesDemo(incidents, scope)).toEqual([{ housingUnitId: 'wit-458' }])
  })
})

describe('which rows belong to the pilot', () => {
  it('drops a row whose UNIT is demo', () => {
    expect(isRealRow({ housingUnitId: 'demo-unit-12' }, scope)).toBe(false)
  })

  it('drops a row whose RESIDENT is demo, even in a real unit', () => {
    // A visitor clicking around the demo can place a demo resident anywhere.
    // Checking only the unit would let those back into the numbers.
    expect(isRealRow({ residentId: 'demo-resident-1', housingUnitId: 'wit-458' }, scope)).toBe(
      false,
    )
  })

  it('drops a demo unit row whose resident link is null', () => {
    // Incidents carry housingUnitId NOT NULL and residentId only sometimes, so
    // the unit half cannot be dropped as redundant.
    expect(isRealRow({ residentId: null, housingUnitId: 'demo-unit-09' }, scope)).toBe(false)
  })

  it('keeps a real row', () => {
    expect(isRealRow({ residentId: 'georgy', housingUnitId: 'wit-458' }, scope)).toBe(true)
  })

  it('keeps everything when there is no demo world', () => {
    // A dedicated real deployment must not have its numbers quietly filtered.
    const rows = [{ housingUnitId: 'a' }, { residentId: 'b' }]
    expect(excludesDemo(rows, EMPTY_DEMO_SCOPE)).toEqual(rows)
  })

  it('keeps a row linked to neither', () => {
    expect(isRealRow({}, scope)).toBe(true)
  })
})

describe('matching never crosses the demo boundary', () => {
  /**
   * Found on the live instance: George B — a REAL client — had "Beste
   * Unterkünfte" offering `DEMO-U07` and `DEMO-U03`, and "Passende Mitbewohner"
   * offering two demo residents. All of them are deleted and re-seeded at 04:05
   * every night. Staff acting on that recommendation would place someone into a
   * flat that ceases to exist.
   *
   * The rule is symmetric rather than "exclude demo", because compatibility
   * scoring is the product's headline feature and a demo visitor has to see it
   * work. Both worlds keep a matcher; neither reaches into the other.
   */
  it('a real client is never offered a demo unit', () => {
    expect(belongsToSameWorld(false, true)).toBe(false)
  })

  it('a demo visitor still gets demo candidates, so the tour works', () => {
    expect(belongsToSameWorld(true, true)).toBe(true)
  })

  it('a demo person is not offered the real flat either', () => {
    // The other direction matters too: a demo visitor clicking through must not
    // be shown the real flat, nor its residents.
    expect(belongsToSameWorld(true, false)).toBe(false)
  })

  it('real matches real', () => {
    expect(belongsToSameWorld(false, false)).toBe(true)
  })
})

describe('demo codes are recognised the way the RESET recognises them', () => {
  /**
   * These must agree with `lib/demo/config.ts`. If the analytics filter and the
   * scoped reset ever disagreed about what "demo" means, one of them would be
   * wrong — either rows nobody cleans, or real rows missing from the pilot.
   */
  it("matches every prefix the product has ever issued, not just today's", () => {
    expect(ALL_DEMO_RESIDENT_CODE_PREFIXES.length).toBeGreaterThan(1)
    for (const prefix of ALL_DEMO_RESIDENT_CODE_PREFIXES) {
      expect(isDemoResidentCode(`${prefix}07`)).toBe(true)
    }
  })

  it.each([['KL-G7K2MQ'], ['RES-LCCM7A'], ['RES-7RYXK3'], ['AOZ-ADMIN1']])(
    'treats the real code %s as real',
    (code) => {
      expect(isDemoResidentCode(code)).toBe(false)
    },
  )

  it('recognises demo units by their prefix', () => {
    expect(isDemoUnitCode(`${DEMO_UNIT_CODE_PREFIX}U12`)).toBe(true)
    expect(isDemoUnitCode('WIT-458')).toBe(false)
  })
})
