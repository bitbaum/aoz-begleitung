import { describe, expect, it } from 'vitest'

import { CARE_ROLES, canStaffWorkDomain } from '@/lib/config/care'
import { STAFF_ROLES } from '@/lib/auth/role-policy'

/**
 * A client's team may only name people who could actually do that job.
 *
 * The picker on a client's page offered EVERY active account for EVERY seat,
 * because `listAssignableStaff` selected `role` and read it nowhere. So the Liegenschaften lead
 * — `LIEGENSCHAFTEN`, a role that maps to no care domain at all — was offered
 * as a Jobcoach, and the Jobcoach was offered as Freiwilligenarbeit.
 *
 * `saveCareSeat` did not stop it either: it checks who is EDITING the seat,
 * never who is being NAMED in it. So the mistake was one click away, and a
 * wrongly staffed seat looks exactly like a correctly staffed one afterwards —
 * the client appears covered, and the person named never sees them on any
 * queue, because every queue is built from `careAssignment.role` matching
 * their own domain.
 */

const staff = (role: string, scope = 'OWN_DOMAIN') => ({ role, scope })

describe('who may be named on a client team', () => {
  it('lets a specialist hold their own domain', () => {
    expect(canStaffWorkDomain(staff('JOBCOACH'), 'JOB')).toBe(true)
    expect(canStaffWorkDomain(staff('FREIWILLIGENARBEIT'), 'VOLUNTEERING')).toBe(true)
    expect(canStaffWorkDomain(staff('BETREUUNG'), 'HOUSING')).toBe(true)
    expect(canStaffWorkDomain(staff('SOZIALARBEIT'), 'SOCIAL')).toBe(true)
  })

  it('keeps a specialist out of somebody else’s domain', () => {
    expect(canStaffWorkDomain(staff('JOBCOACH'), 'VOLUNTEERING')).toBe(false)
    expect(canStaffWorkDomain(staff('FREIWILLIGENARBEIT'), 'JOB')).toBe(false)
    expect(canStaffWorkDomain(staff('SOZIALARBEIT'), 'HOUSING')).toBe(false)
  })

  it('keeps the role with no care domain out of EVERY seat', () => {
    // The case that prompted this. The Liegenschaften lead runs the buildings and holds no
    // client's file in any domain and never will.
    for (const domain of CARE_ROLES) {
      expect(canStaffWorkDomain(staff('LIEGENSCHAFTEN'), domain)).toBe(false)
    }
  })

  it('lets somebody who covers every domain hold any seat', () => {
    // The all-domains Betreuerin is BETREUUNG + ALL_DOMAINS and holds HOUSING seats; the same
    // breadth is what lets that account cover a seat nobody is staffed for.
    for (const domain of CARE_ROLES) {
      expect(canStaffWorkDomain(staff('BETREUUNG', 'ALL_DOMAINS'), domain)).toBe(true)
    }
  })

  it('leaves no seat unfillable and no role silently universal', () => {
    for (const domain of CARE_ROLES) {
      const eligible = STAFF_ROLES.filter((role) => canStaffWorkDomain(staff(role), domain))
      expect(eligible.length, `nobody at all could hold ${domain}`).toBeGreaterThan(0)
    }
    // And no OWN_DOMAIN role sneaks into every seat — that would mean the
    // filter is not filtering.
    const universal = STAFF_ROLES.filter((role) =>
      CARE_ROLES.every((domain) => canStaffWorkDomain(staff(role), domain)),
    )
    expect(universal).toEqual([])
  })
})
