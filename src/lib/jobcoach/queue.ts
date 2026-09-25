import type { ApplicationStageId } from '@/lib/config/opportunities'
import type { LearningKindId } from '@/lib/config/learning'
import {
  awaitsAnswer,
  buildCareQueue,
  daysBetween,
  isAwaitingAnswer,
  type CareApplicationInput,
  type CareClientInput,
  type CareQueueItem,
} from '@/lib/care/queue'

/**
 * What a job coach has waiting — derived from evidence, not invented.
 *
 * ## The bug this exists to fix
 *
 * The dashboard decides "busy" or "quiet" from `openTaskCount`, and every
 * component of that count was a housing queue: overdue check-ins, unplaced
 * residents, pending transfers, problem units, governance proposals. A
 * Jobcoach holds none of those permissions, so the count was structurally
 * always zero.
 *
 * Observed in production on 2026-09-02: the Jobcoach had a client assigned that
 * same day — job-seeking, two years without work, an unrecognised trade
 * qualification, German at A2 — and his dashboard said
 * "🎉 Alles unter Kontrolle! Keine dringenden Aufgaben", without naming him.
 *
 * That is the same failure the `unassigned` state was added to fix, one level
 * deeper. Then it was "nobody is assigned to me". Now it is "somebody is, with
 * real work outstanding, and the queue cannot see it" — because the queue was
 * defined in another domain's vocabulary.
 *
 * ## Why these four signals and not others
 *
 * Each maps to a principle in `config/job-integration-docs.ts` marked
 * `status: 'signal'`. Nothing here is a hunch:
 *
 *  - INTEREST_UNANSWERED — client preference first. A resident who pressed
 *    "Ich habe Interesse" has stated the one thing IPS says predicts retention,
 *    and is now waiting for a person to reply.
 *  - NO_LABOUR_MARKET_CONTACT — place-then-train. Rapid entry into real work
 *    beats lengthy pre-training, so a client with no application and no active
 *    placement is an open task rather than a neutral state.
 *  - COURSE_WITHOUT_WORK — language and work in parallel, not sequential. A
 *    running course with no labour-market contact is exactly the lock-in
 *    pattern the IAB evidence describes, where search intensity falls during a
 *    measure.
 *  - STALLED_RECORD — an IN_PROGRESS record nobody has touched. Not a
 *    judgement about the person; a record that has stopped moving is a record
 *    nobody is working.
 *
 * Principles marked `documented` deliberately raise nothing: qualification
 * recognition, post-start support and stated job goals all matter, and the
 * product cannot currently detect them. Inventing a signal from data that does
 * not exist would be worse than the gap.
 *
 * Pure. No Prisma, no dates read from the clock — `now` is passed in, so the
 * same input always produces the same queue.
 */

export const JOB_SIGNAL_IDS = [
  'INTEREST_UNANSWERED',
  'NO_LABOUR_MARKET_CONTACT',
  'COURSE_WITHOUT_WORK',
  'STALLED_RECORD',
] as const

export type JobSignalId = (typeof JOB_SIGNAL_IDS)[number]

/**
 * How long a record may sit untouched before it counts as stalled.
 *
 * Six weeks, not two: a language course legitimately runs for months without
 * an update, and a queue that fires every fortnight is one a coach learns to
 * dismiss. The number is a threshold to argue with, which is why it is here
 * and not buried in a comparison.
 */
export const STALLED_RECORD_DAYS = 42

/**
 * How long after intake a client with no labour-market contact is overdue.
 *
 * The evidence says early contact predicts the later trajectory, and that long
 * initial unemployment leaves a scar. It does not say "fourteen days" — that
 * is a working default, deliberately short enough to be noticed and long
 * enough that intake week is not immediately an alarm.
 */
export const NO_CONTACT_GRACE_DAYS = 14

/** Work kinds. A started application of one of these IS labour-market contact. */
const WORK_KINDS: readonly LearningKindId[] = ['EMPLOYMENT', 'INTERNSHIP']

/** Application stages that mean a real process is running. */
const LIVE_STAGES: readonly ApplicationStageId[] = [
  'INTERESTED',
  'APPLIED',
  'INTERVIEW',
  'ACCEPTED',
  'STARTED',
]

/**
 * The input shapes, the "a click is a request" rule and the queue builder are
 * NOT job-coaching facts — they are equally true of the Freiwilligenarbeit coordinator's volunteering
 * caseload, so they live in `lib/care/queue.ts`.
 *
 * Re-exported here rather than moved outright: eleven modules import these
 * names from this path, and one definition reachable by two paths is a very
 * different thing from two definitions.
 */
export { isAwaitingAnswer, awaitsAnswer }
export type JobApplicationInput = CareApplicationInput
export type JobClientInput = CareClientInput

/**
 * Derived, not restated. It was a hand-written interface with the same three
 * fields, which is why adding `opportunityId` to the shared row silently left
 * the job side without it — the compiler had nothing to check it against.
 */
export type JobQueueItem = CareQueueItem<JobSignalId>

function hasLiveApplication(client: JobClientInput): boolean {
  return client.applications.some((a) => LIVE_STAGES.includes(a.stage) && !isAwaitingAnswer(a))
}

function hasWorkRecord(client: JobClientInput): boolean {
  return client.learningRecords.some((r) => WORK_KINDS.includes(r.kind) && r.status !== 'EXPIRED')
}

/** Any labour-market contact at all: a live application or a work record. */
export function hasLabourMarketContact(client: JobClientInput): boolean {
  return hasLiveApplication(client) || hasWorkRecord(client)
}

/**
 * The signals raised for ONE client.
 *
 * At most one contact-related signal: a client with no contact at all already
 * gets NO_LABOUR_MARKET_CONTACT, and also telling the coach "and they are on a
 * course" would be two rows for one conversation.
 *
 * An unanswered interest takes that slot outright, and does so whether or not
 * the person has other contact — someone is waiting for a reply either way.
 * "Find this person something" is the wrong next move when they have already
 * found it themselves and are waiting to hear back.
 */
export function signalsFor(client: JobClientInput, now: Date): JobSignalId[] {
  const signals: JobSignalId[] = []
  const contact = hasLabourMarketContact(client)

  if (awaitsAnswer(client)) {
    signals.push('INTEREST_UNANSWERED')
  } else if (!contact && daysBetween(client.createdAt, now) >= NO_CONTACT_GRACE_DAYS) {
    signals.push('NO_LABOUR_MARKET_CONTACT')
  } else if (!contact) {
    // Still inside the grace period. A running course with nothing alongside
    // it is worth naming early, because the lock-in effect starts immediately
    // rather than at the point somebody notices.
    const onCourse = client.learningRecords.some(
      (r) => r.status === 'IN_PROGRESS' && !WORK_KINDS.includes(r.kind),
    )
    if (onCourse) signals.push('COURSE_WITHOUT_WORK')
  }

  const stalled = client.learningRecords.some(
    (r) => r.status === 'IN_PROGRESS' && daysBetween(r.updatedAt, now) >= STALLED_RECORD_DAYS,
  )
  if (stalled) signals.push('STALLED_RECORD')

  return signals
}

/**
 * The Jobcoach's queue. The shape and the sort live in `lib/care/queue.ts`; what is
 * job-coaching-specific is only which signals fire, above.
 */
export function buildJobQueue(clients: JobClientInput[], now: Date): JobQueueItem[] {
  return buildCareQueue(clients, (client) => signalsFor(client, now), JOB_SIGNAL_IDS)
}
