'use client'

import type { ReactNode } from 'react'
import { Bed, Clock, Check, Wrench, Smile, GraduationCap, CalendarClock, Users } from 'lucide-react'
import { urgencyForGoodStreak, urgencyForOpenCount } from '@/lib/config/urgency'
import { DISPLAY_LIMITS } from '@/lib/config/thresholds'
import {
  dashboardSections,
  fallbackCta,
  workspaceState,
  type DashboardSection,
} from '@/lib/config/dashboard'
import { hasPermission, type StaffCapabilities } from '@/lib/auth/role-policy'
import { VOLUNTEERING_SIGNAL_IDS, type VolunteeringQueueItem } from '@/lib/volunteering/queue'
import { VOLUNTEERING_SIGNAL_COPY } from '@/lib/config/volunteering-signals'
import { JOB_SIGNAL_IDS, type JobQueueItem } from '@/lib/jobcoach/queue'
import { JOB_SIGNAL_COPY } from '@/lib/config/job-integration-docs'
import {
  INCIDENT_TYPE_LABELS_SHORT,
  DASHBOARD_LABELS,
  MAINTENANCE_PRIORITY_LABELS,
} from '@/lib/constants/labels'
import { calendarDaysSince } from '@/lib/utils'
import { residentName } from '@/lib/utils/resident-name'
import { HeroAction, CriticalAlertBanner, determinePrimaryAction } from './PrimaryActionHero'
import { QuickStat } from './QuickStatsRow'
import { ActionTile } from './ActionTilesGrid'
import { AllClearState } from './AllClearState'
import { EmptyWorkspaceState } from './EmptyWorkspaceState'
import { WaitingApplications } from './WaitingApplications'
import type { WaitingApplication } from '@/lib/inbox/waiting'
import { AWAITING_ANSWER_SIGNAL } from '@/lib/care/queue'
import { UnassignedWorkspaceState } from './UnassignedWorkspaceState'
import type {
  OverdueCheckIn,
  DueSoonCheckIn,
  UnplacedResident,
  CriticalIncident,
  ProblemUnit,
  PendingTransferRequest,
  ProposalAwaitingStaff,
} from './types'

// =============================================================================
// Types
// =============================================================================

/** An open maintenance request, as the Liegenschaften list shows it. */
export interface OpenMaintenanceItem {
  id: string
  title: string
  unitCode: string
  priority: string
  daysOpen: number
}

interface ActionDashboardProps {
  /**
   * Decides which sections render and in what order — the viewer's desk.
   * @see lib/config/roles.ts, lib/config/dashboard.ts
   */
  viewer: StaffCapabilities

  // Core stats
  occupiedBeds: number
  totalBeds: number
  totalPlacements: number

  /**
   * How many people and units exist AT ALL — not how many need something.
   * Without these the dashboard cannot tell "nothing to do" from "no data
   * yet", and reports an untouched database as finished work.
   * @see lib/config/dashboard.ts — workspaceState()
   */
  residentCount: number
  housingUnitCount: number

  /**
   * How many clients sit in THIS viewer's care seat, or null when the question
   * does not apply (oversight over every domain, or an account with no single
   * seat). Distinguishes "nothing to do" from "nobody has been assigned to
   * you", which the global count above cannot see.
   */
  assignedResidentCount: number | null
  /**
   * Requests residents raised on a listing that nobody has taken up.
   * Answerable ones are tasks; for a viewer who may only read the board they
   * are shown without the «Übernehmen» button and not counted.
   * @see lib/inbox/waiting.ts
   */
  waitingApplications: WaitingApplication[]
  /** Client-entered facts awaiting a first look. */
  pendingApprovals: { id: string; name: string; summary: string }[]
  /** The Job domain's own work, one row per (client, signal). @see lib/jobcoach/queue.ts */
  jobQueue: JobQueueItem[]
  volunteeringQueue: VolunteeringQueueItem[]
  /** Klient*innen waiting for an answer, longest wait first. */
  waitingThreads: { residentId: string; name: string; waitingSince: Date }[]
  /** Review dates the caseworker set that have passed, incident still open. */
  overdueFollowUps: {
    id: string
    subject: string | null
    unitCode: string | null
    daysOverdue: number
  }[]
  /**
   * Insurances and permits running out, most urgent first — for the viewer's
   * own clients unless they reach every domain.
   */
  expiringFacts: {
    id: string
    kind: string
    name: string
    label: string
    daysLeft: number
  }[]
  /** Open maintenance requests, oldest first. */
  openMaintenance: OpenMaintenanceItem[]

  // Action items
  overdueCheckIns: OverdueCheckIn[]
  dueSoonCheckIns: DueSoonCheckIn[]
  unplacedResidents: UnplacedResident[]
  criticalIncidents: CriticalIncident[]
  problemUnits: ProblemUnit[]
  pendingTransfers: PendingTransferRequest[]
  proposalsAwaitingStaff: ProposalAwaitingStaff[]

  // Health indicators
  conflictFreeDays: number
  openMaintenanceCount: number
  learningInProgressCount: number
  learningRecentCompletions: number
  upcomingEventsCount: number

  // Team health — rendered only under `users:manage`.
  activeStaffCount: number
  neverSignedInStaffCount: number

  /**
   * Computed on the server and passed in, NOT derived here. This component is
   * server-rendered as well as hydrated, and `new Date()` means UTC in the
   * container and Europe/Zurich in the browser — a difference that made React
   * discard the whole tree and rebuild it. @see lib/utils/local-time.ts
   */
  greeting: string
  todayLabel: string
}

// =============================================================================
// Utilities
// =============================================================================

/** "Tag" for one, "Tage" for anything else. */
function daysWord(count: number): string {
  return count === 1 ? DASHBOARD_LABELS.statDaySuffixSingular : DASHBOARD_LABELS.statDaysSuffix
}

function formatDaysAgo(date: Date): string {
  const days = calendarDaysSince(date)
  if (days === 0) return DASHBOARD_LABELS.today
  if (days === 1) return DASHBOARD_LABELS.yesterday
  return `${days} ${DASHBOARD_LABELS.daysAgo}`
}

/**
 * Where a caseload row goes when you click it: the thread when there is one
 * ("Interesse wartet auf Antwort" is the first signal in both domains), the
 * dossier when the row is about the person rather than a placement.
 */
const rowHref = (row: { residentId: string; opportunityId: string | null }) =>
  row.opportunityId ? `/opportunities/${row.opportunityId}` : `/residents/${row.residentId}`

// =============================================================================
// Main Component
// =============================================================================

export function ActionDashboard(props: ActionDashboardProps) {
  const {
    viewer,
    residentCount,
    housingUnitCount,
    assignedResidentCount,
    occupiedBeds,
    totalBeds,
    totalPlacements,
    conflictFreeDays,
    openMaintenanceCount,
    learningInProgressCount,
    learningRecentCompletions,
    upcomingEventsCount,
    activeStaffCount,
    neverSignedInStaffCount,
    greeting,
    todayLabel,
  } = props

  // The viewer's sections, in their desk's order. Every queue below is read
  // THROUGH this gate, so a section a desk does not list cannot leak work
  // onto the screen even if a caller hands over its data.
  const sections = dashboardSections(viewer)
  const show = (section: DashboardSection) => sections.includes(section)
  const when = <T,>(section: DashboardSection, rows: T[]): T[] => (show(section) ? rows : [])

  const criticalIncidents = when('criticalIncidents', props.criticalIncidents)
  const overdueCheckIns = when('checkIns', props.overdueCheckIns)
  const dueSoonCheckIns = when('checkIns', props.dueSoonCheckIns)
  const problemUnits = when('incidents', props.problemUnits)
  const overdueFollowUps = when('incidents', props.overdueFollowUps)
  const proposalsAwaitingStaff = when('proposals', props.proposalsAwaitingStaff)
  const waitingThreads = when('messages', props.waitingThreads)
  const pendingApprovals = when('approvals', props.pendingApprovals)
  const expiringFacts = when('renewals', props.expiringFacts)
  const waitingApplications = when('applications', props.waitingApplications)
  const jobQueue = when('caseload', props.jobQueue)
  const volunteeringQueue = when('caseload', props.volunteeringQueue)
  const unplacedResidents = when('matching', props.unplacedResidents)
  const pendingTransfers = when('transferRequests', props.pendingTransfers)
  const openMaintenance = when('maintenance', props.openMaintenance)

  // Only someone who may answer a request has it as work. Betreuung sees who
  // asked, without the button and without it counting as a task.
  const canClaim = hasPermission(viewer, 'opportunities:write')
  const claimableApplications = canClaim ? waitingApplications : []

  const freeBeds = totalBeds - occupiedBeds
  const onTimeCheckIns = totalPlacements - overdueCheckIns.length

  const primaryAction = determinePrimaryAction({
    jobQueue,
    volunteeringQueue,
    criticalIncidents,
    overdueCheckIns,
    unplacedResidents,
    freeBeds,
    problemUnits,
    proposalsAwaitingStaff,
    waitingApplications: claimableApplications,
    waitingThreads,
    overdueFollowUps,
    expiringFacts,
    pendingApprovals,
    pendingTransfers,
    openMaintenance,
    viewer,
  })

  // A request nobody has answered is listed ONCE, in the applications section
  // with its own "Übernehmen" button. The caseload tiles carry the same signal
  // for the specialist's own clients, so a row the section already shows is
  // dropped from them — by (person, listing), not by signal.
  const listedInSection = new Set(
    waitingApplications.map((row) => `${row.residentId}:${row.opportunityId}`),
  )
  const notListedAbove = (row: {
    residentId: string
    signal: string
    opportunityId: string | null
  }) =>
    !(
      row.signal === AWAITING_ANSWER_SIGNAL &&
      listedInSection.has(`${row.residentId}:${row.opportunityId}`)
    )

  // One rendering, two domains. The signal ids are each domain's priority
  // order, and the tiles render in it — the same list the queue sorts by.
  const careTiles = [
    ...JOB_SIGNAL_IDS.map((signal) => ({
      key: `job:${signal}`,
      copy: JOB_SIGNAL_COPY[signal],
      rows: jobQueue.filter((row) => row.signal === signal && notListedAbove(row)),
      allHref: '/opportunities?board=job',
    })),
    ...VOLUNTEERING_SIGNAL_IDS.map((signal) => ({
      key: `volunteering:${signal}`,
      copy: VOLUNTEERING_SIGNAL_COPY[signal],
      rows: volunteeringQueue.filter((row) => row.signal === signal && notListedAbove(row)),
      allHref: '/opportunities?board=volunteering',
    })),
  ].filter((tile) => tile.rows.length > 0)

  // Every queue that waits on THIS viewer, and nothing that does not. Each
  // term is already gated by the desk above, so a Jobcoach's count can no
  // longer be structurally zero, and Liegenschaften's no longer counts the
  // check-ins Betreuung runs.
  const taskCounts: Partial<Record<DashboardSection, number>> = {
    criticalIncidents: criticalIncidents.length,
    checkIns: overdueCheckIns.length,
    incidents: overdueFollowUps.length,
    proposals: proposalsAwaitingStaff.length,
    messages: waitingThreads.length,
    approvals: pendingApprovals.length,
    renewals: expiringFacts.length,
    applications: claimableApplications.length,
    caseload: careTiles.reduce((sum, tile) => sum + tile.rows.length, 0),
    matching: unplacedResidents.length,
    transferRequests: pendingTransfers.length,
    maintenance: openMaintenance.length,
  }
  const totalIssues = Object.values(taskCounts).reduce((sum, n) => sum + (n ?? 0), 0)

  // "Nothing to do" and "nothing entered yet" are different facts and get
  // different screens. @see lib/config/dashboard.ts
  const state = workspaceState({
    residentCount,
    openTaskCount: totalIssues + problemUnits.length,
    assignedResidentCount,
  })

  // ── Pulse tiles, one per section that has one ────────────────────────────
  const stats: Partial<Record<DashboardSection, ReactNode>> = {
    occupancy: (
      <QuickStat
        key="occupancy"
        label={DASHBOARD_LABELS.statFreeBeds}
        value={freeBeds}
        total={totalBeds}
        href="/housing?status=AVAILABLE"
        urgency="neutral"
        icon={<Bed className="w-5 h-5" />}
        subtext={`${occupiedBeds}/${totalBeds} ${DASHBOARD_LABELS.occupancyOccupied}`}
      />
    ),
    checkIns: (
      <QuickStat
        key="checkIns"
        label={DASHBOARD_LABELS.statCheckIns}
        value={overdueCheckIns.length}
        suffix={` ${DASHBOARD_LABELS.statOverdueSuffix}`}
        href="/placements?status=active&overdue=1"
        urgency={urgencyForOpenCount(overdueCheckIns.length)}
        icon={
          overdueCheckIns.length === 0 ? (
            <Check className="w-5 h-5" />
          ) : (
            <Clock className="w-5 h-5" />
          )
        }
        // "keine aktuell" under "13 überfällig" read as a contradiction;
        // the fraction says the same thing and cannot be misread.
        subtext={
          onTimeCheckIns === totalPlacements
            ? DASHBOARD_LABELS.statAllCurrent
            : `${onTimeCheckIns}/${totalPlacements} ${DASHBOARD_LABELS.statCurrentSuffix}`
        }
      />
    ),
    incidents: (
      <QuickStat
        key="incidents"
        label={DASHBOARD_LABELS.statHarmony}
        value={conflictFreeDays}
        suffix={` ${daysWord(conflictFreeDays)}`}
        href="/incidents"
        urgency={urgencyForGoodStreak(conflictFreeDays)}
        icon={<Smile className="w-5 h-5" />}
        subtext={DASHBOARD_LABELS.statNoConflicts}
      />
    ),
    maintenance: (
      <QuickStat
        key="maintenance"
        label={DASHBOARD_LABELS.statMaintenance}
        value={openMaintenanceCount}
        suffix={` ${DASHBOARD_LABELS.statOpenSuffix}`}
        href="/maintenance"
        urgency={urgencyForOpenCount(openMaintenanceCount)}
        icon={
          openMaintenanceCount === 0 ? (
            <Check className="w-5 h-5" />
          ) : (
            <Wrench className="w-5 h-5" />
          )
        }
      />
    ),
    learning: (
      <QuickStat
        key="learning"
        label={DASHBOARD_LABELS.statLearning}
        value={learningInProgressCount}
        suffix={` ${DASHBOARD_LABELS.statRunningSuffix}`}
        href="/learning"
        urgency="neutral"
        icon={<GraduationCap className="w-5 h-5" />}
        subtext={DASHBOARD_LABELS.statLearningCompletions(learningRecentCompletions)}
      />
    ),
    events: (
      <QuickStat
        key="events"
        label={DASHBOARD_LABELS.statEvents}
        value={upcomingEventsCount}
        suffix={` ${DASHBOARD_LABELS.statPlannedSuffix}`}
        href="/events"
        urgency="neutral"
        icon={<CalendarClock className="w-5 h-5" />}
      />
    ),
    team: (
      <QuickStat
        key="team"
        label={DASHBOARD_LABELS.statTeam}
        value={activeStaffCount}
        suffix={` ${DASHBOARD_LABELS.statTeamSuffix}`}
        href="/settings"
        // `attention` only when something is actually loose. A permanently
        // amber tile is one nobody reads.
        urgency={neverSignedInStaffCount > 0 ? 'attention' : 'neutral'}
        icon={<Users className="w-5 h-5" />}
        subtext={
          neverSignedInStaffCount > 0
            ? DASHBOARD_LABELS.statTeamNeverSignedIn(neverSignedInStaffCount)
            : undefined
        }
      />
    ),
  }

  // ── Work tiles, per section, rendered in the desk's order ────────────────
  const tiles: Partial<Record<DashboardSection, ReactNode[]>> = {
    checkIns: [
      overdueCheckIns.length > 0 && (
        <ActionTile
          key="checkIns"
          title={DASHBOARD_LABELS.tileCheckIns}
          count={overdueCheckIns.length}
          description={`${residentName({ code: overdueCheckIns[0].residentCode, displayName: overdueCheckIns[0].residentDisplayName })} ${DASHBOARD_LABELS.tileWaitingLongestSuffix}`}
          href={`/residents/${overdueCheckIns[0].residentId}`}
          urgency={urgencyForOpenCount(overdueCheckIns.length)}
          items={overdueCheckIns.slice(0, DISPLAY_LIMITS.dashboardItems).map((c) => ({
            label: residentName({ code: c.residentCode, displayName: c.residentDisplayName }),
            sublabel: `${c.daysSinceLastCheckIn} ${daysWord(c.daysSinceLastCheckIn)} · ${c.unitCode}`,
            href: `/residents/${c.residentId}`,
          }))}
          allHref="/placements?status=active&overdue=1"
        />
      ),
    ],
    incidents: [
      // A review date that has passed is the ladder failing quietly: the whole
      // mechanism is somebody coming back on the day they said they would.
      overdueFollowUps.length > 0 && (
        <ActionTile
          key="followUps"
          title={DASHBOARD_LABELS.tileFollowUpsOverdue}
          count={overdueFollowUps.length}
          description={DASHBOARD_LABELS.tileFollowUpsAction}
          href={`/incidents/${overdueFollowUps[0].id}`}
          urgency={urgencyForOpenCount(overdueFollowUps.length)}
          items={overdueFollowUps.slice(0, DISPLAY_LIMITS.dashboardItems).map((row) => ({
            label: row.subject ?? row.unitCode ?? DASHBOARD_LABELS.tileFollowUpsOverdue,
            sublabel: DASHBOARD_LABELS.tileOverdueByDays(row.daysOverdue),
            href: `/incidents/${row.id}`,
          }))}
          allHref="/incidents?status=open"
        />
      ),
      problemUnits.length > 0 && (
        <ActionTile
          key="conflictUnits"
          title={DASHBOARD_LABELS.tileConflictUnits}
          count={problemUnits.length}
          description={DASHBOARD_LABELS.tileConflictUnitsDesc}
          href={`/housing/${problemUnits[0].id}`}
          urgency="critical"
          items={problemUnits.slice(0, DISPLAY_LIMITS.dashboardItems).map((u) => ({
            label: u.code,
            sublabel: `${u.incidentCount} ${DASHBOARD_LABELS.tileIncidents} · ${INCIDENT_TYPE_LABELS_SHORT[u.primaryIssue] || u.primaryIssue}`,
            href: `/housing/${u.id}`,
          }))}
          allHref="/incidents"
        />
      ),
    ],
    // An insurance or permit running out — the tile the client-facts feature
    // exists for.
    renewals: [
      expiringFacts.length > 0 && (
        <ActionTile
          key="renewals"
          title={DASHBOARD_LABELS.tileRenewalsDue}
          count={expiringFacts.length}
          description={DASHBOARD_LABELS.tileRenewalsAction}
          href="/approvals"
          urgency={urgencyForOpenCount(expiringFacts.length)}
          items={expiringFacts.slice(0, DISPLAY_LIMITS.dashboardItems).map((row) => ({
            label: row.name,
            sublabel:
              row.daysLeft < 0
                ? DASHBOARD_LABELS.tileRenewalExpired(Math.abs(row.daysLeft))
                : DASHBOARD_LABELS.tileRenewalDue(row.daysLeft),
            href: '/approvals',
          }))}
          allHref="/approvals"
        />
      ),
    ],
    approvals: [
      pendingApprovals.length > 0 && (
        <ActionTile
          key="approvals"
          title={DASHBOARD_LABELS.tileApprovals}
          count={pendingApprovals.length}
          description={DASHBOARD_LABELS.tileApprovalsAction}
          href="/approvals"
          urgency={urgencyForOpenCount(pendingApprovals.length)}
          items={pendingApprovals.slice(0, DISPLAY_LIMITS.dashboardItems).map((row) => ({
            label: row.name,
            sublabel: row.summary,
            href: '/approvals',
          }))}
          allHref="/approvals"
        />
      ),
    ],
    // Somebody asked and is still waiting.
    messages: [
      waitingThreads.length > 0 && (
        <ActionTile
          key="messages"
          title={DASHBOARD_LABELS.tileMessagesWaiting}
          count={waitingThreads.length}
          description={`${waitingThreads[0].name} ${DASHBOARD_LABELS.tileWaitingLongestSuffix}`}
          href={`/messages/${waitingThreads[0].residentId}`}
          urgency={urgencyForOpenCount(waitingThreads.length)}
          items={waitingThreads.slice(0, DISPLAY_LIMITS.dashboardItems).map((thread) => ({
            label: thread.name,
            sublabel: DASHBOARD_LABELS.tileWaitingSinceDays(calendarDaysSince(thread.waitingSince)),
            href: `/messages/${thread.residentId}`,
          }))}
          allHref="/messages"
        />
      ),
    ],
    // The integration domains' work, one tile per signal, naming clients.
    caseload: careTiles.map((tile) => (
      <ActionTile
        key={tile.key}
        title={tile.copy.title}
        count={tile.rows.length}
        description={tile.copy.action}
        href={rowHref(tile.rows[0])}
        urgency={urgencyForOpenCount(tile.rows.length)}
        items={tile.rows.slice(0, DISPLAY_LIMITS.dashboardItems).map((row) => ({
          label: row.name,
          // The signal is already the tile's title, so the sublabel carries
          // the move rather than repeating it.
          sublabel: tile.copy.action,
          href: rowHref(row),
        }))}
        allHref={tile.allHref}
      />
    )),
    matching: [
      unplacedResidents.length > 0 && (
        <ActionTile
          key="matching"
          title={DASHBOARD_LABELS.tilePlaceResidents}
          count={unplacedResidents.length}
          description={`${residentName(unplacedResidents[0])} ${DASHBOARD_LABELS.tileWaitingLongestSuffix}`}
          href="/matching"
          urgency="neutral"
          items={unplacedResidents.slice(0, DISPLAY_LIMITS.dashboardItems).map((r) => ({
            label: residentName(r),
            sublabel: `${DASHBOARD_LABELS.tileSincePrefix} ${formatDaysAgo(r.createdAt)}`,
            href: `/matching?resident=${r.id}`,
          }))}
          allHref="/matching"
        />
      ),
    ],
    transferRequests: [
      pendingTransfers.length > 0 && (
        <ActionTile
          key="transferRequests"
          title={DASHBOARD_LABELS.tileTransferRequests}
          count={pendingTransfers.length}
          description={DASHBOARD_LABELS.tileTransferRequestsDesc}
          href="/transfer-requests"
          urgency={urgencyForOpenCount(pendingTransfers.length)}
          items={pendingTransfers.slice(0, DISPLAY_LIMITS.dashboardItems).map((t) => ({
            label: residentName({ code: t.residentCode, displayName: t.residentDisplayName }),
            sublabel: `${t.unitCode ? `${t.unitCode} · ` : ''}${DASHBOARD_LABELS.tileSincePrefix} ${t.daysSinceCreated} ${daysWord(t.daysSinceCreated)}`,
            href: '/transfer-requests',
          }))}
          allHref="/transfer-requests"
        />
      ),
    ],
    // Listed, not just counted: Liegenschaften works these one at a time.
    maintenance: [
      openMaintenance.length > 0 && (
        <ActionTile
          key="maintenance"
          title={DASHBOARD_LABELS.tileMaintenanceOpen}
          count={openMaintenance.length}
          description={DASHBOARD_LABELS.tileMaintenanceAction}
          href={`/maintenance/${openMaintenance[0].id}`}
          urgency={urgencyForOpenCount(openMaintenance.length)}
          items={openMaintenance.slice(0, DISPLAY_LIMITS.dashboardItems).map((row) => ({
            label: row.title,
            sublabel: `${row.unitCode} · ${MAINTENANCE_PRIORITY_LABELS[row.priority] ?? row.priority} · ${DASHBOARD_LABELS.tileSincePrefix} ${row.daysOpen} ${daysWord(row.daysOpen)}`,
            href: `/maintenance/${row.id}`,
          }))}
          allHref="/maintenance"
        />
      ),
    ],
    proposals: [
      proposalsAwaitingStaff.length > 0 && (
        <ActionTile
          key="proposals"
          title={DASHBOARD_LABELS.tileProposals}
          count={proposalsAwaitingStaff.length}
          description={DASHBOARD_LABELS.tileProposalsDesc}
          href="/rules"
          urgency={urgencyForOpenCount(proposalsAwaitingStaff.length)}
          items={proposalsAwaitingStaff.slice(0, DISPLAY_LIMITS.dashboardItems).map((p) => ({
            label: p.title,
            sublabel: `${p.unitCode} · ${DASHBOARD_LABELS.tileSincePrefix} ${p.daysWaiting} ${daysWord(p.daysWaiting)}`,
            href: '/rules',
          }))}
          allHref="/rules"
        />
      ),
    ],
  }

  const statRow = sections.map((section) => stats[section]).filter(Boolean)
  const tileRow = sections.flatMap((section) => tiles[section] ?? []).filter(Boolean)

  const waitingSection = waitingApplications.length > 0 && (
    <div>
      <h2 className="text-sm font-semibold text-ui-muted uppercase tracking-wide mb-3">
        {DASHBOARD_LABELS.sectionWaiting}
      </h2>
      <WaitingApplications applications={waitingApplications} canClaim={canClaim} />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header with greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ui-text">{greeting}!</h1>
          <p className="text-ui-muted">
            {state === 'empty'
              ? DASHBOARD_LABELS.emptySummary
              : state === 'unassigned'
                ? DASHBOARD_LABELS.unassignedSummary
                : totalIssues === 0
                  ? DASHBOARD_LABELS.allClearSummary
                  : totalIssues === 1
                    ? DASHBOARD_LABELS.oneTaskWaiting
                    : `${totalIssues} ${DASHBOARD_LABELS.tasksWaitingSuffix}`}
          </p>
        </div>
        <div className="text-right text-sm text-ui-muted">{todayLabel}</div>
      </div>

      {/* Critical Alert Banner - Only shows when there are critical incidents */}
      {criticalIncidents.length > 0 && <CriticalAlertBanner incidents={criticalIncidents} />}

      {/* Exactly ONE summary panel. The hero names the next ACTION, so when
          there is none it yields to the block that carries the numbers. */}
      {state === 'empty' ? (
        <EmptyWorkspaceState viewer={viewer} housingUnitCount={housingUnitCount} />
      ) : state === 'unassigned' ? (
        <UnassignedWorkspaceState />
      ) : state === 'quiet' ? (
        <AllClearState
          freeBeds={show('occupancy') ? freeBeds : null}
          conflictFreeDays={show('incidents') ? conflictFreeDays : null}
          ctaHref={fallbackCta(viewer).href}
          ctaLabel={DASHBOARD_LABELS[fallbackCta(viewer).labelKey]}
        />
      ) : (
        <HeroAction action={primaryAction} />
      )}

      {/* Pulse tiles — one per section the desk lists, in its order. */}
      {statRow.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {statRow}
        </div>
      )}

      {/* People waiting on an answer — what the Eingang badge counts. For a
          viewer who may answer, it is work and comes first. */}
      {canClaim && waitingSection}

      {tileRow.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ui-muted uppercase tracking-wide mb-3">
            {DASHBOARD_LABELS.sectionOpenTasks}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{tileRow}</div>
        </div>
      )}

      {/* Read-only: who asked about a place, below the viewer's own work. */}
      {!canClaim && waitingSection}

      {/* Bald fällig - Proactive section */}
      {dueSoonCheckIns.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ui-muted uppercase tracking-wide mb-3">
            {DASHBOARD_LABELS.sectionDueSoon}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ActionTile
              title={DASHBOARD_LABELS.tileCheckInsThisWeek}
              count={dueSoonCheckIns.length}
              description={DASHBOARD_LABELS.tilePlanProactively}
              href={`/residents/${dueSoonCheckIns[0].residentId}`}
              urgency="neutral"
              items={dueSoonCheckIns.slice(0, DISPLAY_LIMITS.dashboardItems).map((c) => ({
                label: residentName({ code: c.residentCode, displayName: c.residentDisplayName }),
                sublabel:
                  c.daysUntilDue === 0
                    ? `${DASHBOARD_LABELS.dueTodayPrefix} · ${c.unitCode}`
                    : c.daysUntilDue === 1
                      ? `${DASHBOARD_LABELS.dueTomorrowPrefix} · ${c.unitCode}`
                      : `${DASHBOARD_LABELS.dueInPrefix} ${c.daysUntilDue} ${DASHBOARD_LABELS.dueInSuffix} · ${c.unitCode}`,
                href: `/residents/${c.residentId}`,
              }))}
              allHref="/placements?status=active"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ActionDashboard
