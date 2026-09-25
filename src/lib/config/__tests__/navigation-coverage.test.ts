/**
 * Navigation is only trustworthy if it is COMPLETE and UNAMBIGUOUS:
 * every page has a way in, and no destination has two ways in.
 *
 * Both halves had failed at once. "Integration" was three menu entries
 * (`/learning?board=overview|job|volunteering`) pointing at a single page that
 * already renders its own board switcher — two controls for one choice, so the
 * menu and the page could disagree about where you were. Meanwhile the reader
 * had no way to tell whether a page they could not find was missing or just
 * undiscoverable.
 *
 * Derived from the filesystem on purpose: a hand-written expectation drifts
 * exactly like the nav it is meant to guard.
 */

import { readdirSync } from 'fs'
import { join } from 'path'
import { ADMIN_NAV_EXCLUDED_ROUTES, MEGAMENU_GROUPS, SYSTEM_LINKS } from '../navigation'

const ADMIN_DIR = join(__dirname, '..', '..', '..', 'app', '(admin)')

/**
 * Every admin page directory, as a top-level route, minus the routes that are
 * documented destinations-you-are-SENT-to rather than places you navigate.
 * The exception list is explicit config, so weakening this rule requires
 * writing down why.
 */
const adminRoutes = readdirSync(ADMIN_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `/${entry.name}`)
  .filter((route) => !(ADMIN_NAV_EXCLUDED_ROUTES as readonly string[]).includes(route))

/** Every destination the staff nav offers, megamenu plus system links. */
const navHrefs: string[] = [
  // An entry's `activeFor` routes count as reached through it: the catalogue
  // entry stands for /activities too, and the tab strip it opens on links
  // there. `catalogue.test.ts` holds that tab strip to the claim, so this is
  // not a way to wave a route through.
  ...MEGAMENU_GROUPS.flatMap((group) =>
    'href' in group
      ? [group.href, ...(group.activeFor ?? [])]
      : group.items.map((item) => item.href),
  ),
  ...SYSTEM_LINKS.map((link) => link.href),
]

/** '/learning?board=job' and '/residents/new' both live under a top-level route. */
function topLevel(href: string): string {
  return `/${href.split('?')[0].split('/')[1] ?? ''}`
}

describe('staff navigation coverage', () => {
  it('finds the admin route group', () => {
    // Guards the guard: a wrong path makes every assertion below vacuous.
    expect(adminRoutes.length).toBeGreaterThan(10)
  })

  it.each(adminRoutes)('offers a way to reach %s', (route) => {
    const reachable = navHrefs.some((href) => topLevel(href) === route)
    expect(reachable).toBe(true)
  })

  it('never lists the same destination twice', () => {
    const seen: Record<string, number> = {}
    for (const href of navHrefs) seen[href] = (seen[href] ?? 0) + 1
    const duplicates = Object.entries(seen)
      .filter(([, count]) => count > 1)
      .map(([href]) => href)

    expect(duplicates).toEqual([])
  })

  it('never sends two menu entries to one page via different query strings', () => {
    // The specific shape of the old bug: same page, different ?board=.
    const byPage: Record<string, string[]> = {}
    for (const href of navHrefs) {
      const page = href.split('?')[0]
      byPage[page] = [...(byPage[page] ?? []), href]
    }
    const competing = Object.entries(byPage)
      .filter(([, hrefs]) => hrefs.length > 1)
      .map(([page, hrefs]) => `${page}: ${hrefs.join(', ')}`)

    expect(competing).toEqual([])
  })

  it('never labels an item the same as the group that contains it', () => {
    // "Klient*innen › Klient*innen" gives the reader nothing to choose by.
    const offenders: string[] = []
    for (const group of MEGAMENU_GROUPS) {
      if (!('items' in group)) continue
      for (const item of group.items) {
        if (item.label === group.label) offenders.push(`${group.label} › ${item.label}`)
      }
    }

    expect(offenders).toEqual([])
  })
})
