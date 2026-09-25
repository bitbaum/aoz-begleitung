/**
 * Which admin pages enforce a PERMISSION, stated once instead of discovered by
 * reading forty-one files.
 *
 * `STAFF_ROUTES` answers "must you be signed in?" and it listed /settings
 * correctly. Nothing answered the next question — "signed in as WHOM?" — and
 * /settings answered it only by hiding its nav link. On 2026-08-31, signed in
 * to production as the Jobcoach (JOBCOACH / OWN_DOMAIN / isSystemAdmin false),
 * typing the URL served the whole page, including a roster of every
 * colleague's login CODE. A staff code is the credential — `loginByCode` takes
 * it with no password — so the narrowest role in the product could read
 * `AOZ-ADMIN1` and sign in as the system administrator.
 *
 * The page was not careless: it gated the invite form and the config fields.
 * That is the trap worth naming — gating the WRITE affordances looks like
 * access control and reads as thorough, while the page and its payload stay
 * open. A hidden link is not a boundary.
 *
 * So this file makes the guard a declared fact per page. Adding an admin page
 * fails the suite until you say what it requires — and the pages that
 * deliberately require only a session are listed, so "no permission needed"
 * is a decision somebody wrote down rather than a line nobody got to.
 */

import fs from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '../../../..')
const ADMIN_DIR = path.join(REPO_ROOT, 'src/app/(admin)')

/**
 * Pages that any signed-in staff member may open.
 *
 * This is not an amnesty list — every entry is a claim that the page shows
 * nothing a colleague in another discipline may not see, and each one is a
 * reasonable thing to re-examine. What it must never contain is a page that
 * administers the product or renders a credential.
 */
const SESSION_IS_ENOUGH = new Set([
  // The permission-denied page itself. Requiring a permission to be told you
  // lack a permission is a redirect loop.
  'kein-zugriff/page.tsx',
  // The dashboard composes from per-area queries that each apply their own
  // boundary; it is the landing page every staff member must reach.
  'page.tsx',
  'rules/decisions/page.tsx',
  // REMOVED 2026-09-05. The entry read "Scoped per thread, not per role" — and
  // that scoping did not exist. `staffInbox()` is a `findMany` over EVERY
  // thread with no filter, and the thread page took `requireStaffAuth()`, so
  // any staff member could read every resident's conversation. The exemption
  // was the alibi: this list records a claim, and nothing checked that the
  // claim was true. Same shape as the `supportedByUserId` comment that
  // described a filter which was never written.
  //
  // Both pages now require `messages:read`. If a future entry here says a page
  // is "scoped", open the query and confirm it before believing it.
  // Maintenance is NOT here any more. It was, on the guess that a repair board
  // is shared house operations — and walking it in production as a
  // Sozialarbeiter*in disproved that: the nav gates Wartung on
  // `maintenance:read`, which she does not hold, and the page served her the
  // board anyway with working "Neue Anfrage" / "Zuweisen" / "Abschliessen"
  // buttons. The permission existed and only the menu honoured it. Both pages
  // and all three server actions now enforce it.
  //
  // Chores creation is reached from the housing board, which is gated.
  'chores/new/page.tsx',
  // Resident detail renders each care/housing section behind its own
  // hasPermission() check rather than one page-level gate.
  'residents/[id]/page.tsx',
])

/** Pages that administer the product. These MUST require system:configure. */
const ADMINISTRATION = new Map([['settings/page.tsx', 'system:configure']])

function adminPages(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === 'page.tsx') out.push(path.relative(ADMIN_DIR, full))
    }
  }
  walk(ADMIN_DIR)
  return out.sort()
}

function requiredPermission(page: string): string | null {
  const source = fs.readFileSync(path.join(ADMIN_DIR, page), 'utf8')
  const match = source.match(/requirePermission\(\s*'([^']+)'/)
  return match ? match[1] : null
}

describe('every admin page declares what it requires', () => {
  const pages = adminPages()

  it('found the admin pages at all — an empty scan is not a pass', () => {
    expect(pages.length).toBeGreaterThan(20)
  })

  it.each(pages.map((p) => [p]))('%s either enforces a permission or is listed', (page) => {
    const permission = requiredPermission(page)
    const declared = SESSION_IS_ENOUGH.has(page)

    // EXACTLY one, not at least one. The comment here already said "a page
    // that both enforces a permission AND sits on the session-only list is a
    // stale entry" while the assertion was an OR that happily allowed it —
    // so when maintenance/* was given a real guard, the list kept claiming a
    // session was enough for it and nothing complained. A stale exemption is
    // how the next reader learns the wrong boundary.
    expect({ page, guarded: permission !== null, exempt: declared }).toEqual({
      page,
      guarded: !declared,
      exempt: !(permission !== null),
    })
  })

  it.each(Array.from(ADMINISTRATION.entries()))(
    '%s requires %s — administration is never merely "signed in"',
    (page, permission) => {
      expect(requiredPermission(page)).toBe(permission)
      expect(SESSION_IS_ENOUGH.has(page)).toBe(false)
    },
  )

  it('no page that administers the product is on the session-only list', () => {
    for (const page of Array.from(ADMINISTRATION.keys())) {
      expect(SESSION_IS_ENOUGH.has(page)).toBe(false)
    }
  })

  it('the session-only list has no stale entries', () => {
    const stale = Array.from(SESSION_IS_ENOUGH).filter((page) => !pages.includes(page))
    expect(stale).toEqual([])
  })
})

describe('the settings page does not ship anyone a credential', () => {
  /**
   * Checked on the QUERY, not the markup. Dropping `{user.code}` from the JSX
   * would have looked like a fix and left the code in the server payload —
   * this repo has met that exact shape before (the marketplace contactNote).
   */
  it('does not select staff codes', () => {
    const source = fs.readFileSync(path.join(ADMIN_DIR, 'settings/page.tsx'), 'utf8')
    const select = source.match(/db\.query\.user\.findMany\(\{[\s\S]*?\n {4}\}\)/)

    expect(select).not.toBeNull()
    expect(select?.[0]).not.toMatch(/\bcode:\s*true\b/)
  })
})

describe('a client’s wellbeing history is not browsable by every role', () => {
  /**
   * The complaint this whole refactor started from: staff seeing the smiley
   * scale as a property of the client rather than of an appointment they
   * conducted. Moving CAPTURE into closing an appointment fixed half of it.
   * READING stayed open — `SatisfactionHistory` rendered on
   * `residents/[id]` with no permission check at all, so a Jobcoach, who
   * holds neither `placements:read` nor `incidents:read`, got a client's full
   * check-in history by opening their page. Verified in production
   * 2026-08-31.
   *
   * Gated on `placements:read`, matching /placements and /analytics. A role
   * without it is not cut off from someone in trouble: a check-in of 1 or 2
   * raises a WELLBEING incident, which has its own permission.
   */
  it('gates SatisfactionHistory on placements:read', () => {
    const source = fs.readFileSync(path.join(ADMIN_DIR, 'residents/[id]/page.tsx'), 'utf8')

    expect(source).toMatch(
      /canReadPlacements\s*=\s*staff\s*\?\s*hasPermission\(staff, 'placements:read'\)/,
    )
    expect(source).toMatch(/canReadPlacements\s*&&\s*\(?\s*<SatisfactionHistory/)
  })
})

describe('the analytics page does not bypass the placements boundary', () => {
  /**
   * `/analytics` requires only `dashboard:read`, which every role holds —
   * correct for the page as a whole, since most of it is aggregate pilot
   * health (counts, rates, chart data). `RecentPlacementsTable` is the one
   * section that is not aggregate: it names residents, links straight into
   * their profile, and renders their satisfaction check-in emoji — the
   * exact surface `/placements` fences off behind `placements:read`.
   *
   * Gating only the page and rendering that table unconditionally handed a
   * Jobcoach or Freiwilligenarbeit viewer — who cannot open /placements
   * directly — the identical identified data through this page instead. A
   * boundary that exists one page over is not a boundary on this one, the
   * same shape /settings had.
   *
   * Checked on the SOURCE rather than a full RSC render (this repo has no
   * harness for that), and on both halves: the query must be conditioned on
   * the permission, and the component must be conditioned on it too —
   * gating only the render would still fetch the data into the process,
   * and gating only the query without a check nearby is invisible to a
   * reader trying to verify the boundary holds.
   */
  it('conditions both the query and the render on placements:read', () => {
    const source = fs.readFileSync(path.join(ADMIN_DIR, 'analytics/page.tsx'), 'utf8')

    expect(source).toMatch(
      /canReadPlacements\s*=\s*hasPermission\(\s*currentUser,\s*'placements:read'\s*\)/,
    )

    const queryLine = source.match(/canReadPlacements\s*\n?\s*\?\s*db\.query\.placement\.findMany/)
    expect(queryLine).not.toBeNull()

    const renderLine = source.match(/canReadPlacements\s*&&\s*<RecentPlacementsTable/)
    expect(renderLine).not.toBeNull()
  })
})
