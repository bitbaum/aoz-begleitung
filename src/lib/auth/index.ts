/**
 * Authentication Module
 *
 * Provides session management for staff and residents.
 * Uses stateless JWT tokens stored in httpOnly cookies.
 */
import { ALL_CODE_PREFIXES, BRAND } from '@/lib/config/brand'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, user, resident } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { AUTH_CONFIG } from './config'
import { RESIDENT_COOKIE } from '@/lib/portal-auth'
import { ALL_RESIDENT_CODE_PREFIXES, RESIDENT_CODE_PREFIX } from '@/lib/auth/code-prefixes'
import {
  createToken,
  verifyToken,
  shouldRefreshToken,
  refreshToken,
  type TokenPayload,
} from './jwt'
import { recordLoginAttempt, clearLoginAttempts } from './rate-limit'
import {
  canRoleAccess,
  hasPermission,
  type StaffCapabilities,
  type StaffPermission,
  type StaffRole,
} from './role-policy'
import type { SiteCapabilities } from './site-access'
import { IMPERSONATION_CLAIM } from './impersonation'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

// Re-export types
export type { TokenPayload }
export type { StaffRole, StaffPermission }
export { hasPermission, canRoleAccess, STAFF_ROLES, isStaffRole } from './role-policy'

// Types for auth
/**
 * The signed-in staff member, with everything a permission question needs.
 *
 * `scope` and `isSystemAdmin` are read from the DATABASE on every request, not
 * from the JWT. Privileges in a token go stale: revoking someone's oversight
 * would not take effect until the token expired, and with sliding refresh that
 * is indefinitely — the same failure the `active` re-check already exists to
 * prevent. The row is fetched anyway for that check, so this costs nothing.
 */
export interface AuthUser extends StaffCapabilities, SiteCapabilities {
  id: string
  email: string // JWT still carries email (may be empty string for code-only users)
  name: string
  role: StaffRole
  /**
   * Who opened this view, or null when the session is the person's own.
   *
   * REQUIRED, not optional — the same rule `NamedResident.displayName`
   * follows, for the same reason. `null` means "this is my own session"; a
   * missing field would mean "nobody asked", and a banner that decides whether
   * to warn you must never confuse those two. Optional here would let a caller
   * construct an AuthUser that type-checks while silently claiming to be a
   * real session.
   */
  impersonatorId: string | null
}

export interface AuthResident {
  id: string
  code: string
}

export type LoginByCodeResult =
  | { success: true; type: 'staff'; user: AuthUser }
  | { success: true; type: 'resident'; code: string }
  | { success: false; error: string }

/**
 * Get current staff user from session cookie
 * Returns null if not logged in or session invalid
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_CONFIG.cookie.name)?.value

  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  // A session must not outlive the account. The JWT alone would keep a
  // deactivated user (offboarded staff, retired demo account) signed in
  // until token expiry — with sliding refresh, indefinitely.
  const row = await db.query.user.findFirst({
    where: eq(user.id, payload.sub),
    columns: {
      active: true,
      scope: true,
      isSystemAdmin: true,
      siteAccess: true,
    },
    // Only the ids, and only when they can matter. An ALL_UNITS viewer —
    // everyone, until somebody is deliberately narrowed — carries an empty
    // list that nothing reads, so the common request does not grow a join.
    with: {
      unitAccess: { columns: { housingUnitId: true } },
    },
  })
  if (!row?.active) return null

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    // From the row, never the token — see the AuthUser docstring. Site access
    // belongs in that same sentence: revoking someone's reach must take effect
    // on the next request, not at token expiry, which with sliding refresh is
    // indefinitely.
    scope: row.scope,
    isSystemAdmin: row.isSystemAdmin,
    siteAccess: row.siteAccess,
    // `?? []` guards a future caller that forgets to select the relation.
    // The column is NOT NULL with a default, so absence is impossible in
    // production — but this is the auth path, and an incomplete select should
    // narrow someone's reach, never throw and take the whole request down.
    assignedUnitIds:
      row.siteAccess === 'ALL_UNITS' ? [] : (row.unitAccess ?? []).map((r) => r.housingUnitId),
    // From the TOKEN, deliberately — unlike scope and siteAccess above. Those
    // are privileges, which must not go stale. This one is a fact about how
    // this particular session was opened, and the session is exactly what the
    // token describes. There is nowhere else it could be read from.
    impersonatorId: payload[IMPERSONATION_CLAIM] ?? null,
  }
}

/**
 * Get token payload for middleware use (no cookie access needed)
 */
export async function getTokenPayload(token: string): Promise<TokenPayload | null> {
  return verifyToken(token)
}

/**
 * Check if token should be refreshed and return new token if so
 */
export async function maybeRefreshToken(token: string): Promise<string | null> {
  const payload = await verifyToken(token)
  if (!payload) return null

  if (shouldRefreshToken(payload)) {
    return refreshToken(payload)
  }

  return null
}

/**
 * Get current resident from portal session
 * Returns null if not logged in
 */
export async function getCurrentResident(): Promise<AuthResident | null> {
  const cookieStore = await cookies()
  const residentCode = cookieStore.get(RESIDENT_COOKIE)?.value

  if (!residentCode) return null

  // Validate code exists in database
  const row = await db.query.resident.findFirst({
    where: eq(resident.code, residentCode),
    columns: { id: true, code: true },
  })

  if (!row) return null

  return {
    id: row.id,
    code: row.code,
  }
}

/**
 * Require authenticated staff user — throws if not logged in.
 * Use as first line in all mutation server actions.
 */
export async function requireStaffAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error(ERROR_MESSAGES.AUTH_REQUIRED)
  }
  return user
}

/**
 * Check if current user has required role
 * Throws error if not authenticated or insufficient permissions
 */
export async function requireRole(allowedRoles: AuthUser['role'][]): Promise<AuthUser> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error(ERROR_MESSAGES.AUTH_REQUIRED)
  }

  if (!canRoleAccess(allowedRoles, user.role)) {
    throw new Error(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS)
  }

  return user
}

/**
 * Check if current user has required permission
 */
/**
 * Page-level permission gate. REDIRECTS rather than throws.
 *
 * It used to `throw new Error(...)`, which the (admin) error boundary caught
 * and rendered as "Etwas ist schiefgelaufen … Bitte versuchen Sie es erneut".
 * A Jobcoach clicking a button the app itself offered was told the software
 * had failed and asked to retry something that can never succeed.
 *
 * Throwing cannot be rescued at the boundary either: Next strips
 * server-component error messages in production, so `error.tsx` genuinely
 * cannot tell a denial from a real fault. The reliable place to decide is
 * here, where the answer is still known — hence a redirect to a real page
 * that explains what was needed and who has it.
 *
 * @see app/(admin)/kein-zugriff/page.tsx
 * @see authorizeStaff for the API-route form, which returns 401/403 instead.
 */
export async function requirePermission(permission: StaffPermission): Promise<AuthUser> {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!hasPermission(user, permission)) {
    redirect(`/kein-zugriff?needs=${encodeURIComponent(permission)}`)
  }

  return user
}

/**
 * API-route form of the same check: 401 if nobody is signed in, 403 if the
 * role cannot do this. Callers return the status without throwing into HTML.
 */
export async function authorizeStaff(
  permission: StaffPermission,
): Promise<{ ok: true; user: AuthUser } | { ok: false; status: 401 | 403 }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, status: 401 }
  if (!hasPermission(user, permission)) return { ok: false, status: 403 }
  return { ok: true, user }
}

/**
 * Check if current request is from authenticated staff
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}

/**
 * Authenticate by code (unified login).
 *  - a staff prefix from ANY brand → staff login
 *  - RES-prefixed codes           → resident login
 *
 * Staff routing deliberately accepts every prefix the product has ever issued,
 * not just the active brand's. Codes outlive the brand that issued them: after
 * a rebrand an existing `AOZ-…` code matches neither the active
 * staff prefix nor the resident one, falls through to "Ungültiger Code", and
 * locks out every staff member who has not been re-issued a code — including
 * the seeded admin. The lookup itself is still by exact string, so no code
 * changes meaning.
 */
export async function loginByCode(code: string, clientIp: string): Promise<LoginByCodeResult> {
  if (ALL_CODE_PREFIXES.some((prefix) => code.startsWith(prefix))) {
    // Staff login
    const staff = await db.query.user.findFirst({
      where: eq(user.code, code),
      columns: {
        id: true,
        name: true,
        role: true,
        scope: true,
        isSystemAdmin: true,
        siteAccess: true,
        active: true,
      },
      // Contact email lives on the account (may be absent for code-only staff).
      with: { account: { columns: { email: true } } },
    })

    if (!staff || !staff.active) {
      recordLoginAttempt(clientIp)
      return { success: false, error: 'Ungültiger Code' }
    }

    clearLoginAttempts(clientIp)
    await db.update(user).set({ lastLoginAt: new Date() }).where(eq(user.id, staff.id))

    return {
      success: true,
      type: 'staff',
      user: {
        id: staff.id,
        email: staff.account?.email || '',
        name: staff.name,
        role: staff.role,
        scope: staff.scope,
        isSystemAdmin: staff.isSystemAdmin,
        // Always null here, and that is a fact rather than a placeholder: this
        // is the result of somebody typing their OWN code, which is by
        // definition not a borrowed view. A borrowed session is only ever
        // minted by /api/auth/impersonate.
        impersonatorId: null,
        // The login result is a receipt, not a session. Every request that
        // asks "which places?" goes through getCurrentUser, which reads both
        // from the ROW — so the honest value here is the narrowest one rather
        // than a snapshot that could go stale in a caller's hands.
        siteAccess: staff.siteAccess,
        assignedUnitIds: [],
      },
    }
  }

  // EVERY prefix ever issued, not just this brand's. Matching on the active
  // prefix alone would stop routing `RES-` codes to the resident table the day
  // the brand's prefix changed — locking out every resident holding a code
  // printed before the rebrand, with a "Ungültiger Code" that is a lie.
  if (ALL_RESIDENT_CODE_PREFIXES.some((prefix) => code.startsWith(prefix))) {
    // Resident login
    const row = await db.query.resident.findFirst({
      where: eq(resident.code, code),
      columns: { id: true, code: true },
    })

    if (!row) {
      recordLoginAttempt(clientIp)
      return { success: false, error: 'Ungültiger Code' }
    }

    clearLoginAttempts(clientIp)
    return {
      success: true,
      type: 'resident',
      code: row.code,
    }
  }

  return {
    success: false,
    error: `Ungültiger Code. Codes beginnen mit ${BRAND.codePrefix} oder ${RESIDENT_CODE_PREFIX}.`,
  }
}

/**
 * Create session cookie with JWT token
 */
export async function setSessionCookie(
  // Only what the TOKEN carries. Scope and isSystemAdmin are deliberately
  // absent: privileges in a token go stale, and these are read from the row on
  // every request instead.
  user: Pick<AuthUser, 'id' | 'email' | 'name' | 'role'>,
  // Present only when an administrator is opening someone else's view. Passed
  // explicitly rather than read from the current session, so an ordinary login
  // can never inherit an impersonation claim from the cookie it replaces.
  impersonatorId?: string,
): Promise<void> {
  const token = await createToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ...(impersonatorId ? { [IMPERSONATION_CLAIM]: impersonatorId } : {}),
  })

  const cookieStore = await cookies()
  cookieStore.set(AUTH_CONFIG.cookie.name, token, {
    ...AUTH_CONFIG.cookie.options,
    maxAge: AUTH_CONFIG.jwt.expiresIn,
  })
}

/**
 * Clear session cookie (logout)
 * Optionally clears both staff and resident cookies for full logout
 */
export async function clearSessionCookie(clearAll = false): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_CONFIG.cookie.name)
  if (clearAll) {
    cookieStore.delete(RESIDENT_COOKIE)
  }
}
