/**
 * Handing an already-provisioned colleague their own login.
 *
 * The case this exists for is real and was unreachable: three staff members
 * were created by `ensure-aoz-team.ts`, so they hold codes and have no email.
 * Nothing in the product could give them access without an administrator
 * reading a colleague's credential out of the database by hand.
 */

const mockGetCurrentUser = vi.fn()
const mockFindFirst = vi.fn()
const mockInsertValues = vi.fn()
const mockSendEmail = vi.fn()
const mockLogAudit = vi.fn()
let emailEnabled = true

vi.mock('@/lib/auth', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    query: { user: { findFirst: (...args: unknown[]) => mockFindFirst(...args) } },
    insert: () => ({ values: (v: unknown) => mockInsertValues(v) }),
  },
  user: {},
  account: {},
  isUniqueViolation: (e: unknown) => (e as { unique?: boolean })?.unique === true,
}))

vi.mock('@/lib/email/service', () => ({ sendEmail: (...a: unknown[]) => mockSendEmail(...a) }))
vi.mock('@/lib/email/config', () => ({
  get EMAIL_CONFIG() {
    return { enabled: emailEnabled }
  },
}))
vi.mock('@/lib/email/templates', () => ({
  staffInviteEmail: ({ staffCode }: { staffCode: string }) => ({
    subject: 'Ihr Zugang',
    html: `code:${staffCode}`,
  }),
}))
vi.mock('@/lib/audit', () => ({ logAudit: (...a: unknown[]) => mockLogAudit(...a) }))

const ADMIN = {
  id: 'admin-1',
  name: 'Administrator',
  role: 'ADMIN',
  scope: 'ALL_DOMAINS',
  isSystemAdmin: true,
}
const COACH = {
  id: 'coach-1',
  name: 'Jonas M.',
  role: 'JOBCOACH',
  scope: 'OWN_DOMAIN',
  isSystemAdmin: false,
}

const SIMON_ROW = {
  id: 'coach-1',
  name: 'Jonas M.',
  code: 'AOZ-HWGA8G',
  active: true,
  account: null,
}

function post(body: unknown) {
  return new Request('http://localhost/api/auth/handover', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as never
}

beforeEach(() => {
  vi.clearAllMocks()
  emailEnabled = true
  mockGetCurrentUser.mockResolvedValue(ADMIN)
  mockFindFirst.mockResolvedValue(SIMON_ROW)
  mockInsertValues.mockResolvedValue(undefined)
  mockSendEmail.mockResolvedValue(true)
  mockLogAudit.mockResolvedValue(undefined)
})

describe('POST /api/auth/handover', () => {
  it('attaches the address and mails the person their EXISTING code', async () => {
    const { POST } = await import('../route')
    const response = await POST(post({ userId: 'coach-1', email: 'Coach@AOZ.ch ' }))

    expect(response.status).toBe(200)
    expect(mockInsertValues).toHaveBeenCalledWith({ email: 'coach@aoz.ch', userId: 'coach-1' })
    // The code is the one already on the row — this route never mints a new
    // one, because the person may already have been handed it on paper.
    const [recipients, , html] = mockSendEmail.mock.calls[0] as [string[], string, string]
    expect(recipients).toEqual(['coach@aoz.ch'])
    expect(html).toContain('AOZ-HWGA8G')
  })

  it('refuses when nobody may manage users', async () => {
    mockGetCurrentUser.mockResolvedValue(COACH)
    const { POST } = await import('../route')

    const response = await POST(post({ userId: 'coach-1', email: 'a@b.ch' }))

    expect(response.status).toBe(403)
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('refuses LOUDLY when email is not configured, rather than reporting a send', async () => {
    // The forgot-password rule. A cheerful success over a dead transport leaves
    // the administrator believing a colleague has access, and nobody chasing it.
    emailEnabled = false
    const { POST } = await import('../route')

    const response = await POST(post({ userId: 'coach-1', email: 'a@b.ch' }))

    expect(response.status).toBe(503)
    expect(mockInsertValues).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('will not silently move an account to a different mailbox', async () => {
    mockFindFirst.mockResolvedValue({ ...SIMON_ROW, account: { email: 'old@aoz.ch' } })
    const { POST } = await import('../route')

    const response = await POST(post({ userId: 'coach-1', email: 'new@aoz.ch' }))

    expect(response.status).toBe(409)
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('reports a taken address instead of a generic failure', async () => {
    // One email namespace across the product: the address may already belong
    // to a resident identity.
    mockInsertValues.mockRejectedValue({ unique: true })
    const { POST } = await import('../route')

    const response = await POST(post({ userId: 'coach-1', email: 'taken@aoz.ch' }))

    expect(response.status).toBe(409)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('says the mail did not go, even though the address is now on file', async () => {
    // Both halves matter: the row stands (so "Passwort vergessen?" works), and
    // the administrator is told, so nobody waits for an email that never left.
    mockSendEmail.mockResolvedValue(false)
    const { POST } = await import('../route')

    const response = await POST(post({ userId: 'coach-1', email: 'coach@aoz.ch' }))

    expect(response.status).toBe(502)
    expect(mockInsertValues).toHaveBeenCalled()
  })

  it('refuses a deactivated colleague', async () => {
    mockFindFirst.mockResolvedValue({ ...SIMON_ROW, active: false })
    const { POST } = await import('../route')

    expect((await POST(post({ userId: 'coach-1', email: 'a@b.ch' }))).status).toBe(409)
  })

  it.each([[{ userId: 'coach-1', email: 'nope' }], [{ userId: 'coach-1' }], [{ email: 'a@b.ch' }]])(
    'rejects malformed input %j',
    async (body) => {
      const { POST } = await import('../route')
      expect((await POST(post(body))).status).toBe(400)
    },
  )

  it('audits against the administrator who acted', async () => {
    const { POST } = await import('../route')
    await POST(post({ userId: 'coach-1', email: 'coach@aoz.ch' }))

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'STAFF_USER', entityId: 'coach-1', userId: 'admin-1' }),
    )
  })
})
