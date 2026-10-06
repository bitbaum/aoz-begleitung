/**
 * "Seit wann wartet diese Person?" — one wording, one day count.
 *
 * Live 2026-10-02: a request made minutes earlier read "seit gestern" on the
 * dashboard (a CEILING of 24-hour days: anything under a day is 1) while the
 * review page said "seit heute" (a FLOOR). Four label functions spelled the
 * phrase two ways, fed by three different counts.
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'

import { describe, expect, it } from 'vitest'

import { DASHBOARD_LABELS, OPPORTUNITIES_ADMIN_LABELS } from '@/lib/constants/labels'
import { sinceDaysPhrase } from '@/lib/constants/labels/helpers'
import { daysSince } from '@/lib/opportunities/review'
import { calendarDaysSince } from '@/lib/utils'

describe('calendarDaysSince — days as a person in Zurich counts them', () => {
  // 2026-10-02 is CEST (UTC+2).
  const now = new Date('2026-10-02T12:00:00+02:00')

  it('calls five minutes ago today', () => {
    expect(calendarDaysSince(new Date('2026-10-02T11:55:00+02:00'), now)).toBe(0)
  })

  it('calls last night yesterday, though it is under 24 hours', () => {
    expect(calendarDaysSince(new Date('2026-10-01T23:30:00+02:00'), now)).toBe(1)
  })

  it('calls yesterday morning yesterday, though it is over 24 hours', () => {
    expect(calendarDaysSince(new Date('2026-10-01T08:00:00+02:00'), now)).toBe(1)
  })

  it('counts in Zurich, not UTC: 00:30 local is still today', () => {
    // 22:30 UTC the previous day.
    expect(calendarDaysSince(new Date('2026-10-02T00:30:00+02:00'), now)).toBe(0)
  })

  it('never goes negative for a timestamp a moment in the future', () => {
    expect(calendarDaysSince(new Date('2026-10-02T12:00:05+02:00'), now)).toBe(0)
  })

  it('is what the review page counts with, so the two pages agree', () => {
    const minutesAgo = new Date(now.getTime() - 5 * 60_000)
    expect(daysSince(minutesAgo, now)).toBe(calendarDaysSince(minutesAgo, now))
    const lastNight = new Date('2026-10-01T23:30:00+02:00')
    expect(daysSince(lastNight, now)).toBe(1)
  })
})

describe('the since phrase', () => {
  it('reads heute / gestern / N Tagen', () => {
    expect(sinceDaysPhrase(0)).toBe('seit heute')
    expect(sinceDaysPhrase(1)).toBe('seit gestern')
    expect(sinceDaysPhrase(5)).toBe('seit 5 Tagen')
  })

  it('is ONE function behind every "seit …" label on the staff side', () => {
    expect(DASHBOARD_LABELS.applicationSince).toBe(sinceDaysPhrase)
    expect(DASHBOARD_LABELS.tileWaitingSinceDays).toBe(sinceDaysPhrase)
    expect(OPPORTUNITIES_ADMIN_LABELS.awaitingSince).toBe(sinceDaysPhrase)
    expect(OPPORTUNITIES_ADMIN_LABELS.reviewSince).toBe(sinceDaysPhrase)
  })
})

describe('callers feed the phrase calendar days', () => {
  const PHRASES = ['applicationSince', 'tileWaitingSinceDays', 'awaitingSince', 'reviewSince']
  const files = execSync(
    `grep -rlE --include=*.tsx --include=*.ts "\\.(${PHRASES.join('|')})\\(" src || true`,
    { encoding: 'utf8', cwd: process.cwd() },
  )
    .split('\n')
    .filter((f) => f && !f.includes('__tests__'))

  it('finds the callers', () => {
    expect(files.length).toBeGreaterThanOrEqual(4)
  })

  it.each(files)('%s never counts a part-day as a whole one', (file) => {
    // daysSinceCeil is right for overdue maths and wrong here: <24h = 1 = "gestern".
    const src = readFileSync(file, 'utf8')
    expect(src).not.toMatch(new RegExp(`(${PHRASES.join('|')})\\(\\s*daysSinceCeil`))
  })
})
