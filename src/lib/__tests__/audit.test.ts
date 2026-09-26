/**
 * Tests for audit logging (src/lib/audit.ts)
 *
 * Covers: logAudit (auto userId capture, non-blocking error swallowing),
 * getEntityAuditLog, and getRecentAuditLogs.
 */

import { logAudit, getEntityAuditLog, getRecentAuditLogs } from '../audit'
import { auditLog } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { whereParts } from '@/test-utils/drizzle-where'

// =============================================================================
// MOCKS
// =============================================================================

const mockAuditLogCreate = vi.fn()
const mockAuditLogFindMany = vi.fn()

// `getRecentAuditLogs` builds a select/leftJoin rather than a relational
// findMany, because the acting user's NAME has to come back with the row — a
// bare userId renders as an opaque id, which records nothing a human can act
// on. These spies capture each step of that builder.
const mockSelectColumns = vi.fn()
const mockLeftJoin = vi.fn()
const mockWhere = vi.fn()
const mockOrderBy = vi.fn()
const mockLimit = vi.fn()
const mockSelectRows = vi.fn<() => unknown[]>(() => [])

function selectChain() {
  const chain = {
    from: () => chain,
    leftJoin: (...args: unknown[]) => {
      mockLeftJoin(...args)
      return chain
    },
    where: (...args: unknown[]) => {
      mockWhere(...args)
      return chain
    },
    orderBy: (...args: unknown[]) => {
      mockOrderBy(...args)
      return chain
    },
    limit: (n: number) => {
      mockLimit(n)
      return Promise.resolve(mockSelectRows())
    },
  }
  return chain
}

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    insert: () => ({ values: (v: unknown) => Promise.resolve(mockAuditLogCreate(v)) }),
    select: (columns: unknown) => {
      mockSelectColumns(columns)
      return selectChain()
    },
    query: {
      auditLog: { findMany: (...args: unknown[]) => mockAuditLogFindMany(...args) },
    },
  },
}))

const mockGetCurrentUser = vi.fn()

vi.mock('@/lib/auth', async () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}))

vi.mock('@/lib/logger', async () => ({
  logger: {
    errorWithCause: vi.fn(),
  },
}))

// =============================================================================
// TESTS
// =============================================================================

describe('logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuditLogCreate.mockResolvedValue({})
    mockGetCurrentUser.mockResolvedValue(null)
  })

  // ── Basic creation ────────────────────────────────────────────────────────

  test('creates an audit log entry with provided fields', async () => {
    await logAudit({
      action: 'CREATE',
      entity: 'RESIDENT',
      entityId: 'res-123',
      userId: 'user-1',
      reason: 'Test reason',
    })

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'RESIDENT',
        entityId: 'res-123',
        userId: 'user-1',
        reason: 'Test reason',
      }),
    )
  })

  test('includes changes field when provided', async () => {
    const changes = { name: { from: 'Old', to: 'New' } }

    await logAudit({
      action: 'UPDATE',
      entity: 'RESIDENT',
      entityId: 'res-123',
      userId: 'user-1',
      changes,
    })

    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ changes }))
  })

  // ── Auto userId capture ───────────────────────────────────────────────────

  test('auto-captures userId from getCurrentUser when not provided', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'auto-user-id' })

    await logAudit({
      action: 'DELETE',
      entity: 'SPOT',
      entityId: 'spot-456',
    })

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'auto-user-id' }),
    )
  })

  test('uses null userId when getCurrentUser returns null and userId not provided', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    await logAudit({
      action: 'CREATE',
      entity: 'PLACEMENT',
      entityId: 'placement-789',
    })

    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined }))
  })

  test('explicit userId takes precedence over getCurrentUser', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'session-user' })

    await logAudit({
      action: 'UPDATE',
      entity: 'INCIDENT',
      entityId: 'inc-1',
      userId: 'explicit-user',
    })

    // getCurrentUser should NOT be called when userId is explicit
    expect(mockGetCurrentUser).not.toHaveBeenCalled()
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'explicit-user' }),
    )
  })

  // ── Non-blocking error handling ───────────────────────────────────────────

  test('does not throw when the audit insert fails', async () => {
    mockAuditLogCreate.mockRejectedValue(new Error('DB connection lost'))

    await expect(
      logAudit({ action: 'CREATE', entity: 'RESIDENT', entityId: 'res-1' }),
    ).resolves.toBeUndefined()
  })

  test('logs the error via logger when create fails', async () => {
    const { logger } = await import('@/lib/logger')
    const error = new Error('Constraint violation')
    mockAuditLogCreate.mockRejectedValue(error)

    await logAudit({ action: 'CREATE', entity: 'RESIDENT', entityId: 'res-1' })

    expect(logger.errorWithCause).toHaveBeenCalledWith(
      expect.stringContaining('Audit log failed'),
      error,
      expect.any(Object),
    )
  })

  test('does not throw when getCurrentUser fails', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('Auth service down'))

    await expect(
      logAudit({ action: 'CREATE', entity: 'RESIDENT', entityId: 'res-1' }),
    ).resolves.toBeUndefined()
  })
})

// =============================================================================

describe('getEntityAuditLog', () => {
  // Now a select/leftJoin like its sibling, because the acting user's NAME has
  // to come back with the row: the history is shown beside a client's dossier,
  // and "cmsr…8vz changed this" records nothing a person can act on.
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectRows.mockReturnValue([])
  })

  test('queries by entity type and entityId', async () => {
    await getEntityAuditLog('RESIDENT', 'res-123')

    // Both halves matter: the entityId alone would mix a client's own history
    // with anything else sharing that id, and the entity alone would return
    // every client's.
    expect(whereParts(mockWhere.mock.calls[0]?.[0])).toEqual({
      entity: 'RESIDENT',
      entityId: 'res-123',
    })
  })

  test('orders results by createdAt descending', async () => {
    await getEntityAuditLog('PLACEMENT', 'p-1')

    expect(mockOrderBy).toHaveBeenCalledWith(desc(auditLog.createdAt))
  })

  test('limits results to 50', async () => {
    await getEntityAuditLog('INCIDENT', 'i-1')

    expect(mockLimit).toHaveBeenCalledWith(50)
  })

  test('joins the acting account so the row carries a name', async () => {
    await getEntityAuditLog('RESIDENT', 'res-1')

    expect(mockLeftJoin).toHaveBeenCalled()
    expect(mockSelectColumns).toHaveBeenCalledWith(
      expect.objectContaining({ actorName: expect.anything() }),
    )
  })

  test('returns the rows the query hands back', async () => {
    const entries = [{ id: 'log-1', action: 'CREATE', actorName: 'Anna Muster' }]
    mockSelectRows.mockReturnValue(entries)

    await expect(getEntityAuditLog('RESIDENT', 'res-1')).resolves.toEqual(entries)
  })
})

// =============================================================================

describe('getRecentAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectRows.mockReturnValue([])
  })

  test('orders results by createdAt descending', async () => {
    await getRecentAuditLogs()

    expect(mockOrderBy).toHaveBeenCalledWith(desc(auditLog.createdAt))
  })

  test('defaults to limit 100', async () => {
    await getRecentAuditLogs()

    expect(mockLimit).toHaveBeenCalledWith(100)
  })

  test('respects custom limit', async () => {
    await getRecentAuditLogs(25)

    expect(mockLimit).toHaveBeenCalledWith(25)
  })

  test('joins the acting account so the row carries a name', () => {
    // Without this the page shows an id, and "who made the decision" — which
    // CLAUDE.md promises for every placement — is recorded but unreadable.
    return getRecentAuditLogs().then(() => {
      expect(mockLeftJoin).toHaveBeenCalled()
      expect(mockSelectColumns).toHaveBeenCalledWith(
        expect.objectContaining({ actorName: expect.anything() }),
      )
    })
  })

  test('narrows to one entity when asked', async () => {
    await getRecentAuditLogs(50, 'STAFF_USER')

    // The borrowed-view entries have to be findable on their own; in a flat
    // feed the other write sites drown them.
    expect(whereParts(mockWhere.mock.calls[0]?.[0]).entity).toBe('STAFF_USER')
  })

  test('applies no filter when no entity is given', async () => {
    await getRecentAuditLogs()

    expect(mockWhere).toHaveBeenCalledWith(undefined)
  })

  test('returns the rows the query hands back', async () => {
    const rows = [{ id: 'log-1', action: 'UPDATE', actorName: 'Anna Muster' }]
    mockSelectRows.mockReturnValue(rows)

    await expect(getRecentAuditLogs()).resolves.toEqual(rows)
  })
})
