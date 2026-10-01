import type { Metadata } from 'next'
import { db, resident, placement, housingUnit } from '@/lib/db'
import { eq, and, inArray, notInArray, desc, asc } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export const metadata: Metadata = { title: 'Matching' }
import Link from 'next/link'
import { EMPTY_STATE_LABELS, PLACEMENT_CONCERN_LABELS, MATCHING_LABELS } from '@/lib/constants'
import { BRAND } from '@/lib/config/brand'
import { calculateCompatibility, getUnitFitConcerns } from '@/lib/compatibility'
import { calculateApartmentProfile, calculateApartmentFit } from '@/lib/compatibility/aggregate'
import { toResidentProfile } from '@/lib/compatibility/convert'
import { bestRoomFit } from '@/lib/compatibility/room-fit'
import { validateScoreForDiscrimination } from '@/lib/compatibility/safeguards'
import type { SafeguardWarning } from '@/lib/compatibility/safeguards'
import { calculateUnitMetrics, getSimilarPlacementSuccessRate } from '@/lib/analytics/unit-metrics'
import type { Resident } from '@/lib/db'
import type { ApartmentConflict } from '@/lib/compatibility/types'
import type {
  MatchResult,
  MatchUnit,
  CompatibilityDetail,
  ResidentWithPlacement,
  UnitMatch,
} from '@/lib/matching/types'
import { rankingFactors, rankingScore, type RankingInput } from '@/lib/matching/ranking'
import { ResidentSelectorPanel } from '@/components/matching/ResidentSelectorPanel'
import { UnitModePanel } from '@/components/matching/UnitModePanel'
import { MatchResultsPanel } from '@/components/matching/MatchResultsPanel'
import { residentName } from '@/lib/utils/resident-name'
import { requirePermission } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    resident?: string
    unit?: string
    new?: string
    q?: string
    mode?: string
  }>
}

export default async function MatchingPage({ searchParams }: Props) {
  await requirePermission('placements:write')
  const params = await searchParams
  const residentQuery = (params.q || '').trim().toLowerCase()

  // All four queries are independent — fetch in parallel
  const [unplacedResidents, placedResidents, totalResidentCount, availableUnits]: [
    Resident[],
    ResidentWithPlacement[],
    number,
    MatchUnit[],
  ] = await Promise.all([
    db.query.resident.findMany({
      // `placements: { none: { status: ACTIVE } }` — residents without an
      // active placement, expressed as a NOT IN subquery.
      where: and(
        eq(resident.status, 'ACTIVE'),
        notInArray(
          resident.id,
          db
            .select({ residentId: placement.residentId })
            .from(placement)
            .where(eq(placement.status, 'ACTIVE')),
        ),
      ),
      orderBy: [desc(resident.createdAt)],
    }),
    db.query.resident.findMany({
      // `placements: { some: { status: ACTIVE } }` — as an IN subquery.
      where: and(
        eq(resident.status, 'PLACED'),
        inArray(
          resident.id,
          db
            .select({ residentId: placement.residentId })
            .from(placement)
            .where(eq(placement.status, 'ACTIVE')),
        ),
      ),
      with: {
        placements: {
          where: eq(placement.status, 'ACTIVE'),
          with: { housingUnit: { columns: { id: true, code: true } } },
          limit: 1,
        },
      },
      orderBy: [asc(resident.code)],
    }),
    db.$count(resident),
    db.query.housingUnit.findMany({
      where: inArray(housingUnit.status, ['AVAILABLE', 'FULL']),
      with: {
        placements: {
          where: eq(placement.status, 'ACTIVE'),
          with: { resident: true },
        },
        spots: {
          with: {
            placements: {
              where: eq(placement.status, 'ACTIVE'),
              with: { resident: true },
            },
          },
        },
      },
      orderBy: [asc(housingUnit.code)],
    }),
  ])

  // If resident is selected, calculate matches
  let selectedResident: ResidentWithPlacement | null = null
  let matches: MatchResult[] = []

  // UNIT-SPECIFIC MODE: When unit is selected, show "who fits here"
  let selectedUnit: MatchUnit | null = null
  let unitMatches: UnitMatch[] = []

  if (params.unit && !params.resident) {
    selectedUnit = availableUnits.find((u) => u.id === params.unit) || null

    if (selectedUnit) {
      const currentResidents = selectedUnit.placements.map((p) => p.resident)
      const apartmentProfile = calculateApartmentProfile(
        currentResidents.map((r) => toResidentProfile(r)),
      )
      apartmentProfile.unitId = selectedUnit.id

      // Calculate fit for each unplaced resident
      unitMatches = unplacedResidents
        .map((resident) => {
          const residentProfile = toResidentProfile(resident)
          const apartmentFit = calculateApartmentFit(residentProfile, apartmentProfile)

          const { concerns } = getUnitFitConcerns(resident, selectedUnit!)

          return {
            resident,
            fitScore: apartmentFit.fitScore,
            apartmentFit,
            concerns,
          }
        })
        .filter(
          (m) =>
            !m.apartmentFit.conflicts.some((c: ApartmentConflict) => c.severity === 'BLOCKING'),
        )
        .sort((a, b) => b.fitScore - a.fitScore)
    }
  }

  if (params.resident) {
    const foundResident = await db.query.resident.findFirst({
      where: eq(resident.id, params.resident),
      with: {
        placements: {
          where: eq(placement.status, 'ACTIVE'),
          with: { housingUnit: { columns: { id: true, code: true } } },
          limit: 1,
        },
      },
    })
    selectedResident = foundResident ?? null

    if (foundResident) {
      const filteredUnits = availableUnits.filter((unit) => unit.placements.length < unit.totalBeds)

      // Calculate matches with unit metrics (async)
      matches = await Promise.all(
        filteredUnits.map(async (unit) => {
          const currentResidents = unit.placements.map((p) => p.resident)

          // Calculate apartment aggregate profile
          const apartmentProfile = calculateApartmentProfile(
            currentResidents.map((r) => toResidentProfile(r)),
          )
          apartmentProfile.unitId = unit.id

          // Calculate apartment fit for new resident
          const apartmentFit = calculateApartmentFit(
            toResidentProfile(foundResident),
            apartmentProfile,
          )

          // Get unit historical metrics
          let unitMetrics = null
          try {
            unitMetrics = await calculateUnitMetrics(unit.id)
          } catch (error) {
            logger.warn(`Failed to calculate metrics for unit ${unit.id}`, { unitId: unit.id })
          }

          // Get REAL success rate data from database
          let realSuccessData = null
          try {
            realSuccessData = await getSimilarPlacementSuccessRate(apartmentFit.fitScore, 10)
          } catch (error) {
            logger.warn('Failed to get success rate data')
          }

          // Calculate compatibility details with current residents
          const compatibilityDetails: CompatibilityDetail[] = []

          if (currentResidents.length > 0) {
            currentResidents.forEach((resident) => {
              const score = calculateCompatibility(
                toResidentProfile(foundResident),
                toResidentProfile(resident),
              )
              compatibilityDetails.push({
                resident,
                score,
              })
            })
          }

          // Check unit fit - collect real concerns
          const { concerns: unitConcerns, hasBlockingIssue } = getUnitFitConcerns(
            foundResident,
            unit,
            { includeSharedFacilities: true },
          )

          // Count shared languages with current residents
          const roommateLanguages = currentResidents.flatMap((r: Resident) => r.languages || [])
          const sharedLanguageCount = (foundResident.languages || []).filter((l: string) =>
            roommateLanguages.includes(l),
          ).length

          // Count total concerns from roommate compatibility
          const totalRoommateConcerns = compatibilityDetails.reduce(
            (sum, d) => sum + (d.score.concerns?.length || 0),
            0,
          )

          // Run discrimination safeguard checks on pairwise scores
          const safeguardWarnings: SafeguardWarning[] = []
          const residentProfile = toResidentProfile(foundResident)
          for (const detail of compatibilityDetails) {
            const result = validateScoreForDiscrimination(
              detail.score,
              residentProfile,
              toResidentProfile(detail.resident),
            )
            safeguardWarnings.push(...result.warnings)
          }

          const roomFit = bestRoomFit(
            foundResident,
            unit.spots.map((s) => ({
              id: s.id,
              type: s.type,
              parentSpotId: s.parentSpotId,
              code: s.code,
              status: s.status,
              placements: s.placements.map((p) => ({ resident: p.resident })),
            })),
          )
          // The ranking's stand-in for "fit" is the ROOM score wherever a room
          // can be scored — not the apartment score the card headlines. That
          // divergence is why the order needs explaining. @see lib/matching/ranking
          const roomScore = roomFit?.score ?? apartmentFit.fitScore

          const ranking: RankingInput = {
            hasBlockingIssue,
            blockingConflicts: apartmentFit.conflicts.filter((c) => c.severity === 'BLOCKING')
              .length,
            roomBlocking: !!roomFit?.blocking,
            highConflicts: apartmentFit.conflicts.filter((c) => c.severity === 'HIGH').length,
            riskLevel: unitMetrics?.riskLevel ?? null,
            unitConcerns: unitConcerns.length,
            roommateConcerns: totalRoommateConcerns,
            unscorableRoom: !!roomFit && roomFit.score === null,
            fitScore: roomScore,
            fitIsRoom: roomFit?.score != null,
            sharedLanguages: sharedLanguageCount,
            isEmptyUnit: currentResidents.length === 0,
          }

          return {
            unit,
            apartmentProfile,
            apartmentFit,
            unitMetrics,
            realSuccessData,
            compatibilityDetails,
            unitConcerns,
            hasBlockingIssue,
            sharedLanguageCount,
            totalRoommateConcerns,
            safeguardWarnings,
            bestRoomFit: roomFit,
            rankingFactors: rankingFactors(ranking),
            sortScore: rankingScore(ranking),
          }
        }),
      )

      // Sort matches by score
      matches = matches.sort((a, b) => a.sortScore - b.sortScore)
    }
  }

  const isNewResident = params.new === '1' && !!selectedResident
  const isUnitMode = !!selectedUnit && !selectedResident
  const fastMode =
    params.mode === 'fast' || (params.mode !== 'standard' && BRAND.features.matchingFastDefault)

  const filteredUnplacedResidents = unplacedResidents.filter((resident) => {
    if (!residentQuery) return true
    const languageText = (resident.languages || []).join(' ').toLowerCase()
    return (
      resident.code.toLowerCase().includes(residentQuery) || languageText.includes(residentQuery)
    )
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-ui-text">
          {isUnitMode
            ? MATCHING_LABELS.whoFitsIn(selectedUnit?.code ?? '')
            : isNewResident
              ? MATCHING_LABELS.findUnit
              : MATCHING_LABELS.title}
        </h1>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ui-muted min-w-0">
            {isUnitMode
              ? MATCHING_LABELS.findMatchingResidents(selectedUnit?.address ?? '')
              : isNewResident
                ? MATCHING_LABELS.step2SelectUnit(selectedResident?.code ?? '')
                : MATCHING_LABELS.findOptimalPlacement}
          </p>
          <Link
            href="/algorithm"
            className="inline-flex items-center min-h-[44px] px-1 text-sm text-brand-secondary hover:underline whitespace-nowrap shrink-0 sm:ml-4"
          >
            {EMPTY_STATE_LABELS.algorithmLink}
          </Link>
        </div>
      </div>

      {/* Step indicator for new residents */}
      {isNewResident && (
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="avatar-sm bg-status-success">✓</div>
            <span className="text-sm text-ui-muted">{MATCHING_LABELS.profileCaptured}</span>
          </div>
          <div className="flex-1 h-0.5 bg-status-success" />
          <div className="flex items-center gap-2">
            <div className="avatar-sm">2</div>
            <span className="text-sm font-medium text-ui-text">{MATCHING_LABELS.findUnit}</span>
          </div>
        </div>
      )}

      {/* Welcome banner for new residents */}
      {isNewResident && (
        <div className="mb-6 p-4 bg-status-success/10 border border-status-success/25 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">👤</span>
            <div>
              <h2 className="font-semibold text-status-success-text">
                {MATCHING_LABELS.residentCreated(
                  selectedResident ? residentName(selectedResident) : '',
                )}
              </h2>
              <p className="text-sm text-status-success-text mt-1">
                {MATCHING_LABELS.newResidentBannerDesc}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info banner for already-placed residents */}
      {selectedResident && selectedResident.placements.length > 0 && !isNewResident && (
        <div className="mb-6 p-4 bg-status-info/8 border border-status-info/25 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div>
              <h2 className="font-semibold text-status-info-text">
                {MATCHING_LABELS.whatIfTitle(residentName(selectedResident))}
              </h2>
              <p className="text-sm text-status-info-text mt-1">
                {MATCHING_LABELS.whatIfCurrentPlacement(
                  selectedResident.placements[0]?.housingUnit?.code ?? '',
                )}{' '}
                {MATCHING_LABELS.whatIfDesc}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel: Unplaced residents — pushed below results on mobile when results exist */}
        <div className={selectedResident || isUnitMode ? 'order-last lg:order-none' : undefined}>
          <ResidentSelectorPanel
            filteredUnplacedResidents={filteredUnplacedResidents}
            totalUnplaced={unplacedResidents.length}
            placedResidents={placedResidents}
            totalResidentCount={totalResidentCount}
            residentQuery={residentQuery}
            params={params}
          />
        </div>

        {/* Right panel: Matches, Unit mode, or available units — floats to top on mobile when active */}
        <div
          className={`card${selectedResident || isUnitMode ? ' order-first lg:order-none' : ''}`}
        >
          {isUnitMode && selectedUnit ? (
            <UnitModePanel selectedUnit={selectedUnit} unitMatches={unitMatches} />
          ) : selectedResident ? (
            <MatchResultsPanel
              selectedResident={selectedResident}
              matches={matches}
              isNewResident={isNewResident}
              fastMode={fastMode}
              searchQuery={params.q}
            />
          ) : (
            <>
              <h2 className="text-lg font-semibold text-ui-text mb-2">
                {MATCHING_LABELS.availableUnitsTitle(
                  availableUnits.filter((u) => u.placements.length < u.totalBeds).length,
                )}
              </h2>
              <p className="text-sm text-ui-muted mb-4">{MATCHING_LABELS.orSelectUnit}</p>
              <div className="space-y-2">
                {availableUnits
                  .filter((u) => u.placements.length < u.totalBeds)
                  .map((u) => {
                    const freeBeds = u.totalBeds - u.placements.length
                    return (
                      <Link
                        key={u.id}
                        href={`/matching?unit=${u.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-ui-border hover:border-brand-primary hover:bg-brand-accent transition-colors"
                      >
                        <div>
                          <p className="font-medium text-ui-text">{u.code}</p>
                          <p className="text-xs text-ui-muted">{u.address}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-brand-secondary">
                            {MATCHING_LABELS.freeBeds(freeBeds, u.totalBeds)}
                          </p>
                          {u.wheelchairAccess && <span className="text-xs text-ui-muted">♿</span>}
                        </div>
                      </Link>
                    )
                  })}
              </div>
              <p className="text-xs text-ui-muted mt-4 text-center">
                {MATCHING_LABELS.selectResidentForMatches}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
