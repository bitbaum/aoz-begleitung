'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AlertTriangle, Hand, Home, AlertCircle, Sparkles, ArrowRight, Vote } from 'lucide-react'
import { URGENCY_BADGE_CLASS, URGENCY_BORDER_CLASS, type Urgency } from '@/lib/config/urgency'
import { VERY_OVERDUE_THRESHOLD_DAYS } from '@/lib/config/checkin-intervals'
import { fallbackCta } from '@/lib/config/dashboard'
import type { JobQueueItem } from '@/lib/jobcoach/queue'
import type { WaitingApplication } from '@/lib/inbox/waiting'
import { JOB_SIGNAL_COPY } from '@/lib/config/job-integration-docs'
import type { StaffCapabilities } from '@/lib/auth/role-policy'
import { INCIDENT_TYPE_LABELS_SHORT, DASHBOARD_LABELS, UI_LABELS } from '@/lib/constants/labels'
import { residentName } from '@/lib/utils/resident-name'
import type {
  CriticalIncident,
  OverdueCheckIn,
  UnplacedResident,
  ProblemUnit,
  ProposalAwaitingStaff,
} from './types'

// =============================================================================
// Types
// =============================================================================

export interface PrimaryActionType {
  type: 'critical' | 'checkin' | 'proposal' | 'place' | 'problem' | 'allclear'
  title: string
  description: string
  href: string
  buttonText: string
  count?: number
}

// =============================================================================
// determinePrimaryAction
// =============================================================================

export function determinePrimaryAction({
  criticalIncidents,
  overdueCheckIns,
  unplacedResidents,
  freeBeds,
  problemUnits,
  proposalsAwaitingStaff,
  jobQueue,
  waitingApplications = [],
  viewer,
}: {
  criticalIncidents: CriticalIncident[]
  overdueCheckIns: OverdueCheckIn[]
  unplacedResidents: UnplacedResident[]
  freeBeds: number
  problemUnits: ProblemUnit[]
  proposalsAwaitingStaff: ProposalAwaitingStaff[]
  jobQueue: JobQueueItem[]
  /** Requests from the portal nobody has picked up — the Eingang badge's set. */
  waitingApplications?: WaitingApplication[]
  viewer: StaffCapabilities
}): PrimaryActionType {
  // Priority 1: Critical incidents
  if (criticalIncidents.length > 0) {
    return {
      type: 'critical',
      title: `${criticalIncidents.length} ${DASHBOARD_LABELS.heroCriticalIncidentsSuffix}`,
      description: `${INCIDENT_TYPE_LABELS_SHORT[criticalIncidents[0].type] || criticalIncidents[0].type} in ${criticalIncidents[0].unitCode}`,
      href: `/incidents/${criticalIncidents[0].id}`,
      buttonText: DASHBOARD_LABELS.heroActionNow,
      count: criticalIncidents.length,
    }
  }

  // Priority 2: Very overdue check-ins (using config threshold)
  const veryOverdue = overdueCheckIns.filter(
    (c) => c.isVeryOverdue || c.daysSinceLastCheckIn > VERY_OVERDUE_THRESHOLD_DAYS + 28,
  )
  if (veryOverdue.length > 0) {
    return {
      type: 'checkin',
      title: `${DASHBOARD_LABELS.heroCheckInUrgentPrefix} ${residentName({ code: veryOverdue[0].residentCode, displayName: veryOverdue[0].residentDisplayName })}`,
      description: `${DASHBOARD_LABELS.tileSincePrefix} ${veryOverdue[0].daysSinceLastCheckIn} ${DASHBOARD_LABELS.heroNotSeenSuffix}`,
      href: `/residents/${veryOverdue[0].residentId}`,
      buttonText: DASHBOARD_LABELS.heroStartCheckIn,
      count: veryOverdue.length,
    }
  }

  // Priority 3: Proposals awaiting a staff answer. A whole household voted
  // and is now blocked on the Betreuung — leaving that hanging teaches
  // residents that participation goes nowhere.
  if (proposalsAwaitingStaff.length > 0) {
    const top = proposalsAwaitingStaff[0]
    return {
      type: 'proposal',
      title: DASHBOARD_LABELS.heroProposalsTitle(proposalsAwaitingStaff.length),
      description: `«${top.title}» · ${top.unitCode}`,
      href: '/rules',
      buttonText: DASHBOARD_LABELS.heroReviewProposals,
      count: proposalsAwaitingStaff.length,
    }
  }

  // Priority 4: Unplaced residents with available beds
  if (unplacedResidents.length > 0 && freeBeds > 0) {
    return {
      type: 'place',
      title: `${unplacedResidents.length} ${DASHBOARD_LABELS.heroPlaceResidentsSuffix}`,
      description: `${freeBeds} ${DASHBOARD_LABELS.heroFreeBedsAvailableSuffix}`,
      href: '/matching',
      buttonText: DASHBOARD_LABELS.actionStartMatching,
      count: unplacedResidents.length,
    }
  }

  // Priority 5: Problem units with unresolved incidents
  const unitsWithUnresolved = problemUnits.filter((u) => u.unresolvedCount > 0)
  if (unitsWithUnresolved.length > 0) {
    const topUnit = unitsWithUnresolved[0]
    return {
      type: 'problem',
      title: `${topUnit.code}: ${topUnit.unresolvedCount} ${DASHBOARD_LABELS.heroOpenConflictsSuffix}`,
      description: `${DASHBOARD_LABELS.heroMainProblemPrefix} ${INCIDENT_TYPE_LABELS_SHORT[topUnit.primaryIssue] || topUnit.primaryIssue}`,
      href: `/housing/${topUnit.id}`,
      buttonText: DASHBOARD_LABELS.heroAnalyze,
      count: unitsWithUnresolved.length,
    }
  }

  // Priority 6: Regular overdue check-ins
  if (overdueCheckIns.length > 0) {
    return {
      type: 'checkin',
      title: `${overdueCheckIns.length} ${DASHBOARD_LABELS.heroCheckInsPendingSuffix}`,
      description: `${DASHBOARD_LABELS.heroNextPrefix} ${residentName({ code: overdueCheckIns[0].residentCode, displayName: overdueCheckIns[0].residentDisplayName })}`,
      href: `/residents/${overdueCheckIns[0].residentId}`,
      buttonText: DASHBOARD_LABELS.heroStartCheckIn,
      count: overdueCheckIns.length,
    }
  }

  // Priority 7: Problem units (all resolved but worth monitoring)
  if (problemUnits.length > 0) {
    return {
      type: 'problem',
      title: `${problemUnits.length} ${DASHBOARD_LABELS.heroMonitorUnitsSuffix}`,
      description: `${problemUnits[0].code} ${DASHBOARD_LABELS.heroHadSuffix} ${problemUnits[0].incidentCount} ${DASHBOARD_LABELS.heroIncidentsSuffix}`,
      href: `/housing/${problemUnits[0].id}`,
      buttonText: DASHBOARD_LABELS.heroReview,
      count: problemUnits.length,
    }
  }

  // The Job domain's work, LAST among the priorities and before all-clear.
  //
  // Last because everything above it is a safety or housing emergency, and a
  // coaching task must not outrank a critical incident. Before all-clear
  // because it is still work: without this branch the hero announced "Alles
  // erledigt!" on the same screen as a header reading "1 Aufgabe wartet auf
  // Sie" and an open-tasks tile naming the client — three states at once,
  // which is the contradiction this dashboard has fixed twice before.
  if (jobQueue.length > 0) {
    const copy = JOB_SIGNAL_COPY[jobQueue[0].signal]
    return {
      type: 'problem',
      title: copy.title,
      description: `${jobQueue[0].name} — ${copy.action}`,
      href: `/residents/${jobQueue[0].residentId}`,
      buttonText: DASHBOARD_LABELS.heroReview,
      count: jobQueue.length,
    }
  }

  // A client pressed "Ich habe Interesse" and nobody has answered. Without
  // this the hero said "Alles erledigt!" directly above the list of people
  // waiting — the badge said 2, the hero said nothing to do.
  if (waitingApplications.length > 0) {
    const oldest = waitingApplications[0]
    return {
      type: 'problem',
      title: DASHBOARD_LABELS.heroRequestsTitle(waitingApplications.length),
      description: `${oldest.name} — ${DASHBOARD_LABELS.heroRequestInterestIn} «${oldest.opportunityTitle}»`,
      href: `/opportunities/${oldest.opportunityId}`,
      buttonText: DASHBOARD_LABELS.heroReview,
      count: waitingApplications.length,
    }
  }

  // All clear! Offer the first action this role may actually perform —
  // /residents/new is a 403 for a Jobcoach. @see lib/config/dashboard.ts
  const cta = fallbackCta(viewer)
  return {
    type: 'allclear',
    title: DASHBOARD_LABELS.allClearAllDone,
    description: DASHBOARD_LABELS.allClearNoDringend,
    href: cta.href,
    buttonText: DASHBOARD_LABELS[cta.labelKey],
  }
}

// =============================================================================
// HeroAction
// =============================================================================

/** What each kind of primary action means, for the shared urgency mapping. */
const HERO_URGENCY: Record<PrimaryActionType['type'], Urgency> = {
  critical: 'critical',
  checkin: 'attention',
  proposal: 'attention',
  place: 'neutral',
  problem: 'attention',
  allclear: 'ok',
}

export function HeroAction({ action }: { action: PrimaryActionType }) {
  const icons = {
    critical: AlertTriangle,
    checkin: Hand,
    proposal: Vote,
    place: Home,
    problem: AlertCircle,
    allclear: Sparkles,
  }

  const IconComponent = icons[action.type]
  const urgency = HERO_URGENCY[action.type]

  return (
    // This block used to be a full-bleed slab of saturated colour, a different
    // hue per type — a hand-sized orange rectangle for a routine check-in.
    // It is now a normal surface whose BUTTON is brand red, which is the whole
    // point of the component: it names the single action that matters most
    // right now, and brand red is reserved for exactly that.
    <section className={`card ${URGENCY_BORDER_CLASS[urgency]} p-5 sm:p-6`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="flex items-start gap-4">
          <span className={`icon-container shrink-0 ${URGENCY_BADGE_CLASS[urgency]}`}>
            <IconComponent className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">{DASHBOARD_LABELS.heroEyebrow}</p>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-heading text-ui-text mt-1 text-balance">
              {action.title}
            </h2>
            <p className="text-ui-muted mt-1">{action.description}</p>
          </div>
        </div>

        <Link href={action.href} className="btn-secondary shrink-0 self-start sm:self-auto">
          {action.buttonText}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

// =============================================================================
// CriticalAlertBanner
// =============================================================================

export function CriticalAlertBanner({ incidents }: { incidents: CriticalIncident[] }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const incidentLabel = INCIDENT_TYPE_LABELS_SHORT[incidents[0].type] || incidents[0].type

  return (
    // Saturated red is earned here and nowhere else on this page: this is the
    // one banner that means somebody may be unsafe. It no longer pulses —
    // continuous motion on a red bar is an accessibility problem for
    // vestibular and attention disorders, and it made the page feel alarmed
    // rather than making THIS item stand out.
    <div
      role="alert"
      className="bg-status-error text-ui-on-accent px-4 py-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 shrink-0" />
        <div>
          <span className="font-bold">
            {incidents.length} {DASHBOARD_LABELS.alertCriticalAttentionSuffix}
          </span>
          <span className="ml-2 opacity-80">
            • {incidentLabel} in {incidents[0].unitCode}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Link
          href={`/incidents/${incidents[0].id}`}
          className="px-3 py-1 bg-ui-surface text-status-error rounded font-medium hover:bg-status-error/8"
        >
          {DASHBOARD_LABELS.alertEdit}
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-status-error/80 rounded"
          aria-label={UI_LABELS.close}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
