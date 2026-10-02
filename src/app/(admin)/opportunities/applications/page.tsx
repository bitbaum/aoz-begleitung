import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { claimApplication } from '@/lib/actions/opportunities'
import { BoardSwitcher } from '@/components/ui/BoardSwitcher'
import { EmptyState, PageHeader, PageShell, Toolbar } from '@/components/ui/Page'
import { ApplicationStageControls } from '@/components/opportunities/ApplicationStageControls'
import {
  INTEGRATION_BOARD_IDS,
  resolveViewerIntegrationBoard,
  type IntegrationBoardId,
} from '@/lib/config/integration-boards'
import {
  APPLICATION_STAGE_BADGES,
  APPLICATION_STAGE_LABELS,
  APPLICATIONS_REVIEW_PATH,
  boardOpportunityKinds,
} from '@/lib/config/opportunities'
import { listApplicationsForReview, listingsForReview } from '@/lib/data/opportunities'
import {
  AWAITING_GROUP_ID,
  daysSince,
  groupApplicationsForReview,
  type ReviewGroup,
} from '@/lib/opportunities/review'
import type { ReviewApplicationRow } from '@/lib/data/opportunities'
import { residentName } from '@/lib/utils/resident-name'
import { OPPORTUNITIES_ADMIN_LABELS as L } from '@/lib/constants'

export const metadata: Metadata = { title: L.reviewTitle }
export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ board?: string | string[]; listing?: string | string[] }>
}

function firstParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function ReviewRow({
  row,
  awaiting,
  canWrite,
}: {
  row: ReviewApplicationRow
  awaiting: boolean
  canWrite: boolean
}) {
  // An unanswered request has waited since it was raised; anything else has
  // been where it is since it last moved.
  const since = daysSince(awaiting ? row.createdAt : row.stageChangedAt)

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2">
        <Link
          href={`/residents/${row.resident.id}`}
          className="inline-flex min-h-[44px] items-center font-medium text-ui-text hover:text-brand-primary"
        >
          {residentName(row.resident)}
        </Link>
        <span className={`badge ${APPLICATION_STAGE_BADGES[row.stage]}`}>
          {APPLICATION_STAGE_LABELS[row.stage]}
        </span>
        {row.learningRecord ? <span className="chip chip-success">{L.evidenceCreated}</span> : null}
      </div>

      <Link
        href={`/opportunities/${row.opportunity.id}`}
        className="inline-flex min-h-[44px] max-w-full items-center text-sm text-ui-text hover:text-brand-primary"
      >
        <span className="truncate">
          {row.opportunity.title}
          <span className="text-ui-muted"> · {row.opportunity.organisation}</span>
        </span>
      </Link>

      <p className="text-xs text-ui-muted">
        <span className="numeric">{L.reviewSince(since)}</span>
        {' · '}
        {L.supportedBy}: {row.supportedBy?.name ?? L.supportedByNobody}
      </p>

      {row.note ? <p className="mt-2 text-sm text-ui-text">{row.note}</p> : null}

      {canWrite && awaiting ? (
        // Taking a request up without moving it: "I am answering this person."
        // The next-step buttons below claim it too, as a side effect.
        <form action={claimApplication} className="mt-3">
          <input type="hidden" name="applicationId" value={row.id} />
          <button type="submit" className="btn-secondary min-h-[44px]">
            {L.reviewClaim}
          </button>
        </form>
      ) : null}

      {canWrite ? (
        <ApplicationStageControls
          applicationId={row.id}
          stage={row.stage}
          listingStatus={row.opportunity.status}
        />
      ) : null}
    </li>
  )
}

function ReviewSection({
  group,
  canWrite,
}: {
  group: ReviewGroup<ReviewApplicationRow>
  canWrite: boolean
}) {
  const awaiting = group.id === AWAITING_GROUP_ID
  const rows = (
    <ul className="mt-3 divide-y divide-ui-border">
      {group.rows.map((row) => (
        <ReviewRow key={row.id} row={row} awaiting={awaiting} canWrite={canWrite} />
      ))}
    </ul>
  )

  // Finished threads stay reachable but closed: nothing on them is work.
  if (group.closed) {
    return (
      <section className="card" aria-label={group.label}>
        <details>
          <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ui-text">{group.label}</h2>
            <span className="numeric text-sm text-ui-muted">{group.rows.length}</span>
          </summary>
          {rows}
        </details>
      </section>
    )
  }

  return (
    <section className="card" aria-label={group.label}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ui-text">{group.label}</h2>
        <span className={`numeric ${awaiting ? 'chip chip-warning' : 'text-sm text-ui-muted'}`}>
          {group.rows.length}
        </span>
      </div>
      {awaiting ? <p className="mt-1 text-sm text-ui-muted">{L.awaitingHint}</p> : null}
      {rows}
    </section>
  )
}

export default async function ApplicationsReviewPage({ searchParams }: Props) {
  const staff = await requirePermission('opportunities:read')
  const canWrite = hasPermission(staff, 'opportunities:write')
  const params = await searchParams

  // No `?board=` means the viewer's reach answers: a Jobcoach reviews jobs,
  // the Freiwilligenarbeit coordinator volunteering, ALL_DOMAINS everything —
  // the same split the Eingang uses for whose requests are whose.
  const board = resolveViewerIntegrationBoard(firstParam(params.board), staff)
  const kinds = boardOpportunityKinds(board)

  const listings = await listingsForReview(kinds)
  // A listing from another board (an old link, a switched board) is ignored
  // rather than shown empty, which would read as "nobody applied".
  const listingParam = firstParam(params.listing)
  const listing = listings.find((row) => row.id === listingParam) ?? null

  const applications = await listApplicationsForReview({
    kinds,
    opportunityId: listing?.id,
  })
  const groups = groupApplicationsForReview(applications)

  const boardHref = (next: IntegrationBoardId) => `${APPLICATIONS_REVIEW_PATH}?board=${next}`

  return (
    <PageShell>
      <PageHeader title={L.reviewTitle} description={L.reviewDescription} />

      <BoardSwitcher
        label={L.boardSwitcherLabel}
        current={board}
        items={INTEGRATION_BOARD_IDS.map((id) => ({
          id,
          label: L.boards[id],
          href: boardHref(id),
        }))}
      />

      {listings.length > 0 ? (
        <Toolbar>
          <form
            method="GET"
            action={APPLICATIONS_REVIEW_PATH}
            className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]"
          >
            {/* A GET form rebuilds the query from its fields alone; without
                this, narrowing to a listing would drop the chosen board. */}
            <input type="hidden" name="board" value={board} />
            <div>
              <label htmlFor="review-listing" className="label">
                {L.reviewListingFilter}
              </label>
              <select
                id="review-listing"
                name="listing"
                defaultValue={listing?.id ?? ''}
                className="input"
              >
                <option value="">{L.reviewAllListings}</option>
                {listings.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <button type="submit" className="btn-primary min-h-[44px]">
                {L.apply}
              </button>
              {listing ? (
                <Link
                  href={boardHref(board)}
                  className="btn-outline min-h-[44px] inline-flex items-center"
                >
                  {L.filterReset}
                </Link>
              ) : null}
            </div>
          </form>
        </Toolbar>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState title={listing ? L.reviewEmptyFiltered : L.reviewEmpty} />
      ) : (
        groups.map((group) => <ReviewSection key={group.id} group={group} canWrite={canWrite} />)
      )}
    </PageShell>
  )
}
