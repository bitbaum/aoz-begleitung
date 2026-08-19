import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import {
  PORTAL_NAV_ITEMS,
  PORTAL_NAV_HIDDEN_ROUTES,
  PORTAL_TAB_ITEMS,
  PORTAL_NAV_GROUP_ORDER,
  NAV_ICONS,
  portalTabItems,
  visiblePortalNavItems,
  portalSidebarItems,
} from '@/lib/config/navigation'
import { BRAND } from '@/lib/config/brand'
import { PORTAL_LABELS } from '@/lib/constants/labels'
import { portalNavMessageKey, isPortalPathActive } from '@/lib/utils/portal-nav'
import { createTranslator } from '@/lib/i18n'
import { de } from '@/lib/i18n/dictionaries/de'

/**
 * A page nobody can reach is a page that does not exist.
 *
 * The portal's navigation was a hamburger over a flat list, and the failure it
 * invited is silent in every other check: ship a page, forget to add it to the
 * list, and the route works, the tests pass, the link is simply nowhere. So the
 * rule is checked against the router's own truth — the files on disk — rather
 * than against the list checking itself.
 */

const PORTAL_DIR = join(process.cwd(), 'src', 'app', 'portal')

/** Portal page routes that exist on disk, excluding dynamic detail pages. */
function portalPageRoutes(dir: string, prefix = '/portal'): string[] {
  const routes: string[] = []
  if (existsSync(join(dir, 'page.tsx'))) routes.push(prefix)

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    // `[id]` pages are reached from their list page, never from a menu.
    if (entry.name.startsWith('[') || entry.name.startsWith('(')) continue
    // Creation pages are verbs, not destinations: `/portal/chores/new` is
    // reached from the "+" on the chores page. A menu is for places you go.
    if (entry.name === 'new') continue
    routes.push(...portalPageRoutes(join(dir, entry.name), `${prefix}/${entry.name}`))
  }
  return routes
}

const routesOnDisk = portalPageRoutes(PORTAL_DIR)

describe('portal navigation covers the portal', () => {
  it('finds the portal pages on disk', () => {
    // Without this the assertions below would pass over an empty list if the
    // walk ever broke or the folder moved.
    expect(routesOnDisk.length).toBeGreaterThan(8)
    expect(routesOnDisk).toContain('/portal')
  })

  it('offers every portal page somewhere in the navigation', () => {
    const linked = new Set(PORTAL_NAV_ITEMS.map((item) => item.href))
    const hidden = new Set<string>(PORTAL_NAV_HIDDEN_ROUTES)
    const unreachable = routesOnDisk.filter((route) => !linked.has(route) && !hidden.has(route))

    expect({ unreachable }).toEqual({ unreachable: [] })
  })

  it('keeps unhelpful pages as redirects, not as menu items', () => {
    const linked = new Set(PORTAL_NAV_ITEMS.map((item) => item.href))
    for (const href of PORTAL_NAV_HIDDEN_ROUTES) {
      expect(routesOnDisk).toContain(href)
      expect(linked.has(href)).toBe(false)
    }
  })

  it('never links to a page that does not exist', () => {
    // The other direction: a renamed folder leaves a menu entry pointing at a
    // 404, which looks exactly like a working link until it is tapped.
    const onDisk = new Set(routesOnDisk)
    const dangling = PORTAL_NAV_ITEMS.map((item) => item.href).filter((href) => !onDisk.has(href))

    expect({ dangling }).toEqual({ dangling: [] })
  })
})

describe('the mobile tab bar', () => {
  it('pins four destinations, so five targets fit a 375px row', () => {
    // Four tabs plus "Mehr". A fifth pinned tab makes every label truncate at
    // the narrowest supported width.
    expect(PORTAL_TAB_ITEMS).toHaveLength(4)
    expect(portalTabItems()).toHaveLength(4)
  })

  it('starts with the overview and keeps the declared order', () => {
    expect(PORTAL_TAB_ITEMS.map((item) => item.href)[0]).toBe('/portal')
    expect(PORTAL_TAB_ITEMS.map((item) => item.tab)).toEqual([1, 2, 3, 4])
  })

  it('gives every item a real icon and a real label', () => {
    for (const item of PORTAL_NAV_ITEMS) {
      // An unknown icon key renders `undefined` as a component and crashes the
      // whole nav — the one part of the page that must never fail.
      expect({ href: item.href, icon: Boolean(NAV_ICONS[item.icon]) })
        .toEqual({ href: item.href, icon: true })

      // The key must exist in the German dictionary, not merely resolve: a
      // missing key falls back to German by design, and German falling back to
      // German would hide a typo'd key behind `undefined`.
      const key = portalNavMessageKey(item)
      expect({ href: item.href, inDictionary: key in de })
        .toEqual({ href: item.href, inDictionary: true })

      const label = createTranslator('de')(key)
      expect({ href: item.href, label: typeof label === 'string' && label.length > 0 })
        .toEqual({ href: item.href, label: true })
    }
  })

  it('respects household money and vote flags for this brand', () => {
    const hrefs = visiblePortalNavItems().map((item) => item.href)
    expect(hrefs).toContain('/portal/learning')
    if (BRAND.features.householdMoney) {
      expect(hrefs).toContain('/portal/expenses')
    } else {
      expect(hrefs).not.toContain('/portal/expenses')
    }
    if (BRAND.features.householdVotes) {
      expect(hrefs).toContain('/portal/decisions')
    } else {
      expect(hrefs).not.toContain('/portal/decisions')
    }
  })

  it('files every item under a group that has a heading', () => {
    for (const item of PORTAL_NAV_ITEMS) {
      expect({ href: item.href, grouped: PORTAL_NAV_GROUP_ORDER.includes(item.group) })
        .toEqual({ href: item.href, grouped: true })
    }

    for (const group of PORTAL_NAV_GROUP_ORDER) {
      expect(PORTAL_LABELS.navGroups[group]).toBeTruthy()
      expect({ group, items: PORTAL_NAV_ITEMS.some((item) => item.group === group) })
        .toEqual({ group, items: true })
    }
  })

  it('lists sidebar destinations in living → together → opportunities', () => {
    const items = portalSidebarItems()
    const groups = items.map((item: { group: string }) => item.group)
    const seen: string[] = []
    for (const group of groups) {
      if (seen[seen.length - 1] !== group) seen.push(group)
    }
    expect(seen).toEqual(['living', 'together', 'integration'])
    expect(items[0]?.href).toBe('/portal')
  })
})

describe('active state', () => {
  it('marks the overview only on the overview', () => {
    expect(isPortalPathActive('/portal', '/portal')).toBe(true)
    expect(isPortalPathActive('/portal/chores', '/portal')).toBe(false)
  })

  it('keeps a section marked while reading one of its detail pages', () => {
    expect(isPortalPathActive('/portal/chores/abc123', '/portal/chores')).toBe(true)
  })

  it('does not match a route that merely starts with the same letters', () => {
    expect(isPortalPathActive('/portal/reports-archive', '/portal/report')).toBe(false)
  })
})
