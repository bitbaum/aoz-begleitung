import type { Metadata } from 'next'
import { db, housingUnit, placement, incident, escapeLike } from '@/lib/db'
import { and, or, eq, inArray, ilike, gte, asc } from 'drizzle-orm'
import { StatCard } from '@/components/ui/Card'
import { getDateDaysAgo } from '@/lib/utils'
import { requirePermission } from '@/lib/auth'
import { placeableBeds } from '@/lib/config/capacity'
import { unitScopeFilter } from '@/lib/auth/site-access'

export const metadata: Metadata = { title: 'Unterkünfte' }
import {
  EMPTY_STATE_LABELS,
  UI_LABELS,
  HOUSING_STATUS_LABELS,
  HOUSING_STAT_LABELS,
  PAGE_TITLES,
  HOUSING_LIST_LABELS,
} from '@/lib/constants'
import { HousingList } from '@/components/housing/HousingList'
import { TabLink, TabLinkGroup } from '@/components/ui/Tabs'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, PageHeader, PageShell, Toolbar } from '@/components/ui/Page'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ view?: string; q?: string }>
}

export default async function HousingListPage({ searchParams }: Props) {
  const params = await searchParams
  const view = params.view || 'active'
  const q = params.q?.trim() || ''

  const viewer = await requirePermission('housing:read')

  // Null for an ALL_UNITS viewer — everyone, until somebody is deliberately
  // narrowed — so the spread adds nothing and this issues exactly the query it
  // issued before the site axis existed.
  const unitFilter = unitScopeFilter(viewer)

  const [unitRows, allUnitRows] = await Promise.all([
    db.query.housingUnit.findMany({
      where: and(
        unitFilter ?? undefined,
        view === 'active'
          ? inArray(housingUnit.status, ['AVAILABLE', 'FULL', 'MAINTENANCE'])
          : view === 'archived'
            ? eq(housingUnit.status, 'CLOSED')
            : undefined,
        q
          ? or(
              ilike(housingUnit.code, `%${escapeLike(q)}%`),
              // A caseworker who hears "Casa Harmonie" must be able to type it.
              ilike(housingUnit.nickname, `%${escapeLike(q)}%`),
              ilike(housingUnit.address, `%${escapeLike(q)}%`),
              ilike(housingUnit.buildingCode, `%${escapeLike(q)}%`),
            )
          : undefined,
      ),
      columns: {
        id: true,
        code: true,
        // The name the residents gave their own home. Without it the staff
        // list can only ever show DEMO-U05. @see lib/utils/unit-name.ts
        nickname: true,
        address: true,
        buildingCode: true,
        status: true,
        totalBeds: true,
        totalRooms: true,
        wheelchairAccess: true,
      },
      with: {
        placements: {
          where: eq(placement.status, 'ACTIVE'),
          columns: { id: true },
        },
        incidents: {
          where: and(
            gte(incident.date, getDateDaysAgo(30)),
            eq(incident.category, 'INTERPERSONAL'),
          ),
          columns: { id: true },
        },
      },
      orderBy: [asc(housingUnit.code)],
    }),
    // Tab counts and stats — unfiltered by VIEW (that is the point: the
    // counts describe every tab), but still scoped to the viewer's units.
    db.query.housingUnit.findMany({
      // Scoped as well: this feeds the view counts beside the tabs, and an
      // unscoped count tells a restricted viewer how many houses exist that
      // they cannot open.
      where: unitFilter ?? undefined,
      columns: {
        status: true,
        totalBeds: true,
      },
      with: {
        placements: {
          where: eq(placement.status, 'ACTIVE'),
          columns: { id: true },
        },
      },
    }),
  ])

  // Prisma's `_count` selects have no query-API equivalent — the filtered
  // relations are fetched as id-only rows and counted here instead.
  const units = unitRows.map(({ placements, incidents, ...rest }) => ({
    ...rest,
    _count: { placements: placements.length, incidents: incidents.length },
  }))
  const allUnits = allUnitRows.map(({ placements, ...rest }) => ({
    ...rest,
    _count: { placements: placements.length },
  }))

  const stats = {
    total: allUnits.length,
    available: allUnits.filter((u) => u.status === 'AVAILABLE').length,
    full: allUnits.filter((u) => u.status === 'FULL').length,
    archived: allUnits.filter((u) => u.status === 'CLOSED').length,
    // Placeable beds only. @see lib/config/capacity.ts
    totalBeds: placeableBeds(allUnits),
    occupiedBeds: allUnits.reduce((sum, u) => sum + u._count.placements, 0),
    visible: units.length,
  }
  const occupancyPercent =
    stats.totalBeds > 0
      ? Math.max(0, Math.min(100, Math.round((stats.occupiedBeds / stats.totalBeds) * 100)))
      : 0

  return (
    <PageShell>
      <PageHeader
        title={PAGE_TITLES.housing}
        description={`${stats.visible} sichtbar · ${stats.occupiedBeds}/${stats.totalBeds} Betten belegt`}
        actions={<ButtonLink href="/housing/new">{PAGE_TITLES.newHousing}</ButtonLink>}
      />

      <Toolbar>
        <form method="GET" action="/housing" className="flex-1">
          <input type="hidden" name="view" value={view} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={HOUSING_LIST_LABELS.searchPlaceholder}
            className="input w-full md:max-w-sm"
            autoComplete="off"
          />
        </form>
        <TabLinkGroup label={UI_LABELS.filterNav}>
          <TabLink
            href={`/housing?view=active${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            label={UI_LABELS.active}
            count={stats.total - stats.archived}
            active={view === 'active'}
          />
          <TabLink
            href={`/housing?view=archived${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            label={UI_LABELS.archived}
            count={stats.archived}
            active={view === 'archived'}
          />
          <TabLink
            href={`/housing?view=all${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            label={UI_LABELS.all}
            count={stats.total}
            active={view === 'all'}
          />
        </TabLinkGroup>
      </Toolbar>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={HOUSING_STAT_LABELS.total} value={stats.total} />
        <StatCard label={HOUSING_STATUS_LABELS.AVAILABLE} value={stats.available} />
        <StatCard label={HOUSING_STATUS_LABELS.FULL} value={stats.full} />
        <StatCard
          label={HOUSING_STAT_LABELS.occupancy}
          value={`${stats.occupiedBeds}/${stats.totalBeds}`}
          subtitle={`${occupancyPercent}%`}
        />
      </div>

      {units.length === 0 ? (
        <EmptyState
          title={
            q
              ? `${HOUSING_LIST_LABELS.emptyFiltered} («${q}»)`
              : view === 'archived'
                ? EMPTY_STATE_LABELS.noHousingArchived
                : EMPTY_STATE_LABELS.noHousing
          }
          action={
            q ? (
              <ButtonLink href={`/housing?view=${view}`} variant="outline">
                {HOUSING_LIST_LABELS.filterReset}
              </ButtonLink>
            ) : view !== 'archived' ? (
              <ButtonLink href="/housing/new">{EMPTY_STATE_LABELS.createHousingFirst}</ButtonLink>
            ) : null
          }
        />
      ) : (
        <HousingList
          units={units.map((u) => ({
            ...u,
            placementCount: u._count.placements,
            incidentCount: u._count.incidents,
          }))}
        />
      )}
    </PageShell>
  )
}
