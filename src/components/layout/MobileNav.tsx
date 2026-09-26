'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import {
  MEGAMENU_GROUPS,
  SYSTEM_LINKS,
  NAV_ICONS,
  type NavItem,
  type MegaMenuGroup,
} from '@/lib/config/navigation'
import { NavBadge } from '@/components/layout/NavBadge'
import { APP_LABELS, UI_LABELS } from '@/lib/constants/labels'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export function MobileNav({
  groups = MEGAMENU_GROUPS,
  systemLinks = SYSTEM_LINKS,
}: {
  groups?: MegaMenuGroup[]
  systemLinks?: NavItem[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Focus management + Escape + body lock. We don't use the shared
  // useDismissable hook here because we also want the close button to
  // claim focus on open, and to return focus to the trigger on close.
  useEffect(() => {
    if (!isOpen) return
    closeButtonRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        openButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleClose = () => {
    setIsOpen(false)
    openButtonRef.current?.focus()
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <>
      {/* Mobile header bar */}
      <header className="chrome-bar below-demo-banner fixed inset-x-0 md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo size="md" />
          <button
            ref={openButtonRef}
            onClick={() => setIsOpen(true)}
            className="btn-icon"
            aria-label={UI_LABELS.menuOpen}
            aria-expanded={isOpen}
            aria-controls="mobile-nav-drawer"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Backdrop */}
      {isOpen && <div className="scrim z-40 md:hidden" onClick={handleClose} aria-hidden="true" />}

      {/* Slide-out drawer */}
      <div
        id="mobile-nav-drawer"
        className={`fixed top-0 left-0 h-full w-[85vw] max-w-[280px] bg-ui-surface z-50 transform transition-transform duration-200 ease-in-out md:hidden border-r border-ui-border ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={UI_LABELS.navigation}
      >
        <div className="p-5 border-b border-ui-border">
          <div className="flex items-start justify-between">
            <div>
              <Logo size="lg" />
              <p className="text-sm text-ui-muted mt-1">{APP_LABELS.tagline}</p>
            </div>
            <button
              ref={closeButtonRef}
              onClick={handleClose}
              className="btn-icon -mr-2"
              aria-label={UI_LABELS.menuClose}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <nav className="px-3 py-3 overflow-y-auto max-h-[calc(100vh-96px)]">
          <div className="mb-2 flex justify-end">
            <ThemeToggle />
          </div>
          {/* Same groups as the desktop megamenu — ONE nav definition. Creation
              shortcuts (…/new) are skipped: every list page carries its own
              "+" action, and the drawer is for navigation, not verbs. */}
          {groups.map((group) =>
            'items' in group ? (
              <div key={group.label} className="mt-3 first:mt-0">
                <p className="eyebrow px-3 mb-1">{group.label}</p>
                {group.items
                  .filter((item) => !item.href.endsWith('/new'))
                  .map((item) => (
                    <MobileNavLink
                      key={item.href}
                      item={{ href: item.href, icon: item.icon, label: item.label }}
                      active={isActive(item.href)}
                      onClick={handleClose}
                    />
                  ))}
              </div>
            ) : (
              <MobileNavLink
                key={group.href}
                item={{ href: group.href, icon: group.icon, label: group.label }}
                active={[group.href, ...(group.activeFor ?? [])].some(isActive)}
                onClick={handleClose}
                badge={group.badge}
              />
            ),
          )}
          <div className="mt-3 pt-3 border-t border-ui-border">
            {systemLinks.map((item) => (
              <MobileNavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                onClick={handleClose}
              />
            ))}
          </div>
        </nav>
      </div>
    </>
  )
}

function MobileNavLink({
  item,
  active,
  onClick,
  showIcon = true,
  badge,
}: {
  item: NavItem
  active: boolean
  onClick: () => void
  showIcon?: boolean
  badge?: number | null
}) {
  const Icon = NAV_ICONS[item.icon]
  return (
    <Link
      href={item.href}
      onClick={onClick}
      // Every other nav surface here announces the current page (AdminSidebar,
      // PortalNav, PortalTabBar, PortalSidebar). This one computed `active`,
      // styled with it, and never said it — so the highlight existed only for
      // people who can see it.
      aria-current={active ? 'page' : undefined}
      className={`w-full min-h-[44px] ${active ? 'nav-item-active' : 'nav-item'}`}
    >
      {showIcon && (
        <Icon className={`w-4 h-4 ${active ? 'text-brand-primary' : ''}`} aria-hidden="true" />
      )}
      <span>{item.label}</span>
      <NavBadge count={badge} />
    </Link>
  )
}
