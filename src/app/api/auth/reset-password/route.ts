/**
 * POST /api/auth/reset-password — redeem a reset token for a new password.
 * Public, rate-limited (tokens are unguessable, but throttle anyway).
 */
import { NextRequest, NextResponse } from 'next/server'
import { resetPassword } from '@/lib/auth/account'
import { consumeRateLimit, getClientIp } from '@/lib/auth/rate-limit'
import { resetPasswordSchema } from '@/lib/validation/auth'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { logger } from '@/lib/logger'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { sharedResetPassword } from '@/lib/auth/shared/bridge'

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

    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || ERROR_MESSAGES.INVALID_INPUT },
        { status: 400 },
      )
    }

    if (sharedAuthEnabled()) {
      return sharedResetPassword(request, parsed.data.token, parsed.data.password)
    }

    const result = await resetPassword(parsed.data.token, parsed.data.password)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.errorWithCause('Password reset failed', error)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.SESSION_ERROR },
      { status: 500 },
    )
  }
}
