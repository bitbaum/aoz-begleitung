/**
 * Tests for the daily cron notifications endpoint.
 * Verifies auth, incident follow-up detection, and check-in reminder logic.
 */

// --- Mocks ---

const mockIncidentFindMany = vi.fn()
const mockPlacementFindMany = vi.fn()
// db.execute is used for pg_try_advisory_lock + pg_advisory_unlock.
// Default mock: lock acquired so the route proceeds normally; tests can
// override per case. db.execute resolves a pg result object ({ rows }).
const mockExecute = vi.fn().mockResolvedValue({ rows: [{ ok: true }] })
vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: {
      incident: {
        findMany: (...args: unknown[]) => mockIncidentFindMany(...args),
      },
      placement: {
        findMany: (...args: unknown[]) => mockPlacementFindMany(...args),
      },
    },
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}))

const mockNotifyStaff = vi.fn()
vi.mock('@/lib/email', async () => ({
  notifyStaff: (...args: unknown[]) => mockNotifyStaff(...args),
  incidentFollowUpReminder: vi.fn().mockReturnValue({
    subject: '[AOZ Housing] 1 überfällige Nachverfolgungen',
    html: '<p>test incidents</p>',
  }),
  checkInReminder: vi.fn().mockReturnValue({
    subject: '[AOZ Housing] 1 Check-ins überfällig',
    html: '<p>test check-ins</p>',
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

// --- Import after mocks ---
import { GET } from '../notifications/route'
import { PgDialect } from 'drizzle-orm/pg-core'

// --- Helpers ---

const CRON_SECRET = 'test-cron-secret-123'

function createCronRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {}
  if (authHeader) {
    headers['authorization'] = authHeader
  }
  return new Request('http://localhost:3001/api/cron/notifications', { headers })
}

// Store original env and restore after tests
const originalEnv = process.env.CRON_SECRET

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = CRON_SECRET
  mockIncidentFindMany.mockResolvedValue([])
  mockPlacementFindMany.mockResolvedValue([])
})

afterAll(() => {
  process.env.CRON_SECRET = originalEnv
})

// =============================================================================
// Auth
// =============================================================================

describe('cron auth', () => {
  test('returns 401 without authorization header', async () => {
    const res = await GET(createCronRequest())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  test('returns 401 with wrong Bearer token', async () => {
    const res = await GET(createCronRequest('Bearer wrong-secret'))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  test('returns 401 without Bearer prefix', async () => {
    const res = await GET(createCronRequest(CRON_SECRET))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  test('returns 401 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Unauthorized')
  })

  test('returns 200 with valid Bearer token', async () => {
    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})

// =============================================================================
// Incident follow-up notifications
// =============================================================================

describe('overdue incident follow-ups', () => {
  test('sends notification when overdue incidents exist', async () => {
    mockNotifyStaff.mockResolvedValue(true)
    mockIncidentFindMany.mockResolvedValue([
      {
        id: 'inc-001',
        description: 'Lärmbeschwerde nachts',
        severity: 'HIGH',
        nextFollowUpDate: new Date('2026-02-20'),
        housingUnit: { code: 'WE-001' },
      },
    ])

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.incidents).toBe(1)
    expect(mockNotifyStaff).toHaveBeenCalled()
  })

  test('queries for MEDIUM, HIGH, and CRITICAL severity incidents', async () => {
    mockIncidentFindMany.mockResolvedValue([])

    await GET(createCronRequest(`Bearer ${CRON_SECRET}`))

    // The where arg is now a drizzle expression; render it to SQL to keep the
    // assertion about the severity filter itself.
    expect(mockIncidentFindMany).toHaveBeenCalledTimes(1)
    const [args] = mockIncidentFindMany.mock.calls[0] as [{ where: never }]
    const rendered = new PgDialect().sqlToQuery(args.where)
    expect(rendered.sql).toContain('"severity" in (')
    expect(rendered.params).toEqual(expect.arrayContaining(['MEDIUM', 'HIGH', 'CRITICAL']))
  })

  test('does not send when no overdue incidents', async () => {
    mockIncidentFindMany.mockResolvedValue([])

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(body.incidents).toBe(0)
    // notifyStaff should not be called for incidents (may still be called for check-ins)
  })

  test('sets incidents count to 0 when notifyStaff returns false', async () => {
    mockNotifyStaff.mockResolvedValue(false)
    mockIncidentFindMany.mockResolvedValue([
      {
        id: 'inc-001',
        description: 'Test',
        severity: 'CRITICAL',
        nextFollowUpDate: new Date('2026-02-20'),
        housingUnit: { code: 'WE-001' },
      },
    ])

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(body.incidents).toBe(0)
  })
})

// =============================================================================
// Check-in reminder notifications
// =============================================================================

describe('overdue check-in reminders', () => {
  test('sends notification for overdue INTENSIVE resident (>7 days)', async () => {
    mockNotifyStaff.mockResolvedValue(true)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    mockPlacementFindMany.mockResolvedValue([
      {
        startDate: new Date('2026-01-01'),
        resident: { code: 'RES-001', supportLevel: 'INTENSIVE' },
        checkIns: [{ createdAt: tenDaysAgo }],
      },
    ])

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(body.checkIns).toBe(1)
    expect(mockNotifyStaff).toHaveBeenCalled()
  })

  test('never reminds staff about a placeholder nobody is serving', async () => {
    // Live 2026-10-02: placeholder profiles sat in every check-in queue.
    mockNotifyStaff.mockResolvedValue(true)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    mockPlacementFindMany.mockResolvedValue([
      {
        startDate: new Date('2026-01-01'),
        resident: { code: 'KL-AMIR', supportLevel: 'INTENSIVE', isPlaceholder: true },
        checkIns: [{ createdAt: tenDaysAgo }],
      },
    ])

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(body.checkIns).toBe(0)
  })

  test('does not flag INTENSIVE resident within threshold (<=7 days)', async () => {
    mockNotifyStaff.mockResolvedValue(true)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    mockPlacementFindMany.mockResolvedValue([
      {
        startDate: new Date('2026-01-01'),
        resident: { code: 'RES-001', supportLevel: 'INTENSIVE' },
        checkIns: [{ createdAt: threeDaysAgo }],
      },
    ])

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(body.checkIns).toBe(0)
  })

  test('sends notification for overdue ELEVATED resident (>14 days)', async () => {
    mockNotifyStaff.mockResolvedValue(true)
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
    mockPlacementFindMany.mockResolvedValue([
      {
        startDate: new Date('2026-01-01'),
        resident: { code: 'RES-002', supportLevel: 'ELEVATED' },
        checkIns: [{ createdAt: twentyDaysAgo }],
      },
    ])

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(body.checkIns).toBe(1)
  })

  test('sends notification for overdue STANDARD resident (>28 days)', async () => {
    mockNotifyStaff.mockResolvedValue(true)
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
    mockPlacementFindMany.mockResolvedValue([
      {
        startDate: new Date('2026-01-01'),
        resident: { code: 'RES-003', supportLevel: 'STANDARD' },
        checkIns: [{ createdAt: fortyDaysAgo }],
      },
    ])

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(body.checkIns).toBe(1)
  })

  test('flags STANDARD resident at 29 days (SSOT threshold is 28, not 30)', async () => {
    mockNotifyStaff.mockResolvedValue(true)
    const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
    mockPlacementFindMany.mockResolvedValue([
      {
        startDate: new Date('2026-01-01'),
        resident: { code: 'RES-003', supportLevel: 'STANDARD' },
        checkIns: [{ createdAt: twentyNineDaysAgo }],
      },
    ])

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(body.checkIns).toBe(1)
  })

  test('uses startDate when no check-ins exist', async () => {
    mockNotifyStaff.mockResolvedValue(true)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    mockPlacementFindMany.mockResolvedValue([
      {
        startDate: sixtyDaysAgo,
        resident: { code: 'RES-004', supportLevel: 'STANDARD' },
        checkIns: [],
      },
    ])

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(body.checkIns).toBe(1)
  })

  test('does not send when no overdue residents', async () => {
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    mockPlacementFindMany.mockResolvedValue([
      {
        startDate: new Date('2026-01-01'),
        resident: { code: 'RES-001', supportLevel: 'STANDARD' },
        checkIns: [{ createdAt: recentDate }],
      },
    ])

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(body.checkIns).toBe(0)
  })
})

// =============================================================================
// Error handling
// =============================================================================

describe('error handling', () => {
  test('returns success with error message on DB failure', async () => {
    mockIncidentFindMany.mockRejectedValue(new Error('DB connection lost'))

    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.errors).toContain('DB connection lost')
  })

  test('returns timestamp in response', async () => {
    const res = await GET(createCronRequest(`Bearer ${CRON_SECRET}`))
    const body = await res.json()

    expect(body.timestamp).toBeDefined()
    // Should be a valid ISO date
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
  })
})
