import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { DASHBOARD_LABELS } from '@/lib/constants/labels'

/**
 * What a specialist sees before anyone has been assigned to their seat.
 *
 * The same distinction `EmptyWorkspaceState` draws, one level in: there,
 * every queue is empty because the database is; here, every queue is empty
 * because this person's seat holds nobody. Both look identical to a
 * `.length === 0` check, and both were reported as "🎉 Alles unter
 * Kontrolle! Keine dringenden Aufgaben".
 *
 * That is what the Jobcoach and the Freiwilligenarbeit coordinator were shown on their first ever login
 * on 2026-08-31 — a party emoji and a finished day, on an account nobody had
 * connected to a single client. The product's answer to "why is this empty?"
 * was "because you are done".
 *
 * So: neutral, never a tick, and it names WHERE the seat is filled. The care
 * seat is assigned in the Betreuungsteam panel on a client's own page, which
 * is not somewhere you would guess from a dashboard — and a specialist can
 * assign their own seat, so this is a step they can actually take rather
 * than a request to go and find somebody.
 */
export function UnassignedWorkspaceState() {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="flex items-start gap-4">
          <span className="icon-container shrink-0 bg-ui-subtle text-ui-muted">
            <UserPlus className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">{DASHBOARD_LABELS.heroEyebrow}</p>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-heading text-ui-text mt-1 text-balance">
              {DASHBOARD_LABELS.unassignedTitle}
            </h2>
            <p className="text-ui-muted mt-1 max-w-prose">{DASHBOARD_LABELS.unassignedBody}</p>
          </div>
        </div>

        <Link href="/residents" className="btn-secondary shrink-0 self-start sm:self-auto">
          {DASHBOARD_LABELS.unassignedCta}
        </Link>
      </div>
    </section>
  )
}
