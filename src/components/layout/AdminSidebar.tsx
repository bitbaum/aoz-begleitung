'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import {
  NAV_ICONS,
  MEGAMENU_GROUPS,
  type MegaMenuDropdownItem,
  type MegaMenuGroup,
} from '@/lib/config/navigation'
import { isRouteActive } from '@/components/layout/AdminHeader'
import { NavBadge } from '@/components/layout/NavBadge'

/**
 * The staff navigation, as a vertical panel.
 *
 * WHY THIS REPLACED A HEADER MEGAMENU. The staff side has 20 destinations in 5
 * groups. A horizontal bar can show about five things, so everything else lived
 * behind a hover — and the bar was already straining to hold even the group
 * names: it carried a horizontal scroll container, gradient scroll-fade cues,
 * `fixed`-positioned panels measured against a button rect to escape that
 * scroll container's clipping, and a scroll listener to close the panel when
 * its anchor moved. All of that machinery existed to make a row pretend it had
 * more width than it has. A column has as much room as the page is tall.
 *
 * WHY IT MIRRORS PortalSidebar RATHER THAN BEING ITS OWN THING. Both sides of
 * this product share one navigation vocabulary — the same `.nav-item` /
 * `.nav-item-active` definition of "where am I", the same `<details>`
 * accordion, the same 60/64 width. A staff member who also lives in a flat
 * (the product explicitly supports one login holding both roles) should not
 * have to learn two navigations.
 *
 * The group containing the current page opens; the rest start closed, so
 * arriving on /incidents does not present twenty labels at once.
 */
export function AdminSidebar({ groups = MEGAMENU_GROUPS }: { groups?: MegaMenuGroup[] }) {
  const pathname = usePathname()

  return (
    <aside
      className="hidden lg:block w-60 xl:w-64 shrink-0 border-e border-ui-border bg-ui-surface sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto px-2 py-3"
      aria-label="Hauptnavigation"
    >
      <nav aria-label="Hauptnavigation">
        {groups.map((group) =>
          'items' in group ? (
            <SidebarGroup
              key={group.label}
              label={group.label}
              items={group.items}
              pathname={pathname}
            />
          ) : (
            // Single destinations (Dashboard, Nachrichten) are not groups, and
            // wrapping them in a one-item accordion would be a link wearing a
            // hat — the same rule the portal nav gates with a ≥2-item check.
            <SidebarLink
              key={group.href}
              href={group.href}
              icon={group.icon}
              label={group.label}
              active={[group.href, ...(group.activeFor ?? [])].some((href) =>
                isRouteActive(pathname, href),
              )}
              badge={group.badge}
            />
          ),
        )}
      </nav>
    </aside>
  )
}

function SidebarGroup({
  label,
  items,
  pathname,
}: {
  label: string
  items: MegaMenuDropdownItem[]
  pathname: string
}) {
  const containsCurrent = items.some((item) => isRouteActive(pathname, item.href))
  const [open, setOpen] = useState(containsCurrent)

  // Navigating into a closed group must open it, or the sidebar would show the
  // current page as belonging nowhere.
  useEffect(() => {
    if (containsCurrent) setOpen(true)
  }, [containsCurrent])

  if (items.length === 0) return null

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group mt-2 first:mt-0"
    >
      <summary className="flex items-center justify-between gap-2 min-h-[44px] px-3 cursor-pointer list-none rounded-md hover:bg-ui-subtle text-xs font-semibold uppercase tracking-wide text-ui-muted [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ul className="mt-1">
        {items.map((item) => (
          <li key={item.href}>
            <SidebarLink
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isRouteActive(pathname, item.href)}
            />
          </li>
        ))}
      </ul>
    </details>
  )
}

function SidebarLink({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: string
  icon: string
  label: string
  active: boolean
  badge?: number | null
}) {
  const Icon = NAV_ICONS[icon] || NAV_ICONS.home
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`w-full min-h-[44px] ${active ? 'nav-item-active' : 'nav-item'}`}
    >
      <Icon
        className={`w-4 h-4 shrink-0 ${active ? 'text-brand-primary' : ''}`}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate">{label}</span>
      <NavBadge count={badge} />
    </Link>
  )
}
