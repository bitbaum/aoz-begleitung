/**
 * Opportunities — SSOT for kinds, stages, eligibility labels and badges.
 *
 * The rule this file exists to hold: an opportunity declares what IT requires.
 * Nothing here describes a person. `PERMIT_REQUIREMENT_LABELS` is read by both
 * the staff form and the resident-facing card, so the sentence a coach picks is
 * the sentence the resident reads — there is no second wording to drift.
 *
 * @see src/lib/opportunities/pipeline.ts for the stage logic itself.
 */

import { Briefcase, GraduationCap, HeartHandshake, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { IntegrationBoardId } from './integration-boards'

export const OPPORTUNITY_KINDS = [
  'VOLUNTEERING',
  'COMMUNITY_SERVICE',
  'EMPLOYMENT',
  'INTERNSHIP',
] as const
export type OpportunityKindId = (typeof OPPORTUNITY_KINDS)[number]

/**
 * The kinds that are WORK, and therefore raise a question about authorisation.
 *
 * Not "paid" — an unpaid Praktikum raises the same question, so the test is
 * whether the person is working for an organisation, not whether money moves.
 * Volunteering and community service sit outside this deliberately: they are
 * unpaid by definition, which is what makes them open to everyone.
 */
export const WORK_OPPORTUNITY_KINDS = ['EMPLOYMENT', 'INTERNSHIP'] as const
export type WorkOpportunityKindId = (typeof WORK_OPPORTUNITY_KINDS)[number]

export function isWorkKind(kind: string): kind is WorkOpportunityKindId {
  return (WORK_OPPORTUNITY_KINDS as readonly string[]).includes(kind)
}

/**
 * Which listings belong on each half of the board.
 *
 * DERIVED from `WORK_OPPORTUNITY_KINDS`, never a second list: a kind added to
 * the enum lands on exactly one board without anyone remembering to put it
 * there, and it can never land on both or neither. The split the coaches see is
 * then the same split the permit gate already enforces, which is the point —
 * "does this raise a question about authorisation" is what separates the Jobcoach's
 * work from the Freiwilligenarbeit coordinator's.
 */
export function boardOpportunityKinds(board: IntegrationBoardId): readonly OpportunityKindId[] {
  if (board === 'job') return WORK_OPPORTUNITY_KINDS
  if (board === 'volunteering') return OPPORTUNITY_KINDS.filter((kind) => !isWorkKind(kind))
  return OPPORTUNITY_KINDS
}

/**
 * A work listing may not claim that no authorisation is needed.
 *
 * `permitRequirement` defaults to `NONE`, which renders to a resident as
 * "Keine Bewilligung nötig". On unpaid volunteering that is true and useful.
 * On a job it is a legal claim about that person's situation which this
 * product cannot make and must never make by DEFAULT — and the people using it
 * hold permits that constrain work, so a wrong reassurance here costs the
 * resident, not us.
 *
 * So for work kinds the listing has to state an actual route —
 * `EMPLOYER_NOTIFIES` or `PERMIT_REQUIRED` — and a coach who does not know
 * which cannot publish. That is the intended outcome: the unknown case belongs
 * with Sozialarbeit before it reaches a resident, not on a board.
 */
export function permitRequirementIsStated(kind: string, permitRequirement: string): boolean {
  if (!isWorkKind(kind)) return true
  return permitRequirement === 'EMPLOYER_NOTIFIES' || permitRequirement === 'PERMIT_REQUIRED'
}

export const OPPORTUNITY_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
export type OpportunityStatusId = (typeof OPPORTUNITY_STATUSES)[number]

export const PERMIT_REQUIREMENTS = ['NONE', 'EMPLOYER_NOTIFIES', 'PERMIT_REQUIRED'] as const
export type PermitRequirementId = (typeof PERMIT_REQUIREMENTS)[number]

export const APPLICATION_STAGES = [
  'INTERESTED',
  'APPLIED',
  'INTERVIEW',
  'ACCEPTED',
  'STARTED',
  'ENDED',
  'DECLINED',
] as const
export type ApplicationStageId = (typeof APPLICATION_STAGES)[number]

/**
 * The ONE name for this area of the product — same discipline as
 * LEARNING_AREA_NAME, which had to be introduced after that area accumulated
 * four different names across nav, page title, dashboard tile and permissions.
 */
export const OPPORTUNITY_AREA_NAME = 'Einsatzplätze'

/** Every application on a board, by stage — the one place they are reviewed. */
export const APPLICATIONS_REVIEW_PATH = '/opportunities/applications'

export const OPPORTUNITY_KIND_LABELS: Record<OpportunityKindId, string> = {
  VOLUNTEERING: 'Freiwilligenarbeit',
  COMMUNITY_SERVICE: 'Gemeinnütziger Einsatz',
  EMPLOYMENT: 'Arbeitsstelle',
  INTERNSHIP: 'Praktikum',
}

export const OPPORTUNITY_KIND_ICONS: Record<OpportunityKindId, LucideIcon> = {
  VOLUNTEERING: HeartHandshake,
  COMMUNITY_SERVICE: Users,
  EMPLOYMENT: Briefcase,
  INTERNSHIP: GraduationCap,
}

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatusId, string> = {
  DRAFT: 'Entwurf',
  PUBLISHED: 'Veröffentlicht',
  ARCHIVED: 'Archiviert',
}

export const OPPORTUNITY_STATUS_BADGES: Record<OpportunityStatusId, string> = {
  DRAFT: 'badge-pending',
  PUBLISHED: 'badge-active',
  ARCHIVED: 'badge-ended',
}

/**
 * Written as a statement about the PLACE, in the second person the resident
 * will eventually read. "Du brauchst keine Bewilligung" is a fact about this
 * opportunity; "du hast keine Bewilligung" would be a fact about the person,
 * and this product does not know that and must not learn it.
 */
export const PERMIT_REQUIREMENT_LABELS: Record<PermitRequirementId, string> = {
  NONE: 'Keine Bewilligung nötig',
  EMPLOYER_NOTIFIES: 'Meldeverfahren durch die Organisation',
  PERMIT_REQUIRED: 'Bewilligung erforderlich',
}

export const PERMIT_REQUIREMENT_HINTS: Record<PermitRequirementId, string> = {
  // Only ever true of an unpaid kind — `permitStatement` never shows this
  // line on work. It said "Freiwilligenarbeit", which a gemeinnütziger
  // Einsatz is not.
  NONE: 'Unbezahlter Einsatz — offen für alle.',
  EMPLOYER_NOTIFIES: 'Die Organisation meldet den Einsatz selbst an.',
  PERMIT_REQUIRED: 'Vorher mit der Sozialarbeit klären, ob das möglich ist.',
}

export const PERMIT_REQUIREMENT_BADGES: Record<PermitRequirementId, string> = {
  NONE: 'chip-success',
  EMPLOYER_NOTIFIES: 'chip-info',
  PERMIT_REQUIRED: 'chip-warning',
}

/**
 * What a listing SAYS about authorisation — the stored value read together
 * with the kind. SSOT for every surface that renders it (staff list, staff
 * detail, portal).
 *
 * ## The bug this exists to end
 *
 * Observed live on 2026-10-01: a paid job saved as a draft with
 * `permitRequirement` at its `NONE` default rendered «Keine Bewilligung nötig»
 * AND «Unbezahlte Freiwilligenarbeit — offen für alle.» on the staff detail
 * page — a legal claim and a factual falsehood about a CHF 70'000 position.
 * The publish gate (`permitRequirementIsStated`) kept it off the board, but
 * every surface rendered the raw enum, so the gate's own reason for existing
 * was printed on the page it guards.
 *
 * So `NONE` on a work kind is not "no permit needed"; it is UNSTATED — nobody
 * has said which route applies yet — and it says so, as a warning.
 */
export const PERMIT_STATEMENT_IDS = [...PERMIT_REQUIREMENTS, 'UNSTATED'] as const
export type PermitStatementId = (typeof PERMIT_STATEMENT_IDS)[number]

export const PERMIT_UNSTATED_LABEL = 'Bewilligungsweg noch nicht festgelegt'
export const PERMIT_UNSTATED_HINT =
  'Vor dem Veröffentlichen klären — im Zweifel mit der Sozialarbeit. Bis dahin bleibt der Eintrag ein Entwurf.'

export interface PermitStatement {
  id: PermitStatementId
  label: string
  hint: string
  /** A `chip-*` class. */
  badge: string
  /** True when someone has to act before this listing may go live. */
  needsAction: boolean
}

export function permitStatementId(kind: string, permitRequirement: string): PermitStatementId {
  if (!permitRequirementIsStated(kind, permitRequirement)) return 'UNSTATED'
  return permitRequirement as PermitRequirementId
}

export function permitStatement(kind: string, permitRequirement: string): PermitStatement {
  const id = permitStatementId(kind, permitRequirement)
  if (id === 'UNSTATED') {
    return {
      id,
      label: PERMIT_UNSTATED_LABEL,
      hint: PERMIT_UNSTATED_HINT,
      badge: 'chip-warning',
      needsAction: true,
    }
  }
  return {
    id,
    label: PERMIT_REQUIREMENT_LABELS[id],
    hint: PERMIT_REQUIREMENT_HINTS[id],
    badge: PERMIT_REQUIREMENT_BADGES[id],
    needsAction: false,
  }
}

export const APPLICATION_STAGE_LABELS: Record<ApplicationStageId, string> = {
  INTERESTED: 'Interessiert',
  APPLIED: 'Beworben',
  INTERVIEW: 'Gespräch',
  ACCEPTED: 'Zugesagt',
  STARTED: 'Gestartet',
  ENDED: 'Beendet',
  DECLINED: 'Abgesagt',
}

/**
 * The button that MOVES a thread into each stage — a verb phrase for what
 * happened, where `APPLICATION_STAGE_LABELS` names the state. INTERESTED is
 * absent because nothing moves into it: it is where every thread begins.
 * Which buttons a row shows is `availableTransitions` in pipeline.ts.
 */
export type StageTransitionTargetId = Exclude<ApplicationStageId, 'INTERESTED'>

export const APPLICATION_STAGE_ACTION_LABELS: Record<StageTransitionTargetId, string> = {
  APPLIED: 'Bewerbung eingereicht',
  INTERVIEW: 'Gespräch vereinbart',
  ACCEPTED: 'Zusage',
  STARTED: 'Gestartet',
  ENDED: 'Abgeschlossen',
  DECLINED: 'Absage',
}

export const APPLICATION_STAGE_BADGES: Record<ApplicationStageId, string> = {
  INTERESTED: 'badge-info',
  APPLIED: 'badge-pending',
  INTERVIEW: 'badge-pending',
  ACCEPTED: 'badge-active',
  STARTED: 'badge-active',
  ENDED: 'badge-ended',
  DECLINED: 'badge-ended',
}

export interface OpportunityRecord {
  id: string
  createdAt: Date
  updatedAt: Date
  kind: OpportunityKindId
  title: string
  description: string
  organisation: string
  location: string | null
  schedule: string | null
  hoursPerWeek: number | null
  seats: number | null
  germanLevel: string | null
  permitRequirement: PermitRequirementId
  requirementNote: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  website: string | null
  status: OpportunityStatusId
  startsAt: Date | null
  endsAt: Date | null
  createdByUserId: string | null
  updatedByUserId: string | null
}
