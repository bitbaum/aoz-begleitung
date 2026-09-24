import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { StatCard } from '@/components/ui/Card'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ListShell, PageHeader, PageShell, Toolbar } from '@/components/ui/Page'
import { BoardSwitcher } from '@/components/ui/BoardSwitcher'
import { catalogueTabs } from '@/lib/config/catalogue'
import { resolveIntegrationBoard, type IntegrationBoardId } from '@/lib/config/integration-boards'
import {
  boardOpportunityKinds,
  OPPORTUNITY_KIND_ICONS,
  OPPORTUNITY_KIND_LABELS,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_BADGES,
  OPPORTUNITY_STATUS_LABELS,
  PERMIT_REQUIREMENT_BADGES,
  PERMIT_REQUIREMENT_LABELS,
  type OpportunityKindId,
  type OpportunityStatusId,
} from '@/lib/config/opportunities'
import { countActive, listOpportunities, opportunityStats } from '@/lib/data/opportunities'
import { openSeats } from '@/lib/opportunities/pipeline'
import { isAwaitingAnswer } from '@/lib/jobcoach/queue'
import { OPPORTUNITIES_ADMIN_LABELS as L } from '@/lib/constants'

export const metadata: Metadata = { title: L.pageTitle }
export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    status?: string | string[]
    kind?: string | string[]
    q?: string | string[]
    board?: string | string[]
  }>
}

function firstParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export default async function OpportunitiesPage({ searchParams }: Props) {
  const staff = await requirePermission('opportunities:read')
  const canWrite = hasPermission(staff, 'opportunities:write')
  const params = await searchParams

  const statusParam = firstParam(params.status)
  const kindParam = firstParam(params.kind)
  const query = firstParam(params.q).trim()

  const status = (OPPORTUNITY_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as OpportunityStatusId)
    : undefined
  const kind = kindParam in OPPORTUNITY_KIND_LABELS ? (kindParam as OpportunityKindId) : undefined

  // No `?board=` means nobody has chosen, so the role answers. Simon opens on
  // work, Sandra on volunteering, Franziska on everything — and each of them
  // stops setting the same filter on every visit.
  const board = resolveIntegrationBoard(firstParam(params.board), staff.role)
  const boardKinds = boardOpportunityKinds(board)

  const [stats, opportunities] = await Promise.all([
    opportunityStats(boardKinds),
    listOpportunities({ status, kind, kinds: boardKinds, query }),
  ])

  // The board is not a filter to reset — it is where this coach works. Clearing
  // filters must land them back on their own half, not on everybody's.
  const hasFilters = Boolean(status || kind || query)
  const boardHref = (next: IntegrationBoardId) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (kind) params.set('kind', kind)
    if (query) params.set('q', query)
    params.set('board', next)
    return `/opportunities?${params.toString()}`
  }

  return (
    <PageShell>
      <PageHeader
        title={L.pageTitle}
        description={L.pageDescription}
        actions={
          canWrite ? <ButtonLink href="/opportunities/new">{L.newAction}</ButtonLink> : undefined
        }
      />

      <BoardSwitcher
        label={L.boardSwitcherLabel}
        current={board}
        items={catalogueTabs({
          boardHref,
          canReadListings: true,
          canReadActivities: hasPermission(staff, 'activities:read'),
        })}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={L.statTotal} value={stats.total} />
        <StatCard label={L.statPublished} value={stats.published} />
        <StatCard label={L.statDrafts} value={stats.drafts} />
        <StatCard label={L.statActivePeople} value={stats.activePeople} />
        <StatCard label={L.statOpenThreads} value={stats.openThreads} />
        {/* The only one of these six where a person, not a process, is
            waiting. @see lib/jobcoach/queue.ts */}
        <StatCard label={L.statAwaiting} value={stats.awaitingAnswer} />
      </div>

      <Toolbar>
        <form
          method="GET"
          action="/opportunities"
          className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_auto]"
        >
          {/* A GET form rebuilds the query string from its fields alone, so
              without this, applying any filter would silently throw the coach
              back to whichever board their role defaults to. */}
          <input type="hidden" name="board" value={board} />
          <div>
            <label htmlFor="opportunity-search" className="label">
              {L.filterSearch}
            </label>
            <input
              id="opportunity-search"
              type="search"
              name="q"
              defaultValue={query}
              placeholder={L.filterSearchPlaceholder}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="opportunity-kind" className="label">
              {L.filterKind}
            </label>
            <select id="opportunity-kind" name="kind" defaultValue={kind ?? ''} className="input">
              <option value="">{L.filterAll}</option>
              {Object.entries(OPPORTUNITY_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="opportunity-status" className="label">
              {L.filterStatus}
            </label>
            <select
              id="opportunity-status"
              name="status"
              defaultValue={status ?? ''}
              className="input"
            >
              <option value="">{L.filterAll}</option>
              {Object.entries(OPPORTUNITY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary min-h-[44px]">
              {L.apply}
            </button>
            <Link
              href="/opportunities"
              className="btn-outline min-h-[44px] inline-flex items-center"
            >
              {L.filterReset}
            </Link>
          </div>
        </form>
      </Toolbar>

      {opportunities.length === 0 ? (
        <EmptyState
          title={hasFilters ? L.noResults : L.emptyTitle}
          description={hasFilters ? undefined : L.emptyBody}
          action={
            hasFilters ? (
              <ButtonLink href="/opportunities" variant="outline">
                {L.filterReset}
              </ButtonLink>
            ) : canWrite ? (
              <ButtonLink href="/opportunities/new" variant="outline">
                {L.emptyAction}
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <ListShell>
          <div className="divide-y divide-ui-border">
            {opportunities.map((opportunity) => {
              const Icon = OPPORTUNITY_KIND_ICONS[opportunity.kind]
              const stages = opportunity.applications.map((a) => a.stage)
              const free = openSeats(opportunity, stages)
              const active = countActive(opportunity.applications)
              const waiting = opportunity.applications.filter(isAwaitingAnswer).length

              return (
                <div key={opportunity.id} className="px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-brand-primary" />
                        <Link
                          href={`/opportunities/${opportunity.id}`}
                          className="inline-flex min-h-[44px] items-center font-semibold text-ui-text hover:text-brand-primary"
                        >
                          {opportunity.title}
                        </Link>
                        <span className={`badge ${OPPORTUNITY_STATUS_BADGES[opportunity.status]}`}>
                          {OPPORTUNITY_STATUS_LABELS[opportunity.status]}
                        </span>
                        {/* Beside the title rather than down with the counts:
                            it is the reason to open this row today. */}
                        {waiting > 0 ? (
                          <span className="chip chip-warning">
                            {waiting} {L.awaitingAnswer}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm text-ui-muted">
                        {opportunity.organisation}
                        {opportunity.location ? ` · ${opportunity.location}` : ''}
                        {opportunity.schedule ? ` · ${opportunity.schedule}` : ''}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ui-muted">
                        <span>{OPPORTUNITY_KIND_LABELS[opportunity.kind]}</span>
                        <span
                          className={`chip ${PERMIT_REQUIREMENT_BADGES[opportunity.permitRequirement]}`}
                        >
                          {PERMIT_REQUIREMENT_LABELS[opportunity.permitRequirement]}
                        </span>
                        {opportunity.germanLevel ? (
                          <span className="chip chip-neutral">
                            {L.germanLevel} {opportunity.germanLevel}
                          </span>
                        ) : null}
                        {/* null seats means the listing never stated a number —
                            rendering that as "0 frei" would hide the place. */}
                        <span className="numeric">
                          {free === null
                            ? L.seatsUnknown
                            : free === 0
                              ? L.seatsFull
                              : `${free} ${L.seatsFree}`}
                        </span>
                        <span className="numeric">
                          {active} {L.peopleUnderway}
                        </span>
                      </div>
                    </div>

                    <ButtonLink href={`/opportunities/${opportunity.id}`} variant="outline">
                      {L.open}
                    </ButtonLink>
                  </div>
                </div>
              )
            })}
          </div>
        </ListShell>
      )}
    </PageShell>
  )
}
