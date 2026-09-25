import {
  awaitsAnswer,
  buildCareQueue,
  daysBetween,
  isAwaitingAnswer,
  type CareClientInput,
  type CareQueueItem,
} from '@/lib/care/queue'
import { ACTIVE_ENGAGEMENT_STAGES } from '@/lib/analytics/role-kpis'

/**
 * What the Freiwilligenarbeit coordinator has waiting.
 *
 * ## The bug this exists to fix
 *
 * The Freiwilligenarbeit coordinator's dashboard could not show her an open task. Not "rarely did" —
 * could not. `totalIssues` is built from critical incidents, overdue
 * check-ins, unplaced residents, pending transfers, proposals awaiting staff
 * and the job queue. She holds none of the permissions gating the first five,
 * and the sixth was fetched with `careAssignment.role = 'JOB'` while her seats
 * are `VOLUNTEERING`. Every term was structurally zero, so the dashboard
 * resolved to `quiet` and congratulated her — every morning, with work sitting
 * in the database.
 *
 * This is the identical defect fixed for the Jobcoach on 2026-09-02, whose fix comment
 * sits three lines above the hardcoded `'JOB'` that excluded her. **The fix was
 * applied to the instance and not the class.** That is why the builder now
 * lives in `lib/care/queue.ts` and this file holds only what is specific to
 * volunteering.
 *
 * ## Why these signals and not a copy of the job ones
 *
 * The job signals ask about the labour market: has this person had contact,
 * are they on a course with no work alongside it. Neither question is the Freiwilligenarbeit coordinator's.
 * Hers is whether the people she holds are actually doing something with other
 * people, and whether anyone answered the ones who asked.
 */

export const VOLUNTEERING_SIGNAL_IDS = [
  // FIRST, and the order is the dashboard's priority — the hero renders row 0.
  // A person who has already found something and is waiting to hear back
  // outranks a person nobody has arranged anything for yet.
  'INTEREST_UNANSWERED',
  'NO_ENGAGEMENT',
  'STALLED_ENGAGEMENT',
] as const
export type VolunteeringSignalId = (typeof VOLUNTEERING_SIGNAL_IDS)[number]

export type VolunteeringQueueItem = CareQueueItem<VolunteeringSignalId>

/**
 * How long somebody may be on the books with nothing arranged before it is
 * worth naming.
 *
 * Deliberately longer than the Jobcoach's 14 days: work has a clock that
 * volunteering does not, and a fortnight without a community placement is not
 * yet a failure. `INTEREST_UNANSWERED` is the signal with no grace period at
 * all, because there the clock belongs to the resident who asked.
 */
export const NO_ENGAGEMENT_GRACE_DAYS = 30

/** An engagement that has stopped moving. Same six weeks the job side uses. */
export const STALLED_ENGAGEMENT_DAYS = 42

const VOLUNTEERING_KINDS = ['VOLUNTEERING', 'COMMUNITY_SERVICE']

/**
 * A live engagement, by exactly the rule the KPI uses.
 *
 * `ACTIVE_ENGAGEMENT_STAGES` is imported rather than restated: if the queue and
 * `ENGAGEMENT_RATE` disagreed about what "engaged" means, the Freiwilligenarbeit coordinator would be
 * chasing a queue that never empties a number, or watching a number move with
 * nothing leaving her list.
 */
function hasLiveEngagement(client: CareClientInput): boolean {
  return client.applications.some(
    (a) => ACTIVE_ENGAGEMENT_STAGES.includes(a.stage) && !isAwaitingAnswer(a),
  )
}

function hasVolunteeringRecord(client: CareClientInput): boolean {
  return client.learningRecords.some(
    (r) => VOLUNTEERING_KINDS.includes(r.kind) && r.status !== 'EXPIRED',
  )
}

export function signalsFor(client: CareClientInput, now: Date): VolunteeringSignalId[] {
  const signals: VolunteeringSignalId[] = []
  const engaged = hasLiveEngagement(client) || hasVolunteeringRecord(client)

  // At most one "where is this person" signal, for the same reason the job
  // queue allows one: "nobody has arranged anything" and "somebody is waiting
  // for a reply" would otherwise be two rows for one conversation.
  if (awaitsAnswer(client)) {
    signals.push('INTEREST_UNANSWERED')
  } else if (!engaged && daysBetween(client.createdAt, now) >= NO_ENGAGEMENT_GRACE_DAYS) {
    signals.push('NO_ENGAGEMENT')
  }

  const stalled = client.learningRecords.some(
    (r) =>
      VOLUNTEERING_KINDS.includes(r.kind) &&
      r.status === 'IN_PROGRESS' &&
      daysBetween(r.updatedAt, now) >= STALLED_ENGAGEMENT_DAYS,
  )
  if (stalled) signals.push('STALLED_ENGAGEMENT')

  return signals
}

export function buildVolunteeringQueue(
  clients: CareClientInput[],
  now: Date,
): VolunteeringQueueItem[] {
  return buildCareQueue(clients, (client) => signalsFor(client, now), VOLUNTEERING_SIGNAL_IDS)
}
