import { describe, expect, it } from 'vitest'

import { fallbackCta } from '@/lib/config/dashboard'
import { defaultIntegrationBoardForRole } from '@/lib/config/integration-boards'
import type { StaffCapabilities, StaffRole } from '@/lib/auth/role-policy'

/**
 * On a quiet day, a specialist is sent to their OWN board.
 *
 * `DASHBOARD_FALLBACK_CTAS` is ordered by permission alone, and its second
 * entry is `learning:write` — documented in that file as "the coaching roles'
 * home". True of a Jobcoach. False of the Freiwilligenarbeit coordinator, who
 * also holds `learning:write`: the Freiwilligenarbeit coordinator's "Alles unter Kontrolle" screen offered
 * one button, and it opened the Jobcoach's surface.
 *
 * Found by opening that dashboard during a walk of the live product. Nothing
 * failed, because a CTA that resolves is indistinguishable from a CTA that
 * resolves CORRECTLY.
 */

const viewer = (role: StaffRole): StaffCapabilities => ({
  role,
  scope: 'OWN_DOMAIN',
  isSystemAdmin: false,
})

describe('a specialist lands on their own board', () => {
  it('sends the volunteering coordinator to volunteering, not to learning', () => {
    const cta = fallbackCta(viewer('FREIWILLIGENARBEIT'))
    expect(cta.labelKey).toBe('actionOpenVolunteering')
    expect(cta.href).toContain('board=volunteering')
  })

  it('leaves the Jobcoach on Lernen & Beruf, which it owns by name', () => {
    // Deliberate, and pinned by two older tests: the surface is called
    // "Lernen & Beruf" — learning AND work — so the generic ladder already
    // lands the Jobcoach somewhere that belongs to that role. Redirecting the Jobcoach too was an
    // over-reach in the first version of this change.
    expect(fallbackCta(viewer('JOBCOACH')).labelKey).toBe('actionOpenLearning')
  })

  it('agrees with the board the nav opens for that role', () => {
    // One SSOT decides which board a role belongs on. If this button and the
    // nav ever disagree, a coordinator is invited somewhere their own menu does
    // not take them.
    expect(fallbackCta(viewer('FREIWILLIGENARBEIT')).href).toContain(
      `board=${defaultIntegrationBoardForRole('FREIWILLIGENARBEIT')}`,
    )
  })
})

describe('everyone else keeps the generic ladder', () => {
  it('offers Betreuung the intake action', () => {
    // Creating a client is the product's main intake and stays first.
    expect(fallbackCta(viewer('BETREUUNG')).labelKey).toBe('actionCreateResident')
  })

  it('never leaves a role without a button', () => {
    // dashboard:read is held by every role, so the last resort always matches.
    const roles: StaffRole[] = [
      'ADMIN',
      'BETREUUNG',
      'SOZIALARBEIT',
      'JOBCOACH',
      'FREIWILLIGENARBEIT',
      'LIEGENSCHAFTEN',
    ]
    for (const role of roles) {
      const cta = fallbackCta(viewer(role))
      expect({ role, href: !!cta.href, label: !!cta.labelKey }).toEqual({
        role,
        href: true,
        label: true,
      })
    }
  })

  it('gives Liegenschaften something it can actually open', () => {
    // It holds neither residents:write nor learning:write, so it falls through
    // to the guaranteed last resort rather than to a page it cannot reach.
    const cta = fallbackCta(viewer('LIEGENSCHAFTEN'))
    expect(cta.labelKey).toBe('actionViewStats')
  })
})
