/**
 * Two worlds on one site: who sees which rows.
 *
 * Written from a live observation — the REAL Jobcoach's Eingang badge said 2,
 * and both were invented residents' requests. The rule under test is the
 * matcher's rule applied to every list: a demo viewer sees only the invented
 * world, a real viewer only the real one.
 */

import { PgDialect } from 'drizzle-orm/pg-core'

const mockSelect = vi.fn()

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db/schema')),
  ...(await vi.importActual<object>('@/lib/db/helpers')),
  db: { select: (...a: unknown[]) => mockSelect(...a) },
}))

import { housingUnit, opportunity, resident, user } from '@/lib/db/schema'
import { ALL_DEMO_RESIDENT_CODE_PREFIXES, DEMO_UNIT_CODE_PREFIX } from '@/lib/demo/config'
import { demoStaffCodes } from '@/lib/demo/roles'
import {
  isDemoListing,
  isDemoResident,
  isDemoUnit,
  isDemoViewer,
  listingAuthorInWorld,
  REAL_WORLD,
  residentCodeInWorld,
  residentsInWorld,
  residentViewerWorld,
  staffIdInWorld,
  staffViewerWorld,
  unitCodeInWorld,
  unitsInWorld,
  visibleIn,
  type ViewerWorld,
} from '../world'

const dialect = new PgDialect()
const render = (fragment: Parameters<PgDialect['sqlToQuery']>[0]) => dialect.sqlToQuery(fragment)

const DEMO_RESIDENT = `${ALL_DEMO_RESIDENT_CODE_PREFIXES[0]}7`
const REAL_RESIDENT = 'KL-A1B2C3'
const LEGACY_REAL_RESIDENT = 'RES-LCCM7A'

const demoWorld: ViewerWorld = { isDemo: true, demoStaffIds: new Set(['demo-staff']) }
const realWorld: ViewerWorld = { isDemo: false, demoStaffIds: new Set(['demo-staff']) }

/** Resolve `select().from().where()` to the given rows. */
function selectReturns(rows: { id: string }[]) {
  mockSelect.mockReturnValue({ from: () => ({ where: () => Promise.resolve(rows) }) })
}

beforeEach(() => {
  mockSelect.mockReset()
})

describe('isDemoViewer', () => {
  it('recognises every demo door', () => {
    for (const code of demoStaffCodes()) expect(isDemoViewer({ code })).toBe(true)
  })

  it('recognises the legacy WG-DEMO01 door when it is configured', () => {
    vi.stubEnv('DEMO_STAFF_CODE', 'WG-DEMO01')
    try {
      expect(isDemoViewer({ code: 'WG-DEMO01' })).toBe(true)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('treats a real staff code as real', () => {
    expect(isDemoViewer({ code: 'AOZ-SIMON1' })).toBe(false)
  })
})

describe('isDemoResident / isDemoUnit', () => {
  it('a demo-prefixed resident is invented', () => {
    expect(isDemoResident({ code: DEMO_RESIDENT })).toBe(true)
  })

  it('a real client — current or legacy prefix — is real', () => {
    expect(isDemoResident({ code: REAL_RESIDENT })).toBe(false)
    expect(isDemoResident({ code: LEGACY_REAL_RESIDENT })).toBe(false)
  })

  it('a PLACEHOLDER is real-world: it sits in a real flat waiting to be claimed', () => {
    // The predicate reads only the code; `isPlaceholder` is a KPI question.
    const placeholder = { code: 'KL-AMIR01', isPlaceholder: true }
    expect(isDemoResident(placeholder)).toBe(false)
    expect(residentsInWorld([placeholder], REAL_WORLD, (r) => r)).toEqual([placeholder])
  })

  it('a DEMO- flat is invented, a real address is not', () => {
    expect(isDemoUnit({ code: `${DEMO_UNIT_CODE_PREFIX}U12` })).toBe(true)
    expect(isDemoUnit({ code: 'WIT-426-01' })).toBe(false)
  })
})

describe('isDemoListing', () => {
  const demoIds = new Set(['demo-staff', 'legacy-wg-demo01'])

  it('a listing authored by a demo account — including the legacy WG-DEMO01 one — is invented', () => {
    expect(isDemoListing({ createdByUserId: 'demo-staff' }, demoIds)).toBe(true)
    expect(isDemoListing({ createdByUserId: 'legacy-wg-demo01' }, demoIds)).toBe(true)
  })

  it("a real coach's listing, or one with no author, is real", () => {
    expect(isDemoListing({ createdByUserId: 'simon' }, demoIds)).toBe(false)
    expect(isDemoListing({ createdByUserId: null }, demoIds)).toBe(false)
  })
})

describe('in-memory filtering, both directions', () => {
  const rows = [
    { id: 'a', resident: { code: REAL_RESIDENT } },
    { id: 'b', resident: { code: DEMO_RESIDENT } },
    { id: 'c', resident: null },
  ]

  it('a real viewer never sees an invented person', () => {
    expect(residentsInWorld(rows, realWorld, (r) => r.resident).map((r) => r.id)).toEqual([
      'a',
      'c',
    ])
  })

  it('a demo viewer never sees a real person', () => {
    expect(residentsInWorld(rows, demoWorld, (r) => r.resident).map((r) => r.id)).toEqual(['b'])
  })

  it('flats follow the same rule', () => {
    const units = [{ code: 'WIT-458' }, { code: `${DEMO_UNIT_CODE_PREFIX}U09` }]
    expect(unitsInWorld(units, realWorld, (u) => u)).toEqual([{ code: 'WIT-458' }])
    expect(unitsInWorld(units, demoWorld, (u) => u)).toEqual([
      { code: `${DEMO_UNIT_CODE_PREFIX}U09` },
    ])
  })

  it('visibleIn is the matcher rule', () => {
    expect(visibleIn(realWorld, false)).toBe(true)
    expect(visibleIn(realWorld, true)).toBe(false)
    expect(visibleIn(demoWorld, true)).toBe(true)
    expect(visibleIn(demoWorld, false)).toBe(false)
  })
})

describe('SQL fragments', () => {
  it('residents: demo matches every demo prefix, real is its negation', () => {
    const demo = render(residentCodeInWorld(resident.code, demoWorld))
    const real = render(residentCodeInWorld(resident.code, realWorld))

    for (const prefix of ALL_DEMO_RESIDENT_CODE_PREFIXES) {
      expect(demo.params).toContain(`${prefix}%`)
      expect(real.params).toContain(`${prefix}%`)
    }
    expect(demo.sql).not.toMatch(/\bnot\b/i)
    expect(real.sql).toMatch(/^not /i)
  })

  it('flats: DEMO- prefix, negated for a real viewer', () => {
    const demo = render(unitCodeInWorld(housingUnit.code, demoWorld))
    const real = render(unitCodeInWorld(housingUnit.code, realWorld))
    expect(demo.params).toEqual([`${DEMO_UNIT_CODE_PREFIX}%`])
    expect(real.sql).toMatch(/^not /i)
  })

  it('listings: a demo viewer gets only demo-authored, a real viewer everything else', () => {
    const demo = render(listingAuthorInWorld(opportunity.createdByUserId, demoWorld))
    const real = render(listingAuthorInWorld(opportunity.createdByUserId, realWorld))

    expect(demo.sql).toMatch(/ in \(/i)
    expect(demo.sql).not.toMatch(/not in/i)
    expect(demo.params).toEqual(['demo-staff'])
    // An unauthored listing must stay visible to real staff.
    expect(real.sql).toMatch(/is null/i)
    expect(real.sql).toMatch(/not in/i)
    expect(real.params).toEqual(['demo-staff'])
  })

  it('listings with no demo accounts at all: demo sees nothing, real sees everything', () => {
    const none = (isDemo: boolean): ViewerWorld => ({ isDemo, demoStaffIds: new Set() })
    expect(render(listingAuthorInWorld(opportunity.createdByUserId, none(true))).sql).toBe('false')
    expect(render(listingAuthorInWorld(opportunity.createdByUserId, none(false))).sql).toBe('true')
  })

  it('staff accounts: demo doors stay out of a real Leitung team count', () => {
    expect(render(staffIdInWorld(user.id, realWorld)).sql).toMatch(/not in/i)
    expect(render(staffIdInWorld(user.id, demoWorld)).sql).not.toMatch(/not in/i)
  })
})

describe('resolving the viewer', () => {
  it('a demo door is in the demo world', async () => {
    selectReturns([{ id: 'demo-staff' }])
    await expect(staffViewerWorld('demo-staff')).resolves.toMatchObject({ isDemo: true })
  })

  it('real staff are in the real world, and still learn which listings are invented', async () => {
    selectReturns([{ id: 'demo-staff' }])
    const world = await staffViewerWorld('simon')
    expect(world.isDemo).toBe(false)
    expect([...world.demoStaffIds]).toEqual(['demo-staff'])
  })

  it('no signed-in viewer resolves to the real world', async () => {
    selectReturns([{ id: 'demo-staff' }])
    await expect(staffViewerWorld(null)).resolves.toMatchObject({ isDemo: false })
  })

  it("a resident's own code decides their world", async () => {
    selectReturns([])
    await expect(residentViewerWorld({ code: DEMO_RESIDENT })).resolves.toMatchObject({
      isDemo: true,
    })
    await expect(residentViewerWorld({ code: REAL_RESIDENT })).resolves.toMatchObject({
      isDemo: false,
    })
  })
})
