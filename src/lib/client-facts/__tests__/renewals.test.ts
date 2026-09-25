import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

import { RENEWAL_NOTICE_DAYS, renewalState } from '@/lib/client-facts/policy'
import { RENEWAL_MILESTONE_DAYS, isMilestoneDay } from '@/lib/client-facts/renewals'

/**
 * The reminder half of the client-facts feature.
 *
 * "My insurance has to be extended every 6 months, and for that I need to
 * write my Betreuerin." Recording the date let a client SEE it; this is what makes
 * the date reach somebody who can act.
 *
 * The delivery choice is the part worth pinning: it is IN-APP because
 * `STAFF_EMAIL_RECIPIENTS` is unset on the live box, so `notifyStaff()`
 * returns false without sending, and staff hold no accounts to address
 * individually. A mailed reminder would be a reminder that does not exist —
 * the exact class this codebase keeps producing.
 */

const ROOT = join(__dirname, '..', '..', '..', '..')

function codeOf(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

describe('when a reminder is worth repeating', () => {
  it('fires at the notice window opening', () => {
    expect(isMilestoneDay(RENEWAL_NOTICE_DAYS)).toBe(true)
  })

  it('does NOT fire on an ordinary day inside the window', () => {
    // The whole point. A daily message for sixty days turns a warning into
    // wallpaper, and this repo already learned that alerts need a cooldown per
    // SUBJECT rather than per detection.
    expect(isMilestoneDay(59)).toBe(false)
    expect(isMilestoneDay(45)).toBe(false)
    expect(isMilestoneDay(2)).toBe(false)
  })

  it('fires on the day it lapses', () => {
    expect(isMilestoneDay(0)).toBe(true)
  })

  it('leaves the last week its own chances', () => {
    expect(isMilestoneDay(7)).toBe(true)
    expect(isMilestoneDay(1)).toBe(true)
  })

  it('needs no stored state to avoid repeating', () => {
    // Each milestone is a single day, and the check runs daily — so a document
    // is raised once per milestone with no lastNotifiedAt column to drift.
    const distinct = new Set(RENEWAL_MILESTONE_DAYS)
    expect(distinct.size).toBe(RENEWAL_MILESTONE_DAYS.length)
    expect([...RENEWAL_MILESTONE_DAYS].every((day) => day >= 0)).toBe(true)
  })

  it('every milestone lies inside the window the client is warned about', () => {
    // A milestone outside the window would fire while the client's own page
    // still says nothing — two surfaces disagreeing about the same date.
    const now = new Date('2026-09-07T00:00:00Z')
    for (const day of RENEWAL_MILESTONE_DAYS) {
      const due = new Date(now.getTime() + day * 24 * 60 * 60 * 1000)
      expect({ day, state: renewalState(due, now) }).toEqual({ day, state: 'due' })
    }
  })
})

describe('what the list can contain', () => {
  it('never carries a health contact', () => {
    // A dentist does not expire. The type narrows to the two dated kinds, so a
    // future dated fact has to opt in rather than arrive here by accident.
    const source = codeOf('src/lib/client-facts/renewals.ts')
    expect(source).not.toMatch(/clientHealthContact/)
  })

  it('reads both dated tables', () => {
    const source = codeOf('src/lib/client-facts/renewals.ts')
    expect(source).toMatch(/clientInsurance/)
    expect(source).toMatch(/clientPermit/)
  })
})

describe('the surface that shows it', () => {
  it('the approvals page renders expiring facts', () => {
    // The CALL, not the word.
    const page = codeOf('src/app/(admin)/approvals/page.tsx')
    expect(page).toMatch(/expiringFacts\(/)
  })

  it('applies the same per-kind visibility as the queue', () => {
    // A Jobcoach must see permits running out and no insurances. Reusing
    // mayReadFact is what keeps that from being a second, drifting rule.
    const page = codeOf('src/app/(admin)/approvals/page.tsx')
    expect(page).toMatch(/mayReadFact\(/)
  })
})
