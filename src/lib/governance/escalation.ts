/**
 * Conflict escalation — pure functions, no I/O.
 *
 * Answers two questions the staff currently answer from memory:
 *   1. Where should this conflict start?
 *   2. What is the next step, who owns it, and is it late?
 *
 * Both answers come with a reason. A resident asking "why am I suddenly in a
 * formal procedure?" deserves a better answer than "the system said so".
 */

import type {
  AgreementStatus,
  IncidentCategory,
  IncidentSeverity,
  IncidentType,
  ResolutionStage,
} from '@/lib/db'
import {
  CATEGORIES_REQUIRING_STAFF_ENTRY,
  RESOLUTION_LADDER,
  RESOLUTION_OWNER_LABELS,
  RESOLUTION_STAGE_BY_KEY,
  SEVERITY_ENTRY_STAGE,
  TYPES_REQUIRING_STAFF_ENTRY,
  AGREEMENT_CONFIG,
} from '@/lib/config/conflict-resolution'
import { formatDateNumeric } from '@/lib/utils/formatting'

// =============================================================================
// ENTRY
// =============================================================================

export interface EntryDecision {
  stage: ResolutionStage
  reason: string
}

/**
 * Where a newly reported conflict enters the ladder.
 *
 * Safety reports and high-severity incidents skip the resident-to-resident
 * rungs entirely. Nobody is sent to negotiate with someone who threatened
 * them — see the note in the conflict-resolution config.
 */
export function determineEntryStage(incident: {
  category: IncidentCategory
  severity: IncidentSeverity
  type: IncidentType
}): EntryDecision {
  const bySeverity = SEVERITY_ENTRY_STAGE[incident.severity]

  const categoryForcesStaff = CATEGORIES_REQUIRING_STAFF_ENTRY.includes(incident.category)
  const typeForcesStaff = (TYPES_REQUIRING_STAFF_ENTRY as readonly string[]).includes(incident.type)

  if (categoryForcesStaff || typeForcesStaff) {
    const stage: ResolutionStage =
      rungOf(bySeverity) > rungOf('STAFF_MEDIATION') ? bySeverity : 'STAFF_MEDIATION'
    return {
      stage,
      reason:
        'Bei einer Sicherheitsmeldung übernimmt immer zuerst die Betreuung. ' +
        'Niemand muss ein solches Thema selbst mit der anderen Person klären.',
    }
  }

  if (incident.severity === 'CRITICAL') {
    return {
      stage: 'FORMAL_MEASURE',
      reason: 'Kritischer Vorfall — es braucht sofort eine formelle Massnahme.',
    }
  }

  if (incident.severity === 'HIGH') {
    return {
      stage: 'STAFF_MEDIATION',
      reason: 'Schwerer Vorfall — die Betreuung vermittelt direkt.',
    }
  }

  return {
    stage: bySeverity,
    reason:
      'Konflikte lösen sich am schnellsten, wenn die Beteiligten früh selbst miteinander sprechen. ' +
      'Die Betreuung unterstützt auf Wunsch.',
  }
}

function rungOf(stage: ResolutionStage): number {
  return RESOLUTION_STAGE_BY_KEY[stage].rung
}

// =============================================================================
// NEXT STEP
// =============================================================================

export interface AgreementLike {
  status: AgreementStatus
  reviewDate: Date
}

export interface NextStepRecommendation {
  currentStage: ResolutionStage
  recommendedStage: ResolutionStage
  shouldEscalate: boolean
  owner: string
  /** When the current step should have been checked on. */
  dueDate: Date
  isOverdue: boolean
  daysOverdue: number
  reason: string
}

/**
 * What should happen next with this conflict.
 *
 * Escalation is driven by evidence, not by the clock alone: an agreement that
 * broke is the strongest signal that the current rung did not hold. A step that
 * is merely late gets flagged, not escalated — being slow is not the same as
 * having failed.
 */
export function recommendNextStep(
  incident: {
    resolutionStage: ResolutionStage
    stageEnteredAt: Date
    resolvedAt?: Date | null
  },
  agreements: AgreementLike[],
  now: Date,
): NextStepRecommendation {
  const currentDef = RESOLUTION_STAGE_BY_KEY[incident.resolutionStage]
  const dueDate = addDays(incident.stageEnteredAt, currentDef.targetDays)
  const daysOverdue = Math.max(0, daysBetween(dueDate, now))
  const isOverdue = daysOverdue > 0 && incident.resolutionStage !== 'CLOSED'

  const base = {
    currentStage: incident.resolutionStage,
    owner: RESOLUTION_OWNER_LABELS[currentDef.owner],
    dueDate,
    isOverdue,
    daysOverdue,
  }

  if (incident.resolutionStage === 'CLOSED') {
    return {
      ...base,
      recommendedStage: 'CLOSED',
      shouldEscalate: false,
      reason: 'Der Konflikt ist abgeschlossen.',
    }
  }

  const brokenAgreement = agreements.some((a) => a.status === 'BROKEN')
  const heldAgreement = agreements.some((a) => a.status === 'HELD')
  const openAgreement = agreements.some((a) => a.status === 'ACCEPTED' || a.status === 'PROPOSED')

  if (heldAgreement && !brokenAgreement) {
    return {
      ...base,
      recommendedStage: 'CLOSED',
      shouldEscalate: false,
      reason: 'Die Abmachung hat gehalten. Der Konflikt kann abgeschlossen werden.',
    }
  }

  if (brokenAgreement) {
    const next = nextRung(incident.resolutionStage)
    return {
      ...base,
      recommendedStage: next,
      shouldEscalate: next !== incident.resolutionStage,
      reason:
        'Die Abmachung wurde nicht eingehalten. Der nächste Schritt bringt Unterstützung dazu — ' +
        'das ist keine Strafe, sondern heisst, dass die bisherige Lösung nicht getragen hat.',
    }
  }

  if (openAgreement) {
    const overdueReview = agreements.some(
      (a) =>
        (a.status === 'ACCEPTED' || a.status === 'PROPOSED') &&
        daysBetween(addDays(a.reviewDate, AGREEMENT_CONFIG.expiryGraceDays), now) > 0,
    )
    return {
      ...base,
      recommendedStage: incident.resolutionStage,
      shouldEscalate: false,
      reason: overdueReview
        ? 'Die Abmachung ist überfällig zur Überprüfung. Bitte nachfragen, ob sie funktioniert hat.'
        : 'Eine Abmachung läuft. Am Überprüfungsdatum nachfragen, ob sie gehalten hat.',
    }
  }

  if (isOverdue) {
    return {
      ...base,
      recommendedStage: incident.resolutionStage,
      shouldEscalate: false,
      reason:
        `Seit ${daysOverdue} Tag${daysOverdue === 1 ? '' : 'en'} überfällig: Auf dieser Stufe wurde noch keine ` +
        `Abmachung festgehalten. Nachfragen, bevor eskaliert wird.`,
    }
  }

  return {
    ...base,
    recommendedStage: incident.resolutionStage,
    shouldEscalate: false,
    reason: `Läuft. Nächste Überprüfung bis ${formatDateNumeric(dueDate)}.`,
  }
}

/** The next rung up, or the same stage if already at the top of the ladder. */
export function nextRung(stage: ResolutionStage): ResolutionStage {
  const current = RESOLUTION_STAGE_BY_KEY[stage]
  const higher = RESOLUTION_LADDER.filter(
    (d) => d.rung > current.rung && d.stage !== 'CLOSED',
  ).sort((a, b) => a.rung - b.rung)
  return higher[0]?.stage ?? stage
}

// =============================================================================
// DATE HELPERS (local — governance has no date library dependency)
// =============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY)
}
