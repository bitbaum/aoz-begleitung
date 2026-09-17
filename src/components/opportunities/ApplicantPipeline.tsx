/**
 * Who is on this listing, and the one control each of them needs.
 *
 * Progressive disclosure on purpose: the primary button is the SINGLE natural
 * next step, and the seven-way selector lives behind a `<details>` for
 * corrections. A coach moving somebody along should not have to re-read the
 * whole pipeline to do the obvious thing.
 *
 * Ending an engagement is the exception and is rendered inline with its hours
 * field, because the total is only knowable at that moment — behind a
 * disclosure it would simply never be filled in, and volunteering records
 * without hours are the ones nobody can use later.
 *
 * No client JS: `<details>` and plain forms, so every control works on the
 * phone a coach actually carries.
 */

import Link from 'next/link'
import { changeApplicationStage } from '@/lib/actions'
import {
  APPLICATION_STAGE_BADGES,
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGES,
  type ApplicationStageId,
} from '@/lib/config/opportunities'
import { isTerminalStage, nextPipelineStage } from '@/lib/opportunities/pipeline'
import { isAwaitingAnswer } from '@/lib/jobcoach/queue'
import { residentName } from '@/lib/utils/resident-name'
import { formatDateNumeric } from '@/lib/utils/formatting'
import { OPPORTUNITIES_ADMIN_LABELS as L } from '@/lib/constants'
import type { ApplicationRow } from '@/lib/data/opportunities'

/** Whole days a thread has been open. Only ever shown for unanswered ones. */
function daysSince(value: Date): number {
  return Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24))
}

function StageSelector({ application }: { application: ApplicationRow }) {
  return (
    <details className="mt-3">
      {/* A disclosure toggle is a tap target like any other — 44px, not the
          20px a bare <summary> line gives you. */}
      <summary className="flex min-h-[44px] cursor-pointer items-center text-sm text-ui-muted hover:text-ui-text">
        {L.changeStage}
      </summary>
      <form action={changeApplicationStage} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="applicationId" value={application.id} />
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-ui-text">{L.changeStage}</span>
          <select name="stage" defaultValue={application.stage} className="input">
            {APPLICATION_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {APPLICATION_STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-ui-text">{L.hoursOnEnd}</span>
          <input name="hours" type="number" min={1} className="input" />
        </label>
        <button type="submit" className="btn-outline min-h-[44px]">
          {L.save}
        </button>
      </form>
    </details>
  )
}

function ApplicantControls({ application }: { application: ApplicationRow }) {
  const stage = application.stage as ApplicationStageId
  if (isTerminalStage(stage)) return <StageSelector application={application} />

  const next = nextPipelineStage(stage)

  return (
    <>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {stage === 'STARTED' ? (
          // Inline, with hours: this is the only moment the total is known.
          <form action={changeApplicationStage} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="applicationId" value={application.id} />
            <input type="hidden" name="stage" value="ENDED" />
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-ui-text">{L.hoursOnEnd}</span>
              <input name="hours" type="number" min={1} className="input w-32" />
            </label>
            <button type="submit" className="btn-outline min-h-[44px]">
              {L.advanceTo} {APPLICATION_STAGE_LABELS.ENDED}
            </button>
          </form>
        ) : next ? (
          <form action={changeApplicationStage}>
            <input type="hidden" name="applicationId" value={application.id} />
            <input type="hidden" name="stage" value={next} />
            <button type="submit" className="btn-primary min-h-[44px]">
              {L.advanceTo} {APPLICATION_STAGE_LABELS[next]}
            </button>
          </form>
        ) : null}

        <form action={changeApplicationStage}>
          <input type="hidden" name="applicationId" value={application.id} />
          <input type="hidden" name="stage" value="DECLINED" />
          <button type="submit" className="btn-ghost min-h-[44px]">
            {L.decline}
          </button>
        </form>
      </div>
      <StageSelector application={application} />
    </>
  )
}

export function ApplicantPipeline({
  applications,
  canWrite,
}: {
  applications: readonly ApplicationRow[]
  canWrite: boolean
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
            {isAwaitingAnswer(application) ? (
              <span className="chip chip-warning">
                {L.awaitingAnswer} {L.awaitingSince(daysSince(application.createdAt))}
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-xs text-ui-muted">
            {L.stageChanged}: {formatDateNumeric(application.stageChangedAt)}
            {' · '}
            {L.supportedBy}: {application.supportedBy?.name ?? L.supportedByNobody}
          </p>

          {application.note ? (
            <p className="mt-2 text-sm text-ui-text">{application.note}</p>
          ) : null}

          {canWrite ? <ApplicantControls application={application} /> : null}
        </li>
      ))}
    </ul>
  )
}
