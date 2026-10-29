/**
 * "Ansicht wechseln" on shared sessions. @see ../impersonation.ts for why the
 * session becomes the colleague's and why it is read-only.
 *
 * Opening creates a real shared session for the colleague's account, scoped to
 * their staff side, naming the administrator and remembering the
 * administrator's own session. Closing deletes the borrowed session and
 * returns to that one only if it still lives; nothing new is minted for the
 * administrator, so closing a view can never widen what they had.
 */
import { makeSignature } from 'better-auth/crypto'
import { bindSessionScope, readSessionScope, sharedUserForStaff } from './identity'
import { sharedAuth } from './runtime'

export interface SessionCookie {
  name: string
  value: string
  options: Record<string, unknown>
}

export async function cookieFor(token: string | null, expiresAt?: Date): Promise<SessionCookie> {
  const ctx = await sharedAuth.getAuth().$context
  const { name, attributes } = ctx.authCookies.sessionToken
  if (!token) return { name, value: '', options: { ...attributes, maxAge: 0 } }
  return {
    name,
    value: encodeURIComponent(`${token}.${await makeSignature(token, ctx.secret)}`),
    options: { ...attributes, ...(expiresAt ? { expires: expiresAt } : {}) },
  }
}

export async function openBorrowedSession(args: {
  targetStaffId: string
  openerStaffId: string
  openerSessionId: string
}): Promise<SessionCookie | null> {
  const sharedUserId = await sharedUserForStaff(args.targetStaffId)
  if (!sharedUserId) return null
  const ctx = await sharedAuth.getAuth().$context
  // A colleague's account holds a staff identity, so the view gets the staff
  // idle limit (runtime.ts, sessionLifetime) like any staff session.
  const session = await ctx.internalAdapter.createSession(sharedUserId)
  if (!session) return null
  try {
    await bindSessionScope(session.id, {
      side: 'staff',
      impersonatorStaffId: args.openerStaffId,
      returnSessionId: args.openerSessionId,
    })
  } catch (error) {
    await ctx.internalAdapter.deleteSession(session.token)
    throw error
  }
  return cookieFor(session.token, session.expiresAt)
}

/** Delete one shared session (its scope row goes with it). */
export async function deleteSharedSession(sessionId: string): Promise<void> {
  const ctx = await sharedAuth.getAuth().$context
  await ctx.adapter.delete({ model: 'session', where: [{ field: 'id', value: sessionId }] })
}

/** End a borrowed view: the opener's session if it still lives, else signed out. */
export async function closeBorrowedSession(borrowedSessionId: string): Promise<SessionCookie> {
  const ctx = await sharedAuth.getAuth().$context
  const scope = await readSessionScope(borrowedSessionId)
  await deleteSharedSession(borrowedSessionId)
  if (!scope.returnSessionId) return cookieFor(null)
  const original = await ctx.adapter.findOne<{ token: string; expiresAt: Date }>({
    model: 'session',
    where: [{ field: 'id', value: scope.returnSessionId }],
  })
  if (!original || new Date(original.expiresAt) <= new Date()) return cookieFor(null)
  return cookieFor(original.token, new Date(original.expiresAt))
}
