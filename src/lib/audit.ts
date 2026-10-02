/**
 * Audit logging utilities for tracking important changes
 * SSOT for audit log creation
 *
 * Auth-ready: Automatically captures current user when auth is implemented
 */

import { db, auditLog, user } from '@/lib/db'
import { and, eq, desc } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { QUERY_LIMITS } from '@/lib/config/thresholds'

export type AuditAction =
  'CREATE' | 'UPDATE' | 'DELETE' | 'END' | 'TRANSFER' | 'RESOLVE' | 'ARCHIVE' | 'RESTORE'

export type AuditEntity =
  | 'RESIDENT'
  | 'HOUSING_UNIT'
  | 'SPOT'
  | 'PLACEMENT'
  | 'INCIDENT'
  | 'MAINTENANCE'
  | 'CHECK_IN'
  | 'HOUSEHOLD_TASK'
  | 'TRANSFER_REQUEST'
  | 'ACTIVITY'
  | 'HOUSE_RULE'
  | 'PROPOSAL'
  | 'CONFLICT_AGREEMENT'
  | 'EXPENSE'
  | 'MESSAGE'
  | 'SETTLEMENT'
  | 'RESIDENT_PROFILE'
  | 'OPPORTUNITY'
  | 'OPPORTUNITY_APPLICATION'
  // A staff account as the SUBJECT of an action — currently opening and
  // closing a borrowed view. Distinct from the `userId` on every other entry,
  // which records who ACTED; here the staff member is what was acted upon.
  | 'STAFF_USER'
  // Facts a client keeps about their own admin life. Audited like everything
  // else, and for the same reason: these entries are how a client can later
  // establish that they DID enter their insurance in good time, which is
  // exactly the dispute the paper-and-inbox version left unresolvable.
  | 'CLIENT_INSURANCE'
  | 'CLIENT_HEALTH_CONTACT'
  | 'CLIENT_PERMIT'
  // A saved filter over the client list — a view, audited because it can
  // become the audience of a message to many people.
  | 'CLIENT_GROUP'
  // A survey as STAFF act on it: created, opened (with a COUNT of invitations,
  // never the list), closed. A client's answer is never audited — "resident X
  // answered survey Y" is exactly the record the survey promises not to keep.
  | 'SURVEY'

interface AuditLogEntry {
  action: AuditAction
  entity: AuditEntity
  entityId: string
  userId?: string // Optional: will auto-capture from session if not provided
  // The jsonb column types as `unknown` — anything JSON-serialisable is fine.
  changes?: unknown
  reason?: string
}

/**
 * Create an audit log entry
 * Non-blocking - failures are logged but don't throw
 *
 * Auth-ready: If userId not provided, attempts to get from current session
 * During pilot: userId will be null (no auth)
 * After auth: userId will be automatically captured
 */
export async function logAudit({
  action,
  entity,
  entityId,
  userId,
  changes,
  reason,
}: AuditLogEntry): Promise<void> {
  try {
    // Auto-capture user from session if not explicitly provided
    let resolvedUserId = userId
    if (!resolvedUserId) {
      const currentUser = await getCurrentUser()
      resolvedUserId = currentUser?.id
    }

    await db.insert(auditLog).values({
      action,
      entity,
      entityId,
      userId: resolvedUserId,
      changes: changes ?? undefined,
      reason,
    })
  } catch (error) {
    // Log error but don't throw - audit logging should never break operations
    // Audit logging should never break operations — log and swallow
    logger.errorWithCause('Audit log failed', error, { action, entity, entityId })
  }
}

/**
 * The history of one thing: who changed this client, or this flat, and when.
 *
 * Scoped to ONE entity and one id, which is what keeps it safe to show beside
 * the record itself. A client's page shows `RESIDENT` entries only — the
 * client-fact tables log under their own entity names, so a Jobcoach reading a
 * dossier cannot learn from here that an insurance entry exists, let alone
 * what it says.
 *
 * Returns the same shape as `getRecentAuditLogs` so one component renders both
 * and the two surfaces cannot describe an entry differently.
 */
export async function getEntityAuditLog(
  entity: AuditEntity,
  entityId: string,
): Promise<AuditEntry[]> {
  return db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      reason: auditLog.reason,
      actorName: user.name,
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.userId, user.id))
    .where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, entityId)))
    .orderBy(desc(auditLog.createdAt))
    .limit(QUERY_LIMITS.entityHistory)
}

/** One audit row with the acting staff member resolved to a name. */
export interface AuditEntry {
  id: string
  createdAt: Date
  action: string
  entity: string
  entityId: string
  reason: string | null
  /** Null for a system action, or where the acting account has since been deleted. */
  actorName: string | null
}

/**
 * Recent audit entries, newest first, optionally narrowed to one entity type.
 *
 * The name is joined here rather than in the page: a bare `userId` renders as
 * an opaque id, which is the same as not recording who acted. `userId` is
 * `ON DELETE SET NULL`, so a null actor is a real state and not an error —
 * the entry survives the account, which is the point of keeping it.
 */
export async function getRecentAuditLogs(limit = 100, entity?: AuditEntity): Promise<AuditEntry[]> {
  const rows = await db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      reason: auditLog.reason,
      actorName: user.name,
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.userId, user.id))
    .where(entity ? eq(auditLog.entity, entity) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)

  return rows
}
