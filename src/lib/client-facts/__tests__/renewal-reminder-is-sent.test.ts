import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

import { renewalReminder } from '@/lib/email/templates'
import { RENEWAL_MILESTONE_DAYS, isMilestoneDay } from '../renewals'

/**
 * The reminder has to leave the building.
 *
 * WHAT SHIPPED: `expiringFacts` reached two staff PAGES, and `isMilestoneDay`
 * — the cooldown rule written for a daily check — was exported, tested, and
 * called by nothing. So the feature answered "my insurance expires every six
 * months and I have to write my Betreuerin" with a tile that only helps the person
 * who was already looking. The comment at the top of `renewals.ts` justified
 * that: `STAFF_EMAIL_RECIPIENTS` was unset, so mail reached nobody. True when
 * written; false within the week, once the variable was set and delivery
 * verified. The justification outlived the constraint.
 *
 * AND THE REMINDER MUST NOT BECOME THE LEAK. `mayReadFact` decides per person
 * which client facts they may see — an insurance is Betreuung and
 * Sozialarbeit, a permit additionally the Jobcoach, Liegenschaften neither.
 * `notifyStaff` writes to ONE shared address and cannot honour that. So the
 * mail carries a count and a link; the page behind the link applies the
 * policy. These two rules are tested together on purpose, because satisfying
 * either one alone is how this gets broken: a reminder nobody receives, or a
 * reminder that hands a permit letter to the wrong inbox.
 */

const ROOT = join(__dirname, '..', '..', '..', '..')
const CRON = 'src/app/api/cron/notifications/route.ts'

function codeOf(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

describe('the daily check actually runs it', () => {
  const cron = codeOf(CRON)

  it('calls expiringFacts', () => {
    // The whole defect in one assertion: nothing called it outside a page.
    expect(cron).toMatch(/expiringFacts\(/)
  })

  it('applies the milestone cooldown rather than mailing every day', () => {
    // Sixty consecutive mails is how a warning becomes wallpaper.
    expect(cron).toMatch(/isMilestoneDay\(/)
  })

  it('sends the reminder', () => {
    expect(cron).toMatch(/renewalReminder\(/)
    expect(cron).toMatch(/notifyStaff\(/)
  })

  it('skips facts a staff member has already rejected', () => {
    // Nagging about a date nobody believes.
    expect(cron).toMatch(/'REJECTED'/)
  })
})

describe('the mail is a pointer, not the facts', () => {
  const body = renewalReminder(3, 14)

  it('says how many and how soon', () => {
    expect(body.subject).toContain('3')
    expect(body.html).toContain('14')
  })

  it('links to the page where the reader policy is applied', () => {
    expect(body.html).toMatch(/href="[^"]*\/approvals"/)
  })

  it('carries no client, no insurer and no permit letter', () => {
    // renewalReminder cannot leak them: its signature has nowhere to put them.
    // That is the point — a template that never receives the sensitive fields
    // cannot be edited into disclosing them by accident later, and this
    // assertion is the one that would fail the day someone widens it.
    expect(renewalReminder.length).toBe(2)

    // Naming the two CATEGORIES in the heading is fine and is not what leaks;
    // an INSTANCE is. A client code, or a specific permit letter.
    for (const prefix of ['RES-', 'KL-', 'AOZ-', 'WG-']) {
      expect(body.html).not.toContain(prefix)
    }
    expect(body.html).not.toMatch(/Ausweis\s+[NFBCS]\b/)
  })

  it('speaks correctly about one, today, tomorrow and a lapse', () => {
    expect(renewalReminder(1, 30).subject).toContain('1 Dokument läuft ab')
    expect(renewalReminder(2, 30).subject).toContain('2 Dokumente laufen ab')
    expect(renewalReminder(1, 0).html).toContain('heute')
    expect(renewalReminder(1, 1).html).toContain('morgen')
    expect(renewalReminder(1, -3).html).toContain('abgelaufen')
  })
})

describe('the milestones themselves', () => {
  it('fire once per crossing and nowhere between', () => {
    for (const day of RENEWAL_MILESTONE_DAYS) expect(isMilestoneDay(day)).toBe(true)
    for (const day of [59, 45, 31, 21, 13, 8, 2]) expect(isMilestoneDay(day)).toBe(false)
  })

  it('include the day it lapses', () => {
    // The last honest moment to act before a client is uninsured.
    expect(isMilestoneDay(0)).toBe(true)
  })
})
