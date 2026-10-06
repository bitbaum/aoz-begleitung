import Link from 'next/link'
import { DISPLAY_LIMITS } from '@/lib/config/thresholds'
import { DASHBOARD_LABELS } from '@/lib/constants/labels'
import { URGENCY_BADGE_CLASS, URGENCY_BORDER_CLASS, type Urgency } from '@/lib/config/urgency'

// =============================================================================
// ActionTile
// =============================================================================

export interface ActionTileProps {
  title: string
  count: number
  description: string
  href: string
  /**
   * How urgent this pile of work is — never which colour to use. Tiles used to
   * take `'orange' | 'blue' | 'green'` and callers picked one per CATEGORY, so
   * colour identified the topic instead of the urgency and every tile competed
   * with every other. @see lib/config/urgency.ts
   */
  urgency: Urgency
  items: { label: string; sublabel: string; href: string }[]
  allHref: string
}

export function ActionTile({
  title,
  count,
  description,
  href,
  urgency,
  items,
  allHref,
}: ActionTileProps) {
  return (
    <div className={`card ${URGENCY_BORDER_CLASS[urgency]}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          {/* Stays a heading: this is a section of the page, and screen-reader
              users navigate the dashboard by its headings. */}
          {/* The heading IS the tile's primary link — measured at 20px tall on
              a 390px screen, less than half the 44px floor, on the dashboard
              tiles that name the day's work. inline-flex + min-h lifts the hit
              area without changing the type or the row's alignment. */}
          <h3 className="font-semibold text-ui-text">
            <Link
              href={href}
              className="inline-flex items-center min-h-[44px] hover:text-brand-primary transition-colors"
            >
              {title}
            </Link>
          </h3>
          <p className="text-sm text-ui-muted">{description}</p>
        </div>
        <span
          className={`numeric px-2 py-1 rounded-sm text-sm font-semibold shrink-0 ${URGENCY_BADGE_CLASS[urgency]}`}
        >
          {count}
        </span>
      </div>

      <div className="space-y-1">
        {items.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="flex items-center justify-between gap-3 min-h-[44px] py-2 px-3 -mx-1 rounded-md hover:bg-ui-subtle transition-colors"
          >
            <div className="min-w-0">
              {/* The literal space is what keeps "Ihor" and "51 Tage" two words
                  for copy, search and screen readers; the margin alone glued
                  them into "Ihor51 Tage". */}
              <span className="font-medium text-ui-text text-sm">{item.label}</span>{' '}
              <span className="text-ui-muted text-sm ml-1">{item.sublabel}</span>
            </div>
            <span className="text-ui-muted shrink-0" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>

      {count > DISPLAY_LIMITS.dashboardItems && (
        <Link
          href={allHref}
          className="block text-center mt-3 pt-3 border-t border-ui-border text-sm text-ui-muted hover:text-ui-text min-h-[44px]"
        >
          {DASHBOARD_LABELS.showAllPrefix} {count} {DASHBOARD_LABELS.showAllSuffix} →
        </Link>
      )}
    </div>
  )
}
