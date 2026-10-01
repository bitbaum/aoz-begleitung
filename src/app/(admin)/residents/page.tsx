import type { Metadata } from 'next'
import { db, escapeLike, resident, placement, incident, satisfactionCheckIn } from '@/lib/db'
import { eq, and, or, gte, inArray, notInArray, isNotNull, ilike, desc, count } from 'drizzle-orm'
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

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ view?: string; q?: string; layout?: string; filter?: string }>
}

export default async function ResidentsListPage({ searchParams }: Props) {
  const params = await searchParams
  const view = params.view || 'active'
  const q = params.q?.trim() || ''
  const layout = params.layout || 'board'
  const filterParam = params.filter === 'all' ? 'all' : params.filter === 'mine' ? 'mine' : null

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

  const residentsWhere = and(
    siteFilter ?? undefined,
    view === 'active'
      ? inArray(resident.status, ['ACTIVE', 'PLACED'])
      : view === 'archived'
        ? eq(resident.status, 'EXITED')
        : undefined,
    q
      ? or(
          ilike(resident.code, `%${escapeLike(q)}%`),
          ilike(resident.displayName, `%${escapeLike(q)}%`),
        )
      : undefined,
  )

  const [residents, statusGroups, unplacedCount, myResidentIds, incidentGroups] = await Promise.all(
    [
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
      // "My clients" — IDs where this user is a care worker
      currentUser ? getMyResidentIds(currentUser.id) : Promise.resolve([]),
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
    ],
  )

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

  const myResidentIdSet = new Set(myResidentIds)

  // Default to "Meine Klient*innen" only when the viewer actually has an
  // assigned caseload. A Leitung/admin with no assignments used to land on an
  // empty "Keine Klient*innen zugewiesen" board while 24 real clients sat one
  // click away behind "Alle" — an empty page as the default view of a full list.
  const filter: 'mine' | 'all' = filterParam ?? (myResidentIdSet.size > 0 ? 'mine' : 'all')

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
      isMyClient: myResidentIdSet.has(r.id),
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

  // Build URL base for filter toggle (preserves view + layout + q)
  const filterBase = `/residents?view=${view}&layout=${layout}${q ? `&q=${encodeURIComponent(q)}` : ''}`

  const layoutParam = layout === 'list' ? '&layout=list' : ''

  return (
    <PageShell>
      <PageHeader
        title="Klient*innen"
        description={`${stats.visible} sichtbar · ${stats.unplaced} ohne Platzierung`}
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
          <input type="hidden" name="view" value={view} />
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
            href={`/residents?view=${view}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`p-2 rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${layout !== 'list' ? 'bg-brand-primary/10 text-brand-primary' : 'text-ui-muted hover:bg-ui-subtle'}`}
            title="Kartenansicht"
            aria-label="Kartenansicht"
          >
            <LayoutGrid className="w-4 h-4" />
          </Link>
          <Link
            href={`/residents?view=${view}&layout=list${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`p-2 rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${layout === 'list' ? 'bg-brand-primary/10 text-brand-primary' : 'text-ui-muted hover:bg-ui-subtle'}`}
            title="Listenansicht"
            aria-label="Listenansicht"
          >
            <List className="w-4 h-4" />
          </Link>
        </div>
        <TabLinkGroup label={UI_LABELS.filterNav}>
          <TabLink
            href={`/residents?view=active${layoutParam}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            label={RESIDENT_LIST_LABELS.viewCurrent}
            count={stats.active + stats.placed}
            active={view === 'active'}
          />
          <TabLink
            href={`/residents?view=archived${layoutParam}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            label={UI_LABELS.archived}
            count={stats.archived}
            active={view === 'archived'}
          />
          <TabLink
            href={`/residents?view=all${layoutParam}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            label={UI_LABELS.all}
            count={stats.total}
            active={view === 'all'}
          />
        </TabLinkGroup>
      </Toolbar>

      {can('placements:write') && view !== 'archived' && stats.unplaced > 0 && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium text-ui-text">
              {stats.unplaced} {RESIDENT_LIST_LABELS.unplacedBannerSuffix}
            </p>
            <p className="text-sm text-ui-muted">{RESIDENT_LIST_LABELS.unplacedBannerDesc}</p>
          </div>
          <ButtonLink href="/matching" variant="secondary">
            {RESIDENT_LIST_LABELS.startMatching}
          </ButtonLink>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={UI_LABELS.total} value={stats.total} />
        <StatCard label={UI_LABELS.active} value={stats.active} />
        <StatCard label={RESIDENT_STATUS_LABELS.PLACED} value={stats.placed} />
        <StatCard
          label={RESIDENT_STAT_LABELS.unplaced}
          value={stats.unplaced}
          trend={stats.unplaced > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {can('import:write') && <CSVImport />}

      {residents.length === 0 ? (
        <EmptyState
          title={
            q
              ? `${RESIDENT_LIST_LABELS.emptyFiltered} («${q}»)`
              : view === 'archived'
                ? RESIDENT_LIST_LABELS.emptyArchived
                : EMPTY_STATE_LABELS.noResidents
          }
          action={
            q ? (
              <ButtonLink href={`/residents?view=${view}`} variant="outline">
                {RESIDENT_LIST_LABELS.filterReset}
              </ButtonLink>
            ) : view !== 'archived' && can('residents:write') ? (
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
          canWrite={
            viewerRole === 'ADMIN' || viewerRole === 'BETREUUNG' || viewerRole === 'SOZIALARBEIT'
          }
        />
      ) : (
        <ClientBoard
          clients={sortedBoardItems}
          viewerRole={viewerRole}
          filter={filter}
          baseHref={filterBase}
        />
      )}
    </PageShell>
  )
}
