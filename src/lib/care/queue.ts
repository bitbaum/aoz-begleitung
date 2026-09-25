import type { ApplicationStageId } from '@/lib/config/opportunities'
import type { LearningKindId, LearningStatusId } from '@/lib/config/learning'

/**
 * What a specialist has waiting — the shape, shared by every care domain.
 *
 * ## Why this file exists, and it is not "tidiness"
 *
 * `lib/jobcoach/queue.ts` documents a bug fixed for the Jobcoach on 2026-09-02: the
 * dashboard decided "busy" or "quiet" from a count made entirely of housing
 * queues, so a specialist's count was structurally zero and the product
 * congratulated him on a day with real work in it.
 *
 * That fix was written for ONE coach. The Freiwilligenarbeit coordinator sat next to it with the identical
 * defect — her caseload was never even fetched, because the query hardcoded
 * `careAssignment.role = 'JOB'` and her seats are `VOLUNTEERING` — and every
 * other term in the count needs permissions she does not hold. She has been
 * getting "Alles unter Kontrolle" every morning since.
 *
 * So the lesson is not the fix, it is the shape of the mistake: **a fix applied
 * to the instance rather than the class**. Putting the builder here is what
 * makes the third domain free instead of a third copy — and copies of a fix rot
 * one at a time, silently, which is how this happened in the first place.
 */

/**
 * An application, as every measure of contact reads it.
 *
 * `createdBy` and `supportedByUserId` are not decoration. Together they answer
 * the only question that separates contact from a request for contact: did a
 * person on the staff side ever engage with this thread?
 */
export interface CareApplicationInput {
  /**
   * The thread this row is about.
   *
   * REQUIRED, not optional. A queue row that says "somebody is waiting" and
   * cannot say what for sent the coach to the dossier to go and find it — three
   * navigations for the one action the queue exists to prompt. Optional would
   * have let a query forget to select it and still typecheck, which is the
   * mistake `NamedResident.displayName` is required to prevent.
   */
  opportunityId: string
  stage: ApplicationStageId
  /** Who opened this thread — the resident themselves, or a member of staff. */
  createdBy: 'RESIDENT' | 'STAFF'
  /** null = nobody on the staff side has picked it up. */
  supportedByUserId: string | null
}

export interface CareClientInput {
  residentId: string
  /** For display. Never a bare code — see utils/resident-name. */
  name: string
  /** When this person entered the register. */
  createdAt: Date
  learningRecords: {
    kind: LearningKindId
    status: LearningStatusId
    updatedAt: Date
  }[]
  applications: CareApplicationInput[]
}

export interface CareQueueItem<Signal extends string> {
  residentId: string
  name: string
  signal: Signal
  /**
   * Where to go to ACT on this row, when the row is about one thread.
   * `null` for signals that are about the person rather than a placement —
   * "nobody has arranged anything yet" has no thread to open.
   */
  opportunityId: string | null
}

/**
 * A resident put their hand up and nobody has answered.
 *
 * ## The inversion this ends
 *
 * Counting `INTERESTED` as contact inverted the whole instrument.
 * `recordInterest` writes precisely that row — resident-created, INTERESTED,
 * `supportedByUserId` null — when somebody presses "Ich habe Interesse" in the
 * portal, and nothing anywhere read `supportedByUserId`.
 *
 * So the single action a resident can take REMOVED them from their coach's
 * queue and RAISED the contact rate, without one member of staff having done
 * anything. The person most in need of a reply became the person the product
 * had stopped mentioning, and the metric moved the right way while the work
 * went undone.
 *
 * Contact means a person engaged. A click is a request for one. This is domain
 * -neutral on purpose: it is equally wrong to count the Freiwilligenarbeit coordinator's unanswered
 * volunteering interest as an engagement.
 */
export function isAwaitingAnswer(application: CareApplicationInput): boolean {
  return (
    application.createdBy === 'RESIDENT' &&
    application.stage === 'INTERESTED' &&
    application.supportedByUserId === null
  )
}

/** True while at least one of this client's threads is waiting for a reply. */
export function awaitsAnswer(client: CareClientInput): boolean {
  return client.applications.some(isAwaitingAnswer)
}

/**
 * The signal that names a specific thread, shared by every domain.
 *
 * Both coaches call it the same thing because it IS the same thing — a
 * resident put their hand up on one listing — so the rule for what a row links
 * to lives here once rather than as a callback each domain remembers to pass.
 */
export const AWAITING_ANSWER_SIGNAL = 'INTEREST_UNANSWERED'

/** The thread somebody is waiting on, oldest first by query order. */
export function awaitingApplication(client: CareClientInput): CareApplicationInput | null {
  return client.applications.find(isAwaitingAnswer) ?? null
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

/**
 * The whole queue, one row per (client, signal).
 *
 * Rows rather than clients because a coach works a signal, not a person: "who
 * has nothing arranged yet" and "whose record has stopped" are different
 * sittings. The dashboard counts rows, which is why a client with two signals
 * correctly represents two pieces of work.
 *
 * `priority` is the signal order, and it is load-bearing rather than cosmetic:
 * the dashboard hero renders `queue[0]` and nothing else, so an unsorted queue
 * hands that single prominent slot to whichever client the query happened to
 * return first. Each domain passes its own id list, which is already the order
 * its tiles render in — one list, both uses.
 */
export function buildCareQueue<Signal extends string>(
  clients: readonly CareClientInput[],
  signalsFor: (client: CareClientInput) => Signal[],
  priority: readonly Signal[],
): CareQueueItem<Signal>[] {
  const rows = clients.flatMap((client) =>
    signalsFor(client).map((signal) => ({
      residentId: client.residentId,
      name: client.name,
      signal,
      // Only the awaiting signal is about one thread. Attached here rather than
      // in each domain so the two cannot come to disagree about it.
      opportunityId:
        signal === AWAITING_ANSWER_SIGNAL
          ? (awaitingApplication(client)?.opportunityId ?? null)
          : null,
    })),
  )

  return rows.sort((a, b) => priority.indexOf(a.signal) - priority.indexOf(b.signal))
}
