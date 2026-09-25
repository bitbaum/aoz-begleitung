/**
 * Tests for the demo login endpoint (POST /api/auth/demo).
 *
 * Tests: role validation, the DEMO_ACCESS_ENABLED gate, rate limiting,
 * session issuance for both roles, and — the regression this file exists
 * for — that the STAFF demo works in production. An earlier guard refused
 * role=staff whenever NODE_ENV was 'production', which left the login page
 * showing a staff demo button that could never succeed.
 */

import { NextRequest } from 'next/server'

// --- Mocks ---

const mockLoginByCode = vi.fn()
const mockSetSessionCookie = vi.fn()
vi.mock('@/lib/auth', async () => ({
  loginByCode: (...args: unknown[]) => mockLoginByCode(...args),
  setSessionCookie: (...args: unknown[]) => mockSetSessionCookie(...args),
}))

const mockCheckRateLimit = vi.fn()
const mockRecordLoginAttempt = vi.fn()
vi.mock('@/lib/auth/rate-limit', async (importOriginal) => ({
  // Re-export the REAL client-IP reader rather than restating it: a mocked
  // copy is how the spoofable first-hop version survived here after the
  // module was fixed.
  getClientIp: (await importOriginal<typeof import('@/lib/auth/rate-limit')>()).getClientIp,
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  recordLoginAttempt: (...args: unknown[]) => mockRecordLoginAttempt(...args),
}))

const mockSetResidentCookie = vi.fn()
vi.mock('@/lib/portal-auth', async () => ({
  setResidentCookie: (...args: unknown[]) => mockSetResidentCookie(...args),
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

// A door is offered only when its ACCOUNT exists, so the endpoint reads the
// database. Config presence proves nothing now that codes are derived: it
// would offer five buttons on an instance where the seed never ran.
const mockUserFindMany = vi.fn()
const mockResidentFindFirst = vi.fn()
vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: {
      user: { findMany: (...args: unknown[]) => mockUserFindMany(...args) },
      resident: { findFirst: (...args: unknown[]) => mockResidentFindFirst(...args) },
    },
  },
}))

// --- Import after mocks ---
import { POST, GET } from '../demo/route'
import { demoStaffDoors } from '@/lib/demo/roles'

// --- Helpers ---

const STAFF_CODE = 'AOZH-DEMO01'
const RESIDENT_CODE = 'RES-001'

function createDemoRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const STAFF_USER = {
  id: 'demo-user-id',
  email: '',
  name: 'Demo-Zugang',
  role: 'ADMIN' as const,
  scope: 'ALL_DOMAINS' as const,
  isSystemAdmin: true,
}

describe('POST /api/auth/demo', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DEMO_ACCESS_ENABLED = 'true'
    process.env.DEMO_STAFF_CODE = STAFF_CODE
    process.env.DEMO_RESIDENT_CODE = RESIDENT_CODE
    mockCheckRateLimit.mockReturnValue({ allowed: true })
    mockLoginByCode.mockResolvedValue({
      success: true,
      type: 'staff',
      user: STAFF_USER,
    })
    // Every staff door's account exists unless a test says otherwise. The
    // where arg is now a drizzle expression, so derive the codes from the same
    // source the route does instead of picking the Prisma `in` list apart.
    mockUserFindMany.mockImplementation(async () =>
      demoStaffDoors().map((door) => ({ code: door.code })),
    )
    // isPlaceholder MATTERS now: the resident door opens only while the
    // profile is still a placeholder, so a claimed one closes it.
    mockResidentFindFirst.mockResolvedValue({ id: 'demo-resident-id', isPlaceholder: true })
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('validation and configuration', () => {
    it('is ALWAYS disabled in production, even when DEMO_ACCESS_ENABLED=true', async () => {
      // SECURITY: This is the hard gate preventing demo access in production.
      // Demo logins create real sessions with admin access, so they must never
      // be enabled where real data exists.
      const env = process.env as Record<string, string | undefined>
      const previous = env.NODE_ENV
      env.NODE_ENV = 'production'
      process.env.DEMO_ACCESS_ENABLED = 'true' // Explicitly try to enable it

      try {
        // GET endpoint should report no doors
        const getResponse = await GET()
        const getBody = await getResponse.json()
        expect(getBody.data.doors).toEqual([])
        expect(getBody.data.staff).toBe(false)
        expect(getBody.data.resident).toBe(false)

        // POST endpoint should refuse
        const postResponse = await POST(createDemoRequest({ role: 'ADMIN' }))
        expect(postResponse.status).toBe(404)
        expect(mockLoginByCode).not.toHaveBeenCalled()
        expect(mockSetSessionCookie).not.toHaveBeenCalled()
      } finally {
        env.NODE_ENV = previous
      }
    })

    it('rejects an unknown role', async () => {
      // 404, not 400: "no such role" and "that door is not on offer here" are
      // the same fact to the caller, and answering them differently would tell
      // a prober which roles exist.
      const response = await POST(createDemoRequest({ role: 'superadmin' }))
      expect(response.status).toBe(404)
      expect(mockLoginByCode).not.toHaveBeenCalled()
    })

    it('opens a door for every staff role, not just one', async () => {
      // The reason this endpoint changed: the product a Jobcoach sees and the
      // product Leitung sees are different applications.
      const response = await GET()
      const body = await response.json()
      const ids = body.data.doors.map((door: { id: string }) => door.id)

      expect(ids).toEqual(
        expect.arrayContaining([
          'ADMIN',
          'BETREUUNG',
          'SOZIALARBEIT',
          'JOBCOACH',
          'FREIWILLIGENARBEIT',
          'resident',
        ]),
      )
    })

    it('offers no door whose account is missing', async () => {
      // The rule the old version stated and this one keeps: a button appears
      // only when pressing it can succeed.
      mockUserFindMany.mockResolvedValue([])
      mockResidentFindFirst.mockResolvedValue(null)

      const response = await GET()
      const body = await response.json()

      expect(body.data.doors).toEqual([])
    })

    it('still answers the old role=staff identifier', async () => {
      // Old clients and bookmarks send it; breaking them would retire a door
      // that worked yesterday for no reason the user could act on.
      const response = await POST(createDemoRequest({ role: 'staff' }))
      expect(response.status).toBe(200)
    })

    it('returns 404 when demo access is disabled', async () => {
      process.env.DEMO_ACCESS_ENABLED = 'false'
      const response = await POST(createDemoRequest({ role: 'staff' }))
      expect(response.status).toBe(404)
      expect(mockLoginByCode).not.toHaveBeenCalled()
    })

    it('returns 404 when the account behind the requested door is missing', async () => {
      // What closes a door is now the ACCOUNT, not an env var: codes are
      // derived, so unsetting `DEMO_STAFF_CODE` only changes which code the
      // Leitung door uses. An instance where the seed never ran must still
      // offer nothing rather than five buttons that all answer "invalid code".
      mockUserFindMany.mockResolvedValue([])

      const response = await POST(createDemoRequest({ role: 'ADMIN' }))

      expect(response.status).toBe(404)
      expect(mockLoginByCode).not.toHaveBeenCalled()
    })

    it('keeps the legacy env code as the Leitung door when one is set', async () => {
      // A deployment already running DEMO_STAFF_CODE has that code in
      // circulation; retiring it silently would break the door people know.
      await POST(createDemoRequest({ role: 'ADMIN' }))

      expect(mockLoginByCode).toHaveBeenCalledWith(STAFF_CODE, expect.any(String))
    })
  })

  describe('staff demo', () => {
    it('issues a staff session in non-production environments', async () => {
      const response = await POST(createDemoRequest({ role: 'staff' }))
      const body = await response.json()
      expect(body).toEqual({ success: true, type: 'staff' })
      expect(mockLoginByCode).toHaveBeenCalledWith(STAFF_CODE, expect.any(String))
      expect(mockSetSessionCookie).toHaveBeenCalledWith(STAFF_USER)
    })

    it('BLOCKS staff demo in production (security: prevents unauthorized admin access)', async () => {
      // This is the regression test for the security vulnerability where demo
      // logins granted system admin access in production against real data.
      const env = process.env as Record<string, string | undefined>
      const previous = env.NODE_ENV
      env.NODE_ENV = 'production'
      try {
        const response = await POST(createDemoRequest({ role: 'staff' }))
        const body = await response.json()
        expect(response.status).toBe(404)
        expect(mockSetSessionCookie).not.toHaveBeenCalled()
        expect(mockLoginByCode).not.toHaveBeenCalled()
      } finally {
        env.NODE_ENV = previous
      }
    })
  })

  describe('resident demo', () => {
    it('issues a resident session in non-production environments', async () => {
      mockLoginByCode.mockResolvedValue({
        success: true,
        type: 'resident',
        code: RESIDENT_CODE,
      })
      const response = await POST(createDemoRequest({ role: 'resident' }))
      const body = await response.json()
      expect(body).toEqual({ success: true, type: 'resident' })
      expect(mockLoginByCode).toHaveBeenCalledWith(RESIDENT_CODE, expect.any(String))
      expect(mockSetResidentCookie).toHaveBeenCalledWith(RESIDENT_CODE)
    })

    it('BLOCKS resident demo in production', async () => {
      mockLoginByCode.mockResolvedValue({
        success: true,
        type: 'resident',
        code: RESIDENT_CODE,
      })
      const env = process.env as Record<string, string | undefined>
      const previous = env.NODE_ENV
      env.NODE_ENV = 'production'
      try {
        const response = await POST(createDemoRequest({ role: 'resident' }))
        expect(response.status).toBe(404)
        expect(mockSetResidentCookie).not.toHaveBeenCalled()
        expect(mockLoginByCode).not.toHaveBeenCalled()
      } finally {
        env.NODE_ENV = previous
      }
    })
  })

  describe('throttling', () => {
    it('refuses when the IP is rate-limited', async () => {
      mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfter: 42 })
      const response = await POST(createDemoRequest({ role: 'staff' }))
      expect(response.status).toBe(429)
      expect(mockLoginByCode).not.toHaveBeenCalled()
    })

    it('counts successful demo sessions against the rate limit', async () => {
      await POST(createDemoRequest({ role: 'staff' }))
      expect(mockRecordLoginAttempt).toHaveBeenCalledTimes(1)
    })
  })

  describe('failures', () => {
    it('returns 401 when the configured code does not resolve to an account', async () => {
      mockLoginByCode.mockResolvedValue({ success: false, error: 'Ungültiger Code' })
      const response = await POST(createDemoRequest({ role: 'staff' }))
      expect(response.status).toBe(401)
    })
  })

  describe('GET availability (drives the login page buttons)', () => {
    it('reports both kinds of door when the accounts are there', async () => {
      const body = await (await GET()).json()
      expect(body.success).toBe(true)
      expect(body.data.staff).toBe(true)
      expect(body.data.resident).toBe(true)
    })

    it('gives every door a label a person can read', async () => {
      // A button reading "FREIWILLIGENARBEIT" is a database value on screen.
      const body = await (await GET()).json()
      const labels = body.data.doors.map((door: { label: string }) => door.label)

      // 'Systemadministration', not 'Leitung'. This assertion used to pin the
      // old ADMIN label, which named an organisational rank AOZ genuinely has
      // for the one role that does not confer it — see role-labels.test.ts.
      // The rule the test is really about is that a door never shows a raw
      // enum value; the specific words come from ROLE_LABELS.
      expect(labels).toEqual(
        expect.arrayContaining(['Systemadministration', 'Betreuung', 'Jobcoach']),
      )
      expect(labels.every((label: string) => label === label.trim() && label.length > 0)).toBe(true)
      expect(labels).not.toContain('FREIWILLIGENARBEIT')
    })

    it('hides the staff doors when their accounts are gone', async () => {
      mockUserFindMany.mockResolvedValue([])
      const body = await (await GET()).json()

      expect(body.data.staff).toBe(false)
      expect(body.data.resident).toBe(true)
    })

    it('resident stays available without an env code (scope default resolves one)', async () => {
      delete process.env.DEMO_RESIDENT_CODE
      const body = await (await GET()).json()
      expect(body.data.resident).toBe(true)
    })

    it('reports nothing when demo access is disabled', async () => {
      process.env.DEMO_ACCESS_ENABLED = 'false'
      const body = await (await GET()).json()
      expect(body.data).toEqual({ doors: [], staff: false, resident: false })
    })
  })
})

/**
 * The anonymous door dies the moment its profile is claimed.
 *
 * `DEMO_RESIDENT_CODE` points at a PLACEHOLDER — a seeded profile with nobody
 * behind it. That is what makes a no-account public login acceptable at all.
 *
 * But a placeholder exists in order to be TAKEN OVER. The day the person who
 * moves in registers with that code, `isPlaceholder` clears and the row becomes
 * theirs: same id, same code, same env var. Without this check the public door
 * would silently become a door onto a real client's flat, roommates, expenses
 * and reports — no config changed, no error raised, the button still working.
 *
 * Config discipline cannot prevent it, because the event that causes it is a
 * resident registering, and nobody is watching an env var for that. So the
 * guard reads the same fact the "Platzhalter" marker does.
 */
describe('the resident door and a claimed profile', () => {
  beforeEach(() => {
    process.env.DEMO_ACCESS_ENABLED = 'true'
    process.env.DEMO_RESIDENT_CODE = RESIDENT_CODE
    mockCheckRateLimit.mockReturnValue({ allowed: true })
  })

  it('is offered while the profile is an unclaimed placeholder', async () => {
    mockResidentFindFirst.mockResolvedValue({ id: 'r1', isPlaceholder: true })
    const body = await (await GET()).json()
    expect(body.data.resident).toBe(true)
  })

  it('disappears once a real person has claimed it', async () => {
    mockResidentFindFirst.mockResolvedValue({ id: 'r1', isPlaceholder: false })
    const body = await (await GET()).json()
    expect(body.data.resident).toBe(false)
    expect(body.data.doors.map((d: { id: string }) => d.id)).not.toContain('resident')
  })

  it('REFUSES the login, not merely the button', async () => {
    // Hiding a button is not a gate: the POST is the thing that issues a
    // session, and anyone can send it.
    mockResidentFindFirst.mockResolvedValue({ id: 'r1', isPlaceholder: false })
    const request = new NextRequest('http://localhost/api/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ role: 'resident' }),
      headers: { 'content-type': 'application/json' },
    })
    const response = await POST(request)
    expect(response.status).toBe(404)
    expect(mockSetResidentCookie).not.toHaveBeenCalled()
  })

  it('still refuses when the profile does not exist at all', async () => {
    mockResidentFindFirst.mockResolvedValue(null)
    const body = await (await GET()).json()
    expect(body.data.resident).toBe(false)
  })
})
