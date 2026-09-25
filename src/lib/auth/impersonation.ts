/**
 * "Ansicht wechseln" — seeing the product as one of your colleagues sees it.
 *
 * A system administrator building this product cannot answer "what does a
 * Jobcoach actually see?" by reasoning about `ROLE_PERMISSIONS`. The nav, the
 * dashboard queues, the empty states and the caseload all compose, and the only
 * honest answer is to look. Until now that meant logging out and typing a real
 * colleague's login code — which requires holding three people's working
 * credentials, and is exactly the habit a product for vulnerable people should
 * not be teaching.
 *
 * ## Why the session BECOMES them, rather than re-rendering with their role
 *
 * The tempting cheap version is a "preview role" cookie that only overrides the
 * capability triple used for permission checks. It is wrong here, and in a way
 * that would quietly defeat the purpose: the Jobcoach's dashboard is driven by HIS
 * caseload — `careAssignment.staffId = <the Jobcoach's id>` — not by his role. A preview
 * that kept the admin's identity would render a Jobcoach-shaped nav above an
 * administrator's data and call it the Jobcoach's view. The one bug this feature
 * exists to catch (a coach told there is nothing to do while holding a client)
 * is precisely the kind that preview would hide.
 *
 * So the session really is theirs, and the token records who opened it.
 *
 * ## Why it is READ-ONLY, enforced at the request and not in the UI
 *
 * If an impersonated session could write, the audit trail would say the Jobcoach
 * archived a resident when the Jobcoach was at lunch. In a product whose whole claim
 * is that placement decisions are explainable and attributable, an audit row
 * naming the wrong caseworker is worse than no audit row.
 *
 * The enforcement point is the proxy, not the components, for the same reason
 * every other boundary in this codebase is: a rule applied where requests
 * arrive holds for routes nobody remembered to guard. Every non-GET is refused
 * — server actions are POSTs, so they are covered by the same sentence as API
 * routes, without either having to opt in.
 *
 * Note what is deliberately NOT done: the impersonated session keeps every
 * permission the real person has. Stripping `:write` would make write buttons
 * vanish, which is a DIFFERENT screen from the one the colleague sees — and
 * showing you a screen your colleague never sees is the failure mode of the
 * whole idea. So the buttons are there and pressing one is refused. The banner
 * says so.
 */

/**
 * JWT claim holding the id of the administrator who opened this view.
 *
 * Short, because it rides in every request's cookie. Its PRESENCE is the whole
 * signal: a session carrying it is a borrowed one.
 */
export const IMPERSONATION_CLAIM = 'imp'

/**
 * Paths that must keep working while a borrowed session is open.
 *
 * Without this the read-only rule would trap you inside it: the button that
 * hands the session back is itself a POST, and so is signing out. A guard you
 * cannot leave is a bug, not a stricter guard.
 */
export const IMPERSONATION_EXEMPT_PREFIXES = ['/api/auth/impersonate', '/api/auth/logout'] as const

/** Methods that only read. Everything else is refused while impersonating. */
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isReadOnlyMethod(method: string): boolean {
  return READ_ONLY_METHODS.has(method.toUpperCase())
}

export function isImpersonationExempt(pathname: string): boolean {
  return IMPERSONATION_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/**
 * May this request proceed on a borrowed session?
 *
 * The single sentence the proxy asks. Kept here rather than inline in the
 * proxy so the test can state the rule directly, and so the exemption list and
 * the rule that reads it cannot drift apart.
 */
export function impersonationAllowsRequest(args: {
  isImpersonating: boolean
  method: string
  pathname: string
}): boolean {
  if (!args.isImpersonating) return true
  if (isReadOnlyMethod(args.method)) return true
  return isImpersonationExempt(args.pathname)
}

export const IMPERSONATION_LABELS = {
  bannerPrefix: 'Sie sehen die Ansicht von',
  readOnly: 'Nur Lesen — Änderungen sind in dieser Ansicht gesperrt.',
  exit: 'Zurück zu meinem Konto',
  open: 'Ansicht öffnen',
  openHint: 'Das Produkt so sehen, wie diese Person es sieht.',
  blocked: 'In einer geliehenen Ansicht sind Änderungen gesperrt.',
  notPermitted: 'Nur die Systemverwaltung kann eine fremde Ansicht öffnen.',
  alreadyImpersonating: 'Beenden Sie zuerst die aktuelle Ansicht.',
  selfNotAllowed: 'Das ist bereits Ihr eigenes Konto.',
  inactiveTarget: 'Dieses Konto ist deaktiviert.',
  unknownTarget: 'Konto nicht gefunden.',
} as const
