import {
  IMPERSONATION_CLAIM,
  IMPERSONATION_EXEMPT_PREFIXES,
  impersonationAllowsRequest,
  isImpersonationExempt,
  isReadOnlyMethod,
} from '../impersonation'
import { createToken, verifyToken } from '../jwt'

describe('what a borrowed session may do', () => {
  /**
   * The rule this feature stands on. If it ever returns true for a POST on an
   * ordinary route, an administrator's click is written to the database under a
   * colleague's name — which is the one outcome that would make the audit trail
   * lie about who made a placement decision.
   */
  it.each([
    ['POST', '/residents/new'],
    ['PATCH', '/api/residents/abc'],
    ['DELETE', '/api/housing/xyz'],
    ['PUT', '/api/incidents/1'],
    // Server actions are POSTs to the page they live on — the reason the rule
    // is stated over METHOD rather than over a list of API paths.
    ['POST', '/settings'],
    ['POST', '/incidents/5'],
  ])('refuses %s %s', (method, pathname) => {
    expect(impersonationAllowsRequest({ isImpersonating: true, method, pathname })).toBe(false)
  })

  it.each([
    ['GET', '/'],
    ['GET', '/residents'],
    ['HEAD', '/api/export/residents'],
    ['OPTIONS', '/api/anything'],
  ])('allows %s %s, because looking is the whole point', (method, pathname) => {
    expect(impersonationAllowsRequest({ isImpersonating: true, method, pathname })).toBe(true)
  })

  it('lets you back out — the exit route is a POST/DELETE and must survive', () => {
    // A read-only guard you cannot leave would trap the administrator inside a
    // colleague's account with no way home but clearing cookies.
    for (const prefix of IMPERSONATION_EXEMPT_PREFIXES) {
      expect(
        impersonationAllowsRequest({ isImpersonating: true, method: 'DELETE', pathname: prefix }),
      ).toBe(true)
    }
  })

  it('does not exempt a route that merely starts with the same characters', () => {
    // '/api/auth/impersonated-thing' must not inherit the exemption.
    expect(isImpersonationExempt('/api/auth/impersonate')).toBe(true)
    expect(isImpersonationExempt('/api/auth/impersonate/stop')).toBe(true)
    expect(isImpersonationExempt('/api/auth/impersonateXYZ')).toBe(false)
  })

  /**
   * The hole this shipped with, found by probing the deployed instance rather
   * than by reading the code.
   *
   * `/api/auth` is in PUBLIC_ROUTES so that signing in works without a session.
   * The first version of this guard sat inside the proxy's `requiresStaffAuth`
   * branch, BELOW the public-route early return — so these two, which create
   * staff accounts, skipped the rule completely. Production refused the probe
   * only because the impersonated Jobcoach lacked `users:manage`; an
   * administrator viewing another administrator would have sailed through and
   * created a real colleague's account, under a banner promising the opposite.
   *
   * The rule itself was never wrong. Its CALL SITE was. These cases exist so a
   * future reorganisation of the proxy cannot quietly reintroduce the same
   * ordering.
   */
  it.each([['/api/auth/invite'], ['/api/auth/register'], ['/api/auth/signup']])(
    'refuses POST %s even though it sits under a public prefix',
    (pathname) => {
      expect(isImpersonationExempt(pathname)).toBe(false)
      expect(impersonationAllowsRequest({ isImpersonating: true, method: 'POST', pathname })).toBe(
        false,
      )
    },
  )

  it('constrains nothing when the session is your own', () => {
    expect(
      impersonationAllowsRequest({
        isImpersonating: false,
        method: 'POST',
        pathname: '/residents/new',
      }),
    ).toBe(true)
  })

  it.each([['get'], ['Get'], ['GET']])('is case-insensitive about the method (%s)', (method) => {
    expect(isReadOnlyMethod(method)).toBe(true)
  })
})

describe('the claim survives a round trip through the token', () => {
  /**
   * `verifyToken` validates against a zod schema. When the claim was added the
   * schema had to learn about it — `.passthrough()` happens to keep unknown
   * keys, but relying on that would mean the banner and the read-only rule
   * depend on a side effect nobody declared.
   */
  it('carries the impersonator id back out', async () => {
    const token = await createToken({
      sub: 'target-user',
      email: 'admin@example.ch',
      name: 'Jonas M.',
      role: 'JOBCOACH',
      [IMPERSONATION_CLAIM]: 'admin-user',
    })

    const payload = await verifyToken(token)

    expect(payload?.sub).toBe('target-user')
    expect(payload?.[IMPERSONATION_CLAIM]).toBe('admin-user')
  })

  it('an ordinary session carries no claim at all', async () => {
    // Absence is what makes a session yours. If an ordinary login ever minted
    // this claim, every session would be silently read-only.
    const token = await createToken({
      sub: 'someone',
      email: 'a@b.ch',
      name: 'Anna Muster',
      role: 'BETREUUNG',
    })

    const payload = await verifyToken(token)

    expect(payload?.[IMPERSONATION_CLAIM]).toBeUndefined()
  })

  it('rejects a token whose claim is not a string', async () => {
    // Declared in the schema rather than left to passthrough, so a tampered
    // claim fails the parse instead of arriving as an unknown.
    const token = await createToken({
      sub: 'someone',
      email: 'a@b.ch',
      name: 'Lea',
      role: 'FREIWILLIGENARBEIT',
      // Deliberately the wrong shape. TypeScript permits it — JWTPayload
      // carries an index signature, so the compiler is no help here at all,
      // which is precisely why the schema has to be.
      [IMPERSONATION_CLAIM]: { not: 'a string' },
    })

    expect(await verifyToken(token)).toBeNull()
  })
})
