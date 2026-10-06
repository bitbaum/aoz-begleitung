/**
 * What this client is currently unterwegs on, on their own dossier.
 *
 * ## Why this card had to exist
 *
 * `listApplicationsForResident` was written, exported — and called by nothing.
 * A coach opening a client could see their learning records, their incidents,
 * their placements and their care team, and NOT the one thing they had asked
 * for themselves.
 *
 * That became load-bearing the moment the dashboard learned to say "Interesse
 * wartet auf Antwort — George B" and linked to `/residents/<id>`: the tile
 * named a person, the page it opened did not mention the thread, and the coach
 * had to guess which of the listings it was. A queue whose destination cannot
 * show the work is a queue nobody can clear.
 *
 * Read-only on purpose. The stage controls live on the listing, next to
 * everyone else on it, and a second set of them here would be two places to
 * move one thread from. The link goes there instead.
 */

import { calendarDaysSince } from '@/lib/utils'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { ProposePlaceForm } from '@/components/opportunities/ProposePlaceForm'
import {
  APPLICATION_STAGE_BADGES,
  APPLICATION_STAGE_LABELS,
  OPPORTUNITY_KIND_LABELS,
  type ApplicationStageId,
  type OpportunityKindId,
} from '@/lib/config/opportunities'
import { isAwaitingAnswer } from '@/lib/jobcoach/queue'
import { OPPORTUNITIES_ADMIN_LABELS as L } from '@/lib/constants'

/** Exactly the columns this card reads, so a caller cannot under-select. */
export interface ResidentThreadRow {
  id: string
  /** Carried so this row satisfies `CareApplicationInput` — see care/queue.ts. */
  opportunityId: string
  stage: ApplicationStageId
  createdBy: 'RESIDENT' | 'STAFF'
  supportedByUserId: string | null
  createdAt: Date
  opportunity: {
    id: string
    title: string
    organisation: string
    kind: OpportunityKindId
  }
}

interface ResidentThreadsCardProps {
  threads: readonly ResidentThreadRow[]
  /**
   * «Platz vorschlagen»: the places this viewer may propose, or null when they
   * may not write (`opportunities:write`) — then the card stays read-only.
   */
  propose?: {
    residentId: string
    places: readonly { id: string; title: string; organisation: string }[]
  } | null
}

export function ResidentThreadsCard({ threads, propose = null }: ResidentThreadsCardProps) {
  const now = new Date()

  // Unanswered first. This card is read by someone who arrived from a tile
  // saying a person is waiting; burying that under a finished engagement from
  // last spring would answer a question nobody asked.
  const sorted = [...threads].sort(
    (a, b) => Number(isAwaitingAnswer(b)) - Number(isAwaitingAnswer(a)),
  )

  return (
    <Card>
      <h2 className="text-base font-semibold text-ui-text">{L.residentThreadsTitle}</h2>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-ui-muted">{L.residentThreadsEmpty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {sorted.map((thread) => {
            const waiting = isAwaitingAnswer(thread)

            return (
              <li key={thread.id} className="rounded-lg border border-ui-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="eyebrow">{OPPORTUNITY_KIND_LABELS[thread.opportunity.kind]}</p>
                    <p className="mt-1 font-medium text-ui-text">{thread.opportunity.title}</p>
                    <p className="text-sm text-ui-muted">{thread.opportunity.organisation}</p>
                  </div>
                  <span className={APPLICATION_STAGE_BADGES[thread.stage]}>
                    {APPLICATION_STAGE_LABELS[thread.stage]}
                  </span>
                </div>

                {waiting ? (
                  <p className="alert-warning mt-3 text-sm">
                    <span className="font-medium">
                      {L.awaitingAnswer} {L.awaitingSince(calendarDaysSince(thread.createdAt, now))}
                    </span>{' '}
                    — {L.awaitingHint}
                  </p>
                ) : thread.createdBy === 'RESIDENT' ? (
                  <p className="mt-2 text-xs text-ui-muted">{L.selfReported}</p>
                ) : null}

                <Link
                  href={`/opportunities/${thread.opportunity.id}`}
                  className="mt-2 inline-flex min-h-[44px] items-center text-sm text-brand-primary hover:underline"
                >
                  {L.openListing}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {propose ? (
        <ProposePlaceForm residentId={propose.residentId} places={propose.places} />
      ) : null}
    </Card>
  )
}
