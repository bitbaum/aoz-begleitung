/**
 * Route-matching for the staff navigation.
 *
 * WHAT USED TO BE HERE: `AdminMegaMenu`, ~190 lines of horizontal-bar
 * machinery — a scroll container, gradient fade cues that tracked real scroll
 * state, dropdown panels positioned `fixed` against a measured button rect to
 * escape that container's clipping (a non-visible overflow-x forces overflow-y
 * to auto, CSS Overflow §3), and a capturing scroll listener to close a panel
 * whose anchor had moved.
 *
 * Every line of it existed to make one row hold 20 destinations across 5
 * groups. `AdminSidebar` holds them in a column, where the page's height is
 * the budget, and none of that is needed. The megamenu is deleted rather than
 * left importable: a second navigation nobody renders is a second definition
 * of "where am I" waiting to disagree with the first.
 *
 * The file keeps its name because `isRouteActive` is the surviving export and
 * renaming it would churn imports for nothing.
 */

/** Route-aware active check: exact for '/', prefix for everything else. */
export function isRouteActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The ONE item of a group that is current, or null.
 *
 * Prefix matching alone lights up two siblings when one route nests inside
 * another: on `/opportunities/applications`, «Alle Einsatzplätze»
 * (`/opportunities`) matches too. The most specific match wins, so a group
 * never reports two current pages. `activeFor` routes count as the item's own.
 */
export function activeItemHref(
  pathname: string,
  items: readonly { href: string; activeFor?: readonly string[] }[],
): string | null {
  let best: { href: string; length: number } | null = null
  for (const item of items) {
    for (const route of [item.href, ...(item.activeFor ?? [])]) {
      if (isRouteActive(pathname, route) && (!best || route.length > best.length)) {
        best = { href: item.href, length: route.length }
      }
    }
  }
  return best?.href ?? null
}
