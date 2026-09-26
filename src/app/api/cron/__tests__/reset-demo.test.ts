/**
 * Tests for the nightly demo reset endpoint (POST /api/cron/reset-demo).
 *
 * The reset TRUNCATES THE DATABASE and reseeds invented people. The one thing
 * these tests exist for is that it can only ever do that on the dedicated demo
 * instance — never on the database holding real AOZ staff and residents.
 */

// --- Mocks ---

// db.execute serves pg_try_advisory_lock + pg_advisory_unlock. Default:
// lock acquired so the route proceeds; tests override per case.
const mockExecute = vi.fn()
vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}))

const mockResetDemoData = vi.fn()
vi.mock('@/lib/demo/reset', async () => ({
  resetDemoData: (...args: unknown[]) => mockResetDemoData(...args),
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
import { POST } from '../reset-demo/route'

// --- Helpers ---

const CRON_SECRET = 'test-cron-secret-123'

function createCronRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {}
  if (authHeader) {
    headers['authorization'] = authHeader
  }
  return new Request('http://localhost/api/cron/reset-demo', {
    method: 'POST',
    headers,
  })
}

const RESET_SUMMARY = {
  residents: 15,
  housingUnits: 5,
  placements: 13,
  incidents: 8,
  demoResidentCode: 'KL-DEMO1',
  tablesWiped: 30,
  demoStaffCode: 'AOZ-DEMO01',
  orgRulesSynced: true,
}

describe('POST /api/cron/reset-demo', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = CRON_SECRET
    process.env.DEMO_ACCESS_ENABLED = 'true'
    mockExecute.mockResolvedValue({ rows: [{ ok: true }] })
    mockResetDemoData.mockResolvedValue(RESET_SUMMARY)
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('authentication', () => {
    it('rejects requests without an authorization header', async () => {
      const response = await POST(createCronRequest())
      expect(response.status).toBe(401)
      expect(mockResetDemoData).not.toHaveBeenCalled()
    })

    it('rejects requests with a wrong bearer token', async () => {
      const response = await POST(createCronRequest('Bearer wrong-secret'))
      expect(response.status).toBe(401)
      expect(mockResetDemoData).not.toHaveBeenCalled()
    })

    it('rejects all requests when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET
      const response = await POST(createCronRequest('Bearer undefined'))
      expect(response.status).toBe(401)
      expect(mockResetDemoData).not.toHaveBeenCalled()
    })
  })

  describe('runs only where the demo is switched on, and only scoped', () => {
    it('refuses while demo access is switched off', async () => {
      delete process.env.DEMO_ACCESS_ENABLED
      const response = await POST(createCronRequest(`Bearer ${CRON_SECRET}`))
      expect((await response.json()).skipped).toBe(true)
      expect(mockResetDemoData).not.toHaveBeenCalled()
    })

    it('resets the invented world, never the whole database', async () => {
      // The main site holds real residents in the same tables. The route must
      // ask for the scoped reset explicitly; a truncate would erase them.
      const response = await POST(createCronRequest(`Bearer ${CRON_SECRET}`))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true, ...RESET_SUMMARY })
      expect(mockResetDemoData).toHaveBeenCalledTimes(1)
      expect(mockResetDemoData).toHaveBeenCalledWith(expect.anything(), { scope: 'scoped' })
    })
  })

  describe('advisory lock', () => {
    it('skips when another reset already holds the lock', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [{ ok: false }] })
      const response = await POST(createCronRequest(`Bearer ${CRON_SECRET}`))
      expect(await response.json()).toEqual({ skipped: true, reason: 'lock-held' })
      expect(mockResetDemoData).not.toHaveBeenCalled()
    })

    it('releases the lock after a successful reset', async () => {
      await POST(createCronRequest(`Bearer ${CRON_SECRET}`))
      // First db.execute call acquires, second releases.
      expect(mockExecute).toHaveBeenCalledTimes(2)
    })

    it('releases the lock even when the reset throws', async () => {
      mockResetDemoData.mockRejectedValueOnce(new Error('boom'))
      const response = await POST(createCronRequest(`Bearer ${CRON_SECRET}`))
      expect(response.status).toBe(500)
      expect(mockExecute).toHaveBeenCalledTimes(2)
    })

    it('returns 500 without leaking details when the reset fails', async () => {
      mockResetDemoData.mockRejectedValueOnce(new Error('db exploded'))
      const response = await POST(createCronRequest(`Bearer ${CRON_SECRET}`))
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ success: false, error: 'Demo reset failed' })
    })
  })
})
