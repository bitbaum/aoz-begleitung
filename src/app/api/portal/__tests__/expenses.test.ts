/**
 * Tests for the shared-expenses portal API
 *
 * Endpoints:
 *   POST   /api/portal/expenses       — record an expense (equal split)
 *   DELETE /api/portal/expenses/[id]  — delete (payer or creator only)
 *   POST   /api/portal/settlements    — record a payment between roommates
 */

import { NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

// --- Mocks ---

const mockGetPortalAuth = vi.fn()
const mockGetActiveUnitMembers = vi.fn()
vi.mock('@/lib/portal-auth', async () => ({
  getPortalAuth: () => mockGetPortalAuth(),
  getActiveUnitMembers: (...args: unknown[]) => mockGetActiveUnitMembers(...args),
}))

// The expense route inserts Expense + ExpenseShare rows inside one
// transaction; shares get their own mock so the split stays assertable.
const mockExpenseCreate = vi.fn()
const mockShareCreate = vi.fn()
const mockExpenseFindFirst = vi.fn()
const mockExpenseDelete = vi.fn()
const mockSettlementCreate = vi.fn()
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db')
  return {
    ...actual,
    db: {
      query: {
        expense: { findFirst: (...args: unknown[]) => mockExpenseFindFirst(...args) },
      },
      // Top-level insert is only used for settlements.
      insert: () => ({
        values: (v: unknown) => ({ returning: (): Promise<unknown[]> => mockSettlementCreate(v) }),
      }),
      delete: () => ({ where: (w: unknown): Promise<unknown> => mockExpenseDelete(w) }),
      transaction: (fn: (tx: unknown) => unknown) =>
        fn({
          insert: (table: unknown) => ({
            values: (v: unknown) => ({
              returning: (): Promise<unknown[]> =>
                table === actual.expense ? mockExpenseCreate(v) : mockShareCreate(v),
            }),
          }),
        }),
    },
  }
})

const mockLogAudit = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/audit', async () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
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

import { POST as createExpense } from '../expenses/route'
import { DELETE as deleteExpense } from '../expenses/[id]/route'
import { POST as createSettlement } from '../settlements/route'
import { expense } from '@/lib/db'
import { eq } from 'drizzle-orm'

// --- Helpers ---

const AUTH = {
  resident: { id: 'georgy', code: 'RES-GEO001' },
  placement: { id: 'placement-1', housingUnitId: 'unit-1' },
}

const MEMBERS = [
  { id: 'amara', code: 'RES-AMA001', displayName: 'Amara', photoVersion: null },
  { id: 'georgy', code: 'RES-GEO001', displayName: 'Georgy', photoVersion: null },
  { id: 'hana', code: 'RES-HAN001', displayName: 'Hana', photoVersion: null },
  { id: 'noor', code: 'RES-NOO001', displayName: 'Noor', photoVersion: null },
]

function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_EXPENSE = { description: 'Wocheneinkauf', category: 'GROCERIES', amountRappen: 4000 }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetPortalAuth.mockResolvedValue(AUTH)
  mockGetActiveUnitMembers.mockResolvedValue(MEMBERS)
  mockExpenseCreate.mockImplementation((values: unknown) =>
    Promise.resolve([{ id: 'expense-1', ...(values as object) }]),
  )
  mockShareCreate.mockImplementation((rows: unknown) => Promise.resolve(rows as unknown[]))
  mockSettlementCreate.mockImplementation((values: unknown) =>
    Promise.resolve([{ id: 'settlement-1', ...(values as object) }]),
  )
})

describe('POST /api/portal/expenses', () => {
  it('returns 401 without a session', async () => {
    mockGetPortalAuth.mockResolvedValue(null)
    const response = await createExpense(jsonRequest('/api/portal/expenses', 'POST', VALID_EXPENSE))
    expect(response.status).toBe(401)
  })

  it('creates an equal split across all unit members by default', async () => {
    const response = await createExpense(jsonRequest('/api/portal/expenses', 'POST', VALID_EXPENSE))
    expect(response.status).toBe(200)

    const created = mockExpenseCreate.mock.calls[0][0]
    expect(created.paidById).toBe('georgy')
    expect(created.createdById).toBe('georgy')
    const shares = mockShareCreate.mock.calls[0][0] as {
      residentId: string
      amountRappen: number
      expenseId: string
    }[]
    expect(shares).toHaveLength(4)
    expect(shares.reduce((a, s) => a + s.amountRappen, 0)).toBe(4000)
    expect(shares.every((s) => s.expenseId === 'expense-1')).toBe(true)
  })

  it('allows recording on behalf of another roommate with chosen participants', async () => {
    const response = await createExpense(
      jsonRequest('/api/portal/expenses', 'POST', {
        ...VALID_EXPENSE,
        paidById: 'hana',
        participantIds: ['hana', 'noor'],
      }),
    )
    expect(response.status).toBe(200)
    const created = mockExpenseCreate.mock.calls[0][0]
    expect(created.paidById).toBe('hana')
    expect(created.createdById).toBe('georgy')
    expect(mockShareCreate.mock.calls[0][0]).toHaveLength(2)
  })

  it('rejects a payer who does not live in the unit', async () => {
    const response = await createExpense(
      jsonRequest('/api/portal/expenses', 'POST', { ...VALID_EXPENSE, paidById: 'stranger' }),
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe(ERROR_MESSAGES.EXPENSE_MEMBER_INVALID)
    expect(mockExpenseCreate).not.toHaveBeenCalled()
  })

  it('rejects participants who do not live in the unit', async () => {
    const response = await createExpense(
      jsonRequest('/api/portal/expenses', 'POST', {
        ...VALID_EXPENSE,
        participantIds: ['georgy', 'stranger'],
      }),
    )
    expect(response.status).toBe(400)
    expect(mockExpenseCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['unknown category', { ...VALID_EXPENSE, category: 'CRYPTO' }],
    ['zero amount', { ...VALID_EXPENSE, amountRappen: 0 }],
    ['negative amount', { ...VALID_EXPENSE, amountRappen: -100 }],
    ['fractional amount', { ...VALID_EXPENSE, amountRappen: 12.5 }],
    ['empty description', { ...VALID_EXPENSE, description: '   ' }],
  ])('rejects %s with 400', async (_label, body) => {
    const response = await createExpense(jsonRequest('/api/portal/expenses', 'POST', body))
    expect(response.status).toBe(400)
    expect(mockExpenseCreate).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/portal/expenses/[id]', () => {
  const EXPENSE = {
    id: 'expense-1',
    housingUnitId: 'unit-1',
    paidById: 'hana',
    createdById: 'georgy',
    amountRappen: 4000,
  }

  function del(id = 'expense-1') {
    return deleteExpense(
      new NextRequest(`http://localhost/api/portal/expenses/${id}`, { method: 'DELETE' }),
      {
        params: Promise.resolve({ id }),
      },
    )
  }

  it('lets the creator delete', async () => {
    mockExpenseFindFirst.mockResolvedValue(EXPENSE)
    const response = await del()
    expect(response.status).toBe(200)
    expect(mockExpenseDelete).toHaveBeenCalledWith(eq(expense.id, 'expense-1'))
  })

  it('lets the payer delete', async () => {
    mockExpenseFindFirst.mockResolvedValue({ ...EXPENSE, paidById: 'georgy', createdById: 'hana' })
    const response = await del()
    expect(response.status).toBe(200)
  })

  it('refuses an uninvolved roommate with 403', async () => {
    mockExpenseFindFirst.mockResolvedValue({ ...EXPENSE, paidById: 'noor', createdById: 'amara' })
    const response = await del()
    expect(response.status).toBe(403)
    expect(mockExpenseDelete).not.toHaveBeenCalled()
  })

  it("hides another unit's expense as 404", async () => {
    mockExpenseFindFirst.mockResolvedValue({ ...EXPENSE, housingUnitId: 'unit-2' })
    const response = await del()
    expect(response.status).toBe(404)
    expect(mockExpenseDelete).not.toHaveBeenCalled()
  })
})

describe('POST /api/portal/settlements', () => {
  it('records a payment to a roommate', async () => {
    const response = await createSettlement(
      jsonRequest('/api/portal/settlements', 'POST', { toResidentId: 'hana', amountRappen: 1500 }),
    )
    expect(response.status).toBe(200)
    const created = mockSettlementCreate.mock.calls[0][0]
    expect(created).toMatchObject({ fromId: 'georgy', toId: 'hana', amountRappen: 1500 })
  })

  it('refuses paying yourself', async () => {
    const response = await createSettlement(
      jsonRequest('/api/portal/settlements', 'POST', {
        toResidentId: 'georgy',
        amountRappen: 1500,
      }),
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe(ERROR_MESSAGES.SETTLEMENT_SELF)
  })

  it('refuses a receiver outside the unit', async () => {
    const response = await createSettlement(
      jsonRequest('/api/portal/settlements', 'POST', {
        toResidentId: 'stranger',
        amountRappen: 1500,
      }),
    )
    expect(response.status).toBe(400)
    expect(mockSettlementCreate).not.toHaveBeenCalled()
  })
})
