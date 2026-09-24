import { NAV_BADGE_LABELS } from '@/lib/constants/labels'

/**
 * The count beside Eingang. Renders nothing at zero or when the count could
 * not be computed — an empty badge, or a "0", is a mark people learn to stop
 * reading, and then it is not there on the day it says 4.
 */
export function NavBadge({ count }: { count?: number | null }) {
  if (!count) return null
  const shown = count > 99 ? '99+' : String(count)
  return (
    <span
      className="ms-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-primary px-1.5 text-2xs font-semibold text-ui-on-accent"
      aria-label={NAV_BADGE_LABELS.waiting(count)}
    >
      {shown}
    </span>
  )
}
