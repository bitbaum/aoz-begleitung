/**
 * POST /api/auth/resend-verification { email } — send the confirmation link
 * again, from the sign-in screen that was refused for an unconfirmed address.
 * Shared runtime only: the legacy login never required confirmation.
 */
import { NextRequest, NextResponse } from 'next/server'
import { forgotPasswordSchema } from '@/lib/validation/auth'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { sharedResendVerification } from '@/lib/auth/shared/bridge'

export async function POST(request: NextRequest) {
  if (!sharedAuthEnabled()) return NextResponse.json({ success: false }, { status: 404 })
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
  return sharedResendVerification(request, parsed.data.email)
}
