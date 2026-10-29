/**
 * AOZ's sign-in screens, served by the shared runtime.
 *
 * The screens keep their API (POST /api/auth/login, /signup, /claim,
 * /forgot-password, /reset-password and the answers they expect). With
 * AUTH_RUNTIME=accountkit those routes call AccountKit's endpoints in process
 * and translate the answer, so no legacy credential writer runs beside the
 * shared one. Every rate limit, origin check, hash and session is AccountKit's.
 */
import { NextResponse } from 'next/server'
import { CLAIM_ERRORS } from '@bitbaum/accountkit/auth'
import { getAppUrl } from '@/lib/config/app-url'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import type { AuthUser } from '../index'
import type { SessionIdentities } from './identity'
import { identitiesForSession, readSessionScope } from './identity'
import { sharedAuth, CLAIM_PROOF } from './runtime'

interface SharedAnswer {
  status: number
  body: Record<string, unknown>
  cookies: string[]
}

/** Run one AccountKit endpoint for this request, through its own limiter. */
export async function callShared(
  request: Request,
  route: string,
  body: Record<string, unknown>,
): Promise<SharedAnswer> {
  const origin = new URL(getAppUrl()).origin
  const headers = new Headers({ origin, 'content-type': 'application/json' })
  for (const name of ['cookie', 'x-forwarded-for', 'x-real-ip', 'user-agent']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const response = await sharedAuth.POST(
    new Request(`${origin}/api/auth${route}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  )
  const text = await response.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    // An answer that is not JSON carries nothing to translate.
  }
  return { status: response.status, body: parsed, cookies: response.headers.getSetCookie() }
}

/** Who the session these Set-Cookie headers just opened may act as. */
async function identitiesFromCookies(cookies: string[]): Promise<SessionIdentities> {
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ')
  const session = cookie
    ? await sharedAuth.sessionFor(new Headers({ cookie })).catch(() => null)
    : null
  if (!session) return { staff: null, resident: null }
  return identitiesForSession(session.user.id, await readSessionScope(session.session.id))
}

function respond(json: Record<string, unknown>, status: number, cookies: string[] = []) {
  const response = NextResponse.json(json, { status })
  for (const cookie of cookies) response.headers.append('set-cookie', cookie)
  return response
}

/** The answer the screens expect after any sign-in: where to land, which roles. */
function signedIn(identities: SessionIdentities, cookies: string[]) {
  const roles: Array<'staff' | 'resident'> = []
  if (identities.staff) roles.push('staff')
  if (identities.resident) roles.push('resident')
  return respond(
    { success: true, type: identities.staff ? 'staff' : 'resident', roles },
    200,
    cookies,
  )
}

const NEEDS_VERIFICATION = {
  success: false,
  error: ERROR_MESSAGES.AUTH_EMAIL_NOT_VERIFIED,
  needsVerification: true,
}

export async function sharedEmailLogin(request: Request, email: string, password: string) {
  const answer = await callShared(request, '/sign-in/email', { email, password })
  if (answer.status === 403 && answer.body.code === 'EMAIL_NOT_VERIFIED') {
    return respond(NEEDS_VERIFICATION, 403)
  }
  if (answer.status === 429)
    return respond({ success: false, error: ERROR_MESSAGES.RATE_LIMITED }, 429)
  if (answer.status !== 200) {
    return respond({ success: false, error: ERROR_MESSAGES.INVALID_CREDENTIALS }, 401)
  }
  const identities = await identitiesFromCookies(answer.cookies)
  // Every identity deactivated: the same generic refusal as a wrong password.
  if (!identities.staff && !identities.resident) {
    return respond({ success: false, error: ERROR_MESSAGES.INVALID_CREDENTIALS }, 401)
  }
  return signedIn(identities, answer.cookies)
}

export async function sharedCodeLogin(request: Request, code: string) {
  const answer = await callShared(request, '/sign-in/domain', { credential: code })
  if (answer.status === 429)
    return respond({ success: false, error: ERROR_MESSAGES.RATE_LIMITED }, 429)
  if (answer.status !== 200) {
    return respond({ success: false, error: 'Ungültiger Code' }, 401)
  }
  const identities = await identitiesFromCookies(answer.cookies)
  if (identities.staff) {
    return respond(
      { success: true, type: 'staff', user: publicStaff(identities.staff) },
      200,
      answer.cookies,
    )
  }
  if (identities.resident) {
    return respond(
      { success: true, type: 'resident', code: identities.resident.code },
      200,
      answer.cookies,
    )
  }
  return respond({ success: false, error: 'Ungültiger Code' }, 401)
}

function publicStaff(staff: AuthUser) {
  return { id: staff.id, email: staff.email, name: staff.name, role: staff.role }
}

const CLAIM_MESSAGES: Record<string, string> = {
  [CLAIM_ERRORS.invalid]: ERROR_MESSAGES.AUTH_CODE_UNKNOWN,
  [CLAIM_ERRORS.alreadyClaimed]: ERROR_MESSAGES.AUTH_ALREADY_REGISTERED,
  [CLAIM_ERRORS.emailTaken]: ERROR_MESSAGES.AUTH_EMAIL_TAKEN,
  [CLAIM_ERRORS.emailNeedsRecovery]: ERROR_MESSAGES.AUTH_EMAIL_NEEDS_RECOVERY,
  [CLAIM_ERRORS.linkPasswordMismatch]: ERROR_MESSAGES.AUTH_LINK_PASSWORD_MISMATCH,
  [CLAIM_ERRORS.verifiedEmailMismatch]: ERROR_MESSAGES.AUTH_VERIFIED_EMAIL_MISMATCH,
}

/**
 * Claim a code or a claim link. `invalidStatus` keeps each screen's answer for
 * a proof that names nobody (the claim-link page shows "link expired" on 410).
 */
export async function sharedClaim(
  request: Request,
  proof: { code: string } | { link: string },
  input: { email: string; password: string },
  invalidStatus = 400,
  invalidMessage: string = ERROR_MESSAGES.AUTH_CODE_UNKNOWN,
) {
  const credential = 'code' in proof ? CLAIM_PROOF.code(proof.code) : CLAIM_PROOF.link(proof.link)
  const answer = await callShared(request, '/provision/claim', {
    credential,
    ...input,
    callbackURL: '/login?verified=1',
  })
  if (answer.status === 429)
    return respond({ success: false, error: ERROR_MESSAGES.RATE_LIMITED }, 429)
  if (
    answer.status === 400 ||
    (answer.status === 403 && answer.body.code === CLAIM_ERRORS.invalid)
  ) {
    // Shape refused (an address that cannot receive mail, an empty password).
    return respond({ success: false, error: ERROR_MESSAGES.AUTH_EMAIL_INVALID }, 400)
  }
  if (answer.status !== 200) {
    const code = String(answer.body.code ?? '')
    if (code === CLAIM_ERRORS.invalid) {
      return respond({ success: false, error: invalidMessage }, invalidStatus)
    }
    return respond(
      { success: false, error: CLAIM_MESSAGES[code] ?? ERROR_MESSAGES.SESSION_ERROR },
      answer.status === 401 ? 401 : 400,
    )
  }
  if (answer.body.status === 'verify_email') {
    return respond({ success: true, verifyEmail: true }, 200)
  }
  if (answer.body.status === 'sign_in') {
    return respond({ success: true, signIn: true }, 200)
  }
  return signedIn(await identitiesFromCookies(answer.cookies), answer.cookies)
}

export async function sharedForgotPassword(request: Request, email: string) {
  const answer = await callShared(request, '/request-password-reset', {
    email,
    redirectTo: `${getAppUrl()}/reset-password`,
  })
  if (answer.status === 429)
    return respond({ success: false, error: ERROR_MESSAGES.RATE_LIMITED }, 429)
  // Without a mail transport AccountKit refuses recovery; say so loudly, as
  // the legacy route did, rather than pretend a link is on its way.
  if (answer.status !== 200) {
    return respond({ success: false, error: ERROR_MESSAGES.AUTH_EMAIL_NOT_CONFIGURED }, 503)
  }
  return respond({ success: true }, 200)
}

export async function sharedResetPassword(request: Request, token: string, password: string) {
  const answer = await callShared(request, '/reset-password', { token, newPassword: password })
  if (answer.status === 429)
    return respond({ success: false, error: ERROR_MESSAGES.RATE_LIMITED }, 429)
  if (answer.status !== 200) {
    return respond({ success: false, error: ERROR_MESSAGES.AUTH_RESET_TOKEN_INVALID }, 400)
  }
  return respond({ success: true }, 200)
}

export async function sharedResendVerification(request: Request, email: string) {
  const answer = await callShared(request, '/send-verification-email', {
    email,
    callbackURL: '/login?verified=1',
  })
  if (answer.status === 429)
    return respond({ success: false, error: ERROR_MESSAGES.RATE_LIMITED }, 429)
  return respond({ success: answer.status === 200 }, answer.status === 200 ? 200 : 400)
}
