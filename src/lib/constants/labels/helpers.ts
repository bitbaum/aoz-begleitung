/**
 * Label helper types and functions
 */

import { RESIDENT_FACTORS } from '@/lib/config/resident-factors'

type FactorWithOptions = {
  optionLabels: Record<string, string>
}

export function getLabelsFromFactor(
  factorId: keyof typeof RESIDENT_FACTORS,
): Record<string, string> {
  const factor = RESIDENT_FACTORS[factorId] as FactorWithOptions
  return factor?.optionLabels ?? {}
}

/**
 * "seit heute" / "seit gestern" / "seit N Tagen" — the ONE wording for how
 * long somebody has been waiting. Takes CALENDAR days (`calendarDaysSince`).
 * Four copies of this phrase used to disagree: two said "seit 1 Tag", two
 * "seit gestern", and they were fed by three different day counts.
 */
export function sinceDaysPhrase(days: number): string {
  if (days <= 0) return 'seit heute'
  if (days === 1) return 'seit gestern'
  return `seit ${days} Tagen`
}

export function getLabel(labels: Record<string, string>, key: string, fallback?: string): string {
  return labels[key] || fallback || key
}
