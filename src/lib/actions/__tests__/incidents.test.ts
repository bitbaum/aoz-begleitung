/**
 * Unit tests for incident server actions
 *
 * Tests resolveIncident (uses redirect-free flow via revalidatePath),
 * getResidentIncidentStats, and getHousingUnitIncidentHistory.
 * createIncident/addFollowUp use redirect() or are form-data-dependent.
 */

import {
  getResidentIncidentStats,
  getHousingUnitIncidentHistory,
  getIncidentsNeedingFollowUp,
  clearFollowUpReminder,
} from '../incidents'

// =============================================================================
// MOCKS
// =============================================================================

// db.$count(incident, …) is called for "reported" then "as subject", then
// db.$count(incidentInvolvement, …) for "involved" — order is deterministic
// (Promise.all array), so Once-chains keep the old per-model discrimination.
const mockCount = vi.fn()
const mockIncidentFindMany = vi.fn()
const mockIncidentFindFirst = vi.fn()
const mockUpdateSet = vi.fn()

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: {
      incident: {
        findMany: (...a: unknown[]) => mockIncidentFindMany(...a),
        findFirst: (...a: unknown[]) => mockIncidentFindFirst(...a),
      },
    },
    $count: (table: unknown, where: unknown) => mockCount(table, where),
    // Subquery builder used inside inArray(); never executed because
    // findMany is mocked — it only needs to be chainable.
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({})) })) })),
    update: vi.fn(() => ({
      set: (v: unknown) => {
        mockUpdateSet(v)
        return { where: () => Promise.resolve([]) }
      },
    })),
  },
}))

vi.mock('next/cache', async () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/navigation', async () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/audit', async () => ({
  logAudit: vi.fn(),
}))

const mockStaffUser = {
  id: 'staff-1',
  email: 'admin@test.com',
  name: 'Test Admin',
  role: 'ADMIN' as const,
}

vi.mock('@/lib/auth', async () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: 'staff-1',
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'ADMIN' as const,
  }),
  requireStaffAuth: vi.fn().mockResolvedValue({
    id: 'staff-1',
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'ADMIN' as const,
  }),
  requirePermission: vi.fn().mockResolvedValue({
    id: 'staff-1',
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'ADMIN' as const,
  }),
}))

vi.mock('@/lib/logger', async () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    errorWithCause: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// getResidentIncidentStats
// =============================================================================

describe('getResidentIncidentStats', () => {
  it('returns zero counts when resident has no incidents', async () => {
    mockCount
      .mockResolvedValueOnce(0) // reported
      .mockResolvedValueOnce(0) // as subject
      .mockResolvedValueOnce(0) // involved
    mockIncidentFindMany.mockResolvedValue([]) // unique incidents

    const stats = await getResidentIncidentStats('res-1')

    expect(stats).toEqual({
      reported: 0,
      asSubject: 0,
      involved: 0,
      total: 0,
    })
  })

  it('returns correct counts for a resident with mixed incident involvement', async () => {
    mockCount
      .mockResolvedValueOnce(3) // reported
      .mockResolvedValueOnce(1) // as subject
      .mockResolvedValueOnce(2) // involved
    mockIncidentFindMany.mockResolvedValue([
      { id: 'inc-1' },
      { id: 'inc-2' },
      { id: 'inc-3' },
      { id: 'inc-4' },
    ])

    const stats = await getResidentIncidentStats('res-1')

    expect(stats).toEqual({
      reported: 3,
      asSubject: 1,
      involved: 2,
      total: 4,
    })
  })
})

// =============================================================================
// getHousingUnitIncidentHistory
// =============================================================================

describe('getHousingUnitIncidentHistory', () => {
  it('returns empty data for a unit with no incidents', async () => {
    mockIncidentFindMany.mockResolvedValue([])

    const result = await getHousingUnitIncidentHistory('hu-1')

    expect(result.incidents).toEqual([])
    expect(result.stats).toEqual({
      total: 0,
      open: 0,
      interpersonal: 0,
      maintenance: 0,
    })
  })

  it('calculates correct stats and ranks nobody', async () => {
    const incidents = [
      {
        id: 'inc-1',
        category: 'INTERPERSONAL',
        resolvedAt: null,
        subject: { id: 'res-a', code: 'RES-A' },
        reportedBy: null,
        involvedResidents: [],
      },
      {
        id: 'inc-2',
        category: 'MAINTENANCE',
        resolvedAt: new Date(),
        subject: null,
        reportedBy: null,
        involvedResidents: [],
      },
      {
        id: 'inc-3',
        category: 'INTERPERSONAL',
        resolvedAt: null,
        subject: { id: 'res-a', code: 'RES-A' },
        reportedBy: null,
        involvedResidents: [],
      },
    ]
    mockIncidentFindMany.mockResolvedValue(incidents)

    const result = await getHousingUnitIncidentHistory('hu-1')

    expect(result.stats.total).toBe(3)
    expect(result.stats.open).toBe(2)
    expect(result.stats.interpersonal).toBe(2)
    expect(result.stats.maintenance).toBe(1)

    // res-a is the subject twice. The history no longer turns that into a
    // per-person list: a count is not a verdict. @see lib/housing/fit-notes.ts
    expect(Object.keys(result).sort()).toEqual(['incidents', 'stats'])
  })
})

// =============================================================================
// getIncidentsNeedingFollowUp
// =============================================================================

describe('getIncidentsNeedingFollowUp', () => {
  it('returns categorized incidents for follow-up', async () => {
    // followUps rows are fetched (and counted in memory) where Prisma used
    // a `_count` include, so the fixtures carry the (empty) relation.
    const overdueIncident = {
      id: 'inc-overdue',
      nextFollowUpDate: new Date('2025-01-01'),
      followUps: [],
    }
    const dueSoonIncident = { id: 'inc-soon', nextFollowUpDate: new Date(), followUps: [] }
    const urgentIncident = { id: 'inc-urgent', followUpPriority: 'URGENT', followUps: [] }

    mockIncidentFindMany
      .mockResolvedValueOnce([overdueIncident]) // overdue
      .mockResolvedValueOnce([dueSoonIncident]) // dueSoon
      .mockResolvedValueOnce([urgentIncident]) // urgent

    const result = await getIncidentsNeedingFollowUp()

    expect(result.overdue).toHaveLength(1)
    expect(result.dueSoon).toHaveLength(1)
    expect(result.urgent).toHaveLength(1)
  })

  it('returns empty arrays when no follow-ups needed', async () => {
    mockIncidentFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await getIncidentsNeedingFollowUp()

    expect(result.overdue).toEqual([])
    expect(result.dueSoon).toEqual([])
    expect(result.urgent).toEqual([])
  })
})

// =============================================================================
// auth guard
// =============================================================================

describe('auth guard', () => {
  it('rejects unauthenticated requests', async () => {
    const { requirePermission: mockRequirePermission } = vi.mocked(await import('@/lib/auth'))
    mockRequirePermission.mockRejectedValueOnce(new Error('Anmeldung erforderlich'))

    const fd = new FormData()
    await expect(clearFollowUpReminder(fd)).rejects.toThrow('Anmeldung erforderlich')
  })
})
