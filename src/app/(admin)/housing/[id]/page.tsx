import type { Metadata } from 'next'
import {
  db,
  housingUnit,
  placement,
  placementSpot,
  incident,
  compatibilityAssessment,
  resident as residentTable,
} from '@/lib/db'
import { eq, and, inArray, notInArray, asc, desc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  HOUSING_STATUS_LABELS,
  HARMONY_STATUS_LABELS,
  PLACEMENT_CONCERN_LABELS,
  COMPATIBILITY_MATRIX_LABELS,
  HOUSING_DETAIL_LABELS,
  RESIDENT_DETAIL_LABELS,
  PAGE_TITLES,
  FORM_LABELS,
  HOUSING_LABELS,
  ACTION_LABELS,
} from '@/lib/constants'
import {
  getScoreLabel,
  getScoreColorClass,
  getHarmonyColorClass,
  formatDate,
  getDateDaysAgo,
  getHarmonyStatus,
  type HarmonyStatus,
} from '@/lib/utils'
import { DISPLAY_LIMITS, QUERY_LIMITS } from '@/lib/config/thresholds'
import { RoomVisualizationWithPlacement } from '@/components/housing/RoomVisualizationWithPlacement'
import { CompatibilityMatrixInteractive } from '@/components/housing/CompatibilityMatrixInteractive'
import { ApartmentProfileCard } from '@/components/housing/ApartmentProfileCard'
import { HouseholdFitCard } from '@/components/housing/HouseholdFitCard'
import { householdFitNotes } from '@/lib/housing/fit-notes'
import { UnitOverviewCards } from '@/components/housing/UnitOverviewCards'
import { UnitSidebar } from '@/components/housing/UnitSidebar'
import { UnitRulesSection } from '@/components/governance/UnitRulesSection'
import { getRuleBook, getUnitAcknowledgementCoverage } from '@/lib/governance/queries'
import { UnitIncidentSection } from '@/components/housing/UnitIncidentSection'
import { WhoFitsHereCard } from '@/components/housing/WhoFitsHereCard'
import { calculateApartmentProfile, calculateApartmentFit } from '@/lib/compatibility/aggregate'
import { toResidentProfile } from '@/lib/compatibility/convert'
import { getUnitFitConcerns } from '@/lib/compatibility'
import { requirePermission } from '@/lib/auth'
import { getEntityAuditLog } from '@/lib/audit'
import { AuditTrail } from '@/components/admin/AuditTrail'
import type { Resident, CompatibilityAssessment } from '@/lib/db'
import type { ApartmentConflict } from '@/lib/compatibility/types'
import type { HousingSpot } from '@/components/housing/types'
import { hasResidentName, unitName, UNIT_NAME_SELECT } from '@/lib/utils/unit-name'
import {
  RESIDENT_NAME_SELECT,
  residentInitials,
  residentName,
  type NamedResident,
} from '@/lib/utils/resident-name'
import { toResidentUiSummary, type ResidentUiSummary } from '@/lib/housing/resident-ui'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  // Selects the nickname too, so the browser tab says what the residents call
  // the place. Selecting only `code` here is the exact under-selection that
  // UNIT_NAME_SELECT exists to prevent.
  const unit = await db.query.housingUnit.findFirst({
    where: eq(housingUnit.id, id),
    columns: UNIT_NAME_SELECT,
  })
  return { title: unit ? unitName(unit) : 'Unterkunft' }
}

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function HousingDetailPage({ params }: Props) {
  await requirePermission('housing:read')
  const { id } = await params

  const unit = await db.query.housingUnit.findFirst({
    where: eq(housingUnit.id, id),
    with: {
      spots: {
        with: {
          placements: {
            where: eq(placement.status, 'ACTIVE'),
            with: { resident: true },
          },
          childSpots: {
            with: {
              placements: {
                where: eq(placement.status, 'ACTIVE'),
                with: { resident: true },
              },
            },
          },
        },
        orderBy: [asc(placementSpot.code)],
      },
      placements: {
        where: eq(placement.status, 'ACTIVE'),
        with: {
          resident: true,
        },
        orderBy: [desc(placement.startDate)],
      },
      incidents: {
        orderBy: [desc(incident.date)],
        limit: QUERY_LIMITS.unitHistory,
        with: {
          reportedBy: { columns: RESIDENT_NAME_SELECT },
          subject: { columns: RESIDENT_NAME_SELECT },
        },
      },
    },
  })

  if (!unit) {
    notFound()
  }

  // Get compatibility assessments between current residents
  const residentIds = unit.placements.map((p) => p.residentId)
  const compatibilityScores =
    residentIds.length > 1
      ? await db.query.compatibilityAssessment.findMany({
          where: and(
            inArray(compatibilityAssessment.residentId, residentIds),
            inArray(compatibilityAssessment.comparedWithId, residentIds),
          ),
        })
      : []

  // Calculate harmony status using shared utility
  const avgCompatibility =
    compatibilityScores.length > 0
      ? compatibilityScores.reduce((sum, s) => sum + s.overallScore, 0) / compatibilityScores.length
      : 70
  const recentConflicts = unit.incidents.filter(
    (i: { category: string; date: Date | string }) =>
      i.category === 'INTERPERSONAL' && new Date(i.date) > getDateDaysAgo(30),
  ).length
  const harmonyStatus = getHarmonyStatus(avgCompatibility, recentConflicts)

  // Split incidents by category
  const interpersonalIncidents = unit.incidents.filter(
    (i) => i.category === 'INTERPERSONAL' || i.category === 'SAFETY',
  )
  const maintenanceIncidents = unit.incidents.filter((i) => i.category === 'MAINTENANCE')

  // What in this household could cause friction — about the household, never
  // a person. This used to rank residents by how often each was an incident's
  // subject, listing everyone at two or more. @see lib/housing/fit-notes.ts
  const fitNotes = householdFitNotes(
    unit.placements.map((p) => p.resident),
    unit.incidents,
  )

  const occupancy = unit.placements.length

  // Calculate who fits in this unit (only if there's space)
  let compatibleResidents: {
    resident: ResidentUiSummary
    fitScore: number
    strengths: string[]
    concerns: string[]
  }[] = []
  const hasAvailableSpace = unit.placements.length < unit.totalBeds

  if (hasAvailableSpace) {
    // Get unplaced residents (no active placement — Prisma's `none` relation
    // filter, expressed as a NOT IN subquery)
    const unplacedResidents = await db.query.resident.findMany({
      where: and(
        eq(residentTable.status, 'ACTIVE'),
        notInArray(
          residentTable.id,
          db
            .select({ id: placement.residentId })
            .from(placement)
            .where(eq(placement.status, 'ACTIVE')),
        ),
      ),
    })

    if (unplacedResidents.length > 0) {
      // Calculate apartment profile from current residents
      const currentResidents = unit.placements.map((p) => p.resident)
      const apartmentProfile = calculateApartmentProfile(
        currentResidents.map((r) => toResidentProfile(r)),
      )
      apartmentProfile.unitId = unit.id

      // Calculate fit for each unplaced resident
      compatibleResidents = unplacedResidents
        .map((resident) => {
          const residentProfile = toResidentProfile(resident)
          const fit = calculateApartmentFit(residentProfile, apartmentProfile)

          // Check for blocking concerns based on unit requirements
          const { concerns } = getUnitFitConcerns(resident, unit)

          // Add apartment-level blocking conflicts to concerns
          fit.conflicts
            .filter((c: ApartmentConflict) => c.severity === 'BLOCKING')
            .forEach((c: ApartmentConflict) => concerns.push(c.message))

          return {
            resident: toResidentUiSummary(resident),
            fitScore: fit.fitScore,
            strengths: fit.strengths.slice(0, 2),
            concerns,
          }
        })
        .filter(
          (m) =>
            !m.concerns.some(
              (c) =>
                c === PLACEMENT_CONCERN_LABELS.wheelchairRequired ||
                c === PLACEMENT_CONCERN_LABELS.groundFloorRequired,
            ),
        )
        .sort((a, b) => b.fitScore - a.fitScore)
        .slice(0, DISPLAY_LIMITS.topResidents)
    }
  }

  const [ruleBook, ruleCoverage, unitHistory] = await Promise.all([
    getRuleBook(unit.id),
    getUnitAcknowledgementCoverage(unit.id),
    // Who changed this flat, and when. Placements, spots and incidents log
    // under their own entities, so this stays to the unit record itself.
    getEntityAuditLog('HOUSING_UNIT', unit.id),
  ])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Link href="/housing" className="text-ui-muted hover:text-ui-muted">
              {PAGE_TITLES.housing}
            </Link>
            <span className="text-ui-muted">/</span>
            <span className="text-ui-text">{unit.code}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-ui-text mt-2">{unit.address}</h1>
          {/* The name the residents chose for their own home. Staff saw only
              the code, so the two groups who talk about this flat daily had no
              shared word for it. @see lib/utils/unit-name.ts */}
          {hasResidentName(unit) && (
            <p className="text-ui-muted mt-1">
              <span className="eyebrow">{HOUSING_LABELS.residentChosenName}</span>{' '}
              <span className="text-ui-text">{unitName(unit)}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <HarmonyBadge status={harmonyStatus} />
          <StatusBadge status={unit.status} />
          <Link href={`/housing/${unit.id}/edit`} className="btn-outline">
            {FORM_LABELS.edit}
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <UnitOverviewCards
        occupancy={occupancy}
        totalBeds={unit.totalBeds}
        totalRooms={unit.totalRooms}
        privateRooms={unit.privateRooms}
        sharedRooms={unit.sharedRooms}
        interpersonalIncidents={interpersonalIncidents}
        maintenanceIncidents={maintenanceIncidents}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Residents */}
        <div className="lg:col-span-2 space-y-6">
          {/* Room/Bed Visualization */}
          {unit.spots && unit.spots.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-ui-text">
                  {HOUSING_DETAIL_LABELS.spotsHeading}
                </h2>
                <Link href={`/housing/${unit.id}/spots`} className="btn-outline text-sm">
                  {HOUSING_DETAIL_LABELS.manageSpots}
                </Link>
              </div>
              <RoomVisualizationWithPlacement
                spots={unit.spots as unknown as HousingSpot[]}
                housingUnitId={unit.id}
                compatibleResidents={compatibleResidents}
              />
            </div>
          )}

          {/* Current Residents (legacy view for units without spots) */}
          {(!unit.spots || unit.spots.length === 0) && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-ui-text">
                  {HOUSING_DETAIL_LABELS.residentsHeading}
                </h2>
                <div className="flex gap-2">
                  <Link href={`/housing/${unit.id}/spots`} className="btn-primary text-sm">
                    {HOUSING_DETAIL_LABELS.defineSpots}
                  </Link>
                  <Link href={`/matching?unit=${unit.id}`} className="btn-outline text-sm">
                    {ACTION_LABELS.placeResident}
                  </Link>
                </div>
              </div>

              {unit.placements.length === 0 ? (
                <p className="text-ui-muted text-center py-8">
                  {HOUSING_DETAIL_LABELS.noActiveResidents}
                </p>
              ) : (
                <div className="space-y-3">
                  {unit.placements.map((placement) => (
                    <ResidentCard
                      key={placement.id}
                      placement={placement}
                      compatibilityScores={compatibilityScores}
                      otherResidentIds={residentIds.filter((id) => id !== placement.residentId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Apartment Profile Card */}
          {unit.placements.length > 0 && (
            <ApartmentProfileCard
              residents={unit.placements.map((p) => toResidentUiSummary(p.resident))}
            />
          )}

          {unit.placements.length > 1 && <HouseholdFitCard notes={fitNotes} />}

          {/* Who Fits Here - Only show if there's available space */}
          {hasAvailableSpace && (
            <WhoFitsHereCard
              unitId={unit.id}
              availableSpaces={unit.totalBeds - unit.placements.length}
              compatibleResidents={compatibleResidents}
            />
          )}

          {/* Compatibility Matrix */}
          {unit.placements.length > 1 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-ui-text mb-4">
                {COMPATIBILITY_MATRIX_LABELS.heading}
              </h2>
              <CompatibilityMatrixInteractive
                residents={unit.placements.map((p) => toResidentUiSummary(p.resident))}
                scores={compatibilityScores}
              />
            </div>
          )}

          {/* House rules — this unit's own rules, under the AOZ rules they
              specialise, plus how much of the book the residents have read. */}
          <UnitRulesSection ruleBook={ruleBook} coverage={ruleCoverage} unitCode={unit.code} />

          {/* Incidents */}
          <UnitIncidentSection
            unitId={unit.id}
            incidents={unit.incidents}
            interpersonalCount={interpersonalIncidents.length}
            maintenanceCount={maintenanceIncidents.length}
          />

          <details className="card">
            <summary className="min-h-[44px] cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center text-sm font-medium text-brand-secondary">
              {RESIDENT_DETAIL_LABELS.changeHistory}
            </summary>
            <p className="mt-1 text-xs text-ui-muted">{RESIDENT_DETAIL_LABELS.changeHistoryHint}</p>
            <div className="mt-3">
              <AuditTrail entries={unitHistory} showEntity={false} />
            </div>
          </details>
        </div>

        {/* Right column: Unit details */}
        <UnitSidebar unit={unit} />
      </div>
    </div>
  )
}

// Helper components

function HarmonyBadge({ status }: { status: HarmonyStatus }) {
  return (
    <span className={`badge ${getHarmonyColorClass(status)}`}>{HARMONY_STATUS_LABELS[status]}</span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const badgeClasses: Record<string, string> = {
    AVAILABLE: 'badge-active',
    FULL: 'badge-pending',
    MAINTENANCE: 'badge-alert',
    CLOSED: 'badge-ended',
  }

  return (
    <span className={`badge ${badgeClasses[status] || 'badge-ended'}`}>
      {HOUSING_STATUS_LABELS[status] || status}
    </span>
  )
}

interface ResidentCardPlacement {
  id: string
  residentId: string
  startDate: Date | string
  resident: NamedResident
}

function ResidentCard({
  placement,
  compatibilityScores,
  otherResidentIds,
}: {
  placement: ResidentCardPlacement
  compatibilityScores: CompatibilityAssessment[]
  otherResidentIds: string[]
}) {
  const avgScore =
    otherResidentIds.length > 0
      ? Math.round(
          compatibilityScores
            .filter(
              (s) =>
                (s.residentId === placement.residentId &&
                  otherResidentIds.includes(s.comparedWithId)) ||
                (s.comparedWithId === placement.residentId &&
                  otherResidentIds.includes(s.residentId)),
            )
            .reduce((sum, s) => sum + s.overallScore, 0) / Math.max(1, otherResidentIds.length),
        )
      : null

  return (
    <div className="flex items-center justify-between p-4 bg-ui-subtle rounded-lg">
      <div className="flex items-center gap-4">
        <div className="avatar">{residentInitials(placement.resident)}</div>
        <div>
          <p className="font-medium text-ui-text">{residentName(placement.resident)}</p>
          <p className="text-sm text-ui-muted">
            {HOUSING_DETAIL_LABELS.residentSince} {formatDate(placement.startDate)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {avgScore !== null && (
          <div className="text-right">
            <p className="text-sm text-ui-muted">{HOUSING_DETAIL_LABELS.avgCompatibility}</p>
            <p className={`font-medium ${getScoreColorClass(avgScore)}`}>
              {avgScore}% - {getScoreLabel(avgScore)}
            </p>
          </div>
        )}
        <Link
          href={`/residents/${placement.residentId}`}
          className="inline-flex items-center min-h-[44px] px-1 -ml-1 text-sm text-brand-primary hover:underline"
        >
          {HOUSING_DETAIL_LABELS.details}
        </Link>
      </div>
    </div>
  )
}
