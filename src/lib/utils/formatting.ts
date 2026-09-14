/**
 * Formatting utilities
 *
 * Single source of truth for date formatting, score colors, etc.
 * Thresholds are defined in lib/config/thresholds.ts (SSOT)
 */

import { COMPATIBILITY_SCORE_LABELS } from '@/lib/constants/labels'
import {
  getScoreLevel as getScoreLevelFromConfig,
  getOccupancyLevel,
  getHarmonyLevel,
  getHealthLevel as getHealthLevelFromConfig,
  type ScoreLevel,
  type HarmonyLevel,
  type HealthLevel,
  OCCUPANCY_COLORS,
} from '@/lib/config/thresholds'
import { SCORE_TOKENS, HARMONY_TOKENS, HEALTH_TOKENS } from '@/lib/config/ui-tokens'

// =============================================================================
// DATE FORMATTING
// =============================================================================

const DATE_LOCALE = 'de-CH'

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(DATE_LOCALE)
}

/**
 * Zero-padded numeric form, e.g. "05.01.2026".
 *
 * What the emails, governance panels and the opportunities pages print. Same
 * output as `Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' })`, which two
 * of the deleted copies used — the de-CH medium pattern IS dd.MM.y.
 */
export function formatDateNumeric(date: Date | string): string {
  return new Date(date).toLocaleDateString(DATE_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString(DATE_LOCALE)
}

/** Short day + short month, e.g. "27. Mai" */
export function formatDateShort(date: Date | string): string {
  return new Date(date).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })
}

/** Long form, e.g. "27. Mai 2026" */
export function formatDateLong(date: Date | string): string {
  return new Date(date).toLocaleDateString(DATE_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Long form for a bare calendar date string ("2026-05-27"), e.g. "27. Mai 2026".
 *
 * `new Date('2026-05-27')` is parsed as UTC midnight, so formatting it in a
 * timezone behind UTC prints the previous day. A date with no time in it should
 * not be able to move, so the parts are read off the string and rebuilt as a
 * local date before the locale formatting is reused.
 */
export function formatCalendarDateLong(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return formatDateLong(new Date(year, month - 1, day))
}

/** ISO date for CSV export, e.g. "2026-05-27" */
export function formatDateISO(date: Date | string): string {
  return new Date(date).toISOString().split('T')[0]
}

/**
 * `formatDateISO` for a CSV cell whose shape is not known: a Date or a
 * non-empty date string is formatted, anything else is an empty cell.
 */
export function formatDateISOCell(value: unknown): string {
  if (value instanceof Date) return formatDateISO(value)
  if (typeof value === 'string' && value) return formatDateISO(value)
  return ''
}

export function formatRelativeDate(date: Date | string): string {
  const now = new Date()
  const d = new Date(date)
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Heute'
  if (days === 1) return 'Gestern'
  if (days < 7) return `Vor ${days} Tagen`
  const weeks = Math.floor(days / 7)
  if (days < 30) return weeks === 1 ? 'Vor 1 Woche' : `Vor ${weeks} Wochen`
  return formatDate(date)
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_WEEK = 7 * MS_PER_DAY

/**
 * Get a date N days ago from now
 * @example getDateDaysAgo(30) // Date 30 days ago
 */
export function getDateDaysAgo(days: number): Date {
  return new Date(Date.now() - days * MS_PER_DAY)
}

/** Whole days between `from` and `to` (defaults to now). Positive when `to` is later. */
export function daysBetween(from: Date | string, to: Date | string | number = Date.now()): number {
  const f = new Date(from).getTime()
  const t = typeof to === 'number' ? to : new Date(to).getTime()
  return Math.floor((t - f) / MS_PER_DAY)
}

/**
 * Days since `from` rounded up (today = 1, yesterday = 1, 24h+1s ago = 2).
 * Use for "Tag X seit Beginn" / age-of-record style displays.
 */
export function daysSinceCeil(
  from: Date | string,
  to: Date | string | number = Date.now(),
): number {
  const f = new Date(from).getTime()
  const t = typeof to === 'number' ? to : new Date(to).getTime()
  return Math.ceil((t - f) / MS_PER_DAY)
}

/** Days remaining until `until` from `from` (defaults to now); ceil so "tomorrow" reads as "1 day". */
export function daysUntil(until: Date | string, from: Date | string | number = Date.now()): number {
  const f = typeof from === 'number' ? from : new Date(from).getTime()
  const u = new Date(until).getTime()
  return Math.ceil((u - f) / MS_PER_DAY)
}

/** Whole weeks between `from` and `to` (defaults to now). Positive when `to` is later. */
export function weeksBetween(from: Date | string, to: Date | string | number = Date.now()): number {
  const f = new Date(from).getTime()
  const t = typeof to === 'number' ? to : new Date(to).getTime()
  return Math.floor((t - f) / MS_PER_WEEK)
}

/**
 * Project-wide timezone (CH operations). Use these helpers for any
 * day/month bucketing — never `date.getMonth()`/`getFullYear()` directly,
 * since the server may run in UTC and would mis-bucket at midnight.
 */
export const APP_TZ = 'Europe/Zurich'

const ZURICH_PARTS_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** { year, month (1-12), day (1-31) } for the given instant in Europe/Zurich. */
export function getZurichParts(date: Date | string): { year: number; month: number; day: number } {
  const parts = ZURICH_PARTS_FMT.formatToParts(new Date(date))
  let year = 0,
    month = 0,
    day = 0
  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10)
    else if (p.type === 'month') month = parseInt(p.value, 10)
    else if (p.type === 'day') day = parseInt(p.value, 10)
  }
  return { year, month, day }
}

/** Month key for grouping (`YYYY-MM`) in Europe/Zurich. */
export function zurichMonthKey(date: Date | string): string {
  const { year, month } = getZurichParts(date)
  return `${year}-${String(month).padStart(2, '0')}`
}

// =============================================================================
// SCORE FORMATTING (thresholds from config/thresholds.ts)
// =============================================================================

export type { ScoreLevel } from '@/lib/config/thresholds'

// Re-export from config for backward compatibility
export const getScoreLevel = getScoreLevelFromConfig

export function getScoreLabel(score: number): string {
  // Use SSOT from constants/labels.ts
  return COMPATIBILITY_SCORE_LABELS[getScoreLevel(score)]
}

export function getScoreColorClass(score: number): string {
  const classes: Record<ScoreLevel, string> = {
    excellent: 'text-score-excellent-text',
    good: 'text-score-good-text',
    moderate: 'text-score-medium-text',
    low: 'text-score-low-text',
    critical: 'text-score-critical-text',
  }
  return classes[getScoreLevel(score)]
}

export function getScoreBgClass(score: number): string {
  return SCORE_TOKENS[getScoreLevel(score)].soft
}

export function getScoreBadgeClass(score: number): string {
  const classes: Record<ScoreLevel, string> = {
    excellent: 'bg-score-excellent text-ui-on-accent',
    good: 'bg-score-good text-ui-on-accent',
    moderate: 'bg-score-medium text-score-contrast',
    low: 'bg-score-low text-ui-on-accent',
    critical: 'bg-score-critical text-ui-on-accent',
  }
  return classes[getScoreLevel(score)]
}

// =============================================================================
// HARMONY STATUS (thresholds from config/thresholds.ts)
// =============================================================================

export type HarmonyStatus = HarmonyLevel

// Re-export from config for backward compatibility
export const getHarmonyStatus = getHarmonyLevel

export function getHarmonyColorClass(status: HarmonyStatus): string {
  return HARMONY_TOKENS[status]
}

// =============================================================================
// SEVERITY COLORS (using Tailwind severity-* classes from config)
// =============================================================================

export function getSeverityBorderClass(severity: string): string {
  const classes: Record<string, string> = {
    LOW: 'border-l-severity-low',
    MEDIUM: 'border-l-severity-medium',
    HIGH: 'border-l-severity-high',
    CRITICAL: 'border-l-severity-critical',
  }
  return classes[severity] || classes.LOW
}

export function getSeverityDotClass(severity: string): string {
  const classes: Record<string, string> = {
    LOW: 'bg-severity-low',
    MEDIUM: 'bg-severity-medium',
    HIGH: 'bg-severity-high',
    CRITICAL: 'bg-severity-critical',
  }
  return classes[severity] || classes.LOW
}

export function getSeverityBgClass(severity: string): string {
  const classes: Record<string, string> = {
    LOW: 'bg-ui-subtle text-ui-muted',
    MEDIUM: 'bg-status-warning/15 text-status-warning-text',
    HIGH: 'bg-score-low/15 text-score-low-text',
    CRITICAL: 'bg-status-error/15 text-status-error-text',
  }
  return classes[severity] || classes.LOW
}

// Severity radio button styles (for forms)
export function getSeverityRadioClass(severity: string): string {
  const classes: Record<string, string> = {
    LOW: 'peer-checked:border-ui-border-strong peer-checked:bg-ui-subtle',
    MEDIUM: 'peer-checked:border-status-warning peer-checked:bg-status-warning/8',
    HIGH: 'peer-checked:border-score-low peer-checked:bg-score-low/8',
    CRITICAL: 'peer-checked:border-status-error peer-checked:bg-status-error/8',
  }
  return classes[severity] || classes.LOW
}

// =============================================================================
// OCCUPANCY COLORS (thresholds from config/thresholds.ts)
// =============================================================================

export function getOccupancyColorClass(percent: number): string {
  return OCCUPANCY_COLORS[getOccupancyLevel(percent)]
}

// =============================================================================
// STATUS COLORS
// =============================================================================

export function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    ACTIVE: 'badge-active',
    AVAILABLE: 'badge-active',
    PLACED: 'badge-active',
    PENDING: 'badge-pending',
    FULL: 'badge-pending',
    ENDED: 'badge-ended',
    CLOSED: 'badge-ended',
    TRANSFERRED: 'badge-ended',
    MAINTENANCE: 'badge-alert',
    ALERT: 'badge-alert',
  }
  return classes[status] || 'badge-ended'
}

// =============================================================================
// HEALTH INDICATOR (System Health Dashboard)
// =============================================================================

// HealthLevel and getHealthLevel live in thresholds.ts; re-exported for compat
export type { HealthLevel }
export const getHealthLevel = getHealthLevelFromConfig

export function getHealthColorClass(score: number): string {
  return HEALTH_TOKENS[getHealthLevel(score)]
}

// =============================================================================
// TREND COLORS (Metric Cards)
// =============================================================================

export type TrendType = 'good' | 'warning' | 'neutral'

export function getTrendColorClass(trend: TrendType): string {
  const classes: Record<TrendType, string> = {
    good: 'text-status-success-text',
    warning: 'text-status-warning-text',
    neutral: 'text-ui-muted',
  }
  return classes[trend]
}

// =============================================================================
// CONFLICT INDICATOR COLORS
// =============================================================================

export function getConflictIndicatorClass(conflictCount: number): string {
  if (conflictCount >= 3) return 'bg-severity-critical'
  if (conflictCount >= 2) return 'bg-severity-high'
  if (conflictCount >= 1) return 'bg-severity-medium'
  return 'bg-status-success'
}
