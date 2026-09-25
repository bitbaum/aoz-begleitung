/**
 * Tests for the account flows (lib/auth/account.ts): claiming a code, LINKING a
 * second code to an existing login (the one-human-two-roles case), email login,
 * and password reset — including the anti-enumeration and email-not-configured
 * guarantees.
 */

/**
 * Pull `column = value` out of a drizzle eq() expression, so mocks can
 * dispatch the way the old tests dispatched on Prisma's `where` objects.
 * All three Prisma account lookups (findFirst by identity, findUnique by
 * email, findUniqueOrThrow by id) are now ONE db.query.account.findFirst —
 * the where column is what tells them apart.
 */
function mockEqParts(where: unknown): { column?: string; value?: unknown } {
  const parts: { column?: string; value?: unknown } = {}
  for (const chunk of (where as { queryChunks?: unknown[] })?.queryChunks ?? []) {
    if (chunk && typeof chunk === 'object') {
      if ('name' in chunk && 'table' in chunk) parts.column = (chunk as { name: string }).name
      else if ('encoder' in chunk) parts.value = (chunk as unknown as { value: unknown }).value
    }
  }
  return parts
}

const mockUserFindFirst = vi.fn()
const mockResidentFindFirst = vi.fn()
const mockAccountFindFirst = vi.fn()
// (table, values) => inserted rows for .returning()
const mockInsert = vi.fn()
// (table, data, { column, value }) => updated rows for .returning()
const mockUpdate = vi.fn()

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: {
      user: { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) },
      resident: { findFirst: (...a: unknown[]) => mockResidentFindFirst(...a) },
      account: { findFirst: (...a: unknown[]) => mockAccountFindFirst(...a) },
    },
    insert: (table: unknown) => ({
      values: (v: unknown) => ({
        returning: () => Promise.resolve(mockInsert(table, v)),
      }),
    }),
    update: (table: unknown) => ({
      set: (data: unknown) => ({
        where: (w: unknown) => {
          const rows = mockUpdate(table, data, mockEqParts(w))
          return Object.assign(Promise.resolve(rows), {
            returning: () => Promise.resolve(rows),
          })
        },
      }),
    }),
  },
}))

const mockSendEmail = vi.fn()
vi.mock('@/lib/email/service', async () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))

const mockEmailConfig = vi.hoisted(() => ({ enabled: true }))
vi.mock('@/lib/email/config', async () => ({ EMAIL_CONFIG: mockEmailConfig }))

const mockCreateAuthToken = vi.fn()
const mockConsumeAuthToken = vi.fn()
vi.mock('../tokens', async () => ({
  createAuthToken: (...args: unknown[]) => mockCreateAuthToken(...args),
  consumeAuthToken: (...args: unknown[]) => mockConsumeAuthToken(...args),
}))

vi.mock('@/lib/logger', async () => ({
  logger: { info: vi.fn(), error: vi.fn(), errorWithCause: vi.fn() },
}))

import { registerAccount, loginWithEmail, requestPasswordReset, resetPassword } from '../account'
import { hashPassword } from '../passwords'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { account as accountTable, user as userTable } from '@/lib/db'

const STAFF = {
  id: 'user-1',
  code: 'AOZ-ADMIN1',
  name: 'Admin',
  role: 'ADMIN' as const,
  active: true,
}
const RESIDENT = { id: 'res-1', code: 'RES-ABC123' }

// bcrypt at 12 rounds is deliberately slow, and slower still when the whole
// suite runs in parallel — the cost is the security property, so these tests
// get a real budget rather than a weakened hash.
vi.setConfig({ testTimeout: 60_000 })

// Hash the one password these tests verify against exactly once; otherwise
// every case pays for it twice.
const ACCOUNT_PASSWORD = 'my-password'
let ACCOUNT_HASH: string
beforeAll(async () => {
  ACCOUNT_HASH = await hashPassword(ACCOUNT_PASSWORD)
})

/** An Account row as ACCOUNT_WITH_IDENTITIES selects it. */
function account(
  overrides: Partial<{
    id: string
    email: string
    passwordHash: string | null
    user: typeof STAFF | null
    resident: typeof RESIDENT | null
  }> = {},
) {
  return {
    id: 'acc-1',
    email: 'g@example.ch',
    passwordHash: null,
    user: null,
    resident: null,
    ...overrides,
  }
}

// The three account lookups the source makes, told apart by their where
// column. These replace the old findFirst/findUnique/findUniqueOrThrow trio.
const mockAccountByIdentity = vi.fn() // eq(account.userId | residentId, …)
const mockAccountByEmail = vi.fn() // eq(account.email, …)
const mockAccountById = vi.fn() // eq(account.id, …) — loadAccount

/** Code lookups resolve; nothing else exists unless a test says so. */
function codeExists({ staff = false, resident = false } = {}) {
  mockUserFindFirst.mockImplementation(({ where }: { where: unknown }) =>
    Promise.resolve(
      staff && mockEqParts(where).value === STAFF.code ? { id: STAFF.id, active: true } : null,
    ),
  )
  mockResidentFindFirst.mockImplementation(({ where }: { where: unknown }) =>
    Promise.resolve(
      resident && mockEqParts(where).value === RESIDENT.code ? { id: RESIDENT.id } : null,
    ),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEmailConfig.enabled = true
  codeExists()
  mockAccountFindFirst.mockImplementation(({ where }: { where: unknown }) => {
    const { column, value } = mockEqParts(where)
    if (column === 'email') return mockAccountByEmail(value)
    if (column === 'id') return mockAccountById(value)
    return mockAccountByIdentity(column, value)
  })
  mockAccountByIdentity.mockResolvedValue(null)
  mockAccountByEmail.mockResolvedValue(null)
  mockAccountById.mockResolvedValue(account())
  mockInsert.mockReturnValue([{ id: 'acc-new' }])
  mockUpdate.mockReturnValue([{ id: 'acc-1' }])
  mockCreateAuthToken.mockResolvedValue('raw-token')
  mockSendEmail.mockResolvedValue(true)
})

describe('registerAccount', () => {
  it('claims a staff code: creates the account with a bcrypt hash, sends verification', async () => {
    codeExists({ staff: true })
    mockAccountById.mockResolvedValue(account({ id: 'acc-new', user: STAFF }))

    const result = await registerAccount({
      code: 'AOZ-ADMIN1',
      email: 'g@example.ch',
      password: 'secret-password',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.identities.staff).toMatchObject({ code: 'AOZ-ADMIN1', email: 'g@example.ch' })
    expect(result.identities.resident).toBeUndefined()

    const [table, created] = mockInsert.mock.calls[0]
    expect(table).toBe(accountTable)
    expect(created).toMatchObject({ email: 'g@example.ch', userId: 'user-1' })
    expect(created.passwordHash).toMatch(/^\$2[aby]\$/)
    expect(created.passwordHash).not.toBe('secret-password')

    expect(mockCreateAuthToken).toHaveBeenCalledWith('acc-new', 'VERIFY_EMAIL')
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
  })

  it('claims a resident code and returns the resident identity', async () => {
    codeExists({ resident: true })
    mockAccountById.mockResolvedValue(
      account({ id: 'acc-new', email: 'hana@example.ch', resident: RESIDENT }),
    )

    const result = await registerAccount({
      code: 'RES-ABC123',
      email: 'hana@example.ch',
      password: 'secret-password',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.identities.resident).toEqual({ id: 'res-1', code: 'RES-ABC123' })
    expect(mockInsert.mock.calls[0][1]).toMatchObject({ residentId: 'res-1' })
  })

  it('rejects an unknown code', async () => {
    const result = await registerAccount({
      code: 'RES-NOPE',
      email: 'x@example.ch',
      password: 'secret-password',
    })
    expect(result).toEqual({ success: false, error: ERROR_MESSAGES.AUTH_CODE_UNKNOWN })
  })

  it('rejects a DEACTIVATED staff code with the same message as an unknown one', async () => {
    mockUserFindFirst.mockResolvedValue({ id: STAFF.id, active: false })
    const result = await registerAccount({
      code: 'AOZ-ADMIN1',
      email: 'x@example.ch',
      password: 'secret-password',
    })
    expect(result).toEqual({ success: false, error: ERROR_MESSAGES.AUTH_CODE_UNKNOWN })
  })

  it('rejects a code that already carries credentials (use password reset)', async () => {
    codeExists({ resident: true })
    mockAccountByIdentity.mockResolvedValue(
      account({ passwordHash: 'already-set', resident: RESIDENT }),
    )
    const result = await registerAccount({
      code: 'RES-ABC123',
      email: 'x@example.ch',
      password: 'secret-password',
    })
    expect(result).toEqual({ success: false, error: ERROR_MESSAGES.AUTH_ALREADY_REGISTERED })
  })

  it('rejects an email owned by a DIFFERENT account than the code is on', async () => {
    codeExists({ resident: true })
    mockAccountByIdentity.mockResolvedValue(account({ id: 'acc-res', resident: RESIDENT }))
    mockAccountByEmail.mockResolvedValue(account({ id: 'acc-other' }))

    const result = await registerAccount({
      code: 'RES-ABC123',
      email: 'taken@example.ch',
      password: 'secret-password',
    })
    expect(result).toEqual({ success: false, error: ERROR_MESSAGES.AUTH_EMAIL_TAKEN })
  })

  it('completes an unclaimed account that already knows the email (invited staff)', async () => {
    codeExists({ staff: true })
    const unclaimed = account({ user: STAFF })
    mockAccountByIdentity.mockResolvedValue(unclaimed)
    mockAccountByEmail.mockResolvedValue(unclaimed)
    mockAccountById.mockResolvedValue(account({ user: STAFF }))

    const result = await registerAccount({
      code: 'AOZ-ADMIN1',
      email: 'g@example.ch',
      password: 'secret-password',
    })

    expect(result.success).toBe(true)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockUpdate.mock.calls[0][2]).toEqual({ column: 'id', value: 'acc-1' })
  })

  it('still succeeds when the verification email fails to send', async () => {
    codeExists({ staff: true })
    mockSendEmail.mockRejectedValue(new Error('smtp down'))

    const result = await registerAccount({
      code: 'AOZ-ADMIN1',
      email: 'g@example.ch',
      password: 'secret-password',
    })
    expect(result.success).toBe(true)
  })
})

describe('registerAccount — linking a SECOND role to one login', () => {
  /** An admin account with a password, claiming their own resident code. */
  async function linkResidentToStaffAccount(password: string) {
    codeExists({ resident: true })
    const staffAccount = account({ id: 'acc-staff', passwordHash: ACCOUNT_HASH, user: STAFF })
    mockAccountByIdentity.mockResolvedValue(null)
    mockAccountByEmail.mockResolvedValue(staffAccount)
    mockAccountById.mockResolvedValue({
      ...staffAccount,
      resident: RESIDENT,
    })

    return registerAccount({ code: 'RES-ABC123', email: 'g@example.ch', password })
  }

  it('links the code and returns BOTH identities in one login', async () => {
    const result = await linkResidentToStaffAccount(ACCOUNT_PASSWORD)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.identities.staff).toMatchObject({ code: 'AOZ-ADMIN1' })
    expect(result.identities.resident).toEqual({ id: 'res-1', code: 'RES-ABC123' })

    expect(mockUpdate).toHaveBeenCalledWith(
      accountTable,
      { residentId: 'res-1' },
      { column: 'id', value: 'acc-staff' },
    )
    // Linking must not touch the existing password.
    expect(mockUpdate.mock.calls[0][1].passwordHash).toBeUndefined()
  })

  it('refuses to link without the account password (a stray code is not enough)', async () => {
    const result = await linkResidentToStaffAccount('not-my-password')
    expect(result).toEqual({
      success: false,
      error: ERROR_MESSAGES.AUTH_LINK_PASSWORD_MISMATCH,
    })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('refuses a second code for a role slot that is already filled', async () => {
    codeExists({ resident: true })
    mockAccountByEmail.mockResolvedValue(
      account({
        id: 'acc-other',
        passwordHash: 'x',
        resident: { id: 'res-9', code: 'RES-OTHER9' },
      }),
    )

    const result = await registerAccount({
      code: 'RES-ABC123',
      email: 'g@example.ch',
      password: 'my-password',
    })
    expect(result).toEqual({ success: false, error: ERROR_MESSAGES.AUTH_ROLE_ALREADY_LINKED })
  })
})

describe('loginWithEmail', () => {
  it('returns EVERY identity the account carries', async () => {
    mockAccountByEmail.mockResolvedValue(
      account({
        passwordHash: ACCOUNT_HASH,
        user: STAFF,
        resident: RESIDENT,
      }),
    )

    const result = await loginWithEmail({ email: 'g@example.ch', password: ACCOUNT_PASSWORD })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.identities.staff).toMatchObject({ id: 'user-1', role: 'ADMIN' })
    expect(result.identities.resident).toEqual({ id: 'res-1', code: 'RES-ABC123' })
    expect(mockUpdate).toHaveBeenCalledWith(
      userTable,
      { lastLoginAt: expect.any(Date) },
      { column: 'id', value: 'user-1' },
    )
  })

  it('keeps resident access when the staff identity is deactivated', async () => {
    mockAccountByEmail.mockResolvedValue(
      account({
        passwordHash: ACCOUNT_HASH,
        user: { ...STAFF, active: false },
        resident: RESIDENT,
      }),
    )

    const result = await loginWithEmail({ email: 'g@example.ch', password: ACCOUNT_PASSWORD })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.identities.staff).toBeUndefined()
    expect(result.identities.resident).toEqual({ id: 'res-1', code: 'RES-ABC123' })
  })

  it.each([
    ['unknown email', () => {}],
    [
      'wrong password',
      async () => {
        mockAccountByEmail.mockResolvedValue(account({ passwordHash: ACCOUNT_HASH, user: STAFF }))
      },
    ],
    [
      'account without a password',
      () => {
        mockAccountByEmail.mockResolvedValue(account({ user: STAFF }))
      },
    ],
    [
      'every identity deactivated',
      async () => {
        mockAccountByEmail.mockResolvedValue(
          account({ passwordHash: ACCOUNT_HASH, user: { ...STAFF, active: false } }),
        )
      },
    ],
  ])('fails with ONE generic message for %s (no enumeration)', async (_case, setup) => {
    await setup()
    const result = await loginWithEmail({ email: 'g@example.ch', password: 'correct-password' })
    expect(result).toEqual({ success: false, error: ERROR_MESSAGES.INVALID_CREDENTIALS })
  })
})

describe('requestPasswordReset', () => {
  it('REFUSES loudly when the deployment cannot send email (no silent lockout)', async () => {
    mockEmailConfig.enabled = false
    const result = await requestPasswordReset('g@example.ch')
    expect(result).toEqual({
      success: false,
      error: ERROR_MESSAGES.AUTH_EMAIL_NOT_CONFIGURED,
    })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('sends a reset link to an existing account', async () => {
    mockAccountByEmail.mockResolvedValue({ id: 'acc-1' })
    const result = await requestPasswordReset('g@example.ch')
    expect(result).toEqual({ success: true })
    expect(mockCreateAuthToken).toHaveBeenCalledWith('acc-1', 'RESET_PASSWORD')
    const [to, , html] = mockSendEmail.mock.calls[0]
    expect(to).toEqual(['g@example.ch'])
    expect(html).toContain('/reset-password?token=raw-token')
  })

  it('returns the SAME success for an unknown email, without sending', async () => {
    const result = await requestPasswordReset('nobody@example.ch')
    expect(result).toEqual({ success: true })
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})

describe('resetPassword', () => {
  it('sets a new hash and marks the email verified (mailbox control proven)', async () => {
    mockConsumeAuthToken.mockResolvedValue('acc-1')
    const result = await resetPassword('raw-token', 'new-password-123')
    expect(result).toEqual({ success: true })

    const [table, data, where] = mockUpdate.mock.calls[0]
    expect(table).toBe(accountTable)
    expect(where).toEqual({ column: 'id', value: 'acc-1' })
    expect(data.passwordHash).toMatch(/^\$2[aby]\$/)
    expect(data.emailVerifiedAt).toBeInstanceOf(Date)
  })

  it('rejects an invalid or expired token', async () => {
    mockConsumeAuthToken.mockResolvedValue(null)
    const result = await resetPassword('raw-token', 'new-password-123')
    expect(result).toEqual({ success: false, error: ERROR_MESSAGES.AUTH_RESET_TOKEN_INVALID })
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
