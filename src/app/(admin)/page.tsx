import { IN_CARE_RESIDENT_STATUSES } from '@/lib/config/resident-status'
import type { Metadata } from 'next'
import {
  db,
  resident,
  housingUnit,
  placement,
  incident,
  maintenanceRequest,
  transferRequest,
  learningRecord,
  houseEvent,
  user as userTable,
  careAssignment,
  satisfactionCheckIn,
} from '@/lib/db'
import { eq, and, gte, inArray, isNull, desc, asc } from 'drizzle-orm'
import { daysSinceCeil, getDateDaysAgo } from '@/lib/utils'

export const metadata: Metadata = { title: DASHBOARD_LABELS.pageTitle }
import { ActionDashboard } from '@/components/dashboard/ActionDashboard'
import { DASHBOARD_LABELS } from '@/lib/constants/labels'
import { dayPartAt, formatWeekdayDate, type DayPart } from '@/lib/utils/local-time'
import { getCurrentUser } from '@/lib/auth'

/** Which greeting belongs to which part of the day. */
const GREETING_BY_DAY_PART: Record<DayPart, 'greetingMorning' | 'greetingDay' | 'greetingEvening'> =
  {
    morning: 'greetingMorning',
    day: 'greetingDay',
    evening: 'greetingEvening',
  }
import { buildJobQueue } from '@/lib/jobcoach/queue'
import { buildVolunteeringQueue } from '@/lib/volunteering/queue'
import { staffInbox } from '@/lib/messaging/queries'
import { getIncidentsNeedingFollowUp } from '@/lib/actions/incidents'
import { STAFF_ROLE_CARE_DOMAIN, roleHasCaseload } from '@/lib/config/care'
import { hasPermission } from '@/lib/auth/role-policy'
import { mayReadFact } from '@/lib/client-facts/policy'
import { expiringFacts } from '@/lib/client-facts/renewals'
import { EMPTY_DEMO_SCOPE, isRealRow, loadDemoScope } from '@/lib/analytics/real-data'
import { RESIDENT_NAME_SELECT, residentName } from '@/lib/utils/resident-name'
import { getCheckInInterval, VERY_OVERDUE_THRESHOLD_DAYS } from '@/lib/config/checkin-intervals'
import {
  PROBLEM_DETECTION,
  INCIDENT_SEVERITY_WEIGHTS,
  DISPLAY_LIMITS,
} from '@/lib/config/thresholds'
import { sectionVisible, type DashboardSection } from '@/lib/config/dashboard'
import { placeableBeds } from '@/lib/config/capacity'
import { LEARNING_PULSE_WINDOW_DAYS } from '@/lib/config/learning'
import { getProposalsAwaitingStaff } from '@/lib/governance/queries'
import { waitingApplications } from '@/lib/inbox/waiting'
import { pendingFactQueue } from '@/lib/client-facts/queue'
import { ownSeat } from '@/lib/client-facts/access'
import {
  NARROWEST_CAPABILITIES,
  type StaffCapabilities,
  type StaffRole,
} from '@/lib/auth/role-policy'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const now = new Date()
  const user = await getCurrentUser()

  // Middleware guards this route, so `user` is only null in the moment between
  // session expiry and the redirect that replaces this render. It used to
  // default to ADMIN there — showing EVERYTHING to a session that had just
  // ended. The narrowest subject is the safe direction to be wrong in.
  const viewer: StaffCapabilities = user ?? NARROWEST_CAPABILITIES
  const role: StaffRole = viewer.role
  const show = (section: DashboardSection) => sectionVisible(viewer, section)

  // Which care seat this person works. Derived from the role — the bijection is
  // already SSOT in config/care.ts and must never be restated as a literal.
  const viewerSeat = STAFF_ROLE_CARE_DOMAIN[viewer.role]

  // Fetch only what this role's dashboard renders (config/dashboard.ts is
  // the SSOT for that mapping) — a Jobcoach's dashboard runs the learning
  // queries and none of the housing ones.
  const [
    // How many people and units EXIST — not how many need something. The
    // dashboard cannot otherwise tell an empty workspace from a finished one,
    // and reports a database nobody has filled in as "Alles erledigt".
    //
    // Deliberately NOT derived from the `residents` list below: that one is
    // gated on placements:write, so a Jobcoach would see zero residents and
    // be told the workspace is empty while 24 people sit in it. Every staff
    // role holds residents:read, so this count is safe for all of them.
    residentCount,
    housingUnitCount,
    residents,
    units,
    // Occupancy is derived from placements, but the free-beds stat must stay
    // correct for roles that read housing WITHOUT reading placements
    // (Sozialarbeit) — so the aggregate count is its own query, gated with
    // the occupancy section rather than the check-in list.
    occupiedBeds,
    placements,
    recentIncidents,
    openMaintenanceCount,
    pendingTransfersRaw,
    proposalsRaw,
    learningRecordsRaw,
    myCaseloadResidentIds,
    demoScope,
    upcomingEventsCount,
    inboxThreads,
    followUpTriage,
    activeStaffCount,
    neverSignedInStaffCount,
    assignedResidentCount,
    jobCaseload,
    applicationsWaiting,
    approvalsPending,
  ] = await Promise.all([
    db.$count(resident),
    // Only used to pick the first setup step, which requires housing:write —
    // a subset of the housing:read this section is gated on.
    show('occupancy') ? db.$count(housingUnit) : 0,
    show('matching')
      ? db.query.resident.findMany({
          where: inArray(resident.status, [...IN_CARE_RESIDENT_STATUSES]),
          columns: { ...RESIDENT_NAME_SELECT, status: true, createdAt: true },
        })
      : [],
    show('occupancy')
      ? db.query.housingUnit.findMany({
          columns: { totalBeds: true, status: true },
        })
      : [],
    show('occupancy') ? db.$count(placement, eq(placement.status, 'ACTIVE')) : 0,
    show('checkIns')
      ? db.query.placement.findMany({
          where: eq(placement.status, 'ACTIVE'),
          columns: {
            id: true,
            startDate: true,
          },
          with: {
            resident: {
              columns: { ...RESIDENT_NAME_SELECT, supportLevel: true },
            },
            housingUnit: {
              columns: { code: true },
            },
            checkIns: {
              orderBy: [desc(satisfactionCheckIn.createdAt)],
              limit: 1,
              columns: { createdAt: true },
            },
          },
        })
      : [],
    show('incidents')
      ? db.query.incident.findMany({
          where: gte(incident.date, getDateDaysAgo(PROBLEM_DETECTION.recentIncidentsDays)),
          columns: {
            id: true,
            type: true,
            category: true,
            severity: true,
            date: true,
            resolvedAt: true,
            housingUnitId: true,
          },
          with: {
            housingUnit: { columns: { code: true } },
          },
          orderBy: [desc(incident.date)],
        })
      : [],
    show('maintenance')
      ? db.$count(
          maintenanceRequest,
          inArray(maintenanceRequest.status, ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD']),
        )
      : 0,
    show('transferRequests')
      ? db.query.transferRequest.findMany({
          where: eq(transferRequest.status, 'PENDING'),
          columns: {
            id: true,
            createdAt: true,
          },
          with: {
            resident: { columns: RESIDENT_NAME_SELECT },
            currentPlacement: {
              columns: {},
              with: { housingUnit: { columns: { code: true } } },
            },
          },
          orderBy: [asc(transferRequest.createdAt)],
        })
      : [],
    show('proposals') ? getProposalsAwaitingStaff() : [],
    // Counted in JS rather than by two $count queries, because both numbers now
    // have to be narrowed twice — past the demo world, and (for a specialist)
    // down to their own caseload. Expressing that as SQL would mean an
    // `inArray` over an id list that is empty on a fresh instance, which is a
    // different query rather than a narrower one. The volume is a few dozen
    // rows; the clarity is worth more than the round trip.
    show('learning')
      ? db.query.learningRecord.findMany({
          columns: { status: true, completedAt: true, residentId: true },
        })
      : [],
    // "My clients" across every seat this person holds — not just JOB, because
    // a Freiwilligenarbeit coordinator's learning entries are hers too.
    show('learning') && user
      ? db.query.careAssignment.findMany({
          where: eq(careAssignment.staffId, user.id),
          columns: { residentId: true },
        })
      : [],
    show('learning') ? loadDemoScope() : EMPTY_DEMO_SCOPE,
    show('events')
      ? db.$count(
          houseEvent,
          and(eq(houseEvent.status, 'PUBLISHED'), gte(houseEvent.startsAt, now)),
        )
      : 0,
    // Who is waiting for an answer. `staffInbox()` already sorts oldest-wait
    // first and carries `waitingSince`; the dashboard simply reads what the
    // inbox page has always had to itself.
    show('messages') ? staffInbox() : [],
    // Follow-ups the caseworker scheduled that have since passed.
    //
    // `getIncidentsNeedingFollowUp()` has always done this triage — overdue,
    // due today/tomorrow, urgent — with unit and subject on every row, and it
    // was rendered by NOTHING. Only the nightly email read
    // `nextFollowUpDate`. The conflict ladder's review dates are what make "a
    // broken agreement escalates" true, and from inside the product nobody
    // could see which ones had slipped.
    //
    // Gated with the rest of conflict OPERATIONS (`incidents:write`), not with
    // read-only sight of a conflict: a coach who may see that their client's
    // household is in trouble should not be handed the ladder's work queue.
    show('incidents')
      ? getIncidentsNeedingFollowUp()
      : Promise.resolve({ overdue: [], dueSoon: [], urgent: [] }),
    show('team') ? db.$count(userTable, eq(userTable.active, true)) : 0,
    // Provisioned and never used. A staff code that was issued but never
    // signed in with is invisible everywhere else in the product — it is not
    // an error, it is an unfinished handover, and only Leitung can close it.
    show('team')
      ? db.$count(userTable, and(eq(userTable.active, true), isNull(userTable.lastLoginAt)))
      : 0,
    // How many clients sit in THIS person's care seat.
    //
    // null for a viewer whose reach is every domain: they have no single seat
    // that can be empty, so "nobody is assigned to you" is not a fact about
    // them. For a specialist it is the difference between a quiet day and an
    // account nobody has connected to a client yet — the global count above
    // cannot tell those apart, and reported the second as the first.
    //
    // Also null for a role that carries no caseload AT ALL. Counting the Liegenschaften lead's
    // care assignments returns 0 like the Freiwilligenarbeit coordinator's, and the two zeros mean opposite
    // things: she is waiting to be assigned, he runs the buildings and never
    // will be. Asked of the ROLE rather than inferred from the count, because
    // a count cannot tell them apart. @see config/care.ts
    viewer.scope === 'ALL_DOMAINS' || !roleHasCaseload(viewer.role) || !user
      ? null
      : db.$count(careAssignment, eq(careAssignment.staffId, user.id)),

    // The specialist's own caseload, with what they'd need to know about it.
    //
    // Scoped to THEIR seat rather than to every client: a coach's queue is the
    // people they hold, and a product-wide list would recreate the aggregate
    // that told them nothing. Only fetched for a viewer whose work this is —
    // `learning:write` is the integration domains' verb.
    //
    // The seat is DERIVED from the viewer's role. It was the literal `'JOB'`,
    // which meant the Freiwilligenarbeit coordinator's caseload was never fetched at all: her seats are
    // `VOLUNTEERING`, so the query returned nothing and her dashboard resolved
    // to "Alles unter Kontrolle" every morning. The fix written for the Jobcoach on
    // 2026-09-02 had been applied to the instance, not the class.
    show('learning') && user && viewerSeat
      ? db.query.careAssignment.findMany({
          where: and(eq(careAssignment.staffId, user.id), eq(careAssignment.role, viewerSeat)),
          columns: {},
          with: {
            resident: {
              // RESIDENT_NAME_SELECT already carries `id`, `code` and
              // `displayName`; naming `id` again would be redundant, not wrong.
              columns: { ...RESIDENT_NAME_SELECT, createdAt: true },
              with: {
                learningRecords: { columns: { kind: true, status: true, updatedAt: true } },
                // `createdBy` and `supportedByUserId` are what separate contact
                // from a request for one. @see lib/jobcoach/queue.ts
                opportunityApplications: {
                  // `opportunityId` is what lets the queue row link at the
                  // thread instead of the dossier.
                  columns: {
                    opportunityId: true,
                    stage: true,
                    createdBy: true,
                    supportedByUserId: true,
                  },
                },
              },
            },
          },
        })
      : [],
    // Every request a resident raised that nobody has taken up, for everyone
    // who may answer it — not only the holder of that resident's seat.
    // @see lib/inbox/waiting.ts
    show('applications') ? waitingApplications(viewer) : [],
    show('approvals') && user
      ? pendingFactQueue({ userId: user.id, scope: viewer.scope, ownDomain: ownSeat(viewer.role) })
      : [],
  ])

  // =============================================================================
  // Calculate Core Stats
  // =============================================================================

  // The Job domain's own work queue. Derived here so the dashboard receives
  // rows rather than raw records — the rule for what counts lives in
  // lib/jobcoach/queue.ts, next to the evidence that justifies each signal.
  /**
   * Threads where a Klient*in is waiting, longest first.
   *
   * `staffInbox()` sorts that way already and puts waiting threads ahead of
   * quiet ones, so the first entry IS the person who has waited longest —
   * which is what the tile leads with.
   */
  const waitingThreads = inboxThreads
    .filter((thread) => thread.unreadCount > 0 && thread.waitingSince)
    .map((thread) => ({
      residentId: thread.resident.id,
      name: residentName(thread.resident),
      waitingSince: thread.waitingSince as Date,
    }))

  /**
   * Follow-ups whose review date has passed and whose incident is still open.
   *
   * Only the overdue ones reach the dashboard. "Due tomorrow" is not yet a
   * failure and would crowd out the ones that already slipped — the triage
   * still computes it, and /incidents is where you go to look ahead.
   */
  const overdueFollowUps = followUpTriage.overdue.map((row) => ({
    id: row.id,
    subject: row.subject ? residentName(row.subject) : null,
    unitCode: row.housingUnit?.code ?? null,
    daysOverdue: row.nextFollowUpDate ? daysSinceCeil(row.nextFollowUpDate) : 0,
  }))

  /**
   * Insurances and permits running out — the tile this whole feature exists
   * for. Filtered by the SAME per-kind rule the approvals queue uses, so a
   * Jobcoach sees permits and never an insurance, and somebody without
   * `clientFacts:read` sees none of it at all.
   */
  const expiringRenewals = hasPermission(viewer, 'clientFacts:read')
    ? (await expiringFacts(new Date()))
        .filter((fact) =>
          mayReadFact(fact.kind, {
            scope: viewer.scope,
            seatsForClient: viewerSeat ? [viewerSeat] : [],
          }),
        )
        .map((fact) => ({
          id: fact.id,
          kind: fact.kind,
          name: residentName(fact.resident),
          label: fact.label,
          daysLeft: fact.daysLeft,
        }))
    : []

  const caseloadClients = jobCaseload.map(({ resident }) => ({
    residentId: resident.id,
    name: residentName(resident),
    createdAt: resident.createdAt,
    learningRecords: resident.learningRecords,
    applications: resident.opportunityApplications,
  }))

  // One caseload, the signals of whichever domain the viewer works. The Freiwilligenarbeit coordinator's
  // questions are not the Jobcoach's — "has anyone answered them, and is anyone doing
  // anything with other people" rather than "have they reached the labour
  // market" — so the rows differ even though the fetch is identical.
  const jobQueue = viewerSeat === 'JOB' ? buildJobQueue(caseloadClients, now) : []
  const volunteeringQueue =
    viewerSeat === 'VOLUNTEERING' ? buildVolunteeringQueue(caseloadClients, now) : []

  // The learning tile, narrowed to what it claims to be about.
  //
  // It used to be two global counts. On the Jobcoach's dashboard that read "23 laufend
  // · 7 Abschlüsse in 30 Tagen" while `/learning` — the page the tile links to,
  // which defaults to "Meine Klient*innen" — showed him TOTAL 0. Neither number
  // was wrong; they answered different questions, and only one of them was the
  // question a coach is asking on his own dashboard.
  //
  // Two narrowings, in this order:
  //  - demo rows never count, the same rule the mission KPIs now follow;
  //  - a SPECIALIST sees their own caseload, because that is their work. A
  //    viewer with reach over every domain has no single seat, so the honest
  //    denominator for them is the whole real population — the same distinction
  //    `assignedResidentCount` above already draws.
  const myResidentIds = new Set(myCaseloadResidentIds.map((row) => row.residentId))
  const learningRecords = learningRecordsRaw
    .filter((row) => isRealRow(row, demoScope))
    .filter((row) => viewer.scope === 'ALL_DOMAINS' || myResidentIds.has(row.residentId))

  const learningInProgressCount = learningRecords.filter(
    (row) => row.status === 'IN_PROGRESS',
  ).length
  const learningPulseSince = getDateDaysAgo(LEARNING_PULSE_WINDOW_DAYS)
  const learningRecentCompletions = learningRecords.filter(
    (row) =>
      row.status === 'COMPLETED' &&
      row.completedAt !== null &&
      row.completedAt >= learningPulseSince,
  ).length

  // Placeable beds only. A CLOSED unit's beds are not headroom, and free beds
  // is derived from this. @see lib/config/capacity.ts
  const totalBeds = placeableBeds(units)

  // =============================================================================
  // Overdue Check-ins (using config intervals)
  // =============================================================================

  // Calculate check-in status for all placements
  const checkInStatuses = placements.map((p) => {
    const supportLevel = p.resident.supportLevel || 'STANDARD'
    const intervalDays = getCheckInInterval(supportLevel)
    const lastCheckIn = p.checkIns?.[0]
    const daysSinceCheckIn = lastCheckIn
      ? daysSinceCeil(lastCheckIn.createdAt, now)
      : daysSinceCeil(p.startDate, now)

    const daysUntilDue = intervalDays - daysSinceCheckIn
    const isOverdue = daysSinceCheckIn > intervalDays
    const isVeryOverdue = daysSinceCheckIn > intervalDays + VERY_OVERDUE_THRESHOLD_DAYS
    const isDueSoon = !isOverdue && daysUntilDue <= 7 && daysUntilDue >= 0

    return {
      id: p.id,
      residentCode: p.resident.code,
      residentDisplayName: p.resident.displayName,
      residentId: p.resident.id,
      unitCode: p.housingUnit.code,
      daysSinceLastCheckIn: daysSinceCheckIn,
      daysUntilDue,
      supportLevel,
      isOverdue,
      isVeryOverdue,
      isDueSoon,
    }
  })

  const overdueCheckIns = checkInStatuses
    .filter((p) => p.isOverdue)
    .sort((a, b) => b.daysSinceLastCheckIn - a.daysSinceLastCheckIn)

  const dueSoonCheckIns = checkInStatuses
    .filter((p) => p.isDueSoon)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)

  const totalPlacements = placements.length

  // =============================================================================
  // Unplaced Residents
  // =============================================================================

  const unplacedResidents = residents
    .filter((r) => r.status === 'ACTIVE')
    .map((r) => ({
      id: r.id,
      code: r.code,
      displayName: r.displayName,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  // =============================================================================
  // Critical Incidents (Unresolved)
  // =============================================================================

  const criticalIncidents = recentIncidents
    .filter((i) => i.severity === 'CRITICAL' && !i.resolvedAt)
    .map((i) => ({
      id: i.id,
      type: i.type,
      unitCode: i.housingUnit?.code || 'Unbekannt',
      unitId: i.housingUnitId,
      daysSinceCreated: daysSinceCeil(i.date, now),
    }))

  // =============================================================================
  // Conflict-free Days (Interpersonal incidents only)
  // =============================================================================

  const interpersonalIncidents = recentIncidents.filter((i) => i.category === 'INTERPERSONAL')
  let conflictFreeDays: number = PROBLEM_DETECTION.recentIncidentsDays

  if (interpersonalIncidents.length > 0) {
    const mostRecent = interpersonalIncidents[0] // already sorted by date desc
    conflictFreeDays = daysSinceCeil(mostRecent.date, now)
  }

  // =============================================================================
  // Problem Units - EVIDENCE-BASED (actual incidents, not theoretical compatibility)
  // =============================================================================

  // Group incidents by unit and calculate problem score
  // Element-level type: `typeof recentIncidents` is now a union with the
  // empty-array branch of the role-gated fetch, and pushing into a union of
  // arrays collapses to never.
  const unitIncidentMap = new Map<
    string,
    {
      code: string
      incidentCount: number
      problemScore: number
      recentIncidents: (typeof recentIncidents)[number][]
      unresolvedCount: number
    }
  >()

  for (const incident of interpersonalIncidents) {
    const unitId = incident.housingUnitId
    const existing = unitIncidentMap.get(unitId) || {
      code: incident.housingUnit?.code || 'Unbekannt',
      incidentCount: 0,
      problemScore: 0,
      recentIncidents: [],
      unresolvedCount: 0,
    }

    existing.incidentCount++
    existing.problemScore +=
      INCIDENT_SEVERITY_WEIGHTS[incident.severity as keyof typeof INCIDENT_SEVERITY_WEIGHTS] || 1
    existing.recentIncidents.push(incident)
    if (!incident.resolvedAt) {
      existing.unresolvedCount++
    }

    unitIncidentMap.set(unitId, existing)
  }

  // Only flag units with sufficient incidents
  const problemUnits = Array.from(unitIncidentMap.entries())
    .filter(([, data]) => data.incidentCount >= PROBLEM_DETECTION.minIncidentsToFlag)
    .map(([id, data]) => ({
      id,
      code: data.code,
      incidentCount: data.incidentCount,
      problemScore: data.problemScore,
      unresolvedCount: data.unresolvedCount,
      // Show most common incident type
      primaryIssue: getMostCommonIncidentType(data.recentIncidents),
    }))
    .sort((a, b) => b.problemScore - a.problemScore)
    .slice(0, DISPLAY_LIMITS.problemUnits)

  // =============================================================================
  // Cross-pillar queues (transfers, governance)
  // =============================================================================

  const pendingTransfers = pendingTransfersRaw.map((t) => ({
    id: t.id,
    residentCode: t.resident.code,
    residentDisplayName: t.resident.displayName,
    unitCode: t.currentPlacement?.housingUnit.code ?? null,
    daysSinceCreated: daysSinceCeil(t.createdAt, now),
  }))

  const proposalsAwaitingStaff = proposalsRaw.map((p) => ({
    id: p.id,
    title: p.title,
    unitCode: p.housingUnit.code,
    daysWaiting: daysSinceCeil(p.decidedAt ?? p.updatedAt, now),
  }))

  return (
    <ActionDashboard
      viewer={viewer}
      residentCount={residentCount}
      housingUnitCount={housingUnitCount}
      assignedResidentCount={assignedResidentCount}
      waitingApplications={applicationsWaiting}
      pendingApprovals={approvalsPending.map((item) => ({
        id: item.id,
        name: residentName(item.resident),
        summary: item.summary,
      }))}
      jobQueue={jobQueue}
      volunteeringQueue={volunteeringQueue}
      waitingThreads={waitingThreads}
      overdueFollowUps={overdueFollowUps}
      expiringFacts={expiringRenewals}
      occupiedBeds={occupiedBeds}
      totalBeds={totalBeds}
      totalPlacements={totalPlacements}
      overdueCheckIns={overdueCheckIns}
      dueSoonCheckIns={dueSoonCheckIns}
      unplacedResidents={unplacedResidents}
      criticalIncidents={criticalIncidents}
      problemUnits={problemUnits}
      pendingTransfers={pendingTransfers}
      proposalsAwaitingStaff={proposalsAwaitingStaff}
      conflictFreeDays={conflictFreeDays}
      openMaintenanceCount={openMaintenanceCount}
      learningInProgressCount={learningInProgressCount}
      learningRecentCompletions={learningRecentCompletions}
      upcomingEventsCount={upcomingEventsCount}
      activeStaffCount={activeStaffCount}
      neverSignedInStaffCount={neverSignedInStaffCount}
      greeting={buildGreeting(DASHBOARD_LABELS[GREETING_BY_DAY_PART[dayPartAt(now)]], user)}
      todayLabel={formatWeekdayDate(now)}
    />
  )
}

function buildGreeting(greeting: string, user: Awaited<ReturnType<typeof getCurrentUser>>): string {
  if (!user) return greeting

  const raw = user.name?.trim() || user.email?.split('@')[0]?.trim() || ''
  if (!raw) return greeting

  const cleaned = raw.replace(/[_-]+/g, ' ')
  if (/^admin$/i.test(cleaned)) return greeting

  const firstToken = cleaned.split(/\s+/)[0]
  const pretty = firstToken.charAt(0).toUpperCase() + firstToken.slice(1)

  return `${greeting}, ${pretty}`
}

/**
 * Get the most common incident type from a list of incidents
 */
function getMostCommonIncidentType(incidents: { type: string }[]): string {
  const typeCounts = new Map<string, number>()
  for (const i of incidents) {
    typeCounts.set(i.type, (typeCounts.get(i.type) || 0) + 1)
  }

  let maxType = ''
  let maxCount = 0
  typeCounts.forEach((count, type) => {
    if (count > maxCount) {
      maxType = type
      maxCount = count
    }
  })

  return maxType
}
