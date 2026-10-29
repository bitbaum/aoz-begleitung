/**
 * POST /api/auth/signup — claim your code with email + password.
 *
 * Public, rate-limited. Every attempt counts (an attacker probing codes gets
 * throttled whether the codes exist or not). Success logs the account in
 * immediately — a register → login round-trip is friction with no benefit.
 */
import { NextRequest, NextResponse } from 'next/server'
import { registerAccount } from '@/lib/auth/account'
import { establishSessions } from '@/lib/auth/sessions'
import { consumeRateLimit, getClientIp } from '@/lib/auth/rate-limit'
import { registerSchema } from '@/lib/validation/auth'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { logger } from '@/lib/logger'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { sharedClaim } from '@/lib/auth/shared/bridge'

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

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || ERROR_MESSAGES.INVALID_INPUT },
        { status: 400 },
      )
    }

    if (sharedAuthEnabled()) {
      const { code, email, password } = parsed.data
      return sharedClaim(request, { code }, { email, password })
    }

    const result = await registerAccount(parsed.data)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    // Claiming signs you straight in — with every role the account now holds,
    // so linking a second code lands you in both immediately.
    return NextResponse.json(await establishSessions(result.identities))
  } catch (error) {
    logger.errorWithCause('Signup failed', error)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.SESSION_ERROR },
      { status: 500 },
    )
  }
}
