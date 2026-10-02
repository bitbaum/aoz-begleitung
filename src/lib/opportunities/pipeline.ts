/**
 * The application pipeline — pure logic, no I/O.
 *
 * A directory of places goes stale in a month and answers no question a coach
 * actually has. The pipeline is what makes this a tool: "where is everyone" is
 * a query over stages, not a memory of conversations.
 *
 * Two rules live here rather than in a route handler, because both are easy to
 * get subtly wrong and impossible to notice afterwards:
 *
 *  1. STARTED is the moment an intention becomes something that happened, so
 *     it is the moment the LearningRecord is generated. Evidence is then a
 *     by-product of the work instead of a second thing to type — and the two
 *     halves of the integration story stop being able to disagree.
 *  2. Terminal stages are terminal. ENDED and DECLINED are off the forward
 *     path, so the board never suggests a "next step" for a thread that is over.
 */

import type {
  ApplicationStageId,
  OpportunityKindId,
  OpportunityRecord,
  OpportunityStatusId,
  StageTransitionTargetId,
} from '@/lib/config/opportunities'

/**
 * The forward path. DECLINED is deliberately NOT in it: a refusal is not a
 * later phase of the same journey, and putting it in the sequence would make
 * "advance to the next stage" eventually mean "reject this person".
 */
export const APPLICATION_PIPELINE = [
  'INTERESTED',
  'APPLIED',
  'INTERVIEW',
  'ACCEPTED',
  'STARTED',
  'ENDED',
] as const satisfies readonly ApplicationStageId[]

export const TERMINAL_STAGES = [
  'ENDED',
  'DECLINED',
] as const satisfies readonly ApplicationStageId[]

/** The learning category every opportunity-generated record is filed under. */
export const OPPORTUNITY_EVIDENCE_CATEGORY = 'community'

export function isTerminalStage(stage: ApplicationStageId): boolean {
  return (TERMINAL_STAGES as readonly string[]).includes(stage)
}

export function isActiveStage(stage: ApplicationStageId): boolean {
  return !isTerminalStage(stage)
}

/**
 * Position on the forward path, or -1 for DECLINED. Used for ordering a board
 * so the threads needing attention sort together, never for validation.
 */
export function pipelinePosition(stage: ApplicationStageId): number {
  return (APPLICATION_PIPELINE as readonly string[]).indexOf(stage)
}

/**
 * The single natural next step, or null when there isn't one.
 *
 * Deliberately one stage rather than a menu of seven. The board offers this as
 * the primary action and keeps the full list for corrections — a coach moving
 * someone along should not have to re-read the whole pipeline to do the
 * obvious thing.
 */
export function nextPipelineStage(stage: ApplicationStageId): ApplicationStageId | null {
  const position = pipelinePosition(stage)
  if (position < 0) return null
  return APPLICATION_PIPELINE[position + 1] ?? null
}

/**
 * Where a thread may go from each stage. SSOT for every stage change — the
 * server action refuses anything not listed here, and every button the staff
 * UI offers is derived from it, so the two cannot disagree.
 *
 * ## Why a table and not "any stage to any stage"
 *
 * The stage control used to be a free <select> over all seven stages. Observed
 * live on 2026-10-01: a client was attached to a DRAFT job listing and set
 * straight to ENDED — "Beendet · Nachweis erstellt" — for work that never
 * started. STARTED and ENDED are not labels: STARTED mints a LearningRecord,
 * which the client's dossier and every integration KPI read as evidence. A
 * jump that skips the steps produces evidence nobody earned.
 *
 * - DECLINED is reachable from every open stage before STARTED, and from
 *   nowhere after: once someone has started, the engagement ENDS (and the
 *   hours are asked for) — calling that a refusal would erase the work.
 * - APPLIED may go straight to ACCEPTED: plenty of places say yes without an
 *   interview, and forcing a fake "Gespräch" would make that stage a lie.
 * - ENDED and DECLINED are terminal. A mistake there is corrected by a person,
 *   in the audit trail, not by a button that walks evidence backwards.
 */
export const APPLICATION_TRANSITIONS: Record<
  ApplicationStageId,
  readonly StageTransitionTargetId[]
> = {
  INTERESTED: ['APPLIED', 'DECLINED'],
  APPLIED: ['INTERVIEW', 'ACCEPTED', 'DECLINED'],
  INTERVIEW: ['ACCEPTED', 'DECLINED'],
  ACCEPTED: ['STARTED', 'DECLINED'],
  STARTED: ['ENDED'],
  ENDED: [],
  DECLINED: [],
}

export function canTransition(from: ApplicationStageId, to: ApplicationStageId): boolean {
  return (APPLICATION_TRANSITIONS[from] as readonly ApplicationStageId[]).includes(to)
}

/**
 * Moves that wind a thread DOWN — the only moves left once a listing is not
 * published. Somebody who started before the listing was archived must still
 * be able to finish (and have their hours recorded), and a person attached to
 * a draft by mistake must be able to be let go. Nothing moves FORWARD on a
 * listing that is not on offer.
 */
export const WIND_DOWN_STAGES = [
  'ENDED',
  'DECLINED',
] as const satisfies readonly ApplicationStageId[]

/** Why a stage change is refused. Mapped to German in the admin labels. */
export type StageChangeRefusal = 'LISTING_NOT_PUBLISHED' | 'ILLEGAL_TRANSITION'

export function stageChangeRefusal(
  listingStatus: OpportunityStatusId,
  from: ApplicationStageId,
  to: ApplicationStageId,
): StageChangeRefusal | null {
  if (!canTransition(from, to)) return 'ILLEGAL_TRANSITION'
  if (listingStatus !== 'PUBLISHED' && !(WIND_DOWN_STAGES as readonly string[]).includes(to)) {
    return 'LISTING_NOT_PUBLISHED'
  }
  return null
}

/** The next steps a coach is offered, in table order — never a refused one. */
export function availableTransitions(
  listingStatus: OpportunityStatusId,
  from: ApplicationStageId,
): StageTransitionTargetId[] {
  return APPLICATION_TRANSITIONS[from].filter(
    (to) => stageChangeRefusal(listingStatus, from, to) === null,
  )
}

/**
 * A person may be put forward — by staff or by themselves — only onto a place
 * that is actually on offer. A DRAFT is still being written (its permit route
 * may not even be settled); an ARCHIVED one is over.
 */
export function mayAttachPeople(listingStatus: OpportunityStatusId): boolean {
  return listingStatus === 'PUBLISHED'
}

/** Counts against a listing's seats: someone holding a place, or already in it. */
export function occupiesSeat(stage: ApplicationStageId): boolean {
  return stage === 'ACCEPTED' || stage === 'STARTED'
}

/**
 * What a resident should do about their own thread, in four states.
 *
 * Four rather than one per stage, because seven near-identical sentences are
 * noise: what actually differs is whether the next move is theirs, ours, or
 * nobody's. A stage badge alone answers "where is this" and not "what do I do",
 * and "what do I do" is the only question somebody opens this page with.
 */
export type ResidentNextStep = 'WAITING_ON_STAFF' | 'YOURS_TO_ATTEND' | 'FINISHED' | 'NOT_THIS_TIME'

export function residentNextStep(stage: ApplicationStageId): ResidentNextStep {
  if (stage === 'DECLINED') return 'NOT_THIS_TIME'
  if (stage === 'ENDED') return 'FINISHED'
  if (occupiesSeat(stage)) return 'YOURS_TO_ATTEND'
  return 'WAITING_ON_STAFF'
}

/**
 * When a resident may see how to reach the organisation.
 *
 * Not before they have been accepted, and this is enforced on the PAYLOAD —
 * `with: { opportunity: true }` hands back every column including
 * `contactEmail`, so the board was already shipping an employer's direct line
 * to anyone who pressed "Ich habe Interesse". Not rendering it is not the same
 * as not sending it.
 *
 * The reason is not that a contact address is secret. It is that the people
 * using this hold permits that constrain work, `permitRequirementIsStated`
 * exists so that a listing cannot claim otherwise, and a resident arranging
 * something directly at INTERESTED bypasses the one person who checks which
 * route applies. Once staff have accepted them onto the place that check has
 * happened, and withholding the address would then just stop them turning up.
 *
 * ENDED keeps it: you worked there, and a reference is a normal thing to ask
 * for. DECLINED does not — that relationship never started.
 */
export function maySeeContact(stage: ApplicationStageId): boolean {
  return stage === 'ACCEPTED' || stage === 'STARTED' || stage === 'ENDED'
}

/**
 * Seats left, or null when the listing never stated a number.
 *
 * Null is not zero and must not render as "0 frei" — an unstated capacity is
 * unknown, and reporting it as full would hide the place from everyone.
 */
export function openSeats(
  opportunity: Pick<OpportunityRecord, 'seats'>,
  stages: readonly ApplicationStageId[],
): number | null {
  if (opportunity.seats === null || opportunity.seats === undefined) return null
  const taken = stages.filter(occupiesSeat).length
  return Math.max(0, opportunity.seats - taken)
}

/** True once a listing can take nobody else. Unstated capacity is never full. */
export function isFull(
  opportunity: Pick<OpportunityRecord, 'seats'>,
  stages: readonly ApplicationStageId[],
): boolean {
  return openSeats(opportunity, stages) === 0
}

export interface GeneratedEvidence {
  kind: OpportunityKindId
  title: string
  status: 'IN_PROGRESS'
  provider: string
  category: typeof OPPORTUNITY_EVIDENCE_CATEGORY
  startedAt: Date
  recordedBy: 'STAFF'
}

/**
 * The LearningRecord an application produces the moment it STARTS.
 *
 * `kind` passes straight through because OpportunityKind is a subset of
 * LearningKind by construction — pinned by `opportunity-kinds.test.ts`, so
 * adding a kind on one side without the other fails the suite instead of
 * throwing at the one moment a coach is trying to record real work.
 *
 * `hours` is deliberately NOT filled from `hoursPerWeek`. One is a rate and
 * the other is a total; writing a rate into a total is a wrong number that
 * looks like a right one, and it would then be read as service hours by every
 * surface that sums them.
 */
export function evidenceForStartedApplication(
  opportunity: Pick<OpportunityRecord, 'kind' | 'title' | 'organisation'>,
  startedAt: Date,
): GeneratedEvidence {
  return {
    kind: opportunity.kind,
    title: opportunity.title,
    status: 'IN_PROGRESS',
    provider: opportunity.organisation,
    category: OPPORTUNITY_EVIDENCE_CATEGORY,
    startedAt,
    recordedBy: 'STAFF',
  }
}
