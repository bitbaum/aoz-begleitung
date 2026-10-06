import type { Metadata } from 'next'
import { getRequestTranslator } from '@/lib/i18n/request'
import {
  db,
  resident as residentTable,
  placement,
  maintenanceRequest,
  satisfactionCheckIn,
  incident,
  householdTask,
  compatibilityAssessment,
} from '@/lib/db'
import { eq, and, or, desc, inArray, notInArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'

// The portal's name is the brand's decision, not this file's — the tab used to
// say "Mein Bereich" while the nav in the same page said "Mein Zuhause".
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestTranslator()
  return { title: t('nav.overview') }
}
import { DISPLAY_LIMITS } from '@/lib/config/thresholds'
import { PORTAL_LABELS } from '@/lib/constants/labels'
import { SatisfactionRating } from '@/components/portal/SatisfactionRating'
import { PortalHousingCard, PortalOnboardingCard } from '@/components/portal/PortalHousingCard'
import { PortalQuickActions } from '@/components/portal/PortalQuickActions'
import { PortalPendingChores } from '@/components/portal/PortalPendingChores'
import { PortalRoommatesCard } from '@/components/portal/PortalRoommatesCard'
import { PortalReportsCard } from '@/components/portal/PortalReportsCard'
import { PortalMarketplaceCard } from '@/components/portal/PortalMarketplaceCard'
import { listMyMarketplacePosts } from '@/lib/actions/marketplace'
import { PortalMaintenanceCard } from '@/components/portal/PortalMaintenanceCard'
import { PortalActivitiesCard } from '@/components/portal/PortalActivitiesCard'
import { listActivities } from '@/lib/data/activities'
import { requireResidentCookie } from '@/lib/portal-auth'
import { getUnitExpenseData } from '@/lib/expenses/data'
import { PortalExpensesCard } from '@/components/portal/PortalExpensesCard'
import { ResidentAvatar } from '@/components/portal/ResidentAvatar'
import { residentName } from '@/lib/utils/resident-name'
import { mergeResidentReports } from '@/lib/reports/resident-reports'
import { getCareTeam, listUpcomingResidentAppointments } from '@/lib/actions/care'
import { CareTeamCard } from '@/components/residents/CareTeamCard'
import { PortalAppointmentsCard } from '@/components/portal/PortalAppointmentsCard'
import { PortalPillarDirectory } from '@/components/portal/PortalPillarDirectory'
import Link from 'next/link'
import { listPendingSurveys } from '@/lib/surveys/invitations'
import { surveyTextsForClient } from '@/lib/surveys/display'
import { PortalSurveyCard } from '@/components/portal/PortalSurveyCard'

export const dynamic = 'force-dynamic'

export default async function ResidentPortal() {
  const residentCode = await requireResidentCookie('/login')
  const { t, locale } = await getRequestTranslator()

  const resident = await db.query.resident.findFirst({
    where: eq(residentTable.code, residentCode),
    with: {
      photo: { columns: { updatedAt: true } },
      placements: {
        where: eq(placement.status, 'ACTIVE'),
        with: {
          housingUnit: {
            with: {
              placements: {
                where: eq(placement.status, 'ACTIVE'),
                with: {
                  resident: {
                    columns: {
                      id: true,
                      code: true,
                      displayName: true,
                      socialStyle: true,
                    },
                    with: {
                      photo: { columns: { updatedAt: true } },
                    },
                  },
                },
              },
              maintenanceRequests: {
                where: notInArray(maintenanceRequest.status, ['COMPLETED', 'CANCELLED']),
                orderBy: [desc(maintenanceRequest.createdAt)],
                limit: DISPLAY_LIMITS.portalIncidentPreview,
                columns: { id: true, category: true, createdAt: true },
              },
            },
          },
          checkIns: {
            orderBy: [desc(satisfactionCheckIn.createdAt)],
            limit: 1,
          },
        },
      },
      incidentsReported: {
        orderBy: [desc(incident.date)],
        limit: DISPLAY_LIMITS.portalIncidentPreview,
        columns: {
          id: true,
          type: true,
          description: true,
          date: true,
          resolvedAt: true,
          resolution: true,
        },
      },
      // A resident's own reports live in two tables — conflicts on the ladder,
      // broken things on the maintenance board — but they are one list to them.
      maintenanceRequests: {
        orderBy: [desc(maintenanceRequest.createdAt)],
        limit: DISPLAY_LIMITS.portalIncidentPreview,
        columns: {
          id: true,
          category: true,
          description: true,
          createdAt: true,
          status: true,
          resolution: true,
        },
      },
    },
  })

  if (!resident) {
    redirect('/login')
  }

  const currentPlacement = resident.placements[0]
  const housingUnit = currentPlacement?.housingUnit
  const roommates =
    housingUnit?.placements
      .filter((p) => p.residentId !== resident.id)
      .map((p) => ({ ...p.resident, photoVersion: p.resident.photo?.updatedAt ?? null })) || []
  const lastCheckIn = currentPlacement?.checkIns?.[0]
  // The full set is merged first so the card knows how many there really are.
  // Slicing before counting is what let the preview claim to be the whole list.
  const allReports = mergeResidentReports(resident.incidentsReported, resident.maintenanceRequests)
  const myReports = allReports.slice(0, DISPLAY_LIMITS.portalIncidentPreview)

  const now = new Date()
  const [
    pendingChores,
    compatibilityScores,
    highlightedActivities,
    expenseData,
    careSeats,
    upcomingAppointments,
    myMarketplacePosts,
    pendingSurveys,
  ] = await Promise.all([
    currentPlacement
      ? db.query.householdTask.findMany({
          where: and(
            eq(householdTask.housingUnitId, currentPlacement.housingUnitId),
            eq(householdTask.isCompleted, false),
            inArray(householdTask.currentStatus, ['NEEDS_ATTENTION', 'REQUESTED']),
          ),
          columns: { id: true, title: true, currentStatus: true },
          orderBy: [desc(householdTask.updatedAt)],
          limit: DISPLAY_LIMITS.dashboardItems,
        })
      : Promise.resolve([]),
    roommates.length > 0
      ? db.query.compatibilityAssessment.findMany({
          where: or(
            and(
              eq(compatibilityAssessment.residentId, resident.id),
              inArray(
                compatibilityAssessment.comparedWithId,
                roommates.map((r) => r.id),
              ),
            ),
            and(
              inArray(
                compatibilityAssessment.residentId,
                roommates.map((r) => r.id),
              ),
              eq(compatibilityAssessment.comparedWithId, resident.id),
            ),
          ),
          columns: {
            residentId: true,
            comparedWithId: true,
            overallScore: true,
          },
        })
      : Promise.resolve([]),
    listActivities({
      publishedOnly: true,
      highlightedOnly: true,
      activeOn: now,
      take: DISPLAY_LIMITS.dashboardItems,
    }),
    currentPlacement ? getUnitExpenseData(currentPlacement.housingUnitId) : Promise.resolve(null),
    getCareTeam(resident.id),
    listUpcomingResidentAppointments(resident.id),
    listMyMarketplacePosts(),
    listPendingSurveys(resident.id),
  ])

  return (
    <div>
      {/* Welcome */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ui-text">
            {t('dashboard.welcome')}, {residentName(resident)}
          </h1>
          <p className="text-ui-muted mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <Link href="/portal/profile" aria-label={t('nav.profile')} className="shrink-0">
          <ResidentAvatar resident={resident} photoVersion={resident.photo?.updatedAt} />
        </Link>
      </div>

      {/* An open anonymous survey — first, because it closes. Gone once answered. */}
      <PortalSurveyCard
        t={t}
        surveys={pendingSurveys.map((survey) => ({
          id: survey.id,
          title: surveyTextsForClient(survey, locale).title,
        }))}
      />

      {/* Satisfaction Check-In - Prominent Position */}
      {currentPlacement && (
        <div className="mb-8">
          <SatisfactionRating
            currentRating={currentPlacement.satisfactionRating}
            lastCheckInDate={lastCheckIn?.createdAt}
          />
        </div>
      )}

      {/* Current Housing */}
      {currentPlacement ? (
        <PortalHousingCard
          placement={currentPlacement}
          housingUnit={housingUnit}
          roommatesCount={roommates.length}
        />
      ) : (
        <PortalOnboardingCard preferencesCompleted={resident.preferencesCompletedAt !== null} />
      )}

      <PortalQuickActions pendingChoresCount={pendingChores.length} />

      <div className="mb-6">
        <CareTeamCard
          seats={careSeats}
          title={t('care.title')}
          subtitle={t('care.subtitle')}
          empty={t('care.empty')}
          roleLabels={{
            HOUSING: t('care.housing'),
            SOCIAL: t('care.social'),
            JOB: t('care.job'),
            VOLUNTEERING: t('care.volunteering'),
          }}
        />
      </div>

      <div className="mb-6">
        <PortalAppointmentsCard
          canRequest
          title={t('care.appointments')}
          empty={t('care.appointmentsEmpty')}
          appointments={upcomingAppointments}
        />
      </div>

      {/* Pending Chores */}
      {currentPlacement && pendingChores.length > 0 && (
        <PortalPendingChores chores={pendingChores} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Roommates Preview */}
        {roommates.length > 0 && (
          <PortalRoommatesCard roommates={roommates} compatibilityScores={compatibilityScores} />
        )}

        {/* Shared expenses balance */}
        {expenseData && <PortalExpensesCard myBalance={expenseData.balances[resident.id] ?? 0} />}

        {/* Your own marketplace posts, and whether anyone answered them. The
            board had no way of telling you a claim had happened. */}
        <PortalMarketplaceCard posts={myMarketplacePosts} />

        {/* Recent Reports */}
        <PortalReportsCard reports={myReports} totalCount={allReports.length} />

        {/* Open Maintenance in Building */}
        {housingUnit && housingUnit.maintenanceRequests.length > 0 && (
          <PortalMaintenanceCard requests={housingUnit.maintenanceRequests} />
        )}

        {/* Activities */}
        <PortalActivitiesCard activities={highlightedActivities} />
      </div>

      {/* Every pillar, reachable from home — derived from the nav config. */}
      <PortalPillarDirectory t={t} placed={Boolean(currentPlacement)} />
    </div>
  )
}
