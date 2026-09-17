/**
 * Tests for unified code-based login API route (POST /api/auth/login)
 *
 * Tests: successful staff/resident login, missing code, rate limit,
 * invalid credentials, server error, IP extraction, code normalisation
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
const mockClearLoginAttempts = vi.fn()
vi.mock('@/lib/auth/rate-limit', async (importOriginal) => ({
  // Re-export the REAL client-IP reader rather than restating it: a mocked
  // copy is how the spoofable first-hop version survived here after the
  // module was fixed.
  getClientIp: (await importOriginal<typeof import('@/lib/auth/rate-limit')>()).getClientIp,
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  recordLoginAttempt: (...args: unknown[]) => mockRecordLoginAttempt(...args),
  clearLoginAttempts: (...args: unknown[]) => mockClearLoginAttempts(...args),
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

const mockCookieSet = vi.fn()
vi.mock('next/headers', async () => ({
  cookies: vi.fn().mockResolvedValue({
    set: (...args: unknown[]) => mockCookieSet(...args),
  }),
}))

// --- Import after mocks ---
import { POST } from '../login/route'

// --- Helpers ---

function createJsonRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): NextRequest {
  return new NextRequest('http://localhost:3001/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  })
}

const STAFF_USER = {
  id: 'user-1',
  email: 'admin@aoz.ch',
  name: 'Test Admin',
  role: 'ADMIN' as const,
  scope: 'ALL_DOMAINS' as const,
  isSystemAdmin: true,
}

// --- Tests ---

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: rate limit allows
    mockCheckRateLimit.mockReturnValue({ allowed: true })
  })

  test('returns staff user data on successful staff login', async () => {
    mockLoginByCode.mockResolvedValue({ success: true, type: 'staff', user: STAFF_USER })
    mockSetSessionCookie.mockResolvedValue(undefined)

    const req = createJsonRequest({ code: 'AOZ-ABC123' }, { 'x-forwarded-for': '10.0.0.1' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.type).toBe('staff')
    expect(body.user).toEqual(STAFF_USER)

    expect(mockLoginByCode).toHaveBeenCalledWith('AOZ-ABC123', '10.0.0.1')
    expect(mockSetSessionCookie).toHaveBeenCalledWith(STAFF_USER)
    expect(mockClearLoginAttempts).toHaveBeenCalledWith('10.0.0.1')
  })

  test('returns resident data on successful resident login', async () => {
    mockLoginByCode.mockResolvedValue({ success: true, type: 'resident', code: 'RES-XYZ789' })

    const req = createJsonRequest({ code: 'RES-XYZ789' }, { 'x-forwarded-for': '10.0.0.2' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.type).toBe('resident')
    expect(body.code).toBe('RES-XYZ789')

    // Resident login sets cookie, not staff session
    expect(mockSetSessionCookie).not.toHaveBeenCalled()
    expect(mockCookieSet).toHaveBeenCalledWith(
      'resident_code',
      'RES-XYZ789',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    )
  })

  test('returns 401 on invalid code', async () => {
    mockLoginByCode.mockResolvedValue({
      success: false,
      error: 'Ungültiger Code',
    })

    const req = createJsonRequest({ code: 'AOZ-WRONG1' }, { 'x-forwarded-for': '10.0.0.3' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Ungültiger Code')
    expect(mockSetSessionCookie).not.toHaveBeenCalled()
  })

  test('returns 400 when code is missing', async () => {
    const req = createJsonRequest({})
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Code erforderlich')
    expect(mockLoginByCode).not.toHaveBeenCalled()
  })

  test('returns 400 when code is not a string', async () => {
    const req = createJsonRequest({ code: 12345 })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Code erforderlich')
  })

  test('returns 400 (not 500) when the body is not valid JSON', async () => {
    // A truncated/aborted request body used to reach request.json() and throw,
    // producing a 500 and an ERROR log for what is a client-side fault.
    const req = new NextRequest('http://localhost:3001/api/auth/login', {
      method: 'POST',
      body: '{"code":',
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(mockLoginByCode).not.toHaveBeenCalled()
  })

  test('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfter: 120 })

    const req = createJsonRequest({ code: 'AOZ-ABC123' }, { 'x-forwarded-for': '10.0.0.5' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.success).toBe(false)
    expect(body.retryAfter).toBe(120)
    expect(mockLoginByCode).not.toHaveBeenCalled()
  })

  test('returns 500 on unexpected server error', async () => {
    mockLoginByCode.mockRejectedValue(new Error('Database connection failed'))

    const req = createJsonRequest({ code: 'AOZ-ABC123' }, { 'x-forwarded-for': '10.0.0.6' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Ein Fehler ist aufgetreten')
  })

  test('trims and uppercases the code before login', async () => {
    mockLoginByCode.mockResolvedValue({ success: true, type: 'staff', user: STAFF_USER })
    mockSetSessionCookie.mockResolvedValue(undefined)

    const req = createJsonRequest({ code: '  aoz-abc123  ' })
    await POST(req)

    expect(mockLoginByCode).toHaveBeenCalledWith('AOZ-ABC123', expect.any(String))
  })

  // Caddy APPENDS the real peer address, so the last hop is the only one we
  // wrote; every earlier hop is a string the caller typed.
  test('keys the login throttle on the last x-forwarded-for hop, ignoring the spoofable leading one', async () => {
    mockLoginByCode.mockResolvedValue({ success: true, type: 'staff', user: STAFF_USER })
    mockSetSessionCookie.mockResolvedValue(undefined)

    const req = createJsonRequest(
      { code: 'AOZ-ABC123' },
      { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
    )
    await POST(req)

    expect(mockCheckRateLimit).toHaveBeenCalledWith('10.0.0.1')
    expect(mockLoginByCode).toHaveBeenCalledWith('AOZ-ABC123', '10.0.0.1')
  })

  // The regression guard: varying the leading hop per request used to hand the
  // caller a fresh bucket every time, so the throttle could never trip.
  test('a caller varying the leading hop still lands in one throttle bucket', async () => {
    mockLoginByCode.mockResolvedValue({ success: false, error: 'Ungültiger Code' })
    mockSetSessionCookie.mockResolvedValue(undefined)
    mockCheckRateLimit.mockClear()

    for (const spoofed of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) {
      await POST(
        createJsonRequest(
          { code: 'AOZ-WRONG1' },
          { 'x-forwarded-for': `${spoofed}, 198.51.100.9` },
        ),
      )
    }

    expect(mockCheckRateLimit.mock.calls.map((call) => call[0])).toEqual([
      '198.51.100.9',
      '198.51.100.9',
      '198.51.100.9',
    ])
  })

  test('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    mockLoginByCode.mockResolvedValue({ success: true, type: 'staff', user: STAFF_USER })
    mockSetSessionCookie.mockResolvedValue(undefined)

    const req = createJsonRequest({ code: 'AOZ-ABC123' }, { 'x-real-ip': '172.16.0.1' })
    await POST(req)

    expect(mockLoginByCode).toHaveBeenCalledWith('AOZ-ABC123', '172.16.0.1')
  })

  test('uses "unknown" when no IP headers present', async () => {
    mockLoginByCode.mockResolvedValue({ success: true, type: 'staff', user: STAFF_USER })
    mockSetSessionCookie.mockResolvedValue(undefined)

    const req = createJsonRequest({ code: 'AOZ-ABC123' })
    await POST(req)

    expect(mockLoginByCode).toHaveBeenCalledWith('AOZ-ABC123', 'unknown')
  })
})
