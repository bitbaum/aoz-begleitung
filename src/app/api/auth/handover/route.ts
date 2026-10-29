import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, user as userTable, account, isUniqueViolation } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { sendEmail } from '@/lib/email/service'
import { EMAIL_CONFIG } from '@/lib/email/config'
import { staffInviteEmail } from '@/lib/email/templates'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { HANDOVER_LABELS } from '@/lib/constants/labels/handover'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { attachInvitedEmail } from '@/lib/auth/shared/identity'

/**
 * Hand an already-provisioned staff member their own login.
 *
 * POST { userId, email }
 *
 * `/api/auth/invite` creates a NEW colleague. This is the other half, and it
 * was missing: the three real staff members were provisioned by script, so they
 * exist, hold codes, and have no email on file. There was no way to give them
 * access short of reading their code out of the database and passing it along
 * by hand.
 *
 * What it does NOT do is show the code to the administrator. `/settings`
 * deliberately does not even SELECT `code` — a staff code is not an identifier,
 * it is the credential, and `loginByCode` takes it alone. Reading a colleague's
 * code to forward it would defeat that. So the code goes from the database to
 * the person's mailbox without passing through anyone's screen.
 *
 * The account is created UNCLAIMED — email known, `passwordHash` null — which
 * is exactly the shape `/api/auth/invite` produces. From there `/register` or
 * `/forgot-password` completes it, with mailbox control as the proof, and no
 * further administrator involvement.
 */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.AUTH_REQUIRED },
      { status: 401 },
    )
  }

  if (!hasPermission(currentUser, 'users:manage')) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS },
      { status: 403 },
    )
  }

  // Refuse LOUDLY rather than reporting a send that cannot happen. The same
  // rule /api/auth/forgot-password follows: a cheerful "sent" over a disabled
  // transport is a silent lockout, and here it would be worse — the
  // administrator would believe the colleague has access and stop chasing it.
  if (!EMAIL_CONFIG.enabled) {
    return NextResponse.json(
      { success: false, error: HANDOVER_LABELS.emailDisabled },
      { status: 503 },
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

  const { userId, email: rawEmail } = body as { userId?: string; email?: string }
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.INVALID_REQUEST },
      { status: 400 },
    )
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { success: false, error: HANDOVER_LABELS.emailInvalid },
      { status: 400 },
    )
  }

  const target = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
    columns: { id: true, name: true, code: true, active: true },
    with: { account: { columns: { email: true } } },
  })

  if (!target) {
    return NextResponse.json(
      { success: false, error: HANDOVER_LABELS.unknownUser },
      { status: 404 },
    )
  }
  if (!target.active) {
    return NextResponse.json(
      { success: false, error: HANDOVER_LABELS.inactiveUser },
      { status: 409 },
    )
  }

  if (sharedAuthEnabled()) {
    const attached = await attachInvitedEmail('staff', target.id, email)
    if (attached === 'has_email') {
      return NextResponse.json(
        { success: false, error: HANDOVER_LABELS.alreadyHasEmail },
        { status: 409 },
      )
    }
    if (attached === 'taken') {
      return NextResponse.json(
        { success: false, error: HANDOVER_LABELS.emailTaken },
        { status: 409 },
      )
    }
  }

  // Changing an address someone already signs in with is a different act with
  // different consequences — it moves control of an account to another mailbox.
  // Refusing here keeps this endpoint to the one thing it claims to do.
  if (!sharedAuthEnabled() && target.account?.email) {
    return NextResponse.json(
      { success: false, error: HANDOVER_LABELS.alreadyHasEmail },
      { status: 409 },
    )
  }

  try {
    if (!sharedAuthEnabled()) await db.insert(account).values({ email, userId: target.id })
  } catch (error) {
    if (isUniqueViolation(error)) {
      // One email namespace across the whole product: this address may already
      // belong to a resident identity or another staff member.
      return NextResponse.json(
        { success: false, error: HANDOVER_LABELS.emailTaken },
        { status: 409 },
      )
    }
    logger.errorWithCause('Failed to attach email to staff user', error, { userId: target.id })
    return NextResponse.json({ success: false, error: ERROR_MESSAGES.SAVE_ERROR }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const { subject, html } = staffInviteEmail({
    recipientEmail: email,
    staffCode: target.code,
    invitedByName: currentUser.name,
    appUrl,
  })

  // AWAITED, unlike /api/auth/invite's fire-and-forget. There the user record
  // is the deliverable and the mail is a convenience; here the mail IS the
  // deliverable, and reporting success before knowing it left would be the
  // same optimistic lie this route refuses to tell when the transport is off.
  const sent = await sendEmail([email], subject, html).catch((error: unknown) => {
    logger.errorWithCause('Failed to send staff handover email', error, { userId: target.id })
    return false
  })

  await logAudit({
    action: 'UPDATE',
    entity: 'STAFF_USER',
    entityId: target.id,
    userId: currentUser.id,
    reason: `Zugang übergeben an ${email}`,
  })

  if (!sent) {
    // The account row stands — the address is now on file and the colleague can
    // use "Passwort vergessen?" unaided. Say plainly that the mail did not go,
    // rather than reporting a success that leaves someone waiting for it.
    return NextResponse.json({ success: false, error: HANDOVER_LABELS.sendFailed }, { status: 502 })
  }

  return NextResponse.json({ success: true, email })
}
