/**
 * Mission KPI Tracking
 *
 * Tracks the 4 KPIs from the AOZ Housing mission:
 * 1. Incidents per month (target: -30%)
 * 2. Relocations due to conflict (target: -50%)
 * 3. Average placement decision time (target: same or faster)
 * 4. Conflict trend (improving / stable / worsening)
 *
 * @see CLAUDE.md "Measuring Success" section
 */

import { IN_CARE_RESIDENT_STATUSES } from '@/lib/config/resident-status'
import { and, asc, eq, gte, inArray, ne } from 'drizzle-orm'
import { db, incident, placement, resident } from '@/lib/db'
import { zurichMonthKey, getZurichParts } from '@/lib/utils'
import { excludesDemo, isDemoResidentCode, loadDemoScope } from './real-data'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthlyDataPoint {
  month: string // YYYY-MM
  label: string // "Jan 2026"
  value: number
}

export interface MissionKPIs {
  // KPI 1: Incidents per month
  incidentsPerMonth: MonthlyDataPoint[]
  currentMonthIncidents: number
  avgIncidentsPerMonth: number

  // KPI 2: Conflict relocations per month
  conflictRelocationsPerMonth: MonthlyDataPoint[]
  currentMonthRelocations: number
  avgRelocationsPerMonth: number

  // KPI 3: Average placement decision time (days from ACTIVE to first placement)
  avgPlacementTimeDays: number | null
  recentPlacementTimeDays: number | null // last 30 days

  // KPI 4: Conflict trend
  trend: 'improving' | 'stable' | 'worsening'
  trendDetail: string // German explanation

  // KPI 5: Mediation time
  mediationMinutesPerMonth: MonthlyDataPoint[]
  avgMediationHoursPerWeek: number | null // average weekly hours across tracked period

  // Summary
  monthsTracked: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS_DE = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
]

function formatMonth(date: Date): string {
  return zurichMonthKey(date)
}

function formatMonthLabel(date: Date): string {
  const { year, month } = getZurichParts(date)
  return `${MONTHS_DE[month - 1]} ${year}`
}

function getMonthStart(year: number, month: number): Date {
  return new Date(year, month, 1)
}

function getMonthEnd(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate all mission KPIs over the specified number of months.
 */
export async function calculateMissionKPIs(months: number = 6): Promise<MissionKPIs> {
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)

  // ── Fetch data ─────────────────────────────────────────────────────

  // Every query below selects the ids that identify a demo row, and every
  // result is passed through `excludesDemo`. Without it the pilot's headline
  // number counted a nightly-reseeded demo world: measured 2026-09-03, seven of
  // eight interpersonal incidents in 180 days were demo. @see ./real-data.ts
  const [demoScope, rawIncidents, rawEndedPlacements, rawResidents, rawPlacements] =
    await Promise.all([
      loadDemoScope(),

      // Interpersonal incidents in range
      db.query.incident.findMany({
        where: and(eq(incident.category, 'INTERPERSONAL'), gte(incident.date, startDate)),
        columns: { date: true, mediationMinutes: true, housingUnitId: true },
        orderBy: [asc(incident.date)],
      }),

      // Placements that ended in range
      db.query.placement.findMany({
        where: and(gte(placement.endDate, startDate), ne(placement.status, 'ACTIVE')),
        columns: { endDate: true, endReason: true, residentId: true, housingUnitId: true },
      }),

      // Residents created in range (for placement time calculation)
      db.query.resident.findMany({
        where: and(
          gte(resident.createdAt, startDate),
          inArray(resident.status, [...IN_CARE_RESIDENT_STATUSES]),
        ),
        columns: { id: true, createdAt: true, code: true },
      }),

      // First placement per recent resident
      db.query.placement.findMany({
        where: gte(placement.startDate, startDate),
        columns: { residentId: true, startDate: true, housingUnitId: true },
        orderBy: [asc(placement.startDate)],
      }),
    ])

  const incidents = excludesDemo(rawIncidents, demoScope)
  const endedPlacements = excludesDemo(rawEndedPlacements, demoScope)
  const placements = excludesDemo(rawPlacements, demoScope)
  // Residents carry their own code rather than a residentId, so the shared
  // predicate does not apply — the code IS the identifier here.
  const residents = rawResidents.filter((row) => !isDemoResidentCode(row.code))

  // ── Build monthly data points ──────────────────────────────────────

  const incidentsByMonth = new Map<string, number>()
  const relocationsByMonth = new Map<string, number>()
  const mediationMinutesByMonth = new Map<string, number>()

  // Initialize all months with 0
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1)
    const key = formatMonth(d)
    incidentsByMonth.set(key, 0)
    relocationsByMonth.set(key, 0)
    mediationMinutesByMonth.set(key, 0)
  }

  // Count incidents and accumulate mediation minutes per month
  for (const incident of incidents) {
    const key = formatMonth(new Date(incident.date))
    if (incidentsByMonth.has(key)) {
      incidentsByMonth.set(key, (incidentsByMonth.get(key) || 0) + 1)
      if (incident.mediationMinutes) {
        mediationMinutesByMonth.set(
          key,
          (mediationMinutesByMonth.get(key) || 0) + incident.mediationMinutes,
        )
      }
    }
  }

  // Count conflict relocations per month
  for (const placement of endedPlacements) {
    if (placement.endReason === 'CONFLICT' && placement.endDate) {
      const key = formatMonth(new Date(placement.endDate))
      if (relocationsByMonth.has(key)) {
        relocationsByMonth.set(key, (relocationsByMonth.get(key) || 0) + 1)
      }
    }
  }

  // Convert to sorted arrays
  const incidentsPerMonth: MonthlyDataPoint[] = Array.from(incidentsByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => {
      const [y, m] = month.split('-').map(Number)
      return { month, label: formatMonthLabel(new Date(y, m - 1)), value }
    })

  const conflictRelocationsPerMonth: MonthlyDataPoint[] = Array.from(relocationsByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => {
      const [y, m] = month.split('-').map(Number)
      return { month, label: formatMonthLabel(new Date(y, m - 1)), value }
    })

  // Mediation: convert minutes to hours per month for display
  const mediationMinutesPerMonth: MonthlyDataPoint[] = Array.from(mediationMinutesByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => {
      const [y, m] = month.split('-').map(Number)
      return {
        month,
        label: formatMonthLabel(new Date(y, m - 1)),
        value: Math.round((value / 60) * 10) / 10,
      }
    })

  // Average weekly mediation hours: total minutes in period ÷ weeks in period ÷ 60
  const totalMediationMinutes = Array.from(mediationMinutesByMonth.values()).reduce(
    (s, v) => s + v,
    0,
  )
  const weeksInPeriod = months * 4.33
  const avgMediationHoursPerWeek =
    totalMediationMinutes > 0
      ? Math.round((totalMediationMinutes / weeksInPeriod / 60) * 10) / 10
      : null

  // ── Current month stats ────────────────────────────────────────────

  const currentKey = formatMonth(now)
  const currentMonthIncidents = incidentsByMonth.get(currentKey) || 0
  const currentMonthRelocations = relocationsByMonth.get(currentKey) || 0

  // Averages (excluding current incomplete month)
  const completedMonths = incidentsPerMonth.slice(0, -1)
  const avgIncidents =
    completedMonths.length > 0
      ? Math.round(
          (completedMonths.reduce((s, d) => s + d.value, 0) / completedMonths.length) * 10,
        ) / 10
      : 0
  const avgRelocations =
    completedMonths.length > 0
      ? Math.round(
          (conflictRelocationsPerMonth.slice(0, -1).reduce((s, d) => s + d.value, 0) /
            completedMonths.length) *
            10,
        ) / 10
      : 0

  // ── Placement decision time ────────────────────────────────────────

  // Map: residentId → earliest placement startDate
  const firstPlacementMap = new Map<string, Date>()
  for (const p of placements) {
    if (
      !firstPlacementMap.has(p.residentId) ||
      new Date(p.startDate) < firstPlacementMap.get(p.residentId)!
    ) {
      firstPlacementMap.set(p.residentId, new Date(p.startDate))
    }
  }

  const placementTimes: number[] = []
  const recentPlacementTimes: number[] = []
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  for (const r of residents) {
    const firstPlacement = firstPlacementMap.get(r.id)
    if (firstPlacement) {
      const days =
        (firstPlacement.getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      if (days >= 0) {
        placementTimes.push(days)
        if (new Date(r.createdAt) >= thirtyDaysAgo) {
          recentPlacementTimes.push(days)
        }
      }
    }
  }

  const avgPlacementTime =
    placementTimes.length > 0
      ? Math.round((placementTimes.reduce((s, d) => s + d, 0) / placementTimes.length) * 10) / 10
      : null
  const recentPlacementTime =
    recentPlacementTimes.length > 0
      ? Math.round(
          (recentPlacementTimes.reduce((s, d) => s + d, 0) / recentPlacementTimes.length) * 10,
        ) / 10
      : null

  // ── Conflict trend ─────────────────────────────────────────────────

  // Compare last 3 months vs previous 3 months
  const recentMonths = incidentsPerMonth.slice(-3)
  const previousMonths = incidentsPerMonth.slice(-6, -3)

  const recentAvg =
    recentMonths.length > 0
      ? recentMonths.reduce((s, d) => s + d.value, 0) / recentMonths.length
      : 0
  const previousAvg =
    previousMonths.length > 0
      ? previousMonths.reduce((s, d) => s + d.value, 0) / previousMonths.length
      : 0

  let trend: 'improving' | 'stable' | 'worsening'
  let trendDetail: string

  if (previousAvg === 0 && recentAvg === 0) {
    trend = 'stable'
    trendDetail = 'Keine Konflikte in den letzten 6 Monaten'
  } else if (previousAvg === 0) {
    trend = 'worsening'
    trendDetail = `${Math.round(recentAvg)} Konflikte/Monat (vorher keine)`
  } else {
    const change = ((recentAvg - previousAvg) / previousAvg) * 100

    if (change <= -15) {
      trend = 'improving'
      trendDetail = `${Math.round(Math.abs(change))}% weniger Konflikte als in den 3 Monaten davor`
    } else if (change >= 15) {
      trend = 'worsening'
      trendDetail = `${Math.round(change)}% mehr Konflikte als in den 3 Monaten davor`
    } else {
      trend = 'stable'
      trendDetail = 'Konfliktrate stabil (±15%)'
    }
  }

  return {
    incidentsPerMonth,
    currentMonthIncidents,
    avgIncidentsPerMonth: avgIncidents,
    conflictRelocationsPerMonth,
    currentMonthRelocations,
    avgRelocationsPerMonth: avgRelocations,
    avgPlacementTimeDays: avgPlacementTime,
    recentPlacementTimeDays: recentPlacementTime,
    trend,
    trendDetail,
    mediationMinutesPerMonth,
    avgMediationHoursPerWeek,
    monthsTracked: months,
  }
}
