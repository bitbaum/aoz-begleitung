/**
 * GET /api/auth/verify-email?token=… — email verification link target.
 * Always redirects to /login with an outcome flag; the login page renders
 * the German feedback. Redirects go via the public app URL, never
 * request.url (behind Caddy that is the localhost bind address).
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailToken } from '@/lib/auth/account'
import { getAppUrl } from '@/lib/config/app-url'
import { logger } from '@/lib/logger'
import { sharedAuth, sharedAuthEnabled } from '@/lib/auth/shared/runtime'

export async function GET(request: NextRequest) {
  // The shared runtime owns this path once it is switched on.
  if (sharedAuthEnabled()) return sharedAuth.GET(request)
  const token = request.nextUrl.searchParams.get('token')

  let verified = false
  if (token) {
    try {
      verified = await verifyEmailToken(token)
    } catch (error) {
      logger.errorWithCause('Email verification failed', error)
    }
  }

  const target = new URL('/login', getAppUrl())
  target.searchParams.set('verified', verified ? '1' : '0')
  return NextResponse.redirect(target)
}
