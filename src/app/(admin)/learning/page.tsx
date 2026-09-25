import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { listLearningBoard } from '@/lib/actions/learning'
import { PageHeader, Toolbar } from '@/components/ui/Page'
import { StatCard } from '@/components/ui/Card'
import { IntegrationBoard } from '@/components/learning/IntegrationBoard'
import { BoardSwitcher } from '@/components/ui/BoardSwitcher'
import {
  INTEGRATION_BOARD_IDS,
  resolveIntegrationBoard,
  type IntegrationBoardId,
} from '@/lib/config/integration-boards'
import {
  LEARNING_CATEGORIES,
  LEARNING_CATEGORY_LABELS,
  LEARNING_AREA_NAME,
  LEARNING_LABELS,
  LEARNING_STATUSES,
  LEARNING_STATUS_LABELS,
  type LearningCategoryId,
  type LearningStatusId,
} from '@/lib/config/learning'
import { residentName } from '@/lib/utils/resident-name'

export const metadata: Metadata = { title: LEARNING_AREA_NAME }
export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    board?: string | string[]
    status?: string | string[]
    q?: string | string[]
    mine?: string | string[]
    source?: string | string[]
    category?: string | string[]
  }>
}

function firstParam(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function boardTitle(board: IntegrationBoardId): string {
  if (board === 'job') return LEARNING_LABELS.boardJob
  if (board === 'volunteering') return LEARNING_LABELS.boardVolunteering
  return LEARNING_LABELS.boardOverview
}

export default async function LearningQueuePage({ searchParams }: Props) {
  const staff = await requirePermission('learning:read')
  const params = await searchParams
  const role = staff.role

  const boardParam = firstParam(params.board)
  const statusParam = firstParam(params.status)
  const queryParam = firstParam(params.q)
  const mineParam = firstParam(params.mine)
  const sourceParam = firstParam(params.source)
  const categoryParam = firstParam(params.category)

  const board = resolveIntegrationBoard(boardParam, role)
  // Keys on SCOPE, not role. It read `role === 'ADMIN'` — a role retired when
  // the three axes landed — so the all-domains Betreuerin (BETREUUNG + ALL_DOMAINS, the shape
  // that replaced ADMIN for oversight) silently defaulted to their own caseload,
  // while the dashboard tile counting the same records keys on scope. That tile
  // and the page it links to reported different numbers.
  const mineDefault = staff.scope === 'ALL_DOMAINS' ? '0' : '1'
  const mine = mineParam === '0' || mineParam === '1' ? mineParam : mineDefault
  const status = (LEARNING_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as LearningStatusId)
    : 'ALL'
  const query = queryParam.trim()
  const source = sourceParam === 'RESIDENT' || sourceParam === 'STAFF' ? sourceParam : 'ALL'
  const category = (LEARNING_CATEGORIES as readonly string[]).includes(categoryParam)
    ? (categoryParam as LearningCategoryId)
    : 'ALL'

  const hasActiveFilters =
    status !== 'ALL' ||
    query.length > 0 ||
    source !== 'ALL' ||
    category !== 'ALL' ||
    mine !== mineDefault

  const { records, missingGerman, stats } = await listLearningBoard({
    board,
    status,
    query,
    mineOnly: mine !== '0',
    recordedBy: source,
    category,
  })

  const queryBits = new URLSearchParams()
  if (status !== 'ALL') queryBits.set('status', status)
  if (query) queryBits.set('q', query)
  if (mine !== mineDefault) queryBits.set('mine', mine)
  if (source !== 'ALL') queryBits.set('source', source)
  if (category !== 'ALL') queryBits.set('category', category)
  const boardHref = (nextBoard: IntegrationBoardId) => {
    const next = new URLSearchParams(queryBits)
    next.set('board', nextBoard)
    return `/learning?${next.toString()}`
  }

  return (
    <div className="space-y-6">
      <PageHeader title={LEARNING_LABELS.boardTitle} description={LEARNING_LABELS.boardSubtitle} />

      <BoardSwitcher
        label={LEARNING_LABELS.boardSwitcherLabel}
        current={board}
        items={INTEGRATION_BOARD_IDS.map((id) => ({
          id,
          label: boardTitle(id),
          href: boardHref(id),
        }))}
      />

      <Toolbar>
        <form
          method="GET"
          action="/learning"
          className="grid w-full grid-cols-1 gap-3 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))_auto]"
        >
          <input type="hidden" name="board" value={board} />
          <div>
            <label htmlFor="learning-search" className="label">
              {LEARNING_LABELS.filterSearch}
            </label>
            <input
              id="learning-search"
              type="search"
              name="q"
              defaultValue={query}
              placeholder={LEARNING_LABELS.filterSearchPlaceholder}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="learning-status" className="label">
              {LEARNING_LABELS.filterStatus}
            </label>
            <select id="learning-status" name="status" defaultValue={status} className="input">
              <option value="ALL">Alle</option>
              {Object.entries(LEARNING_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="learning-source" className="label">
              {LEARNING_LABELS.filterSource}
            </label>
            <select id="learning-source" name="source" defaultValue={source} className="input">
              <option value="ALL">{LEARNING_LABELS.sourceAll}</option>
              <option value="RESIDENT">{LEARNING_LABELS.sourceResident}</option>
              <option value="STAFF">{LEARNING_LABELS.sourceStaff}</option>
            </select>
          </div>
          <div>
            <label htmlFor="learning-category" className="label">
              {LEARNING_LABELS.filterCategory}
            </label>
            <select
              id="learning-category"
              name="category"
              defaultValue={category}
              className="input"
            >
              <option value="ALL">Alle Bereiche</option>
              {Object.entries(LEARNING_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="learning-mine" className="label">
              Sicht
            </label>
            <select id="learning-mine" name="mine" defaultValue={mine} className="input">
              <option value="1">{LEARNING_LABELS.filterMine}</option>
              <option value="0">{LEARNING_LABELS.filterAll}</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary min-h-[44px]">
              Anwenden
            </button>
            <Link
              href={`/learning?board=${board}`}
              className="btn-outline min-h-[44px] inline-flex items-center"
            >
              Zurücksetzen
            </Link>
          </div>
        </form>
      </Toolbar>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total" value={stats.total} />
        <StatCard label={LEARNING_LABELS.planned} value={stats.planned} />
        <StatCard label={LEARNING_LABELS.inProgress} value={stats.inProgress} />
        <StatCard label="Abgeschlossen" value={stats.completed} />
        <StatCard label="Selbst eingetragen" value={stats.residentLogged} />
      </div>

      {board !== 'volunteering' && missingGerman.length > 0 && (
        <section className="card border border-status-warning/30 bg-status-warning/5">
          <h2 className="text-lg font-semibold text-ui-text mb-1">
            {LEARNING_LABELS.germanMissing}
          </h2>
          <p className="text-sm text-ui-muted mb-4">{LEARNING_LABELS.noGermanHint}</p>
          <ul className="space-y-3">
            {missingGerman.slice(0, 8).map((resident) => (
              <li
                key={resident.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-ui-surface p-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/residents/${resident.id}`}
                    className="font-medium text-ui-text hover:underline"
                  >
                    {residentName(resident)}
                  </Link>
                  {/* resident-code-intentional — staff queue, they look people up by login code */}
                  <p className="text-xs text-ui-muted font-mono">
                    {/* resident-code-intentional */}
                    {resident.code}
                    {resident.placements[0]?.housingUnit.code
                      ? ` · ${resident.placements[0].housingUnit.code}`
                      : ''}
                  </p>
                </div>
                <Link
                  href={`/residents/${resident.id}`}
                  className="btn-outline text-sm min-h-[44px] inline-flex items-center"
                >
                  {LEARNING_LABELS.add}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ui-text">{boardTitle(board)}</h2>
          <p className="text-sm text-ui-muted">
            {records.length < stats.total
              ? `${records.length} von ${stats.total}`
              : `${stats.total} Einträge`}
          </p>
        </div>
        <IntegrationBoard
          records={records}
          emptyLabel={mine !== '0' ? LEARNING_LABELS.noMine : LEARNING_LABELS.noResults}
          emptyAction={
            hasActiveFilters && records.length === 0 ? (
              <Link
                href={`/learning?board=${board}`}
                className="btn-outline min-h-[44px] inline-flex items-center"
              >
                {LEARNING_LABELS.filterReset}
              </Link>
            ) : undefined
          }
        />
      </section>
    </div>
  )
}
