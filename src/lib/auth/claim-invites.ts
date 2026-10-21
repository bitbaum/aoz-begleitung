/**
 * Claim links: how a real colleague takes over the staff account that was
 * provisioned for them.
 *
 * An administrator issues a link for ONE person. It is single-use, expires
 * after CLAIM_INVITE_TTL_MS, and only its SHA-256 hash is stored. Opening it
 * lets that person set their own email + password (the normal account flow,
 * `registerAccount`), after which they sign in like everyone else.
 *
 * This replaced the public one-click quick-access buttons on /login, which
 * signed anyone holding the URL into real, named staff accounts.
 */

import { createHash, randomBytes } from 'crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db, claimInvite, user, account } from '@/lib/db'

export const CLAIM_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000

export function hashClaimToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/** The public path a claim link opens. */
export function claimPath(raw: string): string {
  return `/claim?token=${encodeURIComponent(raw)}`
}

export type IssueResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: 'not_found' | 'already_claimed' }

/**
 * Issue a fresh link for a staff member, revoking every earlier unused one —
 * only the newest link works.
 */
export async function issueClaimInvite(
  userId: string,
  createdById: string | null,
  now: Date = new Date(),
): Promise<IssueResult> {
  const target = await db.query.user.findFirst({
    where: and(eq(user.id, userId), eq(user.active, true)),
    columns: { id: true },
  })
  if (!target) return { ok: false, reason: 'not_found' }

  const existing = await db.query.account.findFirst({
    where: eq(account.userId, userId),
    columns: { passwordHash: true },
  })
  // Already has a password: they sign in normally / reset via email.
  if (existing?.passwordHash) return { ok: false, reason: 'already_claimed' }

  await revokeClaimInvites(userId, now)

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(now.getTime() + CLAIM_INVITE_TTL_MS)
  await db.insert(claimInvite).values({
    userId,
    createdById,
    tokenHash: hashClaimToken(token),
    expiresAt,
  })
  return { ok: true, token, expiresAt }
}

/** Revoke every still-open link for a person. */
export async function revokeClaimInvites(userId: string, now: Date = new Date()): Promise<void> {
  await db
    .update(claimInvite)
    .set({ revokedAt: now })
    .where(
      and(
        eq(claimInvite.userId, userId),
        isNull(claimInvite.usedAt),
        isNull(claimInvite.revokedAt),
      ),
    )
}

function openWhere(raw: string, now: Date) {
  return and(
    eq(claimInvite.tokenHash, hashClaimToken(raw)),
    isNull(claimInvite.usedAt),
    isNull(claimInvite.revokedAt),
    gt(claimInvite.expiresAt, now),
  )
}

/**
 * Who a link is for, without using it up — so the page can greet the person.
 * Null for unknown, used, revoked or expired links (one generic answer).
 */
export async function peekClaimInvite(
  raw: string,
  now: Date = new Date(),
): Promise<{ name: string } | null> {
  if (!raw) return null
  const row = await db.query.claimInvite.findFirst({
    where: openWhere(raw, now),
    columns: { id: true },
    with: { user: { columns: { name: true, active: true } } },
  })
  if (!row?.user?.active) return null
  return { name: row.user.name }
}

/**
 * Atomically take the link: marks it used and returns the staff code behind it,
 * or null. If the account step afterwards fails, call `releaseClaimInvite` so
 * the person can try again with the same link.
 */
export async function takeClaimInvite(
  raw: string,
  now: Date = new Date(),
): Promise<{ id: string; code: string } | null> {
  if (!raw) return null
  const [taken] = await db
    .update(claimInvite)
    .set({ usedAt: now })
    .where(openWhere(raw, now))
    .returning({ id: claimInvite.id, userId: claimInvite.userId })
  if (!taken) return null
  const staff = await db.query.user.findFirst({
    where: and(eq(user.id, taken.userId), eq(user.active, true)),
    columns: { code: true },
  })
  if (!staff) return null
  return { id: taken.id, code: staff.code }
}

export async function releaseClaimInvite(id: string): Promise<void> {
  await db.update(claimInvite).set({ usedAt: null }).where(eq(claimInvite.id, id))
}
