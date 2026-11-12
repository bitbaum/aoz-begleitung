import { readdirSync } from 'fs'
import { join } from 'path'
import {
  isPublicRoute,
  requiresResidentAuth,
  requiresStaffAuth,
  destinationForRoot,
  LANDING_ROUTE,
} from '@/lib/auth/route-boundaries'

describe('the declared boundary matches the app on disk', () => {
  /**
   * Derived from the filesystem, never hand-listed — a hand-listed expectation
   * drifts exactly like the thing it is supposed to guard. STAFF_ROUTES had
   * fallen to eleven of nineteen admin pages this way.
   */
  const adminPages = readdirSync(join(__dirname, '..', '..', '..', 'app', '(admin)'), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `/${entry.name}`)

  it('finds the admin route group', () => {
    // Guards the guard: a wrong path would make every assertion below vacuous.
    expect(adminPages.length).toBeGreaterThan(10)
  })

  it.each(adminPages)('requires staff auth for %s', (route) => {
    expect(requiresStaffAuth(route)).toBe(true)
  })

  it.each(adminPages)('does not treat %s as public', (route) => {
    expect(isPublicRoute(route)).toBe(false)
  })
})

describe('auth route boundaries', () => {
  test('public routes are public', () => {
    expect(isPublicRoute('/portal')).toBe(true)
    expect(isPublicRoute('/portal/help')).toBe(true)
    expect(isPublicRoute('/login')).toBe(true)
    expect(isPublicRoute('/api/auth/login')).toBe(true)
  })

  test('the portal entry is public, its pages are not', () => {
    // '/portal' matched as a prefix made every portal page public at the
    // middleware, so RESIDENT_ROUTES was never consulted for a page.
    expect(isPublicRoute('/portal')).toBe(true)
    expect(isPublicRoute('/portal/help')).toBe(true)
    for (const page of ['/portal/profile', '/portal/expenses', '/portal/chores/123']) {
      expect({ page, public: isPublicRoute(page) }).toEqual({ page, public: false })
      expect({ page, resident: requiresResidentAuth(page) }).toEqual({ page, resident: true })
    }
  })

  test('staff routes require staff auth', () => {
    expect(requiresStaffAuth('/')).toBe(true)
    expect(requiresStaffAuth('/residents')).toBe(true)
    expect(requiresStaffAuth('/housing/abc')).toBe(true)
    expect(requiresStaffAuth('/portal')).toBe(false)
  })

  test('resident routes require resident auth', () => {
    expect(requiresResidentAuth('/portal/preferences')).toBe(true)
    expect(requiresResidentAuth('/portal/chores/123')).toBe(true)
    expect(requiresResidentAuth('/api/portal/preferences')).toBe(true)
    expect(requiresResidentAuth('/api/portal/chores/abc/complete')).toBe(true)
    expect(requiresResidentAuth('/login')).toBe(false)
    expect(requiresResidentAuth('/api/auth/login')).toBe(false)
  })

  test('staff and resident boundaries stay separated', () => {
    expect(requiresStaffAuth('/portal/preferences')).toBe(false)
    expect(requiresResidentAuth('/residents')).toBe(false)
  })
})

describe('what the bare domain does', () => {
  /**
   * The product's own address used to answer every stranger with a login form,
   * which tells a visitor nothing except that they are not welcome yet.
   */
  const at = (hasValidStaffSession: boolean, hasResidentSession: boolean) =>
    destinationForRoot({ hasValidStaffSession, hasResidentSession })

  test('shows a stranger the landing page', () => {
    expect(at(false, false)).toEqual({ kind: 'rewrite', to: LANDING_ROUTE })
  })

  test('rewrites rather than redirects, so the URL stays the bare domain', () => {
    // A redirect would park every visitor on /willkommen and make each share of
    // "the site" carry a path. The distinction is the whole point.
    expect(at(false, false).kind).toBe('rewrite')
  })

  test('leaves staff on the dashboard the root has always been', () => {
    expect(at(true, false)).toEqual({ kind: 'staff-dashboard' })
  })

  test('sends a resident to their portal instead of a sales page', () => {
    // Someone who lives here does not need to be sold the product they use.
    expect(at(false, true)).toEqual({ kind: 'redirect', to: '/portal' })
  })

  test('gives staff the dashboard when one person holds both roles', () => {
    // Matches what establishSessions() does at login: staff wins the landing
    // page because it is the bigger surface, and the nav offers the switch.
    expect(at(true, true)).toEqual({ kind: 'staff-dashboard' })
  })

  test('an expired staff cookie sees the landing page, not a login wall', () => {
    // The caller passes VALIDITY, not presence. When a staff cookie no longer
    // verifies, this must answer exactly as it does for a stranger — otherwise
    // `/` routes to the dashboard, the dashboard bounces to /login, and the
    // landing page is unreachable in that browser until the cookie is cleared
    // by hand. Middleware deletes the dead cookie alongside this answer.
    expect(at(false, false)).toEqual({ kind: 'rewrite', to: LANDING_ROUTE })
  })

  test('declares the landing page public, or the rewrite bounces to /login', () => {
    // The rewrite target runs through the same middleware. If it were not
    // public, the bare domain would send strangers straight back to the login
    // form this change exists to replace.
    expect(isPublicRoute(LANDING_ROUTE)).toBe(true)
  })
})
