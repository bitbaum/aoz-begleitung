import { isDemoInstance } from '@/lib/demo/config'
import { DEMO_INSTANCE_LABELS } from '@/lib/constants/labels'

/**
 * Said on every page of the demo instance, before anything else.
 *
 * The demo is the real product on a database of invented people. A visitor
 * who does not know that will either read the invented residents as real ones
 * or — worse — type a real person's details into a form anyone can open. One
 * line at the top of every screen prevents both.
 *
 * ONE paragraph inside the alert, on purpose: `.alert` is a flex row, and
 * three sibling spans became three squeezed columns that took a fifth of a
 * phone screen. The English sentence is dropped below `sm`; the German one
 * carries the warning on its own.
 */
export function DemoInstanceBanner() {
  if (!isDemoInstance()) return null
  return (
    <div
      role="note"
      className="alert-warning justify-center rounded-none border-x-0 border-t-0 py-2 text-xs sm:text-sm"
    >
      <p className="text-center">
        <strong>{DEMO_INSTANCE_LABELS.title}</strong> {DEMO_INSTANCE_LABELS.body}{' '}
        <span lang="en" className="hidden sm:inline">
          {DEMO_INSTANCE_LABELS.bodyEn}
        </span>
      </p>
    </div>
  )
}
