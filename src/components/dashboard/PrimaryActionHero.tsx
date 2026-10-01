'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AlertTriangle, Hand, Home, AlertCircle, Sparkles, ArrowRight, Vote } from 'lucide-react'
import { URGENCY_BADGE_CLASS, URGENCY_BORDER_CLASS, type Urgency } from '@/lib/config/urgency'
import { VERY_OVERDUE_THRESHOLD_DAYS } from '@/lib/config/checkin-intervals'
import { fallbackCta, heroOrder, type HeroSource } from '@/lib/config/dashboard'
import type { JobQueueItem } from '@/lib/jobcoach/queue'
import type { VolunteeringQueueItem } from '@/lib/volunteering/queue'
import type { WaitingApplication } from '@/lib/inbox/waiting'
import { JOB_SIGNAL_COPY } from '@/lib/config/job-integration-docs'
import { VOLUNTEERING_SIGNAL_COPY } from '@/lib/config/volunteering-signals'
import type { StaffCapabilities } from '@/lib/auth/role-policy'
import { INCIDENT_TYPE_LABELS_SHORT, DASHBOARD_LABELS, UI_LABELS } from '@/lib/constants/labels'
import { residentName } from '@/lib/utils/resident-name'
import type {
  CriticalIncident,
  OverdueCheckIn,
  UnplacedResident,
  ProblemUnit,
  ProposalAwaitingStaff,
  PendingTransferRequest,
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

/** A queue row from either integration domain. */
interface CaseloadRow {
  residentId: string
  name: string
  opportunityId: string | null
}

export interface HeroData {
  criticalIncidents: CriticalIncident[]
  overdueCheckIns: OverdueCheckIn[]
  unplacedResidents: UnplacedResident[]
  freeBeds: number
  problemUnits: ProblemUnit[]
  proposalsAwaitingStaff: ProposalAwaitingStaff[]
  jobQueue: JobQueueItem[]
  volunteeringQueue?: VolunteeringQueueItem[]
  /**
   * Requests from the portal nobody has picked up — ONLY those this viewer
   * may answer. A read-only list is not work and must not claim the hero.
   */
  waitingApplications?: WaitingApplication[]
  waitingThreads?: { residentId: string; name: string; waitingSince: Date }[]
  overdueFollowUps?: { id: string; subject: string | null; unitCode: string | null }[]
  expiringFacts?: { name: string; label: string }[]
  pendingApprovals?: { name: string; summary: string }[]
  pendingTransfers?: PendingTransferRequest[]
  openMaintenance?: { id: string; title: string; unitCode: string }[]
  viewer: StaffCapabilities
}

type HeroBuilder = (data: HeroData) => PrimaryActionType | null

/** The row link the caseload tiles use: the thread when there is one. */
function caseloadHref(row: CaseloadRow): string {
  return row.opportunityId ? `/opportunities/${row.opportunityId}` : `/residents/${row.residentId}`
}

function caseloadHero(
  rows: readonly (CaseloadRow & { signal: string })[],
  copyFor: (signal: string) => { title: string; action: string },
): PrimaryActionType | null {
  if (rows.length === 0) return null
  const copy = copyFor(rows[0].signal)
  return {
    type: 'problem',
    title: copy.title,
    description: `${rows[0].name} — ${copy.action}`,
    href: caseloadHref(rows[0]),
    buttonText: DASHBOARD_LABELS.heroReview,
    count: rows.length,
  }
}

/**
 * One builder per hero source. WHICH source wins is the viewer's desk
 * (`config/roles.ts`) — this file only knows how each one reads.
 */
const HERO_BUILDERS: Record<HeroSource, HeroBuilder> = {
  criticalIncidents: ({ criticalIncidents }) =>
    criticalIncidents.length === 0
      ? null
      : {
          type: 'critical',
          title: `${criticalIncidents.length} ${DASHBOARD_LABELS.heroCriticalIncidentsSuffix}`,
          description: `${INCIDENT_TYPE_LABELS_SHORT[criticalIncidents[0].type] || criticalIncidents[0].type} in ${criticalIncidents[0].unitCode}`,
          href: `/incidents/${criticalIncidents[0].id}`,
          buttonText: DASHBOARD_LABELS.heroActionNow,
          count: criticalIncidents.length,
        },

  checkInsVeryOverdue: ({ overdueCheckIns }) => {
    const veryOverdue = overdueCheckIns.filter(
      (c) => c.isVeryOverdue || c.daysSinceLastCheckIn > VERY_OVERDUE_THRESHOLD_DAYS + 28,
    )
    if (veryOverdue.length === 0) return null
    return {
      type: 'checkin',
      title: `${DASHBOARD_LABELS.heroCheckInUrgentPrefix} ${residentName({ code: veryOverdue[0].residentCode, displayName: veryOverdue[0].residentDisplayName })}`,
      description: `${DASHBOARD_LABELS.tileSincePrefix} ${veryOverdue[0].daysSinceLastCheckIn} ${DASHBOARD_LABELS.heroNotSeenSuffix}`,
      href: `/residents/${veryOverdue[0].residentId}`,
      buttonText: DASHBOARD_LABELS.heroStartCheckIn,
      count: veryOverdue.length,
    }
  },

  // A whole household voted and is now blocked on the Betreuung — leaving
  // that hanging teaches residents that participation goes nowhere.
  proposals: ({ proposalsAwaitingStaff }) => {
    if (proposalsAwaitingStaff.length === 0) return null
    const top = proposalsAwaitingStaff[0]
    return {
      type: 'proposal',
      title: DASHBOARD_LABELS.heroProposalsTitle(proposalsAwaitingStaff.length),
      description: `«${top.title}» · ${top.unitCode}`,
      href: '/rules',
      buttonText: DASHBOARD_LABELS.heroReviewProposals,
      count: proposalsAwaitingStaff.length,
    }
  },

  // Unplaced people count as open work whether or not a bed is free, so the
  // hero must name them either way: with beds it starts matching, without it
  // sends the reader to the stock. It used to fall through to "Alles
  // erledigt!" when no bed was free, above a tile listing the same people.
  matching: ({ unplacedResidents, freeBeds }) => {
    if (unplacedResidents.length === 0) return null
    const title = `${unplacedResidents.length} ${DASHBOARD_LABELS.heroPlaceResidentsSuffix}`
    return freeBeds > 0
      ? {
          type: 'place',
          title,
          description: `${freeBeds} ${DASHBOARD_LABELS.heroFreeBedsAvailableSuffix}`,
          href: '/matching',
          buttonText: DASHBOARD_LABELS.actionStartMatching,
          count: unplacedResidents.length,
        }
      : {
          type: 'place',
          title,
          description: DASHBOARD_LABELS.heroNoFreeBeds,
          href: '/housing',
          buttonText: DASHBOARD_LABELS.heroOpenHousing,
          count: unplacedResidents.length,
        }
  },

  conflictUnits: ({ problemUnits }) => {
    const unresolved = problemUnits.filter((u) => u.unresolvedCount > 0)
    if (unresolved.length === 0) return null
    const topUnit = unresolved[0]
    return {
      type: 'problem',
      title: `${topUnit.code}: ${topUnit.unresolvedCount} ${DASHBOARD_LABELS.heroOpenConflictsSuffix}`,
      description: `${DASHBOARD_LABELS.heroMainProblemPrefix} ${INCIDENT_TYPE_LABELS_SHORT[topUnit.primaryIssue] || topUnit.primaryIssue}`,
      href: `/housing/${topUnit.id}`,
      buttonText: DASHBOARD_LABELS.heroAnalyze,
      count: unresolved.length,
    }
  },

  checkIns: ({ overdueCheckIns }) =>
    overdueCheckIns.length === 0
      ? null
      : {
          type: 'checkin',
          title: `${overdueCheckIns.length} ${DASHBOARD_LABELS.heroCheckInsPendingSuffix}`,
          description: `${DASHBOARD_LABELS.heroNextPrefix} ${residentName({ code: overdueCheckIns[0].residentCode, displayName: overdueCheckIns[0].residentDisplayName })}`,
          href: `/residents/${overdueCheckIns[0].residentId}`,
          buttonText: DASHBOARD_LABELS.heroStartCheckIn,
          count: overdueCheckIns.length,
        },

  // Problem units whose incidents are all resolved, but worth watching.
  conflictUnitsMonitor: ({ problemUnits }) =>
    problemUnits.length === 0
      ? null
      : {
          type: 'problem',
          title: `${problemUnits.length} ${DASHBOARD_LABELS.heroMonitorUnitsSuffix}`,
          description: `${problemUnits[0].code} ${DASHBOARD_LABELS.heroHadSuffix} ${problemUnits[0].incidentCount} ${DASHBOARD_LABELS.heroIncidentsSuffix}`,
          href: `/housing/${problemUnits[0].id}`,
          buttonText: DASHBOARD_LABELS.heroReview,
          count: problemUnits.length,
        },

  jobQueue: ({ jobQueue }) =>
    caseloadHero(jobQueue, (signal) => JOB_SIGNAL_COPY[signal as JobQueueItem['signal']]),

  volunteeringQueue: ({ volunteeringQueue = [] }) =>
    caseloadHero(
      volunteeringQueue,
      (signal) => VOLUNTEERING_SIGNAL_COPY[signal as VolunteeringQueueItem['signal']],
    ),

  // A client pressed "Ich habe Interesse" and nobody has answered.
  applications: ({ waitingApplications = [] }) => {
    if (waitingApplications.length === 0) return null
    const oldest = waitingApplications[0]
    return {
      type: 'problem',
      title: DASHBOARD_LABELS.heroRequestsTitle(waitingApplications.length),
      description: `${oldest.name} — ${DASHBOARD_LABELS.heroRequestInterestIn} «${oldest.opportunityTitle}»`,
      href: `/opportunities/${oldest.opportunityId}`,
      buttonText: DASHBOARD_LABELS.heroReview,
      count: waitingApplications.length,
    }
  },

  messages: ({ waitingThreads = [] }) =>
    waitingThreads.length === 0
      ? null
      : {
          type: 'problem',
          title: DASHBOARD_LABELS.heroMessagesTitle(waitingThreads.length),
          description: `${waitingThreads[0].name} ${DASHBOARD_LABELS.tileWaitingLongestSuffix}`,
          href: `/messages/${waitingThreads[0].residentId}`,
          buttonText: DASHBOARD_LABELS.heroAnswer,
          count: waitingThreads.length,
        },

  followUps: ({ overdueFollowUps = [] }) =>
    overdueFollowUps.length === 0
      ? null
      : {
          type: 'problem',
          title: DASHBOARD_LABELS.heroFollowUpsTitle(overdueFollowUps.length),
          description:
            overdueFollowUps[0].subject ??
            overdueFollowUps[0].unitCode ??
            DASHBOARD_LABELS.tileFollowUpsAction,
          href: `/incidents/${overdueFollowUps[0].id}`,
          buttonText: DASHBOARD_LABELS.heroReview,
          count: overdueFollowUps.length,
        },

  renewals: ({ expiringFacts = [] }) =>
    expiringFacts.length === 0
      ? null
      : {
          type: 'problem',
          title: DASHBOARD_LABELS.heroRenewalsTitle(expiringFacts.length),
          description: `${expiringFacts[0].name} — ${expiringFacts[0].label}`,
          href: '/approvals',
          buttonText: DASHBOARD_LABELS.heroReview,
          count: expiringFacts.length,
        },

  approvals: ({ pendingApprovals = [] }) =>
    pendingApprovals.length === 0
      ? null
      : {
          type: 'problem',
          title: DASHBOARD_LABELS.heroApprovalsTitle(pendingApprovals.length),
          description: `${pendingApprovals[0].name} — ${pendingApprovals[0].summary}`,
          href: '/approvals',
          buttonText: DASHBOARD_LABELS.heroReview,
          count: pendingApprovals.length,
        },

  transferRequests: ({ pendingTransfers = [] }) =>
    pendingTransfers.length === 0
      ? null
      : {
          type: 'place',
          title: DASHBOARD_LABELS.heroTransfersTitle(pendingTransfers.length),
          description: `${residentName({ code: pendingTransfers[0].residentCode, displayName: pendingTransfers[0].residentDisplayName })} ${DASHBOARD_LABELS.tileWaitingLongestSuffix}`,
          href: '/transfer-requests',
          buttonText: DASHBOARD_LABELS.heroReview,
          count: pendingTransfers.length,
        },

  maintenance: ({ openMaintenance = [] }) =>
    openMaintenance.length === 0
      ? null
      : {
          type: 'problem',
          title: DASHBOARD_LABELS.heroMaintenanceTitle(openMaintenance.length),
          description: `${openMaintenance[0].title} · ${openMaintenance[0].unitCode}`,
          href: `/maintenance/${openMaintenance[0].id}`,
          buttonText: DASHBOARD_LABELS.heroReview,
          count: openMaintenance.length,
        },
}

/**
 * The single next action for THIS viewer: the first source in their desk's
 * hero list (`heroOrder`) that has something, else the all-clear with the
 * desk's quiet-day button.
 *
 * It used to be one global order for every role. A Freiwilligenarbeit
 * coordinator's volunteering queue was never even passed in, so the hero
 * said "Alles erledigt!" above open volunteering tiles; and the housing
 * manager's hero led with check-ins that are Betreuung's work.
 */
export function determinePrimaryAction(data: HeroData): PrimaryActionType {
  for (const source of heroOrder(data.viewer)) {
    const action = HERO_BUILDERS[source](data)
    if (action) return action
  }

  // All clear! The desk's own home, or the first action this role may
  // actually perform. @see lib/config/dashboard.ts
  const cta = fallbackCta(data.viewer)
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
