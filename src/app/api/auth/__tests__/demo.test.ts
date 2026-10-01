/**
 * Tests for the quick-access endpoint (GET/POST /api/auth/demo).
 *
 * The site is fully real (2026-10-01): the staff buttons sign in as NAMED
 * REAL accounts listed in QUICK_ACCESS_STAFF_CODES, and the client button
 * signs in as an unclaimed placeholder. Under test: which doors are offered,
 * that POST opens only an offered door, the master switch, rate limiting, and
 * that the client door dies once its profile is claimed.
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

/**
 * The staff table as the route would see it. The mock applies the query's
 * own condition (requested codes AND active) so a test can prove an inactive
 * or unknown account offers nothing — returning a fixed list would make the
 * "inactive" case pass by construction.
 */
interface StaffRow {
  code: string
  name: string
  role: string
  active: boolean
}
let staffTable: StaffRow[] = []
const mockResidentFindFirst = vi.fn()
vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: {
      user: {
        findMany: async () => {
          const requested = new Set(
            (process.env.QUICK_ACCESS_STAFF_CODES ?? '').split(',').map((c) => c.trim()),
          )
          return staffTable
            .filter((row) => row.active && requested.has(row.code))
            .map(({ code, name, role }) => ({ code, name, role }))
        },
      },
      resident: { findFirst: (...args: unknown[]) => mockResidentFindFirst(...args) },
    },
  },
}))

// --- Import after mocks ---
import { POST, GET } from '../demo/route'
import { quickAccessName, quickAccessStaffCodes } from '@/lib/quick-access/config'

// --- Helpers ---

const SIMON = { code: 'AOZ-4Z3GBR', name: 'Simon Berger', role: 'JOBCOACH', active: true }
const LENA = { code: 'AOZ-HWGA8G', name: 'Lena Muster', role: 'BETREUUNG', active: true }
const GONE = { code: 'AOZ-PMCUTD', name: 'Ex Kollegin', role: 'SOZIALARBEIT', active: false }
const RESIDENT_CODE = 'KL-PLACE1'

function post(role: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
}

async function doors(): Promise<{ id: string; label: string }[]> {
  return (await (await GET()).json()).data.doors
}

const STAFF_USER = {
  id: 'simon-id',
  email: '',
  name: 'Simon Berger',
  role: 'JOBCOACH' as const,
  scope: 'OWN_DOMAIN' as const,
  isSystemAdmin: false,
}

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  process.env = { ...originalEnv }
  delete process.env.QUICK_ACCESS_ENABLED
  process.env.DEMO_ACCESS_ENABLED = 'true'
  // Env order deliberately differs from table order: the env decides.
  process.env.QUICK_ACCESS_STAFF_CODES = `${SIMON.code}, ${LENA.code},${GONE.code},AOZ-NOPE00`
  process.env.DEMO_RESIDENT_CODE = RESIDENT_CODE
  staffTable = [LENA, GONE, SIMON]
  mockCheckRateLimit.mockReturnValue({ allowed: true })
  mockLoginByCode.mockResolvedValue({ success: true, type: 'staff', user: STAFF_USER })
  mockResidentFindFirst.mockResolvedValue({ id: 'r1', isPlaceholder: true })
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('quick-access configuration', () => {
  it('parses the code list: trimmed, uppercased, blanks and duplicates dropped', () => {
    process.env.QUICK_ACCESS_STAFF_CODES = ' aoz-aaaaaa ,,AOZ-BBBBBB, aoz-aaaaaa '
    expect(quickAccessStaffCodes()).toEqual(['AOZ-AAAAAA', 'AOZ-BBBBBB'])
  })

  it('shortens a name to first name and last initial', () => {
    expect(quickAccessName('Simon Berger')).toBe('Simon B.')
    expect(quickAccessName('  Anna Maria  von Wil ')).toBe('Anna W.')
    expect(quickAccessName('Georgy')).toBe('Georgy')
  })
})

describe('GET — which doors are offered', () => {
  it('offers each configured ACTIVE account as a named door, in env order', async () => {
    expect(await doors()).toEqual([
      { id: 'staff-1', label: 'Simon B. · Jobcoach' },
      { id: 'staff-2', label: 'Lena M. · Betreuung' },
      { id: 'resident', label: expect.any(String) },
    ])
  })

  it('offers no door for an inactive account or a code that does not resolve', async () => {
    const ids = (await doors()).map((door) => door.id)
    expect(ids).not.toContain(GONE.code)
    expect(ids).not.toContain('AOZ-NOPE00')
  })

  it('offers no staff door when no codes are configured', async () => {
    delete process.env.QUICK_ACCESS_STAFF_CODES
    expect((await doors()).map((door) => door.id)).toEqual(['resident'])
  })

  it('reports nothing when the master switch is off', async () => {
    process.env.DEMO_ACCESS_ENABLED = 'false'
    const body = await (await GET()).json()
    expect(body.data).toEqual({ doors: [], staff: false, resident: false })
  })

  it('accepts the new switch name as well as the old one', async () => {
    delete process.env.DEMO_ACCESS_ENABLED
    process.env.QUICK_ACCESS_ENABLED = 'true'
    expect((await doors()).length).toBeGreaterThan(0)
  })

  it('never sends a door the server-side code field', async () => {
    for (const door of await doors()) expect(Object.keys(door).sort()).toEqual(['id', 'label'])
  })

  it('publishes no login code anywhere in the response', async () => {
    // GET answers anyone who loads /login. A published staff code could be
    // claimed at /register by a stranger before its colleague does.
    const body = JSON.stringify(await (await GET()).json())
    expect(body).not.toContain(SIMON.code)
    expect(body).not.toContain(LENA.code)
  })
})

describe('POST — only a door GET would offer', () => {
  it('signs in as the named account behind an offered door', async () => {
    const response = await POST(post('staff-1'))
    expect(await response.json()).toEqual({ success: true, type: 'staff' })
    expect(mockLoginByCode).toHaveBeenCalledWith(SIMON.code, expect.any(String))
    expect(mockSetSessionCookie).toHaveBeenCalledWith(STAFF_USER)
  })

  it('refuses a configured code sent as the id — ids are opaque', async () => {
    const response = await POST(post(SIMON.code))
    expect(response.status).toBe(404)
    expect(mockLoginByCode).not.toHaveBeenCalled()
  })

  it('refuses a real code that is not on offer', async () => {
    // A valid staff code that simply is not configured: if POST used the id
    // as a code, this endpoint would sign anyone in with any guessable code.
    staffTable.push({ code: 'AOZ-OTHER1', name: 'Nicht Gelistet', role: 'ADMIN', active: true })
    const response = await POST(post('AOZ-OTHER1'))
    expect(response.status).toBe(404)
    expect(mockLoginByCode).not.toHaveBeenCalled()
  })

  it('refuses an inactive account even though its code is configured', async () => {
    const response = await POST(post(GONE.code))
    expect(response.status).toBe(404)
    expect(mockLoginByCode).not.toHaveBeenCalled()
  })

  it('refuses the retired role identifiers', async () => {
    for (const role of ['staff', 'ADMIN', 'JOBCOACH', '', 42]) {
      const response = await POST(post(role))
      expect(response.status).toBe(404)
    }
    expect(mockLoginByCode).not.toHaveBeenCalled()
  })

  it('refuses everything when the master switch is off', async () => {
    process.env.DEMO_ACCESS_ENABLED = 'false'
    const response = await POST(post('staff-1'))
    expect(response.status).toBe(404)
    expect(mockLoginByCode).not.toHaveBeenCalled()
  })

  it('returns 401 when the login itself fails', async () => {
    mockLoginByCode.mockResolvedValue({ success: false, error: 'Ungültiger Code' })
    const response = await POST(post('staff-1'))
    expect(response.status).toBe(401)
  })
})

describe('throttling', () => {
  it('refuses when the IP is rate-limited', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfter: 42 })
    const response = await POST(post('staff-1'))
    expect(response.status).toBe(429)
    expect(mockLoginByCode).not.toHaveBeenCalled()
  })

  it('counts successful sessions against the rate limit', async () => {
    await POST(post('staff-1'))
    expect(mockRecordLoginAttempt).toHaveBeenCalledTimes(1)
  })
})

/**
 * The anonymous client door dies the moment its profile is claimed.
 *
 * `DEMO_RESIDENT_CODE` points at a PLACEHOLDER — a seeded profile with nobody
 * behind it. A placeholder exists in order to be TAKEN OVER; the day the
 * person registers with that code, `isPlaceholder` clears and the row becomes
 * theirs. Without this check the public door would silently become a door
 * onto a real client's flat.
 */
describe('the client door', () => {
  it('signs in as the placeholder while it is unclaimed', async () => {
    mockLoginByCode.mockResolvedValue({ success: true, type: 'resident', code: RESIDENT_CODE })
    const response = await POST(post('resident'))
    expect(await response.json()).toEqual({ success: true, type: 'resident' })
    expect(mockLoginByCode).toHaveBeenCalledWith(RESIDENT_CODE, expect.any(String))
    expect(mockSetResidentCookie).toHaveBeenCalledWith(RESIDENT_CODE)
  })

  it('disappears once a real person has claimed it', async () => {
    mockResidentFindFirst.mockResolvedValue({ id: 'r1', isPlaceholder: false })
    expect((await doors()).map((d) => d.id)).not.toContain('resident')
  })

  it('REFUSES the login once claimed, not merely the button', async () => {
    mockResidentFindFirst.mockResolvedValue({ id: 'r1', isPlaceholder: false })
    const response = await POST(post('resident'))
    expect(response.status).toBe(404)
    expect(mockSetResidentCookie).not.toHaveBeenCalled()
  })

  it('is not offered for a code with no profile, or with no code configured', async () => {
    mockResidentFindFirst.mockResolvedValue(null)
    expect((await doors()).map((d) => d.id)).not.toContain('resident')
    delete process.env.DEMO_RESIDENT_CODE
    mockResidentFindFirst.mockResolvedValue({ id: 'r1', isPlaceholder: true })
    expect((await doors()).map((d) => d.id)).not.toContain('resident')
  })
})
