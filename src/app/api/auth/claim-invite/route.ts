/**
 * /api/auth/claim-invite — administrators issue or revoke a colleague's
 * personal claim link. Requires `users:manage`.
 *
 * POST   { userId } → { success, data: { url, expiresAt } }  (earlier links revoked)
 * DELETE { userId } → { success }                             (all open links revoked)
 *
 * The raw link is returned exactly once, to the administrator who asked for it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { claimPath, issueClaimInvite, revokeClaimInvites } from '@/lib/auth/claim-invites'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { CLAIM_INVITE_LABELS } from '@/lib/constants/labels'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

type Authorised =
  { error: NextResponse } | { error: null; currentUser: { id: string }; userId: string }

async function authorise(request: NextRequest): Promise<Authorised> {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return {
      error: NextResponse.json(
        { success: false, error: ERROR_MESSAGES.AUTH_REQUIRED },
        { status: 401 },
      ),
    }
  }
  if (!hasPermission(currentUser, 'users:manage')) {
    return {
      error: NextResponse.json(
        { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS },
        { status: 403 },
      ),
    }
  }
  let userId = ''
  try {
    const body = (await request.json()) as { userId?: unknown }
    userId = typeof body?.userId === 'string' ? body.userId : ''
  } catch {
    // fall through
  }
  if (!userId) {
    return {
      error: NextResponse.json(
        { success: false, error: ERROR_MESSAGES.INVALID_REQUEST },
        { status: 400 },
      ),
    }
  }
  return { error: null, currentUser, userId }
}

function appOrigin(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
}

export async function POST(request: NextRequest) {
  const auth = await authorise(request)
  if (auth.error) return auth.error
  try {
    const result = await issueClaimInvite(auth.userId, auth.currentUser.id)
    if (!result.ok) {
      return result.reason === 'already_claimed'
        ? NextResponse.json(
            { success: false, error: CLAIM_INVITE_LABELS.alreadyClaimed },
            { status: 409 },
          )
        : NextResponse.json(
            { success: false, error: ERROR_MESSAGES.INVALID_REQUEST },
            { status: 404 },
          )
    }
    await logAudit({
      action: 'UPDATE',
      entity: 'STAFF_USER',
      entityId: auth.userId,
      userId: auth.currentUser.id,
      reason: 'Übernahme-Link erstellt',
    })
    return NextResponse.json({
      success: true,
      data: {
        url: `${appOrigin(request)}${claimPath(result.token)}`,
        expiresAt: result.expiresAt.toISOString(),
      },
    })
  } catch (error) {
    logger.errorWithCause('Claim link issue failed', error)
    return NextResponse.json({ success: false, error: CLAIM_INVITE_LABELS.failed }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authorise(request)
  if (auth.error) return auth.error
  try {
    await revokeClaimInvites(auth.userId)
    await logAudit({
      action: 'UPDATE',
      entity: 'STAFF_USER',
      entityId: auth.userId,
      userId: auth.currentUser.id,
      reason: 'Übernahme-Link widerrufen',
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.errorWithCause('Claim link revoke failed', error)
    return NextResponse.json({ success: false, error: ERROR_MESSAGES.SAVE_ERROR }, { status: 500 })
  }
}
