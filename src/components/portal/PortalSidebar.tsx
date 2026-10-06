'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import {
  NAV_ICONS,
  PORTAL_SIDEBAR_GROUPS,
  PORTAL_SIDEBAR_PINNED,
  portalSidebarItems,
  navBadgeCount,
  type PortalNavBadges,
  type PortalNavGroup,
  type PortalNavItem,
} from '@/lib/config/navigation'
import { isPortalPathActive, portalNavMessageKey } from '@/lib/utils/portal-nav'
import { useT } from '@/lib/i18n/LocaleProvider'
import type { MessageKey } from '@/lib/i18n'

/**
 * Collapsible groups for the desktop sidebar and the mobile "Mehr" sheet.
 *
 * The open group is the one that contains the current page; the others start
 * closed so a resident is not staring at fourteen labels at once.
 */
export function PortalNavAccordion({
  pathname,
  badges = {},
  placed = false,
}: {
  pathname: string
  badges?: PortalNavBadges
  placed?: boolean
}) {
  const t = useT()
  const items = portalSidebarItems({ placed })
  const pinned = items.filter((item) => PORTAL_SIDEBAR_PINNED.includes(item.href))
  const grouped = items.filter((item) => !PORTAL_SIDEBAR_PINNED.includes(item.href))

  return (
    <nav aria-label={t('nav.moreTitle')}>
      {/* The way back to the overview must not depend on which accordion
          happens to be open. */}
      {pinned.map((item) => (
        <GroupLink
          key={item.href}
          item={item}
          active={isPortalPathActive(pathname, item.href)}
          badges={badges}
        />
      ))}

      {PORTAL_SIDEBAR_GROUPS.map((group) => (
        <NavGroup
          key={group}
          group={group}
          pathname={pathname}
          items={grouped}
          heading={t(`navGroup.${group}` as MessageKey)}
          badges={badges}
        />
      ))}
    </nav>
  )
}

function NavGroup({
  group,
  pathname,
  items,
  heading,
  badges,
}: {
  group: PortalNavGroup
  pathname: string
  items: PortalNavItem[]
  heading: string
  badges: PortalNavBadges
}) {
  const grouped = items.filter((item) => item.group === group)
  const containsCurrent = grouped.some((item) => isPortalPathActive(pathname, item.href))
  const [open, setOpen] = useState(containsCurrent)

  useEffect(() => {
    if (containsCurrent) setOpen(true)
  }, [containsCurrent])

  if (grouped.length === 0) return null

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group mt-2 first:mt-0"
    >
      <summary className="flex items-center justify-between gap-2 min-h-[44px] px-3 cursor-pointer list-none rounded-md hover:bg-ui-subtle text-xs font-semibold uppercase tracking-wide text-ui-muted [&::-webkit-details-marker]:hidden">
        {heading}
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ul className="mt-1">
        {grouped.map((item) => (
          <li key={item.href}>
            <GroupLink
              item={item}
              active={isPortalPathActive(pathname, item.href)}
              badges={badges}
            />
          </li>
        ))}
      </ul>
    </details>
  )
}

function GroupLink({
  item,
  active,
  badges,
}: {
  item: PortalNavItem
  active: boolean
  badges: PortalNavBadges
}) {
  const t = useT()
  const Icon = NAV_ICONS[item.icon]
  const count = navBadgeCount(item, badges)
  return (
    <Link
      href={item.href}
      className={`w-full min-h-[44px] ${active ? 'nav-item-active' : 'nav-item'}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={`w-4 h-4 ${active ? 'text-brand-primary' : ''}`} aria-hidden="true" />
      <span className="flex min-w-0 items-center gap-2">
        <span>{t(portalNavMessageKey(item))}</span>
        {count > 0 && <span className="chip-warning text-xs">{count}</span>}
      </span>
    </Link>
  )
}

export function PortalSidebar({
  badges = {},
  placed = false,
}: {
  badges?: PortalNavBadges
  placed?: boolean
}) {
  const pathname = usePathname()
  const t = useT()

  return (
    <aside
      className="hidden lg:block w-60 xl:w-64 shrink-0 border-e border-ui-border bg-ui-surface sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto px-2 py-3"
      aria-label={t('nav.moreTitle')}
    >
      <PortalNavAccordion pathname={pathname} badges={badges} placed={placed} />
    </aside>
  )
}
