/**
 * Login routing across a rebrand.
 *
 * `loginByCode` decides staff-vs-resident from the code's prefix. The property
 * that matters here is not "AOZH codes work" — it is that codes issued under a
 * PREVIOUS brand keep working, because a login code is a credential people
 * already hold on a printed letter. Routing on the active brand alone locks
 * out every staff member who has not been re-issued a code, including the
 * seeded admin (`AOZ-ADMIN1`), and it does so silently: the code simply reads
 * as "Ungültiger Code".
 */

import { BRANDS } from '@/lib/config/brand'
import { RESIDENT_CODE_PREFIX } from '@/lib/auth/code-prefixes'

const mockUserFindFirst = vi.fn()
const mockUserUpdate = vi.fn()
const mockResidentFindFirst = vi.fn()

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: {
      user: { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) },
      resident: { findFirst: (...a: unknown[]) => mockResidentFindFirst(...a) },
    },
    update: () => ({
      set: (data: unknown) => ({ where: () => Promise.resolve(mockUserUpdate(data)) }),
    }),
  },
}))

vi.mock('@/lib/auth/rate-limit', async (importOriginal) => ({
  // Re-export the REAL client-IP reader rather than restating it: a mocked
  // copy is how the spoofable first-hop version survived here after the
  // module was fixed.
  getClientIp: (await importOriginal<typeof import('@/lib/auth/rate-limit')>()).getClientIp,
  recordLoginAttempt: vi.fn(),
  clearLoginAttempts: vi.fn(),
}))

vi.mock('next/headers', async () => ({ cookies: vi.fn() }))

import { loginByCode } from '@/lib/auth'
import { eqParts } from '@/test-utils/drizzle-where'

const STAFF = {
  id: 'u1',
  account: { email: 'staff@example.ch' },
  name: 'Sam Staff',
  role: 'ADMIN' as const,
  active: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUserFindFirst.mockResolvedValue(STAFF)
  mockUserUpdate.mockResolvedValue({})
  mockResidentFindFirst.mockResolvedValue({ id: 'r1', code: 'RES-010' })
})

describe('loginByCode — staff routing', () => {
  it.each(Object.values(BRANDS).map((b) => [b.id, b.codePrefix]))(
    'accepts a %s-era staff code (%s)',
    async (_id, prefix) => {
      const result = await loginByCode(`${prefix}ADMIN1`, '10.0.0.1')

      expect(result).toMatchObject({ success: true, type: 'staff' })
      // Looked up by the exact string — a prefix never rewrites a code.
      expect(eqParts(mockUserFindFirst.mock.calls[0][0].where)).toEqual({
        column: 'code',
        value: `${prefix}ADMIN1`,
      })
    },
  )

  it('still admits the original seeded AOZ admin after the AOZH rebrand', async () => {
    // The exact regression: this code exists in production today.
    const result = await loginByCode('AOZ-ADMIN1', '10.0.0.1')
    expect(result).toMatchObject({ success: true, type: 'staff' })
  })

  it('rejects an inactive staff account', async () => {
    mockUserFindFirst.mockResolvedValue({ ...STAFF, active: false })
    expect(await loginByCode('AOZH-ADMIN1', '10.0.0.1')).toMatchObject({ success: false })
  })
})

describe('loginByCode — resident routing', () => {
  it('routes a resident code to the resident lookup', async () => {
    const result = await loginByCode(`${RESIDENT_CODE_PREFIX}010`, '10.0.0.1')

    expect(result).toMatchObject({ success: true, type: 'resident', code: 'RES-010' })
    expect(mockUserFindFirst).not.toHaveBeenCalled()
  })
})

describe('loginByCode — unknown prefixes', () => {
  it('rejects a code with no recognised prefix', async () => {
    const result = await loginByCode('XYZ-12345', '10.0.0.1')
    expect(result).toMatchObject({ success: false })
  })

  it('names both prefixes in the error so the user can self-correct', async () => {
    const result = await loginByCode('nonsense', '10.0.0.1')
    if (result.success) throw new Error('expected failure')
    expect(result.error).toContain(RESIDENT_CODE_PREFIX)
  })
})
