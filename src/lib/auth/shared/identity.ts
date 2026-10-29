/**
 * AOZ's half of the shared account: which staff and resident identities a
 * shared user holds, and what one session of it may open.
 *
 * AccountKit owns credentials, sessions and recovery. AOZ owns this mapping
 * (`AccountIdentity`), the per-session scope (`AccountSessionScope`) and every
 * authorization question, which is answered from the ROWS on every request —
 * never from what was true when the session began.
 *
 * Nothing here reads an email to decide who someone is.
 */
import { and, eq } from 'drizzle-orm'
import { ALL_CODE_PREFIXES } from '@/lib/config/brand'
import { ALL_RESIDENT_CODE_PREFIXES } from '@/lib/auth/code-prefixes'
import { db, accountIdentity, accountSessionScope, resident, sharedAuthUser, user } from '@/lib/db'
import { effectiveScope } from '../role-policy'
import type { AuthResident, AuthUser } from '../index'

export type IdentitySide = 'staff' | 'resident'

export interface SessionScope {
  /** Null: a full sign-in, every identity the account holds. */
  side: IdentitySide | null
  /** Set only on a borrowed, read-only view. */
  impersonatorStaffId: string | null
  /** On a borrowed view: the opener's own session, to return to. */
  returnSessionId?: string | null
}

export interface SessionIdentities {
  staff: AuthUser | null
  resident: AuthResident | null
}

const NONE: SessionIdentities = { staff: null, resident: null }

/** The side a login code belongs to, by every prefix ever issued. */
export function sideOfCode(code: string): IdentitySide | null {
  if (ALL_CODE_PREFIXES.some((prefix) => code.startsWith(prefix))) return 'staff'
  if (ALL_RESIDENT_CODE_PREFIXES.some((prefix) => code.startsWith(prefix))) return 'resident'
  return null
}

/**
 * The shared user that holds the identity an exact login code names. A
 * deactivated staff code names nobody; an identity the import never mapped
 * names nobody either, rather than being attached to a guess.
 */
export async function sharedUserForCode(
  code: string,
): Promise<{ sharedUserId: string; side: IdentitySide; actorId: string } | null> {
  const side = sideOfCode(code)
  if (side === 'staff') {
    const row = await db.query.user.findFirst({
      where: eq(user.code, code),
      columns: { id: true, active: true },
    })
    if (!row?.active) return null
    return { sharedUserId: await ensureSharedUser(side, row.id), side, actorId: row.id }
  }
  if (side === 'resident') {
    const row = await db.query.resident.findFirst({
      where: eq(resident.code, code),
      columns: { id: true },
    })
    if (!row) return null
    return { sharedUserId: await ensureSharedUser(side, row.id), side, actorId: row.id }
  }
  return null
}

/**
 * The shared user holding an identity, created on first use for one made
 * after the import (a new colleague, an imported resident). It gets exactly
 * what the import gives a code-only identity: a namespaced id and a reserved
 * `.invalid` address that grants no mailbox and collides with nobody. Its
 * person adds a real address and password by claiming it.
 */
export async function ensureSharedUser(side: IdentitySide, actorId: string): Promise<string> {
  const column = side === 'staff' ? accountIdentity.staffId : accountIdentity.residentId
  const mapped = await db.query.accountIdentity.findFirst({
    where: eq(column, actorId),
    columns: { sharedUserId: true },
  })
  if (mapped) return mapped.sharedUserId
  const sharedUserId = `aoz-${side}:${actorId}`
  await db.transaction(async (tx) => {
    await tx
      .insert(sharedAuthUser)
      .values({
        id: sharedUserId,
        name: '',
        email: `aoz-${side}-${actorId.toLowerCase()}@identity.invalid`,
      })
      .onConflictDoNothing()
    await tx
      .insert(accountIdentity)
      .values({ sharedUserId, [side === 'staff' ? 'staffId' : 'residentId']: actorId })
      .onConflictDoNothing()
  })
  // Read back rather than trust the insert: a concurrent first use may have won.
  const winner = await db.query.accountIdentity.findFirst({
    where: eq(column, actorId),
    columns: { sharedUserId: true },
  })
  if (!winner) throw new Error('Identity mapping could not be established')
  return winner.sharedUserId
}

/**
 * Put an invited person's address on their identity's shared user, unverified,
 * so a claim or a recovery mail to it gives them their first password. Only a
 * reserved placeholder is ever replaced: an address someone already signs in
 * with is not moved by an administrator.
 */
export async function attachInvitedEmail(
  side: IdentitySide,
  actorId: string,
  email: string,
): Promise<'attached' | 'has_email' | 'taken'> {
  const sharedUserId = await ensureSharedUser(side, actorId)
  const current = await db.query.sharedAuthUser.findFirst({
    where: eq(sharedAuthUser.id, sharedUserId),
    columns: { email: true },
  })
  if (current && !current.email.endsWith('.invalid')) return 'has_email'
  const owner = await db.query.sharedAuthUser.findFirst({
    where: eq(sharedAuthUser.email, email.toLowerCase()),
    columns: { id: true },
  })
  if (owner) return 'taken'
  await db
    .update(sharedAuthUser)
    .set({ email: email.toLowerCase(), emailVerified: false })
    .where(eq(sharedAuthUser.id, sharedUserId))
  return 'attached'
}

/** The shared user holding a staff identity, for a borrowed view. */
export async function sharedUserForStaff(staffId: string): Promise<string | null> {
  const mapped = await db.query.accountIdentity.findFirst({
    where: eq(accountIdentity.staffId, staffId),
    columns: { sharedUserId: true },
  })
  return mapped?.sharedUserId ?? null
}

/** Record what a new session may open, before its cookie is exposed. */
export async function bindSessionScope(sessionId: string, scope: SessionScope): Promise<void> {
  await db.insert(accountSessionScope).values({ sessionId, ...scope })
}

export async function readSessionScope(sessionId: string): Promise<SessionScope> {
  const row = await db.query.accountSessionScope.findFirst({
    where: eq(accountSessionScope.sessionId, sessionId),
    columns: { side: true, impersonatorStaffId: true, returnSessionId: true },
  })
  return {
    side: (row?.side as IdentitySide | null | undefined) ?? null,
    impersonatorStaffId: row?.impersonatorStaffId ?? null,
    returnSessionId: row?.returnSessionId ?? null,
  }
}

/**
 * Move one identity onto another shared user. Called by AccountKit only after
 * that user proved their own password. Refuses if the target already holds an
 * identity of that side: one account carries at most one staff and one
 * resident identity, as before.
 */
export async function linkIdentity(
  side: IdentitySide,
  actorId: string,
  targetSharedUserId: string,
): Promise<void> {
  const column = side === 'staff' ? accountIdentity.staffId : accountIdentity.residentId
  const field = side === 'staff' ? 'staffId' : 'residentId'
  await db.transaction(async (tx) => {
    const target = await tx.query.accountIdentity.findFirst({
      where: eq(accountIdentity.sharedUserId, targetSharedUserId),
    })
    if (target?.[field] && target[field] !== actorId) {
      throw new Error('The account already holds an identity of this kind')
    }
    if (target?.[field] === actorId) return
    await tx
      .update(accountIdentity)
      .set({ [field]: null })
      .where(eq(column, actorId))
    if (target) {
      await tx
        .update(accountIdentity)
        .set({ [field]: actorId })
        .where(eq(accountIdentity.sharedUserId, targetSharedUserId))
    } else {
      await tx
        .insert(accountIdentity)
        .values({ sharedUserId: targetSharedUserId, [field]: actorId })
    }
  })
}

/**
 * Everything one session may act as, reloaded now.
 *
 * - A deactivated staff identity grants nothing, and costs nobody their
 *   resident access.
 * - A code session opens only its own side.
 * - A borrowed view opens only the staff identity, names its opener, and is
 *   refused if the opener has since lost the right to open it.
 */
export async function identitiesForSession(
  sharedUserId: string,
  scope: SessionScope,
): Promise<SessionIdentities> {
  const [mapped, shared] = await Promise.all([
    db.query.accountIdentity.findFirst({
      where: eq(accountIdentity.sharedUserId, sharedUserId),
      columns: { staffId: true, residentId: true },
    }),
    db.query.sharedAuthUser.findFirst({
      where: eq(sharedAuthUser.id, sharedUserId),
      columns: { email: true },
    }),
  ])
  if (!mapped || !shared) return NONE

  if (scope.impersonatorStaffId) {
    const opener = await db.query.user.findFirst({
      where: and(eq(user.id, scope.impersonatorStaffId), eq(user.active, true)),
      columns: { id: true },
    })
    if (!opener || !mapped.staffId) return NONE
    // The opener's address, not the colleague's: a borrowed view does not
    // hand out the person's contact details.
    const openerIdentity = await db.query.accountIdentity.findFirst({
      where: eq(accountIdentity.staffId, opener.id),
      columns: { sharedUserId: true },
    })
    const openerEmail = openerIdentity
      ? ((
          await db.query.sharedAuthUser.findFirst({
            where: eq(sharedAuthUser.id, openerIdentity.sharedUserId),
            columns: { email: true },
          })
        )?.email ?? '')
      : ''
    return {
      staff: await staffIdentity(mapped.staffId, openerEmail, opener.id),
      resident: null,
    }
  }

  const email = shared.email.endsWith('.invalid') ? '' : shared.email
  return {
    staff:
      mapped.staffId && scope.side !== 'resident'
        ? await staffIdentity(mapped.staffId, email, null)
        : null,
    resident:
      mapped.residentId && scope.side !== 'staff'
        ? await residentIdentity(mapped.residentId)
        : null,
  }
}

async function staffIdentity(
  staffId: string,
  email: string,
  impersonatorId: string | null,
): Promise<AuthUser | null> {
  const row = await db.query.user.findFirst({
    where: eq(user.id, staffId),
    columns: {
      id: true,
      name: true,
      role: true,
      active: true,
      scope: true,
      isSystemAdmin: true,
      siteAccess: true,
    },
    with: { unitAccess: { columns: { housingUnitId: true } } },
  })
  if (!row?.active) return null
  return {
    id: row.id,
    email,
    name: row.name,
    role: row.role,
    scope: effectiveScope(row),
    isSystemAdmin: row.isSystemAdmin,
    siteAccess: row.siteAccess,
    assignedUnitIds:
      row.siteAccess === 'ALL_UNITS' ? [] : (row.unitAccess ?? []).map((r) => r.housingUnitId),
    impersonatorId,
  }
}

async function residentIdentity(residentId: string): Promise<AuthResident | null> {
  const row = await db.query.resident.findFirst({
    where: eq(resident.id, residentId),
    columns: { id: true, code: true },
  })
  return row ?? null
}
