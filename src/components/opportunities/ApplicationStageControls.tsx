'use client'

/**
 * The next steps for ONE application, derived from the transition table.
 *
 * This replaced a free <select> over all seven stages, which let a coach move
 * a client on a DRAFT listing straight to «Beendet» and mint evidence for work
 * that never happened (observed live, 2026-10-01). Every button here is a move
 * `availableTransitions` allows, and the server action checks the same table
 * again — the buttons are a convenience, the action is the rule.
 *
 * A client component for one reason: a refusal is RETURNED by the action and
 * must be shown beside the buttons, not thrown into the error boundary.
 *
 * Ending an engagement carries its hours field inline, because the total is
 * only knowable at that moment — behind a disclosure it would never be filled
 * in, and records without hours are the ones nobody can use later.
 */

import { useActionState } from 'react'
import { changeApplicationStage, type ApplicationActionState } from '@/lib/actions/opportunities'
import {
  APPLICATION_STAGE_ACTION_LABELS,
  type ApplicationStageId,
  type OpportunityStatusId,
} from '@/lib/config/opportunities'
import { availableTransitions, isTerminalStage } from '@/lib/opportunities/pipeline'
import { OPPORTUNITIES_ADMIN_LABELS as L } from '@/lib/constants/labels/opportunities'

interface Props {
  applicationId: string
  stage: ApplicationStageId
  listingStatus: OpportunityStatusId
}

const INITIAL: ApplicationActionState = {}

export function ApplicationStageControls({ applicationId, stage, listingStatus }: Props) {
  const [state, formAction, pending] = useActionState(changeApplicationStage, INITIAL)

  if (isTerminalStage(stage)) {
    return <p className="mt-2 text-xs text-ui-muted">{L.noNextStep}</p>
  }

  const next = availableTransitions(listingStatus, stage)
  const forward = next.filter((to) => to !== 'DECLINED')
  const canDecline = next.includes('DECLINED')

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        {forward.map((to, index) => (
          <form key={to} action={formAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="stage" value={to} />
            {to === 'ENDED' ? (
              <label className="block space-y-1.5">
                <span className="block text-xs font-medium text-ui-text">{L.hoursOnEnd}</span>
                <input name="hours" type="number" min={1} className="input w-32" />
              </label>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className={`${index === 0 ? 'btn-primary' : 'btn-outline'} min-h-[44px] disabled:opacity-60`}
            >
              {APPLICATION_STAGE_ACTION_LABELS[to]}
            </button>
          </form>
        ))}

        {canDecline ? (
          <form action={formAction}>
            <input type="hidden" name="applicationId" value={applicationId} />
            <input type="hidden" name="stage" value="DECLINED" />
            <button type="submit" disabled={pending} className="btn-ghost min-h-[44px]">
              {APPLICATION_STAGE_ACTION_LABELS.DECLINED}
            </button>
          </form>
        ) : null}
      </div>

      {listingStatus !== 'PUBLISHED' ? (
        <p className="text-xs text-ui-muted">{L.windDownOnly}</p>
      ) : null}

      {state.error ? (
        <p role="alert" className="alert-error text-sm">
          {state.error}
        </p>
      ) : null}
    </div>
  )
}
