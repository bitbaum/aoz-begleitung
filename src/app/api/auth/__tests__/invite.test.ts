/**
 * Tests for POST /api/auth/invite
 *
 * Tests: auth guard, rate limiting, validation, email uniqueness,
 * code generation, successful invite, email send failure
 */

import { NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

// --- Mocks ---

const mockGetCurrentUser = vi.fn()
vi.mock('@/lib/auth', async () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
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

vi.mock('@/lib/auth/code-generation', async () => ({
  generateStaffCode: vi.fn(() => 'AOZ-GEN001'),
}))

const mockUserFindFirst = vi.fn()
const mockUserInsertReturning = vi.fn()
const mockAccountFindFirst = vi.fn()
const mockAccountInsertReturning = vi.fn()
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db')
  return {
    ...actual,
    db: {
      query: {
        user: { findFirst: (...args: unknown[]) => mockUserFindFirst(...args) },
        // Email lives on the Account, not the User.
        account: { findFirst: (...args: unknown[]) => mockAccountFindFirst(...args) },
      },
      // The route creates User + Account inside one transaction; dispatch each
      // tx.insert to the mock for the table it targets.
      transaction: (fn: (tx: unknown) => unknown) =>
        fn({
          insert: (table: unknown) => ({
            values: (v: unknown) => ({
              returning: (): Promise<unknown[]> =>
                table === actual.user ? mockUserInsertReturning(v) : mockAccountInsertReturning(v),
            }),
          }),
        }),
    },
  }
})

const mockSendEmail = vi.fn()
vi.mock('@/lib/email/service', async () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))

vi.mock('@/lib/email/templates', async () => ({
  staffInviteEmail: vi.fn(() => ({
    subject: 'Ihr AOZ Housing Zugangscode',
    html: '<p>Your code</p>',
  })),
}))

// --- Import after mocks ---
import { POST } from '../invite/route'

// --- Helpers ---

function createJsonRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): NextRequest {
  return new NextRequest('http://localhost:3001/api/auth/invite', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '10.0.0.1',
      ...headers,
    },
  })
}

const ADMIN_USER = {
  id: 'user-1',
  name: 'Admin',
  role: 'ADMIN' as const,
  scope: 'ALL_DOMAINS' as const,
  isSystemAdmin: true,
}

// --- Tests ---

describe('POST /api/auth/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true })
    mockGetCurrentUser.mockResolvedValue(ADMIN_USER)
    mockUserFindFirst.mockResolvedValue(null) // code not taken
    mockAccountFindFirst.mockResolvedValue(null) // email not taken
    mockUserInsertReturning.mockResolvedValue([
      { id: 'new-1', code: 'AOZ-GEN001', name: 'New Staff' },
    ])
    mockAccountInsertReturning.mockResolvedValue([{ email: 'new@aoz.ch' }])
    mockSendEmail.mockResolvedValue(true)
  })

  // ── Rate limiting ──────────────────────────────────────────────────────────

  test('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfter: 60 })

    const req = createJsonRequest({ email: 'test@aoz.ch', name: 'Test' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.success).toBe(false)
    expect(body.retryAfter).toBe(60)
    expect(mockGetCurrentUser).not.toHaveBeenCalled()
  })

  // Caddy appends the real peer, so the last hop is ours and the leading one
  // is caller-supplied — keying on it handed every request a fresh bucket.
  test('checks the rate limit against the last x-forwarded-for hop', async () => {
    const req = createJsonRequest(
      { email: 'test@aoz.ch', name: 'Test' },
      { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    )
    await POST(req)

    expect(mockCheckRateLimit).toHaveBeenCalledWith('10.0.0.1')
  })

  // ── Auth guard ─────────────────────────────────────────────────────────────

  test('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const req = createJsonRequest({ email: 'new@aoz.ch', name: 'New Staff' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error).toBe(ERROR_MESSAGES.AUTH_REQUIRED)
    expect(mockRecordLoginAttempt).toHaveBeenCalled()
  })

  test('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3001/api/auth/invite', {
      method: 'POST',
      body: 'not json',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '10.0.0.1',
      },
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(mockRecordLoginAttempt).toHaveBeenCalled()
  })

  // ── Validation ─────────────────────────────────────────────────────────────

  test('returns 400 when email is missing', async () => {
    const req = createJsonRequest({ name: 'Test' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(mockRecordLoginAttempt).toHaveBeenCalled()
  })

  test('returns 400 when email is invalid (no @)', async () => {
    const req = createJsonRequest({ email: 'notanemail', name: 'Test' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(mockRecordLoginAttempt).toHaveBeenCalled()
  })

  test('returns 400 when name is too short', async () => {
    const req = createJsonRequest({ email: 'test@aoz.ch', name: 'X' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(mockRecordLoginAttempt).toHaveBeenCalled()
  })

  // ── Email uniqueness ───────────────────────────────────────────────────────

  test('returns 409 when email already registered', async () => {
    mockAccountFindFirst.mockResolvedValue({ id: 'existing-1' }) // email already taken

    const req = createJsonRequest({ email: 'existing@aoz.ch', name: 'Duplicate' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.success).toBe(false)
    expect(body.error).toContain('E-Mail')
  })

  // ── Code generation ────────────────────────────────────────────────────────

  test('returns 500 when all code generation attempts fail', async () => {
    // All generated codes collide
    mockUserFindFirst.mockResolvedValue({ id: 'existing' })

    const req = createJsonRequest({ email: 'new@aoz.ch', name: 'New Staff' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toBe(ERROR_MESSAGES.CODE_GENERATION_ERROR)
  })

  // ── Successful invite ──────────────────────────────────────────────────────

  test('returns 403 when the caller cannot manage users', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'coach-1', name: 'Coach', role: 'JOBCOACH' })

    const req = createJsonRequest({ email: 'new@aoz.ch', name: 'New Staff' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
    expect(mockUserInsertReturning).not.toHaveBeenCalled()
  })

  test('creates user with an explicit role', async () => {
    const req = createJsonRequest({ email: 'new@aoz.ch', name: 'New Staff', role: 'JOBCOACH' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockUserInsertReturning).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'JOBCOACH' }),
    )
  })

  test('creates user and sends email on valid invite', async () => {
    const req = createJsonRequest({ email: 'new@aoz.ch', name: 'New Staff' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.user.code).toBe('AOZ-GEN001')
    expect(body.user.name).toBe('New Staff')
    expect(body.user.email).toBe('new@aoz.ch')
    expect(body.emailSent).toBe(true)

    expect(mockUserInsertReturning).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AOZ-GEN001',
        name: 'New Staff',
        role: 'BETREUUNG',
        active: true,
      }),
    )
    // The Account row is a second insert in the same transaction, linked by FK.
    expect(mockAccountInsertReturning).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@aoz.ch', userId: 'new-1' }),
    )
    expect(mockSendEmail).toHaveBeenCalledWith(
      ['new@aoz.ch'],
      expect.any(String),
      expect.any(String),
    )
  })

  test('lowercases email before storing', async () => {
    const req = createJsonRequest({ email: 'Upper@AOZ.CH', name: 'Mixed Case' })
    await POST(req)

    expect(mockAccountInsertReturning).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'upper@aoz.ch' }),
    )
  })

  test('trims name before storing', async () => {
    const req = createJsonRequest({ email: 'test@aoz.ch', name: '  Padded Name  ' })
    await POST(req)

    expect(mockUserInsertReturning).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Padded Name' }),
    )
  })

  test('returns optimistically even when email service fails', async () => {
    // The route fires the email asynchronously to avoid blocking on Brevo.
    // The HTTP response now always reports `emailSent: true` regardless of
    // delivery outcome; actual failures land in Sentry/logs.
    mockSendEmail.mockResolvedValue(false)

    const req = createJsonRequest({ email: 'new@aoz.ch', name: 'New Staff' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.emailSent).toBe(true)
  })
})
