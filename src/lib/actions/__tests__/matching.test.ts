/**
 * Unit tests for matching server action: placeResident
 *
 * placeResident takes FormData, runs a db transaction, and calls redirect() on success.
 * Since redirect() throws by design in Next.js, we mock it to throw a sentinel error.
 */

import type { Mock } from 'vitest'
import { db, housingUnit, placementSpot, resident } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { calculateApartmentFit } from '@/lib/compatibility/aggregate'
import { calculateCompatibility } from '@/lib/compatibility'
import { placeResident } from '../matching'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    transaction: vi.fn(),
  },
}))

vi.mock('next/cache', async () => ({
  revalidatePath: vi.fn(),
}))

const mockRedirect = vi.fn()
vi.mock('next/navigation', async () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args)
    throw new Error('NEXT_REDIRECT')
  },
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

vi.mock('@/lib/compatibility', async () => ({
  calculateCompatibility: vi.fn().mockReturnValue({
    overall: 75,
    lifestyle: 80,
    social: 70,
    practical: 75,
    risk: 65,
    strengths: ['Shared language'],
    concerns: [],
  }),
  saveBidirectionalAssessment: vi.fn(async (tx, aId, bId, score) => {
    const data = {
      overallScore: score.overall,
      lifestyleScore: score.lifestyle,
      socialScore: score.social,
      practicalScore: score.practical,
      riskScore: score.risk,
      strengths: score.strengths || [],
      concerns: score.concerns || [],
    }
    await tx.compatibilityAssessment.upsert({
      where: { residentId_comparedWithId: { residentId: aId, comparedWithId: bId } },
      update: data,
      create: { residentId: aId, comparedWithId: bId, ...data },
    })
    await tx.compatibilityAssessment.upsert({
      where: { residentId_comparedWithId: { residentId: bId, comparedWithId: aId } },
      update: data,
      create: { residentId: bId, comparedWithId: aId, ...data },
    })
  }),
}))

vi.mock('@/lib/compatibility/convert', async () => ({
  toResidentProfile: vi.fn().mockReturnValue({}),
}))

vi.mock('@/lib/compatibility/aggregate', async () => ({
  calculateApartmentProfile: vi.fn().mockReturnValue({ isEmpty: false }),
  calculateApartmentFit: vi.fn().mockReturnValue({
    fitScore: 80,
    conflicts: [],
    strengths: ['Good fit'],
  }),
}))

vi.mock('@/lib/compatibility/placement-scores', async () => ({
  calculateAverageScores: vi.fn().mockReturnValue({
    compatibilityScore: 75,
    lifestyleScore: 80,
    socialScore: 70,
    practicalScore: 75,
    riskScore: 65,
  }),
}))

const mockDb = db as unknown as { transaction: Mock }

beforeEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// Helper to set up $transaction mock
// =============================================================================

/**
 * Configures db.transaction to execute the callback with a mock tx object.
 * Each mock method on tx is configurable via the txSetup callback; a
 * drizzle-shaped facade maps the source's tx.query/insert/update calls onto
 * those holder mocks (updates dispatch on the real table object identity).
 */
function setupTransaction(txSetup: (tx: Record<string, Record<string, Mock>>) => void) {
  const tx: Record<string, Record<string, Mock>> = {
    resident: { findUnique: vi.fn(), update: vi.fn() },
    placement: { findMany: vi.fn(), create: vi.fn() },
    placementSpot: { findUnique: vi.fn(), update: vi.fn() },
    housingUnit: { findUnique: vi.fn(), update: vi.fn() },
    compatibilityAssessment: { upsert: vi.fn() },
  }
  txSetup(tx)
  const drizzleTx = {
    query: {
      placementSpot: { findFirst: (...a: unknown[]) => tx.placementSpot.findUnique(...a) },
      resident: { findFirst: (...a: unknown[]) => tx.resident.findUnique(...a) },
      placement: { findMany: (...a: unknown[]) => tx.placement.findMany(...a) },
      housingUnit: { findFirst: (...a: unknown[]) => tx.housingUnit.findUnique(...a) },
    },
    // Only the placement table is inserted into in this action
    insert: (_table: unknown) => ({
      values: (v: unknown) => ({
        returning: async (): Promise<unknown[]> => [await tx.placement.create(v)],
      }),
    }),
    update: (table: unknown) => ({
      set: (v: unknown) => ({
        where: (_w: unknown) => {
          const m =
            table === placementSpot
              ? tx.placementSpot.update
              : table === resident
                ? tx.resident.update
                : table === housingUnit
                  ? tx.housingUnit.update
                  : vi.fn()
          return m(v)
        },
      }),
    }),
    // Consumed only by the mocked saveBidirectionalAssessment above
    compatibilityAssessment: tx.compatibilityAssessment,
  }
  mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
    return cb(drizzleTx)
  })
  return tx
}

// =============================================================================
// Helper to build FormData
// =============================================================================

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const defaults: Record<string, string> = {
    residentId: 'res-1',
    housingUnitId: 'hu-1',
    spotId: 'spot-1',
    notes: 'Test placement',
  }
  const merged = { ...defaults, ...overrides }
  const fd = new FormData()
  for (const [key, value] of Object.entries(merged)) {
    if (value !== '') {
      fd.set(key, value)
    }
  }
  return fd
}

// =============================================================================
// placeResident
// =============================================================================

describe('placeResident', () => {
  // ---------------------------------------------------------------------------
  // 1. Validation error
  // ---------------------------------------------------------------------------
  it('throws validation error when residentId is missing', async () => {
    const fd = new FormData()
    fd.set('housingUnitId', 'hu-1')
    // residentId intentionally omitted

    await expect(placeResident(fd)).rejects.toThrow('Validierungsfehler')
  })

  // ---------------------------------------------------------------------------
  // 2. Spot not found
  // ---------------------------------------------------------------------------
  it('throws when spot is not found', async () => {
    setupTransaction((tx) => {
      tx.placementSpot.findUnique.mockResolvedValue(null)
    })

    await expect(placeResident(makeFormData())).rejects.toThrow(ERROR_MESSAGES.SPOT_NOT_FOUND_P)
  })

  // ---------------------------------------------------------------------------
  // 3. Spot not available
  // ---------------------------------------------------------------------------
  it('throws when spot status is not AVAILABLE', async () => {
    setupTransaction((tx) => {
      tx.placementSpot.findUnique.mockResolvedValue({
        id: 'spot-1',
        status: 'OCCUPIED',
        placements: [],
      })
    })

    await expect(placeResident(makeFormData())).rejects.toThrow(
      ERROR_MESSAGES.SPOT_NOT_AVAILABLE_ANYMORE,
    )
  })

  // ---------------------------------------------------------------------------
  // 4. Spot already occupied (has active placements)
  // ---------------------------------------------------------------------------
  it('throws when spot has active placements', async () => {
    setupTransaction((tx) => {
      tx.placementSpot.findUnique.mockResolvedValue({
        id: 'spot-1',
        status: 'AVAILABLE',
        placements: [{ id: 'pl-existing', status: 'ACTIVE' }],
      })
    })

    await expect(placeResident(makeFormData())).rejects.toThrow(
      ERROR_MESSAGES.SPOT_ALREADY_OCCUPIED,
    )
  })

  // ---------------------------------------------------------------------------
  // 5. Resident not found
  // ---------------------------------------------------------------------------
  it('throws when resident is not found', async () => {
    setupTransaction((tx) => {
      tx.placementSpot.findUnique.mockResolvedValue({
        id: 'spot-1',
        status: 'AVAILABLE',
        placements: [],
      })
      tx.resident.findUnique.mockResolvedValue(null)
    })

    await expect(placeResident(makeFormData())).rejects.toThrow(ERROR_MESSAGES.RESIDENT_NOT_FOUND_P)
  })

  // ---------------------------------------------------------------------------
  // 6. Resident already placed
  // ---------------------------------------------------------------------------
  it('throws when resident already has active placement', async () => {
    setupTransaction((tx) => {
      tx.placementSpot.findUnique.mockResolvedValue({
        id: 'spot-1',
        status: 'AVAILABLE',
        placements: [],
      })
      tx.resident.findUnique.mockResolvedValue({
        id: 'res-1',
        placements: [{ id: 'pl-existing', status: 'ACTIVE' }],
      })
    })

    await expect(placeResident(makeFormData())).rejects.toThrow(
      ERROR_MESSAGES.RESIDENT_ALREADY_PLACED,
    )
  })

  // ---------------------------------------------------------------------------
  // 7. Blocking conflicts
  // ---------------------------------------------------------------------------
  it('throws when blocking conflicts are detected', async () => {
    ;(calculateApartmentFit as Mock).mockReturnValueOnce({
      fitScore: 20,
      conflicts: [{ severity: 'BLOCKING', message: 'Raucher in Nichtraucher-Einheit' }],
      strengths: [],
    })

    setupTransaction((tx) => {
      tx.placementSpot.findUnique.mockResolvedValue({
        id: 'spot-1',
        status: 'AVAILABLE',
        placements: [],
      })
      tx.resident.findUnique.mockResolvedValue({
        id: 'res-1',
        placements: [],
      })
      tx.placement.findMany.mockResolvedValue([])
    })

    await expect(placeResident(makeFormData())).rejects.toThrow('Placement blockiert')
  })

  // ---------------------------------------------------------------------------
  // 8. Successful placement in empty unit
  // ---------------------------------------------------------------------------
  it('creates placement in empty unit and redirects', async () => {
    const newPlacement = { id: 'pl-new', residentId: 'res-1' }

    const tx = setupTransaction((tx) => {
      tx.placementSpot.findUnique.mockResolvedValue({
        id: 'spot-1',
        status: 'AVAILABLE',
        placements: [],
      })
      tx.resident.findUnique.mockResolvedValue({
        id: 'res-1',
        placements: [],
      })
      tx.placement.findMany.mockResolvedValue([]) // empty unit
      tx.placement.create.mockResolvedValue(newPlacement)
      tx.placementSpot.update.mockResolvedValue({})
      tx.resident.update.mockResolvedValue({})
      tx.housingUnit.findUnique.mockResolvedValue({
        id: 'hu-1',
        totalBeds: 3,
        placements: [{ id: 'pl-new', status: 'ACTIVE' }], // 1 of 3 beds used
      })
    })

    // redirect throws NEXT_REDIRECT, which is expected behavior
    await expect(placeResident(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    // Verify placement was created with computed scores
    expect(tx.placement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        residentId: 'res-1',
        housingUnitId: 'hu-1',
        spotId: 'spot-1',
        status: 'ACTIVE',
        compatibilityScore: 75,
        lifestyleScore: 80,
        socialScore: 70,
        practicalScore: 75,
        riskScore: 65,
      }),
    )

    // Spot updated to OCCUPIED
    expect(tx.placementSpot.update).toHaveBeenCalledWith({ status: 'OCCUPIED' })

    // Resident updated to PLACED
    expect(tx.resident.update).toHaveBeenCalledWith({ status: 'PLACED' })

    // Unit NOT marked FULL (1 of 3 beds)
    expect(tx.housingUnit.update).not.toHaveBeenCalled()

    // Redirect to resident page
    expect(mockRedirect).toHaveBeenCalledWith('/residents/res-1?placed=true')
  })

  // ---------------------------------------------------------------------------
  // 9. Successful placement with existing roommates
  // ---------------------------------------------------------------------------
  it('creates compatibility assessments when unit has existing roommates', async () => {
    const newPlacement = { id: 'pl-new', residentId: 'res-1' }
    const existingPlacement = {
      id: 'pl-existing',
      residentId: 'res-2',
      resident: { id: 'res-2', firstName: 'Max' },
    }

    const tx = setupTransaction((tx) => {
      tx.placementSpot.findUnique.mockResolvedValue({
        id: 'spot-1',
        status: 'AVAILABLE',
        placements: [],
      })
      tx.resident.findUnique.mockResolvedValue({
        id: 'res-1',
        placements: [],
      })
      tx.placement.findMany.mockResolvedValue([existingPlacement])
      tx.placement.create.mockResolvedValue(newPlacement)
      tx.placementSpot.update.mockResolvedValue({})
      tx.resident.update.mockResolvedValue({})
      tx.compatibilityAssessment.upsert.mockResolvedValue({})
      tx.housingUnit.findUnique.mockResolvedValue({
        id: 'hu-1',
        totalBeds: 3,
        placements: [
          { id: 'pl-existing', status: 'ACTIVE' },
          { id: 'pl-new', status: 'ACTIVE' },
        ],
      })
    })

    await expect(placeResident(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    // 2 upserts per roommate: forward + reverse
    expect(tx.compatibilityAssessment.upsert).toHaveBeenCalledTimes(2)

    // Forward: res-1 -> res-2
    expect(tx.compatibilityAssessment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          residentId_comparedWithId: {
            residentId: 'res-1',
            comparedWithId: 'res-2',
          },
        },
      }),
    )

    // Reverse: res-2 -> res-1
    expect(tx.compatibilityAssessment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          residentId_comparedWithId: {
            residentId: 'res-2',
            comparedWithId: 'res-1',
          },
        },
      }),
    )

    // calculateCompatibility called once per existing roommate
    expect(calculateCompatibility).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // 10. Unit marked FULL when placements >= totalBeds
  // ---------------------------------------------------------------------------
  it('marks housing unit as FULL when all beds are occupied', async () => {
    const newPlacement = { id: 'pl-new', residentId: 'res-1' }

    const tx = setupTransaction((tx) => {
      tx.placementSpot.findUnique.mockResolvedValue({
        id: 'spot-1',
        status: 'AVAILABLE',
        placements: [],
      })
      tx.resident.findUnique.mockResolvedValue({
        id: 'res-1',
        placements: [],
      })
      tx.placement.findMany.mockResolvedValue([])
      tx.placement.create.mockResolvedValue(newPlacement)
      tx.placementSpot.update.mockResolvedValue({})
      tx.resident.update.mockResolvedValue({})
      tx.housingUnit.findUnique.mockResolvedValue({
        id: 'hu-1',
        totalBeds: 2,
        placements: [
          { id: 'pl-existing', status: 'ACTIVE' },
          { id: 'pl-new', status: 'ACTIVE' },
        ], // 2 of 2 beds
      })
      tx.housingUnit.update.mockResolvedValue({})
    })

    await expect(placeResident(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    expect(tx.housingUnit.update).toHaveBeenCalledWith({ status: 'FULL' })
  })

  // ---------------------------------------------------------------------------
  // 11. Audit log called with correct data
  // ---------------------------------------------------------------------------
  it('calls logAudit with correct placement data after success', async () => {
    const newPlacement = { id: 'pl-new', residentId: 'res-1' }

    setupTransaction((tx) => {
      tx.placementSpot.findUnique.mockResolvedValue({
        id: 'spot-1',
        status: 'AVAILABLE',
        placements: [],
      })
      tx.resident.findUnique.mockResolvedValue({
        id: 'res-1',
        placements: [],
      })
      tx.placement.findMany.mockResolvedValue([])
      tx.placement.create.mockResolvedValue(newPlacement)
      tx.placementSpot.update.mockResolvedValue({})
      tx.resident.update.mockResolvedValue({})
      tx.housingUnit.findUnique.mockResolvedValue({
        id: 'hu-1',
        totalBeds: 4,
        placements: [{ id: 'pl-new', status: 'ACTIVE' }],
      })
    })

    await expect(placeResident(makeFormData())).rejects.toThrow('NEXT_REDIRECT')

    expect(logAudit).toHaveBeenCalledWith({
      action: 'CREATE',
      entity: 'PLACEMENT',
      entityId: 'pl-new',
      userId: 'staff-1',
      changes: {
        residentId: 'res-1',
        housingUnitId: 'hu-1',
        spotId: 'spot-1',
        scores: {
          compatibility: 75,
          lifestyle: 80,
          social: 70,
          practical: 75,
          risk: 65,
          apartmentFit: 80,
        },
      },
      reason: 'Test placement',
    })
  })

  // ---------------------------------------------------------------------------
  // 12. Spot-less placement (spotId is null)
  // ---------------------------------------------------------------------------
  it('skips spot checks and spot update when spotId is null', async () => {
    const newPlacement = { id: 'pl-new', residentId: 'res-1' }

    const tx = setupTransaction((tx) => {
      tx.resident.findUnique.mockResolvedValue({
        id: 'res-1',
        placements: [],
      })
      tx.placement.findMany.mockResolvedValue([])
      tx.placement.create.mockResolvedValue(newPlacement)
      tx.resident.update.mockResolvedValue({})
      tx.housingUnit.findUnique.mockResolvedValue({
        id: 'hu-1',
        totalBeds: 4,
        placements: [{ id: 'pl-new', status: 'ACTIVE' }],
      })
    })

    // FormData without spotId
    const fd = makeFormData({ spotId: '' })

    await expect(placeResident(fd)).rejects.toThrow('NEXT_REDIRECT')

    // Spot lookup never called
    expect(tx.placementSpot.findUnique).not.toHaveBeenCalled()

    // Spot update never called
    expect(tx.placementSpot.update).not.toHaveBeenCalled()

    // Placement created with null spotId
    expect(tx.placement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        spotId: null,
      }),
    )
  })
})

// =============================================================================
// auth guard
// =============================================================================

describe('auth guard', () => {
  it('rejects unauthenticated requests', async () => {
    const { requireStaffAuth: mockRequireStaffAuth } = vi.mocked(await import('@/lib/auth'))
    mockRequireStaffAuth.mockRejectedValueOnce(new Error('Anmeldung erforderlich'))

    const fd = new FormData()
    await expect(placeResident(fd)).rejects.toThrow('Anmeldung erforderlich')
  })
})

// =============================================================================
// permission guard
// =============================================================================

describe('placements:write guard', () => {
  /**
   * placeResident took `requireStaffAuth()` alone — a session, not a right —
   * so any signed-in role could place a person into a flat.
   */
  const signedInAs = async (role: 'JOBCOACH' | 'FREIWILLIGENARBEIT' | 'LIEGENSCHAFTEN') => {
    const { requireStaffAuth: mockRequireStaffAuth } = vi.mocked(await import('@/lib/auth'))
    mockRequireStaffAuth.mockResolvedValueOnce({
      id: 'staff-2',
      email: '',
      name: 'Someone',
      role,
      scope: 'OWN_DOMAIN',
      isSystemAdmin: false,
    } as never)
  }

  it.each(['JOBCOACH', 'FREIWILLIGENARBEIT'] as const)(
    'refuses %s, which holds no placements:write, before touching the database',
    async (role) => {
      await signedInAs(role)
      await expect(placeResident(makeFormData())).rejects.toThrow(
        ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      )
      expect(mockDb.transaction).not.toHaveBeenCalled()
    },
  )

  it('lets Liegenschaften, which places people, through to the transaction', async () => {
    await signedInAs('LIEGENSCHAFTEN')
    mockDb.transaction.mockRejectedValueOnce(new Error('reached the transaction'))
    await expect(placeResident(makeFormData())).rejects.toThrow()
    expect(mockDb.transaction).toHaveBeenCalled()
  })
})
