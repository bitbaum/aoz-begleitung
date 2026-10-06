/**
 * Translated names for the opportunity enums.
 *
 * The staff side reads the German labels straight out of
 * `lib/config/opportunities.ts` and that is right — staff UI is German by
 * decision. The portal is not: the three things a resident needs from this
 * page are what kind of work it is, whether a permit stands between them and
 * it, and where their own application stands. Leaving those in German would
 * translate the page around the only parts that carry the information.
 *
 * The maps are keyed by the config's own id unions, so adding a stage or a
 * permit state fails to compile here until it has a key — the same parity the
 * German labels get from being declared in the config itself.
 */

import type { MessageKey } from './dictionaries/de'
import type { Translator } from './index'
import {
  permitStatementId,
  type ApplicationStageId,
  type OpportunityKindId,
  type PermitRequirementId,
  type PermitStatementId,
} from '@/lib/config/opportunities'
import type {
  OpenBoardEmpty,
  ResidentContactHint,
  ResidentNextStep,
} from '@/lib/opportunities/pipeline'

const KIND_KEYS: Record<OpportunityKindId, MessageKey> = {
  VOLUNTEERING: 'opportunities.kindVolunteering',
  COMMUNITY_SERVICE: 'opportunities.kindCommunity',
  EMPLOYMENT: 'opportunities.kindEmployment',
  INTERNSHIP: 'opportunities.kindInternship',
}

const PERMIT_KEYS: Record<PermitRequirementId, MessageKey> = {
  NONE: 'opportunities.permitNone',
  EMPLOYER_NOTIFIES: 'opportunities.permitNotifies',
  PERMIT_REQUIRED: 'opportunities.permitRequired',
}

const STAGE_KEYS: Record<ApplicationStageId, MessageKey> = {
  INTERESTED: 'opportunities.stageInterested',
  APPLIED: 'opportunities.stageApplied',
  INTERVIEW: 'opportunities.stageInterview',
  ACCEPTED: 'opportunities.stageAccepted',
  STARTED: 'opportunities.stageStarted',
  ENDED: 'opportunities.stageEnded',
  DECLINED: 'opportunities.stageDeclined',
}

export function opportunityKindLabel(t: Translator, kind: OpportunityKindId): string {
  return t(KIND_KEYS[kind])
}

export function permitRequirementLabel(t: Translator, permit: PermitRequirementId): string {
  return t(PERMIT_KEYS[permit])
}

const PERMIT_STATEMENT_KEYS: Record<PermitStatementId, MessageKey> = {
  ...PERMIT_KEYS,
  UNSTATED: 'opportunities.permitUnstated',
}

/**
 * What the listing says about authorisation, read with its kind — the portal
 * twin of `permitStatement`. Render THIS, never `permitRequirementLabel` on a
 * listing: a work listing at the `NONE` default must not tell a resident
 * "Keine Bewilligung nötig".
 */
export function permitStatementLabel(t: Translator, kind: string, permit: string): string {
  return t(PERMIT_STATEMENT_KEYS[permitStatementId(kind, permit)])
}

export function applicationStageLabel(t: Translator, stage: ApplicationStageId): string {
  return t(STAGE_KEYS[stage])
}

/**
 * What the client's own thread says happens now — one sentence per
 * `ResidentNextStep`, keyed by the union so a new state fails to compile here.
 * A place that is yours but has no stated start date must not say «Unten
 * steht, wo und ab wann»: there is nothing below about «wann».
 */
const NEXT_STEP_KEYS: Record<ResidentNextStep, MessageKey> = {
  PROPOSED_TO_YOU: 'opportunities.nextProposed',
  WAITING_ON_STAFF: 'opportunities.nextWaiting',
  YOURS_TO_ATTEND: 'opportunities.nextAttend',
  UNDER_WAY: 'opportunities.nextUnderWay',
  FINISHED: 'opportunities.nextFinished',
  NOT_THIS_TIME: 'opportunities.nextDeclined',
  YOU_DECLINED: 'opportunities.nextYouDeclined',
}

export function residentNextStepKey(step: ResidentNextStep, hasStartDate: boolean): MessageKey {
  if (step === 'YOURS_TO_ATTEND' && !hasStartDate) return 'opportunities.nextAttendUndated'
  return NEXT_STEP_KEYS[step]
}

const CONTACT_HINT_KEYS: Record<ResidentContactHint, MessageKey> = {
  BEFORE_START: 'opportunities.contactHint',
  DURING: 'opportunities.contactHintDuring',
  REFERENCE: 'opportunities.contactHintReference',
}

export function residentContactHintKey(hint: ResidentContactHint): MessageKey {
  return CONTACT_HINT_KEYS[hint]
}

const OPEN_EMPTY_KEYS: Record<OpenBoardEmpty, MessageKey> = {
  NONE_PUBLISHED: 'opportunities.openEmpty',
  ALL_YOURS: 'opportunities.openAllYours',
}

export function openBoardEmptyKey(state: OpenBoardEmpty): MessageKey {
  return OPEN_EMPTY_KEYS[state]
}
