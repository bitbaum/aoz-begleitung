import type { Metadata } from 'next'
import {
  db,
  escapeLike,
  resident,
  placement,
  incident,
  satisfactionCheckIn,
  clientGroup,
} from '@/lib/db'
import { eq, and, or, gte, notInArray, isNotNull, ilike, desc, asc, count } from 'drizzle-orm'
import {
  EMPTY_STATE_LABELS,
  RESIDENT_LIST_LABELS,
  UI_LABELS,
  RESIDENT_STATUS_LABELS,
  RESIDENT_STAT_LABELS,
} from '@/lib/constants'

export const metadata: Metadata = { title: 'Klient*innen' }
import { getDateDaysAgo, daysSinceCeil } from '@/lib/utils'
import { StatCard } from '@/components/ui/Card'
import { ResidentsList } from '@/components/residents/ResidentsList'
import { ClientBoard } from '@/components/residents/ClientBoard'
import type { ClientBoardItem } from '@/components/residents/ClientBoard'
import { RESIDENT_NAME_SELECT } from '@/lib/utils/resident-name'
import { TabLink, TabLinkGroup } from '@/components/ui/Tabs'
import { CSVImport } from '@/components/residents/CSVImport'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, PageHeader, PageShell, Toolbar } from '@/components/ui/Page'
import { LayoutGrid, List } from 'lucide-react'
import Link from 'next/link'
import { getCheckInInterval } from '@/lib/config/checkin-intervals'
import { getCurrentUser, requirePermission } from '@/lib/auth'
import { residentScopeFilter } from '@/lib/auth/site-access'
import {
  NARROWEST_CAPABILITIES,
  hasPermission,
  type StaffCapabilities,
  type StaffPermission,
} from '@/lib/auth/role-policy'
import { getMyResidentIds } from '@/lib/actions/care'
import { STAFF_ROLE_CARE_DOMAIN } from '@/lib/config/care'
import {
  activeClientFilterCount,
  clientFilter,
  clientFilterDefaults,
  clientFiltersFor,
  clientFilterWhere,
  effectiveClientFilters,
  encodeClientFilters,
  encodedClientFilterValue,
  parseClientFilterParams,
  savableClientFilters,
  type ClientFilterState,
} from '@/lib/config/client-filters'
import { loadClientFilterOptionSources } from '@/lib/client-groups/options'
import {
  groupMembersWhere,
  mayManageClientGroup,
  parseGroupFilters,
} from '@/lib/client-groups/resolve'
import { ClientFilterBar, type FilterControl } from '@/components/residents/ClientFilterBar'
import {
  ClientGroupChips,
  ManageClientGroup,
  SaveClientGroup,
  type ClientGroupChip,
} from '@/components/residents/ClientGroups'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

export default async function ResidentsListPage({ searchParams }: Props) {
  const params = await searchParams
  const q = single(params.q)
  const layout = single(params.layout) || 'board'
  const groupParam = single(params.group)
  // `?filter=mine|all` was the board's old "Meine / Alle" toggle; it is the
  // Zuständig filter now, and old links keep working.
  const legacySeat = single(params.filter)
  const fromUrl = parseClientFilterParams(
    params.seat === undefined && (legacySeat === 'mine' || legacySeat === 'all')
      ? { ...params, seat: legacySeat }
      : params,
  )

  await requirePermission('residents:read')

  const now = new Date()

  // Get current user for "my clients" filter and role-contextual content
  const currentUser = await getCurrentUser()
  // Narrowest subject for the render between session expiry and the redirect
  // that replaces it — showing less is the safe direction to be wrong in.
  const viewer: StaffCapabilities = currentUser ?? NARROWEST_CAPABILITIES
  const viewerRole = viewer.role
  const viewerDomain = STAFF_ROLE_CARE_DOMAIN[viewerRole] ?? null

  // The NAV is permission-filtered; the PAGES were not, so a Jobcoach was
  // offered "+ Klient*in", "Matching starten", export and the CSV importer —
  // four controls their role cannot use. Clicking one produced a generic
  // "Etwas ist schiefgelaufen … erneut versuchen", so the app looked broken
  // rather than out of scope. Offering an action is a promise; these are the
  // ones the role can actually keep.
  const can = (permission: StaffPermission) => hasPermission(viewer, permission)

  // Which PLACES this viewer covers. Null for ALL_UNITS — everyone, until
  // somebody is deliberately narrowed — so the `and()` below adds nothing and
  // the common query is unchanged.
  //
  // Read from `currentUser`, not from `viewer`: the NARROWEST_CAPABILITIES
  // fallback describes a care role only, and inventing a site restriction for
  // an expiring session would hide people for a reason that has nothing to do
  // with sites.
  const siteFilter = currentUser ? residentScopeFilter(currentUser) : null

  // Whether "Meine Klient*innen" means anything for this viewer decides the
  // Zuständig default — asked before the list query, because it shapes it.
  const myResidentIds = currentUser ? await getMyResidentIds(currentUser.id) : []
  const viewerHasCaseload = myResidentIds.length > 0
  const defaults = clientFilterDefaults({ viewerHasCaseload })
  const filters = effectiveClientFilters(fromUrl, defaults)
  const standDef = clientFilter('stand')
  const stand = filters.stand ?? 'active'

  const residentsWhere = and(
    siteFilter ?? undefined,
    clientFilterWhere(filters, { viewerId: currentUser?.id ?? '', now }),
    q
      ? or(
          ilike(resident.code, `%${escapeLike(q)}%`),
          ilike(resident.displayName, `%${escapeLike(q)}%`),
        )
      : undefined,
  )

  const [residents, statusGroups, unplacedCount, incidentGroups, optionSources, groupRows] =
    await Promise.all([
      db.query.resident.findMany({
        where: residentsWhere,
        columns: {
          ...RESIDENT_NAME_SELECT,
          ageRange: true,
          gender: true,
          status: true,
          supportLevel: true,
          languages: true,
          createdAt: true,
          // Selected EXPLICITLY, and the compiler is not the reason it is
          // here: drizzle's relational result types are degraded by the
          // schema's circular table references, so omitting this column type
          // -checks cleanly and then renders `undefined` — falsy — hiding the
          // "Platzhalter" marker on every seeded row while looking perfectly
          // healthy. Same shape as the under-selection bug that printed a
          // client's code instead of their name.
          isPlaceholder: true,
        },
        with: {
          placements: {
            where: eq(placement.status, 'ACTIVE'),
            columns: { startDate: true },
            with: {
              housingUnit: { columns: { code: true } },
              checkIns: {
                orderBy: [desc(satisfactionCheckIn.createdAt)],
                limit: 1,
                columns: { createdAt: true },
              },
            },
          },
          careAssignments: {
            columns: { role: true },
            with: {
              staff: { columns: { name: true } },
            },
          },
          careAttributes: {
            columns: { key: true, value: true, domain: true },
          },
        },
        orderBy: [desc(resident.createdAt)],
      }),
      // Aggregate tab counts by status (single query instead of fetching all rows)
      db
        .select({ status: resident.status, count: count() })
        .from(resident)
        .groupBy(resident.status),
      // Count of ACTIVE residents with no active placement (separate query)
      db.$count(
        resident,
        and(
          eq(resident.status, 'ACTIVE'),
          notInArray(
            resident.id,
            db
              .select({ residentId: placement.residentId })
              .from(placement)
              .where(eq(placement.status, 'ACTIVE')),
          ),
        ),
      ),
      // Recent interpersonal incidents per subject (was Prisma's filtered
      // `_count.incidentsAsSubject` select — the query API has no filtered
      // relation count, so it is one grouped query joined in application code)
      db
        .select({ subjectId: incident.subjectId, count: count() })
        .from(incident)
        .where(
          and(
            isNotNull(incident.subjectId),
            gte(incident.date, getDateDaysAgo(30)),
            eq(incident.category, 'INTERPERSONAL'),
          ),
        )
        .groupBy(incident.subjectId),
      loadClientFilterOptionSources(currentUser, viewerHasCaseload),
      db
        .select({
          id: clientGroup.id,
          name: clientGroup.name,
          description: clientGroup.description,
          filters: clientGroup.filters,
          createdByUserId: clientGroup.createdByUserId,
        })
        .from(clientGroup)
        .orderBy(asc(clientGroup.name)),
    ])

  const incidentCountByResident = new Map(incidentGroups.map((g) => [g.subjectId, g.count]))

  const statusCounts = statusGroups.reduce<Record<string, number>>((acc, g) => {
    acc[g.status] = g.count
    return acc
  }, {})

  const stats = {
    total: statusGroups.reduce((sum, g) => sum + g.count, 0),
    active: statusCounts.ACTIVE ?? 0,
    placed: statusCounts.PLACED ?? 0,
    archived: statusCounts.EXITED ?? 0,
    unplaced: unplacedCount,
    visible: residents.length,
  }

  // The tiles and the header describe the people LISTED, not the whole
  // organisation: under a filter ("Singapur", 4 people) tiles reading
  // 13 / 12 / 1 contradicted the list beneath them. The list is unpaginated,
  // so the rows are a complete count. The matching banner keeps the
  // organisation-wide number — it is a call to action, not a description.
  const shown = {
    total: residents.length,
    placed: (residents as { placements?: unknown[] }[]).filter(
      (r) => (r.placements?.length ?? 0) > 0,
    ).length,
    unplaced: (residents as { status: string; placements?: unknown[] }[]).filter(
      (r) => r.status !== 'EXITED' && (r.placements?.length ?? 0) === 0,
    ).length,
  }

  // Compute check-in status and assemble ClientBoardItem for each resident
  const clientBoardItems: ClientBoardItem[] = (residents as any[]).map((r) => {
    const placement = r.placements?.[0]
    const intervalDays = getCheckInInterval(r.supportLevel)
    let daysSinceCheckIn: number | null = null

    if (placement) {
      const lastCheckIn = placement.checkIns?.[0]
      daysSinceCheckIn = lastCheckIn
        ? daysSinceCeil(lastCheckIn.createdAt, now)
        : daysSinceCeil(placement.startDate, now)
    }

    return {
      id: r.id,
      code: r.code,
      displayName: r.displayName,
      // Carried through by hand because the map above casts to `any[]`, which
      // switches off exactly the protection `isPlaceholder: boolean` was made
      // required for. The marker was added to ResidentsList, type-checked
      // green, and still did not appear on the live site — this board is the
      // DEFAULT view and the cast let it through without the field.
      isPlaceholder: r.isPlaceholder,
      ageRange: r.ageRange,
      gender: r.gender,
      status: r.status,
      supportLevel: r.supportLevel ?? 'STANDARD',
      languages: r.languages,
      createdAt: r.createdAt,
      placements: r.placements ?? [],
      careSeats: r.careAssignments ?? [],
      careAttributes: (r.careAttributes ?? []).filter(
        (a: { domain: string }) => !viewerDomain || a.domain === viewerDomain,
      ),
      incidentCount: incidentCountByResident.get(r.id) ?? 0,
      daysSinceCheckIn,
      checkInIntervalDays: intervalDays,
    }
  })

  // Sort: most urgent (overdue check-ins) first, unhoused second, then alphabetical
  const sortedBoardItems = [...clientBoardItems].sort((a, b) => {
    const urgencyA = (a.daysSinceCheckIn ?? 0) - a.checkInIntervalDays
    const urgencyB = (b.daysSinceCheckIn ?? 0) - b.checkInIntervalDays
    if (urgencyB !== urgencyA) return urgencyB - urgencyA
    // Unhoused before housed
    const aUnhoused = a.placements.length === 0 ? 1 : 0
    const bUnhoused = b.placements.length === 0 ? 1 : 0
    return bUnhoused - aUnhoused
  })

  // ── URLs: every link is a filter state encoded against the page defaults,
  // so a filtered list is a shareable link and a clean one stays clean.
  const hrefFor = (state: ClientFilterState, extra: Record<string, string> = {}) => {
    const search = encodeClientFilters(state, defaults)
    for (const [key, value] of Object.entries(extra)) if (value) search.set(key, value)
    const query = search.toString()
    return query ? `/residents?${query}` : '/residents'
  }
  const layoutExtra: Record<string, string> = layout === 'list' ? { layout: 'list' } : {}
  const currentHref = hrefFor(filters, { ...layoutExtra, q })
  const resetHref = hrefFor({ ...defaults, stand }, { ...layoutExtra, q })
  // Everyone in the current tab: the way out of an empty filtered list.
  const everyoneHref = hrefFor({ stand, seat: 'all' }, layoutExtra)
  const activeCount = activeClientFilterCount(filters, defaults)

  const filterControls: FilterControl[] = clientFiltersFor('bar').map((def) => ({
    id: def.id,
    param: def.param,
    label: def.label,
    kind: def.kind,
    options: def.options(optionSources),
    value: encodedClientFilterValue(def, filters),
    neutral: def.neutral === undefined ? null : String(def.neutral),
  }))

  const standCounts: Record<string, number> = {
    active: stats.active + stats.placed,
    placed: stats.placed,
    unplaced: stats.unplaced,
    archived: stats.archived,
    all: stats.total,
  }

  // ── Saved groups: one chip each, the count resolved now, for this viewer
  const groupChips: ClientGroupChip[] = await Promise.all(
    groupRows.map(async (row) => {
      const parsed = parseGroupFilters(row.filters)
      const memberCount =
        parsed.success && currentUser
          ? await db.$count(resident, groupMembersWhere(parsed.data, currentUser, now))
          : null
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        href: parsed.success
          ? hrefFor(parsed.data, { ...layoutExtra, group: row.id })
          : '/residents',
        memberCount,
        active: row.id === groupParam,
        manageable: currentUser ? mayManageClientGroup(currentUser, row) : false,
      }
    }),
  )
  const openGroup = groupChips.find((g) => g.active) ?? null
  const hasFilteredOut = q !== '' || activeCount > 0 || filters.seat === 'mine'

  return (
    <PageShell>
      <PageHeader
        title="Klient*innen"
        description={`${shown.total} sichtbar · ${shown.unplaced} ohne Platzierung`}
        actions={
          <>
            {can('export:read') && (
              <ButtonLink href="/api/export/residents" variant="outline">
                {RESIDENT_LIST_LABELS.export}
              </ButtonLink>
            )}
            {can('residents:write') && (
              <ButtonLink href="/residents/new">{RESIDENT_LIST_LABELS.addResident}</ButtonLink>
            )}
          </>
        }
      />

      <Toolbar>
        <form method="GET" action="/residents" className="flex-1 flex items-center gap-2">
          {[...encodeClientFilters(filters, defaults)].map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          {layout === 'list' && <input type="hidden" name="layout" value="list" />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Suche nach Name oder Code…"
            className="input w-full md:max-w-sm"
            autoComplete="off"
          />
        </form>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            href={hrefFor(filters, { q })}
            className={`p-2 rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${layout !== 'list' ? 'bg-brand-primary/10 text-brand-primary' : 'text-ui-muted hover:bg-ui-subtle'}`}
            title="Kartenansicht"
            aria-label="Kartenansicht"
          >
            <LayoutGrid className="w-4 h-4" />
          </Link>
          <Link
            href={hrefFor(filters, { layout: 'list', q })}
            className={`p-2 rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${layout === 'list' ? 'bg-brand-primary/10 text-brand-primary' : 'text-ui-muted hover:bg-ui-subtle'}`}
            title="Listenansicht"
            aria-label="Listenansicht"
          >
            <List className="w-4 h-4" />
          </Link>
        </div>
        <TabLinkGroup label={UI_LABELS.filterNav}>
          {standDef.options(optionSources).map((option) => (
            <TabLink
              key={option.value}
              href={hrefFor(
                { ...filters, stand: option.value as typeof stand },
                { ...layoutExtra, q },
              )}
              label={option.label}
              count={standCounts[option.value]}
              active={stand === option.value}
            />
          ))}
        </TabLinkGroup>
      </Toolbar>

      <ClientFilterBar
        action="/residents"
        controls={filterControls}
        carry={{
          [standDef.param]: encodeClientFilters({ stand }, defaults).get(standDef.param) ?? '',
          layout: layout === 'list' ? 'list' : '',
          q,
        }}
        activeCount={activeCount}
        resetHref={resetHref}
      >
        {activeCount > 0 && !openGroup && (
          <SaveClientGroup
            filtersJson={JSON.stringify(savableClientFilters(filters))}
            currentHref={currentHref}
          />
        )}
      </ClientFilterBar>

      <ClientGroupChips groups={groupChips} />
      {openGroup?.manageable && <ManageClientGroup group={openGroup} afterDeleteHref={resetHref} />}

      {can('placements:write') && stand !== 'archived' && stats.unplaced > 0 && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium text-ui-text">
              {RESIDENT_LIST_LABELS.unplacedBanner(stats.unplaced)}
            </p>
            <p className="text-sm text-ui-muted">{RESIDENT_LIST_LABELS.unplacedBannerDesc}</p>
          </div>
          <ButtonLink href="/matching" variant="secondary">
            {RESIDENT_LIST_LABELS.startMatching}
          </ButtonLink>
        </div>
      )}

      {/* Three tiles, not four: status ACTIVE means "in care, not yet placed",
          so an "Aktiv" tile showed the same number as "Ohne Platzierung". */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={UI_LABELS.total} value={shown.total} />
        <StatCard label={RESIDENT_STATUS_LABELS.PLACED} value={shown.placed} />
        <StatCard
          label={RESIDENT_STAT_LABELS.unplaced}
          value={shown.unplaced}
          trend={shown.unplaced > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {can('import:write') && <CSVImport />}

      {residents.length === 0 ? (
        <EmptyState
          title={
            q
              ? `${RESIDENT_LIST_LABELS.emptyFiltered} («${q}»)`
              : hasFilteredOut
                ? RESIDENT_LIST_LABELS.emptyFiltered
                : stand === 'archived'
                  ? RESIDENT_LIST_LABELS.emptyArchived
                  : EMPTY_STATE_LABELS.noResidents
          }
          action={
            hasFilteredOut ? (
              <ButtonLink href={everyoneHref} variant="outline">
                {RESIDENT_LIST_LABELS.filterReset}
              </ButtonLink>
            ) : stand !== 'archived' && can('residents:write') ? (
              <ButtonLink href="/residents/new">{RESIDENT_LIST_LABELS.emptyFirst}</ButtonLink>
            ) : null
          }
        />
      ) : layout === 'list' ? (
        <ResidentsList
          residents={(residents as any[]).map((r) => ({
            ...r,
            incidentCount: incidentCountByResident.get(r.id) ?? 0,
          }))}
          canWrite={can('residents:write')}
        />
      ) : (
        <ClientBoard clients={sortedBoardItems} viewerRole={viewerRole} />
      )}
    </PageShell>
  )
}
