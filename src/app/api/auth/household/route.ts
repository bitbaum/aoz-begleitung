/**
 * POST /api/auth/household — sign up with no code and create your own flat.
 *
 * A SEPARATE ROUTE FROM /signup, on purpose. Signup CLAIMS an identity that
 * already exists; this CREATES one. Folding them into one endpoint with an
 * optional `code` would mean a single handler whose behaviour — and whose
 * blast radius — depends on which fields happen to be present.
 *
 * Public and rate-limited like every other public auth route, and refused
 * outright on deployments whose brand does not offer it. @see auth/household.ts
 */
import { NextRequest, NextResponse } from 'next/server'
import { registerWithNewHousehold } from '@/lib/auth/household'
import { establishSessions } from '@/lib/auth/sessions'
import { consumeRateLimit, getClientIp } from '@/lib/auth/rate-limit'
import { createHouseholdSchema } from '@/lib/validation/auth'
import { BRAND } from '@/lib/config/brand'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { logger } from '@/lib/logger'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'

export async function POST(request: NextRequest) {
  try {
    // Checked here as well as in the domain function. This is the network
    // edge: on an AOZ deployment the endpoint should not even accept the
    // request, let alone reach code that could create a resident row.
    // Not yet on the shared runtime: it writes a legacy password, and a
    // second credential writer beside AccountKit is what the cutover forbids.
    if (!BRAND.features.selfServeHousehold || sharedAuthEnabled()) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.AUTH_CODE_REQUIRED },
        { status: 404 },
      )
    }

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

    const parsed = createHouseholdSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || ERROR_MESSAGES.INVALID_INPUT },
        { status: 400 },
      )
    }

    const result = await registerWithNewHousehold(parsed.data)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    // Straight in, like claiming a code. The resident code is returned so the
    // UI can show it once — it is this person's other way back in, and after
    // this response nothing ever displays it again.
    const session = await establishSessions(result.identities)
    return NextResponse.json({ ...session, residentCode: result.residentCode })
  } catch (error) {
    logger.errorWithCause('Household onboarding failed', error)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.SESSION_ERROR },
      { status: 500 },
    )
  }
}
