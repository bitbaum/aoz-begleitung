import type { Metadata } from 'next'
import { BoardSwitcher } from '@/components/ui/BoardSwitcher'
import { DOSSIER_TABS, DOSSIER_TAB_LABELS, resolveDossierTab } from '@/lib/config/dossier'
import type { HousingUnit, Resident } from '@/lib/db'
import {
  db,
  resident as residentTable,
  placement,
  placementSpot,
  incident,
  learningRecord,
  compatibilityAssessment,
  housingUnit,
} from '@/lib/db'
import { eq, ne, and, inArray, notInArray, desc, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SPOT_TYPE_ICONS } from '@/lib/config/placement-spots'
import { getEligibleSpotTypes } from '@/lib/config/placement-spots'
import {
  PlacementActions,
  SatisfactionHistory,
  ResidentProfileSidebar,
  ResidentIncidents,
  CompatibleMatchesCard,
  TopCompatibilitiesCard,
  PlacementHistoryCard,
  LearningRecordsCard,
  CareTeamCard,
  CareWorkspace,
  ResidentDocumentsCard,
} from '@/components/residents'
import type { UnitCompatibilityData } from '@/components/residents/TransferRecommendations'
import { calculateCompatibility } from '@/lib/compatibility/scoring'
import { toResidentProfile } from '@/lib/compatibility/convert'
import { calculateApartmentProfile, calculateApartmentFit } from '@/lib/compatibility/aggregate'
import {
  AGE_RANGE_LABELS,
  GENDER_LABELS,
  FAMILY_STATUS_LABELS,
  RESIDENT_STATUS_LABELS,
  RESIDENT_DETAIL_LABELS,
  getLabel,
} from '@/lib/constants'
import { getEntityAuditLog } from '@/lib/audit'
import { clientFactsForDossier } from '@/lib/client-facts/dossier'
import { seatsForClient } from '@/lib/client-facts/access'
import { ClientFactsCard } from '@/components/residents/ClientFactsCard'
import { AuditTrail } from '@/components/admin/AuditTrail'
import { getPlacementCheckIns } from '@/lib/actions'
import {
  getStatusBadgeClass,
  getScoreLabel,
  getScoreColorClass,
  formatDate,
  weeksBetween,
} from '@/lib/utils'
import { QUERY_LIMITS } from '@/lib/config/thresholds'
import { residentInitials, residentName } from '@/lib/utils/resident-name'
import { getCurrentUser, hasPermission } from '@/lib/auth'
import {
  getCareTeam,
  listAssignableStaff,
  listCareAttributes,
  listResidentAppointments,
} from '@/lib/actions/care'
import { writableCareDomains } from '@/lib/config/care'
import { listResidentDocuments } from '@/lib/actions/documents'
import { listApplicationsForResident } from '@/lib/data/opportunities'
import { ResidentThreadsCard } from '@/components/opportunities/ResidentThreadsCard'
import { belongsToSameWorld, isDemoResidentCode, isDemoUnitCode } from '@/lib/analytics/real-data'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const resident = await db.query.resident.findFirst({
    where: eq(residentTable.id, id),
    columns: { code: true, displayName: true },
  })
  return { title: resident ? residentName(resident) : 'Klient*in' }
}

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ action?: string; tab?: string }>
}

export default async function ResidentDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const query = await searchParams

  const staff = await getCurrentUser()
  const canReadHousing = staff ? hasPermission(staff, 'housing:read') : false
  const canWriteResidents = staff ? hasPermission(staff, 'residents:write') : false
  const canWritePlacements = staff ? hasPermission(staff, 'placements:write') : false
  const canReadPlacements = staff ? hasPermission(staff, 'placements:read') : false
  const canWriteIncidents = staff ? hasPermission(staff, 'incidents:write') : false
  const canWriteLearning = staff ? hasPermission(staff, 'learning:write') : false
  const canReadDocuments = staff ? hasPermission(staff, 'documents:read') : false
  const canWriteDocuments = staff ? hasPermission(staff, 'documents:write') : false
  const canReadOpportunities = staff ? hasPermission(staff, 'opportunities:read') : false

  // resident and availableUnits are independent — fetch in parallel
  const [
    resident,
    availableUnits,
    careSeats,
    assignableStaff,
    careAttributes,
    careAppointments,
    documents,
    opportunityThreads,
    residentHistory,
    clientFacts,
  ] = await Promise.all([
    db.query.resident.findFirst({
      where: eq(residentTable.id, id),
      with: {
        placements: {
          with: {
            housingUnit: true,
            spot: true,
          },
          orderBy: [desc(placement.startDate)],
        },
        learningRecords: { orderBy: [desc(learningRecord.updatedAt)] },
        incidentsAsSubject: {
          with: {
            housingUnit: true,
          },
          orderBy: [desc(incident.date)],
          limit: QUERY_LIMITS.residentHistory,
        },
        incidentsReported: {
          with: {
            housingUnit: true,
          },
          orderBy: [desc(incident.date)],
          limit: QUERY_LIMITS.residentHistory,
        },
        assessments: {
          with: {
            comparedWith: true,
          },
          orderBy: [desc(compatibilityAssessment.overallScore)],
          limit: 5,
        },
      },
    }),
    // Available units for placement/transfer actions
    canWritePlacements
      ? db.query.housingUnit.findMany({
          where: inArray(housingUnit.status, ['AVAILABLE', 'FULL']),
          with: {
            spots: {
              where: and(
                eq(placementSpot.status, 'AVAILABLE'),
                ne(placementSpot.type, 'ROOM'), // Only assignable spots
              ),
              orderBy: [asc(placementSpot.code)],
            },
            placements: {
              where: eq(placement.status, 'ACTIVE'),
              with: { resident: true },
            },
          },
          orderBy: [asc(housingUnit.code)],
        })
      : Promise.resolve([]),
    getCareTeam(id),
    listAssignableStaff(),
    listCareAttributes(id),
    listResidentAppointments(id),
    // Only fetched when the viewer may see them — the list is cheap, but
    // "fetch then hide" is how a payload leaks what the markup conceals.
    canReadDocuments ? listResidentDocuments(id) : Promise.resolve([]),
    // Same rule as documents: fetched only for a viewer who may see them.
    canReadOpportunities ? listApplicationsForResident(id) : Promise.resolve([]),
    // RESIDENT entries only. The client-fact tables log under their own entity
    // names, so this cannot reveal that an insurance entry exists to a viewer
    // who may not read that kind.
    getEntityAuditLog('RESIDENT', id),
    // The client's own admin facts, narrowed by the SAME per-kind rule the
    // approval queue uses. A kind this viewer may not read is a query never
    // issued — the seats are fetched first because the policy takes them as
    // data rather than going to the database itself.
    staff
      ? seatsForClient(staff.id, id).then((seats) =>
          clientFactsForDossier(id, { scope: staff.scope, seatsForClient: seats }),
        )
      : Promise.resolve(null),
  ])

  if (!resident) {
    notFound()
  }

  const currentPlacement = resident.placements.find((p) => p.status === 'ACTIVE')
  const pastPlacements = resident.placements.filter((p) => p.status !== 'ACTIVE')

  // The check-in prefetch that used to live here fed only the always-on
  // satisfaction widget. With capture moved into closing an appointment, it
  // was a database round-trip on every client page whose result nothing read.
  // SatisfactionHistory below loads its own.

  // For unplaced residents: calculate compatible matches
  let compatibleUnits: { unit: HousingUnit; fitScore: number; residents: number }[] = []
  let compatibleResidents: { resident: Resident; score: number }[] = []

  // For placed residents: full compatibility data for transfer recommendations
  let unitCompatibility: Record<string, UnitCompatibilityData> = {}

  // Create resident profile for matching calculations
  const residentProfile = toResidentProfile(resident)

  // Which world this person belongs to. Every candidate list below is filtered
  // to match it, so a real client is never offered a demo flat and a demo
  // visitor still sees the matcher work. @see lib/analytics/real-data.ts
  const subjectIsDemo = isDemoResidentCode(resident.code)

  if (currentPlacement) {
    // Calculate full compatibility data for all available units (for transfer recommendations)
    // This includes: apartment fit score, pairwise compatibility with each resident
    for (const unit of availableUnits) {
      if (unit.id === currentPlacement.housingUnitId) continue // Skip current unit
      if (unit.spots.length === 0) continue // No available spots
      // A transfer recommendation across the demo boundary is the same bug as a
      // placement one, and worse: it proposes MOVING someone who already lives
      // somewhere into a flat that is deleted nightly.
      if (!belongsToSameWorld(subjectIsDemo, isDemoUnitCode(unit.code))) continue

      const currentResidentProfiles = unit.placements.map((p) => ({
        profile: toResidentProfile(p.resident),
        resident: p.resident,
      }))

      // Calculate apartment-level fit
      const apartmentProfile = calculateApartmentProfile(
        currentResidentProfiles.map((r) => r.profile),
      )
      const fit = calculateApartmentFit(residentProfile, apartmentProfile)

      // Calculate pairwise compatibility with each resident in the unit
      const residentsWithCompatibility = currentResidentProfiles.map(
        ({ profile, resident: otherResident }) => {
          const pairwise = calculateCompatibility(residentProfile, profile)
          // Extract key factors from the pairwise assessment
          const keyFactors: string[] = []
          if (pairwise.lifestyle >= 70) keyFactors.push(RESIDENT_DETAIL_LABELS.lifestyleSimilar)
          else if (pairwise.lifestyle < 40)
            keyFactors.push(RESIDENT_DETAIL_LABELS.lifestyleDifferent)
          if (pairwise.social >= 70) keyFactors.push(RESIDENT_DETAIL_LABELS.socialGood)
          else if (pairwise.social < 40) keyFactors.push(RESIDENT_DETAIL_LABELS.socialDifferent)
          if (pairwise.practical >= 70) keyFactors.push(RESIDENT_DETAIL_LABELS.practicalCompat)
          // Add strengths if any
          if (pairwise.strengths.length > 0) {
            keyFactors.push(...pairwise.strengths.slice(0, 2))
          }

          return {
            id: otherResident.id,
            code: otherResident.code,
            displayName: otherResident.displayName,
            compatibilityScore: Math.round(pairwise.overall),
            keyFactors: keyFactors.slice(0, 3), // Limit to 3 factors
          }
        },
      )

      unitCompatibility[unit.id] = {
        fitScore: fit.fitScore,
        strengths: fit.strengths,
        concerns: fit.warnings,
        residents: residentsWithCompatibility,
      }
    }
  }

  if (!currentPlacement && canWritePlacements) {
    // Both queries depend only on resident.id — fetch in parallel
    const [unitsWithResidents, otherUnplaced] = await Promise.all([
      db.query.housingUnit.findMany({
        where: inArray(housingUnit.status, ['AVAILABLE', 'FULL']),
        with: {
          placements: {
            where: eq(placement.status, 'ACTIVE'),
            with: { resident: true },
          },
          spots: { where: eq(placementSpot.status, 'AVAILABLE') },
        },
      }),
      db.query.resident.findMany({
        // `placements: { none: { status: ACTIVE } }` — no active placement,
        // expressed as a NOT IN subquery.
        where: and(
          ne(residentTable.id, resident.id),
          eq(residentTable.status, 'ACTIVE'),
          notInArray(
            residentTable.id,
            db
              .select({ residentId: placement.residentId })
              .from(placement)
              .where(eq(placement.status, 'ACTIVE')),
          ),
        ),
      }),
    ])

    // Calculate fit for each unit
    compatibleUnits = unitsWithResidents
      .filter((u) => u.spots.length > 0) // Has available spots
      // Never across the demo boundary. @see lib/analytics/real-data.ts
      .filter((u) => belongsToSameWorld(subjectIsDemo, isDemoUnitCode(u.code)))
      .map((unit) => {
        const currentResidents = unit.placements.map((p) => toResidentProfile(p.resident))
        const apartmentProfile = calculateApartmentProfile(currentResidents)
        const fit = calculateApartmentFit(residentProfile, apartmentProfile)
        return { unit, fitScore: fit.fitScore, residents: currentResidents.length }
      })
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 3)

    // Calculate pairwise compatibility
    compatibleResidents = otherUnplaced
      .filter((other) => belongsToSameWorld(subjectIsDemo, isDemoResidentCode(other.code)))
      .map((other) => {
        const otherProfile = toResidentProfile(other)
        const compat = calculateCompatibility(residentProfile, otherProfile)
        return { resident: other, score: compat.overall }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }

  // Sections with nothing this viewer may see are not offered at all.
  const visibleDossierTabs = DOSSIER_TABS.filter(
    (id) => id !== 'documents' || canReadDocuments || Boolean(clientFacts),
  )
  const dossierTab = resolveDossierTab({
    tab: query.tab,
    action: query.action,
    role: staff?.role ?? 'BETREUUNG',
    visible: visibleDossierTabs,
  })

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Link href="/residents" className="text-ui-muted hover:text-ui-muted">
              {RESIDENT_DETAIL_LABELS.breadcrumb}
            </Link>
            <span className="text-ui-muted">/</span>
            {/* The login code IS the identity here — staff read it out
                loud to residents. resident-code-intentional */}
            <span className="text-ui-text">{resident.code}</span>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="avatar-lg font-semibold">{residentInitials(resident)}</div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-ui-text">
                {residentName(resident)}
              </h1>
              <p className="text-ui-muted">
                {getLabel(AGE_RANGE_LABELS, resident.ageRange)} ·{' '}
                {getLabel(GENDER_LABELS, resident.gender)} ·{' '}
                {getLabel(FAMILY_STATUS_LABELS, resident.familyStatus)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`badge ${getStatusBadgeClass(resident.status)}`}>
            {getLabel(RESIDENT_STATUS_LABELS, resident.status)}
          </span>
          {/* This page already computed the permission flags; these three
              header buttons were the ones still ignoring them, so a Jobcoach
              was offered Verlegen / Bearbeiten / Platzieren and got a generic
              crash on click. */}
          {canWritePlacements && currentPlacement && (
            <Link
              href={`/residents/${resident.id}?tab=housing&action=transfer#placement-actions`}
              className="btn-primary"
            >
              {RESIDENT_DETAIL_LABELS.transferBtn}
            </Link>
          )}
          {canWriteResidents && (
            <Link href={`/residents/${resident.id}/edit`} className="btn-outline">
              {RESIDENT_DETAIL_LABELS.editBtn}
            </Link>
          )}
          {canWritePlacements && !currentPlacement && (
            <Link href={`/matching?resident=${resident.id}`} className="btn-primary">
              {RESIDENT_DETAIL_LABELS.placeBtn}
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Profile details */}
        <div className="lg:col-span-2 space-y-6">
          {/* The dossier in sections — the person first, then the places they
              could go, their roof, living together, their papers. It was one
              column of ten cards in the order they were added.
              @see lib/config/dossier.ts */}
          <BoardSwitcher
            label={RESIDENT_DETAIL_LABELS.sectionsLabel}
            current={dossierTab}
            items={visibleDossierTabs.map((id) => ({
              id,
              label: DOSSIER_TAB_LABELS[id],
              href: `/residents/${resident.id}?tab=${id}`,
            }))}
          />

          {dossierTab === 'overview' && (
            <>
              <CareTeamCard
                residentId={resident.id}
                seats={careSeats}
                staffOptions={assignableStaff}
                canWrite={false}
                writableDomains={staff ? writableCareDomains(staff) : []}
                title="Betreuungsteam"
                empty="Noch niemand zugewiesen."
              />

              <CareWorkspace
                residentId={resident.id}
                interpreterNeed={resident.interpreterNeed}
                attributes={careAttributes}
                appointments={careAppointments}
                writableDomains={staff ? writableCareDomains(staff) : []}
              />

              {/*
            Who changed this record, and when.
            `getEntityAuditLog` was written for exactly this and had no caller
            anywhere in the product — 120 write sites, and the only way to read
            any of it was the system-wide /audit page, which answers a
            different question. This one is the day-to-day one: "who edited
            this client, and why".
            Scoped to RESIDENT entries, so nothing here can reveal that a
            client-fact entry exists to somebody who may not read that kind.
          */}
              <details className="card">
                <summary className="min-h-[44px] cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center text-sm font-medium text-brand-secondary">
                  {RESIDENT_DETAIL_LABELS.changeHistory}
                </summary>
                <p className="mt-1 text-xs text-ui-muted">
                  {RESIDENT_DETAIL_LABELS.changeHistoryHint}
                </p>
                <div className="mt-3">
                  <AuditTrail entries={residentHistory} showEntity={false} />
                </div>
              </details>
            </>
          )}

          {dossierTab === 'integration' && (
            <>
              {/* Directly above the evidence, because that is where the evidence
              comes from: a thread reaching STARTED mints the LearningRecord
              below it. @see lib/opportunities/pipeline.ts */}
              {canReadOpportunities && <ResidentThreadsCard threads={opportunityThreads} />}

              <LearningRecordsCard
                residentId={resident.id}
                records={resident.learningRecords}
                canWrite={canWriteLearning}
              />
            </>
          )}

          {dossierTab === 'housing' && (
            <>
              {/* Current Placement */}
              <div className="card">
                <h2 className="text-lg font-semibold text-ui-text mb-4">
                  {RESIDENT_DETAIL_LABELS.currentPlacementTitle}
                </h2>
                {currentPlacement ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-status-success/10 rounded-lg">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 shrink-0 bg-status-success text-ui-on-accent rounded-lg flex items-center justify-center">
                          {'\u{1F3E0}'}
                        </div>
                        <div className="min-w-0">
                          {canReadHousing ? (
                            <Link
                              href={`/housing/${currentPlacement.housingUnitId}`}
                              className="inline-flex items-center py-2 -my-2 font-medium text-ui-text hover:text-brand-primary"
                            >
                              {currentPlacement.housingUnit.code}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center py-2 -my-2 font-medium text-ui-text">
                              {currentPlacement.housingUnit.code}
                            </span>
                          )}
                          <p className="text-sm text-ui-muted">
                            {currentPlacement.housingUnit.address}
                          </p>
                          {currentPlacement.spot && (
                            <p className="text-sm text-ui-muted">
                              {
                                SPOT_TYPE_ICONS[
                                  currentPlacement.spot.type as keyof typeof SPOT_TYPE_ICONS
                                ]
                              }{' '}
                              {currentPlacement.spot.label || currentPlacement.spot.code}
                            </p>
                          )}
                          <p className="text-sm text-ui-muted">
                            {RESIDENT_DETAIL_LABELS.since}
                            {formatDate(currentPlacement.startDate)}
                          </p>
                        </div>
                      </div>
                      {currentPlacement.compatibilityScore && (
                        <div className="text-left sm:text-right shrink-0">
                          <p className="text-sm text-ui-muted">
                            {RESIDENT_DETAIL_LABELS.compatibility}
                          </p>
                          <p
                            className={`text-lg font-semibold ${getScoreColorClass(
                              currentPlacement.compatibilityScore,
                            )}`}
                          >
                            {Math.round(currentPlacement.compatibilityScore)}% -{' '}
                            {getScoreLabel(currentPlacement.compatibilityScore)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* The score without the reasoning is the black box this
                    product's first principles forbid: "decisions must be
                    explainable". The argument was composed by
                    `buildPlacementRationale` and written to `placementNotes`
                    on every placement since that code existed, and no
                    component ever read the column. Collapsed, because it is
                    the answer to "why?" rather than something to read daily. */}
                    {currentPlacement.placementNotes && (
                      <details className="mt-4 border-t border-ui-border pt-4">
                        <summary className="min-h-[44px] cursor-pointer text-sm font-medium text-brand-primary list-none [&::-webkit-details-marker]:hidden flex items-center">
                          {RESIDENT_DETAIL_LABELS.placementRationale}
                        </summary>
                        <p className="mt-2 text-xs text-ui-muted">
                          {RESIDENT_DETAIL_LABELS.placementRationaleHint}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm text-ui-text">
                          {currentPlacement.placementNotes}
                        </p>
                      </details>
                    )}

                    {/* A satisfaction scale used to sit here permanently, so a
                    caseworker could record how someone felt without having
                    spoken to them. Recording it now belongs to closing an
                    appointment (see CareWorkspace); reading the history stays
                    here, in SatisfactionHistory below. */}

                    {/* Actions Section - Client Component */}
                    <PlacementActions
                      placementId={currentPlacement.id}
                      residentId={resident.id}
                      currentUnitId={currentPlacement.housingUnitId}
                      hasMedicalDocumentation={resident.hasMedicalDocumentation}
                      availableUnits={availableUnits.map((u) => ({
                        id: u.id,
                        code: u.code,
                        address: u.address,
                        spots: u.spots.map((s) => ({
                          id: s.id,
                          code: s.code,
                          type: s.type,
                          label: s.label,
                        })),
                      }))}
                      eligibleSpotTypes={getEligibleSpotTypes(
                        resident.hasMedicalDocumentation,
                        resident.medicalDocType,
                      )}
                      unitCompatibility={unitCompatibility}
                      recentIncidents={resident.incidentsAsSubject.map((i) => ({
                        id: i.id,
                        date: i.date,
                        type: i.type,
                        description: i.description,
                      }))}
                      initialCompatibilityScore={currentPlacement.compatibilityScore}
                      initialAction={
                        query.action === 'transfer'
                          ? 'transfer'
                          : query.action === 'end'
                            ? 'end'
                            : undefined
                      }
                      canWriteCheckIn={canWriteResidents}
                      canWritePlacement={canWritePlacements}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-ui-muted mb-4">{RESIDENT_DETAIL_LABELS.notPlaced}</p>
                    {canWritePlacements && (
                      <Link href={`/matching?resident=${resident.id}`} className="btn-primary">
                        {RESIDENT_DETAIL_LABELS.findUnit}
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Compatible Matches for Unplaced Residents */}
              {!currentPlacement && canWritePlacements && (
                <CompatibleMatchesCard
                  residentId={resident.id}
                  compatibleUnits={compatibleUnits}
                  compatibleResidents={compatibleResidents}
                />
              )}

              {/* Satisfaction Check-ins History — `placements:read`, the same
              boundary /placements and /analytics use for this data.

              This was ungated, so EVERY staff role saw a client's full
              wellbeing history just by opening their page. Verified in
              production on 2026-08-31: a Jobcoach — who holds neither
              `placements:read` nor `incidents:read` — got "Zufriedenheits-
              Check-ins" on any client he opened.

              That is the complaint this whole refactor started from: staff
              seeing the smiley scale as though it were a property of the
              client rather than of an appointment they conducted. Moving
              CAPTURE into closing an appointment (see the note above, and
              CareWorkspace) fixed half of it and left READING open.

              A role without `placements:read` is not cut off from a person in
              trouble: a check-in of 1 or 2 already raises a WELLBEING incident
              (api/portal/satisfaction), and incidents have their own
              permission. The signal that needs to travel still travels; what
              stops is browsing someone's mood history with no reason to. */}
              {currentPlacement && canReadPlacements && (
                <SatisfactionHistory placementId={currentPlacement.id} />
              )}

              {/* Compatibility with current roommates */}
              <TopCompatibilitiesCard assessments={resident.assessments} />

              {/* Placement History */}
              <PlacementHistoryCard placements={pastPlacements} />
            </>
          )}

          {dossierTab === 'living' && (
            <>
              {/* Incidents */}
              <ResidentIncidents
                incidentsAsSubject={resident.incidentsAsSubject}
                incidentsReportedCount={resident.incidentsReported.length}
                currentPlacement={
                  currentPlacement
                    ? { id: currentPlacement.id, housingUnitId: currentPlacement.housingUnitId }
                    : null
                }
                residentId={resident.id}
                canWriteIncidents={canWriteIncidents}
              />
            </>
          )}

          {dossierTab === 'documents' && (
            <>
              {canReadDocuments && (
                <ResidentDocumentsCard
                  residentId={resident.id}
                  documents={documents}
                  canWrite={canWriteDocuments}
                />
              )}

              {clientFacts && <ClientFactsCard facts={clientFacts} />}
            </>
          )}
        </div>

        {/* Right column: Profile attributes */}
        <ResidentProfileSidebar resident={resident} />
      </div>
    </div>
  )
}
