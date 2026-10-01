/**
 * Tests for calculateMissionKPIs
 *
 * Covers: monthly incident counting, conflict relocation counting,
 * placement decision time, trend detection, and edge cases.
 */

import { calculateMissionKPIs } from '../mission-kpis'

// =============================================================================
// MOCKS
// =============================================================================

const mockIncidentFindMany = vi.fn()
const mockPlacementFindMany = vi.fn()
const mockResidentFindMany = vi.fn()
const mockHousingUnitFindMany = vi.fn(() => Promise.resolve([]))

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: {
      incident: { findMany: (...args: unknown[]) => mockIncidentFindMany(...args) },
      placement: { findMany: (...args: unknown[]) => mockPlacementFindMany(...args) },
      resident: { findMany: (...args: unknown[]) => mockResidentFindMany(...args) },
      // Kept so an unexpected housing-unit read resolves empty rather than
      // throwing. Placeholders are read through `resident.findMany`; these
      // fixtures carry none, so the expectations below are unchanged.
      housingUnit: { findMany: () => mockHousingUnitFindMany() },
    },
  },
}))

// The source makes TWO placement queries (ended vs recent). They used to be
// told apart by the plain `where` object's keys; with drizzle the where is an
// SQL tree, so the dispatch reads the compared column back out of it.
import { whereParts } from '@/test-utils/drizzle-where'

// =============================================================================
// DATE FIXTURE
// Fixed "now" = 2026-05-15 so month math is deterministic.
// With months=6, the window is: Dec-2025, Jan-2026, Feb-2026, Mar-2026, Apr-2026, May-2026
// =============================================================================

const NOW = new Date('2026-05-15T12:00:00.000Z')

function d(iso: string): Date {
  return new Date(iso)
}

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  vi.clearAllMocks()
  // Default: empty DB
  mockIncidentFindMany.mockResolvedValue([])
  mockPlacementFindMany.mockResolvedValue([])
  mockResidentFindMany.mockResolvedValue([])
})

// =============================================================================
// TESTS
// =============================================================================

describe('calculateMissionKPIs', () => {
  // ── Structure ─────────────────────────────────────────────────────────────

  test('returns 6 monthly data points by default', async () => {
    const kpis = await calculateMissionKPIs(6)

    expect(kpis.incidentsPerMonth).toHaveLength(6)
    expect(kpis.conflictRelocationsPerMonth).toHaveLength(6)
  })

  test('returns 3 monthly data points when months=3', async () => {
    const kpis = await calculateMissionKPIs(3)

    expect(kpis.incidentsPerMonth).toHaveLength(3)
  })

  test('all months initialized to zero when no data', async () => {
    const kpis = await calculateMissionKPIs(6)

    expect(kpis.incidentsPerMonth.every((d) => d.value === 0)).toBe(true)
    expect(kpis.conflictRelocationsPerMonth.every((d) => d.value === 0)).toBe(true)
    expect(kpis.currentMonthIncidents).toBe(0)
    expect(kpis.currentMonthRelocations).toBe(0)
    expect(kpis.avgIncidentsPerMonth).toBe(0)
    expect(kpis.avgRelocationsPerMonth).toBe(0)
    expect(kpis.monthsTracked).toBe(6)
  })

  test('months are in ascending chronological order', async () => {
    const kpis = await calculateMissionKPIs(6)
    const months = kpis.incidentsPerMonth.map((d) => d.month)

    expect(months).toEqual(['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'])
  })

  // ── Incident counting ─────────────────────────────────────────────────────

  test('counts incidents in the correct month', async () => {
    mockIncidentFindMany.mockResolvedValue([
      { date: d('2026-03-10') },
      { date: d('2026-03-25') },
      { date: d('2026-04-01') },
    ])

    const kpis = await calculateMissionKPIs(6)
    const march = kpis.incidentsPerMonth.find((d) => d.month === '2026-03')
    const april = kpis.incidentsPerMonth.find((d) => d.month === '2026-04')
    const may = kpis.incidentsPerMonth.find((d) => d.month === '2026-05')

    expect(march?.value).toBe(2)
    expect(april?.value).toBe(1)
    expect(may?.value).toBe(0)
  })

  test('currentMonthIncidents reflects May 2026 count', async () => {
    mockIncidentFindMany.mockResolvedValue([{ date: d('2026-05-01') }, { date: d('2026-05-14') }])

    const kpis = await calculateMissionKPIs(6)

    expect(kpis.currentMonthIncidents).toBe(2)
  })

  test('incidents outside the tracked window are ignored', async () => {
    // The Prisma query already filters by date range, so we just verify
    // that incidents returned are counted and those with out-of-range months
    // are silently ignored by the bucketing logic
    mockIncidentFindMany.mockResolvedValue([
      { date: d('2026-03-15') },
      { date: d('2024-01-01') }, // very old — not in any bucket
    ])

    const kpis = await calculateMissionKPIs(6)
    const total = kpis.incidentsPerMonth.reduce((s, d) => s + d.value, 0)

    expect(total).toBe(1) // only the in-window one is counted
  })

  // ── Conflict relocation counting ──────────────────────────────────────────

  test('counts only CONFLICT end reason as relocations', async () => {
    mockPlacementFindMany.mockImplementation((args: { where?: unknown }) => {
      if ('endDate' in whereParts(args.where)) {
        // Ended placements query
        return Promise.resolve([
          { endDate: d('2026-04-10'), endReason: 'CONFLICT' },
          { endDate: d('2026-04-15'), endReason: 'NATURAL' }, // not a conflict relocation
          { endDate: d('2026-04-20'), endReason: 'CONFLICT' },
        ])
      }
      return Promise.resolve([]) // recent placements query
    })

    const kpis = await calculateMissionKPIs(6)
    const april = kpis.conflictRelocationsPerMonth.find((d) => d.month === '2026-04')

    expect(april?.value).toBe(2)
  })

  test('currentMonthRelocations counts May 2026 conflict ends', async () => {
    mockPlacementFindMany.mockImplementation((args: { where?: unknown }) => {
      if ('endDate' in whereParts(args.where)) {
        return Promise.resolve([{ endDate: d('2026-05-05'), endReason: 'CONFLICT' }])
      }
      return Promise.resolve([])
    })

    const kpis = await calculateMissionKPIs(6)

    expect(kpis.currentMonthRelocations).toBe(1)
  })

  // ── Average calculation ───────────────────────────────────────────────────

  test('avgIncidentsPerMonth excludes the current (incomplete) month', async () => {
    // 4 incidents in Feb, 0 in all other completed months, 10 in May (current)
    mockIncidentFindMany.mockResolvedValue([
      { date: d('2026-02-10') },
      { date: d('2026-02-11') },
      { date: d('2026-02-12') },
      { date: d('2026-02-13') },
      { date: d('2026-05-01') },
      { date: d('2026-05-02') },
      { date: d('2026-05-03') },
      { date: d('2026-05-04') },
      { date: d('2026-05-05') },
      { date: d('2026-05-06') },
      { date: d('2026-05-07') },
      { date: d('2026-05-08') },
      { date: d('2026-05-09') },
      { date: d('2026-05-10') },
    ])

    const kpis = await calculateMissionKPIs(6)

    // Completed months: Dec-2025(0), Jan(0), Feb(4), Mar(0), Apr(0) → avg = 4/5 = 0.8
    expect(kpis.avgIncidentsPerMonth).toBe(0.8)
    // Current month not included in average
    expect(kpis.currentMonthIncidents).toBe(10)
  })

  // ── Placement decision time ───────────────────────────────────────────────

  test('returns null placement time when no residents have been placed', async () => {
    const kpis = await calculateMissionKPIs(6)

    expect(kpis.avgPlacementTimeDays).toBeNull()
    expect(kpis.recentPlacementTimeDays).toBeNull()
  })

  test('calculates average days from resident creation to first placement', async () => {
    const residentCreatedAt = d('2026-04-01T00:00:00Z')
    const firstPlacementDate = d('2026-04-03T00:00:00Z') // 2 days later

    mockResidentFindMany.mockResolvedValue([
      { id: 'res-1', code: 'KL-REAL01', createdAt: residentCreatedAt },
    ])

    mockPlacementFindMany.mockImplementation((args: { where?: unknown }) => {
      if ('startDate' in whereParts(args.where)) {
        // Recent placements
        return Promise.resolve([{ residentId: 'res-1', startDate: firstPlacementDate }])
      }
      return Promise.resolve([]) // ended placements
    })

    const kpis = await calculateMissionKPIs(6)

    expect(kpis.avgPlacementTimeDays).toBe(2)
  })

  test('uses earliest placement when resident has multiple placements', async () => {
    const residentCreatedAt = d('2026-04-01T00:00:00Z')

    mockResidentFindMany.mockResolvedValue([
      { id: 'res-1', code: 'KL-REAL01', createdAt: residentCreatedAt },
    ])

    mockPlacementFindMany.mockImplementation((args: { where?: unknown }) => {
      if ('startDate' in whereParts(args.where)) {
        return Promise.resolve([
          { residentId: 'res-1', startDate: d('2026-04-10T00:00:00Z') }, // 9 days
          { residentId: 'res-1', startDate: d('2026-04-05T00:00:00Z') }, // 4 days ← earliest
        ])
      }
      return Promise.resolve([])
    })

    const kpis = await calculateMissionKPIs(6)

    expect(kpis.avgPlacementTimeDays).toBe(4)
  })

  // ── Trend detection ───────────────────────────────────────────────────────

  test('trend is "stable" when no incidents in 6 months', async () => {
    const kpis = await calculateMissionKPIs(6)

    expect(kpis.trend).toBe('stable')
    expect(kpis.trendDetail).toContain('Konflikte')
  })

  test('trend is "improving" when recent 3 months have ≥15% fewer incidents', async () => {
    // Previous 3 months (Dec, Jan, Feb): 10 incidents each
    // Recent 3 months (Mar, Apr, May): 2 incidents each
    // Change: (2 - 10) / 10 = -80% → improving
    mockIncidentFindMany.mockResolvedValue([
      // Previous 3 months
      ...Array(10).fill({ date: d('2025-12-15') }),
      ...Array(10).fill({ date: d('2026-01-15') }),
      ...Array(10).fill({ date: d('2026-02-15') }),
      // Recent 3 months
      ...Array(2).fill({ date: d('2026-03-15') }),
      ...Array(2).fill({ date: d('2026-04-15') }),
      ...Array(2).fill({ date: d('2026-05-15') }),
    ])

    const kpis = await calculateMissionKPIs(6)

    expect(kpis.trend).toBe('improving')
    expect(kpis.trendDetail).toContain('weniger')
  })

  test('trend is "worsening" when recent 3 months have ≥15% more incidents', async () => {
    // Previous 3 months: 2 each
    // Recent 3 months: 10 each → +400% → worsening
    mockIncidentFindMany.mockResolvedValue([
      ...Array(2).fill({ date: d('2025-12-15') }),
      ...Array(2).fill({ date: d('2026-01-15') }),
      ...Array(2).fill({ date: d('2026-02-15') }),
      ...Array(10).fill({ date: d('2026-03-15') }),
      ...Array(10).fill({ date: d('2026-04-15') }),
      ...Array(10).fill({ date: d('2026-05-15') }),
    ])

    const kpis = await calculateMissionKPIs(6)

    expect(kpis.trend).toBe('worsening')
    expect(kpis.trendDetail).toContain('mehr')
  })

  test('trend is "stable" when change is between -15% and +15%', async () => {
    // Previous 3 months: 10 each
    // Recent 3 months: 10 each → 0% change → stable
    mockIncidentFindMany.mockResolvedValue([
      ...Array(10).fill({ date: d('2025-12-15') }),
      ...Array(10).fill({ date: d('2026-01-15') }),
      ...Array(10).fill({ date: d('2026-02-15') }),
      ...Array(10).fill({ date: d('2026-03-15') }),
      ...Array(10).fill({ date: d('2026-04-15') }),
      ...Array(10).fill({ date: d('2026-05-15') }),
    ])

    const kpis = await calculateMissionKPIs(6)

    expect(kpis.trend).toBe('stable')
  })

  test('trend is "worsening" when previous period had 0 incidents but recent has some', async () => {
    mockIncidentFindMany.mockResolvedValue([{ date: d('2026-03-15') }, { date: d('2026-04-15') }])

    const kpis = await calculateMissionKPIs(6)

    expect(kpis.trend).toBe('worsening')
  })
})
