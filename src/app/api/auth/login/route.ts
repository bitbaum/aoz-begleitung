/**
 * POST /api/auth/login — the unified login door.
 *
 * Two credential shapes, one endpoint:
 *   { email, password } — account login (the primary path)
 *   { code }            — code login (works forever; demo doors, flatmates)
 *
 * An account login issues a session for EVERY identity it carries, so someone
 * who is both staff and a resident lands signed into both and can switch sides
 * from the nav. A code login is that code's identity only — the code names one
 * role, and quietly opening the other would be a surprise.
 */
import { NextRequest, NextResponse } from 'next/server'
import { loginByCode, setSessionCookie } from '@/lib/auth'
import { loginWithEmail } from '@/lib/auth/account'
import { establishSessions } from '@/lib/auth/sessions'
import { logger } from '@/lib/logger'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { sharedCodeLogin, sharedEmailLogin } from '@/lib/auth/shared/bridge'
import {
  checkRateLimit,
  clearLoginAttempts,
  recordLoginAttempt,
  getClientIp,
} from '@/lib/auth/rate-limit'
import { emailLoginSchema } from '@/lib/validation/auth'
import { setResidentCookie } from '@/lib/portal-auth'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

export async function POST(request: NextRequest) {
  try {
    // A body that is absent, truncated (client disconnected mid-request) or not
    // JSON is a *client* error. Letting request.json() throw into the catch
    // below turned it into a 500 + ERROR-level log, which is both wrong for the
    // caller and noise for alerting.
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Code erforderlich' }, { status: 400 })
    }

    const { code, email } = (body ?? {}) as { code?: unknown; email?: unknown }

    const clientIp = getClientIp(request)

    const rateCheck = checkRateLimit(clientIp)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Zu viele Anmeldeversuche. Bitte warten Sie ${rateCheck.retryAfter} Sekunden.`,
          retryAfter: rateCheck.retryAfter,
        },
        { status: 429 },
      )
    }

    // --- Email + password login ---
    if (email !== undefined) {
      const parsed = emailLoginSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: ERROR_MESSAGES.INVALID_CREDENTIALS },
          { status: 400 },
        )
      }

      if (sharedAuthEnabled()) {
        return sharedEmailLogin(request, parsed.data.email, parsed.data.password)
      }

      const result = await loginWithEmail(parsed.data)
      if (!result.success) {
        recordLoginAttempt(clientIp)
        return NextResponse.json({ success: false, error: result.error }, { status: 401 })
      }

      clearLoginAttempts(clientIp)
      return NextResponse.json(await establishSessions(result.identities))
    }

    // --- Code login ---
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Code erforderlich' }, { status: 400 })
    }

    const trimmedCode = code.trim().toUpperCase()

    if (sharedAuthEnabled()) return sharedCodeLogin(request, trimmedCode)

    const result = await loginByCode(trimmedCode, clientIp)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 401 })
    }

    // Clear rate limit on success
    clearLoginAttempts(clientIp)

    if (result.type === 'staff') {
      await setSessionCookie(result.user)
      return NextResponse.json({
        success: true,
        type: 'staff',
        user: result.user,
      })
    }

    // Resident login — set resident_code cookie
    await setResidentCookie(trimmedCode)

    return NextResponse.json({
      success: true,
      type: 'resident',
      code: result.code,
    })
  } catch (error) {
    logger.errorWithCause('Login failed', error)
    return NextResponse.json(
      { success: false, error: 'Ein Fehler ist aufgetreten' },
      { status: 500 },
    )
  }
}
