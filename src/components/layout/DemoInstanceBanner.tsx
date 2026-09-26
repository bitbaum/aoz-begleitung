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
 * ONE paragraph per width, on purpose: `.alert` is a flex row, and sibling
 * spans became squeezed columns. Below `md` it is a single fixed-height line
 * that stays on screen, because every top bar is positioned under it
 * (`.demo-banner` / `.below-demo-banner` in globals.css) — before that, the
 * phone's fixed admin bar covered it entirely.
 */
export function DemoInstanceBanner() {
  if (!isDemoInstance()) return null
  // The alert fill is a translucent tint; on a sticky line the page scrolling
  // underneath would show through the words, so it sits on an opaque canvas.
  return (
    <div role="note" className="demo-banner bg-ui-canvas">
      <div className="alert-warning h-full items-center justify-center rounded-none border-x-0 border-t-0 py-0 text-xs md:py-2 md:text-sm">
        <p className="truncate font-semibold md:hidden">{DEMO_INSTANCE_LABELS.short}</p>
        <p className="hidden text-center md:block">
          <strong>{DEMO_INSTANCE_LABELS.title}</strong> {DEMO_INSTANCE_LABELS.body}{' '}
          <span lang="en">{DEMO_INSTANCE_LABELS.bodyEn}</span>
        </p>
      </div>
    </div>
  )
}
