/**
 * The applications review — pure grouping, no I/O.
 *
 * Review used to be scattered: unanswered requests on the Eingang, everything
 * else under «Wer ist unterwegs» on each listing, one listing at a time. A
 * coach asking "where does everybody stand" had to open every listing. The
 * review page answers it in one place, and this decides its order.
 *
 * Order is the pipeline's, with one group in front of it: people WAITING FOR
 * AN ANSWER (`isAwaitingAnswer`). They are INTERESTED like any staff-raised
 * row, but nobody has replied — the one group where a person, not a process,
 * is waiting. Same rule the Eingang and the job queue already follow.
 */

import { APPLICATION_STAGE_LABELS, type ApplicationStageId } from '@/lib/config/opportunities'
import { isAwaitingAnswer, type CareApplicationInput } from '@/lib/care/queue'
import { OPPORTUNITIES_ADMIN_LABELS as L } from '@/lib/constants/labels/opportunities'
import { APPLICATION_PIPELINE, isTerminalStage } from './pipeline'

export const AWAITING_GROUP_ID = 'AWAITING'
export type ReviewGroupId = typeof AWAITING_GROUP_ID | ApplicationStageId

/** Rendering order. DECLINED last: it is off the forward path. */
export const REVIEW_GROUP_ORDER: readonly ReviewGroupId[] = [
  AWAITING_GROUP_ID,
  ...APPLICATION_PIPELINE,
  'DECLINED',
]

export function reviewGroupLabel(id: ReviewGroupId): string {
  return id === AWAITING_GROUP_ID ? L.awaitingAnswer : APPLICATION_STAGE_LABELS[id]
}

export interface ReviewGroup<T> {
  id: ReviewGroupId
  label: string
  /** ENDED and DECLINED: shown collapsed, nothing left to do. */
  closed: boolean
  rows: T[]
}

type ReviewableRow = CareApplicationInput & { createdAt: Date }

function groupOf(row: ReviewableRow): ReviewGroupId {
  return isAwaitingAnswer(row) ? AWAITING_GROUP_ID : row.stage
}

/**
 * Non-empty groups in pipeline order. Unanswered requests oldest first — the
 * person who has waited longest is the one to answer first; every other group
 * keeps the order it was given (the query sorts by last movement).
 */
export function groupApplicationsForReview<T extends ReviewableRow>(
  rows: readonly T[],
): ReviewGroup<T>[] {
  const buckets = new Map<ReviewGroupId, T[]>()
  for (const row of rows) {
    const id = groupOf(row)
    buckets.set(id, [...(buckets.get(id) ?? []), row])
  }

  const awaiting = buckets.get(AWAITING_GROUP_ID)
  if (awaiting) awaiting.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  return REVIEW_GROUP_ORDER.flatMap((id) => {
    const groupRows = buckets.get(id)
    if (!groupRows || groupRows.length === 0) return []
    return [
      {
        id,
        label: reviewGroupLabel(id),
        closed: id !== AWAITING_GROUP_ID && isTerminalStage(id),
        rows: groupRows,
      },
    ]
  })
}

/** Whole days since a moment; never negative. */
export function daysSince(value: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / 86_400_000))
}
