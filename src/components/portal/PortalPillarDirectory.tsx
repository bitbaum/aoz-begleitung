import Link from 'next/link'
import { NAV_ICONS, PORTAL_SIDEBAR_GROUPS, portalSidebarItems } from '@/lib/config/navigation'
import { portalNavMessageKey } from '@/lib/utils/portal-nav'
import type { MessageKey } from '@/lib/i18n'

/**
 * Every portal destination, grouped by pillar, on the home page.
 *
 * The dashboard's cards are data-driven and therefore selective; before this
 * section, whole pillars (rules, decisions, messages, learning, marketplace,
 * events) were reachable only through the nav — on mobile that means behind
 * the "Mehr" sheet. This derives 100% from the nav config (groups, order,
 * icons, labels), so a new nav item appears here without touching this file.
 */
export function PortalPillarDirectory({
  t,
  placed = false,
}: {
  t: (key: MessageKey) => string
  placed?: boolean
}) {
  // The overview item links to the page this section is on.
  const items = portalSidebarItems({ placed }).filter((item) => item.href !== '/portal')

  return (
    <section className="mt-8">
      <h2 className="eyebrow mb-3">{t('dashboard.allAreas')}</h2>
      {/* Two columns at tablet, four at desktop — the group count grew from
          three to four, and a hardcoded `sm:grid-cols-3` left the fourth card
          alone on its own row. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {PORTAL_SIDEBAR_GROUPS.map((group) => {
          const grouped = items.filter((item) => item.group === group)
          if (grouped.length === 0) return null
          return (
            <div key={group} className="card">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ui-muted mb-1">
                {t(`navGroup.${group}` as MessageKey)}
              </h3>
              <ul>
                {grouped.map((item) => {
                  const Icon = NAV_ICONS[item.icon]
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-2.5 min-h-[44px] px-2 -mx-2 rounded-md hover:bg-ui-subtle text-sm text-ui-text"
                      >
                        <Icon className="w-4 h-4 text-ui-muted shrink-0" aria-hidden="true" />
                        {t(portalNavMessageKey(item))}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
