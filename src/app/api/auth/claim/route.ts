/**
 * /api/auth/claim — redeem a personal claim link.
 *
 * GET  ?token=…                      → { success, data: { name } } while the link is open
 * POST { token, email, password }    → claims the account and signs the person in
 *
 * Public and rate-limited. The link is single-use: it is taken atomically
 * before the account is written, and released again only if that write fails,
 * so a link can never produce two accounts. @see lib/auth/claim-invites.ts
 */
import { NextRequest, NextResponse } from 'next/server'
import { registerAccount } from '@/lib/auth/account'
import { establishSessions } from '@/lib/auth/sessions'
import { consumeRateLimit, getClientIp } from '@/lib/auth/rate-limit'
import { peekClaimInvite, releaseClaimInvite, takeClaimInvite } from '@/lib/auth/claim-invites'
import { claimAccountSchema } from '@/lib/validation/auth'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { CLAIM_LABELS } from '@/lib/constants/labels'
import { logger } from '@/lib/logger'

function invalid() {
  return NextResponse.json({ success: false, error: CLAIM_LABELS.invalid }, { status: 410 })
}

export async function GET(request: NextRequest) {
  const rateCheck = consumeRateLimit(getClientIp(request))
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.RATE_LIMITED, retryAfter: rateCheck.retryAfter },
      { status: 429 },
    )
  }
  try {
    const token = request.nextUrl.searchParams.get('token') ?? ''
    const invite = await peekClaimInvite(token)
    if (!invite) return invalid()
    return NextResponse.json({ success: true, data: { name: invite.name } })
  } catch (error) {
    logger.errorWithCause('Claim link lookup failed', error)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.SESSION_ERROR },
      { status: 500 },
    )
  }
}

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

    const parsed = claimAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || ERROR_MESSAGES.INVALID_INPUT },
        { status: 400 },
      )
    }

    const taken = await takeClaimInvite(parsed.data.token)
    if (!taken) return invalid()

    const result = await registerAccount({
      code: taken.code,
      email: parsed.data.email,
      password: parsed.data.password,
    }).catch(async (error: unknown) => {
      await releaseClaimInvite(taken.id)
      throw error
    })
    if (!result.success) {
      // e.g. the email belongs to another login — let them retry with this link.
      await releaseClaimInvite(taken.id)
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json(await establishSessions(result.identities))
  } catch (error) {
    logger.errorWithCause('Account claim failed', error)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.SESSION_ERROR },
      { status: 500 },
    )
  }
}
