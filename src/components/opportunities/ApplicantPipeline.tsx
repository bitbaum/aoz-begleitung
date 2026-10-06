/**
 * Who is on this listing, and the next steps each of them can take.
 *
 * The controls are `ApplicationStageControls`: buttons derived from the
 * transition table, never a free choice of stage. The seven-way selector that
 * used to live here behind a `<details>` "for corrections" was how a client on
 * a DRAFT listing went straight to «Beendet · Nachweis erstellt».
 */

import Link from 'next/link'
import {
  APPLICATION_STAGE_BADGES,
  APPLICATION_STAGE_LABELS,
  type OpportunityStatusId,
} from '@/lib/config/opportunities'
import { isAwaitingAnswer } from '@/lib/jobcoach/queue'
import { residentName } from '@/lib/utils/resident-name'
import { daysSince } from '@/lib/opportunities/review'
import { proposalState, type ProposalState } from '@/lib/opportunities/pipeline'
import { OPPORTUNITIES_ADMIN_LABELS as L } from '@/lib/constants'
import type { ApplicationRow } from '@/lib/data/opportunities'
import { ApplicationStageControls } from './ApplicationStageControls'

const PROPOSAL_CHIPS: Record<ProposalState, { className: string; label: string }> = {
  PENDING: { className: 'chip chip-info', label: L.proposalPending },
  ACCEPTED: { className: 'chip chip-success', label: L.proposalAccepted },
  DECLINED: { className: 'chip chip-neutral', label: L.proposalDeclined },
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' }).format(value)
}

export function ApplicantPipeline({
  applications,
  canWrite,
  listingStatus,
}: {
  applications: readonly ApplicationRow[]
  canWrite: boolean
  listingStatus: OpportunityStatusId
}) {
  if (applications.length === 0) {
    return <p className="text-sm text-ui-muted">{L.applicantsEmpty}</p>
  }

  // Whoever is waiting for a reply goes to the top. The rest keep the query's
  // order (most recently moved first), which is the right order for everything
  // that is already in motion.
  const ordered = [...applications].sort(
    (a, b) => Number(isAwaitingAnswer(b)) - Number(isAwaitingAnswer(a)),
  )

  return (
    <ul className="divide-y divide-ui-border">
      {ordered.map((application) => (
        <li key={application.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* The only route to the dossier from this row, so it carries the
                44px target itself — as inline text it measured 24px. */}
            <Link
              href={`/residents/${application.resident.id}`}
              className="inline-flex min-h-[44px] items-center font-medium text-ui-text hover:text-brand-primary"
            >
              {residentName(application.resident)}
            </Link>
            <span className={`badge ${APPLICATION_STAGE_BADGES[application.stage]}`}>
              {APPLICATION_STAGE_LABELS[application.stage]}
            </span>
            {application.learningRecord ? (
              <span className="chip chip-success">{L.evidenceCreated}</span>
            ) : null}
            {(() => {
              const proposal = proposalState(application)
              return proposal ? (
                <span className={PROPOSAL_CHIPS[proposal].className}>
                  {PROPOSAL_CHIPS[proposal].label}
                </span>
              ) : null
            })()}
            {isAwaitingAnswer(application) ? (
              <span className="chip chip-warning">
                {L.awaitingAnswer} {L.awaitingSince(daysSince(application.createdAt))}
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-xs text-ui-muted">
            {L.stageChanged}: {formatDate(application.stageChangedAt)}
            {' · '}
            {L.supportedBy}: {application.supportedBy?.name ?? L.supportedByNobody}
          </p>

          {application.note ? (
            <p className="mt-2 text-sm text-ui-text">{application.note}</p>
          ) : null}

          {canWrite ? (
            <ApplicationStageControls
              applicationId={application.id}
              stage={application.stage}
              listingStatus={listingStatus}
            />
          ) : null}
        </li>
      ))}
    </ul>
  )
}
