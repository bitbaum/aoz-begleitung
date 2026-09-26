import Link from 'next/link'
import type { ReactNode } from 'react'
import { URGENCY_VALUE_CLASS, type Urgency } from '@/lib/config/urgency'

// =============================================================================
// QuickStat
// =============================================================================

export interface QuickStatProps {
  label: string
  value: number
  total?: number
  suffix?: string
  subtext?: string
  href: string
  /**
   * What this number MEANS, not what colour to paint it. Callers used to pass
   * `'blue'` or `'orange'`, which is how a plain count of free beds ended up
   * tinted like a warning. @see lib/config/urgency.ts
   */
  urgency: Urgency
  icon: ReactNode
}

export function QuickStat({
  label,
  value,
  total,
  suffix,
  subtext,
  href,
  urgency,
  icon,
}: QuickStatProps) {
  return (
    // A flat, hairline card like every other surface in the product. The old
    // tinted fill and 2px coloured border made four stat cards read as four
    // alerts, which is exactly the noise that hides a real one.
    <Link href={href} className="card-hover">
      <div className="flex items-center justify-between mb-1">
        <span className="text-ui-muted inline-flex items-center">{icon}</span>
        {/* The number is data and gets the mono figure style; the word after
            it is prose. Setting "Überfällig" in 24px mono read like code and
            broke the tile at desktop widths. */}
        <span className={`whitespace-nowrap ${URGENCY_VALUE_CLASS[urgency]}`}>
          <span className="metric text-2xl">{value}</span>
          {/* A literal space, not a margin: two inline spans with only CSS
              between them read as one word to screen readers and copy-paste. */}
          {suffix && (
            <>
              {' '}
              <span className="text-sm font-medium">{suffix.trim()}</span>
            </>
          )}
        </span>
      </div>
      <div className="text-sm font-medium text-ui-text">{label}</div>
      {subtext && <div className="text-xs text-ui-muted mt-0.5">{subtext}</div>}
      {total !== undefined && total > 0 && (
        <div className="meter mt-2">
          <div
            className="meter-fill bg-ui-border-strong"
            style={{ width: `${Math.min(100, (value / total) * 100)}%` }}
          />
        </div>
      )}
    </Link>
  )
}
