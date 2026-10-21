/**
 * Claim links replace the public quick-access doors. These tests pin the
 * contract: single-use, generic failure for bad links, released on a failed
 * account write, admin-only issuing, and the old /api/auth/demo is gone.
 */
import { existsSync } from 'fs'
import { join } from 'path'
import { NextRequest } from 'next/server'

const mockPeek = vi.fn()
const mockTake = vi.fn()
const mockRelease = vi.fn()
const mockIssue = vi.fn()
const mockRevoke = vi.fn()
vi.mock('@/lib/auth/claim-invites', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/claim-invites')>()),
  peekClaimInvite: (...a: unknown[]) => mockPeek(...a),
  takeClaimInvite: (...a: unknown[]) => mockTake(...a),
  releaseClaimInvite: (...a: unknown[]) => mockRelease(...a),
  issueClaimInvite: (...a: unknown[]) => mockIssue(...a),
  revokeClaimInvites: (...a: unknown[]) => mockRevoke(...a),
}))

const mockRegister = vi.fn()
vi.mock('@/lib/auth/account', async () => ({
  registerAccount: (...a: unknown[]) => mockRegister(...a),
}))
const mockEstablish = vi.fn()
vi.mock('@/lib/auth/sessions', async () => ({
  establishSessions: (...a: unknown[]) => mockEstablish(...a),
}))
vi.mock('@/lib/auth/rate-limit', async (importOriginal) => ({
  getClientIp: (await importOriginal<typeof import('@/lib/auth/rate-limit')>()).getClientIp,
  consumeRateLimit: () => ({ allowed: true }),
}))
const mockGetCurrentUser = vi.fn()
vi.mock('@/lib/auth', async () => ({
  getCurrentUser: (...a: unknown[]) => mockGetCurrentUser(...a),
}))
vi.mock('@/lib/audit', async () => ({ logAudit: vi.fn() }))

function req(url: string, method = 'GET', body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const VALID = { token: 'tok', email: 'simon@example.ch', password: 'longenough1' }

describe('/api/auth/claim', () => {
  beforeEach(() => vi.clearAllMocks())

  it('greets the person while the link is open', async () => {
    mockPeek.mockResolvedValue({ name: 'Simon Binder' })
    const { GET } = await import('../claim/route')
    const res = await GET(req('/api/auth/claim?token=tok'))
    expect(res.status).toBe(200)
    expect((await res.json()).data.name).toBe('Simon Binder')
  })

  it('answers 410 for unknown, used, revoked or expired links', async () => {
    mockPeek.mockResolvedValue(null)
    const { GET } = await import('../claim/route')
    expect((await GET(req('/api/auth/claim?token=nope'))).status).toBe(410)
  })

  it('claims the account with the code behind the link and signs in', async () => {
    mockTake.mockResolvedValue({ id: 'inv1', code: 'AOZ-SIMON1' })
    mockRegister.mockResolvedValue({ success: true, identities: { staff: { id: 'u1' } } })
    mockEstablish.mockResolvedValue({ success: true, type: 'staff', roles: ['staff'] })
    const { POST } = await import('../claim/route')
    const res = await POST(req('/api/auth/claim', 'POST', VALID))
    expect(res.status).toBe(200)
    expect(mockRegister).toHaveBeenCalledWith({
      code: 'AOZ-SIMON1',
      email: 'simon@example.ch',
      password: 'longenough1',
    })
    expect(mockRelease).not.toHaveBeenCalled()
  })

  it('refuses a link that was already used — no account write', async () => {
    mockTake.mockResolvedValue(null)
    const { POST } = await import('../claim/route')
    const res = await POST(req('/api/auth/claim', 'POST', VALID))
    expect(res.status).toBe(410)
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('releases the link when the account step fails, so the person can retry', async () => {
    mockTake.mockResolvedValue({ id: 'inv1', code: 'AOZ-SIMON1' })
    mockRegister.mockResolvedValue({ success: false, error: 'E-Mail vergeben' })
    const { POST } = await import('../claim/route')
    const res = await POST(req('/api/auth/claim', 'POST', VALID))
    expect(res.status).toBe(400)
    expect(mockRelease).toHaveBeenCalledWith('inv1')
  })

  it('validates input before touching the link', async () => {
    const { POST } = await import('../claim/route')
    const res = await POST(req('/api/auth/claim', 'POST', { ...VALID, password: 'short' }))
    expect(res.status).toBe(400)
    expect(mockTake).not.toHaveBeenCalled()
  })
})

describe('/api/auth/claim-invite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires a session', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const { POST } = await import('../claim-invite/route')
    expect((await POST(req('/api/auth/claim-invite', 'POST', { userId: 'u1' }))).status).toBe(401)
  })

  it('requires users:manage', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'c', role: 'JOBCOACH', scope: 'OWN_DOMAIN' })
    const { POST } = await import('../claim-invite/route')
    expect((await POST(req('/api/auth/claim-invite', 'POST', { userId: 'u1' }))).status).toBe(403)
    expect(mockIssue).not.toHaveBeenCalled()
  })

  it('issues a link for an administrator and can revoke it', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin',
      role: 'LEITUNG',
      scope: 'ALL_DOMAINS',
      isSystemAdmin: true,
    })
    mockIssue.mockResolvedValue({ ok: true, token: 'raw', expiresAt: new Date('2026-11-04') })
    const { POST, DELETE } = await import('../claim-invite/route')
    const res = await POST(req('/api/auth/claim-invite', 'POST', { userId: 'u1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).data.url).toMatch(/\/claim\?token=raw$/)
    expect(mockIssue).toHaveBeenCalledWith('u1', 'admin')

    const del = await DELETE(req('/api/auth/claim-invite', 'DELETE', { userId: 'u1' }))
    expect(del.status).toBe(200)
    expect(mockRevoke).toHaveBeenCalledWith('u1')
  })
})

describe('quick access is gone', () => {
  it('has no /api/auth/demo route and no quick-access config', () => {
    const root = process.cwd()
    expect(existsSync(join(root, 'src/app/api/auth/demo/route.ts'))).toBe(false)
    expect(existsSync(join(root, 'src/lib/quick-access/config.ts'))).toBe(false)
  })
})
