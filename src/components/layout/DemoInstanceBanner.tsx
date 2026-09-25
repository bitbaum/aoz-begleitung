import { isDemoInstance } from '@/lib/demo/config'
import { DEMO_INSTANCE_LABELS } from '@/lib/constants/labels'

/**
 * Said on every page of the demo instance, before anything else.
 *
 * The demo is the real product on a database of invented people. A visitor
 * who does not know that will either read the invented residents as real ones
 * or — worse — type a real person's details into a form anyone can open. One
 * sentence at the top of every screen prevents both. German and English,
 * because the demo is shown to organisations in both.
 */
export function DemoInstanceBanner() {
  if (!isDemoInstance()) return null
  return (
    <div
      role="note"
      className="alert-warning rounded-none border-x-0 border-t-0 text-center text-sm"
    >
      <strong>{DEMO_INSTANCE_LABELS.title}</strong> {DEMO_INSTANCE_LABELS.body}{' '}
      <span lang="en">{DEMO_INSTANCE_LABELS.bodyEn}</span>
    </div>
  )
}
