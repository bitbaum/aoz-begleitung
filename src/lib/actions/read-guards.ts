/**
 * Session checks for the READ functions that live in `'use server'` modules.
 *
 * Every export of a `'use server'` file is a Server Action, and Next.js makes
 * each one callable as a POST endpoint. A read exported from such a file is
 * therefore guarded only by whichever page happens to call it — until some
 * client component imports it, and then by nothing. The writes beside them
 * always checked; ten reads did not (care team, assignable staff, care
 * attributes, appointments, staff event and marketplace lists, unit
 * addresses, system config). This module is deliberately NOT `'use server'`,
 * so the guards are not endpoints themselves.
 *
 * Pinned by `__tests__/actions-are-guarded.test.ts`.
 */
import { getCurrentUser, type AuthUser } from '@/lib/auth'
import { getPortalResident } from '@/lib/portal-auth'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

/** A signed-in staff member, or a throw. */
export async function requireStaffReader(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error(ERROR_MESSAGES.AUTH_REQUIRED)
  return user
}

/**
 * A signed-in staff member, or the client the data is about — nobody else.
 * Used by reads both the dossier and the client's own portal call.
 */
export async function requireStaffOrSelf(residentId: string): Promise<void> {
  if (await getCurrentUser()) return
  const self = await getPortalResident()
  if (self?.id === residentId) return
  throw new Error(ERROR_MESSAGES.AUTH_REQUIRED)
}
