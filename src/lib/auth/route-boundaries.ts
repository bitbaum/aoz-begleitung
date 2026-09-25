/**
 * Auth route boundary definitions and pure match helpers.
 * Kept framework-agnostic for easy testing.
 */

// Deliberately the only import here, and deliberately a module that carries no
// landing COPY: this file is loaded by middleware on the edge.
import { LANDING_ROUTES } from '@/lib/config/public-locales'

// Routes that require staff authentication.
//
// This list must cover EVERY page under `src/app/(admin)/`. It had drifted to
// eleven of nineteen: /rules, /learning, /marketplace, /events, /activities,
// /settings, /algorithm and /ai-assistant were reachable through middleware
// and stopped one layer later by the admin layout. Nothing leaked — the
// layout and every API route guard themselves — but a declared boundary that
// does not match the enforced one is how the /algorithm mismatch survived for
// months, and reading this list told you the wrong thing about the app.
//
// `route-boundaries.test.ts` now derives the expected set from the filesystem,
// so a new admin page fails the suite until it is listed here.
export const STAFF_ROUTES = [
  '/',
  '/activities',
  '/ai-assistant',
  '/algorithm',
  '/analytics',
  '/approvals',
  '/audit',
  '/chores',
  '/complaints',
  '/events',
  '/housing',
  '/incidents',
  // Where requirePermission() lands a signed-in staff member whose role
  // cannot open a page. Staff-only: an anonymous visitor has no role to
  // explain, and belongs at /login.
  '/kein-zugriff',
  '/learning',
  '/maintenance',
  '/marketplace',
  '/matching',
  '/messages',
  '/opportunities',
  '/placements',
  '/residents',
  '/rules',
  '/settings',
  '/transfer-requests',
  '/api/messages',
  '/api/export',
  '/api/import',
]

// Routes that require resident authentication
export const RESIDENT_ROUTES = [
  '/portal/preferences',
  '/portal/roommates',
  '/portal/report',
  '/portal/complaints',
  '/api/portal/complaints',
  '/portal/chores',
  '/portal/transfer',
  '/portal/expenses',
  '/portal/apartment',
  '/portal/profile',
  '/api/portal/transfer',
  '/api/portal/report',
  '/api/portal/preferences',
  '/api/portal/satisfaction',
  '/api/portal/chores',
  '/api/portal/expenses',
  '/api/portal/settlements',
  '/api/portal/profile',
  '/api/portal/apartment',
  '/api/portal/residents',
  '/api/portal/messages',
]

// Routes that remain public.
//
// Being listed here only means the middleware waves the request through — it
// does NOT make a page readable, because the layout above that page runs
// afterwards and can still redirect. `/algorithm` sat in this list for months
// while `(admin)/layout.tsx` bounced every signed-out visitor to /login, so the
// boundary the code declared and the boundary the app enforced disagreed.
// A page that is genuinely public belongs in the `(public)` route group, whose
// layout reads no session. `public-routes-reachable.test.ts` checks that.
export const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/portal',
  '/portal/help',
  '/blog',
  '/changelog',
  '/roadmap',
  // Where AI is used and what it sends — readable BEFORE anyone logs in, by
  // whoever is deciding whether to trust this product with people's data.
  '/ki-datenschutz',
  // The landing page, in every language it comes in. `/` rewrites to the
  // German one for anonymous visitors, so it must be reachable without a
  // session — and each is also a real URL of its own.
  //
  // Spread from the locale list rather than typed out: a language added there
  // and forgotten here renders a finished page that middleware bounces to the
  // login form. Not hypothetical — `public-routes-reachable.test.ts` failed on
  // exactly that when `/[lang]/willkommen` was added.
  ...LANDING_ROUTES,
  '/api/auth',
  '/api/health',
  '/api/cron',
]

/** The landing page a stranger sees at the bare domain. */
export const LANDING_ROUTE = '/willkommen'

/**
 * What the product's own address should do, by who is asking.
 *
 * It used to answer every stranger with a login form, which says nothing except
 * "you are not welcome yet". Now:
 *
 *  - staff continue to their dashboard, which is what `/` has always been;
 *  - a resident goes to the portal, because someone who already lives here does
 *    not need to be sold the product they use;
 *  - everyone else gets the landing page, REWRITTEN rather than redirected, so
 *    the URL stays the bare domain instead of turning into /willkommen.
 *
 * Extracted as a pure function so the decision is testable on its own. Inside
 * the middleware it would only be reachable by constructing a NextRequest, and
 * an untested branch here means strangers, residents or staff silently landing
 * on the wrong side of the product.
 */
export type RootDestination =
  { kind: 'staff-dashboard' } | { kind: 'redirect'; to: string } | { kind: 'rewrite'; to: string }

/**
 * The parameter is `hasVALIDStaffSession`, not `hasStaffSession`, and the
 * difference is the whole bug it was written to end.
 *
 * This used to be answered from cookie PRESENCE. A staff cookie that had
 * expired — or been signed with a secret that has since rotated — still sent
 * `/` to the dashboard, the dashboard bounced to /login, and the landing page
 * became permanently unreachable for that browser: every visit repeated the
 * loop, because nothing ever cleared the dead credential. The product's own
 * address answered "you are not welcome yet" to someone who had simply been
 * away too long, and no amount of navigating could escape it.
 *
 * Presence is not a session. The caller must verify before asking.
 */
export function destinationForRoot({
  hasValidStaffSession,
  hasResidentSession,
}: {
  hasValidStaffSession: boolean
  hasResidentSession: boolean
}): RootDestination {
  // Staff wins when someone holds both: it is the bigger surface, and the nav
  // offers the switch. Same rule as `establishSessions()` uses at login.
  if (hasValidStaffSession) return { kind: 'staff-dashboard' }
  if (hasResidentSession) return { kind: 'redirect', to: '/portal' }
  return { kind: 'rewrite', to: LANDING_ROUTE }
}

export function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => matchesRoute(pathname, route))
}

export function requiresStaffAuth(pathname: string): boolean {
  if (pathname === '/') return true
  return STAFF_ROUTES.some((route) => route !== '/' && matchesRoute(pathname, route))
}

export function requiresResidentAuth(pathname: string): boolean {
  return RESIDENT_ROUTES.some((route) => matchesRoute(pathname, route))
}
