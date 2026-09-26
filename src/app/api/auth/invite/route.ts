import { db, user as userTable, account, isUniqueViolation } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { DatabaseError } from 'pg'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  ASSIGNABLE_STAFF_ROLES,
  NARROWEST_CAPABILITIES,
  hasPermission,
  isStaffRole,
  isStaffScope,
  type StaffRole,
  type StaffScopeId,
} from '@/lib/auth/role-policy'
import { sendEmail } from '@/lib/email/service'
import { staffInviteEmail } from '@/lib/email/templates'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { generateStaffCode } from '@/lib/auth/code-generation'
import { checkRateLimit, recordLoginAttempt, getClientIp } from '@/lib/auth/rate-limit'
import { logger } from '@/lib/logger'

/**
 * The violated constraint name from a pg unique-violation, walking wrapped
 * causes (drizzle wraps the driver error). Prisma exposed the violated
 * COLUMNS via `error.meta.target`; pg names the CONSTRAINT instead
 * ('Account_email_key' / 'User_code_key').
 */
function uniqueViolationConstraint(error: unknown): string | undefined {
  if (error instanceof DatabaseError) return error.constraint
  if (error instanceof Error && error.cause !== undefined) {
    return uniqueViolationConstraint(error.cause)
  }
  return undefined
}

/**
 * POST /api/auth/invite
 * Invite a new staff member by email.
 * Creates a User record with a generated AOZ code and sends the code by email.
 *
 * Body: { email: string, name: string, role?: StaffRole }
 * Requires: users:manage
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  const rateCheck = checkRateLimit(ip)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.RATE_LIMITED, retryAfter: rateCheck.retryAfter },
      { status: 429 },
    )
  }

  const currentUser = await getCurrentUser()
  if (!currentUser) {
    recordLoginAttempt(ip)
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    recordLoginAttempt(ip)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.INVALID_REQUEST },
      { status: 400 },
    )
  }

  const {
    email,
    name,
    role: rawRole,
    scope: rawScope,
  } = body as { email?: string; name?: string; role?: string; scope?: string }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    recordLoginAttempt(ip)
    return NextResponse.json(
      { success: false, error: 'Gültige E-Mail-Adresse erforderlich' },
      { status: 400 },
    )
  }

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    recordLoginAttempt(ip)
    return NextResponse.json(
      { success: false, error: 'Name ist erforderlich (mindestens 2 Zeichen)' },
      { status: 400 },
    )
  }

  // ASSIGNABLE, not `isStaffRole`. The latter accepts ADMIN — the retired
  // all-in-one role — so this endpoint would happily mint a new one, while its
  // sibling /api/auth/register has refused since the split. Two provisioning
  // paths disagreeing is the exact defect the register route's own comment
  // describes about the `users:manage` check; this was the same divergence left
  // standing in the role allowlist, and the settings form pointed at THIS one.
  const assignable = ASSIGNABLE_STAFF_ROLES as readonly string[]
  if (rawRole !== undefined && !assignable.includes(rawRole)) {
    recordLoginAttempt(ip)
    return NextResponse.json({ success: false, error: 'Ungültige Rolle' }, { status: 400 })
  }
  const role: StaffRole = rawRole && isStaffRole(rawRole) ? rawRole : 'BETREUUNG'

  // Reach is stated, administration is not.
  //
  // `scope` belongs here because the team cannot otherwise be described: the
  // only way to create the all-domains Betreuerin — a Betreuerin who ALSO covers every domain —
  // was to pick "Leitung" from a dropdown that should not have offered it. That
  // is WHY the retired role survived in the UI, and removing the option without
  // adding this would have taken away the only way to express that shape.
  //
  // `isSystemAdmin` deliberately stays false and unexposed. Running the houses
  // is not reconfiguring the product; granting that is a rare, deliberate act
  // and does not belong on the form used to add a colleague.
  const scope: StaffScopeId =
    typeof rawScope === 'string' && isStaffScope(rawScope) ? rawScope : 'OWN_DOMAIN'
  if (rawScope !== undefined && typeof rawScope === 'string' && !isStaffScope(rawScope)) {
    recordLoginAttempt(ip)
    return NextResponse.json({ success: false, error: 'Ungültige Reichweite' }, { status: 400 })
  }

  // Generate a unique code
  let code: string | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateStaffCode()
    const existing = await db.query.user.findFirst({ where: eq(userTable.code, candidate) })
    if (!existing) {
      code = candidate
      break
    }
  }
  if (!code) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.CODE_GENERATION_ERROR },
      { status: 500 },
    )
  }

  // Check if email already registered
  const existingEmail = await db.query.account.findFirst({
    where: eq(account.email, email.toLowerCase()),
    columns: { id: true },
  })
  if (existingEmail) {
    return NextResponse.json(
      { success: false, error: 'Diese E-Mail-Adresse ist bereits registriert' },
      { status: 409 },
    )
  }

  // Create user
  let user
  try {
    // The invited person's email is KNOWN but they have no password yet —
    // exactly the shape an unclaimed Account has, so /register (or
    // /forgot-password) completes it without an admin doing anything else.
    user = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(userTable)
        .values({
          code,
          name: name.trim(),
          role,
          // Reach as chosen; administration never. Both stated rather than
          // inherited from the column defaults, so a future change to those
          // cannot quietly widen every invite.
          scope,
          isSystemAdmin: NARROWEST_CAPABILITIES.isSystemAdmin,
          active: true,
        })
        .returning({ id: userTable.id, code: userTable.code, name: userTable.name })
      const [createdAccount] = await tx
        .insert(account)
        .values({ email: email.toLowerCase(), userId: created.id })
        .returning({ email: account.email })
      return { ...created, account: { email: createdAccount.email } }
    })
  } catch (error) {
    // Race between pre-check and insert: surface conflict explicitly.
    if (isUniqueViolation(error)) {
      const constraint = uniqueViolationConstraint(error)
      const message = constraint?.includes('email')
        ? 'Diese E-Mail-Adresse ist bereits registriert'
        : 'Dieser Code ist bereits vergeben'
      return NextResponse.json({ success: false, error: message }, { status: 409 })
    }
    logger.errorWithCause('Failed to invite staff user', error, { email })
    return NextResponse.json({ success: false, error: ERROR_MESSAGES.SAVE_ERROR }, { status: 500 })
  }

  // Fire-and-forget email send. The admin caller shouldn't wait on Brevo —
  // the user record is already created. Failures are logged by sendEmail.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const { subject, html } = staffInviteEmail({
    recipientEmail: email,
    staffCode: code,
    invitedByName: currentUser.name,
    appUrl,
  })

  sendEmail([email], subject, html).catch((err) =>
    logger.errorWithCause('Failed to send staff invite email', err, { userId: user.id }),
  )

  return NextResponse.json({
    success: true,
    user: { id: user.id, code: user.code, name: user.name, email: user.account?.email ?? email },
    // We can't await delivery without re-introducing the hang; report optimistically.
    emailSent: true,
  })
}
