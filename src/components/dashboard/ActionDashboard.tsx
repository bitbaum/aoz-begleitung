'use client'

import { Bed, Clock, Check, Wrench, Smile, GraduationCap, CalendarClock, Users } from 'lucide-react'
import { urgencyForGoodStreak, urgencyForOpenCount } from '@/lib/config/urgency'
import { DISPLAY_LIMITS } from '@/lib/config/thresholds'
import {
  sectionVisible,
  fallbackCta,
  workspaceState,
  type DashboardSection,
} from '@/lib/config/dashboard'
import type { StaffCapabilities, StaffRole } from '@/lib/auth/role-policy'
import { VOLUNTEERING_SIGNAL_IDS, type VolunteeringQueueItem } from '@/lib/volunteering/queue'
import { VOLUNTEERING_SIGNAL_COPY } from '@/lib/config/volunteering-signals'
import { JOB_SIGNAL_IDS, type JobQueueItem } from '@/lib/jobcoach/queue'
import { JOB_SIGNAL_COPY } from '@/lib/config/job-integration-docs'
import { INCIDENT_TYPE_LABELS_SHORT, DASHBOARD_LABELS } from '@/lib/constants/labels'
import { daysSinceCeil } from '@/lib/utils'
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

interface ActionDashboardProps {
  /** Gates which sections render — @see lib/config/dashboard.ts */
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
   * Requests residents raised on a listing that nobody has taken up — for
   * every viewer who may answer them. @see lib/inbox/waiting.ts
   */
  waitingApplications: WaitingApplication[]
  /** Client-entered facts awaiting a first look. */
  pendingApprovals: { id: string; name: string; summary: string }[]
  /**
   * The Job domain's own work, one row per (client, signal).
   *
   * Empty for a viewer who does not hold `learning:write` — the page does not
   * even run the query for them. @see lib/jobcoach/queue.ts
   */
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
   * Insurances and permits running out, most urgent first.
   *
   * On the DASHBOARD and not only on /approvals because this is the surface
   * people land on, and a reminder one click away is available rather than
   * delivered. Email is not an option here: STAFF_EMAIL_RECIPIENTS is unset on
   * the live box, so notifyStaff() sends nothing.
   */
  expiringFacts: {
    id: string
    kind: string
    name: string
    label: string
    daysLeft: number
  }[]

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

  // Team health — rendered only under `users:manage`, i.e. Leitung. See
  // DASHBOARD_SECTIONS.team for why this is the section that finally makes
  // Leitung's dashboard differ from Betreuung's.
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
  const days = daysSinceCeil(date)
  if (days === 0) return DASHBOARD_LABELS.today
  if (days === 1) return DASHBOARD_LABELS.yesterday
  return `${days} ${DASHBOARD_LABELS.daysAgo}`
}

// =============================================================================
// Main Component
// =============================================================================

export function ActionDashboard({
  viewer,
  residentCount,
  housingUnitCount,
  assignedResidentCount,
  waitingApplications,
  pendingApprovals,
  jobQueue,
  volunteeringQueue,
  waitingThreads,
  overdueFollowUps,
  expiringFacts,
  occupiedBeds,
  totalBeds,
  totalPlacements,
  overdueCheckIns,
  dueSoonCheckIns,
  unplacedResidents,
  criticalIncidents,
  problemUnits,
  pendingTransfers,
  proposalsAwaitingStaff,
  conflictFreeDays,
  openMaintenanceCount,
  learningInProgressCount,
  learningRecentCompletions,
  upcomingEventsCount,
  activeStaffCount,
  neverSignedInStaffCount,
  greeting,
  todayLabel,
}: ActionDashboardProps) {
  const role = viewer.role
  const show = (section: DashboardSection) => sectionVisible(viewer, section)
  const freeBeds = totalBeds - occupiedBeds
  const onTimeCheckIns = totalPlacements - overdueCheckIns.length

  // Determine primary action
  const primaryAction = determinePrimaryAction({
    jobQueue,
    criticalIncidents,
    overdueCheckIns,
    unplacedResidents,
    freeBeds,
    problemUnits,
    proposalsAwaitingStaff,
    viewer,
  })

  // Count total issues — every queue that waits on a staff answer, not just
  // the placement ones.
  // Every term here used to be a HOUSING queue — check-ins, placements,
  // transfers, governance. A Jobcoach holds none of those permissions, so
  // their count was structurally zero and the dashboard congratulated them on
  // a day with real work in it. Observed in production 2026-09-02 with a
  // client assigned the same morning. @see lib/jobcoach/queue.ts
  /**
   * Where a row goes when you click it.
   *
   * A row about ONE thread opens that thread. "Interesse wartet auf Antwort"
   * is the first signal in both domains' priority lists, so it is what the
   * hero renders — and it used to land on the dossier, from which the coach
   * scrolled to the threads card, opened the listing, and looked for the
   * person among its applicants. Three navigations for the one action the
   * queue exists to prompt, once per waiting client.
   *
   * Rows about the PERSON rather than a placement still open the dossier:
   * "nobody has arranged anything yet" has no thread to open, and inventing a
   * destination for it would be worse than the extra click.
   */
  const rowHref = (row: { residentId: string; opportunityId: string | null }) =>
    row.opportunityId ? `/opportunities/${row.opportunityId}` : `/residents/${row.residentId}`

  // A request nobody has answered is listed ONCE, in the applications section
  // with its own "Übernehmen" button. The caseload tiles carry the same signal
  // for the specialist's own clients, so a row the section already shows is
  // dropped from them — by (person, listing), not by signal: a coordinator's
  // client who asked about a JOB is outside that section and must stay visible
  // in the caseload tile, or it would be on no screen of theirs at all.
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
      // The rows are threads on listings, so "alle" opens the listings board —
      // it used to open /learning, a page of certificates, from a tile about
      // people waiting on a place.
      allHref: '/opportunities?board=job',
    })),
    ...VOLUNTEERING_SIGNAL_IDS.map((signal) => ({
      key: `volunteering:${signal}`,
      copy: VOLUNTEERING_SIGNAL_COPY[signal],
      rows: volunteeringQueue.filter((row) => row.signal === signal && notListedAbove(row)),
      allHref: '/opportunities?board=volunteering',
    })),
  ].filter((tile) => tile.rows.length > 0)

  const totalIssues =
    waitingApplications.length +
    pendingApprovals.length +
    criticalIncidents.length +
    overdueCheckIns.length +
    unplacedResidents.length +
    pendingTransfers.length +
    proposalsAwaitingStaff.length +
    // Somebody asked a question and is still waiting. Counted like any other
    // open task, because that is what it is.
    waitingThreads.length +
    // A review date that has passed is the ladder failing quietly: the whole
    // mechanism is somebody coming back on the day they said they would.
    overdueFollowUps.length +
    // An insurance about to lapse is work whether or not anyone has filed it
    // as such. Counted, so a day with one is not a quiet day.
    expiringFacts.length +
    // The Freiwilligenarbeit coordinator's rows count exactly as the Jobcoach's do. While they did not, that dashboard
    // dashboard could only ever resolve to `quiet` — every term above needs a
    // permission the role does not hold, and its caseload was never fetched.
    careTiles.reduce((sum, tile) => sum + tile.rows.length, 0)

  // "Nothing to do" and "nothing entered yet" are different facts and get
  // different screens. @see lib/config/dashboard.ts
  const state = workspaceState({
    residentCount,
    openTaskCount: totalIssues + problemUnits.length,
    assignedResidentCount,
  })

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

      {/* Exactly ONE summary panel. All three used to render together on a
          quiet day: the hero ("Alles erledigt!"), the all-clear block
          ("Alles unter Kontrolle!") and the greeting line — three sentences
          and two identical buttons for one fact. The hero names the next
          ACTION, so when there is none it has nothing to say and yields to
          the block that carries the actual numbers. */}
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

      {/* Quick Stats Row — one pulse tile per pillar the role works in.
          Which tiles exist is the config's decision, not this component's. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {show('occupancy') && (
          <QuickStat
            label={DASHBOARD_LABELS.statFreeBeds}
            value={freeBeds}
            total={totalBeds}
            href="/housing?status=AVAILABLE"
            urgency="neutral"
            icon={<Bed className="w-5 h-5" />}
            subtext={`${occupiedBeds}/${totalBeds} ${DASHBOARD_LABELS.occupancyOccupied}`}
          />
        )}
        {show('checkIns') && (
          <QuickStat
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
        )}
        {show('incidents') && (
          <QuickStat
            label={DASHBOARD_LABELS.statHarmony}
            value={conflictFreeDays}
            suffix={` ${daysWord(conflictFreeDays)}`}
            href="/incidents"
            urgency={urgencyForGoodStreak(conflictFreeDays)}
            icon={<Smile className="w-5 h-5" />}
            subtext={DASHBOARD_LABELS.statNoConflicts}
          />
        )}
        {show('maintenance') && (
          <QuickStat
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
        )}
        {show('learning') && (
          <QuickStat
            label={DASHBOARD_LABELS.statLearning}
            value={learningInProgressCount}
            suffix={` ${DASHBOARD_LABELS.statRunningSuffix}`}
            href="/learning"
            urgency="neutral"
            icon={<GraduationCap className="w-5 h-5" />}
            subtext={DASHBOARD_LABELS.statLearningCompletions(learningRecentCompletions)}
          />
        )}
        {show('events') && (
          <QuickStat
            label={DASHBOARD_LABELS.statEvents}
            value={upcomingEventsCount}
            suffix={` ${DASHBOARD_LABELS.statPlannedSuffix}`}
            href="/events"
            urgency="neutral"
            icon={<CalendarClock className="w-5 h-5" />}
          />
        )}
        {show('team') && (
          <QuickStat
            label={DASHBOARD_LABELS.statTeam}
            value={activeStaffCount}
            suffix={` ${DASHBOARD_LABELS.statTeamSuffix}`}
            href="/settings"
            // `attention` only when something is actually loose. A team with
            // every account in use is not a warning, and a permanently amber
            // tile is one nobody reads.
            urgency={neverSignedInStaffCount > 0 ? 'attention' : 'neutral'}
            icon={<Users className="w-5 h-5" />}
            subtext={
              neverSignedInStaffCount > 0
                ? DASHBOARD_LABELS.statTeamNeverSignedIn(neverSignedInStaffCount)
                : undefined
            }
          />
        )}
      </div>

      {/* People waiting on an answer — what the Eingang badge counts, so the
          number in the navigation and the rows here are the same set. */}
      {waitingApplications.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ui-muted uppercase tracking-wide mb-3">
            {DASHBOARD_LABELS.sectionWaiting}
          </h2>
          <WaitingApplications applications={waitingApplications} />
        </div>
      )}

      {/* Action Tiles - Only show what needs action */}
      {(totalIssues > 0 || problemUnits.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-ui-muted uppercase tracking-wide mb-3">
            {DASHBOARD_LABELS.sectionOpenTasks}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overdueCheckIns.length > 0 && (
              <ActionTile
                title={DASHBOARD_LABELS.tileCheckIns}
                count={overdueCheckIns.length}
                description={`${overdueCheckIns[0] ? residentName({ code: overdueCheckIns[0].residentCode, displayName: overdueCheckIns[0].residentDisplayName }) : ''} ${DASHBOARD_LABELS.tileWaitingLongestSuffix}`}
                href={`/residents/${overdueCheckIns[0]?.residentId}`}
                urgency={urgencyForOpenCount(overdueCheckIns.length)}
                items={overdueCheckIns.slice(0, DISPLAY_LIMITS.dashboardItems).map((c) => ({
                  label: residentName({ code: c.residentCode, displayName: c.residentDisplayName }),
                  sublabel: `${c.daysSinceLastCheckIn} ${daysWord(c.daysSinceLastCheckIn)} · ${c.unitCode}`,
                  href: `/residents/${c.residentId}`,
                }))}
                allHref="/placements?status=active&overdue=1"
              />
            )}

            {/* The integration domains' work, one tile per signal. Named
                clients, not a bare count: the screen this replaces reported
                "keine dringenden Aufgaben" to a coach whose client was created
                that morning, and never mentioned that client — and said the same thing
                to a colleague for three days longer, whose caseload was
                not even queried. */}
            {overdueFollowUps.length > 0 && (
              <ActionTile
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
            )}

            {/* An insurance or permit running out. This is the tile that
                answers the complaint the whole feature came from: extending an
                insurance every six months meant writing to your Betreuerin,
                because nothing in the product knew the date. Now it does, and
                it says so where they already look. */}
            {expiringFacts.length > 0 && (
              <ActionTile
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
            )}

            {pendingApprovals.length > 0 && (
              <ActionTile
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
            )}

            {/* Somebody asked and is still waiting. The product has always
                known this — `staffInbox()` computes `waitingSince` and sorts
                oldest-first on every load — and only the inbox page read it,
                so Betreuung had to open /messages speculatively to find out. */}
            {waitingThreads.length > 0 && (
              <ActionTile
                title={DASHBOARD_LABELS.tileMessagesWaiting}
                count={waitingThreads.length}
                description={`${waitingThreads[0].name} ${DASHBOARD_LABELS.tileWaitingLongestSuffix}`}
                href={`/messages/${waitingThreads[0].residentId}`}
                urgency={urgencyForOpenCount(waitingThreads.length)}
                items={waitingThreads.slice(0, DISPLAY_LIMITS.dashboardItems).map((thread) => ({
                  label: thread.name,
                  sublabel: DASHBOARD_LABELS.tileWaitingSinceDays(
                    daysSinceCeil(thread.waitingSince),
                  ),
                  href: `/messages/${thread.residentId}`,
                }))}
                allHref="/messages"
              />
            )}

            {careTiles.map((tile) => (
              <ActionTile
                key={tile.key}
                title={tile.copy.title}
                count={tile.rows.length}
                description={tile.copy.action}
                href={rowHref(tile.rows[0])}
                urgency={urgencyForOpenCount(tile.rows.length)}
                items={tile.rows.slice(0, DISPLAY_LIMITS.dashboardItems).map((row) => ({
                  label: row.name,
                  // The signal is already the tile's title, so the sublabel
                  // carries the move rather than repeating it.
                  sublabel: tile.copy.action,
                  href: rowHref(row),
                }))}
                allHref={tile.allHref}
              />
            ))}

            {unplacedResidents.length > 0 && (
              <ActionTile
                title={DASHBOARD_LABELS.tilePlaceResidents}
                count={unplacedResidents.length}
                description={`${unplacedResidents[0] ? residentName(unplacedResidents[0]) : ''} ${DASHBOARD_LABELS.tileWaitingLongestSuffix}`}
                href="/matching"
                urgency="neutral"
                items={unplacedResidents.slice(0, DISPLAY_LIMITS.dashboardItems).map((r) => ({
                  label: residentName(r),
                  sublabel: `${DASHBOARD_LABELS.tileSincePrefix} ${formatDaysAgo(r.createdAt)}`,
                  href: `/matching?resident=${r.id}`,
                }))}
                allHref="/matching"
              />
            )}

            {pendingTransfers.length > 0 && (
              <ActionTile
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
            )}

            {proposalsAwaitingStaff.length > 0 && (
              <ActionTile
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
            )}

            {problemUnits.length > 0 && (
              <ActionTile
                title={DASHBOARD_LABELS.tileConflictUnits}
                count={problemUnits.length}
                description={DASHBOARD_LABELS.tileConflictUnitsDesc}
                href={`/housing/${problemUnits[0]?.id}`}
                urgency="critical"
                items={problemUnits.slice(0, DISPLAY_LIMITS.dashboardItems).map((u) => ({
                  label: u.code,
                  sublabel: `${u.incidentCount} ${DASHBOARD_LABELS.tileIncidents} · ${INCIDENT_TYPE_LABELS_SHORT[u.primaryIssue] || u.primaryIssue}`,
                  href: `/housing/${u.id}`,
                }))}
                allHref="/incidents"
              />
            )}
          </div>
        </div>
      )}

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
              href={`/residents/${dueSoonCheckIns[0]?.residentId}`}
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
