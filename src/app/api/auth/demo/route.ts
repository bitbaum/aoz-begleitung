import { NextRequest, NextResponse } from 'next/server'
import { loginByCode, setSessionCookie } from '@/lib/auth'
import { checkRateLimit, recordLoginAttempt, getClientIp } from '@/lib/auth/rate-limit'
import { logger } from '@/lib/logger'
import { db, user, resident } from '@/lib/db'
import { and, eq, inArray } from 'drizzle-orm'
import { setResidentCookie } from '@/lib/portal-auth'
import {
  isQuickAccessEnabled,
  quickAccessName,
  quickAccessResidentCode,
  quickAccessStaffCodes,
} from '@/lib/quick-access/config'
import { LOGIN_LABELS, ROLE_LABELS } from '@/lib/constants/labels'
import { BRAND } from '@/lib/config/brand'

/**
 * Quick access: one-click sign-in on /login, no account needed.
 *
 * The site is fully real (decided by George 2026-10-01). The staff buttons
 * sign in as NAMED REAL staff accounts listed in `QUICK_ACCESS_STAFF_CODES`;
 * each of those people can later claim their account at /register. The
 * client button signs in as an unclaimed placeholder profile.
 *
 * The route keeps its old path (`/api/auth/demo`) because the login page and
 * cached bundles call it; the word "demo" no longer describes anything here.
 */

/**
 * A door id is OPAQUE: `staff-<n>` by position in the configured list, or
 * 'resident'. Never the login code — GET answers anyone who loads /login, and
 * a published staff code could be claimed at /register by a stranger before
 * the colleague it belongs to. The code stays on the server (`OfferedDoor`).
 */
const RESIDENT_DOOR = 'resident'

interface Door {
  id: string
  label: string
}

interface OfferedDoor extends Door {
  /** Server-only: the login code behind the button. Never sent to the client. */
  code: string
}

/**
 * Which doors this deployment can actually open.
 *
 * Every configured staff code is checked against the DATABASE: a code that
 * does not resolve, or belongs to a deactivated account, offers no door —
 * silently, because a button that answers "invalid code" is worse than none.
 * Order follows the env var, so the operator decides who comes first.
 */
async function offeredDoors(): Promise<OfferedDoor[]> {
  if (!isQuickAccessEnabled()) return []

  const doors: OfferedDoor[] = []

  const codes = quickAccessStaffCodes()
  if (codes.length > 0) {
    const rows = await db.query.user.findMany({
      where: and(inArray(user.code, codes), eq(user.active, true)),
      columns: { code: true, name: true, role: true },
    })
    const byCode = new Map(rows.map((row) => [row.code, row]))
    for (const [index, code] of codes.entries()) {
      const row = byCode.get(code)
      if (!row) continue
      const roleLabel = ROLE_LABELS[row.role] ?? row.role
      const name = quickAccessName(row.name)
      doors.push({
        id: `staff-${index + 1}`,
        code,
        label: name ? LOGIN_LABELS.demo.staffDoor(name, roleLabel) : roleLabel,
      })
    }
  }

  const residentCode = quickAccessResidentCode()
  if (residentCode) {
    const residentRow = await db.query.resident.findFirst({
      where: eq(resident.code, residentCode),
      columns: { id: true, isPlaceholder: true },
    })
    // ⚠️ THE DOOR DIES THE MOMENT THE PROFILE IS CLAIMED, and this is the
    // whole point of the check.
    //
    // This is an ANONYMOUS, no-account login. Pointing it at a placeholder is
    // safe: nobody is behind that profile yet. But a placeholder exists in
    // order to be TAKEN OVER, and the day the person who moves in registers
    // with that code, the row stops being a placeholder and becomes theirs —
    // same id, same code, same `DEMO_RESIDENT_CODE`. Without this condition,
    // the public door would silently turn into a door onto a real client's
    // flat, roommates, expenses and reports.
    //
    // Config discipline cannot prevent that, because the event that causes it
    // is a resident registering — something nobody is watching the env var
    // for. So the guard is in code and reads the same fact the marker does.
    if (residentRow?.isPlaceholder) {
      doors.push({ id: RESIDENT_DOOR, code: residentCode, label: BRAND.clientTerm })
    }
  }

  return doors
}

export async function GET() {
  try {
    const doors: Door[] = (await offeredDoors()).map(({ id, label }) => ({ id, label }))

    return NextResponse.json({
      success: true,
      data: {
        doors,
        // Kept so an older cached login bundle still renders its two buttons
        // instead of none while the new one rolls out.
        staff: doors.some((door) => door.id !== RESIDENT_DOOR),
        resident: doors.some((door) => door.id === RESIDENT_DOOR),
      },
    })
  } catch (error) {
    logger.errorWithCause('Quick access door listing failed', error)
    return NextResponse.json({ success: true, data: { doors: [], staff: false, resident: false } })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const requested = typeof body?.role === 'string' ? body.role.trim() : ''

    // Only a door GET would offer can be opened. The id is matched against the
    // offered list rather than used as a code directly: otherwise this
    // endpoint would sign anyone in with ANY staff code they could guess.
    const door = requested
      ? (await offeredDoors()).find((offered) => offered.id === requested)
      : undefined
    if (!door) {
      return NextResponse.json(
        { success: false, error: LOGIN_LABELS.demo.notConfigured },
        { status: 404 },
      )
    }

    const clientIp = getClientIp(request)

    // Throttle: this endpoint issues real sessions; rate-limit per IP.
    const rateCheck = checkRateLimit(clientIp)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Zu viele Versuche. Bitte warten Sie ${rateCheck.retryAfter} Sekunden.`,
        },
        { status: 429 },
      )
    }

    const result = await loginByCode(door.code, clientIp)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 401 })
    }

    // Count the SUCCESS. loginByCode already records failed codes, but the
    // thing this endpoint throttles is session issuance, and a configured code
    // is valid by definition — so without this one IP could mint unlimited
    // sessions while the counter stayed at zero.
    recordLoginAttempt(clientIp)

    if (result.type === 'staff') {
      await setSessionCookie(result.user)
      return NextResponse.json({ success: true, type: 'staff' })
    }

    await setResidentCookie(result.code)

    return NextResponse.json({ success: true, type: 'resident' })
  } catch (error) {
    logger.errorWithCause('Quick access login failed', error)
    return NextResponse.json({ success: false, error: LOGIN_LABELS.demo.failed }, { status: 500 })
  }
}
