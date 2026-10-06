'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  NAV_ICONS,
  navBadgeCount,
  portalAccountItems,
  portalSidebarItems,
  portalTabItems,
  type PortalNavBadges,
} from '@/lib/config/navigation'
import { UI_LABELS } from '@/lib/constants/labels'
import { isPortalPathActive, portalNavMessageKey } from '@/lib/utils/portal-nav'
import { useT } from '@/lib/i18n/LocaleProvider'
import { PortalNavAccordion } from './PortalSidebar'

/**
 * The portal's mobile navigation: four pinned destinations plus a sheet of
 * collapsible groups. Language and account live in the header, not here.
 */
export function PortalTabBar({
  badges = {},
  placed = false,
}: {
  badges?: PortalNavBadges
  placed?: boolean
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const t = useT()
  const pathname = usePathname()
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    closeButtonRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMoreOpen(false)
        openButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [moreOpen])

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const close = () => {
    setMoreOpen(false)
    openButtonRef.current?.focus()
  }

  const tabItems = portalTabItems({ placed })
  const MoreIcon = NAV_ICONS.more
  const onTabPage = tabItems.some((item) => isPortalPathActive(pathname, item.href))
  const onAccountPage = portalAccountItems().some((item) => isPortalPathActive(pathname, item.href))
  const moreActive = moreOpen || (!onTabPage && !onAccountPage)
  // Whatever is waiting behind «Mehr» — the tab items carry their own count.
  const moreCount = portalSidebarItems({ placed })
    .filter((item) => !tabItems.some((tab) => tab.href === item.href))
    .reduce((sum, item) => sum + navBadgeCount(item, badges), 0)

  return (
    <>
      {moreOpen && <div className="scrim z-40 lg:hidden" onClick={close} aria-hidden="true" />}

      <div
        id="portal-more-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.moreTitle')}
        hidden={!moreOpen}
        className="fixed inset-x-0 bottom-0 z-50 lg:hidden max-h-[85vh] overflow-y-auto
                   rounded-t-xl border-t border-ui-border bg-ui-surface"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-ui-border">
          <p className="eyebrow">{t('nav.moreTitle')}</p>
          <button
            ref={closeButtonRef}
            onClick={close}
            className="btn-icon -me-2"
            aria-label={t('nav.closeMore')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-3 py-3">
          <PortalNavAccordion pathname={pathname} badges={badges} placed={placed} />
        </div>
      </div>

      <nav className="tab-bar lg:hidden" aria-label={UI_LABELS.navigation}>
        {tabItems.map((item) => {
          const Icon = NAV_ICONS[item.icon]
          const active = isPortalPathActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? 'tab-item-active' : 'tab-item'}
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative inline-flex">
                <Icon className="w-5 h-5" aria-hidden="true" />
                {navBadgeCount(item, badges) > 0 && (
                  <span className="absolute -right-2 -top-2 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-status-warning px-1 text-[10px] font-semibold text-status-warning-text">
                    {navBadgeCount(item, badges)}
                  </span>
                )}
              </span>
              <span>{t(portalNavMessageKey(item))}</span>
            </Link>
          )
        })}

        <button
          ref={openButtonRef}
          onClick={() => setMoreOpen((open) => !open)}
          className={moreActive ? 'tab-item-active' : 'tab-item'}
          aria-expanded={moreOpen}
          aria-controls="portal-more-sheet"
        >
          <span className="relative inline-flex">
            <MoreIcon className="w-5 h-5" aria-hidden="true" />
            {moreCount > 0 && (
              <span className="absolute -right-2 -top-2 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-status-warning px-1 text-[10px] font-semibold text-status-warning-text">
                {moreCount}
              </span>
            )}
          </span>
          <span>{t('nav.more')}</span>
        </button>
      </nav>
    </>
  )
}
