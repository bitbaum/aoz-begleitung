/**
 * POST /api/auth/forgot-password — request a reset link.
 *
 * Success is generic for ANY email (no account enumeration). The one loud
 * failure is a deployment that cannot send email at all: a fake "sent"
 * there would be a silent lockout.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requestPasswordReset } from '@/lib/auth/account'
import { consumeRateLimit, getClientIp } from '@/lib/auth/rate-limit'
import { forgotPasswordSchema } from '@/lib/validation/auth'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { logger } from '@/lib/logger'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { sharedForgotPassword } from '@/lib/auth/shared/bridge'

export async function POST(request: NextRequest) {
  try {
    const rateCheck = consumeRateLimit(getClientIp(request))
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.RATE_LIMITED, retryAfter: rateCheck.retryAfter },
        { status: 429 },
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

    const parsed = forgotPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.AUTH_EMAIL_INVALID },
        { status: 400 },
      )
    }

    if (sharedAuthEnabled()) return sharedForgotPassword(request, parsed.data.email)

    const result = await requestPasswordReset(parsed.data.email)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 503 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.errorWithCause('Password reset request failed', error)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.SESSION_ERROR },
      { status: 500 },
    )
  }
}
