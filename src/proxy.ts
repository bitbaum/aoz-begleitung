import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import {
  destinationForRoot,
  isPublicRoute,
  requiresResidentAuth,
  requiresStaffAuth,
} from '@/lib/auth/route-boundaries'
import {
  STAFF_COOKIE,
  RESIDENT_COOKIE,
  JWT_ISSUER,
  SESSION_SECRET,
  SESSION_REFRESH_THRESHOLD_SECONDS,
} from '@/lib/auth/constants'
import {
  IMPERSONATION_CLAIM,
  IMPERSONATION_LABELS,
  isImpersonationExempt,
  isReadOnlyMethod,
} from '@/lib/auth/impersonation'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { sharedRequestFor } from '@/lib/auth/shared/session'

/**
 * Middleware for authentication
 *
 * - Staff routes require valid JWT
 * - Resident portal routes require resident code
 * - Public routes remain open
 * - Implements sliding session refresh
 */

async function verifyStaffToken(
  token: string,
): Promise<{ valid: boolean; shouldRefresh: boolean; payload?: Record<string, unknown> }> {
  try {
    const secret = new TextEncoder().encode(SESSION_SECRET)
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      algorithms: ['HS256'],
    })

    const now = Math.floor(Date.now() / 1000)
    const exp = payload.exp as number
    const shouldRefresh = exp - now < SESSION_REFRESH_THRESHOLD_SECONDS

    return { valid: true, shouldRefresh, payload }
  } catch {
    return { valid: false, shouldRefresh: false }
  }
}

// Behind Caddy the standalone server sees its bind address (localhost:4008)
// in request.url — build redirects from the forwarded headers instead so the
// browser stays on the public domain.
function publicOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host
  return `${proto}://${host}`
}

export async function proxy(request: NextRequest) {
  if (sharedAuthEnabled()) return sharedProxy(request)
  const { pathname } = request.nextUrl

  // FIRST, above the public-route early return, and that position is the whole
  // point. A borrowed session is read-only EVERYWHERE — including on paths the
  // boundary list calls public.
  //
  // `/api/auth` is public so that signing in can happen without a session, but
  // `invite` and `register` sit under it and both CREATE STAFF ACCOUNTS. With
  // this check inside the `requiresStaffAuth` branch, as it first shipped,
  // those two skipped it entirely: verified against production, where a POST to
  // /api/auth/invite from a borrowed session was refused only by that route's
  // own `users:manage` check. That is luck, not a guard — an administrator
  // viewing ANOTHER administrator passes it, and would have created a real
  // colleague's account while the banner promised changes were locked.
  //
  // The cost is one JWT verification on non-GET requests that carry a staff
  // cookie, which is the cheap side of the trade.
  if (!isReadOnlyMethod(request.method) && !isImpersonationExempt(pathname)) {
    const staffToken = request.cookies.get(STAFF_COOKIE)?.value
    if (staffToken) {
      const { valid, payload } = await verifyStaffToken(staffToken)
      if (valid && payload?.[IMPERSONATION_CLAIM]) {
        return NextResponse.json(
          { success: false, error: IMPERSONATION_LABELS.blocked },
          { status: 403 },
        )
      }
    }
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // The product's own address answered every stranger with a login form, which
  // says nothing except "you are not welcome yet". Anonymous visitors get the
  // landing page instead — rewritten, not redirected, so the URL stays the bare
  // domain. Signed-in people never reach it: staff fall through to their
  // dashboard below, and a resident goes to the portal, because someone who
  // lives here does not need to be sold the product they already use.
  if (pathname === '/') {
    // VERIFY, don't just look. A cookie that exists but no longer verifies —
    // expired, or signed with a rotated secret — used to route `/` to the
    // dashboard, which bounced to /login, and because nothing ever cleared the
    // dead cookie the landing page stayed unreachable for that browser for
    // good. So the token is checked here, and a dead one is deleted on the way
    // out: the next request is a clean anonymous visit instead of the same
    // loop.
    const staffToken = request.cookies.get(STAFF_COOKIE)?.value
    const staffTokenValid = staffToken ? (await verifyStaffToken(staffToken)).valid : false
    const staffCookieIsDead = !!staffToken && !staffTokenValid

    const destination = destinationForRoot({
      hasValidStaffSession: staffTokenValid,
      hasResidentSession: !!request.cookies.get(RESIDENT_COOKIE)?.value,
    })

    if (destination.kind !== 'staff-dashboard') {
      const target = new URL(destination.to, publicOrigin(request))
      const response =
        destination.kind === 'redirect'
          ? NextResponse.redirect(target)
          : NextResponse.rewrite(target)
      if (staffCookieIsDead) response.cookies.delete(STAFF_COOKIE)
      return response
    }
    // 'staff-dashboard' falls through to the staff auth check below.
  }

  if (requiresStaffAuth(pathname)) {
    const token = request.cookies.get(STAFF_COOKIE)?.value

    if (!token) {
      const loginUrl = new URL('/login', publicOrigin(request))
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const { valid, payload } = await verifyStaffToken(token)

    if (!valid) {
      if (!pathname.startsWith('/api/')) {
        // UI routes are verified again in the server admin layout. This keeps
        // Edge middleware as a fast coarse gate without blocking valid Node
        // sessions when Edge env/JWT verification drifts in production.
        return NextResponse.next()
      }

      const loginUrl = new URL('/login', publicOrigin(request))
      loginUrl.searchParams.set('from', pathname)
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete(STAFF_COOKIE)
      return response
    }

    // No impersonation check here: it runs at the TOP of this function, above
    // the public-route return, so it already covers every path this branch
    // could reach. A second copy would be a second place for the rule to drift.
    const response = NextResponse.next()
    if (payload) {
      response.headers.set('x-user-id', payload.sub as string)
      response.headers.set('x-user-role', payload.role as string)
    }

    return response
  }

  if (requiresResidentAuth(pathname)) {
    const residentCode = request.cookies.get(RESIDENT_COOKIE)?.value

    if (!residentCode) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
      }

      return NextResponse.redirect(new URL('/portal', publicOrigin(request)))
    }
  }

  return NextResponse.next()
}

/**
 * The same boundaries on shared sessions (AUTH_RUNTIME=accountkit). Proxy runs
 * on Node, so it reads the session and its scope from the database: a borrowed
 * view is refused writes by its scope row, on every path, before the
 * public-route return, for the same reason the legacy check sits there.
 */
async function sharedProxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { identities, borrowed } = await sharedRequestFor(request.headers)

  if (borrowed && !isReadOnlyMethod(request.method) && !isImpersonationExempt(pathname)) {
    return NextResponse.json(
      { success: false, error: IMPERSONATION_LABELS.blocked },
      { status: 403 },
    )
  }

  if (isPublicRoute(pathname)) return NextResponse.next()

  if (pathname === '/') {
    const destination = destinationForRoot({
      hasValidStaffSession: identities.staff !== null,
      hasResidentSession: identities.resident !== null,
    })
    if (destination.kind !== 'staff-dashboard') {
      const target = new URL(destination.to, publicOrigin(request))
      return destination.kind === 'redirect'
        ? NextResponse.redirect(target)
        : NextResponse.rewrite(target)
    }
  }

  if (requiresStaffAuth(pathname) && !identities.staff) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
    }
    const loginUrl = new URL('/login', publicOrigin(request))
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (requiresResidentAuth(pathname) && !identities.resident) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/portal', publicOrigin(request)))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*|api/health).*)'],
}
