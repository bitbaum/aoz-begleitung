/**
 * The KI-Assistent is a drafting aid, and every care role writes.
 *
 * It used to ride on `residents:write`, which is a permission about creating
 * and editing CLIENT RECORDS — nothing to do with drafting text. The symptom
 * was precise and backwards: the two roles who write the most prose in this
 * product, a Jobcoach (CVs, references) and a Freiwilligenarbeit coordinator
 * (listings), were the two the nav hid it from. Verified live on 2026-09-03 as
 * both the Jobcoach and the Freiwilligenarbeit coordinator: their entire user menu was Algorithmus and Hilfe.
 *
 * The second half was worse. `/api/ai/chat` and `/api/ai/form-assist` checked
 * only that a session existed, so the API served exactly the people the nav
 * told it was not for them — a declared boundary differing from the enforced
 * one, which is the same defect that let the `/algorithm` mismatch survive.
 */

import { ASSIGNABLE_STAFF_ROLES, hasPermission, type StaffCapabilities } from '../role-policy'
import { PERMISSION_DESCRIPTIONS } from '@/lib/config/permission-descriptions'
import { SYSTEM_LINKS } from '@/lib/config/navigation'

const specialist = (role: StaffCapabilities['role']): StaffCapabilities => ({
  role,
  scope: 'OWN_DOMAIN',
  isSystemAdmin: false,
})

describe('who may use the drafting assistant', () => {
  it.each(ASSIGNABLE_STAFF_ROLES)('%s can, even on their own domain alone', (role) => {
    expect(hasPermission(specialist(role), 'ai:assist')).toBe(true)
  })

  it('does not require the power to create client records', () => {
    // The whole point of the split. A Jobcoach drafts a CV and does not open
    // client files; if these two ever collapse back into one permission, the
    // lockout returns.
    const coach = specialist('JOBCOACH')
    expect(hasPermission(coach, 'ai:assist')).toBe(true)
    expect(hasPermission(coach, 'residents:write')).toBe(false)
  })

  it('is not a system permission — it belongs to care work, not administration', () => {
    expect(hasPermission(specialist('FREIWILLIGENARBEIT'), 'ai:assist')).toBe(true)
    expect(hasPermission(specialist('FREIWILLIGENARBEIT'), 'users:manage')).toBe(false)
  })
})

describe('the nav offers it on the same permission the route enforces', () => {
  it('the KI-Assistent entry is gated on ai:assist', () => {
    // If this drifts back to residents:write, the nav hides an entry the API
    // would have served — the mismatch this test exists to prevent.
    const entry = SYSTEM_LINKS.find((link) => link.href === '/ai-assistant')
    expect(entry?.permission).toBe('ai:assist')
  })

  it('the permission is described, so a settings screen can name it', () => {
    expect(PERMISSION_DESCRIPTIONS['ai:assist']).toBeTruthy()
  })
})
