/**
 * Who this request is, from a shared session: read once per request, with
 * every authorization fact reloaded from the rows (./identity).
 */
import { cache } from 'react'
import { cookies } from 'next/headers'
import { cookieFor, deleteSharedSession, type SessionCookie } from './borrowed'
import { identitiesForSession, readSessionScope, type SessionIdentities } from './identity'
import { sharedAuth } from './runtime'

const SIGNED_OUT: SessionIdentities = { staff: null, resident: null }

export const getSharedIdentities = cache(async (): Promise<SessionIdentities> => {
  const session = await sharedAuth.getSession()
  if (!session) return SIGNED_OUT
  return identitiesForSession(session.user.id, await readSessionScope(session.session.id))
})

/**
 * The proxy's question: who is this, and is it a borrowed view? The scope is
 * returned even when nobody resolves (a borrowed view whose opener was
 * deactivated), because read-only must hold for exactly that session too.
 */
export async function sharedRequestFor(requestHeaders: Headers): Promise<{
  identities: SessionIdentities
  borrowed: boolean
}> {
  const session = await sharedAuth.sessionFor(requestHeaders).catch(() => null)
  if (!session) return { identities: SIGNED_OUT, borrowed: false }
  const scope = await readSessionScope(session.session.id)
  return {
    identities: await identitiesForSession(session.user.id, scope),
    borrowed: scope.impersonatorStaffId !== null,
  }
}

/** The raw shared session of this request (id and token), for the routes that end or swap it. */
export const getSharedSession = cache(async () => sharedAuth.getSession())

/** Write a session cookie decided by ./borrowed onto this response. */
export async function writeSessionCookie(cookie: SessionCookie): Promise<void> {
  const store = await cookies()
  store.set(cookie.name, cookie.value, cookie.options)
}

/** Sign out: the shared session is deleted, not just forgotten by this browser. */
export async function endSharedSession(): Promise<void> {
  const current = await getSharedSession()
  if (current) {
    await deleteSharedSession(current.session.id)
  }
  await writeSessionCookie(await cookieFor(null))
}
