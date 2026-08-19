import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Mein Bereich' }
import { DISPLAY_LIMITS } from '@/lib/config/thresholds'
import { SatisfactionRating } from '@/components/portal/SatisfactionRating'
import { PortalHousingCard, PortalOnboardingCard } from '@/components/portal/PortalHousingCard'
import { PortalQuickActions } from '@/components/portal/PortalQuickActions'
import { PortalPendingChores } from '@/components/portal/PortalPendingChores'
import { PortalRoommatesCard } from '@/components/portal/PortalRoommatesCard'
import { PortalReportsCard } from '@/components/portal/PortalReportsCard'
import { PortalMaintenanceCard } from '@/components/portal/PortalMaintenanceCard'
import { PortalActivitiesCard } from '@/components/portal/PortalActivitiesCard'
import { listActivities } from '@/lib/data/activities'
import { requireResidentCookie } from '@/lib/portal-auth'
import { getUnitExpenseData } from '@/lib/expenses/data'
import { PortalExpensesCard } from '@/components/portal/PortalExpensesCard'
import { ResidentAvatar } from '@/components/portal/ResidentAvatar'
import { residentName } from '@/lib/utils/resident-name'
import { mergeResidentReports } from '@/lib/reports/resident-reports'
import { getRequestTranslator } from '@/lib/i18n/request'
import { getCareTeam, listUpcomingResidentAppointments } from '@/lib/actions/care'
import { CareTeamCard } from '@/components/residents/CareTeamCard'
import { PortalAppointmentsCard } from '@/components/portal/PortalAppointmentsCard'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ResidentPortal() {
  const residentCode = await requireResidentCookie('/login')
  const { t } = await getRequestTranslator()

  const resident = await prisma.resident.findUnique({
    where: { code: residentCode },
    include: {
      photo: { select: { updatedAt: true } },
      placements: {
        where: { status: 'ACTIVE' },
        include: {
          housingUnit: {
            include: {
              placements: {
                where: { status: 'ACTIVE' },
                include: {
                  resident: {
                    select: {
                      id: true,
                      code: true,
                      displayName: true,
                      socialStyle: true,
                      photo: { select: { updatedAt: true } },
                    },
                  },
                },
              },
              maintenanceRequests: {
                where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
                orderBy: { createdAt: 'desc' },
                take: DISPLAY_LIMITS.portalIncidentPreview,
                select: { id: true, category: true, createdAt: true },
              },
            },
          },
          checkIns: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      incidentsReported: {
        orderBy: { date: 'desc' },
        take: DISPLAY_LIMITS.portalIncidentPreview,
        select: {
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
        orderBy: { createdAt: 'desc' },
        take: DISPLAY_LIMITS.portalIncidentPreview,
        select: {
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
  const roommates = housingUnit?.placements
    .filter(p => p.residentId !== resident.id)
    .map(p => ({ ...p.resident, photoVersion: p.resident.photo?.updatedAt ?? null })) || []
  const lastCheckIn = currentPlacement?.checkIns?.[0]
  // The full set is merged first so the card knows how many there really are.
  // Slicing before counting is what let the preview claim to be the whole list.
  const allReports = mergeResidentReports(resident.incidentsReported, resident.maintenanceRequests)
  const myReports = allReports.slice(0, DISPLAY_LIMITS.portalIncidentPreview)

  const now = new Date()
  const [pendingChores, compatibilityScores, highlightedActivities, expenseData, careSeats, upcomingAppointments] = await Promise.all([
    currentPlacement
      ? prisma.householdTask.findMany({
          where: {
            housingUnitId: currentPlacement.housingUnitId,
            isCompleted: false,
            currentStatus: { in: ['NEEDS_ATTENTION', 'REQUESTED'] },
          },
          select: { id: true, title: true, currentStatus: true },
          orderBy: { updatedAt: 'desc' },
          take: DISPLAY_LIMITS.dashboardItems,
        })
      : Promise.resolve([]),
    roommates.length > 0
      ? prisma.compatibilityAssessment.findMany({
          where: {
            OR: [
              { residentId: resident.id, comparedWithId: { in: roommates.map(r => r.id) } },
              { residentId: { in: roommates.map(r => r.id) }, comparedWithId: resident.id },
            ],
          },
          select: {
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
    currentPlacement
      ? getUnitExpenseData(currentPlacement.housingUnitId)
      : Promise.resolve(null),
    getCareTeam(resident.id),
    listUpcomingResidentAppointments(resident.id),
  ])

  return (
    <div>
      {/* Welcome */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ui-text">
            {t('dashboard.welcome')}, {residentName(resident)}
          </h1>
          <p className="text-ui-muted mt-1">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <Link href="/portal/profile" aria-label={t('nav.profile')} className="shrink-0">
          <ResidentAvatar resident={resident} photoVersion={resident.photo?.updatedAt} />
        </Link>
      </div>

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
          }}
        />
      </div>

      <div className="mb-6">
        <PortalAppointmentsCard
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
          <PortalRoommatesCard
            roommates={roommates}
            compatibilityScores={compatibilityScores}
          />
        )}

        {/* Shared expenses balance */}
        {expenseData && (
          <PortalExpensesCard myBalance={expenseData.balances[resident.id] ?? 0} />
        )}

        {/* Recent Reports */}
        <PortalReportsCard reports={myReports} totalCount={allReports.length} />

        {/* Open Maintenance in Building */}
        {housingUnit && housingUnit.maintenanceRequests.length > 0 && (
          <PortalMaintenanceCard requests={housingUnit.maintenanceRequests} />
        )}

        {/* Activities */}
        <PortalActivitiesCard activities={highlightedActivities} />
      </div>
    </div>
  )
}
