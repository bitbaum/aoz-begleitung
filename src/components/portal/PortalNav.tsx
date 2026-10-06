'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRightLeft, ChevronDown, LogOut, User } from 'lucide-react'
import { UI_LABELS } from '@/lib/constants/labels'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { NAV_ICONS, portalAccountItems } from '@/lib/config/navigation'
import { BRAND } from '@/lib/config/brand'
import { portalNavMessageKey } from '@/lib/utils/portal-nav'
import { useT } from '@/lib/i18n/LocaleProvider'
import { useDismissable } from '@/lib/hooks/useDismissable'
import { LanguageSwitcher } from './LanguageSwitcher'

interface PortalNavProps {
  hasStaffAccess?: boolean
}

/**
 * Portal header: brand, language, account.
 *
 * Destinations live in the left sidebar (desktop) and the tab bar (phone).
 * This bar is identity — who you are, which language you read, how you leave.
 */
export function PortalNav({ hasStaffAccess }: PortalNavProps) {
  const t = useT()

  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <Link
        href="/portal"
        className="inline-flex min-h-[44px] items-center text-base font-semibold tracking-tight text-brand-primary transition-opacity hover:opacity-70 sm:text-lg shrink-0"
      >
        {t(BRAND.portalTitleKey)}
      </Link>

      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
        <LanguageSwitcher variant="compact" />
        <ThemeToggle />
        <AccountMenu hasStaffAccess={hasStaffAccess} label={t('nav.accountMenu')} />
      </div>
    </div>
  )
}

function AccountMenu({ hasStaffAccess, label }: { hasStaffAccess?: boolean; label: string }) {
  const t = useT()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useDismissable<HTMLDivElement>(isOpen, () => setIsOpen(false))
  const accountItems = portalAccountItems()

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-ui-subtle transition-colors min-h-[44px]"
        aria-label={label}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <User className="w-5 h-5 text-ui-muted" aria-hidden="true" />
        <span className="hidden sm:inline text-sm text-ui-muted">{label}</span>
        <ChevronDown className="w-4 h-4 text-ui-muted" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute end-0 mt-2 w-56 overlay-panel py-1 z-50">
          {accountItems.map((item) => {
            const Icon = NAV_ICONS[item.icon]
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="w-full px-4 py-3 text-start text-sm text-ui-muted hover:text-ui-text hover:bg-ui-subtle flex items-center gap-2 min-h-[44px]"
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {t(portalNavMessageKey(item))}
              </Link>
            )
          })}

          {hasStaffAccess && (
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className="w-full px-4 py-3 text-start text-sm text-brand-primary hover:bg-brand-primary/10 flex items-center gap-2 min-h-[44px]"
            >
              <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />
              {UI_LABELS.switchToAdmin}
            </Link>
          )}

          <form action="/api/portal/logout" method="POST">
            <button
              type="submit"
              className="w-full px-4 py-3 text-start text-sm text-ui-muted hover:text-ui-text hover:bg-ui-subtle flex items-center gap-2 min-h-[44px]"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              {t('nav.logout')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
