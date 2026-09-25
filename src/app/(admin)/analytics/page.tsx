import type { Metadata } from 'next'
import { db, resident, housingUnit, placement, incident, satisfactionCheckIn } from '@/lib/db'
import { eq, ne, and, inArray, gte, desc } from 'drizzle-orm'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Statistiken' }
import {
  INCIDENT_TYPE_LABELS,
  END_REASON_LABELS,
  DASHBOARD_LABELS,
  PAGE_TITLES,
  FORM_LABELS,
  getLabel,
} from '@/lib/constants'
import { daysSinceCeil, getDateDaysAgo } from '@/lib/utils'
import { getCheckInInterval } from '@/lib/config/checkin-intervals'
import { DISPLAY_LIMITS } from '@/lib/config/thresholds'
import { PeriodSelector } from '@/components/ui/PeriodSelector'
import { SatisfactionChart } from '@/components/analytics/SatisfactionChart'
import { ConflictAnalysisSection } from '@/components/analytics/ConflictAnalysisSection'
import { RecentPlacementsTable } from '@/components/analytics/RecentPlacementsTable'
import { MissionKPISection } from '@/components/analytics/MissionKPISection'
import { AlgorithmAccuracySection } from '@/components/analytics/AlgorithmAccuracySection'
import { VulnerabilitySection } from '@/components/analytics/VulnerabilitySection'
import { summariseVulnerability } from '@/lib/vulnerability'
import { calculateMissionKPIs } from '@/lib/analytics/mission-kpis'
import { loadJobKpis, loadVolunteeringKpis } from '@/lib/analytics/role-kpi-queries'
import { JOB_KPI_DEFS, VOLUNTEERING_KPI_DEFS } from '@/lib/analytics/role-kpis'
import { RoleKPISection } from '@/components/analytics/RoleKPISection'
import { ROLE_KPI_LABELS } from '@/lib/constants/labels/role-kpis'
import { STAFF_ROLE_CARE_DOMAIN } from '@/lib/config/care'
import { placeableBeds } from '@/lib/config/capacity'
import { calculateAlgorithmAccuracy } from '@/lib/analytics/algorithm-accuracy'
import { getSystemConfig } from '@/lib/actions/config'
import { BRAND } from '@/lib/config/brand'
import { requirePermission } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ days?: string }>
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const currentUser = await requirePermission('dashboard:read')
  // Every role holds dashboard:read, so this page is the pilot-wide health
  // report the whole team is meant to see — aggregate counts, satisfaction
  // trend, conflict hotspots, algorithm accuracy. `RecentPlacementsTable` is
  // not aggregate: it names residents, links straight into their profile, and
  // renders their satisfaction check-in emoji, the exact surface this product
  // already fenced off behind `placements:read` on the dedicated /placements
  // page. Gating only the PAGE and rendering that table unconditionally
  // bypassed that fence for a Jobcoach or Freiwilligenarbeit viewer, who
  // cannot open /placements directly but could read the identical identified
  // data here. Same class of leak /settings had: a boundary that exists one
  // page over is not a boundary on this one.
  const canReadPlacements = hasPermission(currentUser, 'placements:read')
  /**
   * Everything on this page except the per-domain KPIs is housing reporting.
   *
   * The page itself sits on `dashboard:read`, which every staff role holds — so
   * a Jobcoach who cannot open /housing was nevertheless reading occupancy,
   * satisfaction, and conflict hotspots labelled with street addresses.
   * Verified live as the Jobcoach on 2026-09-03. Hiding the /housing link while
   * serving the same facts one page over is not a boundary.
   *
   * The page stays reachable for every role because their OWN KPIs live here
   * now; what they see is narrowed to what their role is for.
   */
  const canReadHousing = hasPermission(currentUser, 'housing:read')
  const params = await searchParams
  const days = Math.min(Math.max(Number(params.days) || 30, 7), 365)
  const periodStart = getDateDaysAgo(days)
  const ninetyDaysAgo = getDateDaysAgo(90)

  const [residents, units, placements, recentPlacements, recentIncidents, checkIns] =
    await Promise.all([
      db.query.resident.findMany({
        where: inArray(resident.status, ['ACTIVE', 'PLACED']),
      }),
      db.query.housingUnit.findMany({
        with: { placements: { where: eq(placement.status, 'ACTIVE') } },
      }),
      db.query.placement.findMany({
        where: eq(placement.status, 'ACTIVE'),
        with: {
          resident: true,
          housingUnit: true,
          checkIns: {
            orderBy: [desc(satisfactionCheckIn.createdAt)],
            limit: 1,
          },
        },
      }),
      canReadPlacements
        ? db.query.placement.findMany({
            where: gte(placement.startDate, ninetyDaysAgo),
            with: {
              housingUnit: true,
              resident: true,
              checkIns: {
                orderBy: [desc(satisfactionCheckIn.createdAt)],
                limit: 1,
              },
            },
            orderBy: [desc(placement.startDate)],
          })
        : [],
      db.query.incident.findMany({
        where: and(
          gte(incident.date, periodStart),
          eq(incident.category, 'INTERPERSONAL'), // Only conflicts, not maintenance
        ),
        with: { housingUnit: true },
      }),
      db.query.satisfactionCheckIn.findMany({
        where: gte(satisfactionCheckIn.createdAt, periodStart),
        with: {
          placement: {
            with: { resident: true, housingUnit: true },
          },
        },
        orderBy: [desc(satisfactionCheckIn.createdAt)],
      }),
    ])

  // Get all ended placements for end reason analysis (including conflict analysis fields)
  // Which domain's KPIs this viewer is shown, and over whose caseload.
  //
  // A specialist gets their OWN seat's numbers; someone whose reach is every
  // domain has no single seat, so they see both sets over the whole real
  // population. Housing is deliberately absent here — it already has
  // MissionKPISection, and duplicating it would be a second definition of the
  // same four numbers.
  const viewerDomain = STAFF_ROLE_CARE_DOMAIN[currentUser.role]
  const seesAllDomains = currentUser.scope === 'ALL_DOMAINS'
  const kpiStaffId = seesAllDomains ? null : currentUser.id
  const showJobKpis = seesAllDomains || viewerDomain === 'JOB'
  const showVolunteeringKpis = seesAllDomains || viewerDomain === 'VOLUNTEERING'

  const [endedPlacements, missionKPIs, algorithmAccuracy, systemConfig, jobKpis, volunteeringKpis] =
    await Promise.all([
      db.query.placement.findMany({
        where: ne(placement.status, 'ACTIVE'),
        columns: {
          endReason: true,
          conflictGap: true,
          wasPredictable: true,
          compatibilityScore: true,
        },
      }),
      // Off-brand, this is four queries whose result nothing renders. Gating the
      // JSX alone would still pay for them on every load of the page — which is
      // why the housing check belongs here too, not only around the markup.
      BRAND.features.pilotMeasurement && canReadHousing ? calculateMissionKPIs(6) : null,
      calculateAlgorithmAccuracy(),
      getSystemConfig(),
      showJobKpis ? loadJobKpis({ domain: 'JOB', staffId: kpiStaffId }) : null,
      showVolunteeringKpis
        ? loadVolunteeringKpis({ domain: 'VOLUNTEERING', staffId: kpiStaffId })
        : null,
    ])

  // Calculate metrics
  // Placeable beds only — a CLOSED unit is not headroom. @see lib/config/capacity.ts
  const totalBeds = placeableBeds(units)
  const occupiedBeds = units.reduce((sum, u) => sum + u.placements.length, 0)
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0

  // Check-in status - find overdue
  const now = new Date()
  const overdueCheckIns = placements.filter((p) => {
    const supportLevel = p.resident.supportLevel || 'STANDARD'
    const intervalDays = getCheckInInterval(supportLevel)
    const lastCheckIn = p.checkIns[0]
    const daysSinceCheckIn = lastCheckIn
      ? daysSinceCeil(lastCheckIn.createdAt, now)
      : daysSinceCeil(p.startDate, now)
    return daysSinceCheckIn > intervalDays
  })

  // Satisfaction analysis from recent check-ins
  const satisfactionCounts = [0, 0, 0, 0, 0] // Index 0 = rating 1, etc.
  checkIns.forEach((c) => {
    if (c.overallSatisfaction >= 1 && c.overallSatisfaction <= 5) {
      satisfactionCounts[c.overallSatisfaction - 1]++
    }
  })
  const totalCheckIns = checkIns.length
  const lowSatisfactionCheckIns = checkIns.filter((c) => c.overallSatisfaction <= 2)
  const avgSatisfaction =
    totalCheckIns > 0
      ? (checkIns.reduce((sum, c) => sum + c.overallSatisfaction, 0) / totalCheckIns).toFixed(1)
      : null

  // Conflict analysis
  const conflictEnds = endedPlacements.filter((p) => p.endReason === 'CONFLICT').length
  const conflictRate =
    endedPlacements.length > 0 ? Math.round((conflictEnds / endedPlacements.length) * 100) : 0

  const unresolvedIncidents = recentIncidents.filter((i) => !i.resolvedAt)

  // Derived from the rows already fetched above — no extra query, and no
  // stored flag that could drift from the needs it summarises.
  const vulnerability = summariseVulnerability(residents)

  // Incident type breakdown (conflicts only)
  const incidentsByType = recentIncidents.reduce(
    (acc, i) => {
      acc[i.type] = (acc[i.type] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const topIncidentTypes = Object.entries(incidentsByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, DISPLAY_LIMITS.topIncidentTypes)

  // End reason breakdown
  const endsByReason = endedPlacements.reduce(
    (acc, p) => {
      if (p.endReason) {
        acc[p.endReason] = (acc[p.endReason] || 0) + 1
      }
      return acc
    },
    {} as Record<string, number>,
  )

  // Conflict gap analysis (only placements that ended due to CONFLICT with gap data)
  const conflictPlacements = endedPlacements.filter(
    (p) => p.endReason === 'CONFLICT' && p.conflictGap,
  )
  const conflictsByGap = conflictPlacements.reduce(
    (acc, p) => {
      if (p.conflictGap) {
        acc[p.conflictGap] = (acc[p.conflictGap] || 0) + 1
      }
      return acc
    },
    {} as Record<string, number>,
  )

  // Predictability analysis
  const predictableConflicts = conflictPlacements.filter((p) => p.wasPredictable === true)
  const unpredictableConflicts = conflictPlacements.filter((p) => p.wasPredictable === false)
  const lowScoreConflicts = conflictPlacements.filter(
    (p) => p.compatibilityScore !== null && p.compatibilityScore < 60,
  )

  // Units with most conflicts (30 days)
  const incidentsByUnit = recentIncidents.reduce(
    (acc, i) => {
      acc[i.housingUnitId] = acc[i.housingUnitId] || { count: 0, unit: i.housingUnit }
      acc[i.housingUnitId].count++
      return acc
    },
    {} as Record<string, { count: number; unit: { id: string; code: string; address: string } }>,
  )

  const hotspotUnits = Object.values(incidentsByUnit)
    .sort((a, b) => b.count - a.count)
    .slice(0, DISPLAY_LIMITS.problemUnits)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ui-text">{PAGE_TITLES.analytics}</h1>
          <p className="text-ui-muted">{DASHBOARD_LABELS.analyticsPageSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/export/satisfaction"
            className="min-h-[44px] rounded-lg border border-ui-border bg-ui-surface px-4 py-2 text-sm font-medium text-ui-muted hover:bg-ui-subtle inline-flex items-center"
          >
            {FORM_LABELS.export}
          </a>
          <PeriodSelector currentDays={days} />
        </div>
      </div>

      {/* Mission KPIs — pilot brands only (@see BrandFeatures.pilotMeasurement),
          and housing readers only. These four ARE the housing numbers; a role
          that may not open /housing has no business reading its occupancy. */}
      {missionKPIs && canReadHousing && (
        <div className="mb-6 sm:mb-8">
          <MissionKPISection kpis={missionKPIs} baseline={systemConfig} />
        </div>
      )}

      {/* Per-domain KPIs. Housing is absent on purpose — MissionKPISection
          above already owns those four numbers, and a second rendering would
          be a second definition of them. */}
      {jobKpis && (
        <div className="mb-6 sm:mb-8">
          <RoleKPISection
            title={ROLE_KPI_LABELS.jobTitle}
            defs={JOB_KPI_DEFS}
            values={jobKpis}
            scopeNote={seesAllDomains ? ROLE_KPI_LABELS.scopeAll : ROLE_KPI_LABELS.scopeOwn}
            showLaggingTargets
          />
        </div>
      )}
      {volunteeringKpis && (
        <div className="mb-6 sm:mb-8">
          <RoleKPISection
            title={ROLE_KPI_LABELS.volunteeringTitle}
            defs={VOLUNTEERING_KPI_DEFS}
            values={volunteeringKpis}
            scopeNote={seesAllDomains ? ROLE_KPI_LABELS.scopeAll : ROLE_KPI_LABELS.scopeOwn}
          />
        </div>
      )}

      {canReadHousing && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <MetricCard
              label={DASHBOARD_LABELS.analyticsOccupancyRate}
              value={`${occupancyRate}%`}
              subtitle={DASHBOARD_LABELS.analyticsBedSubtitle(occupiedBeds, totalBeds)}
            />
            <MetricCard
              label={DASHBOARD_LABELS.analyticsOverdueCheckIns}
              value={overdueCheckIns.length}
              subtitle={DASHBOARD_LABELS.analyticsActiveSuffix(placements.length)}
              href="/placements?status=active&overdue=1"
              highlight={overdueCheckIns.length > 0}
            />
            <MetricCard
              label={DASHBOARD_LABELS.analyticsConflictsTitle(days)}
              value={recentIncidents.length}
              subtitle={DASHBOARD_LABELS.analyticsUnresolved(unresolvedIncidents.length)}
              href="/incidents?category=INTERPERSONAL"
              highlight={unresolvedIncidents.length > 0}
            />
            <MetricCard
              label={DASHBOARD_LABELS.analyticsConflictEnded}
              value={`${conflictRate}%`}
              subtitle={DASHBOARD_LABELS.analyticsEndingSubtitle(
                conflictEnds,
                endedPlacements.length,
              )}
              highlight={conflictRate > 20}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Satisfaction Chart */}
            <SatisfactionChart
              days={days}
              totalCheckIns={totalCheckIns}
              avgSatisfaction={avgSatisfaction}
              satisfactionCounts={satisfactionCounts}
              lowSatisfactionCount={lowSatisfactionCheckIns.length}
            />

            {/* Conflict Hotspots */}
            <div className="card">
              <h2 className="text-lg font-semibold text-ui-text mb-4">
                {DASHBOARD_LABELS.analyticsHotspotTitle(days)}
              </h2>
              {hotspotUnits.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-3xl mb-2 block" aria-hidden="true">
                    ✓
                  </span>
                  <p className="text-ui-muted">{DASHBOARD_LABELS.analyticsNoHotspots}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {hotspotUnits.map(({ unit, count }) => (
                    <Link
                      key={unit.id}
                      href={`/housing/${unit.id}`}
                      className="flex items-center justify-between p-3 bg-ui-subtle rounded-lg hover:bg-ui-subtle transition-colors"
                    >
                      <div>
                        <p className="font-medium text-ui-text">{unit.code}</p>
                        <p className="text-sm text-ui-muted">{unit.address}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-status-warning-text">{count}</p>
                        <p className="text-xs text-ui-muted">
                          {DASHBOARD_LABELS.analyticsConflictCountLabel}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Conflict Types */}
            <div className="card">
              <h2 className="text-lg font-semibold text-ui-text mb-4">
                {DASHBOARD_LABELS.analyticsConflictTypesTitle(days)}
              </h2>
              {topIncidentTypes.length === 0 ? (
                <p className="text-ui-muted text-center py-8">
                  {DASHBOARD_LABELS.analyticsNoConflictTypes}
                </p>
              ) : (
                <div className="space-y-3">
                  {topIncidentTypes.map(([type, count]) => (
                    <div key={type} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-ui-text">
                            {getLabel(INCIDENT_TYPE_LABELS, type)}
                          </span>
                          <span className="text-ui-muted">{count}</span>
                        </div>
                        <div className="meter-lg">
                          <div
                            className="meter-fill"
                            style={{
                              width: `${(count / recentIncidents.length) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Placement End Reasons */}
            <div className="card">
              <h2 className="text-lg font-semibold text-ui-text mb-4">
                {DASHBOARD_LABELS.analyticsEndReasonsTitle}
              </h2>
              {endedPlacements.length === 0 ? (
                <p className="text-ui-muted text-center py-8">
                  {DASHBOARD_LABELS.analyticsNoEndedPlacements}
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(endsByReason)
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, count]) => (
                      <div key={reason} className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-ui-text">
                              {getLabel(END_REASON_LABELS, reason)}
                            </span>
                            <span className="text-ui-muted">
                              {count} ({Math.round((count / endedPlacements.length) * 100)}%)
                            </span>
                          </div>
                          <div className="meter-lg">
                            <div
                              className={`meter-fill ${
                                reason === 'CONFLICT'
                                  ? 'bg-status-error'
                                  : reason === 'NATURAL'
                                    ? 'bg-status-success'
                                    : 'bg-status-warning'
                              }`}
                              style={{
                                width: `${(count / endedPlacements.length) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Conflict Analysis Section */}
          {conflictEnds > 0 && (
            <ConflictAnalysisSection
              conflictsByGap={conflictsByGap}
              conflictPlacementsCount={conflictPlacements.length}
              predictableCount={predictableConflicts.length}
              unpredictableCount={unpredictableConflicts.length}
              lowScoreCount={lowScoreConflicts.length}
            />
          )}

          {/* Algorithm Accuracy */}
          <div className="mt-6 sm:mt-8">
            <AlgorithmAccuracySection report={algorithmAccuracy} />
          </div>

          {/* Besonderer Unterbringungsbedarf — aggregate only, no one is named, so
          it sits at the page's own `dashboard:read` like the other summaries.
          @see lib/vulnerability/ for why this is derived and never stored. */}
          <div className="mt-6 sm:mt-8">
            <VulnerabilitySection summary={vulnerability} />
          </div>
        </>
      )}

      {/* Recent Placements — identified resident + satisfaction data, so this
          follows the same boundary as /placements rather than dashboard:read. */}
      {canReadPlacements && <RecentPlacementsTable placements={recentPlacements} />}
    </div>
  )
}

function MetricCard({
  label,
  value,
  subtitle,
  href,
  highlight = false,
}: {
  label: string
  value: string | number
  subtitle?: string
  href?: string
  highlight?: boolean
}) {
  const content = (
    <div className={href ? 'card-hover' : 'card'}>
      <p className="text-sm text-ui-muted">{label}</p>
      <p
        className={`text-3xl font-bold mt-1 ${highlight ? 'text-status-warning-text' : 'text-ui-text'}`}
      >
        {value}
      </p>
      {subtitle && (
        <p className={`text-sm mt-2 ${highlight ? 'text-status-warning-text' : 'text-ui-muted'}`}>
          {subtitle}
        </p>
      )}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
