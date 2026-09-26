import fs from 'fs'
import path from 'path'
import {
  COMPLAINT_PERMISSIONS,
  STAFF_ROLES,
  ROLE_PERMISSIONS,
  hasPermission,
  type StaffCapabilities,
  type StaffRole,
} from '../role-policy'

/**
 * A grievance channel whose reader may be its subject is not a grievance
 * channel.
 *
 * Every other permission in this product widens with `ALL_DOMAINS`, because
 * seeing every care domain is the entire point of that axis. These two must
 * not — the person holding oversight over every domain is one of the people a
 * complaint can be ABOUT. That exception is invisible in the permission table
 * and would be undone by anyone "tidying up" the special case in
 * `hasPermission`, so it is pinned here.
 */

const caps = (
  role: StaffRole,
  scope: StaffCapabilities['scope'] = 'OWN_DOMAIN',
  isSystemAdmin = false,
): StaffCapabilities => ({ role, scope, isSystemAdmin })

describe('who may read a complaint about the organisation', () => {
  it.each(COMPLAINT_PERMISSIONS.map((p) => [p]))(
    '%s is held by no care role, at any scope',
    (permission) => {
      for (const role of STAFF_ROLES) {
        expect({
          role,
          scope: 'OWN_DOMAIN',
          granted: hasPermission(caps(role), permission),
        }).toEqual({ role, scope: 'OWN_DOMAIN', granted: false })

        // The one that matters. The all-domains Betreuerin is BETREUUNG + ALL_DOMAINS, and a
        // complaint may be about the all-domains Betreuerin.
        expect({
          role,
          scope: 'ALL_DOMAINS',
          granted: hasPermission(caps(role, 'ALL_DOMAINS'), permission),
        }).toEqual({ role, scope: 'ALL_DOMAINS', granted: false })
      }
    },
  )

  it.each(COMPLAINT_PERMISSIONS.map((p) => [p]))('%s is granted by isSystemAdmin', (permission) => {
    expect(hasPermission(caps('BETREUUNG', 'OWN_DOMAIN', true), permission)).toBe(true)
  })

  it('appears in no role’s permission list, so ALL_DOMAINS cannot pick it up', () => {
    // `hasPermission`'s ALL_DOMAINS branch grants anything ANY role holds. If a
    // complaint verb were ever added to a role, oversight would inherit it and
    // the check above would start passing for the wrong reason.
    for (const role of STAFF_ROLES) {
      const held = ROLE_PERMISSIONS[role] as readonly string[]
      for (const permission of COMPLAINT_PERMISSIONS) {
        expect({ role, permission, listed: held.includes(permission) }).toEqual({
          role,
          permission,
          listed: false,
        })
      }
    }
  })
})

describe('a complaint never becomes a case against the person who filed it', () => {
  /**
   * The reason this table exists at all. `/api/portal/report` routes to the
   * maintenance board or the incident ladder, and that ladder escalates TOWARD
   * a resident, ending in FORMAL_MEASURE. Filing an objection to the Betreuung
   * as an Incident would open a case against the complainant.
   */
  const ROUTE = path.resolve(__dirname, '../../../app/api/portal/complaints/route.ts')

  it('the complaint route writes only to the complaint table', () => {
    const source = fs.readFileSync(ROUTE, 'utf8')
    expect(source).toMatch(/\.insert\(complaint\)/)
    expect(source).not.toMatch(/\.insert\(incident\)/)
    expect(source).not.toMatch(/\.insert\(maintenanceRequest\)/)
  })

  it('an anonymous complaint stores no resident, and no audit row names one', () => {
    const source = fs.readFileSync(ROUTE, 'utf8')
    // Comments stripped first. The route EXPLAINS in prose why it does not
    // call logAudit, and the first version of this assertion matched that
    // explanation and failed — a gate that reads documentation reports the
    // reasoning for a rule as a breach of it.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

    // The anonymity IS the null. An audit entry naming the reporter would
    // quietly undo what the form promises.
    expect(code).toMatch(/anonymous\s*\?\s*null\s*:\s*resident\.id/)
    expect(code).not.toMatch(/logAudit/)
  })
})
