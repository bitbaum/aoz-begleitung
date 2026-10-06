/**
 * Mission KPI Section — displays the 4 core mission metrics
 *
 * Shows: incidents/month trend, conflict relocations, placement time, conflict trend.
 * When a pilot baseline is configured, shows progress bars vs. baseline targets.
 */

import type { MissionKPIs } from '@/lib/analytics/mission-kpis'
import type { SystemConfigData } from '@/lib/actions/config'
import { MISSION_KPI_LABELS, PILOT_BASELINE_LABELS } from '@/lib/constants/labels'
import Link from 'next/link'

interface Props {
  kpis: MissionKPIs
  baseline?: SystemConfigData
}

const TREND_STYLES = {
  improving: {
    bg: 'bg-status-success/10',
    text: 'text-status-success-text',
    icon: '↓',
    label: MISSION_KPI_LABELS.trendImproving,
  },
  stable: {
    bg: 'bg-status-info/8',
    text: 'text-status-info-text',
    icon: '→',
    label: MISSION_KPI_LABELS.trendStable,
  },
  worsening: {
    bg: 'bg-status-error/8',
    text: 'text-status-error-text',
    icon: '↑',
    label: MISSION_KPI_LABELS.trendWorsening,
  },
}

function pctChange(current: number, baseline: number): number {
  if (baseline === 0) return 0
  return Math.round(((baseline - current) / baseline) * 100)
}

export function MissionKPISection({ kpis, baseline }: Props) {
  const trendStyle = TREND_STYLES[kpis.trend]

  const hasBaseline =
    baseline &&
    (baseline.pilotBaselineIncidentsPerMonth !== null ||
      baseline.pilotBaselineRelocationsPerMonth !== null)

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-ui-text">{MISSION_KPI_LABELS.sectionTitle}</h2>
          <p className="text-sm text-ui-muted">
            {MISSION_KPI_LABELS.sectionDesc(kpis.monthsTracked)}
            {hasBaseline && baseline?.pilotStartDate && (
              <span className="ml-2 text-status-success-text font-medium">
                · Pilot seit{' '}
                {new Date(baseline.pilotStartDate).toLocaleDateString('de-CH', {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium ${trendStyle.bg} ${trendStyle.text}`}
        >
          <span aria-hidden="true">{trendStyle.icon}</span>
          {trendStyle.label}
        </div>
      </div>

      {/* No-baseline nudge */}
      {!hasBaseline && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-status-warning/10 border border-status-warning/25 px-3 py-2 text-sm text-status-warning-text">
          <span aria-hidden="true">ℹ</span>
          <span>
            {PILOT_BASELINE_LABELS.noBaselineHint}{' '}
            <Link href="/settings" className="underline font-medium hover:text-status-warning-text">
              Einstellungen
            </Link>
          </span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPICard
          label={MISSION_KPI_LABELS.conflictsPerMonth}
          value={kpis.avgIncidentsPerMonth}
          current={kpis.currentMonthIncidents}
          currentLabel={MISSION_KPI_LABELS.currentLabel}
          targetPct={30}
          unit=""
          baselineValue={baseline?.pilotBaselineIncidentsPerMonth ?? null}
        />
        <KPICard
          label={MISSION_KPI_LABELS.relocationsPerMonth}
          value={kpis.avgRelocationsPerMonth}
          current={kpis.currentMonthRelocations}
          currentLabel={MISSION_KPI_LABELS.currentLabel}
          targetPct={50}
          unit=""
          baselineValue={baseline?.pilotBaselineRelocationsPerMonth ?? null}
        />
        <KPICard
          label={MISSION_KPI_LABELS.mediationHoursPerWeek}
          value={kpis.avgMediationHoursPerWeek}
          current={null}
          currentLabel=""
          targetPct={40}
          unit={MISSION_KPI_LABELS.hoursUnit}
          baselineValue={baseline?.pilotBaselineMediationHoursPerWeek ?? null}
          nudgeHref="/incidents"
        />
        <KPICard
          label={MISSION_KPI_LABELS.avgPlacementTime}
          value={kpis.avgPlacementTimeDays}
          current={kpis.recentPlacementTimeDays}
          currentLabel={MISSION_KPI_LABELS.last30Days}
          targetPct={null}
          targetLabel={MISSION_KPI_LABELS.targetDays}
          unit={MISSION_KPI_LABELS.daysUnit}
          baselineValue={null}
        />
        {/* min-w-0 + hyphenation: «Verschlechterung» at text-2xl is wider than
            a fifth of the row at 1280px, and as one unbreakable word it pushed
            the grid — and the whole page — 6px past the viewport. */}
        <div
          className={`min-w-0 rounded-lg border p-4 sm:col-span-2 lg:col-span-1 ${trendStyle.bg}`}
        >
          <p className="text-sm text-ui-muted mb-1">{MISSION_KPI_LABELS.conflictTrend}</p>
          <p className={`text-2xl font-bold break-words hyphens-auto ${trendStyle.text}`}>
            {trendStyle.label}
          </p>
          <p className="text-xs text-ui-muted mt-2">{kpis.trendDetail}</p>
        </div>
      </div>

      {/* Monthly Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniChart
          label={MISSION_KPI_LABELS.conflictsMonthlyChart}
          data={kpis.incidentsPerMonth}
          color="text-status-warning"
          barColor="bg-status-warning"
          baseline={baseline?.pilotBaselineIncidentsPerMonth ?? null}
        />
        <MiniChart
          label={MISSION_KPI_LABELS.relocationsMonthlyChart}
          data={kpis.conflictRelocationsPerMonth}
          color="text-status-error"
          barColor="bg-status-error"
          baseline={baseline?.pilotBaselineRelocationsPerMonth ?? null}
        />
        <MiniChart
          label={MISSION_KPI_LABELS.mediationMonthlyChart}
          data={kpis.mediationMinutesPerMonth}
          color="text-brand-secondary"
          barColor="bg-brand-secondary"
          baseline={
            baseline?.pilotBaselineMediationHoursPerWeek !== null &&
            baseline?.pilotBaselineMediationHoursPerWeek !== undefined
              ? Math.round(baseline.pilotBaselineMediationHoursPerWeek * 4.33 * 10) / 10
              : null
          }
        />
      </div>
    </div>
  )
}

function KPICard({
  label,
  value,
  current,
  currentLabel,
  targetPct,
  targetLabel,
  unit,
  baselineValue,
  nudgeHref,
}: {
  label: string
  value: number | null
  current: number | null
  currentLabel: string
  targetPct: number | null
  targetLabel?: string
  unit: string
  baselineValue: number | null
  nudgeHref?: string
}) {
  const hasBaseline = baselineValue !== null && baselineValue > 0
  const reductionPct = hasBaseline && value !== null ? pctChange(value, baselineValue!) : null
  const targetValue = hasBaseline && targetPct ? baselineValue! * (1 - targetPct / 100) : null

  // Progress toward target: 0% = at baseline, 100% = at target
  const progressPct =
    hasBaseline && targetPct && value !== null
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(((baselineValue! - value) / ((baselineValue! * targetPct) / 100)) * 100),
          ),
        )
      : null

  const isAchieved = progressPct !== null && progressPct >= 100

  return (
    <div className="min-w-0 rounded-lg border border-ui-border bg-ui-surface p-4">
      <p className="text-sm text-ui-muted mb-1">{label}</p>
      <p className="text-2xl font-bold text-ui-text">
        {value !== null ? value : '—'}
        {value !== null && unit && (
          <>
            {' '}
            <span className="text-sm font-normal text-ui-muted">{unit}</span>
          </>
        )}
      </p>
      {value === null && nudgeHref && (
        <Link
          href={nudgeHref}
          className="inline-flex items-center min-h-[44px] px-1 text-xs text-brand-primary hover:underline"
        >
          {MISSION_KPI_LABELS.nudgeToLog}
        </Link>
      )}

      {current !== null && (
        <p className="text-xs text-ui-muted mt-1">
          {currentLabel}:{' '}
          <span className="font-medium text-ui-muted">
            {current}
            {unit ? ` ${unit}` : ''}
          </span>
        </p>
      )}

      {hasBaseline ? (
        <div className="mt-2 space-y-1.5">
          {/* Baseline reference */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-ui-muted">
              {PILOT_BASELINE_LABELS.baselineLabel}: {baselineValue}
            </span>
            {targetValue !== null && (
              <span className="text-ui-muted">
                {PILOT_BASELINE_LABELS.targetLabel}: {Math.round(targetValue * 10) / 10}
              </span>
            )}
          </div>
          {/* Progress bar */}
          {progressPct !== null && (
            <div className="meter">
              <div
                className={`h-full rounded-sm transition-all ${isAchieved ? 'bg-status-success' : 'bg-brand-primary'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
          {/* Reduction label */}
          {reductionPct !== null && (
            <p
              className={`text-xs font-medium ${reductionPct > 0 ? 'text-status-success-text' : reductionPct < 0 ? 'text-status-error-text' : 'text-ui-muted'}`}
            >
              {reductionPct > 0
                ? `↓ ${reductionPct}%`
                : reductionPct < 0
                  ? `↑ ${Math.abs(reductionPct)}%`
                  : '→ 0%'}{' '}
              {PILOT_BASELINE_LABELS.baselineLabel.toLowerCase()}
              {targetPct && (
                <span className="text-ui-muted font-normal"> · Ziel: -{targetPct}%</span>
              )}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-ui-muted mt-1">
          {targetLabel ? `Ziel: ${targetLabel}` : targetPct ? `Ziel: -${targetPct}%` : ''}
        </p>
      )}
    </div>
  )
}

function MiniChart({
  label,
  data,
  color,
  barColor,
  baseline,
}: {
  label: string
  data: { label: string; value: number }[]
  color: string
  barColor: string
  baseline: number | null
}) {
  const maxValue = Math.max(...data.map((d) => d.value), baseline ?? 0, 1)

  return (
    <div className="rounded-lg border border-ui-border bg-ui-surface p-4">
      <p className={`text-sm font-medium ${color} mb-3`}>{label}</p>
      <div className="relative flex items-end gap-1 h-16">
        {/* Baseline reference line */}
        {baseline !== null && baseline > 0 && (
          <div
            className="absolute inset-x-0 border-t-2 border-dashed border-ui-border-strong pointer-events-none"
            style={{ bottom: `${(baseline / maxValue) * 100}%` }}
            title={`${PILOT_BASELINE_LABELS.baselineLabel}: ${baseline}`}
          />
        )}
        {data.map((d, i) => (
          <div key={i} className="flex-1 h-full flex flex-col justify-end">
            <div
              className={`w-full rounded-t ${barColor} transition-all`}
              style={{ height: `${Math.max((d.value / maxValue) * 100, 4)}%` }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[11px] text-ui-muted">{data[0]?.label}</span>
        {baseline !== null && (
          <span className="text-[11px] text-ui-muted">
            — {PILOT_BASELINE_LABELS.baselineLabel} {baseline}
          </span>
        )}
        <span className="text-[11px] text-ui-muted">{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}
