import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, user as userTable } from '@/lib/db'
import { getCurrentUser, setSessionCookie } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { IMPERSONATION_LABELS } from '@/lib/auth/impersonation'
import { STAFF_COOKIE } from '@/lib/auth/constants'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { getSharedSession, writeSessionCookie } from '@/lib/auth/shared/session'
import { closeBorrowedSession, openBorrowedSession } from '@/lib/auth/shared/borrowed'
import { readSessionScope } from '@/lib/auth/shared/identity'

/**
 * Open and close a borrowed staff view. @see lib/auth/impersonation.ts
 *
 * POST   { userId }  — become that person, read-only.
 * DELETE             — hand the session back to whoever opened it.
 *
 * Both are audited against the ADMINISTRATOR, never the person being viewed:
 * the whole point of recording `impersonatorId` is that the trail names the
 * human who acted.
 */

/** The narrowest row that answers "may I open this view, and as whom?". */
const TARGET_COLUMNS = {
  id: true,
  name: true,
  role: true,
  active: true,
} as const

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.AUTH_REQUIRED },
      { status: 401 },
    )
  }

  // Opening someone else's view is a systems power, not a care power. It rides
  // on `users:manage` — the same permission that governs the team list this is
  // launched from — so no care role, however wide its scope, can reach it.
  if (!hasPermission(currentUser, 'users:manage')) {
    return NextResponse.json(
      { success: false, error: IMPERSONATION_LABELS.notPermitted },
      { status: 403 },
    )
  }

  // No chaining. Without this, A views B, then from inside B's session opens
  // C's — and the token would record B as the opener, quietly laundering who
  // is actually driving. One hop, always attributable to a real administrator.
  if (currentUser.impersonatorId) {
    return NextResponse.json(
      { success: false, error: IMPERSONATION_LABELS.alreadyImpersonating },
      { status: 409 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.INVALID_REQUEST },
      { status: 400 },
    )
  }

  const { userId } = body as { userId?: string }
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.INVALID_REQUEST },
      { status: 400 },
    )
  }

  if (userId === currentUser.id) {
    return NextResponse.json(
      { success: false, error: IMPERSONATION_LABELS.selfNotAllowed },
      { status: 400 },
    )
  }

  const target = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
    columns: TARGET_COLUMNS,
  })

  if (!target) {
    return NextResponse.json(
      { success: false, error: IMPERSONATION_LABELS.unknownTarget },
      { status: 404 },
    )
  }

  // `getCurrentUser` refuses a deactivated user on every request, so a session
  // opened here would die on its next hop anyway. Refusing up front turns a
  // baffling instant logout into a sentence that says why.
  if (!target.active) {
    return NextResponse.json(
      { success: false, error: IMPERSONATION_LABELS.inactiveTarget },
      { status: 409 },
    )
  }

  if (sharedAuthEnabled()) {
    // A real shared session for the colleague, scoped to their staff side,
    // read-only by its scope row, remembering the administrator's own session.
    const own = await getSharedSession()
    const opened = own
      ? await openBorrowedSession({
          targetStaffId: target.id,
          openerStaffId: currentUser.id,
          openerSessionId: own.session.id,
        })
      : null
    if (!opened) {
      return NextResponse.json(
        { success: false, error: IMPERSONATION_LABELS.unknownTarget },
        { status: 404 },
      )
    }
    await writeSessionCookie(opened)
  } else {
    // The email is the ADMIN's, deliberately: it is what the token carries for
    // display, and a borrowed session should not hand out a colleague's address.
    // Identity for every permission and query is `sub`, which is the target's id.
    await setSessionCookie(
      { id: target.id, email: currentUser.email, name: target.name, role: target.role },
      currentUser.id,
    )
  }

  await logAudit({
    action: 'UPDATE',
    entity: 'STAFF_USER',
    entityId: target.id,
    userId: currentUser.id,
    reason: `Ansicht geöffnet als ${target.name}`,
  })
  logger.info('Impersonation started', { adminId: currentUser.id, targetId: target.id })

  return NextResponse.json({ success: true, viewingAs: { id: target.id, name: target.name } })
}

export async function DELETE() {
  if (sharedAuthEnabled()) return closeShared()
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.AUTH_REQUIRED },
      { status: 401 },
    )
  }

  const adminId = currentUser.impersonatorId
  if (!adminId) {
    // Not an error worth a failure status: pressing "back to my account" when
    // you are already in it should be a no-op, not a red banner.
    return NextResponse.json({ success: true, restored: false })
  }

  const admin = await db.query.user.findFirst({
    where: eq(userTable.id, adminId),
    columns: TARGET_COLUMNS,
  })

  // The administrator was deactivated while the borrowed view was open. There
  // is no session to go back to, so end the borrowed one rather than leaving
  // someone stranded inside a colleague's account.
  if (!admin?.active) {
    const response = NextResponse.json(
      { success: false, error: ERROR_MESSAGES.AUTH_REQUIRED },
      { status: 401 },
    )
    response.cookies.delete(STAFF_COOKIE)
    return response
  }

  await setSessionCookie({
    id: admin.id,
    email: currentUser.email,
    name: admin.name,
    role: admin.role,
  })

  await logAudit({
    action: 'UPDATE',
    entity: 'STAFF_USER',
    entityId: currentUser.id,
    userId: admin.id,
    reason: `Ansicht beendet (${currentUser.name})`,
  })
  logger.info('Impersonation ended', { adminId: admin.id, targetId: currentUser.id })

  return NextResponse.json({ success: true, restored: true })
}

/**
 * Shared-session form of DELETE. Reads the scope row, not the resolved user:
 * a borrowed view whose administrator was deactivated resolves to nobody, and
 * must still be closable rather than left standing.
 */
async function closeShared() {
  const own = await getSharedSession()
  const scope = own ? await readSessionScope(own.session.id) : null
  if (!own || !scope?.impersonatorStaffId) {
    return NextResponse.json({ success: true, restored: false })
  }
  const viewed = await getCurrentUser()
  const back = await closeBorrowedSession(own.session.id)
  await writeSessionCookie(back)
  const restored = back.value !== ''
  if (viewed) {
    await logAudit({
      action: 'UPDATE',
      entity: 'STAFF_USER',
      entityId: viewed.id,
      userId: scope.impersonatorStaffId,
      reason: `Ansicht beendet (${viewed.name})`,
    })
  }
  logger.info('Impersonation ended', { adminId: scope.impersonatorStaffId, restored })
  return restored
    ? NextResponse.json({ success: true, restored: true })
    : NextResponse.json({ success: false, error: ERROR_MESSAGES.AUTH_REQUIRED }, { status: 401 })
}
