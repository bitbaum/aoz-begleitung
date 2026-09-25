import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CAPACITY_STATUSES, countsTowardCapacity, placeableBeds } from '../capacity'

describe('a bed nobody can be placed into is not capacity', () => {
  /**
   * The production case. On 2026-09-04 the 118 flats of a real
   * street terrace were entered from the federal register — a terrace under demolition
   * order, most of which AOZ may not hold. They sit at CLOSED with 0 beds, and
   * that zero was doing the work a status should do: the moment a real bed
   * count is typed into a flat that is not in service, free beds inflates,
   * because free beds is `totalBeds − occupiedBeds` over EVERY unit.
   */
  it('does not count a CLOSED building that has real beds recorded', () => {
    const units = [
      { totalBeds: 5, status: 'AVAILABLE' as const }, // AOZ's real flat
      { totalBeds: 5, status: 'CLOSED' as const }, // entered from the register
      { totalBeds: 4, status: 'CLOSED' as const },
    ]
    expect(placeableBeds(units)).toBe(5)
  })

  it('counts a full building — occupied is not the same as unavailable', () => {
    expect(placeableBeds([{ totalBeds: 4, status: 'FULL' }])).toBe(4)
  })

  it('counts a building under maintenance', () => {
    // Deliberate. A flat being repaired is stock AOZ holds and gets back;
    // excluding it would make occupancy jump when a shower breaks and drop
    // again when it is fixed — a placement trend that never happened.
    expect(countsTowardCapacity('MAINTENANCE')).toBe(true)
  })

  it('excludes CLOSED and nothing else', () => {
    expect(countsTowardCapacity('CLOSED')).toBe(false)
    expect([...CAPACITY_STATUSES].sort()).toEqual(['AVAILABLE', 'FULL', 'MAINTENANCE'])
  })

  it('is zero for an empty estate rather than throwing', () => {
    expect(placeableBeds([])).toBe(0)
  })
})

describe('every place that totals beds goes through it', () => {
  /**
   * The rule was wrong in three files at once, each individually
   * reasonable-looking: the dashboard, /analytics and /housing all wrote
   * `units.reduce((sum, u) => sum + u.totalBeds, 0)`. A shared helper only
   * helps if the call sites actually use it, so this reads them.
   */
  const FILES = [
    'src/app/(admin)/page.tsx',
    'src/app/(admin)/analytics/page.tsx',
    'src/app/(admin)/housing/page.tsx',
  ]

  it.each(FILES)('%s uses placeableBeds', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8')
    expect(source).toContain('placeableBeds')
  })

  it.each(FILES)('%s no longer sums totalBeds unfiltered', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8')
    expect(source).not.toMatch(/sum \+ u\.totalBeds/)
  })
})
