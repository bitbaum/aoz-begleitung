import {
  CARE_ATTRIBUTE_CATALOG,
  CARE_DOMAIN_STAFF_ROLE,
  CARE_LABELS,
  CARE_ROLES,
  CARE_ROLE_LABELS,
  STAFF_ROLE_CARE_DOMAIN,
  canWriteCareDomain,
  isCatalogKey,
  writableCareDomains,
} from '@/lib/config/care'
import { STAFF_ROLES } from '@/lib/auth/role-policy'
import { roleHasCaseload } from '@/lib/config/care'

describe('the seat map is one mapping, not two', () => {
  /**
   * `STAFF_ROLE_CARE_DOMAIN` used to be a second hand-written literal in
   * `config/care-role-domain.ts` — the inverse of `CARE_DOMAIN_STAFF_ROLE`,
   * with nothing deriving it and no test comparing them. Adding a fifth seat
   * could update one file and ship green.
   */
  it('round-trips in both directions', () => {
    for (const domain of CARE_ROLES) {
      expect(STAFF_ROLE_CARE_DOMAIN[CARE_DOMAIN_STAFF_ROLE[domain]]).toBe(domain)
    }
  })

  it('gives every care role exactly one seat, and the seatless roles none', () => {
    // Two roles have no seat, for OPPOSITE reasons, and both must stay
    // seatless: ADMIN works every domain, LIEGENSCHAFTEN works none — the Liegenschaften lead
    // is responsible for the buildings, never for a person's care.
    const SEATLESS: readonly string[] = ['ADMIN', 'LIEGENSCHAFTEN']

    for (const role of STAFF_ROLES) {
      if (SEATLESS.includes(role)) {
        // "Which seat is theirs?" has no answer. Callers must handle that
        // rather than be handed an arbitrary domain.
        expect(STAFF_ROLE_CARE_DOMAIN[role]).toBeUndefined()
      } else {
        expect(CARE_ROLES).toContain(STAFF_ROLE_CARE_DOMAIN[role])
      }
    }
    // No two roles share a seat, and no seat is left without an owner.
    expect(new Set(Object.values(CARE_DOMAIN_STAFF_ROLE)).size).toBe(CARE_ROLES.length)
  })
})

describe('the workspace subtitle names the seats actually shown', () => {
  /**
   * The subtitle was a fixed sentence naming all four seats, above a workspace
   * that now renders only the viewer's own. Same shape as the portal group
   * called "Zusammen entscheiden" with nothing left to decide: the list
   * changed, the name stayed, everything green.
   */
  it('never names a seat the viewer is not being shown', () => {
    for (const role of STAFF_ROLES) {
      const shown = writableCareDomains({ role, scope: 'OWN_DOMAIN', isSystemAdmin: false })
      const subtitle = CARE_LABELS.workspaceSubtitle(shown)
      for (const domain of CARE_ROLES) {
        if (shown.includes(domain)) {
          expect(subtitle).toContain(CARE_ROLE_LABELS[domain])
        } else {
          expect(subtitle).not.toContain(CARE_ROLE_LABELS[domain])
        }
      }
    }
  })
})

describe('care domains', () => {
  it('lets Leitung work every seat, and each specialist only their own', () => {
    expect(
      writableCareDomains({ role: 'ADMIN', scope: 'ALL_DOMAINS', isSystemAdmin: false }),
    ).toEqual([...CARE_ROLES])
    expect(
      writableCareDomains({ role: 'BETREUUNG', scope: 'OWN_DOMAIN', isSystemAdmin: false }),
    ).toEqual(['HOUSING'])
    expect(
      writableCareDomains({ role: 'SOZIALARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false }),
    ).toEqual(['SOCIAL'])
    expect(
      writableCareDomains({ role: 'JOBCOACH', scope: 'OWN_DOMAIN', isSystemAdmin: false }),
    ).toEqual(['JOB'])
    expect(
      writableCareDomains({
        role: 'FREIWILLIGENARBEIT',
        scope: 'OWN_DOMAIN',
        isSystemAdmin: false,
      }),
    ).toEqual(['VOLUNTEERING'])
    expect(
      canWriteCareDomain(
        { role: 'JOBCOACH', scope: 'OWN_DOMAIN', isSystemAdmin: false },
        'HOUSING',
      ),
    ).toBe(false)
    expect(
      canWriteCareDomain(
        { role: 'FREIWILLIGENARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false },
        'VOLUNTEERING',
      ),
    ).toBe(true)
    expect(
      canWriteCareDomain({ role: 'ADMIN', scope: 'ALL_DOMAINS', isSystemAdmin: false }, 'JOB'),
    ).toBe(true)
  })

  it('keeps catalog keys unique per domain, so a form field cannot collide', () => {
    for (const domain of CARE_ROLES) {
      const keys = CARE_ATTRIBUTE_CATALOG[domain].map((item) => item.key)
      expect(new Set(keys).size).toBe(keys.length)
      for (const key of keys) {
        expect(isCatalogKey(domain, key)).toBe(true)
      }
      expect(isCatalogKey(domain, 'diagnosis')).toBe(false)
    }
  })
})

describe('a role either carries a caseload or does not', () => {
  /**
   * Counting somebody's care assignments cannot answer this. The Freiwilligenarbeit coordinator with zero
   * clients is WAITING to be assigned; the Liegenschaften lead with zero is doing the job. Both
   * count 0, and the dashboard must say different things to them.
   */
  it('says yes for the four care domains', () => {
    expect(roleHasCaseload('BETREUUNG')).toBe(true)
    expect(roleHasCaseload('SOZIALARBEIT')).toBe(true)
    expect(roleHasCaseload('JOBCOACH')).toBe(true)
    expect(roleHasCaseload('FREIWILLIGENARBEIT')).toBe(true)
  })

  it('says no for the role that runs the buildings', () => {
    expect(roleHasCaseload('LIEGENSCHAFTEN')).toBe(false)
  })

  it('is derived from the seat map, not a second list', () => {
    // If it were written out by hand it could disagree with the map, and then
    // a role would be told it has a caseload it can never be given.
    for (const role of STAFF_ROLES) {
      expect(roleHasCaseload(role)).toBe(STAFF_ROLE_CARE_DOMAIN[role] !== undefined)
    }
  })
})
