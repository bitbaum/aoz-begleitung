/**
 * Tests for the account API routes: signup, forgot-password, reset-password,
 * verify-email, and the email+password path of the unified login route.
 */

import { NextRequest } from 'next/server'

// --- Mocks ---

const mockRegisterAccount = vi.fn()
const mockLoginWithEmail = vi.fn()
const mockRequestPasswordReset = vi.fn()
const mockResetPassword = vi.fn()
const mockVerifyEmailToken = vi.fn()
vi.mock('@/lib/auth/account', async () => ({
  registerAccount: (...args: unknown[]) => mockRegisterAccount(...args),
  loginWithEmail: (...args: unknown[]) => mockLoginWithEmail(...args),
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  verifyEmailToken: (...args: unknown[]) => mockVerifyEmailToken(...args),
}))

const mockSetSessionCookie = vi.fn()
const mockLoginByCode = vi.fn()
vi.mock('@/lib/auth', async () => ({
  setSessionCookie: (...args: unknown[]) => mockSetSessionCookie(...args),
  loginByCode: (...args: unknown[]) => mockLoginByCode(...args),
}))

const mockSetResidentCookie = vi.fn()
vi.mock('@/lib/portal-auth', async () => ({
  setResidentCookie: (...args: unknown[]) => mockSetResidentCookie(...args),
}))

const mockConsumeRateLimit = vi.fn()
const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/auth/rate-limit', async () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  recordLoginAttempt: vi.fn(),
  clearLoginAttempts: vi.fn(),
  getClientIp: () => '10.0.0.1',
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
import { POST as signupPost } from '../signup/route'
import { POST as forgotPost } from '../forgot-password/route'
import { POST as resetPost } from '../reset-password/route'
import { GET as verifyGet } from '../verify-email/route'
import { POST as loginPost } from '../login/route'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

function jsonRequest(path: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3001${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockConsumeRateLimit.mockReturnValue({ allowed: true })
  mockCheckRateLimit.mockReturnValue({ allowed: true })
})

describe('POST /api/auth/signup', () => {
  const VALID = { code: 'RES-ABC123', email: 'hana@example.ch', password: 'secret-password' }

  it('registers, sets the resident cookie, and reports the type', async () => {
    mockRegisterAccount.mockResolvedValue({
      success: true,
      identities: { resident: { id: 'res-1', code: 'RES-ABC123' } },
    })

    const response = await signupPost(jsonRequest('/api/auth/signup', VALID))
    const body = await response.json()

    expect(body).toEqual({ success: true, type: 'resident', roles: ['resident'] })
    expect(mockSetResidentCookie).toHaveBeenCalledWith('RES-ABC123')
    expect(mockSetSessionCookie).not.toHaveBeenCalled()
  })

  it('sets the staff JWT for staff registrations', async () => {
    mockRegisterAccount.mockResolvedValue({
      success: true,
      identities: {
        staff: { id: 'u1', code: 'AOZ-X', name: 'G', email: 'g@x.ch', role: 'ADMIN' },
      },
    })

    const response = await signupPost(jsonRequest('/api/auth/signup', { ...VALID, code: 'AOZ-X' }))
    expect((await response.json()).type).toBe('staff')
    expect(mockSetSessionCookie).toHaveBeenCalledWith({
      id: 'u1',
      email: 'g@x.ch',
      name: 'G',
      role: 'ADMIN',
    })
  })

  it('links a second role: one signup, BOTH sessions, both roles reported', async () => {
    mockRegisterAccount.mockResolvedValue({
      success: true,
      identities: {
        staff: { id: 'u1', code: 'AOZ-X', name: 'G', email: 'g@x.ch', role: 'ADMIN' },
        resident: { id: 'res-1', code: 'RES-ABC123' },
      },
    })

    const response = await signupPost(jsonRequest('/api/auth/signup', VALID))

    // Staff wins the landing page — the admin side is the bigger surface — but
    // the resident cookie is set too, so the nav can offer the switch.
    expect(await response.json()).toEqual({
      success: true,
      type: 'staff',
      roles: ['staff', 'resident'],
    })
    expect(mockSetSessionCookie).toHaveBeenCalledTimes(1)
    expect(mockSetResidentCookie).toHaveBeenCalledWith('RES-ABC123')
  })

  it('normalises input via the schema (trims + lowercases email, uppercases code)', async () => {
    mockRegisterAccount.mockResolvedValue({
      success: true,
      identities: { resident: { id: 'res-1', code: 'RES-ABC123' } },
    })

    await signupPost(
      jsonRequest('/api/auth/signup', {
        code: 'res-abc123',
        email: '  Hana@Example.CH ',
        password: 'secret-password',
      }),
    )
    expect(mockRegisterAccount).toHaveBeenCalledWith({
      code: 'RES-ABC123',
      email: 'hana@example.ch',
      password: 'secret-password',
    })
  })

  it('rejects a too-short password with the German message', async () => {
    const response = await signupPost(
      jsonRequest('/api/auth/signup', { ...VALID, password: 'short' }),
    )
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error).toBe(ERROR_MESSAGES.AUTH_PASSWORD_TOO_SHORT)
    expect(mockRegisterAccount).not.toHaveBeenCalled()
  })

  it('is rate limited', async () => {
    mockConsumeRateLimit.mockReturnValue({ allowed: false, retryAfter: 42 })
    const response = await signupPost(jsonRequest('/api/auth/signup', VALID))
    expect(response.status).toBe(429)
    expect(mockRegisterAccount).not.toHaveBeenCalled()
  })

  it('passes domain errors through as 400', async () => {
    mockRegisterAccount.mockResolvedValue({
      success: false,
      error: ERROR_MESSAGES.AUTH_ALREADY_REGISTERED,
    })
    const response = await signupPost(jsonRequest('/api/auth/signup', VALID))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe(ERROR_MESSAGES.AUTH_ALREADY_REGISTERED)
  })
})

describe('POST /api/auth/forgot-password', () => {
  it('returns generic success', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: true })
    const response = await forgotPost(
      jsonRequest('/api/auth/forgot-password', { email: 'g@example.ch' }),
    )
    expect(await response.json()).toEqual({ success: true })
    expect(mockRequestPasswordReset).toHaveBeenCalledWith('g@example.ch')
  })

  it('surfaces the email-not-configured refusal as 503', async () => {
    mockRequestPasswordReset.mockResolvedValue({
      success: false,
      error: ERROR_MESSAGES.AUTH_EMAIL_NOT_CONFIGURED,
    })
    const response = await forgotPost(
      jsonRequest('/api/auth/forgot-password', { email: 'g@example.ch' }),
    )
    expect(response.status).toBe(503)
    expect((await response.json()).error).toBe(ERROR_MESSAGES.AUTH_EMAIL_NOT_CONFIGURED)
  })

  it('rejects an invalid email shape', async () => {
    const response = await forgotPost(
      jsonRequest('/api/auth/forgot-password', { email: 'not-an-email' }),
    )
    expect(response.status).toBe(400)
    expect(mockRequestPasswordReset).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/reset-password', () => {
  it('resets with a valid token', async () => {
    mockResetPassword.mockResolvedValue({ success: true })
    const response = await resetPost(
      jsonRequest('/api/auth/reset-password', { token: 'tok', password: 'new-password-1' }),
    )
    expect(await response.json()).toEqual({ success: true })
    expect(mockResetPassword).toHaveBeenCalledWith('tok', 'new-password-1')
  })

  it('rejects an invalid token as 400', async () => {
    mockResetPassword.mockResolvedValue({
      success: false,
      error: ERROR_MESSAGES.AUTH_RESET_TOKEN_INVALID,
    })
    const response = await resetPost(
      jsonRequest('/api/auth/reset-password', { token: 'tok', password: 'new-password-1' }),
    )
    expect(response.status).toBe(400)
  })

  it('enforces the password policy before touching the token', async () => {
    const response = await resetPost(
      jsonRequest('/api/auth/reset-password', { token: 'tok', password: 'short' }),
    )
    expect(response.status).toBe(400)
    expect(mockResetPassword).not.toHaveBeenCalled()
  })
})

describe('GET /api/auth/verify-email', () => {
  function verifyRequest(token?: string): NextRequest {
    const url = token
      ? `http://localhost:3001/api/auth/verify-email?token=${token}`
      : 'http://localhost:3001/api/auth/verify-email'
    return new NextRequest(url)
  }

  it('redirects to /login?verified=1 on success', async () => {
    mockVerifyEmailToken.mockResolvedValue(true)
    const response = await verifyGet(verifyRequest('tok'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login?verified=1')
  })

  it('redirects to /login?verified=0 for a bad or missing token', async () => {
    mockVerifyEmailToken.mockResolvedValue(false)
    const bad = await verifyGet(verifyRequest('tok'))
    expect(bad.headers.get('location')).toContain('/login?verified=0')

    const missing = await verifyGet(verifyRequest())
    expect(missing.headers.get('location')).toContain('/login?verified=0')
    expect(mockVerifyEmailToken).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/auth/login with email credentials', () => {
  it('routes email bodies to loginWithEmail and sets the right session', async () => {
    mockLoginWithEmail.mockResolvedValue({
      success: true,
      identities: { resident: { id: 'res-1', code: 'RES-ABC123' } },
    })

    const response = await loginPost(
      jsonRequest('/api/auth/login', { email: 'hana@example.ch', password: 'pw-123456' }),
    )
    const body = await response.json()

    expect(body).toEqual({ success: true, type: 'resident', roles: ['resident'] })
    expect(mockSetResidentCookie).toHaveBeenCalledWith('RES-ABC123')
    expect(mockLoginByCode).not.toHaveBeenCalled()
  })

  it('returns 401 with the generic message on bad credentials', async () => {
    mockLoginWithEmail.mockResolvedValue({
      success: false,
      error: ERROR_MESSAGES.INVALID_CREDENTIALS,
    })
    const response = await loginPost(
      jsonRequest('/api/auth/login', { email: 'x@example.ch', password: 'wrong' }),
    )
    expect(response.status).toBe(401)
    expect((await response.json()).error).toBe(ERROR_MESSAGES.INVALID_CREDENTIALS)
  })
})
