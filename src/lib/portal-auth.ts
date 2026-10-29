/**
 * Shared portal authentication helpers
 *
 * Extracts the repeated patterns of reading the `resident_code` cookie,
 * finding the resident, and getting their active placement.
 *
 * DRY: Used by all portal API routes and server components.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db, resident, placement } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { RESIDENT_COOKIE, RESIDENT_COOKIE_MAX_AGE_SECONDS } from '@/lib/auth/constants'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { getSharedIdentities } from '@/lib/auth/shared/session'

// Re-export so existing call sites continue to import from '@/lib/portal-auth'.
export { RESIDENT_COOKIE }

export interface PortalAuthResult {
  resident: {
    id: string
    code: string
  }
  placement: {
    id: string
    housingUnitId: string
  }
}

/**
 * The signed-in resident's code: from the shared session when that runtime is
 * on, else from the legacy cookie. The ONE place the portal learns who is
 * asking; every helper below goes through it.
 */
async function currentResidentCode(): Promise<string | null> {
  if (sharedAuthEnabled()) return (await getSharedIdentities()).resident?.code ?? null
  const cookieStore = await cookies()
  return cookieStore.get(RESIDENT_COOKIE)?.value ?? null
}

/**
 * Read the resident_code cookie, or redirect to the given path if missing.
 * Use from server components when you need to perform a custom Prisma query.
 */
export async function requireResidentCookie(redirectTo = '/login'): Promise<string> {
  const code = await currentResidentCode()
  if (!code) redirect(redirectTo)
  return code
}

/**
 * Read the resident_code cookie without redirecting.
 * Use from API routes that should return JSON 401 instead of redirecting.
 */
export async function getResidentCookie(): Promise<string | null> {
  return currentResidentCode()
}

/** Whether a resident session is present, for navigation (not authorization). */
export async function hasResidentSession(): Promise<boolean> {
  return (await currentResidentCode()) !== null
}

/** Set the resident_code cookie after successful login. SSOT for cookie options. */
export async function setResidentCookie(code: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(RESIDENT_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: RESIDENT_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  })
}

/**
 * Authenticate portal request and return the resident WITHOUT requiring an
 * active placement. Use for self-profile routes: a resident's own name, bio
 * and photo exist independently of whether they are currently placed.
 */
export async function getPortalResident(): Promise<{ id: string; code: string } | null> {
  const residentCode = await currentResidentCode()
  if (!residentCode) return null

  const row = await db.query.resident.findFirst({
    where: eq(resident.code, residentCode),
    columns: { id: true, code: true },
  })
  // Callers expect Prisma's null, not drizzle's undefined.
  return row ?? null
}

export interface UnitMember {
  id: string
  code: string
  displayName: string | null
  /** Photo timestamp doubles as the cache-busting version; null = no photo. */
  photoVersion: Date | null
}

/** Active members of a housing unit, shaped for display (never includes photo bytes). */
export async function getActiveUnitMembers(housingUnitId: string): Promise<UnitMember[]> {
  const placements = (await db.query.placement.findMany({
    where: and(eq(placement.housingUnitId, housingUnitId), eq(placement.status, 'ACTIVE')),
    columns: {},
    with: {
      resident: {
        columns: {
          id: true,
          code: true,
          displayName: true,
        },
        with: { photo: { columns: { updatedAt: true } } },
      },
    },
    // Cast: the relational result type is poisoned by the schema.ts
    // circular-reference bug (placement is implicitly `any`); at runtime each
    // row carries exactly one resident with an optional photo.
  })) as {
    resident: {
      id: string
      code: string
      displayName: string | null
      photo: { updatedAt: Date } | null
    }
  }[]
  return placements.map((p) => ({
    id: p.resident.id,
    code: p.resident.code,
    displayName: p.resident.displayName,
    photoVersion: p.resident.photo?.updatedAt ?? null,
  }))
}

/**
 * Authenticate portal request and return resident + active placement.
 * Returns null if not authenticated or no active placement.
 */
export async function getPortalAuth(): Promise<PortalAuthResult | null> {
  const residentCode = await currentResidentCode()

  if (!residentCode) return null

  const row = await db.query.resident.findFirst({
    where: eq(resident.code, residentCode),
    columns: { id: true, code: true },
    with: {
      placements: {
        where: eq(placement.status, 'ACTIVE'),
        columns: { id: true, housingUnitId: true },
        limit: 1,
      },
    },
  })

  if (!row) return null

  const active = row.placements[0]
  if (!active) return null

  return {
    resident: { id: row.id, code: row.code },
    placement: { id: active.id, housingUnitId: active.housingUnitId },
  }
}
