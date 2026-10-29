import type { Metadata } from 'next'
import { residentSearchFields, searchText } from '@/lib/search/text-search'
import { db, placement, satisfactionCheckIn } from '@/lib/db'
import { eq, ne, isNotNull, desc, count, avg } from 'drizzle-orm'
import Link from 'next/link'
import {
  PLACEMENT_STATUS_LABELS,
  PLACEMENT_LIST_LABELS,
  END_REASON_LABELS,
  SATISFACTION_EMOJIS,
  SATISFACTION_SURVEY_LABELS,
  SUPPORT_LEVEL_LABELS,
  DASHBOARD_LABELS,
  UI_LABELS,
  getLabel,
} from '@/lib/constants'

import { DISPLAY_LIMITS } from '@/lib/config/thresholds'
import { getCheckInInterval } from '@/lib/config/checkin-intervals'
import { PlacementCheckInStatus } from '@/components/placements/PlacementCheckInStatus'

export const metadata: Metadata = { title: 'Platzierungen' }
import { daysSinceCeil, getStatusBadgeClass, formatDate } from '@/lib/utils'
import { StatCard } from '@/components/ui/Card'
import { TabLink, TabLinkGroup } from '@/components/ui/Tabs'
import { PageHeader } from '@/components/ui/Page'
import { requirePermission } from '@/lib/auth'
import {
  RESIDENT_NAME_SELECT,
  residentInitials,
  residentName,
  type NamedResident,
} from '@/lib/utils/resident-name'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ status?: string; q?: string; overdue?: string; conflicts?: string }>
}

export default async function PlacementsListPage({ searchParams }: Props) {
  const params = await searchParams
  await requirePermission('placements:read')
  const statusFilter = params.status || 'active'
  const query = (params.q || '').trim().toLowerCase()
  const overdueOnly = params.overdue === '1'
  const conflictsOnly = params.conflicts === '1'

  const [placements, statusGroups, avgSatisfactionAgg, conflictEndsCount] = await Promise.all([
    db.query.placement.findMany({
      where:
        statusFilter === 'active'
          ? eq(placement.status, 'ACTIVE')
          : statusFilter === 'ended'
            ? ne(placement.status, 'ACTIVE')
            : undefined,
      columns: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        satisfactionRating: true,
        endReason: true,
        residentId: true,
        housingUnitId: true,
      },
      with: {
        resident: {
          columns: { ...RESIDENT_NAME_SELECT, supportLevel: true },
        },
        housingUnit: {
          columns: { code: true, address: true },
        },
        checkIns: {
          orderBy: [desc(satisfactionCheckIn.createdAt)],
          limit: 1,
          columns: {
            createdAt: true,
            overallSatisfaction: true,
            concerns: true,
          },
        },
      },
      orderBy: [desc(placement.startDate)],
      limit: 200,
    }),
    // Aggregate tab counts by status (single query instead of fetching all rows)
    db
      .select({ status: placement.status, count: count() })
      .from(placement)
      .groupBy(placement.status),
    // Average satisfaction across all placements with a rating set
    db
      .select({ avg: avg(placement.satisfactionRating) })
      .from(placement)
      .where(isNotNull(placement.satisfactionRating)),
    // Count of placements that ended due to conflict
    db.$count(placement, eq(placement.endReason, 'CONFLICT')),
  ])

  const statusCounts = statusGroups.reduce<Record<string, number>>((acc, g) => {
    acc[g.status] = g.count
    return acc
  }, {})
  const totalPlacements = statusGroups.reduce((sum, g) => sum + g.count, 0)
  const activeCount = statusCounts.ACTIVE ?? 0

  // avg() comes back as string | null from node-postgres (Prisma returned number | null)
  const avgSatisfactionRaw = avgSatisfactionAgg[0]?.avg ?? null

  const stats = {
    total: totalPlacements,
    active: activeCount,
    ended: totalPlacements - activeCount,
    avgSatisfaction: avgSatisfactionRaw !== null ? Math.round(Number(avgSatisfactionRaw)) : null,
    conflictEnds: conflictEndsCount,
  }

  // Typed text narrows the loaded placements, typos and all.
  const queryMatches = new Set(
    searchText(placements, query, [
      ...residentSearchFields((p: (typeof placements)[number]) => p.resident),
      { name: 'unit', get: (p) => p.housingUnit.code },
      { name: 'address', get: (p) => p.housingUnit.address },
    ]),
  )

  const filteredPlacements = placements.filter((placement) => {
    const matchesQuery = queryMatches.has(placement)

    const lastCheckIn = placement.checkIns?.[0]
    const daysSinceCheckIn = lastCheckIn ? daysSinceCeil(lastCheckIn.createdAt) : null
    const supportLevel = placement.resident.supportLevel || 'STANDARD'
    const checkInIntervalDays = getCheckInInterval(supportLevel)
    const isOverdue =
      placement.status === 'ACTIVE' &&
      (daysSinceCheckIn === null
        ? daysSinceCeil(placement.startDate) > checkInIntervalDays
        : daysSinceCheckIn > checkInIntervalDays)

    const matchesOverdue = !overdueOnly || isOverdue
    const matchesConflicts = !conflictsOnly || placement.endReason === 'CONFLICT'

    return matchesQuery && matchesOverdue && matchesConflicts
  })
  const hasActiveFilters = Boolean(query || overdueOnly || conflictsOnly)

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          title={PLACEMENT_LIST_LABELS.title}
          actions={
            <>
              <a
                href="/api/export/placements"
                className="min-h-[44px] rounded-md border border-ui-border-strong bg-ui-surface px-4 py-2 text-sm font-medium text-ui-muted hover:bg-ui-subtle inline-flex items-center"
              >
                {PLACEMENT_LIST_LABELS.export}
              </a>
              <Link href="/matching" className="btn-primary">
                {PLACEMENT_LIST_LABELS.newPlacement}
              </Link>
            </>
          }
        />
      </div>

      {/* Search & Quick Filters */}
      <form className="mb-4 p-3 sm:p-4 bg-ui-subtle rounded-lg border border-ui-border">
        <input type="hidden" name="status" value={statusFilter} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="search"
            name="q"
            defaultValue={params.q || ''}
            placeholder={PLACEMENT_LIST_LABELS.searchPlaceholder}
            className="input md:col-span-2"
          />
          <label className="flex items-center gap-2 text-sm text-ui-muted">
            <input type="checkbox" name="overdue" value="1" defaultChecked={overdueOnly} />
            {PLACEMENT_LIST_LABELS.filterOverdue}
          </label>
          <label className="flex items-center gap-2 text-sm text-ui-muted">
            <input type="checkbox" name="conflicts" value="1" defaultChecked={conflictsOnly} />
            {PLACEMENT_LIST_LABELS.filterConflicts}
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="submit" className="btn-outline text-sm">
            {PLACEMENT_LIST_LABELS.filterApply}
          </button>
          <Link
            href={`/placements?status=${statusFilter}`}
            className="inline-flex items-center min-h-[44px] px-1 text-sm text-ui-muted hover:text-ui-muted"
          >
            {PLACEMENT_LIST_LABELS.filterReset}
          </Link>
        </div>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label={UI_LABELS.active} value={stats.active} />
        <StatCard label={UI_LABELS.ended} value={stats.ended} />
        <StatCard
          label={DASHBOARD_LABELS.analyticsAvgSatisfaction}
          value={
            stats.avgSatisfaction
              ? `${SATISFACTION_EMOJIS[stats.avgSatisfaction - 1]} ${stats.avgSatisfaction}/5`
              : '-'
          }
        />
        <StatCard
          label={DASHBOARD_LABELS.analyticsConflictEnded}
          value={stats.conflictEnds}
          trend={stats.conflictEnds > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <TabLinkGroup label={UI_LABELS.filterNav} variant="underline">
          <TabLink
            href="/placements?status=active"
            label={UI_LABELS.active}
            count={stats.active}
            active={statusFilter === 'active'}
          />
          <TabLink
            href="/placements?status=ended"
            label={UI_LABELS.ended}
            count={stats.ended}
            active={statusFilter === 'ended'}
          />
          <TabLink
            href="/placements?status=all"
            label={UI_LABELS.all}
            count={stats.total}
            active={statusFilter === 'all'}
          />
        </TabLinkGroup>
      </div>

      {/* Placements List */}
      {filteredPlacements.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-ui-muted mb-4">
            {hasActiveFilters
              ? 'Keine Platzierungen passen zu den aktuellen Filtern.'
              : statusFilter === 'active'
                ? PLACEMENT_LIST_LABELS.emptyActive
                : statusFilter === 'ended'
                  ? PLACEMENT_LIST_LABELS.emptyEnded
                  : PLACEMENT_LIST_LABELS.emptyAll}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            {hasActiveFilters ? (
              <Link href={`/placements?status=${statusFilter}`} className="btn-outline">
                {PLACEMENT_LIST_LABELS.filterReset}
              </Link>
            ) : null}
            <Link href="/matching" className="btn-primary">
              {PLACEMENT_LIST_LABELS.createPlacement}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPlacements.map((placement) => (
            <PlacementRow key={placement.id} placement={placement} />
          ))}
        </div>
      )}
    </div>
  )
}

interface PlacementRowData {
  id: string
  status: string
  startDate: Date | string
  endDate: Date | string | null
  satisfactionRating: number | null
  endReason: string | null
  residentId: string
  housingUnitId: string
  resident: NamedResident & { supportLevel: string | null }
  housingUnit: { code: string; address: string }
  checkIns: {
    createdAt: Date | string
    overallSatisfaction: number
    concerns: string | null
  }[]
}

function PlacementRow({ placement }: { placement: PlacementRowData }) {
  const daysSinceStart = daysSinceCeil(placement.startDate)
  const totalDuration = placement.endDate
    ? daysSinceCeil(placement.startDate, placement.endDate)
    : daysSinceStart

  // Check-in status for active placements
  const lastCheckIn = placement.checkIns?.[0]
  const daysSinceCheckIn = lastCheckIn ? daysSinceCeil(lastCheckIn.createdAt) : null

  // Check-in frequency based on support level (from resident)
  const supportLevel = placement.resident.supportLevel || 'STANDARD'
  const checkInIntervalDays = getCheckInInterval(supportLevel)
  const isCheckInOverdue =
    placement.status === 'ACTIVE' &&
    (daysSinceCheckIn === null
      ? daysSinceStart > checkInIntervalDays
      : daysSinceCheckIn > checkInIntervalDays)

  return (
    <div
      className={`card p-4 ${placement.status !== 'ACTIVE' ? 'opacity-75' : ''} ${
        isCheckInOverdue ? 'border-l-4 border-l-status-warning' : ''
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 min-w-0">
          {/* Resident */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="avatar shrink-0">{residentInitials(placement.resident)}</div>
            <div className="min-w-0">
              <Link
                href={`/residents/${placement.residentId}`}
                className="inline-flex items-center py-2 -my-2 font-medium text-ui-text hover:text-brand-primary"
              >
                {residentName(placement.resident)}
              </Link>
              {supportLevel !== 'STANDARD' && (
                <p className="text-xs text-status-warning-text">
                  {getLabel(SUPPORT_LEVEL_LABELS, supportLevel)}
                </p>
              )}
            </div>
          </div>

          <span className="text-ui-muted hidden sm:inline">→</span>

          {/* Housing */}
          <div className="min-w-0">
            <Link
              href={`/housing/${placement.housingUnitId}`}
              className="inline-flex items-center py-2 -my-2 font-medium text-ui-text hover:text-brand-primary"
            >
              {placement.housingUnit.code}
            </Link>
            <p className="text-sm text-ui-muted">{placement.housingUnit.address}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6 shrink-0">
          {/* Duration */}
          <div className="text-left sm:text-right">
            <p className="text-xs text-ui-muted">
              {placement.status === 'ACTIVE'
                ? PLACEMENT_LIST_LABELS.since
                : PLACEMENT_LIST_LABELS.duration}
            </p>
            <p className="font-medium text-ui-text">
              {totalDuration}{' '}
              {totalDuration === 1 ? PLACEMENT_LIST_LABELS.day : PLACEMENT_LIST_LABELS.days}
            </p>
          </div>

          {/* Check-in Status for Active Placements */}
          {placement.status === 'ACTIVE' && (
            <PlacementCheckInStatus
              placementId={placement.id}
              isOverdue={isCheckInOverdue}
              daysSinceCheckIn={daysSinceCheckIn}
              lastSatisfaction={lastCheckIn?.overallSatisfaction ?? null}
            />
          )}

          {/* Last satisfaction for ended placements */}
          {placement.status !== 'ACTIVE' && placement.satisfactionRating && (
            <div className="text-left sm:text-right">
              <p className="text-xs text-ui-muted">{SATISFACTION_SURVEY_LABELS.groupLabel}</p>
              <p className="text-lg">{SATISFACTION_EMOJIS[placement.satisfactionRating - 1]}</p>
            </div>
          )}

          {/* Status / End Reason */}
          <div className="text-left sm:text-right">
            {placement.status === 'ACTIVE' ? (
              <span className={`badge ${getStatusBadgeClass(placement.status)}`}>
                {getLabel(PLACEMENT_STATUS_LABELS, placement.status)}
              </span>
            ) : (
              <div>
                <span className={`badge ${getStatusBadgeClass(placement.status)}`}>
                  {getLabel(PLACEMENT_STATUS_LABELS, placement.status)}
                </span>
                {placement.endReason && (
                  <p className="text-xs text-ui-muted mt-1">
                    {getLabel(END_REASON_LABELS, placement.endReason)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Concerns Alert */}
      {lastCheckIn?.concerns && (
        <div className="mt-3 p-2 bg-status-warning/10 rounded text-sm text-status-warning-text border-t border-status-warning/15">
          {PLACEMENT_LIST_LABELS.concerns}{' '}
          {lastCheckIn.concerns.slice(0, DISPLAY_LIMITS.emailSummary)}
          {lastCheckIn.concerns.length > DISPLAY_LIMITS.emailSummary ? '...' : ''}
        </div>
      )}

      {/* Dates */}
      <div className="flex items-center gap-4 mt-3 text-sm text-ui-muted border-t border-ui-border pt-3">
        <span>
          {PLACEMENT_LIST_LABELS.dateStart} {formatDate(placement.startDate)}
        </span>
        {placement.endDate && (
          <span>
            {PLACEMENT_LIST_LABELS.dateEnd} {formatDate(placement.endDate)}
          </span>
        )}
      </div>
    </div>
  )
}
